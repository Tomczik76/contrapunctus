-- V8: Add sort_order to class_lesson_assignments for educator-controlled sequencing
ALTER TABLE class_lesson_assignments ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
