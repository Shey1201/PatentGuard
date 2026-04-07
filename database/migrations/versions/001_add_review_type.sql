-- Migration: 001_add_review_type
-- Date: 2026-03-19
-- Description: Add review_type column to review_tasks table
-- Status: PENDING (run manually or via Alembic)

-- Add review_type column if it doesn't exist
ALTER TABLE review_tasks
ADD COLUMN IF NOT EXISTS review_type VARCHAR(50) DEFAULT 'general';

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'review_tasks'
        AND column_name = 'review_type'
    ) THEN
        RAISE NOTICE 'Column review_type added successfully';
    ELSE
        RAISE WARNING 'Column review_type was NOT added - please check database permissions';
    END IF;
END $$;
