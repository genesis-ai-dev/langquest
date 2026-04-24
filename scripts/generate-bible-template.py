#!/usr/bin/env python3
"""
Generate the Protestant Bible template with nanoid(10) node IDs and backfill
existing Bible quests with template_node_id values.

Usage:
    python scripts/generate-bible-template.py [--database-url URL] [--seed SEED] [--dry-run]

If --database-url is not provided, reads DATABASE_URL from environment.
Use --seed for reproducible ID generation across runs.
Use --dry-run to print the structure without writing to the database.
"""

import argparse
import hashlib
import json
import os
import string
import sys
from typing import Optional

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

ALPHABET = string.ascii_letters + string.digits
NODE_ID_LENGTH = 10
TEMPLATE_ID = "a0000000-0000-0000-0000-000000000001"

BIBLE_BOOKS = [
    {"id": "gen", "name": "Genesis", "short": "Gen", "chapters": 50, "verses": [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26]},
    {"id": "exo", "name": "Exodus", "short": "Exod", "chapters": 40, "verses": [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38]},
    {"id": "lev", "name": "Leviticus", "short": "Lev", "chapters": 27, "verses": [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34]},
    {"id": "num", "name": "Numbers", "short": "Num", "chapters": 36, "verses": [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13]},
    {"id": "deu", "name": "Deuteronomy", "short": "Deut", "chapters": 34, "verses": [46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12]},
    {"id": "jos", "name": "Joshua", "short": "Josh", "chapters": 24, "verses": [18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33]},
    {"id": "jdg", "name": "Judges", "short": "Judg", "chapters": 21, "verses": [36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25]},
    {"id": "rut", "name": "Ruth", "short": "Ruth", "chapters": 4, "verses": [22,23,18,22]},
    {"id": "1sa", "name": "1 Samuel", "short": "1Sam", "chapters": 31, "verses": [28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13]},
    {"id": "2sa", "name": "2 Samuel", "short": "2Sam", "chapters": 24, "verses": [27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25]},
    {"id": "1ki", "name": "1 Kings", "short": "1Kgs", "chapters": 22, "verses": [53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53]},
    {"id": "2ki", "name": "2 Kings", "short": "2Kgs", "chapters": 25, "verses": [18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30]},
    {"id": "1ch", "name": "1 Chronicles", "short": "1Chr", "chapters": 29, "verses": [54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30]},
    {"id": "2ch", "name": "2 Chronicles", "short": "2Chr", "chapters": 36, "verses": [17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23]},
    {"id": "ezr", "name": "Ezra", "short": "Ezra", "chapters": 10, "verses": [11,70,13,24,17,22,28,36,15,44]},
    {"id": "neh", "name": "Nehemiah", "short": "Neh", "chapters": 13, "verses": [11,20,32,23,19,19,73,18,38,39,36,47,31]},
    {"id": "est", "name": "Esther", "short": "Esth", "chapters": 10, "verses": [22,23,15,17,14,14,10,17,32,3]},
    {"id": "job", "name": "Job", "short": "Job", "chapters": 42, "verses": [22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17]},
    {"id": "psa", "name": "Psalms", "short": "Ps", "chapters": 150, "verses": [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6]},
    {"id": "pro", "name": "Proverbs", "short": "Prov", "chapters": 31, "verses": [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31]},
    {"id": "ecc", "name": "Ecclesiastes", "short": "Eccl", "chapters": 12, "verses": [18,26,22,16,20,12,29,17,18,20,10,14]},
    {"id": "sng", "name": "Song of Solomon", "short": "Song", "chapters": 8, "verses": [17,17,11,16,16,13,13,14]},
    {"id": "isa", "name": "Isaiah", "short": "Isa", "chapters": 66, "verses": [31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24]},
    {"id": "jer", "name": "Jeremiah", "short": "Jer", "chapters": 52, "verses": [19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34]},
    {"id": "lam", "name": "Lamentations", "short": "Lam", "chapters": 5, "verses": [22,22,66,22,22]},
    {"id": "ezk", "name": "Ezekiel", "short": "Ezek", "chapters": 48, "verses": [28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35]},
    {"id": "dan", "name": "Daniel", "short": "Dan", "chapters": 12, "verses": [21,49,30,37,31,28,28,27,27,21,45,13]},
    {"id": "hos", "name": "Hosea", "short": "Hos", "chapters": 14, "verses": [11,23,5,19,15,11,16,14,17,15,12,14,16,9]},
    {"id": "joe", "name": "Joel", "short": "Joel", "chapters": 3, "verses": [20,32,21]},
    {"id": "amo", "name": "Amos", "short": "Amos", "chapters": 9, "verses": [15,16,15,13,27,14,17,14,15]},
    {"id": "oba", "name": "Obadiah", "short": "Obad", "chapters": 1, "verses": [21]},
    {"id": "jon", "name": "Jonah", "short": "Jonah", "chapters": 4, "verses": [17,10,10,11]},
    {"id": "mic", "name": "Micah", "short": "Mic", "chapters": 7, "verses": [16,13,12,13,15,16,20]},
    {"id": "nah", "name": "Nahum", "short": "Nah", "chapters": 3, "verses": [15,13,19]},
    {"id": "hab", "name": "Habakkuk", "short": "Hab", "chapters": 3, "verses": [17,20,19]},
    {"id": "zep", "name": "Zephaniah", "short": "Zeph", "chapters": 3, "verses": [18,15,20]},
    {"id": "hag", "name": "Haggai", "short": "Hag", "chapters": 2, "verses": [15,23]},
    {"id": "zec", "name": "Zechariah", "short": "Zech", "chapters": 14, "verses": [21,13,10,14,11,15,14,23,17,12,17,14,9,21]},
    {"id": "mal", "name": "Malachi", "short": "Mal", "chapters": 4, "verses": [14,17,18,6]},
    # New Testament
    {"id": "mat", "name": "Matthew", "short": "Matt", "chapters": 28, "verses": [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20]},
    {"id": "mar", "name": "Mark", "short": "Mark", "chapters": 16, "verses": [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20]},
    {"id": "luk", "name": "Luke", "short": "Luke", "chapters": 24, "verses": [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53]},
    {"id": "joh", "name": "John", "short": "John", "chapters": 21, "verses": [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25]},
    {"id": "act", "name": "Acts", "short": "Acts", "chapters": 28, "verses": [26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31]},
    {"id": "rom", "name": "Romans", "short": "Rom", "chapters": 16, "verses": [32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27]},
    {"id": "1co", "name": "1 Corinthians", "short": "1Cor", "chapters": 16, "verses": [31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24]},
    {"id": "2co", "name": "2 Corinthians", "short": "2Cor", "chapters": 13, "verses": [24,17,18,18,21,18,16,24,15,18,33,21,14]},
    {"id": "gal", "name": "Galatians", "short": "Gal", "chapters": 6, "verses": [24,21,29,31,26,18]},
    {"id": "eph", "name": "Ephesians", "short": "Eph", "chapters": 6, "verses": [23,22,21,32,33,24]},
    {"id": "phi", "name": "Philippians", "short": "Phil", "chapters": 4, "verses": [30,30,21,23]},
    {"id": "col", "name": "Colossians", "short": "Col", "chapters": 4, "verses": [29,23,25,18]},
    {"id": "1th", "name": "1 Thessalonians", "short": "1Thess", "chapters": 5, "verses": [10,20,13,18,28]},
    {"id": "2th", "name": "2 Thessalonians", "short": "2Thess", "chapters": 3, "verses": [12,17,18]},
    {"id": "1ti", "name": "1 Timothy", "short": "1Tim", "chapters": 6, "verses": [20,15,16,16,25,21]},
    {"id": "2ti", "name": "2 Timothy", "short": "2Tim", "chapters": 4, "verses": [18,26,17,22]},
    {"id": "tit", "name": "Titus", "short": "Titus", "chapters": 3, "verses": [16,15,15]},
    {"id": "phm", "name": "Philemon", "short": "Phlm", "chapters": 1, "verses": [25]},
    {"id": "heb", "name": "Hebrews", "short": "Heb", "chapters": 13, "verses": [14,18,19,16,14,20,28,13,28,39,40,29,25]},
    {"id": "jas", "name": "James", "short": "Jas", "chapters": 5, "verses": [27,26,18,17,20]},
    {"id": "1pe", "name": "1 Peter", "short": "1Pet", "chapters": 5, "verses": [25,25,22,19,14]},
    {"id": "2pe", "name": "2 Peter", "short": "2Pet", "chapters": 3, "verses": [21,22,18]},
    {"id": "1jn", "name": "1 John", "short": "1John", "chapters": 5, "verses": [10,29,24,21,21]},
    {"id": "2jn", "name": "2 John", "short": "2John", "chapters": 1, "verses": [13]},
    {"id": "3jn", "name": "3 John", "short": "3John", "chapters": 1, "verses": [14]},
    {"id": "jud", "name": "Jude", "short": "Jude", "chapters": 1, "verses": [25]},
    {"id": "rev", "name": "Revelation", "short": "Rev", "chapters": 22, "verses": [20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21]},
]


