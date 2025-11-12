-- Fix CRM Notes foreign key to reference crm_users instead of users
-- Run this SQL script directly on your database

BEGIN;

-- Drop the old foreign key constraint (if exists)
ALTER TABLE crm_notes DROP CONSTRAINT IF EXISTS crm_notes_created_by_fkey;

-- Add new foreign key constraint to crm_users
ALTER TABLE crm_notes
ADD CONSTRAINT crm_notes_created_by_crm_users_fkey
FOREIGN KEY (created_by) REFERENCES crm_users(id);

COMMIT;

-- Verify the change
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name='crm_notes'
AND kcu.column_name='created_by';
