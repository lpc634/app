import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Send, PlusCircle, X, MapPin, NotebookText, User, Calendar, Users } from 'lucide-react';

// --- MOCK DATA (Car makes and models) ---
const carData = {
  "Ford": ["Fiesta", "Focus", "Mustang", "Explorer", "Transit"],
  "BMW": ["3 Series", "5 Series", "X5", "M3"],
  "Audi": ["A4", "A6", "Q5", "R8"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "G-Class", "Sprinter"],
  "Vauxhall": ["Corsa", "Astra", "Insignia", "Mokka"]
};

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
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedMake, setSelectedMake] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMakes(Object.keys(carData));
        } else {
            setPlate(''); setNotes(''); setAddress(''); setIsDangerous(false);
            setSelectedMake(''); setSelectedModel(''); setIsManualEntry(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedMake) {
            setModels(carData[selectedMake] || []);
            setSelectedModel('');
        } else {
            setModels([]);
        }
    }, [selectedMake]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!plate || !address) {
            toast.error("Plate and Address are required.");
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

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-start p-4 overflow-y-auto">
            <div className="bg-v3-bg-card rounded-lg shadow-xl w-full max-w-lg mt-16 mb-8">
                <div className="p-4 border-b border-v3-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-v3-text-lightest">Add New Sighting</h2>
                    <button onClick={onClose} className="text-v3-text-muted hover:text-v3-text-lightest"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Input value={plate} onChange={e => setPlate(e.target.value)} placeholder="Registration Plate" required />
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address or Area Seen" required />
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="manualEntry" checked={isManualEntry} onChange={e => setIsManualEntry(e.target.checked)} />
                        <label htmlFor="manualEntry">Make/Model not listed?</label>
                    </div>
                    <div className="p-4 bg-v3-bg-dark rounded-lg border border-v3-border">
                        <p className="text-v3-text-muted text-sm mb-2">
                            🚧 Vehicle details (make/model/colour) will be available in a future update.
                        </p>
                        <p className="text-v3-text-muted text-xs">
                            For now, please include vehicle details in the notes section if needed.
                        </p>
                    </div>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes on interaction, individuals, etc." />
                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="isDangerousModal" checked={isDangerous} onChange={e => setIsDangerous(e.target.checked)} />
                        <label htmlFor="isDangerousModal">Mark as potentially dangerous</label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" onClick={onClose} className="bg-v3-bg-dark hover:bg-v3-bg-darkest">Cancel</Button>
                        <Button type="submit" className="flex items-center justify-center gap-2" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : <Send />}
                            Submit Sighting
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- GroupViewModal Component ---
const GroupViewModal = ({ isOpen, onClose, groupData }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4">
            <div className="bg-v3-bg-card rounded-lg shadow-xl w-full max-w-md">
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
                                                        <p className="text-v3-text-muted text-xs">
                                                            🚧 Vehicle details (make/model/colour) coming soon
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