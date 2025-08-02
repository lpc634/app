import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Send, PlusCircle, X, MapPin, NotebookText, User, Calendar, Users, CheckCircle, Edit3, Save, Car, Info, Plus } from 'lucide-react';


// --- Reusable UI Components ---
const Input = (props) => <input className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest placeholder-gray-400 focus:outline-none focus:ring-v3-orange focus:border-v3-orange" {...props} />;
const Textarea = (props) => <textarea className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest placeholder-gray-400 focus:outline-none focus:ring-v3-orange focus:border-v3-orange" rows="3" {...props} />;
const Button = ({ children, ...props }) => <button className="button-refresh" {...props}>{children}</button>;
const Select = (props) => <select className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange" {...props} />;

// --- AddSightingModal Component ---
const AddSightingModal = ({ isOpen, onClose, onSightingAdded }) => {
    const { apiCall } = useAuth();
    const [plate, setPlate] = useState('');
    const [notes, setNotes] = useState('');
    const [address, setAddress] = useState('');
    const [isDangerous, setIsDangerous] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!isOpen) {
            setPlate(''); setNotes(''); setAddress(''); setIsDangerous(false);
            setErrors({});
        }
    }, [isOpen]);

    // Body scroll lock and escape key handler for modal
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            
            document.addEventListener('keydown', handleEscape);
            
            return () => {
                document.body.style.overflow = 'unset';
                document.removeEventListener('keydown', handleEscape);
            };
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen, onClose]);

    const validateForm = () => {
        const newErrors = {};
        
        if (!plate.trim()) {
            newErrors.plate = "Registration plate is required";
        } else if (plate.trim().length < 2) {
            newErrors.plate = "Registration plate must be at least 2 characters";
        }
        
        if (!address.trim()) {
            newErrors.address = "Address or area seen is required";
        } else if (address.trim().length < 3) {
            newErrors.address = "Address must be at least 3 characters";
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            toast.error("Please fix the errors below.");
            return;
        }
        
        setLoading(true);
        try {
            const payload = {
                registration_plate: plate.toUpperCase(),
                notes,
                is_dangerous: isDangerous,
                address_seen: address
            };
            const newSighting = await apiCall('/vehicles/sightings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            toast.success("Sighting added successfully!");
            onSightingAdded(newSighting);
            onClose();
        } catch (error) {
            toast.error("Failed to add sighting.", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-[9999] flex justify-center items-center p-4 overflow-y-auto modal-backdrop" 
            onClick={handleBackdropClick}
        >
            <div className="relative z-[10000] bg-v3-bg-card rounded-lg shadow-2xl w-full max-w-2xl border border-v3-border modal-content">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-v3-border">
                    <h2 className="text-2xl font-bold text-v3-text-lightest flex items-center gap-3">
                        <span className="w-8 h-8 bg-v3-orange rounded-full flex items-center justify-center">
                            <Plus className="w-4 h-4 text-white" />
                        </span>
                        Add New Sighting
                    </h2>
                    <button 
                        onClick={onClose}
                        className="text-v3-text-muted hover:text-v3-text-lightest transition-colors p-1 rounded-md hover:bg-v3-bg-dark"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Registration Plate */}
                    <div>
                        <label className="block text-v3-text-light text-sm font-medium mb-2">
                            Registration Plate *
                        </label>
                        <input
                            type="text"
                            value={plate}
                            onChange={e => {
                                setPlate(e.target.value);
                                if (errors.plate) setErrors(prev => ({ ...prev, plate: null }));
                            }}
                            required
                            className={`w-full px-4 py-3 bg-v3-bg-dark border rounded-lg text-v3-text-lightest placeholder-v3-text-muted focus:ring-1 transition-colors ${
                                errors.plate 
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                    : 'border-v3-border focus:border-v3-orange focus:ring-v3-orange'
                            }`}
                            placeholder="Enter registration plate (e.g. AB12 CDE)"
                        />
                        {errors.plate && (
                            <p className="mt-1 text-sm text-red-400">{errors.plate}</p>
                        )}
                    </div>
                    
                    {/* Address */}
                    <div>
                        <label className="block text-v3-text-light text-sm font-medium mb-2">
                            Address or Area Seen *
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={e => {
                                setAddress(e.target.value);
                                if (errors.address) setErrors(prev => ({ ...prev, address: null }));
                            }}
                            required
                            className={`w-full px-4 py-3 bg-v3-bg-dark border rounded-lg text-v3-text-lightest placeholder-v3-text-muted focus:ring-1 transition-colors ${
                                errors.address 
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                    : 'border-v3-border focus:border-v3-orange focus:ring-v3-orange'
                            }`}
                            placeholder="Location where vehicle was spotted"
                        />
                        {errors.address && (
                            <p className="mt-1 text-sm text-red-400">{errors.address}</p>
                        )}
                    </div>
                    
                    {/* Vehicle Details Information Card */}
                    <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-v3-orange rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Info className="w-3 h-3 text-white" />
                            </div>
                            <div>
                                <h4 className="text-v3-text-lightest font-medium mb-1">Vehicle Details</h4>
                                <p className="text-v3-text-muted text-sm">
                                    Vehicle details (make/model/colour) can now be added after searching for the registration plate. 
                                    Search for the plate first, then use the "Add Details" button in the vehicle information section.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Notes */}
                    <div>
                        <label className="block text-v3-text-light text-sm font-medium mb-2">
                            Notes
                        </label>
                        <textarea
                            rows="4"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-4 py-3 bg-v3-bg-dark border border-v3-border rounded-lg text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:ring-1 focus:ring-v3-orange transition-colors resize-vertical"
                            placeholder="Describe the situation, individuals, or any relevant details"
                        />
                    </div>
                    
                    {/* Dangerous Checkbox */}
                    <div className="flex items-center gap-3 p-4 bg-v3-bg-dark rounded-lg border border-v3-border">
                        <input
                            type="checkbox"
                            id="isDangerousModal"
                            checked={isDangerous}
                            onChange={e => setIsDangerous(e.target.checked)}
                            className="w-4 h-4 text-v3-orange bg-v3-bg-dark border-v3-border rounded focus:ring-v3-orange focus:ring-1"
                        />
                        <label htmlFor="isDangerousModal" className="text-v3-text-light text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            Mark as potentially dangerous
                        </label>
                    </div>
                </form>
                
                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-v3-border bg-v3-bg-dark">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-3 bg-v3-orange text-white rounded-lg hover:bg-v3-orange-dark transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        {loading ? 'Submitting...' : 'Submit Sighting'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- GroupViewModal Component ---
const GroupViewModal = ({ isOpen, onClose, groupData }) => {
    // Escape key handler for modal
    React.useEffect(() => {
        if (isOpen) {
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            
            document.addEventListener('keydown', handleEscape);
            
            return () => {
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    return (
        <div 
            className="fixed inset-0 bg-black/70 z-[9999] flex justify-center items-center p-4 modal-backdrop"
            onClick={handleBackdropClick}
        >
            <div className="relative z-[10000] bg-v3-bg-card rounded-lg shadow-xl w-full max-w-md modal-content">
                <div className="p-4 border-b border-v3-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-v3-text-lightest">Associated Plates</h2>
                    <button onClick={onClose} className="text-v3-text-muted hover:text-v3-text-lightest"><X /></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-v3-text-muted mb-4">The following plates were sighted at the same location and time:</p>
                    <ul className="space-y-2">
                        {groupData && groupData.length > 0 ? groupData.map(plate => (
                           <li key={plate} className="bg-v3-bg-dark p-2 rounded-md font-mono">{plate}</li>
                        )) : <li className="text-v3-text-muted">No other plates in this group.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// --- VehicleSearchPage Main Component ---
const VehicleSearchPage = () => {
    const [searchPlate, setSearchPlate] = useState('');
    const [sightings, setSightings] = useState([]);
    const [selectedSighting, setSelectedSighting] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    
    // Vehicle details state
    const [vehicleDetails, setVehicleDetails] = useState({
        make: '',
        model: '',
        colour: ''
    });
    const [isEditingVehicle, setIsEditingVehicle] = useState(false);
    const [vehicleDetailsLoading, setVehicleDetailsLoading] = useState(false);
    const [hasVehicleDetails, setHasVehicleDetails] = useState(false);
    
    const { apiCall } = useAuth();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});

    const getCoordinates = async (address) => {
        if (!address) return null;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gb`);
            const data = await response.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
            }
            return null;
        } catch (error) { console.error("Geocoding error:", error); return null; }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchPlate) return;
        setLoading(true);
        setHasSearched(true);
        setError('');
        setSightings([]);
        setSelectedSighting(null);
        try {
            const data = await apiCall(`/vehicles/${searchPlate.trim().toUpperCase()}`);
            setSightings(data);
            if (data.length > 0) {
                setSelectedSighting(data[0]);
            } else {
                 setError('No records found for this registration plate.');
            }
        } catch (err) {
            setSightings([]);
            setError(err.message.includes('404') ? 'No records found for this registration plate.' : 'An error occurred while searching.');
        } finally {
            setLoading(false);
        }
    };

    const handleSightingAdded = (newSighting) => {
        if (newSighting.registration_plate === searchPlate.toUpperCase()) {
            setSightings(prev => [newSighting, ...prev]);
        }
    };
    
    const handleViewGroup = () => {
        if (selectedSighting && selectedSighting.group) {
            setIsGroupModalOpen(true);
        } else {
            toast.info("No group data available for this sighting.");
        }
    };

    // Load vehicle details for the current plate
    const loadVehicleDetails = async (plate) => {
        try {
            const data = await apiCall(`/vehicles/${plate}/details`);
            setVehicleDetails({
                make: data.make || '',
                model: data.model || '',
                colour: data.colour || ''
            });
            setHasVehicleDetails(true);
        } catch (error) {
            // No vehicle details found, reset to empty
            setVehicleDetails({ make: '', model: '', colour: '' });
            setHasVehicleDetails(false);
        }
    };

    // Save vehicle details
    const saveVehicleDetails = async () => {
        if (!selectedSighting) return;
        
        setVehicleDetailsLoading(true);
        try {
            const plate = selectedSighting.registration_plate;
            await apiCall(`/vehicles/${plate}/details`, {
                method: 'PUT',
                body: JSON.stringify(vehicleDetails)
            });
            
            toast.success('Vehicle details saved successfully!');
            setIsEditingVehicle(false);
            setHasVehicleDetails(true);
        } catch (error) {
            toast.error('Failed to save vehicle details', { description: error.message });
        } finally {
            setVehicleDetailsLoading(false);
        }
    };

    // Reset vehicle editing state
    const cancelVehicleEdit = () => {
        setIsEditingVehicle(false);
        // If we had details before, restore them
        if (selectedSighting) {
            loadVehicleDetails(selectedSighting.registration_plate);
        }
    };

    // Display text for vehicle details
    const getVehicleDisplayText = () => {
        const parts = [];
        if (vehicleDetails.make) parts.push(vehicleDetails.make);
        if (vehicleDetails.model) parts.push(vehicleDetails.model);
        
        const vehicleText = parts.join(' ');
        
        if (vehicleDetails.colour && vehicleText) {
            return `${vehicleText} (${vehicleDetails.colour})`;
        } else if (vehicleText) {
            return vehicleText;
        } else if (vehicleDetails.colour) {
            return vehicleDetails.colour;
        }
        return '';
    };

    // --- REVISED MAP LOGIC ---
    useEffect(() => {
        // If we have sightings and a map container, initialize the map
        if (sightings.length > 0 && mapRef.current && !mapInstance.current) {
            mapInstance.current = window.L.map(mapRef.current).setView([54.5, -3.5], 6); // UK view
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
        }

        // If there are no sightings and the map instance exists, destroy it
        if (sightings.length === 0 && mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }

        const updateMapMarkers = async () => {
            if (!mapInstance.current) return;
            
            // Clear existing markers
            Object.values(markersRef.current).forEach(marker => marker.remove());
            markersRef.current = {};
            
            const locations = [];
            for (const s of sightings) {
                const coords = await getCoordinates(s.address_seen);
                if (coords) {
                    const marker = window.L.marker([coords.lat, coords.lng]).addTo(mapInstance.current);
                    marker.bindPopup(`<b>${coords.displayName}</b><br>${new Date(s.sighted_at).toLocaleString()}`);
                    markersRef.current[s.id] = marker;
                    locations.push([coords.lat, coords.lng]);
                }
            }
            
            // Auto-zoom to fit all markers
            if (locations.length > 0) {
                mapInstance.current.fitBounds(locations, { padding: [50, 50], maxZoom: 14 });
            }
        };

        if (sightings.length > 0) {
            updateMapMarkers();
        }
    }, [sightings]);

    useEffect(() => {
        // Pan to selected sighting on the map
        if (selectedSighting && mapInstance.current && markersRef.current[selectedSighting.id]) {
            const marker = markersRef.current[selectedSighting.id];
            mapInstance.current.panTo(marker.getLatLng(), { animate: true });
            marker.openPopup();
        }
    }, [selectedSighting]);

    // Load vehicle details when a sighting is selected
    useEffect(() => {
        if (selectedSighting) {
            loadVehicleDetails(selectedSighting.registration_plate);
            setIsEditingVehicle(false); // Reset editing state
        }
    }, [selectedSighting]);
    
    return (
        <>
            <AddSightingModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSightingAdded={handleSightingAdded} />
            <GroupViewModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} groupData={selectedSighting?.group} />

            <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">Vehicle Intelligence</h1>
                    <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
                        <PlusCircle size={18} /> Add New Sighting
                    </Button>
                </div>

                <div className="mb-6">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <Input value={searchPlate} onChange={(e) => setSearchPlate(e.target.value)} placeholder="Enter registration plate..." />
                        <Button type="submit" className="flex items-center justify-center gap-2 w-32" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : <><Search size={18}/> Search</>}
                        </Button>
                    </form>
                </div>
                
                {!hasSearched ? (
                    <div className="flex-grow flex items-center justify-center text-center text-v3-text-muted">
                        <div>
                           <Search size={48} className="mx-auto mb-4" />
                           <h2 className="text-xl font-semibold text-v3-text-lightest">Start a Search</h2>
                           <p>Enter a registration plate to view sighting history.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                        <div className="lg:col-span-1 bg-v3-bg-card rounded-lg flex flex-col overflow-hidden">
                           <div className="p-4 border-b border-v3-border">
                                <h2 className="text-lg font-semibold text-v3-text-lightest">
                                    {loading ? 'Searching...' : sightings.length > 0 ? `${sightings.length} Sighting(s)` : 'No Results'}
                                </h2>
                           </div>
                           <div className="flex-grow overflow-y-auto">
                                {loading && <div className="p-6 text-center text-v3-text-muted"><Loader2 className="animate-spin inline-block" /></div>}
                                {!loading && error && <div className="p-6 text-center text-red-400">{error}</div>}
                                {!loading && !error && sightings.length === 0 && <div className="p-6 text-center text-v3-text-muted">No sightings found for this plate.</div>}
                                
                                {sightings.map(sighting => (
                                    <div key={sighting.id} onClick={() => setSelectedSighting(sighting)} className={`p-4 border-b border-v3-border cursor-pointer hover:bg-v3-bg-dark ${selectedSighting?.id === sighting.id ? 'bg-v3-orange/20' : ''}`}>
                                        <div className="mb-2">
                                            <p className="font-bold text-v3-text-lightest">{sighting.registration_plate}</p>
                                            <p className="text-xs text-v3-text-muted">Registration Plate</p>
                                        </div>
                                        <p className="font-medium text-v3-text-light">{sighting.address_seen}</p>
                                        <p className="text-sm text-v3-text-muted">{new Date(sighting.sighted_at).toLocaleString()}</p>
                                    </div>
                                ))}
                           </div>
                        </div>

                        <div className="lg:col-span-2 bg-v3-bg-card rounded-lg flex flex-col overflow-hidden">
                            {sightings.length > 0 ? (
                                <>
                                    <div ref={mapRef} className="flex-grow w-full h-1/2 min-h-[300px]" style={{backgroundColor: '#1a202c'}}></div>
                                    {selectedSighting && (
                                        <div className="p-4 border-t border-v3-border">
                                            {/* Vehicle Header */}
                                            <div className="vehicle-header mb-6 p-4 bg-v3-bg-dark rounded-lg border border-v3-border">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-2xl text-v3-text-lightest mb-1">
                                                            {selectedSighting.registration_plate}
                                                        </h3>
                                                        <p className="text-v3-text-muted text-sm mb-2">
                                                            Registration Plate
                                                        </p>
                                                        {selectedSighting.is_dangerous && (
                                                            <div className="flex items-center gap-2 mt-3">
                                                                <AlertTriangle className="text-red-500" size={16} />
                                                                <span className="text-red-400 text-sm font-medium">Potentially Dangerous</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button onClick={handleViewGroup} className="flex items-center gap-2 text-sm">
                                                        <Users size={16} /> View Group
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {/* Vehicle Details Edit Section */}
                                            <div className="vehicle-details-section mb-6 p-4 bg-v3-bg-darker rounded-lg border border-v3-border">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Car className="text-v3-orange" size={18} />
                                                        <h4 className="font-semibold text-v3-text-lightest">Vehicle Details</h4>
                                                    </div>
                                                    {!isEditingVehicle && (
                                                        <button 
                                                            onClick={() => setIsEditingVehicle(true)}
                                                            className="flex items-center gap-1 text-v3-orange text-sm hover:text-orange-400 transition-colors"
                                                        >
                                                            <Edit3 size={14} />
                                                            {hasVehicleDetails ? 'Edit Details' : 'Add Details'}
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {isEditingVehicle ? (
                                                    <div className="space-y-3">
                                                        <Input
                                                            placeholder="Make (e.g. BMW, Ford, Audi)"
                                                            value={vehicleDetails.make}
                                                            onChange={e => setVehicleDetails({...vehicleDetails, make: e.target.value})}
                                                        />
                                                        <Input
                                                            placeholder="Model (e.g. 3 Series, Focus, A4)"
                                                            value={vehicleDetails.model}
                                                            onChange={e => setVehicleDetails({...vehicleDetails, model: e.target.value})}
                                                        />
                                                        <Input
                                                            placeholder="Colour (e.g. Blue, Red, Silver)"
                                                            value={vehicleDetails.colour}
                                                            onChange={e => setVehicleDetails({...vehicleDetails, colour: e.target.value})}
                                                        />
                                                        <div className="flex gap-2 pt-2">
                                                            <button 
                                                                onClick={saveVehicleDetails}
                                                                disabled={vehicleDetailsLoading}
                                                                className="flex items-center gap-2 bg-v3-orange text-white px-4 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
                                                            >
                                                                {vehicleDetailsLoading ? (
                                                                    <Loader2 className="animate-spin" size={16} />
                                                                ) : (
                                                                    <Save size={16} />
                                                                )}
                                                                {vehicleDetailsLoading ? 'Saving...' : 'Save'}
                                                            </button>
                                                            <button 
                                                                onClick={cancelVehicleEdit}
                                                                disabled={vehicleDetailsLoading}
                                                                className="bg-v3-bg-dark text-v3-text-lightest px-4 py-2 rounded-md hover:bg-v3-bg-darkest transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-v3-text-muted">
                                                        {hasVehicleDetails && getVehicleDisplayText() ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">🚗</span>
                                                                <span className="text-v3-text-lightest font-medium">{getVehicleDisplayText()}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-v3-text-muted">
                                                                <span className="text-lg">🚗</span>
                                                                <span className="italic">Click "Add Details" to specify make, model & colour</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Sighting Details */}
                                            <div className="sighting-details grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="text-v3-orange mt-1" size={18}/>
                                                    <div>
                                                        <strong className="text-v3-text-light block mb-1">📍 Location</strong>
                                                        <span className="text-v3-text-muted">{selectedSighting.address_seen}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <Calendar className="text-v3-orange mt-1" size={18}/>
                                                    <div>
                                                        <strong className="text-v3-text-light block mb-1">📅 Date & Time</strong>
                                                        <span className="text-v3-text-muted">{new Date(selectedSighting.sighted_at).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <User className="text-v3-orange mt-1" size={18}/>
                                                    <div>
                                                        <strong className="text-v3-text-light block mb-1">👮 Agent</strong>
                                                        <span className="text-v3-text-muted">{selectedSighting.agent_name}</span>
                                                    </div>
                                                </div>
                                                {selectedSighting.notes && (
                                                    <div className="flex items-start gap-3 md:col-span-2">
                                                        <NotebookText className="text-v3-orange mt-1" size={18}/>
                                                        <div>
                                                            <strong className="text-v3-text-light block mb-1">📝 Notes</strong>
                                                            <p className="text-v3-text-muted leading-relaxed">{selectedSighting.notes}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex-grow flex items-center justify-center text-center text-v3-text-muted p-6">
                                    <div>
                                       <MapPin size={48} className="mx-auto mb-4" />
                                       <h2 className="text-xl font-semibold text-v3-text-lightest">No Location Data</h2>
                                       <p>The map will be displayed here when a search returns valid sightings.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default VehicleSearchPage;