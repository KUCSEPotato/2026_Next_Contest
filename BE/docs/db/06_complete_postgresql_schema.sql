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
-- 10. Additional numbered backfills through 23_add_application_timestamps.sql
--
-- Use `psql` so relative includes resolve from this file's directory.

\ir 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql
\ir 05_add_todo_assignments_stage_templates.sql
\ir 07_add_max_members_to_projects.sql
\ir 08_add_community_forum.sql
\ir 09_add_idea_to_project_conversion.sql
\ir 12_add_user_onboarding_fields.sql
\ir 13_add_coin_wallet_and_project_reminders.sql
\ir 14_add_min_members_to_projects.sql
\ir 15_add_project_min_members.sql
\ir 16_add_idea_is_discarded.sql
\ir 17_add_comment_anonymous.sql
\ir 18_add_file_upload_support.sql
\ir 19_extend_recruitment_fields.sql
\ir 20_create_chat_room_members.sql
\ir 21_add_memoir_fields_to_retrospectives.sql
\ir 22_add_user_avatar_s3_key.sql
\ir 23_add_application_timestamps.sql
\ir 24_community_reaction_recommend.sql
\ir 25_backfill_user_avatar_s3_key.sql
\ir 26_add_report_target_fields.sql
\ir 27_add_coin_purchase_requests.sql
\ir 28_add_user_suspension_fields.sql
