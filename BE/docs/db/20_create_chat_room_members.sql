-- Migration 20: Create chat_room_members table for tracking chat room participants
-- Description: Add support for member selection when creating chat rooms. Only selected members can access the room.
-- Author: [User]
-- Date: 2024

CREATE TABLE chat_room_members (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chat_room_members_unique UNIQUE(room_id, user_id)
);

CREATE INDEX idx_chat_room_members_room_id ON chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user_id ON chat_room_members(user_id);
