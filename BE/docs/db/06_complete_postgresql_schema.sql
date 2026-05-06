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
-- 6. 10_add_idea_comments.sql
-- 7. 11_emergency_sync_ideas_table.sql
-- 8. 12_add_user_onboarding_fields.sql
-- 9. 13_add_coin_wallet_and_project_reminders.sql
-- 10. 14_allow_negative_coin_transactions.sql
--
-- Use `psql` so relative includes resolve from this file's directory.

\ir 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql
\ir 05_add_todo_assignments_stage_templates.sql
\ir 07_add_max_members_to_projects.sql
\ir 08_add_community_forum.sql
\ir 09_add_idea_to_project_conversion.sql
\ir 10_add_idea_comments.sql
\ir 11_emergency_sync_ideas_table.sql
\ir 12_add_user_onboarding_fields.sql
\ir 13_add_coin_wallet_and_project_reminders.sql
\ir 14_allow_negative_coin_transactions.sql
