import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from "../useAuth";
import { toast } from 'sonner';
import { Briefcase, MapPin, Calendar, Users, MessageSquare, Send, Loader2, Navigation, X, ExternalLink, DollarSign } from 'lucide-react';

const CreateJob = () => {
    const { apiCall, user } = useAuth();
    const [formData, setFormData] = useState({
        job_type: 'Traveller Eviction',
        address: '',
        arrival_time: '',
        agents_required: '1',
        instructions: '',
        location_lat: '',
        location_lng: '',
        maps_link: '',
        urgency_level: 'medium',
    });

    const [billingData, setBillingData] = useState({
        hourly_rate_net: '',
        first_hour_rate_net: '',
        notice_fee_net: '',
        vat_rate: '0.20',
        agent_count: '',
        billable_hours_override: ''
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

    const generateGoogleMapsLink = (lat, lng) => {
        // Generate Google Maps link that opens in phone's navigation app
        return `https://www.google.com/maps?q=${lat},${lng}&z=18`;
    };

    const handleMapClick = async (lat, lng) => {
        setSelectedLocation({ lat, lng });
        
        // Generate Google Maps link
        const mapsLink = generateGoogleMapsLink(lat, lng);
        
        setFormData(prev => ({ 
            ...prev, 
            location_lat: lat.toString(),
            location_lng: lng.toString(),
            maps_link: mapsLink
        }));
        
        toast.success(`Entrance location set! Google Maps link generated.`);
    };

    const MapModal = () => {
        useEffect(() => {
            if (showMap && mapRef.current && !mapInstance.current) {
                // Initialize Leaflet map
                mapInstance.current = window.L.map(mapRef.current).setView([mapCenter.lat, mapCenter.lng], 18);
                
                // Define tile layers
                const satelliteLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                    id: 'satellite'
                });
                
                const streetLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
                    id: 'street'
                });
                
                const labelsLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Labels &copy; Esri',
                    id: 'labels'
                });
                
                // Store layer references for control
                mapInstance.current._satelliteLayer = satelliteLayer;
                mapInstance.current._streetLayer = streetLayer;
                mapInstance.current._labelsLayer = labelsLayer;
                mapInstance.current._currentView = 'satellite';
                
                // Add initial satellite layer
                satelliteLayer.addTo(mapInstance.current);
                labelsLayer.addTo(mapInstance.current);
                
                // Create custom map view control
                const MapViewControl = window.L.Control.extend({
                    onAdd: function(map) {
                        const container = window.L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                        container.style.cssText = `
                            background: var(--v3-bg-card);
                            border: 1px solid var(--v3-border);
                            border-radius: 8px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                            overflow: hidden;
                        `;
                        
                        const button = window.L.DomUtil.create('button', '', container);
                        button.innerHTML = 'Street';
                        button.style.cssText = `
                            background: transparent;
                            border: none;
                            padding: 8px 12px;
                            color: var(--v3-text-lightest);
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            min-width: 60px;
                            min-height: 44px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        `;
                        
                        button.onmouseover = function() {
                            this.style.backgroundColor = 'var(--v3-orange)';
                            this.style.color = 'white';
                        };
                        
                        button.onmouseout = function() {
                            this.style.backgroundColor = 'transparent';
                            this.style.color = 'var(--v3-text-lightest)';
                        };
                        
                        button.onclick = function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            if (map._currentView === 'satellite') {
                                // Switch to street view
                                map.removeLayer(map._satelliteLayer);
                                map.removeLayer(map._labelsLayer);
                                map._streetLayer.addTo(map);
                                map._currentView = 'street';
                                button.innerHTML = 'Satellite';
                            } else {
                                // Switch to satellite view
                                map.removeLayer(map._streetLayer);
                                map._satelliteLayer.addTo(map);
                                map._labelsLayer.addTo(map);
                                map._currentView = 'satellite';
                                button.innerHTML = 'Street';
                            }
                        };
                        
                        // Prevent map interactions when clicking control
                        window.L.DomEvent.disableClickPropagation(container);
                        window.L.DomEvent.disableScrollPropagation(container);
                        
                        return container;
                    },
                    
                    onRemove: function(map) {
                        // Cleanup if needed
                    }
                });
                
                // Add control to map
                const mapViewControl = new MapViewControl({ position: 'topright' });
                mapViewControl.addTo(mapInstance.current);

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
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--v3-bg-darkest)' }}>
                <div className="rounded-lg w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl" style={{ 
                    backgroundColor: 'var(--v3-bg-card)', 
                    border: '1px solid var(--v3-border)' 
                }}>
                    <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--v3-border)' }}>
                        <div className="flex items-center gap-2">
                            <Navigation className="w-5 h-5" style={{ color: 'var(--v3-orange)' }} />
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--v3-text-lightest)' }}>Select Entrance Location</h3>
                        </div>
                        <button 
                            onClick={() => setShowMap(false)}
                            className="p-2 rounded transition-colors"
                            style={{ color: 'var(--v3-text-muted)' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--v3-bg-dark)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-4" style={{ 
                        borderBottom: '1px solid var(--v3-border)', 
                        backgroundColor: 'var(--v3-bg-dark)' 
                    }}>
                        <p className="text-sm mb-2" style={{ color: 'var(--v3-text-muted)' }}>
                            <strong style={{ color: 'var(--v3-orange)' }}>Address:</strong> {formData.address}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                            Click on the map to mark the exact entrance location. The pin can be dragged to fine-tune the position.
                        </p>
                        {formData.maps_link && (
    <div className="mt-3 p-4 rounded-lg" style={{ 
        backgroundColor: 'var(--v3-bg-card)', 
        border: '1px solid var(--v3-orange)',
        boxShadow: '0 0 15px rgba(255, 87, 34, 0.2)'
    }}>
        <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--v3-orange)' }}>
                <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
                <h4 className="font-semibold" style={{ color: 'var(--v3-orange)' }}>✓ Entrance Location Set</h4>
                <p className="text-sm" style={{ color: 'var(--v3-text-muted)' }}>
                    Agents will receive a Google Maps link to navigate directly to this location.
                </p>
            </div>
        </div>
        
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ 
            backgroundColor: 'var(--v3-bg-dark)', 
            border: '1px solid var(--v3-border)' 
        }}>
            <MapPin className="w-4 h-4" style={{ color: 'var(--v3-orange)' }} />
            <span className="text-sm" style={{ color: 'var(--v3-text-lightest)' }}>
                Coordinates: {parseFloat(formData.location_lat).toFixed(6)}, {parseFloat(formData.location_lng).toFixed(6)}
            </span>
            <a 
                href={formData.maps_link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-auto transition-colors"
                style={{ color: 'var(--v3-orange)' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--v3-orange-dark)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--v3-orange)'}
                title="Test navigation link"
            >
                <ExternalLink className="w-4 h-4" />
            </a>
        </div>
    </div>
)}
                    </div>
                    
                    <div className="flex-1 relative">
                        <div 
                            ref={mapRef}
                            className="w-full h-full rounded-b-lg"
                            style={{ minHeight: '400px' }}
                        />
                        
                        <div className="absolute bottom-4 right-4 rounded-lg p-3 max-w-xs" style={{ 
                            backgroundColor: 'var(--v3-bg-card)', 
                            border: '1px solid var(--v3-border)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                        }}>
                            <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                                Switch between satellite and street views using the control above. 
                                Click to mark the exact entrance location.
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
            // Past-dated jobs are allowed (for backfilling fast jobs)

            // Prepare job data
            const jobData = {
                ...formData,
                agents_required: parseInt(formData.agents_required, 10),
                hourly_rate: 0, // Set to 0 since agents handle their own rates
            };

            // Add billing data if user is admin and billing fields are filled
            if ((user?.role === 'admin' || user?.role === 'manager') && billingData.hourly_rate_net) {
                const billing = {};
                if (billingData.hourly_rate_net) billing.hourly_rate_net = parseFloat(billingData.hourly_rate_net);
                if (billingData.first_hour_rate_net) billing.first_hour_rate_net = parseFloat(billingData.first_hour_rate_net);
                if (billingData.notice_fee_net) billing.notice_fee_net = parseFloat(billingData.notice_fee_net);
                if (billingData.vat_rate) billing.vat_rate = parseFloat(billingData.vat_rate);
                if (billingData.agent_count) billing.agent_count = parseInt(billingData.agent_count);
                if (billingData.billable_hours_override) billing.billable_hours_override = parseFloat(billingData.billable_hours_override);
                
                jobData.billing = billing;
            }

            const response = await apiCall('/jobs', {
                method: 'POST',
                body: JSON.stringify(jobData),
            });
            
            toast.success('Job Created Successfully', {
                description: response.message,
            });
            
            // Reset form data
            setFormData({
                job_type: 'Traveller Eviction', 
                address: '',
                arrival_time: '', 
                agents_required: '1', 
                instructions: '', 
                location_lat: '',
                location_lng: '',
                maps_link: '',
                urgency_level: 'medium',
            });
            
            // Reset billing data
            setBillingData({
                hourly_rate_net: '',
                first_hour_rate_net: '',
                notice_fee_net: '',
                vat_rate: '0.20',
                agent_count: '',
                billable_hours_override: ''
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
                                
                                {formData.maps_link && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-sm text-green-400">
                                            Navigation link ready
                                        </span>
                                        <a 
                                            href={formData.maps_link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-green-400 hover:text-green-300"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                )}
                            </div>
                            
                            <p className="text-xs text-v3-text-muted">
                                Select the exact entrance location for agents to navigate to the precise meeting point using Google Maps.
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

                    {/* Billing Configuration (Admin Only) */}
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <div className="dashboard-card p-6">
                            <label className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                                <DollarSign className="w-4 h-4 text-v3-orange" />
                                Billing Configuration
                            </label>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-v3-text-light mb-2">
                                            Hourly Rate (Net) *
                                        </label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={billingData.hourly_rate_net}
                                            onChange={(e) => setBillingData({...billingData, hourly_rate_net: e.target.value})}
                                            placeholder="45.00"
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-v3-text-light mb-2">
                                            First Hour Rate (Net)
                                        </label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={billingData.first_hour_rate_net}
                                            onChange={(e) => setBillingData({...billingData, first_hour_rate_net: e.target.value})}
                                            placeholder="120.00"
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-v3-text-light mb-2">
                                            Notice Service Fee (Net)
                                        </label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={billingData.notice_fee_net}
                                            onChange={(e) => setBillingData({...billingData, notice_fee_net: e.target.value})}
                                            placeholder="75.00"
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-v3-text-light mb-2">
                                            VAT Rate
                                        </label>
                                        <select 
                                            value={billingData.vat_rate}
                                            onChange={(e) => setBillingData({...billingData, vat_rate: e.target.value})}
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                                        >
                                            <option value="0.00">0% (No VAT)</option>
                                            <option value="0.05">5%</option>
                                            <option value="0.20">20% (Standard)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-v3-text-light mb-2">
                                            Agent Count
                                        </label>
                                        <input 
                                            type="number"
                                            value={billingData.agent_count}
                                            onChange={(e) => setBillingData({...billingData, agent_count: e.target.value})}
                                            placeholder="3"
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-v3-text-light mb-2">
                                            Billable Hours Override
                                        </label>
                                        <input 
                                            type="number"
                                            step="0.25"
                                            value={billingData.billable_hours_override}
                                            onChange={(e) => setBillingData({...billingData, billable_hours_override: e.target.value})}
                                            placeholder="30.5"
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="text-xs text-v3-text-muted">
                                    <p>• Hourly Rate: Standard rate charged per hour</p>
                                    <p>• First Hour Rate: Premium rate for first hour per agent (optional)</p>
                                    <p>• Notice Fee: One-time fee per job (optional)</p>
                                    <p>• Billable Hours Override: Manual override for calculated hours (optional)</p>
                                </div>
                            </div>
                        </div>
                    )}

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