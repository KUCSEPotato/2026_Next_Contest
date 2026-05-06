-- Devory PostgreSQL Complete Schema Entry Point
--
-- This file is the single entry point that applies the full baseline schema
-- plus all known backfills/migrations for fresh environments.
--
-- Execution order:
-- 1. 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql
-- 2. 05_add_todo_assignments_stage_templates.sql
-- 3. 07_add_max_members_to_projects.sql
-- 4. 08_add_community_forum.sql
-- 5. 09_add_idea_to_project_conversion.sql
-- 8. 12_add_user_onboarding_fields.sql
--
-- Use `psql` so relative includes resolve from this file's directory.

\ir 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql
\ir 05_add_todo_assignments_stage_templates.sql
\ir 07_add_max_members_to_projects.sql
\ir 08_add_community_forum.sql
\ir 09_add_idea_to_project_conversion.sql
\ir 12_add_user_onboarding_fields.sql
