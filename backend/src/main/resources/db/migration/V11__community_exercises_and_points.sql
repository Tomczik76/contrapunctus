-- V11: Community exercises, points system, leaderboard
-- Adds community-created exercises, attempt tracking, voting, points ledger, and streaks.

-- 1. Community exercises
CREATE TABLE community_exercises (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID NOT NULL REFERENCES users(id),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  template            TEXT NOT NULL CHECK (template IN ('harmonize_melody', 'rn_analysis')),
  tonic_idx           INT NOT NULL DEFAULT 0,
  scale_name          TEXT NOT NULL DEFAULT 'major',
  ts_top              INT NOT NULL DEFAULT 4,
  ts_bottom           INT NOT NULL DEFAULT 4,
  soprano_beats       JSONB NOT NULL DEFAULT '[]'::jsonb,
  bass_beats          JSONB,
  figured_bass        JSONB,
  reference_solution  JSONB,
  rn_answer_key       JSONB,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'removed')),
  attempt_count       INT NOT NULL DEFAULT 0,
  completion_count    INT NOT NULL DEFAULT 0,
  completion_rate     NUMERIC NOT NULL DEFAULT 0,
  inferred_difficulty TEXT NOT NULL DEFAULT 'intermediate'
                        CHECK (inferred_difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  upvotes             INT NOT NULL DEFAULT 0,
  downvotes           INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_exercises_creator ON community_exercises(creator_id);
CREATE INDEX idx_community_exercises_status ON community_exercises(status);
CREATE INDEX idx_community_exercises_template ON community_exercises(template);
CREATE INDEX idx_community_exercises_difficulty ON community_exercises(inferred_difficulty);
CREATE INDEX idx_community_exercises_popular ON community_exercises((upvotes - downvotes) DESC)
  WHERE status = 'published';
CREATE INDEX idx_community_exercises_tags ON community_exercises USING gin(tags);

-- 2. Exercise attempts (one row per user per exercise, updated on re-attempts)
CREATE TABLE exercise_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  exercise_id     UUID NOT NULL REFERENCES community_exercises(id) ON DELETE CASCADE,
  treble_beats    JSONB NOT NULL DEFAULT '[]'::jsonb,
  bass_beats      JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_romans  JSONB NOT NULL DEFAULT '{}'::jsonb,
  score           NUMERIC,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted')),
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  UNIQUE (user_id, exercise_id)
);

CREATE INDEX idx_exercise_attempts_user ON exercise_attempts(user_id);
CREATE INDEX idx_exercise_attempts_exercise ON exercise_attempts(exercise_id);

-- 3. Exercise votes (one vote per user per exercise)
CREATE TABLE exercise_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   UUID NOT NULL REFERENCES community_exercises(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  vote          TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exercise_id, user_id)
);

CREATE INDEX idx_exercise_votes_exercise ON exercise_votes(exercise_id);
CREATE INDEX idx_exercise_votes_user ON exercise_votes(user_id);

-- 4. Points ledger (append-only log of all point-earning events)
CREATE TABLE point_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL CHECK (action IN (
                  'exercise_completed',
                  'exercise_created',
                  'upvote_received',
                  'downvote_received',
                  'vote_cast',
                  'correction_confirmed',
                  'daily_streak',
                  'weekly_streak'
                )),
  points        INT NOT NULL,
  reference_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_events_user ON point_events(user_id);
CREATE INDEX idx_point_events_user_created ON point_events(user_id, created_at DESC);
CREATE INDEX idx_point_events_action ON point_events(action);
CREATE INDEX idx_point_events_created ON point_events(created_at);

-- 5. User points summary (denormalized for fast reads)
ALTER TABLE users ADD COLUMN total_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN weekly_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN current_streak INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN longest_streak INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_active_date DATE;
ALTER TABLE users ADD COLUMN rank_title TEXT NOT NULL DEFAULT 'Motif';

CREATE INDEX idx_users_total_points ON users(total_points DESC);
CREATE INDEX idx_users_weekly_points ON users(weekly_points DESC);

-- 6. Duplicate completion prevention
CREATE UNIQUE INDEX idx_point_events_unique_completion
  ON point_events(user_id, reference_id)
  WHERE action = 'exercise_completed';
