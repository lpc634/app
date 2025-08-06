# Production Deployment Guide - Vehicle Coordinates Fix

## Issue Fixed
- ❌ **Problem**: `column vehicle_sightings.latitude does not exist` error
- ❌ **Problem**: `column vehicle_sightings.longitude does not exist` error  
- ❌ **Problem**: 500 Internal Server Error on vehicle search endpoints
- ✅ **Solution**: Added latitude/longitude columns to vehicle_sightings table

## Files Modified
1. `src/models/vehicle.py` - Added latitude/longitude fields to VehicleSighting model
2. `src/routes/vehicles.py` - Updated to handle coordinate data in sighting creation
3. `migrations/versions/fix_coordinates_production.py` - Production-safe migration
4. `apply_coordinates_simple.py` - Safe migration script for production

## Production Deployment Steps

### Step 1: Deploy Code Changes
```bash
# Push the updated code to your repository
git add .
git commit -m "Fix missing latitude/longitude columns in vehicle_sightings table"
git push heroku main  # or your production branch
```

### Step 2: Apply Database Migration
```bash
# Connect to Heroku and run the migration script
heroku run python apply_coordinates_simple.py

# Expected output:
# Database OK: X columns including coordinates
# Query OK: Found X sightings  
# Model OK: Coordinates in response
# RESULT: SUCCESS
```

### Step 3: Verify the Fix
```bash
# Test a vehicle search endpoint
heroku run python -c "
from main import app
from src.models.vehicle import VehicleSighting

with app.app_context():
    # This was the failing query
    sightings = VehicleSighting.query.filter_by(registration_plate='TEST123').all()
    print(f'SUCCESS: Query worked, found {len(sightings)} sightings')
"
```

### Step 4: Monitor Application Logs
```bash
# Check Heroku logs for any errors
heroku logs --tail

# Look for:
# ✅ No more "column does not exist" errors
# ✅ Vehicle search endpoints returning 200/404 instead of 500
# ✅ Successful database queries
```

## Database Changes

### Before (Broken)
```sql
CREATE TABLE vehicle_sightings (
    id INTEGER PRIMARY KEY,
    registration_plate VARCHAR(15) NOT NULL,
    notes TEXT,
    is_dangerous BOOLEAN DEFAULT FALSE,
    sighted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    address_seen VARCHAR(255) NOT NULL,
    agent_id INTEGER NOT NULL
    -- Missing: latitude, longitude columns
);
```

### After (Fixed)
```sql
CREATE TABLE vehicle_sightings (
    id INTEGER PRIMARY KEY,
    registration_plate VARCHAR(15) NOT NULL,
    notes TEXT,
    is_dangerous BOOLEAN DEFAULT FALSE,
    sighted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    address_seen VARCHAR(255) NOT NULL,
    latitude REAL,           -- ✅ Added
    longitude REAL,          -- ✅ Added
    agent_id INTEGER NOT NULL
);
```

## API Response Changes

### Before (Error)
```
GET /vehicles/VA18LLE
Status: 500 Internal Server Error
{
  "error": "column vehicle_sightings.latitude does not exist"
}
```

### After (Fixed)
```
GET /vehicles/VA18LLE
Status: 200 OK  # or 404 if no sightings
[
  {
    "id": 1,
    "registration_plate": "VA18LLE", 
    "notes": "Suspicious behavior",
    "address_seen": "Main Street, London",
    "latitude": 51.5074,     // ✅ Now included
    "longitude": -0.1278,    // ✅ Now included
    "sighted_at": "2025-08-06T14:30:00",
    "agent_name": "John Doe",
    "is_dangerous": false
  }
]
```

## Rollback Plan (If Needed)

If something goes wrong, you can rollback the database changes:

```bash
heroku run python -c "
from main import app, db
from sqlalchemy import text

with app.app_context():
    # Remove the columns (only if absolutely necessary)
    db.session.execute(text('ALTER TABLE vehicle_sightings DROP COLUMN latitude'))
    db.session.execute(text('ALTER TABLE vehicle_sightings DROP COLUMN longitude'))
    db.session.commit()
    print('Columns removed')
"
```

## Testing Production

After deployment, test these endpoints:

1. **Vehicle Search (was failing)**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        https://your-app.herokuapp.com/vehicles/VA18LLE
   ```

2. **Add Sighting (now supports coordinates)**:
   ```bash
   curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"registration_plate":"TEST123","address_seen":"Test Location","latitude":52.25,"longitude":-1.37,"notes":"Test","is_dangerous":false}' \
        https://your-app.herokuapp.com/vehicles/sightings
   ```

## Success Indicators

✅ **Vehicle search endpoints return 200/404 instead of 500**  
✅ **No more "column does not exist" database errors**  
✅ **New sightings can be created with coordinate data**  
✅ **Existing sightings continue to work (latitude/longitude will be null)**  
✅ **Map functionality works with coordinate data**  

---

**This fix is backward compatible and safe for production deployment.**