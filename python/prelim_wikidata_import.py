#!/usr/bin/env python3
"""
Load regions, languages, and language↔region links from Wikidata into your schema.

Tables expected: region, region_property, region_source,
                 language_entity, language_entity_source, language_entity_region.

Wikidata properties used:
- Countries: instance of country (Q6256); ISO 3166-1 alpha-2 (P297), alpha-3 (P298).
- Languages: instance of language (Q34770), language family (Q25295), dialect (Q33384).
  Codes: ISO639-1 (P218), ISO639-2 (P219), ISO639-3 (P220), Glottolog (P1394),
         Linguasphere (P1396), IETF tag (P305), Wikimedia language code (P424).
- Links: official language (P37), language used (P2936).
"""
import os, uuid, json, time, pathlib
import psycopg2
import psycopg2.extras as extras
import requests

WQS = "https://query.wikidata.org/sparql"
UA  = "LangRegionLoader/1.0 (https://example.org; mailto:admin@example.org)"

def sparql(query, max_retries=3):
    headers = {"Accept": "application/sparql-results+json", "User-Agent": UA}
    for attempt in range(max_retries):
        r = requests.get(WQS, params={"query": query}, headers=headers, timeout=120)
        if r.status_code == 200:
            data = r.json()["results"]["bindings"]
            # normalize: return str or None
            def val(b, k): return b[k]["value"] if k in b else None
            return data, val
        if r.status_code in (429, 502, 503, 504):
            time.sleep(2 + attempt * 2)
            continue
        r.raise_for_status()
    raise RuntimeError("SPARQL failed repeatedly")

def _load_local_env():
    """Load variables from .env.local (and supabase/.env if present) into os.environ without overriding existing."""
    repo_root = pathlib.Path(__file__).resolve().parents[1]
    candidates = [repo_root / ".env.local", repo_root / "supabase" / ".env"]
    for path in candidates:
        if not path.exists():
            continue
        try:
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    os.environ.setdefault(key, val)
        except Exception:
            # Best-effort; ignore parse errors
            pass


def db():
    """Connect to Postgres using common local Supabase envs, then sane defaults."""
    _load_local_env()
    # Priority resolution for URL-like vars
    url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("SUPABASE_DB_URL")
        or os.environ.get("PS_DATA_SOURCE_URI")
        or None
    )
    if not url:
        # Try PG* set
        pg_host = os.environ.get("PGHOST")
        pg_port = os.environ.get("PGPORT")
        pg_user = os.environ.get("PGUSER")
        pg_pass = os.environ.get("PGPASSWORD")
        pg_db = os.environ.get("PGDATABASE")
        if all([pg_host, pg_port, pg_user, pg_pass, pg_db]):
            url = f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}?sslmode=disable"

    if not url:
        # Fallback to typical Supabase local defaults or custom SUPABASE_DB_* vars
        host = os.environ.get("SUPABASE_DB_HOST", "127.0.0.1")
        port = os.environ.get("SUPABASE_DB_PORT", "54322")
        user = os.environ.get("SUPABASE_DB_USER", "postgres")
        password = os.environ.get("SUPABASE_DB_PASSWORD", "postgres")
        dbname = os.environ.get("SUPABASE_DB_NAME", "postgres")
        url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}?sslmode=disable"

    conn = psycopg2.connect(url)
    conn.autocommit = False
    return conn

