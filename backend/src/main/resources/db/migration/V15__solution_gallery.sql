-- V15: Solution gallery — shared solutions, upvotes, and related point actions

-- 1. Add sharing and upvote columns to exercise_attempts
ALTER TABLE exercise_attempts ADD COLUMN shared BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exercise_attempts ADD COLUMN upvote_count INT NOT NULL DEFAULT 0;

-- 2. Solution upvotes table (one upvote per user per attempt)
CREATE TABLE solution_upvotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  UUID NOT NULL REFERENCES exercise_attempts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, user_id)
);

CREATE INDEX idx_solution_upvotes_attempt ON solution_upvotes(attempt_id);
CREATE INDEX idx_solution_upvotes_user ON solution_upvotes(user_id);

-- 3. Expand point_events action CHECK to include solution upvote actions
ALTER TABLE point_events DROP CONSTRAINT point_events_action_check;
ALTER TABLE point_events ADD CONSTRAINT point_events_action_check CHECK (action IN (
  'exercise_completed',
  'exercise_created',
  'upvote_received',
  'downvote_received',
  'vote_cast',
  'correction_confirmed',
  'daily_streak',
  'weekly_streak',
  'solution_upvote_received',
  'solution_upvote_cast'
));

-- 4. Prevent duplicate solution upvote point events
CREATE UNIQUE INDEX idx_point_events_unique_solution_upvote_cast
  ON point_events(user_id, reference_id)
  WHERE action = 'solution_upvote_cast';
