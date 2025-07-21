import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Send, PlusCircle } from 'lucide-react';

// --- AddSightingForm Component ---
const AddSightingForm = ({ onSightingAdded }) => {
    const { apiCall } = useAuth();
    const [plate, setPlate] = useState('');
    const [notes, setNotes] = useState('');
    const [address, setAddress] = useState('');
    const [isDangerous, setIsDangerous] = useState(false);
    const [loading, setLoading] = useState(false);

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
                    registration_plate: plate,
                    notes: notes,
                    is_dangerous: isDangerous,
                    address_seen: address
                })
            });
            toast.success(`Sighting for ${newSighting.registration_plate} added successfully!`);
            onSightingAdded(newSighting); // Notify parent to update
            // Reset form
            setPlate('');
            setNotes('');
            setAddress('');
            setIsDangerous(false);
        } catch (error) {
            toast.error(error.message || "Failed to add sighting.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-card p-6">
            <h2 className="text-xl font-bold text-v3-text-lightest mb-4 flex items-center gap-2"><PlusCircle size={22}/>Add New Sighting</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="Registration Plate" className="input-class" required />
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Address or Area Seen (e.g., 'Tesco, Camberley')" className="input-class" required />
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes on interaction, individuals, etc." className="input-class" rows="3" required></textarea>
                <div className="flex items-center gap-3">
                    <input type="checkbox" id="isDangerous" checked={isDangerous} onChange={e => setIsDangerous(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-v3-orange focus:ring-v3-orange" />
                    <label htmlFor="isDangerous" className="text-v3-text-light font-medium">Mark as potentially dangerous</label>
                </div>
                <button type="submit" className="button-primary w-full flex items-center justify-center gap-2" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Send />}
                    Submit Sighting
                </button>
            </form>
        </div>
    );
};


// --- VehicleSearchPage Main Component ---
const VehicleSearchPage = () => {
    const { apiCall } = useAuth();
    const [searchPlate, setSearchPlate] = useState('');
    const [sightings, setSightings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef([]);

    const getCoordinates = async (address) => {
        if (!address) return null;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
            const data = await response.json();
            return (data && data.length > 0) ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
        } catch (error) { console.error("Geocoding error:", error); return null; }
    };

    useEffect(() => {
        if (mapRef.current && !mapInstance.current) {
            const map = window.L.map(mapRef.current).setView([51.505, -0.09], 6);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            mapInstance.current = map;
        }

        const updateMap = async () => {
            if (!mapInstance.current) return;
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];
            if (sightings.length === 0) return;

            const locations = [];
            for (const s of sightings) {
                const coords = await getCoordinates(s.address_seen);
                if (coords) {
                    const marker = window.L.marker([coords.lat, coords.lng]).addTo(mapInstance.current);
                    marker.bindPopup(`<b>Location:</b> ${s.address_seen}<br><b>Sighted:</b> ${new Date(s.sighted_at).toLocaleString()}`);
                    markersRef.current.push(marker);
                    locations.push([coords.lat, coords.lng]);
                }
            }
            if (locations.length > 0) mapInstance.current.fitBounds(locations, { padding: [50, 50], maxZoom: 14 });
        };
        updateMap();
    }, [sightings]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchPlate) return;
        setLoading(true);
        setSearched(true);
        setError('');
        setSightings([]);
        try {
            const data = await apiCall(`/vehicles/${searchPlate.trim().toUpperCase()}`);
            setSightings(data);
        } catch (err) {
            setSightings([]);
            setError(err.message.includes('404') ? 'No records found.' : 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleSightingAdded = (newSighting) => {
        if (newSighting.registration_plate === searchPlate.toUpperCase()) {
            setSightings(prev => [newSighting, ...prev]);
        }
    };

    const lastSighting = sightings.length > 0 ? sightings[0] : null;

    return (
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">Vehicle Intelligence</h1>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input type="text" value={searchPlate} onChange={(e) => setSearchPlate(e.target.value)} placeholder="Enter registration plate to search..." className="input-class"/>
                        <button type="submit" className="button-refresh flex items-center gap-2" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />} Search</button>
                    </form>
                    {lastSighting && (
                        <div className="dashboard-card p-6">
                            <h2 className="text-xl font-bold text-v3-text-lightest mb-4">Latest Sighting Details</h2>
                            {lastSighting.is_dangerous && (<div className="bg-red-900/50 border border-red-500/50 text-red-300 p-3 rounded-md mb-4 flex items-center gap-3"><AlertTriangle /> <strong>DANGEROUS: Use caution.</strong></div>)}
                            <div className="space-y-3 text-v3-text-light">
                                <p><strong className="text-v3-text-lightest w-28 inline-block">Location Seen:</strong> {lastSighting.address_seen}</p>
                                <p><strong className="text-v3-text-lightest w-28 inline-block">Sighted By:</strong> {lastSighting.agent_name}</p>
                                <p><strong className="text-v3-text-lightest w-28 inline-block">Date:</strong> {new Date(lastSighting.sighted_at).toLocaleString()}</p>
                                <p><strong className="text-v3-text-lightest w-28 inline-block align-top">Notes:</strong> <span className="inline-block w-[calc(100%-7.5rem)]">{lastSighting.notes}</span></p>
                            </div>
                        </div>
                    )}
                    {searched && !loading && error && (<div className="dashboard-card text-center p-8"><p className="text-v3-text-muted">{error}</p></div>)}
                </div>
                <div className="space-y-6">
                     <AddSightingForm onSightingAdded={handleSightingAdded} />
                </div>
            </div>

            {sightings.length > 0 && (
                <div className="dashboard-card p-0 overflow-hidden mt-6">
                    <h2 className="text-xl font-bold text-v3-text-lightest p-4">Sighting History Map</h2>
                    <div ref={mapRef} style={{ height: '400px', width: '100%', backgroundColor: '#1a202c' }}></div>
                </div>
            )}
        </div>
    );
};

export default VehicleSearchPage;