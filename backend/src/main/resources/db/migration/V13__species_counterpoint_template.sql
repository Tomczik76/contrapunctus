ALTER TABLE community_exercises DROP CONSTRAINT community_exercises_template_check;
ALTER TABLE community_exercises ADD CONSTRAINT community_exercises_template_check
  CHECK (template IN ('harmonize_melody', 'rn_analysis', 'species_counterpoint'));
