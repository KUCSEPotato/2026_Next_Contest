-- Devory PostgreSQL Complete Schema Entry Point
--
-- This file is the single entry point that applies the full baseline schema
-- plus all known backfills/migrations for fresh environments.
--
-- Execution order:
-- 1. 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql
-- 2. 05_add_todo_assignments_stage_templates.sql
--
-- Use `psql` so relative includes resolve from this file's directory.

\ir 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql
\ir 05_add_todo_assignments_stage_templates.sql
