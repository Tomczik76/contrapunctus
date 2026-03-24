-- V9: Student lesson work
-- Stores student work (draft or submitted) for assigned lessons.
-- Replaces the multi-attempt model with a single save/submit model.

CREATE TABLE student_lesson_work (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES users(id),
  lesson_id     UUID NOT NULL REFERENCES educator_lessons(id) ON DELETE CASCADE,
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  treble_beats  JSONB NOT NULL DEFAULT '[]'::jsonb,
  bass_beats    JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_romans JSONB NOT NULL DEFAULT '{}'::jsonb,
  score         NUMERIC,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted')),
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at  TIMESTAMPTZ,
  UNIQUE (student_id, lesson_id, class_id)
);

CREATE INDEX idx_student_lesson_work_student ON student_lesson_work(student_id);
CREATE INDEX idx_student_lesson_work_class_lesson ON student_lesson_work(class_id, lesson_id);
