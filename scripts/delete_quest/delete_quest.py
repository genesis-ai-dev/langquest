#!/usr/bin/env python3
"""
Delete a quest and all its child records, with full backup and restore capability.

Usage:
    python scripts/delete_quest.py delete <quest_id> [--dry-run] [--backup-dir DIR]
    python scripts/delete_quest.py restore <backup_dir>

Environment variables:
    SUPABASE_URL              - e.g. http://127.0.0.1:54321
    SUPABASE_SERVICE_ROLE_KEY - service role key for admin access
    DATABASE_URL              - direct Postgres connection string

Dependencies:
    pip install psycopg2-binary requests python-dotenv
"""

import argparse
import json
import os
import sys
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values
import psycopg2
import psycopg2.extras
import requests

psycopg2.extras.register_uuid()

_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent.parent
_env = dotenv_values(_project_root / ".env.local")
for k, v in _env.items():
    os.environ.setdefault(k, v)

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def pg_connect(supabase_url, db_url=None):
    if db_url:
        return psycopg2.connect(db_url)
    parsed = urlparse(supabase_url)
    host = parsed.hostname or "127.0.0.1"
    is_local = host in ("127.0.0.1", "localhost") or host.startswith("192.168.")
    if is_local:
        return psycopg2.connect(
            host=host, port=54322, dbname="postgres", user="postgres", password="postgres",
        )
    ref = host.split(".")[0]
    return psycopg2.connect(
        host="db.%s.supabase.co" % ref, port=5432, dbname="postgres",
        user="postgres." + ref, password=os.environ.get("SUPABASE_DB_PASSWORD", ""),
        sslmode="require",
    )


def storage_headers(service_key):
    return {"Authorization": "Bearer " + service_key, "apikey": service_key}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuids(ids):
    return [_uuid.UUID(str(i)) for i in ids]


def _uid(val):
    return _uuid.UUID(str(val))


class PgEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.isoformat()
        if hasattr(o, '__str__'):
            return str(o)
        return super().default(o)


