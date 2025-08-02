# Vehicle Details Database Migration - TODO

## Current Status
The vehicle search functionality has been **FIXED** by removing references to non-existent database columns. The search now works properly with the basic vehicle sighting data.

## What Was Removed (Temporarily)
- `make` column (VARCHAR(50))
- `model` column (VARCHAR(50)) 
- `colour` column (VARCHAR(30))

These fields were causing "column does not exist" errors in production.

## When Ready to Add Vehicle Details Back

### Step 1: Database Migration
Run this SQL on the production database:
```sql
ALTER TABLE vehicle_sightings 
ADD COLUMN make VARCHAR(50),
ADD COLUMN model VARCHAR(50), 
ADD COLUMN colour VARCHAR(30);
```

### Step 2: Update Backend Model
In `src/models/vehicle.py`, add back:
```python
# Vehicle details fields
make = db.Column(db.String(50), nullable=True)
model = db.Column(db.String(50), nullable=True)
colour = db.Column(db.String(30), nullable=True)
```

### Step 3: Update to_dict() Method
```python
def to_dict(self):
    return {
        'id': self.id,
        'registration_plate': self.registration_plate,
        'notes': self.notes,
        'is_dangerous': self.is_dangerous,
        'sighted_at': self.sighted_at.isoformat(),
        'agent_name': f"{self.agent.first_name} {self.agent.last_name}" if self.agent else "Unknown",
        'address_seen': self.address_seen,
        'make': self.make,
        'model': self.model,
        'colour': self.colour
    }
```

### Step 4: Update API Routes
In `src/routes/vehicles.py`, add back:
```python
new_sighting = VehicleSighting(
    registration_plate=data['registration_plate'].upper().strip(),
    notes=data['notes'],
    is_dangerous=data['is_dangerous'],
    address_seen=data['address_seen'],
    agent_id=current_user_id,
    make=data.get('make', '').strip() or None,
    model=data.get('model', '').strip() or None,
    colour=data.get('colour', '').strip() or None
)
```

### Step 5: Update Frontend
Update `VehicleSearchPage.jsx` to display vehicle details prominently as originally planned.

## Current Working Features
✅ Vehicle search by registration plate  
✅ Display sighting location, date, agent  
✅ Add new sightings  
✅ Map visualization  
✅ Notes display  
✅ Dangerous vehicle flagging  

## Future Enhancements After Migration
- Vehicle make/model/colour prominent display
- DVLA API integration for automatic vehicle lookup
- Enhanced search filtering by vehicle type
- Better vehicle grouping and identification