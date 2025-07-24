import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from "../useAuth";
import { toast } from 'sonner';
import { Briefcase, MapPin, Calendar, Users, MessageSquare, Send, Loader2, Navigation, X } from 'lucide-react';

const CreateJob = () => {
    const { apiCall } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        job_type: 'Traveller Eviction',
        address: '',
        arrival_time: '',
        agents_required: '1',
        instructions: '',
        what3words_address: '',
        urgency_level: 'medium',
    });
    const [loading, setLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 51.5074, lng: -0.1278 }); // London default
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [mapLoading, setMapLoading] = useState(false);
    
    // Refs for Leaflet map
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markerRef = useRef(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const openLocationSelector = async () => {
        if (!formData.address.trim()) {
            toast.error("Please enter an address first");
            return;
        }

        setMapLoading(true);
        try {
            // Geocode the address to get coordinates
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}&countrycodes=gb&limit=1`);
            const results = await response.json();
            
            if (results.length > 0) {
                const location = {
                    lat: parseFloat(results[0].lat),
                    lng: parseFloat(results[0].lon)
                };
                setMapCenter(location);
                setSelectedLocation(location);
                setShowMap(true);
            } else {
                toast.error("Could not find location for that address");
            }
        } catch (error) {
            toast.error("Failed to geocode address");
        } finally {
            setMapLoading(false);
        }
    };

    const handleMapClick = async (lat, lng) => {
        setSelectedLocation({ lat, lng });
        
        // Convert to What3Words using your backend API
        try {
            const response = await apiCall('/what3words/convert-to-3wa', {
                method: 'POST',
                body: JSON.stringify({ lat, lng })
            });
            
            if (response.three_word_address) {
                setFormData(prev => ({ 
                    ...prev, 
                    what3words_address: response.three_word_address 
                }));
                toast.success(`Location set: ${response.three_word_address}`);
            }
        } catch (error) {
            console.error('What3Words error:', error);
            toast.error("Failed to get What3Words address");
        }
    };

    const MapModal = () => {
        useEffect(() => {
            if (showMap && mapRef.current && !mapInstance.current) {
                // Initialize Leaflet map
                mapInstance.current = window.L.map(mapRef.current).setView([mapCenter.lat, mapCenter.lng], 18);
                
                // Add satellite tiles (Esri World Imagery)
                window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                }).addTo(mapInstance.current);

                // Add initial marker if location is selected
                if (selectedLocation) {
                    markerRef.current = window.L.marker([selectedLocation.lat, selectedLocation.lng], {
                        draggable: true
                    }).addTo(mapInstance.current);

                    // Handle marker drag
                    markerRef.current.on('dragend', function(e) {
                        const position = e.target.getLatLng();
                        handleMapClick(position.lat, position.lng);
                    });
                }

                // Handle map clicks
                mapInstance.current.on('click', function(e) {
                    const { lat, lng } = e.latlng;
                    
                    // Remove existing marker
                    if (markerRef.current) {
                        mapInstance.current.removeLayer(markerRef.current);
                    }
                    
                    // Add new marker
                    markerRef.current = window.L.marker([lat, lng], {
                        draggable: true
                    }).addTo(mapInstance.current);

                    // Handle marker drag
                    markerRef.current.on('dragend', function(e) {
                        const position = e.target.getLatLng();
                        handleMapClick(position.lat, position.lng);
                    });

                    handleMapClick(lat, lng);
                });
            }
        }, [showMap, mapCenter]);

        // Cleanup map when modal closes
        useEffect(() => {
            if (!showMap && mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                markerRef.current = null;
            }
        }, [showMap]);

        if (!showMap) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-v3-bg-card rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-v3-border">
                        <div className="flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-v3-orange" />
                            <h3 className="text-lg font-semibold text-v3-text-lightest">Select Entrance Location</h3>
                        </div>
                        <button 
                            onClick={() => setShowMap(false)}
                            className="p-1 hover:bg-v3-bg-dark rounded"
                        >
                            <X className="w-5 h-5 text-v3-text-muted" />
                        </button>
                    </div>
                    
                    <div className="p-4 border-b border-v3-border bg-v3-bg-dark">
                        <p className="text-sm text-v3-text-muted mb-2">
                            <strong className="text-v3-orange">Address:</strong> {formData.address}
                        </p>
                        <p className="text-xs text-v3-text-muted">
                            Click on the map to mark the exact entrance location. The pin can be dragged to fine-tune the position.
                        </p>
                        {formData.what3words_address && (
                            <p className="text-sm text-green-400 mt-2">
                                <strong>What3Words:</strong> {formData.what3words_address}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex-1 relative">
                        <div 
                            ref={mapRef}
                            className="w-full h-full rounded-b-lg"
                            style={{ minHeight: '400px' }}
                        />
                        
                        <div className="absolute bottom-4 right-4 bg-v3-bg-card border border-v3-border rounded-lg p-3 max-w-xs">
                            <p className="text-xs text-v3-text-muted">
                                Use satellite view to identify the correct entrance. 
                                The What3Words location will be automatically generated.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (parseInt(formData.agents_required) <= 0) {
                toast.error("Agents required must be a positive number.");
                setLoading(false);
                return;
            }
            if (new Date(formData.arrival_time) < new Date()) {
                toast.error("Arrival time cannot be in the past.");
                setLoading(false);
                return;
            }

            const response = await apiCall('/jobs', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    agents_required: parseInt(formData.agents_required, 10),
                    hourly_rate: 0, // Set to 0 since agents handle their own rates
                }),
            });
            
            toast.success('Job Created Successfully', {
                description: response.message,
            });
            
            setFormData({
                title: '', 
                job_type: 'Traveller Eviction', 
                address: '',
                arrival_time: '', 
                agents_required: '1', 
                instructions: '', 
                what3words_address: '',
                urgency_level: 'medium',
            });
            setSelectedLocation(null);

        } catch (err) {
            toast.error('Failed to Create Job', {
                description: err.message || 'An unknown error occurred.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-v3-bg-darkest">
            <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center shadow-lg">
                            <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-v3-text-lightest">Create Job</h1>
                            <p className="text-v3-text-muted">Fill out the form to create and assign a new job</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Job Title */}
                    <div className="dashboard-card p-6">
                        <label htmlFor="title" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                            <Briefcase className="w-4 h-4 text-v3-orange" />
                            Job Title
                        </label>
                        <input 
                            type="text" 
                            id="title" 
                            name="title" 
                            value={formData.title} 
                            onChange={handleChange} 
                            required 
                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                        />
                    </div>

                    {/* Address & Location */}
                    <div className="dashboard-card p-6">
                        <label htmlFor="address" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                            <MapPin className="w-4 h-4 text-v3-orange" />
                            Full Address
                        </label>
                        <div className="space-y-3">
                            <input 
                                type="text" 
                                id="address" 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                required 
                                className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                            />
                            
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={openLocationSelector}
                                    disabled={!formData.address.trim() || mapLoading}
                                    className="button-refresh flex items-center gap-2 px-4 py-2 disabled:opacity-50"
                                >
                                    {mapLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Navigation className="w-4 h-4" />
                                    )}
                                    Select Entrance Location
                                </button>
                                
                                {formData.what3words_address && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-sm text-green-400 font-mono">
                                            {formData.what3words_address}
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            <p className="text-xs text-v3-text-muted">
                                Select the exact entrance location for agents to find the precise meeting point using What3Words.
                            </p>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="dashboard-card p-6">
                        <label htmlFor="arrival_time" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                            <Calendar className="w-4 h-4 text-v3-orange" />
                            Arrival Date & Time
                        </label>
                        <input 
                            type="datetime-local" 
                            id="arrival_time" 
                            name="arrival_time" 
                            value={formData.arrival_time} 
                            onChange={handleChange} 
                            required 
                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                        />
                    </div>

                    {/* Job Type & Agents (Responsive Grid) */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="dashboard-card p-6">
                            <label htmlFor="job_type" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                                <Briefcase className="w-4 h-4 text-v3-orange" />
                                Job Type
                            </label>
                            <select 
                                id="job_type" 
                                name="job_type" 
                                value={formData.job_type} 
                                onChange={handleChange} 
                                className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                            >
                                <option value="Traveller Eviction">Traveller Eviction</option>
                                <option value="Squatter Eviction">Squatter Eviction</option>
                                <option value="Traveller Serve Notice">Traveller Serve Notice</option>
                                <option value="Squatter Serve Notice">Squatter Serve Notice</option>
                                <option value="Security">Security</option>
                            </select>
                        </div>

                        <div className="dashboard-card p-6">
                            <label htmlFor="agents_required" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                                <Users className="w-4 h-4 text-v3-orange" />
                                Agents Required
                            </label>
                            <input 
                                type="number" 
                                id="agents_required" 
                                name="agents_required" 
                                value={formData.agents_required} 
                                onChange={handleChange} 
                                required 
                                className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all" 
                                min="1" 
                            />
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="dashboard-card p-6">
                        <label htmlFor="instructions" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                            <MessageSquare className="w-4 h-4 text-v3-orange" />
                            Instructions for Agents
                        </label>
                        <textarea 
                            id="instructions" 
                            name="instructions" 
                            value={formData.instructions} 
                            onChange={handleChange} 
                            rows="4" 
                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button 
                            type="submit" 
                            className="button-refresh w-full flex items-center justify-center gap-3 py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed" 
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            {loading ? 'Creating Job...' : 'Create & Assign Job'}
                        </button>
                    </div>
                </form>

                {/* Map Modal */}
                <MapModal />
            </div>
        </main>
    );
};

export default CreateJob;