class SeededNanoid:
    """Generates deterministic nanoid-style IDs from a seed + counter."""

    def __init__(self, seed: Optional[str] = None):
        self._counter = 0
        self._seed = seed or ""

    def generate(self, context: str = "") -> str:
        """Generate a nanoid(10) ID. If seeded, output is deterministic for same context."""
        if self._seed:
            material = f"{self._seed}:{context}:{self._counter}"
            digest = hashlib.sha256(material.encode()).digest()
        else:
            import secrets
            digest = secrets.token_bytes(16)

        self._counter += 1
        result = []
        for byte in digest:
            result.append(ALPHABET[byte % len(ALPHABET)])
            if len(result) == NODE_ID_LENGTH:
                break
        return "".join(result)


def build_bible_template(generator: SeededNanoid) -> tuple[dict, dict]:
    """
    Build the full Bible template JSONB structure.
    Returns (structure_dict, mapping_dict).
    mapping_dict maps (book_id, chapter_num) -> node_id for quest backfill.
    """
    mapping = {}  # (book_id, chapter_num) -> nanoid

    book_nodes = []
    for book in BIBLE_BOOKS:
        book_node_id = generator.generate(f"book:{book['id']}")
        mapping[(book["id"],)] = book_node_id

        chapter_nodes = []
        for ch_num in range(1, book["chapters"] + 1):
            ch_node_id = generator.generate(f"chapter:{book['id']}:{ch_num}")
            mapping[(book["id"], ch_num)] = ch_node_id

            verse_count = book["verses"][ch_num - 1] if ch_num <= len(book["verses"]) else 0
            verse_nodes = []
            for v_num in range(1, verse_count + 1):
                v_node_id = generator.generate(f"verse:{book['id']}:{ch_num}:{v_num}")
                mapping[(book["id"], ch_num, v_num)] = v_node_id
                verse_nodes.append({
                    "id": v_node_id,
                    "name": f"{book['name']} {ch_num}:{v_num}",
                    "short_label": str(v_num),
                    "node_type": "verse",
                    "linkable_type": "asset",
                    "allows_spanning": True,
                })

            chapter_nodes.append({
                "id": ch_node_id,
                "name": f"{book['name']} {ch_num}",
                "short_label": str(ch_num),
                "node_type": "chapter",
                "linkable_type": "quest",
                "is_download_unit": True,
                "children": verse_nodes,
            })

        book_nodes.append({
            "id": book_node_id,
            "name": book["name"],
            "short_label": book["short"],
            "node_type": "book",
            "children": chapter_nodes,
        })

    structure = {
        "format_version": 1,
        "root": {
            "id": "root",
            "name": "Protestant Bible",
            "node_type": "root",
            "children": book_nodes,
        },
    }

    return structure, mapping


