#!/usr/bin/env bash
# Keep Agent Skills working without Cursor treating AGENTS.md / CLAUDE.md as always-on rules.
# Run after installing or updating skills from upstream (skills-lock / npx skills, etc.).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_ROOT="$ROOT/.agents/skills"

rename_compiled() {
  local dir="$1"
  if [[ -f "$dir/AGENTS.md" && ! -f "$dir/COMPILED.md" ]]; then
    mv "$dir/AGENTS.md" "$dir/COMPILED.md"
    echo "renamed: $dir/AGENTS.md -> COMPILED.md"
  fi
  rm -f "$dir/AGENTS.md" "$dir/CLAUDE.md"
}

for skill in \
  vercel-react-best-practices \
  vercel-react-native-skills \
  vercel-composition-patterns; do
  rename_compiled "$SKILLS_ROOT/$skill"
done

# Supabase: SKILL.md is the router; references/ loads on demand
rm -f "$SKILLS_ROOT/supabase-postgres-best-practices/AGENTS.md" \
      "$SKILLS_ROOT/supabase-postgres-best-practices/CLAUDE.md"

echo "Done. Skills use SKILL.md + rules/ or references/; COMPILED.md is on-demand only."
