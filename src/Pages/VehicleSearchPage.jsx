import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Send, PlusCircle, X, MapPin, NotebookText, User, Calendar } from 'lucide-react';

// --- Reusable Input Component ---
const Input = ({ className, ...props }) => (
    <input 
        className={`w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest placeholder-gray-400 focus:outline-none focus:ring-v3-orange focus:border-v3-orange ${className}`} 
        {...props} 
    />
);

// --- Reusable Textarea Component ---
const Textarea = ({ className, ...props }) => (
    <textarea 
        className={`w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest placeholder-gray-400 focus:outline-none focus:ring-v3-orange focus:border-v3-orange ${className}`} 
        rows="3" 
        {...props}
    />
);

// --- Reusable Button Component ---
const Button = ({ children, className, ...props }) => (
    <button 
        className={`button-refresh ${className}`} 
        {...props}
    >
        {children}
    </button>
);

// --- AddSightingModal Component ---
const AddSightingModal = ({ isOpen, onClose, onSightingAdded }) => {
    const { apiCall } = useAuth();
    const [plate, setPlate] = useState('');
    const [notes, setNotes] = useState('');
    const [address, setAddress] = useState('');
    const [isDangerous, setIsDangerous] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setPlate('');
            setNotes('');
            setAddress('');
            setIsDangerous(false);
            setLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!plate || !address || !notes) {
            toast.error("Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            const newSighting = await apiCall('/vehicles/sightings', {
                method: 'POST',
                body: JSON.stringify({
                    registration_plate: plate.toUpperCase(),
                    notes,
                    is_dangerous: isDangerous,
                    address_seen: address
                })
            });
            toast.success(`Sighting for ${newSighting.registration_plate} added successfully!`);
            onSightingAdded(newSighting);
            onClose();
        } catch (error) {
            toast.error(error.message || "Failed to add sighting.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4">
            <div className="bg-v3-bg-card rounded-lg shadow-xl w-full max-w-lg m-4">
                <div className="p-4 border-b border-v3-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-v3-text-lightest">Add New Sighting</h2>
                    <button onClick={onClose} className="text-v3-text-muted hover:text-v3-text-lightest"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Input value={plate} onChange={e => setPlate(e.target.value)} placeholder="Registration Plate" required />
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address or Area Seen" required />
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes on interaction, individuals, etc." required />
                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="isDangerousModal" checked={isDangerous} onChange={e => setIsDangerous(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-v3-orange focus:ring-v3-orange" />
                        <label htmlFor="isDangerousModal" className="text-v3-text-light font-medium">Mark as potentially dangerous</label>
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

// --- VehicleSearchPage Main Component ---
const VehicleSearchPage = () => {
    const [searchPlate, setSearchPlate] = useState('');
    const [sightings, setSightings] = useState([]);
    const [selectedSighting, setSelectedSighting] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { apiCall } = useAuth();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});

    const getCoordinates = async (address) => {
        if (!address) return null;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
            const data = await response.json();
            return (data && data.length > 0) ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
        } catch (error) { console.error("Geocoding error:", error); return null; }
    };

    useEffect(() => {
        if (!mapInstance.current && mapRef.current) {
            mapInstance.current = window.L.map(mapRef.current).setView([51.505, -0.09], 6);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
        }

        const updateMap = async () => {
            if (!mapInstance.current) return;
            Object.values(markersRef.current).forEach(marker => marker.remove());
            markersRef.current = {};
            
            if (sightings.length === 0) return;

            const locations = [];
            for (const s of sightings) {
                const coords = await getCoordinates(s.address_seen);
                if (coords) {
                    const marker = window.L.marker([coords.lat, coords.lng]).addTo(mapInstance.current);
                    marker.bindPopup(`<b>${s.address_seen}</b><br>${new Date(s.sighted_at).toLocaleDateString()}`);
                    markersRef.current[s.id] = marker;
                    locations.push([coords.lat, coords.lng]);
                }
            }
            if (locations.length > 0) mapInstance.current.fitBounds(locations, { padding: [50, 50], maxZoom: 14 });
        };
        updateMap();
    }, [sightings]);

    useEffect(() => {
        if (selectedSighting && mapInstance.current && markersRef.current[selectedSighting.id]) {
            const marker = markersRef.current[selectedSighting.id];
            mapInstance.current.panTo(marker.getLatLng(), { animate: true });
            marker.openPopup();
        }
    }, [selectedSighting]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchPlate) return;
        setLoading(true);
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
            setSelectedSighting(newSighting);
        }
    };

    return (
        <>
            <AddSightingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSightingAdded={handleSightingAdded} />
            <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">Vehicle Intelligence</h1>
                    <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
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
                
                <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                    <div className="lg:col-span-1 bg-v3-bg-card rounded-lg flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-v3-border">
                             <h2 className="text-lg font-semibold text-v3-text-lightest">
                                {sightings.length > 0 ? `${sightings.length} Sighting(s) Found` : 'Search Results'}
                             </h2>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                           {loading && <div className="p-6 text-center text-v3-text-muted">Loading results...</div>}
                           {error && <div className="p-6 text-center text-v3-text-muted">{error}</div>}
                           {!loading && !error && sightings.length === 0 && <div className="p-6 text-center text-v3-text-muted">Enter a registration plate to begin.</div>}

                            {sightings.map(sighting => (
                                <div key={sighting.id} onClick={() => setSelectedSighting(sighting)} 
                                className={`p-4 border-b border-v3-border cursor-pointer hover:bg-v3-bg-dark ${selectedSighting?.id === sighting.id ? 'bg-v3-bg-dark' : ''}`}>
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-v3-text-lightest">{sighting.address_seen}</p>
                                        {sighting.is_dangerous && <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full">DANGER</span>}
                                    </div>
                                    <p className="text-sm text-v3-text-muted">{new Date(sighting.sighted_at).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-2 bg-v3-bg-card rounded-lg flex flex-col overflow-hidden">
                        <div ref={mapRef} className="flex-grow w-full h-1/2 min-h-[300px]" style={{backgroundColor: '#1a202c'}}></div>
                        {selectedSighting && (
                             <div className="p-4 border-t border-v3-border flex-shrink-0">
                                 <h3 className="font-bold text-xl text-v3-text-lightest mb-4">Sighting Details</h3>
                                 {selectedSighting.is_dangerous && (<div className="bg-red-900/50 border border-red-500/50 text-red-300 p-3 rounded-md mb-4 flex items-center gap-3"><AlertTriangle /> <strong>DANGEROUS: Use caution.</strong></div>)}
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                     <div className="flex items-start gap-3"><MapPin className="text-v3-orange mt-1"/><div><strong className="text-v3-text-light block">Location</strong><span className="text-v3-text-muted">{selectedSighting.address_seen}</span></div></div>
                                     <div className="flex items-start gap-3"><Calendar className="text-v3-orange mt-1"/><div><strong className="text-v3-text-light block">Date</strong><span className="text-v3-text-muted">{new Date(selectedSighting.sighted_at).toLocaleString()}</span></div></div>
                                     <div className="flex items-start gap-3"><User className="text-v3-orange mt-1"/><div><strong className="text-v3-text-light block">Agent</strong><span className="text-v3-text-muted">{selectedSighting.agent_name}</span></div></div>
                                     <div className="flex items-start gap-3 md:col-span-2"><NotebookText className="text-v3-orange mt-1"/><div><strong className="text-v3-text-light block">Notes</strong><p className="text-v3-text-muted">{selectedSighting.notes}</p></div></div>
                                 </div>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default VehicleSearchPage;