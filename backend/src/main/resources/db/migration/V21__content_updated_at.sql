ALTER TABLE community_exercises ADD COLUMN content_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE community_exercises SET content_updated_at = updated_at;
