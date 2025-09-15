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
import os, uuid, json, time, pathlib, datetime, logging
import psycopg2
import psycopg2.extras as extras
import requests

# Local trial configuration (single location)
# Point to local WDQS over your Blazegraph JNL and throttle/filters for a short run.
# os.environ.setdefault("WIKIDATA_SPARQL_ENDPOINT", "http://localhost:9999/bigdata/namespace/wdq/sparql")
# os.environ.setdefault("WDQS_THROTTLE", "0")
# Use public WDQS with conservative throttle and a small initial scope.
os.environ.setdefault("WIKIDATA_SPARQL_ENDPOINT", "https://query.wikidata.org/sparql")
os.environ.setdefault("WDQS_THROTTLE", "1")
os.environ.setdefault("WIKIDATA_COUNTRIES", "")
os.environ.setdefault("MAX_SUBREGION_DEPTH", "1")
os.environ.setdefault("SKIP_ALIASES", "0")
os.environ.setdefault("SKIP_LANGS", "0")

WQS = os.environ.get("WIKIDATA_SPARQL_ENDPOINT", "https://query.wikidata.org/sparql")
UA  = "LangRegionLoader/1.0 (https://example.org; mailto:admin@example.org)"
IMPORT_VERSION = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
SUBREGION_CHUNK_SIZE = 10
MAX_SUBREGION_DEPTH = int(os.environ.get("MAX_SUBREGION_DEPTH", "3"))
SUBREGION_FRONTIER_BATCH = int(os.environ.get("SUBREGION_FRONTIER_BATCH", "50"))
THROTTLE_SECONDS = float(os.environ.get("WDQS_THROTTLE", "0.5"))
REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE_DIR = REPO_ROOT / "python" / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").lower() in ("1", "true", "yes", "y", "on")

def _log_every(idx: int, total: int, step: int, label: str):
    if idx % step == 0 or idx + 1 == total:
        logging.info(f"{label}: {idx+1}/{total}")

def _cache_path(tag: str) -> pathlib.Path:
    safe = tag.replace("/", "_").replace(" ", "_")
    return CACHE_DIR / f"{safe}.json"

def sparql(query, max_retries=5, cache_tag: str | None = None):
    # Cache read
    if cache_tag:
        p = _cache_path(cache_tag)
        if p.exists():
            logging.info(f"SPARQL cache hit: {cache_tag}")
            with p.open("r", encoding="utf-8") as f:
                data = json.load(f)
            def val(b, k): return b.get(k, {}).get("value") if isinstance(b.get(k), dict) else b.get(k)
            return data, val

    headers = {"Accept": "application/sparql-results+json", "User-Agent": UA}
    backoff = 1.5
    logging.info(f"SPARQL fetch start: {cache_tag or 'no-tag'} endpoint={WQS}")
    for attempt in range(max_retries):
        time.sleep(THROTTLE_SECONDS)
        try:
            r = requests.post(WQS, data={"query": query}, headers=headers, timeout=240)
        except requests.exceptions.RequestException as e:
            logging.warning(f"SPARQL connection error attempt {attempt+1}/{max_retries}: {e}")
            time.sleep((attempt + 1) * backoff)
            continue
        if r.status_code == 200:
            data = r.json()["results"]["bindings"]
            # cache write
            if cache_tag:
                p = _cache_path(cache_tag)
                with p.open("w", encoding="utf-8") as f:
                    json.dump(data, f)
            logging.info(f"SPARQL fetch done: {cache_tag or 'no-tag'} rows={len(data)}")
            def val(b, k): return b[k]["value"] if k in b else None
            return data, val
        if r.status_code in (429, 502, 503, 504):
            logging.warning(f"SPARQL retry {attempt+1}/{max_retries} status={r.status_code} tag={cache_tag}")
            time.sleep((attempt + 1) * backoff)
            continue
        logging.error(f"SPARQL error status={r.status_code} text={r.text[:200]}")
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
    url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable"
    conn = psycopg2.connect(url)
    conn.autocommit = False
    return conn

def upsert_region(cur, rid, name, parent_id, path, iso2=None, iso3=None, qid=None):
    cur.execute(
        """
        INSERT INTO public.region (id, parent_id, name, path)
        VALUES (%s,%s,%s,%s)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, path=EXCLUDED.path, last_updated=now()
        """,
        (rid, parent_id, name, path),
    )
    if iso2:
        cur.execute(
            """
            INSERT INTO public.region_property (id, region_id, key, value)
            VALUES (%s,%s,'iso_3166_1_alpha2',%s)
            ON CONFLICT (region_id, key) DO UPDATE SET value=EXCLUDED.value, last_updated=now()
            """,
            (str(uuid.uuid4()), rid, iso2),
        )
    if iso3:
        cur.execute(
            """
            INSERT INTO public.region_property (id, region_id, key, value)
            VALUES (%s,%s,'iso_3166_1_alpha3',%s)
            ON CONFLICT (region_id, key) DO UPDATE SET value=EXCLUDED.value, last_updated=now()
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
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, level=EXCLUDED.level, last_updated=now()
        """,
        (qid, name, level),
    )

