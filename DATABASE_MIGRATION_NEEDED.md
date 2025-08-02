# ⚠️ DATABASE MIGRATION REQUIRED

## Before deploying this vehicle details feature, you MUST run the database migration:

### Run this command:
```bash
python add_vehicle_columns.py
```

### What it does:
- Adds `make VARCHAR(50)` column to `vehicle_sightings` table
- Adds `model VARCHAR(100)` column to `vehicle_sightings` table  
- Adds `colour VARCHAR(30)` column to `vehicle_sightings` table

### For Production (Heroku):
```bash
heroku run python add_vehicle_columns.py --app your-app-name
```

### Manual SQL (if migration script fails):
```sql
ALTER TABLE vehicle_sightings ADD COLUMN make VARCHAR(50);
ALTER TABLE vehicle_sightings ADD COLUMN model VARCHAR(100);
ALTER TABLE vehicle_sightings ADD COLUMN colour VARCHAR(30);
```

## ⚠️ WARNING
**Without this migration, the application will fail with "column does not exist" errors!**

## After Migration
✅ Vehicle search will work with editable details  
✅ Users can add/edit make/model/colour for any vehicle  
✅ Changes apply to all sightings of that registration plate  
✅ Professional vehicle intelligence interface  

## Features Added
- **Edit Button**: Click "Add Vehicle Details" or "Edit Details"
- **Inline Editing**: Input fields for make, model, colour
- **Validation**: Must enter at least vehicle make
- **Auto-capitalization**: Proper formatting of vehicle details
- **Immediate Updates**: UI updates instantly after saving
- **Bulk Updates**: Changes apply to ALL sightings of that plate
- **Success Feedback**: Toast notifications for save status