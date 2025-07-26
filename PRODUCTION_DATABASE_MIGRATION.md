# Production Database Migration - Verification Tracking Columns

## Overview
This migration adds three new columns to the `users` table to support the admin document verification system:
- `verification_notes` (TEXT) - Admin notes for verification decisions
- `verified_by` (INTEGER) - Foreign key to users.id (which admin verified)
- `verified_at` (DATETIME/TIMESTAMP) - When verification was completed

## Error Being Fixed
```
ERROR in auth: Auth error: (psycopg2.errors.UndefinedColumn) column users.verification_notes does not exist
```

## Migration Methods

### Option 1: Using the Migration Script (Recommended)

1. **Upload the migration script** to your production server:
   ```bash
   # Copy add_verification_columns.py to your production environment
   ```

2. **Run the migration**:
   ```bash
   cd /path/to/your/app
   python add_verification_columns.py
   ```

### Option 2: Manual SQL Commands

Connect to your PostgreSQL database and run these commands:

```sql
-- Add verification_notes column
ALTER TABLE users ADD COLUMN verification_notes TEXT;

-- Add verified_by column (with foreign key)
ALTER TABLE users ADD COLUMN verified_by INTEGER REFERENCES users(id);

-- Add verified_at column
ALTER TABLE users ADD COLUMN verified_at TIMESTAMP;
```

### Option 3: Heroku Database Migration

If you're using Heroku PostgreSQL:

1. **Connect to Heroku Postgres**:
   ```bash
   heroku pg:psql --app v3-app-49c3d1eff914
   ```

2. **Run the SQL commands**:
   ```sql
   ALTER TABLE users ADD COLUMN verification_notes TEXT;
   ALTER TABLE users ADD COLUMN verified_by INTEGER REFERENCES users(id);
   ALTER TABLE users ADD COLUMN verified_at TIMESTAMP;
   ```

3. **Verify the changes**:
   ```sql
   \d users
   ```

## Verification

After running the migration, verify the columns exist:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('verification_notes', 'verified_by', 'verified_at');
```

Expected output:
```
    column_name     | data_type | is_nullable
--------------------+-----------+-------------
 verification_notes | text      | YES
 verified_by        | integer   | YES
 verified_at        | timestamp | YES
```

## Safety Notes

- ✅ **Safe Migration**: All columns are nullable, so existing data won't be affected
- ✅ **No Downtime**: This is an additive-only migration
- ✅ **Backwards Compatible**: Old code will continue working
- ✅ **Rollback Safe**: Columns can be dropped if needed

## What This Enables

After migration, the admin document verification system will be able to:
- Track which admin approved/rejected each agent
- Store detailed notes for verification decisions
- Maintain a complete audit trail of verification actions
- Display verification history in the admin interface

## Troubleshooting

### If migration fails:
1. Check database connection
2. Verify user has ALTER TABLE permissions
3. Ensure no conflicting column names exist

### If columns already exist:
The script will detect existing columns and skip them safely.

### To rollback (if needed):
```sql
ALTER TABLE users DROP COLUMN verification_notes;
ALTER TABLE users DROP COLUMN verified_by;
ALTER TABLE users DROP COLUMN verified_at;
```

## Next Steps

1. ✅ Run the migration
2. ✅ Verify columns exist
3. ✅ Restart your application
4. ✅ Test admin document verification system
5. ✅ Check that login/auth works without errors

The `(psycopg2.errors.UndefinedColumn) column users.verification_notes does not exist` error should be resolved after this migration.