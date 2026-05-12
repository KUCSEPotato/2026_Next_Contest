-- Add post/chat target columns to reports for admin moderation split

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS target_post_id BIGINT REFERENCES community_posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_chat_room_id BIGINT REFERENCES chat_rooms(id) ON DELETE SET NULL;
