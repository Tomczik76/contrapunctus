-- V10: Community analysis corrections
-- Allows users to report incorrect chord labels, NCT detection, or part-writing errors
-- with structured correction data.

CREATE TABLE analysis_corrections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  category              TEXT NOT NULL CHECK (category IN ('chord_label', 'nct_detection', 'part_writing_error')),
  measure               INT NOT NULL,
  beat                  INT NOT NULL,
  voice                 TEXT,
  current_analysis      JSONB NOT NULL,
  suggested_correction  JSONB NOT NULL,
  description           TEXT,
  state_snapshot        JSONB NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'rejected', 'fixed')),
  upvotes               INT NOT NULL DEFAULT 0,
  downvotes             INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_corrections_user ON analysis_corrections(user_id);
CREATE INDEX idx_analysis_corrections_status ON analysis_corrections(status);
CREATE INDEX idx_analysis_corrections_category ON analysis_corrections(category);

CREATE TABLE correction_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id   UUID NOT NULL REFERENCES analysis_corrections(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  vote            TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (correction_id, user_id)
);

CREATE INDEX idx_correction_votes_correction ON correction_votes(correction_id);
