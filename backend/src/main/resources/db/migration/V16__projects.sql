CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  treble_beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  bass_beats   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ts_top       INT NOT NULL DEFAULT 4,
  ts_bottom    INT NOT NULL DEFAULT 4,
  tonic_idx    INT NOT NULL DEFAULT 0,
  scale_name   VARCHAR(50) NOT NULL DEFAULT 'major',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_user_updated ON projects(user_id, updated_at DESC);
