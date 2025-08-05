import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, PlusCircle, X, MapPin, NotebookText, User, Calendar, Users, Car, Info, Plus } from 'lucide-react';


// --- Reusable UI Components ---
const Input = (props) => <input className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest placeholder-gray-400 focus:outline-none focus:ring-v3-orange focus:border-v3-orange text-base" style={{minHeight: '48px', fontSize: '16px'}} {...props} />;
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
    
    // Vehicle details state for modal
    const [modalVehicleDetails, setModalVehicleDetails] = useState({
        make: '',
        model: '',
        colour: ''
    });
    
    // DVLA lookup state for modal
    const [modalLookupLoading, setModalLookupLoading] = useState(false);
    const [modalVehicleLookupData, setModalVehicleLookupData] = useState(null);

    // DVLA lookup function for modal
    const performModalVehicleLookup = async (plateValue) => {
        if (!plateValue || plateValue.length < 7) return;
        
        setModalLookupLoading(true);
        try {
            console.log(`[DVLA Modal] Looking up vehicle: ${plateValue}`);
            const response = await apiCall(`/vehicles/lookup-cached/${plateValue.toUpperCase()}`);
            
            if (response.dvla_lookup) {
                setModalVehicleLookupData(response);
                setModalVehicleDetails({
                    make: response.make,
                    model: response.model,
                    colour: response.colour
                });
                toast.success('Vehicle details found automatically!');
            } else {
                setModalVehicleLookupData(null);
            }
        } catch (error) {
            console.log('[DVLA Modal] Auto-lookup failed:', error);
            setModalVehicleLookupData(null);
            
            // Enhanced modal error handling with specific messages
            if (error.message && error.message.includes('401')) {
                console.error('[DVLA Modal] Authentication failed - check API key');
            } else if (error.message && error.message.includes('404')) {
                console.log('[DVLA Modal] Vehicle not found in DVLA database');
            } else if (error.message && error.message.includes('429')) {
                toast.error('Vehicle lookup rate limited - please try again later');
            } else if (error.message && error.message.includes('503')) {
                toast.error('Vehicle lookup service temporarily unavailable');
            } else if (error.message && error.message.includes('timeout')) {
                toast.error('Vehicle lookup timed out - please try again');
            }
            // Most lookup failures are expected (invalid/unregistered plates) so no toast
        } finally {
            setModalLookupLoading(false);
        }
    };
    
    // Auto-lookup when plate changes in modal
    useEffect(() => {
        if (plate.length >= 7) {
            const timeoutId = setTimeout(() => {
                performModalVehicleLookup(plate);
            }, 1000);
            
            return () => clearTimeout(timeoutId);
        } else {
            setModalVehicleLookupData(null);
        }
    }, [plate]);

    useEffect(() => {
        if (!isOpen) {
            setPlate(''); setNotes(''); setAddress(''); setIsDangerous(false);
            setModalVehicleDetails({ make: '', model: '', colour: '' });
            setModalLookupLoading(false);
            setModalVehicleLookupData(null);
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
            
            // First, create the sighting
            const newSighting = await apiCall('/vehicles/sightings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            // Then, save vehicle details if any were provided
            const hasVehicleDetails = modalVehicleDetails.make || modalVehicleDetails.model || modalVehicleDetails.colour;
            if (hasVehicleDetails) {
                try {
                    await apiCall(`/vehicles/${plate.toUpperCase()}/details`, {
                        method: 'PUT',
                        body: JSON.stringify(modalVehicleDetails)
                    });
                } catch (vehicleError) {
                    console.warn('Vehicle details save failed:', vehicleError);
                    // Don't fail the whole operation if vehicle details fail
                }
            }
            
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
            className="fixed inset-0 z-[9999] flex justify-center items-start sm:items-center p-2 sm:p-4 overflow-y-auto modal-backdrop" 
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
            onClick={handleBackdropClick}
        >
            <div 
                className="relative z-[10000] rounded-lg shadow-2xl w-full max-w-sm sm:max-w-2xl border modal-content my-2 sm:my-0"
                style={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333333',
                    opacity: 1,
                    minHeight: 'fit-content',
                    maxHeight: '95vh'
                }}
            >
                {/* Header */}
                <div 
                    className="flex justify-between items-center p-3 sm:p-6 border-b"
                    style={{ 
                        backgroundColor: '#1a1a1a',
                        borderBottomColor: '#333333'
                    }}
                >
                    <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2 sm:gap-3" style={{ color: '#f5f5f5' }}>
                        <span 
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: '#FF5722' }}
                        >
                            <Plus className="w-4 h-4 text-white" />
                        </span>
                        Add New Sighting
                    </h2>
                    <button 
                        onClick={onClose}
                        className="transition-colors p-1 rounded-md"
                        style={{ color: '#888888' }}
                        onMouseEnter={e => e.target.style.color = '#f5f5f5'}
                        onMouseLeave={e => e.target.style.color = '#888888'}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Body */}
                <form 
                    onSubmit={handleSubmit} 
                    className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto"
                    style={{ backgroundColor: '#1a1a1a', maxHeight: 'calc(95vh - 180px)' }}
                >
                    {/* Registration Plate */}
                    <div>
                        <label 
                            className="block text-sm font-medium mb-2"
                            style={{ color: '#cccccc' }}
                        >
                            Registration Plate *
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={plate}
                                onChange={e => {
                                    setPlate(e.target.value.toUpperCase());
                                    if (errors.plate) setErrors(prev => ({ ...prev, plate: null }));
                                }}
                                required
                                className="w-full px-3 sm:px-4 py-3 rounded-lg focus:ring-1 transition-colors text-base"
                                style={{
                                    backgroundColor: '#242424',
                                    borderColor: errors.plate ? '#ef4444' : '#333333',
                                    color: '#f5f5f5',
                                    border: '1px solid',
                                    minHeight: '48px',
                                    fontSize: '16px' // Prevents zoom on iOS
                                }}
                                placeholder="Enter registration plate (e.g. AB12 CDE)"
                                autoComplete="off"
                                autoCapitalize="characters"
                            />
                            {modalLookupLoading && (
                                <div className="absolute right-3 top-3">
                                    <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                                </div>
                            )}
                        </div>
                        {errors.plate && (
                            <p className="mt-1 text-sm" style={{ color: '#ef4444' }}>{errors.plate}</p>
                        )}
                        
                        {/* DVLA Lookup Success Indicator - ENHANCED */}
                        {modalVehicleLookupData && (
                            <div className="mt-3 p-3 sm:p-4 bg-green-900 rounded-lg border border-green-600">
                                <p className="text-green-200 text-sm flex items-center gap-2 mb-3">
                                    ✅ <span className="font-medium">Vehicle found in DVLA database:</span>
                                </p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs mb-3">
                                    <div className="space-y-1">
                                        <p className="text-green-200"><strong>Make:</strong> {modalVehicleLookupData.make || 'Not specified'}</p>
                                        <p className="text-green-200"><strong>Model:</strong> {modalVehicleLookupData.model && modalVehicleLookupData.model.trim() ? modalVehicleLookupData.model.trim() : 'Not specified'}</p>
                                        <p className="text-green-200"><strong>Colour:</strong> {modalVehicleLookupData.colour || 'Not specified'}</p>
                                        {modalVehicleLookupData.year_of_manufacture && (
                                            <p className="text-green-200"><strong>Year:</strong> {modalVehicleLookupData.year_of_manufacture}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {modalVehicleLookupData.fuel_type && (
                                            <p className="text-green-200"><strong>Fuel:</strong> {modalVehicleLookupData.fuel_type}</p>
                                        )}
                                        {modalVehicleLookupData.engine_capacity && (
                                            <p className="text-green-200"><strong>Engine:</strong> {modalVehicleLookupData.engine_capacity}cc</p>
                                        )}
                                        {modalVehicleLookupData.tax_status && (
                                            <p className="text-green-200">
                                                <strong>Tax:</strong> 
                                                <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                                                    modalVehicleLookupData.tax_status === 'Taxed' ? 'bg-green-600' : 
                                                    modalVehicleLookupData.tax_status === 'SORN' ? 'bg-yellow-600' : 
                                                    'bg-red-600'
                                                }`}>
                                                    {modalVehicleLookupData.tax_status}
                                                </span>
                                            </p>
                                        )}
                                        {modalVehicleLookupData.mot_status && (
                                            <p className="text-green-200">
                                                <strong>MOT:</strong> 
                                                <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                                                    modalVehicleLookupData.mot_status === 'Valid' ? 'bg-green-600' : 'bg-red-600'
                                                }`}>
                                                    {modalVehicleLookupData.mot_status}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                <p className="text-green-300 text-xs">
                                    💡 Details automatically filled from DVLA - you can override these if needed
                                </p>
                            </div>
                        )}
                    </div>
                    
                    {/* Address */}
                    <div>
                        <label 
                            className="block text-sm font-medium mb-2"
                            style={{ color: '#cccccc' }}
                        >
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
                            className="w-full px-3 sm:px-4 py-3 rounded-lg focus:ring-1 transition-colors text-base"
                            style={{
                                backgroundColor: '#242424',
                                borderColor: errors.address ? '#ef4444' : '#333333',
                                color: '#f5f5f5',
                                border: '1px solid',
                                minHeight: '48px',
                                fontSize: '16px'
                            }}
                            placeholder="Location where vehicle was spotted"
                            autoComplete="street-address"
                        />
                        {errors.address && (
                            <p className="mt-1 text-sm" style={{ color: '#ef4444' }}>{errors.address}</p>
                        )}
                    </div>
                    
                    {/* Vehicle Details Input Section */}
                    <div 
                        className="rounded-lg p-4 space-y-4"
                        style={{ 
                            backgroundColor: '#242424', 
                            border: '1px solid #333333' 
                        }}
                    >
                        <h4 className="font-medium flex items-center gap-2" style={{ color: '#f5f5f5' }}>
                            <span 
                                className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                                style={{ backgroundColor: '#FF5722' }}
                            >
                                🚗
                            </span>
                            Vehicle Details
                            {modalVehicleLookupData && (
                                <span className="text-green-500 text-sm ml-2">(Auto-detected)</span>
                            )}
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                            <div>
                                <label 
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: '#cccccc' }}
                                >
                                    Make
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. BMW"
                                    value={modalVehicleDetails.make}
                                    onChange={e => setModalVehicleDetails({...modalVehicleDetails, make: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg transition-colors text-base"
                                    style={{
                                        backgroundColor: '#1a1a1a',
                                        borderColor: '#333333',
                                        color: '#f5f5f5',
                                        border: '1px solid',
                                        minHeight: '44px',
                                        fontSize: '16px'
                                    }}
                                    autoComplete="off"
                                />
                            </div>
                            
                            <div>
                                <label 
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: '#cccccc' }}
                                >
                                    Model
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 3 Series"
                                    value={modalVehicleDetails.model}
                                    onChange={e => setModalVehicleDetails({...modalVehicleDetails, model: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg transition-colors text-base"
                                    style={{
                                        backgroundColor: '#1a1a1a',
                                        borderColor: '#333333',
                                        color: '#f5f5f5',
                                        border: '1px solid',
                                        minHeight: '44px',
                                        fontSize: '16px'
                                    }}
                                    autoComplete="off"
                                />
                            </div>
                            
                            <div>
                                <label 
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: '#cccccc' }}
                                >
                                    Colour
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Blue"
                                    value={modalVehicleDetails.colour}
                                    onChange={e => setModalVehicleDetails({...modalVehicleDetails, colour: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg transition-colors text-base"
                                    style={{
                                        backgroundColor: '#1a1a1a',
                                        borderColor: '#333333',
                                        color: '#f5f5f5',
                                        border: '1px solid',
                                        minHeight: '44px',
                                        fontSize: '16px'
                                    }}
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        
                        <p className="text-sm" style={{ color: '#888888' }}>
                            💡 Vehicle details are automatically looked up from DVLA when you enter the registration plate. You can override these if needed.
                        </p>
                    </div>
                    
                    {/* Notes */}
                    <div>
                        <label 
                            className="block text-sm font-medium mb-2"
                            style={{ color: '#cccccc' }}
                        >
                            Notes
                        </label>
                        <textarea
                            rows="3"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 sm:px-4 py-3 rounded-lg transition-colors resize-vertical text-base"
                            style={{
                                backgroundColor: '#242424',
                                borderColor: '#333333',
                                color: '#f5f5f5',
                                border: '1px solid',
                                minHeight: '80px',
                                fontSize: '16px'
                            }}
                            placeholder="Describe the situation, individuals, or any relevant details"
                        />
                    </div>
                    
                    {/* Dangerous Checkbox */}
                    <div 
                        className="flex items-center gap-3 p-4 rounded-lg"
                        style={{ 
                            backgroundColor: '#242424', 
                            border: '1px solid #333333' 
                        }}
                    >
                        <input
                            type="checkbox"
                            id="isDangerousModal"
                            checked={isDangerous}
                            onChange={e => setIsDangerous(e.target.checked)}
                            className="w-4 h-4 rounded"
                            style={{
                                backgroundColor: '#242424',
                                borderColor: '#333333'
                            }}
                        />
                        <label 
                            htmlFor="isDangerousModal" 
                            className="text-sm font-medium flex items-center gap-2"
                            style={{ color: '#cccccc' }}
                        >
                            <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                            Mark as potentially dangerous
                        </label>
                    </div>
                </form>
                
                {/* Footer */}
                <div 
                    className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 p-3 sm:p-6 border-t"
                    style={{ 
                        backgroundColor: '#0f0f0f', 
                        borderTopColor: '#333333' 
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg transition-colors font-medium text-base"
                        style={{ 
                            backgroundColor: '#525252', 
                            color: 'white',
                            minHeight: '48px'
                        }}
                        onMouseEnter={e => e.target.style.backgroundColor = '#404040'}
                        onMouseLeave={e => e.target.style.backgroundColor = '#525252'}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-base"
                        style={{ 
                            backgroundColor: loading ? '#cc4400' : '#FF5722', 
                            color: 'white',
                            opacity: loading ? 0.5 : 1,
                            minHeight: '48px'
                        }}
                        onMouseEnter={e => !loading && (e.target.style.backgroundColor = '#E64A19')}
                        onMouseLeave={e => !loading && (e.target.style.backgroundColor = '#FF5722')}
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
    
    // Removed old vehicle details editing state - now using DVLA lookup only
    
    // DVLA Vehicle Lookup state
    const [vehicleLookupData, setVehicleLookupData] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [autoLookupEnabled, setAutoLookupEnabled] = useState(true);
    
    const { apiCall } = useAuth();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    
    // DVLA Vehicle Lookup Functions
    const performVehicleLookup = async (plate) => {
        if (!plate || plate.length < 6) {
            console.log(`[DVLA] Plate too short: ${plate}`);
            return;
        }
        
        console.log(`[DVLA] Starting lookup for vehicle: ${plate}`);
        setLookupLoading(true);
        
        try {
            const response = await apiCall(`/vehicles/lookup-cached/${plate.toUpperCase()}`);
            console.log(`[DVLA] Response received:`, response);
            
            if (response && response.dvla_lookup) {
                setVehicleLookupData(response);
                console.log(`[DVLA] SUCCESS - Vehicle found: ${response.make} ${response.model || ''} (${response.colour})`);
                toast.success(`Vehicle found: ${response.make} ${response.model || ''} (${response.colour})`);
            } else {
                console.log(`[DVLA] No vehicle data returned`);
                setVehicleLookupData(null);
            }
        } catch (error) {
            console.error('[DVLA] Vehicle lookup failed:', error);
            setVehicleLookupData(null);
            
            // Enhanced error handling with specific messages
            if (error.message && error.message.includes('401')) {
                console.error('[DVLA] Authentication failed - check API key');
            } else if (error.message && error.message.includes('404')) {
                console.log('[DVLA] Vehicle not found in DVLA database');
            } else if (error.message && error.message.includes('429')) {
                toast.error('Vehicle lookup rate limited - please try again later');
            } else if (error.message && error.message.includes('503')) {
                toast.error('Vehicle lookup service temporarily unavailable');
            } else if (error.message && error.message.includes('timeout')) {
                toast.error('Vehicle lookup timed out - please try again');
            }
        } finally {
            setLookupLoading(false);
        }
    };
    
    // Auto-lookup when plate is entered (with debounce)
    useEffect(() => {
        if (searchPlate.length >= 7 && autoLookupEnabled) {
            const timeoutId = setTimeout(() => {
                performVehicleLookup(searchPlate);
            }, 1000); // Wait 1 second after user stops typing
            
            return () => clearTimeout(timeoutId);
        } else {
            // Clear lookup data if plate is too short
            setVehicleLookupData(null);
        }
    }, [searchPlate, autoLookupEnabled]);

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
        
        const plate = searchPlate.trim().toUpperCase();
        console.log(`[Search] Starting search for plate: ${plate}`);
        
        setLoading(true);
        setHasSearched(true);
        setError('');
        setSightings([]);
        setSelectedSighting(null);
        setVehicleLookupData(null); // Reset previous lookup
        
        try {
            console.log(`[Search] Searching for existing sightings...`);
            // Perform sightings search
            const data = await apiCall(`/vehicles/${plate}`);
            setSightings(data);
            if (data.length > 0) {
                setSelectedSighting(data[0]);
                console.log(`[Search] Found ${data.length} sightings`);
            } else {
                setError('No records found for this registration plate.');
                console.log(`[Search] No sightings found`);
            }
            
        } catch (err) {
            console.error(`[Search] Sighting search failed:`, err);
            setSightings([]);
            setError(err.message.includes('404') ? 'No records found for this registration plate.' : 'An error occurred while searching.');
        }
        
        // ALWAYS do DVLA lookup regardless of sighting results
        console.log(`[Search] Starting DVLA lookup for: ${plate}`);
        try {
            await performVehicleLookup(plate);
        } catch (dvlaError) {
            console.error(`[Search] DVLA lookup failed:`, dvlaError);
        }
        
        setLoading(false);
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

    // Old vehicle details functions removed - now using DVLA lookup exclusively

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

    // No need to load vehicle details - using DVLA lookup instead
    
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
                    <form onSubmit={handleSearch} className="space-y-4">
                        {/* Search Input with Lookup Indicator */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input 
                                    value={searchPlate} 
                                    onChange={(e) => setSearchPlate(e.target.value.toUpperCase())} 
                                    placeholder="Enter registration plate (e.g. AB12 CDE)..." 
                                />
                                {lookupLoading && (
                                    <div className="absolute right-3 top-3">
                                        <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                                    </div>
                                )}
                            </div>
                            <Button type="submit" className="flex items-center justify-center gap-2 w-32" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : <><Search size={18}/> Search</>}
                            </Button>
                        </div>
                        
                        {/* DVLA Vehicle Lookup Results - COMPACT MOBILE-OPTIMIZED */}
                        {vehicleLookupData && (
                            <div className="bg-green-900 border border-green-600 rounded-lg p-3 mt-3">
                                {/* Compact Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✅</span>
                                        <span className="text-white font-medium text-sm">
                                            {(() => {
                                                const make = vehicleLookupData.make || 'Unknown Make';
                                                const model = vehicleLookupData.model && vehicleLookupData.model.trim() ? vehicleLookupData.model.trim() : '';
                                                const colour = vehicleLookupData.colour || 'Unknown Colour';
                                                const year = vehicleLookupData.year_of_manufacture || '';
                                                
                                                let display = make;
                                                if (model) display += ` ${model}`;
                                                if (colour) display += ` (${colour})`;
                                                if (year) display += ` - ${year}`;
                                                
                                                return display;
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs">
                                        <span className={`px-2 py-1 rounded ${
                                            vehicleLookupData.tax_status === 'Taxed' ? 'bg-green-600' : 
                                            vehicleLookupData.tax_status === 'SORN' ? 'bg-yellow-600' : 
                                            'bg-red-600'
                                        } text-white`}>
                                            {vehicleLookupData.tax_status || 'Unknown'}
                                        </span>
                                        <span className={`px-2 py-1 rounded ${
                                            vehicleLookupData.mot_status === 'Valid' ? 'bg-green-600' : 'bg-red-600'
                                        } text-white`}>
                                            MOT {vehicleLookupData.mot_status || 'Unknown'}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Expandable Details */}
                                <details className="mt-2">
                                    <summary className="text-green-300 text-sm cursor-pointer hover:text-green-200 flex items-center gap-1">
                                        📋 View Complete DVLA Details
                                    </summary>
                                    <div className="mt-3 pt-3 border-t border-green-700">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <h5 className="text-green-200 font-medium mb-1">⚙️ Engine & Fuel</h5>
                                                <p className="text-green-300">Fuel: {vehicleLookupData.fuel_type || 'Not specified'}</p>
                                                <p className="text-green-300">Engine: {vehicleLookupData.engine_capacity ? `${vehicleLookupData.engine_capacity}cc` : 'Not specified'}</p>
                                                <p className="text-green-300">CO2: {vehicleLookupData.co2_emissions ? `${vehicleLookupData.co2_emissions}g/km` : 'Not specified'}</p>
                                            </div>
                                            <div>
                                                <h5 className="text-green-200 font-medium mb-1">📋 Legal Status</h5>
                                                <p className="text-green-300">Tax Due: {vehicleLookupData.tax_due_date || 'Not specified'}</p>
                                                <p className="text-green-300">MOT Expires: {vehicleLookupData.mot_expiry_date || 'Not specified'}</p>
                                                <p className="text-green-300">Weight: {vehicleLookupData.revenue_weight ? `${vehicleLookupData.revenue_weight}kg` : 'Not specified'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                                
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-green-400 text-xs">
                                        🔗 Data from DVLA Official Database
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setAutoLookupEnabled(!autoLookupEnabled)}
                                        className="text-xs text-green-300 hover:text-green-100 underline"
                                    >
                                        {autoLookupEnabled ? 'Disable auto-lookup' : 'Enable auto-lookup'}
                                    </button>
                                </div>
                            </div>
                        )}
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
                                            
                                            {/* Vehicle Details Section - ENHANCED WITH DVLA DATA */}
                                            <div className="vehicle-details-section mb-6 p-4 bg-v3-bg-darker rounded-lg border border-v3-border">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Car className="text-v3-orange" size={18} />
                                                        <h4 className="font-semibold text-v3-text-lightest">Vehicle Details</h4>
                                                    </div>
                                                    {!vehicleLookupData && (
                                                        <button 
                                                            onClick={() => performVehicleLookup(selectedSighting.registration_plate)}
                                                            className="flex items-center gap-1 text-v3-orange text-sm hover:text-orange-400 transition-colors"
                                                            disabled={lookupLoading}
                                                        >
                                                            {lookupLoading ? (
                                                                <Loader2 className="animate-spin" size={14} />
                                                            ) : (
                                                                <Search size={14} />
                                                            )}
                                                            {lookupLoading ? 'Looking up...' : 'Lookup Details'}
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {vehicleLookupData ? (
                                                    // Show DVLA vehicle details
                                                    <div className="bg-v3-bg-dark rounded-lg p-3 border border-v3-border">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-lg font-medium text-v3-text-lightest">
                                                                {(() => {
                                                                    const make = vehicleLookupData.make || 'Unknown Make';
                                                                    const model = vehicleLookupData.model && vehicleLookupData.model.trim() ? vehicleLookupData.model.trim() : '';
                                                                    const colour = vehicleLookupData.colour || 'Unknown Colour';
                                                                    
                                                                    let display = make;
                                                                    if (model) display += ` ${model}`;
                                                                    if (colour) display += ` (${colour})`;
                                                                    
                                                                    return display;
                                                                })()}
                                                            </span>
                                                            <span className="text-v3-text-muted text-sm">{vehicleLookupData.year_of_manufacture}</span>
                                                        </div>
                                                        
                                                        <div className="flex gap-2 text-xs mb-2">
                                                            <span className={`px-2 py-1 rounded ${
                                                                vehicleLookupData.tax_status === 'Taxed' ? 'bg-green-600' : 
                                                                vehicleLookupData.tax_status === 'SORN' ? 'bg-yellow-600' : 
                                                                'bg-red-600'
                                                            } text-white`}>
                                                                {vehicleLookupData.tax_status || 'Unknown'}
                                                            </span>
                                                            <span className={`px-2 py-1 rounded ${
                                                                vehicleLookupData.mot_status === 'Valid' ? 'bg-green-600' : 'bg-red-600'
                                                            } text-white`}>
                                                                MOT {vehicleLookupData.mot_status || 'Unknown'}
                                                            </span>
                                                            {vehicleLookupData.fuel_type && (
                                                                <span className="px-2 py-1 rounded bg-blue-600 text-white">
                                                                    {vehicleLookupData.fuel_type}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Quick expand for more details */}
                                                        <details className="mt-2">
                                                            <summary className="text-v3-orange text-xs cursor-pointer hover:text-orange-400">More Details</summary>
                                                            <div className="mt-2 text-xs text-v3-text-muted space-y-1">
                                                                {vehicleLookupData.engine_capacity && (
                                                                    <p>Engine: {vehicleLookupData.engine_capacity}cc</p>
                                                                )}
                                                                {vehicleLookupData.co2_emissions && (
                                                                    <p>CO2: {vehicleLookupData.co2_emissions}g/km</p>
                                                                )}
                                                                {vehicleLookupData.mot_expiry_date && (
                                                                    <p>MOT Expires: {vehicleLookupData.mot_expiry_date}</p>
                                                                )}
                                                                {vehicleLookupData.tax_due_date && (
                                                                    <p>Tax Due: {vehicleLookupData.tax_due_date}</p>
                                                                )}
                                                                {vehicleLookupData.revenue_weight && (
                                                                    <p>Weight: {vehicleLookupData.revenue_weight}kg</p>
                                                                )}
                                                            </div>
                                                        </details>
                                                        
                                                        <p className="text-v3-orange text-xs mt-2">
                                                            🔗 Data from DVLA Official Database
                                                        </p>
                                                    </div>
                                                ) : (
                                                    // Fallback when no DVLA data available
                                                    <div className="bg-v3-bg-dark rounded-lg p-3 border border-v3-border border-dashed">
                                                        <span className="text-v3-text-muted text-sm flex items-center gap-2">
                                                            <Info size={16} />
                                                            Click "Lookup Details" to get vehicle information from DVLA
                                                        </span>
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