-- Migration: Community reactions → recommend / not_recommend only
-- Maps old types: like, helpful → recommend; interested, curious → not_recommend

BEGIN;

ALTER TABLE community_post_reactions
  ALTER COLUMN reaction_type TYPE VARCHAR(32) USING reaction_type::text;

UPDATE community_post_reactions
SET reaction_type = 'recommend'
WHERE reaction_type IN ('like', 'helpful');

UPDATE community_post_reactions
SET reaction_type = 'not_recommend'
WHERE reaction_type IN ('interested', 'curious');

DELETE FROM community_post_reactions
WHERE reaction_type NOT IN ('recommend', 'not_recommend');

ALTER TABLE community_comment_reactions
  ALTER COLUMN reaction_type TYPE VARCHAR(32) USING reaction_type::text;

UPDATE community_comment_reactions
SET reaction_type = 'recommend'
WHERE reaction_type IN ('like', 'helpful');

UPDATE community_comment_reactions
SET reaction_type = 'not_recommend'
WHERE reaction_type IN ('interested', 'curious');

DELETE FROM community_comment_reactions
WHERE reaction_type NOT IN ('recommend', 'not_recommend');

DROP TYPE IF EXISTS reaction_type;

ALTER TABLE community_post_reactions
  ADD CONSTRAINT chk_community_post_reaction_type
  CHECK (reaction_type IN ('recommend', 'not_recommend'));

ALTER TABLE community_comment_reactions
  ADD CONSTRAINT chk_community_comment_reaction_type
  CHECK (reaction_type IN ('recommend', 'not_recommend'));

COMMIT;
