CREATE TABLE lessons (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  difficulty    TEXT        NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  template      TEXT        NOT NULL DEFAULT 'harmonize_melody',
  tonic_idx     INT         NOT NULL DEFAULT 0,
  scale_name    TEXT        NOT NULL DEFAULT 'major',
  ts_top        INT         NOT NULL DEFAULT 4,
  ts_bottom     INT         NOT NULL DEFAULT 4,
  soprano_beats JSONB       NOT NULL,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_sort ON lessons (sort_order, created_at);

-- Seed the existing lesson
INSERT INTO lessons (title, description, difficulty, template, tonic_idx, scale_name, ts_top, ts_bottom, soprano_beats, sort_order)
VALUES (
  'Harmonize a Melody',
  'Add alto, tenor, and bass voices to complete this 4-part chorale in C major. Avoid part-writing errors and label each chord with roman numerals.',
  'beginner',
  'harmonize_melody',
  0,
  'major',
  4,
  4,
  '[
    {"notes":[{"dp":35,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":36,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":37,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":36,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":37,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":36,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":34,"staff":"treble","accidental":""}],"duration":"quarter"},
    {"notes":[{"dp":35,"staff":"treble","accidental":""}],"duration":"quarter"}
  ]'::jsonb,
  0
);
