-- V7: Educator admin feature
-- Adds educator role, classes, enrollments, educator-authored lessons,
-- class lesson assignments, and per-attempt student progress tracking.

-- 1. Add educator flag to users
ALTER TABLE users ADD COLUMN is_educator BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Classes
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  invite_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_educator_id ON classes(educator_id);
CREATE INDEX idx_classes_invite_code ON classes(invite_code);

-- 3. Class enrollments
CREATE TABLE class_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE INDEX idx_class_enrollments_student_id ON class_enrollments(student_id);

-- 4. Educator-authored lessons (separate from built-in lessons table)
CREATE TABLE educator_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id   UUID NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  difficulty    TEXT NOT NULL DEFAULT 'beginner'
                  CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  template      TEXT NOT NULL DEFAULT 'harmonize_melody',
  tonic_idx     INT NOT NULL DEFAULT 0,
  scale_name    TEXT NOT NULL DEFAULT 'major',
  ts_top        INT NOT NULL DEFAULT 4,
  ts_bottom     INT NOT NULL DEFAULT 4,
  soprano_beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  bass_beats    JSONB,
  figured_bass  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_educator_lessons_educator_id ON educator_lessons(educator_id);

-- 5. Assign lessons to classes (many-to-many)
CREATE TABLE class_lesson_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id   UUID NOT NULL REFERENCES educator_lessons(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date    TIMESTAMPTZ,
  UNIQUE (class_id, lesson_id)
);

CREATE INDEX idx_class_lesson_assignments_class_id ON class_lesson_assignments(class_id);
CREATE INDEX idx_class_lesson_assignments_lesson_id ON class_lesson_assignments(lesson_id);

-- 6. Per-attempt student progress tracking
CREATE TABLE student_lesson_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id),
  lesson_id    UUID NOT NULL REFERENCES educator_lessons(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  score        NUMERIC,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_lesson_attempts_student_id ON student_lesson_attempts(student_id);
CREATE INDEX idx_student_lesson_attempts_class_lesson
  ON student_lesson_attempts(class_id, lesson_id);