def upsert_template(conn, structure: dict):
    """Upsert the Bible template row with the full structure."""
    structure_json = json.dumps(structure, separators=(",", ":"))
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE public.template
            SET structure = %s::jsonb,
                last_updated = NOW()
            WHERE id = %s
        """, (structure_json, TEMPLATE_ID))

        if cur.rowcount == 0:
            cur.execute("""
                INSERT INTO public.template (
                    id, slug, name, icon, structure,
                    auto_sync, shared, active, locked_for_backward_compat,
                    download_profiles
                ) VALUES (
                    %s, 'protestant-bible', 'Protestant Bible', 'book',
                    %s::jsonb, true, true, true, true, '{}'
                )
            """, (TEMPLATE_ID, structure_json))

    conn.commit()
    print(f"Template upserted (id={TEMPLATE_ID})")


def backfill_bible_quests(conn, mapping: dict):
    """
    Set template_node_id on existing Bible quests by matching metadata.
    Uses tree-walking + metadata matching per C10.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT q.id, q.metadata::jsonb->'bible'->>'book' AS book,
                   q.metadata::jsonb->'bible'->>'chapter' AS chapter
            FROM public.quest q
            JOIN public.project p ON q.project_id = p.id
            WHERE p.template = 'bible'
              AND p.active = true
              AND q.active = true
              AND q.metadata IS NOT NULL
              AND q.template_node_id IS NULL
        """)

        updates = []
        for row in cur.fetchall():
            quest_id, book_code, chapter_str = row
            if not book_code:
                continue

            if chapter_str:
                chapter_num = int(chapter_str)
                node_id = mapping.get((book_code, chapter_num))
            else:
                node_id = mapping.get((book_code,))

            if node_id:
                updates.append((node_id, quest_id))

        if updates:
            cur.executemany("""
                UPDATE public.quest SET template_node_id = %s WHERE id = %s
            """, updates)
            conn.commit()
            print(f"Backfilled {len(updates)} Bible quests with template_node_id")
        else:
            print("No Bible quests to backfill")


def main():
    parser = argparse.ArgumentParser(description="Generate Protestant Bible template")
    parser.add_argument("--database-url", help="PostgreSQL connection string")
    parser.add_argument("--seed", help="Seed for reproducible nanoid generation")
    parser.add_argument("--dry-run", action="store_true", help="Print structure stats without writing to DB")
    parser.add_argument("--output-json", help="Write generated structure to a JSON file")
    parser.add_argument("--output-mapping", help="Write node ID mapping to a JSON file")
    args = parser.parse_args()

    generator = SeededNanoid(seed=args.seed)
    structure, mapping = build_bible_template(generator)

    total_nodes = sum(1 for _ in _count_nodes(structure["root"]))
    structure_size = len(json.dumps(structure, separators=(",", ":")))
    print(f"Generated Bible template: {total_nodes} nodes, {structure_size / 1024 / 1024:.2f} MB")

    if args.output_json:
        with open(args.output_json, "w") as f:
            json.dump(structure, f, separators=(",", ":"))
        print(f"Structure written to {args.output_json}")

    if args.output_mapping:
        serializable_mapping = {
            "|".join(str(k) for k in key): value
            for key, value in mapping.items()
        }
        with open(args.output_mapping, "w") as f:
            json.dump(serializable_mapping, f, indent=2)
        print(f"Mapping written to {args.output_mapping}")

    if args.dry_run:
        print("Dry run — no database changes made")
        return

    db_url = args.database_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: No database URL provided. Use --database-url or set DATABASE_URL env var.")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    try:
        upsert_template(conn, structure)
        backfill_bible_quests(conn, mapping)
    finally:
        conn.close()

    print("Done.")


def _count_nodes(node):
    """Generator that yields each node in the tree for counting."""
    yield node
    for child in node.get("children", []):
        yield from _count_nodes(child)


if __name__ == "__main__":
    main()