def add_lang_source(cur, lang_id, source, external_id, url=None, data=None, version=None):
    if not external_id:
        return
    cur.execute(
        """
        INSERT INTO public.language_entity_source (id, language_entity_id, source, external_id, version, url, data)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (language_entity_id, source, external_id) DO NOTHING
        """,
        (str(uuid.uuid4()), lang_id, source, external_id, version or IMPORT_VERSION, url, json.dumps(data or {})),
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

def insert_language_alias(cur, lang_id, alias_name):
    if not alias_name:
        return
    cur.execute(
        """
        INSERT INTO public.language_alias (id, language_entity_id, alias_name)
        VALUES (%s,%s,%s)
        ON CONFLICT (language_entity_id, alias_name) DO NOTHING
        """,
        (str(uuid.uuid4()), lang_id, alias_name),
    )

def insert_region_alias(cur, region_id, alias_name):
    if not alias_name:
        return
    cur.execute(
        """
        INSERT INTO public.region_alias (id, region_id, alias_name)
        VALUES (%s,%s,%s)
        ON CONFLICT (region_id, alias_name) DO NOTHING
        """,
        (str(uuid.uuid4()), region_id, alias_name),
    )

def safe_set_language_parent(cur, child_id: str, parent_id: str):
    """Update parent_id for a language, resolving (parent_id, name) uniqueness collisions by disambiguating the name.

    Some databases enforce a unique constraint on (parent_id, name). Wikidata can have homonyms under the same parent.
    This function retries the update by appending the QID to the entity name if needed.
    """
    cur.execute("SAVEPOINT sp_lang_parent")
    try:
        cur.execute(
            "UPDATE public.language_entity SET parent_id=%s, last_updated=now() WHERE id=%s",
            (parent_id, child_id),
        )
        return
    except psycopg2.errors.UniqueViolation:
        # Name collision under the same parent. Disambiguate name by appending the QID suffix once.
        cur.execute("ROLLBACK TO SAVEPOINT sp_lang_parent")
        cur.execute(
            """
            UPDATE public.language_entity
            SET name = CASE
                WHEN position(' [' || %s || ']' in name) > 0 THEN name
                ELSE name || ' [' || %s || ']'
            END,
                last_updated = now()
            WHERE id = %s
            """,
            (child_id, child_id, child_id),
        )
        # Retry set parent
        cur.execute(
            "UPDATE public.language_entity SET parent_id=%s, last_updated=now() WHERE id=%s",
            (parent_id, child_id),
        )

CONTINENTS_Q = """
SELECT ?cont ?contLabel WHERE {
  ?cont wdt:P31 wd:Q5107 . # continent
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

COUNTRIES_Q = """
SELECT ?c ?cLabel ?a2 ?a3 ?continent ?continentLabel WHERE {
  ?c wdt:P31 wd:Q6256 .
  OPTIONAL { ?c wdt:P297 ?a2 }  # ISO 3166-1 alpha-2
  OPTIONAL { ?c wdt:P298 ?a3 }  # ISO 3166-1 alpha-3
  OPTIONAL { ?c wdt:P30 ?continent } # continent
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

LANG_PARENTS_Q = """
SELECT ?child ?parent WHERE {
  {
    ?child wdt:P31 wd:Q34770 .   # language
    { ?child wdt:P361 ?parent } UNION { ?child wdt:P279 ?parent }
    ?parent wdt:P31 wd:Q25295 .  # parent is a language family
  } UNION {
    ?child wdt:P31 wd:Q33384 .   # dialect
    { ?child wdt:P361 ?parent }  # parent is usually a language
    FILTER EXISTS { ?parent wdt:P31 wd:Q34770 }
  }
}
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

LANGUAGE_ALIASES_Q = """
SELECT ?l ?alias WHERE {
  ?l wdt:P31/wdt:P279* wd:Q34770 .
  ?l skos:altLabel ?alias .
  FILTER(LANG(?alias) IN ("en","es","fr","de","ru","zh","ar","hi","pt"))
}
LIMIT 200000
"""

REGION_ALIASES_Q = """
SELECT ?r ?alias WHERE {
  ?r wdt:P31 wd:Q6256 .
  ?r skos:altLabel ?alias .
  FILTER(LANG(?alias) IN ("en","es","fr","de","ru","zh","ar","hi","pt"))
}
LIMIT 200000
"""

LANG_NATIVE_Q = """
SELECT ?l ?native WHERE {
  ?l wdt:P31/wdt:P279* wd:Q34770 .
  ?l wdt:P1705 ?native .
}
LIMIT 200000
"""

REGION_NATIVE_Q = """
SELECT ?r ?native WHERE {
  ?r wdt:P31 wd:Q6256 .
  ?r wdt:P1705 ?native .
}
LIMIT 200000
"""

def build_subregions_level_query(parent_qids):
    values = " ".join(f"wd:{qid}" for qid in parent_qids)
    return f"""
SELECT ?child ?childLabel ?parent ?parentLabel WHERE {{
  ?child wdt:P131 ?parent .
  VALUES ?parent {{ {values} }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
"""

def main():
    conn = db()
    try:
        with conn.cursor() as cur:
            logging.info("Upserting root and continents...")
            # Root region
            upsert_region(cur, "world", "World", None, "world")

            # Regions: continents
            rows, V = sparql(CONTINENTS_Q, cache_tag="continents")
            for b in rows:
                cid = V(b, "cont").rpartition("/")[-1]
                name = V(b, "contLabel") or cid
                path = f"world.{cid}"
                upsert_region(cur, cid, name, "world", path)

            logging.info("Upserting countries...")
            # Regions (countries)
            rows, V = sparql(COUNTRIES_Q, cache_tag="countries")
            country_qids = []
            for i, b in enumerate(rows):
                qid = V(b, "c").rpartition("/")[-1]
                country_qids.append(qid)
                name = V(b, "cLabel") or qid
                a2 = V(b, "a2")
                a3 = V(b, "a3")
                cont = V(b, "continent")
                parent = cont.rpartition("/")[-1] if cont else "world"
                # Ensure parent region exists (handles cases like Eurasia/Americas not in simple continent list)
                if parent and parent != "world":
                    parent_label = V(b, "continentLabel") or parent
                    ensure_region_exists(cur, parent, parent_label)
                path = f"world.{parent}.{a2}" if (parent and a2) else (
                    f"world.{parent}.{qid}" if parent else (f"world.{a2}" if a2 else f"world.{qid}")
                )
                upsert_region(cur, qid, name, parent, path, a2, a3, qid)
                _log_every(i, len(rows), 50, "countries")
                # Also record ISO codes as sources for consistency with languages
                if a2:
                    cur.execute(
                        """
                        INSERT INTO public.region_source (id, region_id, source, version, external_id, url, data)
                        VALUES (%s,%s,'iso_3166_1',%s,%s,NULL,%s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (str(uuid.uuid4()), qid, IMPORT_VERSION, a2, json.dumps({"alpha": "2"})),
                    )
                if a3:
                    cur.execute(
                        """
                        INSERT INTO public.region_source (id, region_id, source, version, external_id, url, data)
                        VALUES (%s,%s,'iso_3166_1',%s,%s,NULL,%s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (str(uuid.uuid4()), qid, IMPORT_VERSION, a3, json.dumps({"alpha": "3"})),
                    )

            logging.info("Upserting subnational regions via P131 (BFS per country)...")
            # Optional filter by ISO2
            filter_iso2 = os.environ.get("WIKIDATA_COUNTRIES")
            if filter_iso2:
                iso2_set = set([x.strip().upper() for x in filter_iso2.split(",") if x.strip()])
                rows, V = sparql(COUNTRIES_Q, cache_tag="countries")
                qid_by_iso2 = {}
                for b in rows:
                    qid_by_iso2[V(b, "a2")] = V(b, "c").rpartition("/")[-1]
                country_qids = [qid_by_iso2.get(code) for code in iso2_set if qid_by_iso2.get(code)]

            # BFS per country up to MAX_SUBREGION_DEPTH
            for idx, country_qid in enumerate(country_qids):
                logging.info(f"Subregions BFS country {idx+1}/{len(country_qids)}: {country_qid}")
                frontier = [country_qid]
                seen = set(frontier)
                for depth in range(MAX_SUBREGION_DEPTH):
                    next_frontier = []
                    total_rows = 0
                    # Batch the frontier to avoid huge queries
                    for start in range(0, len(frontier), SUBREGION_FRONTIER_BATCH):
                        batch = frontier[start:start+SUBREGION_FRONTIER_BATCH]
                        if not batch:
                            continue
                        q = build_subregions_level_query(batch)
                        tag = f"subregions_{country_qid}_d{depth}_b{start//SUBREGION_FRONTIER_BATCH}"
                        rows2, V2 = sparql(q, cache_tag=tag)
                        count = 0
                        for b in rows2:
                            child = V2(b, "child").rpartition("/")[-1]
                            parent = V2(b, "parent").rpartition("/")[-1]
                            cname = V2(b, "childLabel") or child
                            pname = V2(b, "parentLabel") or parent
                            ensure_region_exists(cur, parent, pname)
                            ensure_region_exists(cur, child, cname)
                            cur.execute(
                                "UPDATE public.region SET parent_id=%s, path=%s, last_updated=now() WHERE id=%s",
                                (parent, None, child),
                            )
                            if child not in seen:
                                seen.add(child)
                                next_frontier.append(child)
                            count += 1
                            total_rows += 1
                            if total_rows % 500 == 0:
                                logging.info(f"  depth {depth}: processed {total_rows} nodes")
                    frontier = next_frontier
                    logging.info(f"  depth {depth} done; next_frontier={len(frontier)}")

            if not _env_flag("SKIP_LANGS"):
                logging.info("Upserting languages and identifiers...")
                # Languages
                rows, V = sparql(LANGS_Q, cache_tag="languages")
                for i, b in enumerate(rows):
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
                    _log_every(i, len(rows), 500, "languages")

            if not _env_flag("SKIP_LINKS"):
                logging.info("Linking languages to regions...")
                # Language↔Region links
                rows, V = sparql(REGION_LANG_LINKS_Q, cache_tag="region_lang_links")
                for i, b in enumerate(rows):
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
                    _log_every(i, len(rows), 1000, "region-lang links")

            if not _env_flag("SKIP_LANGS"):
                logging.info("Setting language parents and paths...")
                # Language parents and paths (best-effort from Wikidata)
                rows, V = sparql(LANG_PARENTS_Q, cache_tag="lang_parents")
                parent_of = {}
                for b in rows:
                    child = V(b, "child").rpartition("/")[-1]
                    parent = V(b, "parent").rpartition("/")[-1]
                    parent_of[child] = parent
                    safe_set_language_parent(cur, child, parent)

                # Compute simple materialized paths for languages
                cache = {}
                def lang_path(lang_id):
                    if lang_id in cache:
                        return cache[lang_id]
                    p = parent_of.get(lang_id)
                    if not p:
                        cache[lang_id] = lang_id
                        return lang_id
                    pp = lang_path(p)
                    out = f"{pp}.{lang_id}"
                    cache[lang_id] = out
                    return out

                for child in parent_of.keys():
                    path = lang_path(child)
                    cur.execute("UPDATE public.language_entity SET path=%s, last_updated=now() WHERE id=%s", (path, child))

            if not _env_flag("SKIP_ALIASES"):
                logging.info("Inserting language aliases...")
                # Aliases (exonyms) for languages and regions
                rows, V = sparql(LANGUAGE_ALIASES_Q, cache_tag="lang_aliases")
                for b in rows:
                    lqid = V(b, "l").rpartition("/")[-1]
                    alias = V(b, "alias")
                    # Ensure parent entity exists to satisfy FK
                    ensure_language_exists(cur, lqid, alias or lqid)
                    insert_language_alias(cur, lqid, alias)

                logging.info("Inserting region aliases...")
                rows, V = sparql(REGION_ALIASES_Q, cache_tag="region_aliases")
                for b in rows:
                    rqid = V(b, "r").rpartition("/")[-1]
                    alias = V(b, "alias")
                    # Ensure parent entity exists to satisfy FK
                    ensure_region_exists(cur, rqid, alias or rqid)
                    insert_region_alias(cur, rqid, alias)

                logging.info("Inserting native labels...")
                # Native labels (P1705) for languages and regions (store as aliases too)
                rows, V = sparql(LANG_NATIVE_Q, cache_tag="lang_native")
                for b in rows:
                    lqid = V(b, "l").rpartition("/")[-1]
                    native = V(b, "native")
                    # Ensure parent entity exists to satisfy FK
                    ensure_language_exists(cur, lqid, native or lqid)
                    insert_language_alias(cur, lqid, native)

                rows, V = sparql(REGION_NATIVE_Q, cache_tag="region_native")
                for b in rows:
                    rqid = V(b, "r").rpartition("/")[-1]
                    native = V(b, "native")
                    # Ensure parent entity exists to satisfy FK
                    ensure_region_exists(cur, rqid, native or rqid)
                    insert_region_alias(cur, rqid, native)

            # Final pass: recompute region paths with a recursive CTE (Postgres)
            logging.info("Recomputing region paths via recursive CTE...")
            cur.execute(
                """
                WITH RECURSIVE roots AS (
                  SELECT id, parent_id, id::text AS path
                  FROM public.region
                  WHERE parent_id IS NULL
                ),
                tree AS (
                  SELECT id, parent_id, path FROM roots
                  UNION ALL
                  SELECT r.id, r.parent_id, tree.path || '.' || r.id
                  FROM public.region r
                  JOIN tree ON r.parent_id = tree.id
                )
                UPDATE public.region r
                SET path = t.path, last_updated = now()
                FROM tree t
                WHERE r.id = t.id AND (r.path IS NULL OR r.path <> t.path)
                """
            )

        conn.commit()
        print("Load complete.")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
