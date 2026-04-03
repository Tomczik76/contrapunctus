CREATE TABLE share_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type   VARCHAR(20) NOT NULL,
  source_id     UUID NOT NULL,
  title         VARCHAR(300) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  image_data    BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_images_source ON share_images(source_type, source_id);
CREATE INDEX idx_share_images_user ON share_images(user_id);
