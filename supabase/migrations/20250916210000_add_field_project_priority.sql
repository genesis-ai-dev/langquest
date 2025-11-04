-- 2025-09-16_add_priority_column_to_project.sql
ALTER TABLE "public"."project" ADD COLUMN IF NOT EXISTS "priority" smallint NULL DEFAULT '0'::smallint;
