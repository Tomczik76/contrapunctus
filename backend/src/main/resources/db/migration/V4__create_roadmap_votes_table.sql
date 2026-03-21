CREATE TABLE roadmap_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  feature_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

CREATE INDEX idx_roadmap_votes_feature_key ON roadmap_votes(feature_key);