def upsert_region(cur, rid, name, parent_id, path, iso2=None, iso3=None, qid=None):
    cur.execute(
        """
        INSERT INTO public.region (id, parent_id, name, path)
        VALUES (%s,%s,%s,%s)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, path=EXCLUDED.path, updated_at=now()
        """,
        (rid, parent_id, name, path),
    )
    if iso2:
        cur.execute(
            """
            INSERT INTO public.region_property (id, region_id, key, value)
            VALUES (%s,%s,'iso_3166_1_alpha2',%s)
            ON CONFLICT (region_id, key) DO UPDATE SET value=EXCLUDED.value
            """,
            (str(uuid.uuid4()), rid, iso2),
        )
    if iso3:
        cur.execute(
            """
            INSERT INTO public.region_property (id, region_id, key, value)
            VALUES (%s,%s,'iso_3166_1_alpha3',%s)
            ON CONFLICT (region_id, key) DO UPDATE SET value=EXCLUDED.value
            """,
            (str(uuid.uuid4()), rid, iso3),
        )
    if qid:
        cur.execute(
            """
            INSERT INTO public.region_source (id, region_id, source, version, external_id, url, data)
            VALUES (%s,%s,'wikidata',NULL,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                str(uuid.uuid4()),
                rid,
                qid,
                f"https://www.wikidata.org/wiki/{qid}",
                json.dumps({"iso2": iso2, "iso3": iso3}),
            ),
        )

def upsert_language(cur, qid, name, level):
    cur.execute(
        """
        INSERT INTO public.language_entity (id, parent_id, name, level, path)
        VALUES (%s,NULL,%s,%s,NULL)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, level=EXCLUDED.level, updated_at=now()
        """,
        (qid, name, level),
    )

def add_lang_source(cur, lang_id, source, external_id, url=None, data=None):
    if not external_id:
        return
    cur.execute(
        """
        INSERT INTO public.language_entity_source (id, language_entity_id, source, external_id, version, url, data)
        VALUES (%s,%s,%s,%s,NULL,%s,%s)
        ON CONFLICT (language_entity_id, source, external_id) DO NOTHING
        """,
        (str(uuid.uuid4()), lang_id, source, external_id, url, json.dumps(data or {})),
    )

def link_lang_region(cur, lang_id, region_id, relation):
    cur.execute(
        """
        INSERT INTO public.language_entity_region (id, language_entity_id, region_id, relation)
        VALUES (%s,%s,%s,%s)
        ON CONFLICT (language_entity_id, region_id) DO UPDATE SET relation=EXCLUDED.relation, updated_at=now()
        """,
        (str(uuid.uuid4()), lang_id, region_id, relation),
    )

def ensure_language_exists(cur, qid, name, default_level="language"):
    """Insert a language entity only if missing; do not overwrite existing rows."""
    cur.execute(
        """
        INSERT INTO public.language_entity (id, parent_id, name, level, path)
        VALUES (%s,NULL,%s,%s,NULL)
        ON CONFLICT (id) DO NOTHING
        """,
        (qid, name, default_level),
    )

def ensure_region_exists(cur, qid, name):
    """Insert a region row only if missing; default under world path if not present."""
    # Prefer a readable path by using the QID suffix when we don't have ISO codes here
    path = f"world.{qid}"
    cur.execute(
        """
        INSERT INTO public.region (id, parent_id, name, path)
        VALUES (%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
        """,
        (qid, "world", name, path),
    )

COUNTRIES_Q = """
SELECT ?c ?cLabel ?a2 ?a3 WHERE {
  ?c wdt:P31 wd:Q6256 .
  OPTIONAL { ?c wdt:P297 ?a2 }  # ISO 3166-1 alpha-2
  OPTIONAL { ?c wdt:P298 ?a3 }  # ISO 3166-1 alpha-3
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 2500
"""

LANGS_Q = """
SELECT ?l ?lLabel ?inst ?iso1 ?iso2 ?iso3 ?gl ?ls ?ietf ?wm WHERE {
  VALUES ?inst { wd:Q34770 wd:Q25295 wd:Q33384 }  # language / family / dialect
  ?l wdt:P31 ?inst .
  OPTIONAL { ?l wdt:P218 ?iso1 }  # ISO 639-1
  OPTIONAL { ?l wdt:P219 ?iso2 }  # ISO 639-2
  OPTIONAL { ?l wdt:P220 ?iso3 }  # ISO 639-3
  OPTIONAL { ?l wdt:P1394 ?gl }   # Glottolog
  OPTIONAL { ?l wdt:P1396 ?ls }   # Linguasphere
  OPTIONAL { ?l wdt:P305 ?ietf }  # IETF
  OPTIONAL { ?l wdt:P424 ?wm }    # Wikimedia language code
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 30000
"""

REGION_LANG_LINKS_Q = """
SELECT ?c ?cLabel ?l ?lLabel ?rel WHERE {
  {
    ?c wdt:P31 wd:Q6256 .
    ?c wdt:P37 ?l .              # official language
    BIND("official" AS ?rel)
  } UNION {
    ?c wdt:P31 wd:Q6256 .
    ?c wdt:P2936 ?l .            # language used
    BIND("used" AS ?rel)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 50000
"""

def main():
    conn = db()
    try:
        with conn.cursor() as cur:
            # Root region
            upsert_region(cur, "world", "World", None, "world")

            # Regions (countries)
            rows, V = sparql(COUNTRIES_Q)
            for b in rows:
                qid = V(b, "c").rpartition("/")[-1]
                name = V(b, "cLabel") or qid
                a2 = V(b, "a2")
                a3 = V(b, "a3")
                path = f"world.{a2}" if a2 else f"world.{qid}"
                upsert_region(cur, qid, name, "world", path, a2, a3, qid)

            # Languages
            rows, V = sparql(LANGS_Q)
            for b in rows:
                qid = V(b, "l").rpartition("/")[-1]
                name = V(b, "lLabel") or qid
                inst = V(b, "inst").rpartition("/")[-1]
                if inst == "Q25295":
                    level = "family"
                elif inst == "Q33384":
                    level = "dialect"
                else:
                    level = "language"
                upsert_language(cur, qid, name, level)

                # Identifiers
                add_lang_source(cur, qid, "wikidata", qid, f"https://www.wikidata.org/wiki/{qid}")
                add_lang_source(cur, qid, "iso_639_1", V(b, "iso1"))
                add_lang_source(cur, qid, "iso_639_2", V(b, "iso2"))
                add_lang_source(cur, qid, "iso_639_3", V(b, "iso3"))
                add_lang_source(cur, qid, "glottolog", V(b, "gl"), "https://glottolog.org")
                add_lang_source(cur, qid, "linguasphere", V(b, "ls"))
                add_lang_source(cur, qid, "ietf", V(b, "ietf"))
                add_lang_source(cur, qid, "wikimedia_language_code", V(b, "wm"))

            # Language↔Region links
            rows, V = sparql(REGION_LANG_LINKS_Q)
            for b in rows:
                rqid = V(b, "c").rpartition("/")[-1]
                lqid = V(b, "l").rpartition("/")[-1]
                lname = V(b, "lLabel") or lqid
                rname = V(b, "cLabel") or rqid
                rel  = V(b, "rel")
                # Ensure language exists in case it wasn't in the main LANGS_Q result
                ensure_language_exists(cur, lqid, lname)
                # Ensure region exists in case it wasn't created (defensive)
                ensure_region_exists(cur, rqid, rname)
                # Link (idempotent)
                link_lang_region(cur, lqid, rqid, rel)

        conn.commit()
        print("Load complete.")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
