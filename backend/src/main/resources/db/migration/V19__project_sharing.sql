ALTER TABLE projects ADD COLUMN shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_projects_shared ON projects(id) WHERE shared = TRUE;

-- Backfill: mark projects that were already shared
UPDATE projects SET shared = TRUE
WHERE id IN (SELECT DISTINCT source_id FROM share_images WHERE source_type = 'project');