def rows_to_dicts(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Collection
# ---------------------------------------------------------------------------

def collect_quest_tree(cur, root_id):
    cur.execute("""
        WITH RECURSIVE tree AS (
            SELECT id FROM quest WHERE id = %s
            UNION ALL
            SELECT q.id FROM quest q JOIN tree t ON q.parent_id = t.id
        ) SELECT id FROM tree
    """, (_uid(root_id),))
    return [r[0] for r in cur.fetchall()]


def collect_exclusive_asset_ids(cur, quest_ids):
    """Assets linked ONLY to these quests, plus their child assets."""
    cur.execute("""
        WITH RECURSIVE quest_assets AS (
            SELECT DISTINCT asset_id FROM quest_asset_link WHERE quest_id = ANY(%s)
        ),
        shared AS (
            SELECT DISTINCT qal.asset_id FROM quest_asset_link qal
            JOIN quest_assets qa ON qa.asset_id = qal.asset_id
            WHERE qal.quest_id != ALL(%s)
        ),
        exclusive_root AS (
            SELECT asset_id FROM quest_assets EXCEPT SELECT asset_id FROM shared
        ),
        asset_tree AS (
            SELECT id FROM asset WHERE id IN (SELECT asset_id FROM exclusive_root)
            UNION ALL
            SELECT a.id FROM asset a JOIN asset_tree t ON a.parent_id = t.id
        ) SELECT id FROM asset_tree
    """, (_uuids(quest_ids), _uuids(quest_ids)))
    return [r[0] for r in cur.fetchall()]


def collect_storage_paths(cur, asset_ids, quest_ids):
    """Collect all storage file paths: translation audio, ACL audio, asset images, export audio."""
    paths = []
    if asset_ids:
        a = _uuids(asset_ids)
        # translation.audio (text path)
        cur.execute("SELECT audio FROM translation WHERE asset_id = ANY(%s) AND audio IS NOT NULL", (a,))
        paths.extend(r[0] for r in cur.fetchall() if r[0])

        # asset_content_link.audio (jsonb — array of path strings)
        cur.execute("SELECT audio FROM asset_content_link WHERE asset_id = ANY(%s) AND audio IS NOT NULL", (a,))
        for (val,) in cur.fetchall():
            if isinstance(val, list):
                paths.extend(p for p in val if p)
            elif isinstance(val, str):
                paths.append(val)

        # asset.images (text[] — array of path strings)
        cur.execute("SELECT images FROM asset WHERE id = ANY(%s) AND images IS NOT NULL", (a,))
        for (val,) in cur.fetchall():
            if isinstance(val, list):
                paths.extend(p for p in val if p)

    if quest_ids:
        cur.execute(
            "SELECT audio_url FROM export_quest_artifact WHERE quest_id = ANY(%s) AND audio_url IS NOT NULL",
            (_uuids(quest_ids),),
        )
        paths.extend(r[0] for r in cur.fetchall() if r[0])

    return paths


# ---------------------------------------------------------------------------
# Backup & storage operations
# ---------------------------------------------------------------------------

def backup_select(cur, table, clause, params, backup):
    """SELECT rows into backup dict. Returns row count."""
    cur.execute("SELECT * FROM %s WHERE %s" % (table, clause), params)
    rows = rows_to_dicts(cur)
    if rows:
        backup.setdefault(table, []).extend(rows)
    return len(rows)


def backup_storage_files(supabase_url, service_key, bucket, paths, backup_dir, dry_run):
    if not paths:
        return []
    files_dir = backup_dir / "files"
    files_dir.mkdir(parents=True, exist_ok=True)
    hdrs = storage_headers(service_key)
    manifest = []
    for path in paths:
        dest = files_dir / path
        if dry_run:
            manifest.append({"bucket": bucket, "path": path, "backed_up": False})
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = "%s/storage/v1/object/%s/%s" % (supabase_url, bucket, path)
        resp = requests.get(url, headers=hdrs)
        if resp.status_code == 200:
            dest.write_bytes(resp.content)
            manifest.append({"bucket": bucket, "path": path, "backed_up": True, "size": len(resp.content)})
        else:
            manifest.append({"bucket": bucket, "path": path, "backed_up": False, "error": resp.status_code})
    return manifest


def delete_storage_files(supabase_url, service_key, bucket, paths):
    hdrs = storage_headers(service_key)
    for path in paths:
        url = "%s/storage/v1/object/%s/%s" % (supabase_url, bucket, path)
        resp = requests.delete(url, headers=hdrs)
        status = "ok" if resp.status_code in (200, 204, 404) else "FAILED (%s)" % resp.status_code
        print("  storage DELETE %s/%s — %s" % (bucket, path, status))


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

SEP = "=" * 72

def write_report(backup_dir, quest_info, counts, backup_data, file_manifest, dry_run):
    lines = []
    mode = "DRY RUN" if dry_run else "LIVE DELETE"
    lines.append("Quest Deletion Report — %s" % mode)
    lines.append(SEP)
    lines.append("Date:       %s" % datetime.now(timezone.utc).isoformat())
    lines.append("Quest:      %s" % (quest_info["name"] or "(unnamed)"))
    lines.append("Quest ID:   %s" % quest_info["id"])
    lines.append("Project ID: %s" % quest_info["project_id"])
    lines.append("")

    lines.append("SUMMARY")
    lines.append("-" * 40)
    total = 0
    for table, n in counts.items():
        lines.append("  %-30s %6d rows" % (table, n))
        total += n
    lines.append("  %-30s %6d rows" % ("TOTAL", total))
    lines.append("  %-30s %6d files" % ("storage files", len(file_manifest)))
    lines.append("")

    for table, rows in backup_data.items():
        lines.append(SEP)
        lines.append("TABLE: %s  (%d rows)" % (table, len(rows)))
        lines.append("-" * 40)
        for row in rows:
            rid = row.get("id", row.get("quest_id", row.get("asset_id", "?")))
            name = row.get("name", row.get("text", ""))
            if name and len(str(name)) > 80:
                name = str(name)[:77] + "..."
            lines.append("  %s  %s" % (rid, name))
        lines.append("")

    if file_manifest:
        lines.append(SEP)
        lines.append("STORAGE FILES (%d)" % len(file_manifest))
        lines.append("-" * 40)
        for f in file_manifest:
            if f.get("backed_up"):
                status = "backed up (%d bytes)" % f.get("size", 0)
            elif dry_run:
                status = "pending (dry run)"
            else:
                status = "MISSING (%s)" % f.get("error", "unknown")
            lines.append("  %s/%s  — %s" % (f["bucket"], f["path"], status))

    report_text = "\n".join(lines) + "\n"
    (backup_dir / "report.txt").write_text(report_text)
    print(report_text)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

# Restore inserts in this order (parents before children)
INSERT_ORDER = [
    "quest", "asset", "quest_asset_link", "quest_tag_link", "quest_closure",
    "export_quest_artifact", "map_quest", "asset_content_link", "asset_tag_link",
    "translation", "vote", "blocked_content", "reports", "subscription", "notification",
]


def cmd_delete(args):
    if not args.service_key:
        print("Error: provide --service-key or set SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)

    if args.db_password:
        os.environ["SUPABASE_DB_PASSWORD"] = args.db_password
    conn = pg_connect(args.supabase_url, args.db_url or None)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, name, project_id FROM quest WHERE id = %s", (_uid(args.quest_id),))
        row = cur.fetchone()
        if not row:
            print("Quest %s not found." % args.quest_id, file=sys.stderr)
            sys.exit(1)

        quest_info = {"id": str(row[0]), "name": row[1], "project_id": str(row[2])}
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = "quest_backup_%s_%s" % (args.quest_id[:8], ts)
        backup_dir = Path(args.backup_dir or str(_script_dir / backup_name))
        backup_dir.mkdir(parents=True, exist_ok=True)

        print("Quest: %s [%s]" % (quest_info["name"] or "(unnamed)", quest_info["id"]))
        print("Project ID: %s" % quest_info["project_id"])
        print("Backup dir: %s" % backup_dir)
        print("Mode: %s\n" % ("DRY RUN" if args.dry_run else "LIVE"))

        quest_ids = collect_quest_tree(cur, args.quest_id)
        asset_ids = collect_exclusive_asset_ids(cur, quest_ids)
        storage_paths = collect_storage_paths(cur, asset_ids, quest_ids)

        print("Quests in tree: %d" % len(quest_ids))
        print("Exclusive assets: %d" % len(asset_ids))
        print("Storage files: %d\n" % len(storage_paths))

        if not args.dry_run:
            confirm = input("Type YES to proceed: ")
            if confirm != "YES":
                print("Aborted.")
                sys.exit(0)

        # Disable triggers to avoid closure recalculations and the
        # before_translation_mutation trigger that blocks direct deletes.
        cur.execute("SET session_replication_role = 'replica'")

        # Collect translation IDs for polymorphic table cleanup
        translation_ids = []
        if asset_ids:
            cur.execute("SELECT id FROM translation WHERE asset_id = ANY(%s)", (_uuids(asset_ids),))
            translation_ids = [r[0] for r in cur.fetchall()]
        poly_ids = list(quest_ids) + list(asset_ids) + list(translation_ids)

        backup_data = {}
        counts = {}

        def capture(table, clause, params):
            n = backup_select(cur, table, clause, params, backup_data)
            counts[table] = counts.get(table, 0) + n

        # -- Back up all child tables first, then delete --

        # vote (RESTRICT on asset — must be explicitly deleted before assets)
        if asset_ids:
            a = _uuids(asset_ids)
            capture("vote", "asset_id = ANY(%s)", (a,))
            capture("translation", "asset_id = ANY(%s)", (a,))
            capture("asset_content_link", "asset_id = ANY(%s)", (a,))
            capture("asset_tag_link", "asset_id = ANY(%s)", (a,))

        q = _uuids(quest_ids)
        capture("quest_asset_link", "quest_id = ANY(%s)", (q,))
        capture("quest_tag_link", "quest_id = ANY(%s)", (q,))
        capture("quest_closure", "quest_id = ANY(%s)", (q,))
        capture("export_quest_artifact", "quest_id = ANY(%s)", (q,))
        capture("map_quest", "src_id = ANY(%s) OR dst_id = ANY(%s)", (q, q))

        if poly_ids:
            p = _uuids(poly_ids)
            capture("blocked_content", "content_id = ANY(%s)", (p,))
            capture("reports", "record_id = ANY(%s)", (p,))
            capture("notification", "target_record_id = ANY(%s)", (p,))
        capture("subscription", "target_record_id = ANY(%s)", (q,))

        # Assets
        if asset_ids:
            a = _uuids(asset_ids)
            cur.execute("SELECT * FROM asset WHERE id = ANY(%s)", (a,))
            rows = rows_to_dicts(cur)
            if rows:
                backup_data["asset"] = rows
                counts["asset"] = len(rows)

        # Quests
        cur.execute("SELECT * FROM quest WHERE id = ANY(%s)", (q,))
        rows = rows_to_dicts(cur)
        if rows:
            backup_data["quest"] = rows
            counts["quest"] = len(rows)

        # -- Now delete (non-dry-run) --
        if not args.dry_run:
            # Delete child records that don't CASCADE or use RESTRICT
            if asset_ids:
                a = _uuids(asset_ids)
                cur.execute("DELETE FROM vote WHERE asset_id = ANY(%s)", (a,))
                cur.execute("DELETE FROM translation WHERE asset_id = ANY(%s)", (a,))
                cur.execute("DELETE FROM asset_content_link WHERE asset_id = ANY(%s)", (a,))
                cur.execute("DELETE FROM asset_tag_link WHERE asset_id = ANY(%s)", (a,))

            cur.execute("DELETE FROM quest_asset_link WHERE quest_id = ANY(%s)", (q,))
            cur.execute("DELETE FROM quest_tag_link WHERE quest_id = ANY(%s)", (q,))
            cur.execute("DELETE FROM quest_closure WHERE quest_id = ANY(%s)", (q,))
            cur.execute("DELETE FROM export_quest_artifact WHERE quest_id = ANY(%s)", (q,))
            cur.execute("DELETE FROM map_quest WHERE src_id = ANY(%s) OR dst_id = ANY(%s)", (q, q))

            if poly_ids:
                p = _uuids(poly_ids)
                cur.execute("DELETE FROM blocked_content WHERE content_id = ANY(%s)", (p,))
                cur.execute("DELETE FROM reports WHERE record_id = ANY(%s)", (p,))
                cur.execute("DELETE FROM notification WHERE target_record_id = ANY(%s)", (p,))
            cur.execute("DELETE FROM subscription WHERE target_record_id = ANY(%s)", (q,))

            # Clear self-referencing FKs before deleting assets
            # source_asset_id has NO ACTION (=RESTRICT), so must be NULLed out
            if asset_ids:
                a = _uuids(asset_ids)
                cur.execute("UPDATE asset SET source_asset_id = NULL WHERE id = ANY(%s) AND source_asset_id IS NOT NULL", (a,))
                cur.execute("DELETE FROM asset WHERE id = ANY(%s)", (a,))

            cur.execute("DELETE FROM quest WHERE id = ANY(%s)", (q,))

        # Re-enable triggers
        cur.execute("SET session_replication_role = 'origin'")

        # Storage: backup then delete
        print("\n--- Storage ---")
        file_manifest = backup_storage_files(
            args.supabase_url, args.service_key, args.bucket, storage_paths, backup_dir, args.dry_run
        )
        if not args.dry_run and storage_paths:
            delete_storage_files(args.supabase_url, args.service_key, args.bucket, storage_paths)

        # Write backup data
        data_dir = backup_dir / "data"
        data_dir.mkdir(exist_ok=True)
        for table, tbl_rows in backup_data.items():
            (data_dir / ("%s.json" % table)).write_text(json.dumps(tbl_rows, cls=PgEncoder, indent=2))

        manifest = {
            "quest_id": quest_info["id"],
            "quest_name": quest_info["name"],
            "project_id": quest_info["project_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "dry_run": args.dry_run,
            "bucket": args.bucket,
            "supabase_url": args.supabase_url,
            "counts": counts,
            "insert_order": [t for t in INSERT_ORDER if t in backup_data],
            "files": file_manifest,
        }
        (backup_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

        # Report
        print()
        write_report(backup_dir, quest_info, counts, backup_data, file_manifest, args.dry_run)

        if args.dry_run:
            print("Dry run complete — no changes made. Backup preview at %s" % backup_dir)
            conn.rollback()
        else:
            conn.commit()
            print("Done. Backup saved to %s" % backup_dir)

    except Exception as e:
        conn.rollback()
        print("\nError — rolled back: %s" % e, file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------

def cmd_restore(args):
    if not args.service_key:
        print("Error: provide --service-key or set SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)

    backup_dir = Path(args.backup_dir)
    manifest_path = backup_dir / "manifest.json"
    if not manifest_path.exists():
        print("No manifest.json found in %s" % backup_dir, file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(manifest_path.read_text())
    insert_order = manifest["insert_order"]
    bucket = manifest.get("bucket", "local")
    file_manifest = manifest.get("files", [])

    print("Restoring quest: %s [%s]" % (manifest.get("quest_name") or "(unnamed)", manifest["quest_id"]))
    print("Tables to restore: %s" % ", ".join(insert_order))
    print("Files to restore: %d" % sum(1 for f in file_manifest if f.get("backed_up")))

    if not args.dry_run:
        confirm = input("\nType YES to proceed with restore: ")
        if confirm != "YES":
            print("Aborted.")
            sys.exit(0)

    if hasattr(args, "db_password") and args.db_password:
        os.environ["SUPABASE_DB_PASSWORD"] = args.db_password
    conn = pg_connect(args.supabase_url, getattr(args, "db_url", None) or None)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Disable triggers to prevent closure recalculations, language refresh,
        # download_profiles copying, and other side effects during restore.
        cur.execute("SET session_replication_role = 'replica'")

        data_dir = backup_dir / "data"
        col_type_cache = {}

        def get_col_types(tbl):
            """Returns {col_name: 'jsonb' | 'uuid_array' | 'array' | None}"""
            if tbl not in col_type_cache:
                cur.execute("""
                    SELECT column_name, data_type, udt_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = %s
                """, (tbl,))
                types = {}
                for col, data_type, udt_name in cur.fetchall():
                    if udt_name == 'jsonb':
                        types[col] = 'jsonb'
                    elif data_type == 'ARRAY' and udt_name == '_uuid':
                        types[col] = 'uuid_array'
                    elif data_type == 'ARRAY':
                        types[col] = 'array'
                col_type_cache[tbl] = types
            return col_type_cache[tbl]

        def coerce_value(v, col_type):
            if v is None:
                return None
            if col_type == 'jsonb':
                return psycopg2.extras.Json(v)
            if col_type == 'uuid_array' and isinstance(v, list):
                return [_uuid.UUID(x) if x else None for x in v]
            return v

        for table in insert_order:
            table_path = data_dir / ("%s.json" % table)
            if not table_path.exists():
                continue
            rows = json.loads(table_path.read_text())
            if not rows:
                continue

            types = get_col_types(table)
            cols = [c for c in rows[0].keys() if c != "depth"]
            placeholders = ", ".join(["%s"] * len(cols))
            col_names = ", ".join(cols)
            sql = "INSERT INTO %s (%s) VALUES (%s) ON CONFLICT DO NOTHING" % (table, col_names, placeholders)

            inserted = 0
            for row in rows:
                vals = [coerce_value(row.get(c), types.get(c)) for c in cols]
                if args.dry_run:
                    inserted += 1
                else:
                    cur.execute(sql, vals)
                    inserted += cur.rowcount

            label = "would insert" if args.dry_run else "inserted"
            print("  %s: %s %d/%d rows" % (table, label, inserted, len(rows)))

        cur.execute("SET session_replication_role = 'origin'")

        # Restore storage files
        files_dir = backup_dir / "files"
        hdrs = storage_headers(args.service_key)
        restored_files = 0
        for entry in file_manifest:
            if not entry.get("backed_up"):
                continue
            local_path = files_dir / entry["path"]
            if not local_path.exists():
                print("  storage SKIP %s — file missing from backup" % entry["path"])
                continue
            if args.dry_run:
                print("  [dry-run] Would upload %s/%s" % (entry["bucket"], entry["path"]))
                restored_files += 1
                continue
            url = "%s/storage/v1/object/%s/%s" % (args.supabase_url, bucket, entry["path"])
            with open(local_path, "rb") as f:
                resp = requests.post(url, headers=dict(hdrs, **{"x-upsert": "true"}), data=f.read())
            status = "ok" if resp.status_code in (200, 201) else "FAILED (%s)" % resp.status_code
            print("  storage UPLOAD %s/%s — %s" % (entry["bucket"], entry["path"], status))
            restored_files += 1

        if args.dry_run:
            print("\nDry run — no changes. Would restore %d files." % restored_files)
            conn.rollback()
        else:
            conn.commit()
            print("\nRestore complete. %d files uploaded." % restored_files)

    except Exception as e:
        conn.rollback()
        print("\nError — rolled back: %s" % e, file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Delete/restore a quest and all child records.")
    parser.add_argument("--supabase-url", default=os.environ.get(
        "SUPABASE_URL", os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")))
    parser.add_argument("--service-key", default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL", ""),
                        help="Direct Postgres connection string (overrides --supabase-url for DB)")
    parser.add_argument("--db-password", default=os.environ.get("SUPABASE_DB_PASSWORD", ""),
                        help="Postgres password for remote Supabase")
    sub = parser.add_subparsers(dest="command", required=True)

    p_del = sub.add_parser("delete", help="Delete a quest and back up all removed data")
    p_del.add_argument("quest_id", help="UUID of the quest to delete")
    p_del.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    p_del.add_argument("--backup-dir", help="Override backup directory path")
    p_del.add_argument("--bucket", default=os.environ.get("EXPO_PUBLIC_SUPABASE_BUCKET", "local"),
                        help="Storage bucket name (default from env or 'local')")

    p_res = sub.add_parser("restore", help="Restore a quest from a backup directory")
    p_res.add_argument("backup_dir", help="Path to the backup directory")
    p_res.add_argument("--dry-run", action="store_true", help="Preview without making changes")

    args = parser.parse_args()
    if args.command == "delete":
        cmd_delete(args)
    elif args.command == "restore":
        cmd_restore(args)


if __name__ == "__main__":
    main()
