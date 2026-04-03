ALTER TABLE share_images ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE share_images DROP COLUMN image_data;
