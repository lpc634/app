import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Send, PlusCircle, X, MapPin, NotebookText, User, Calendar, Users } from 'lucide-react';

// --- MOCK DATA (Car makes and models) ---
// In a real application, you would fetch this from an API.
const carData = {
  "Ford": ["Fiesta", "Focus", "Mustang", "Explorer"],
  "BMW": ["3 Series", "5 Series", "X5", "M3"],
  "Audi": ["A4", "A6", "Q5", "R8"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "G-Class"],
  "Vauxhall": ["Corsa", "Astra", "Insignia", "Mokka"]
};

// --- Reusable UI Components ---
const Input = (props) => (
    <input 
        className="w-full bg-white border border-gray-400 rounded-md shadow-sm py-2 px-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-transparent" 
        {...props} 
    />
);

// --- AddSightingModal Component ---
const AddSightingModal = ({ isOpen, onClose, onSightingAdded }) => {
    const { apiCall } = useAuth();
    const [plate, setPlate] = useState('');
    const [notes, setNotes] = useState('');
    const [address, setAddress] = useState('');
    const [isDangerous, setIsDangerous] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // New state for make/model
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedMake, setSelectedMake] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMakes(Object.keys(carData));
        } else {
            // Reset form when modal closes
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
        // Validation logic here...
        setLoading(true);
        try {
            const payload = {
                registration_plate: plate.toUpperCase(),
                notes,
                is_dangerous: isDangerous,
                address_seen: address,
                make: selectedMake,
                model: selectedModel
            };
            // This is where you would make the API call
            console.log("Submitting:", payload);
            toast.success("Sighting added successfully!");
            onSightingAdded(payload); // We'll simulate this for now
            onClose();
        } catch (error) {
            toast.error("Failed to add sighting.");
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

                    {isManualEntry ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Input value={selectedMake} onChange={e => setSelectedMake(e.target.value)} placeholder="Make" />
                            <Input value={selectedModel} onChange={e => setSelectedModel(e.target.value)} placeholder="Model" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <Select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} required>
                                <option value="">Select Make</option>
                                {makes.map(m => <option key={m} value={m}>{m}</option>)}
                            </Select>
                            <Select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} required disabled={!selectedMake}>
                                <option value="">Select Model</option>
                                {models.map(m => <option key={m} value={m}>{m}</option>)}
                            </Select>
                        </div>
                    )}

                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes on interaction, individuals, etc." required />
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


// --- GroupViewModal Component (Placeholder) ---
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
                        {/* This will be populated by real data later */}
                        <li className="bg-v3-bg-dark p-2 rounded-md font-mono">PLATE-123</li>
                        <li className="bg-v3-bg-dark p-2 rounded-md font-mono">PLATE-456</li>
                        <li className="bg-v3-bg-dark p-2 rounded-md font-mono">PLATE-789</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};


// --- VehicleSearchPage Main Component ---
const VehicleSearchPage = () => {
    // ... (existing state variables)
    const [searchPlate, setSearchPlate] = useState('');
    const [sightings, setSightings] = useState([]);
    const [selectedSighting, setSelectedSighting] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false); // New state for group modal
    const [hasSearched, setHasSearched] = useState(false);
    
    // ... (existing refs and functions: apiCall, mapRef, etc.)
    const { apiCall } = useAuth();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});

    // --- MOCK SEARCH FUNCTION ---
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchPlate) return;
        setLoading(true);
        setHasSearched(true);
        setError('');
        
        // Simulate API call
        setTimeout(() => {
            const mockSightings = [
                { id: 1, registration_plate: searchPlate.toUpperCase(), address_seen: 'Tesco, Camberley', sighted_at: new Date().toISOString(), agent_name: 'John Doe', notes: 'Vehicle was seen with two others.', is_dangerous: true, make: 'Ford', model: 'Transit' },
                { id: 2, registration_plate: searchPlate.toUpperCase(), address_seen: 'Meadows, Camberley', sighted_at: new Date(Date.now() - 86400000).toISOString(), agent_name: 'Jane Smith', notes: 'Driver was acting suspiciously.', is_dangerous: false, make: 'Ford', model: 'Transit' },
            ];
            setSightings(mockSightings);
            setSelectedSighting(mockSightings[0]);
            setLoading(false);
        }, 1000);
    };

    // ... (rest of the component logic)
    const handleSightingAdded = (newSighting) => {
        if (newSighting.registration_plate === searchPlate.toUpperCase()) {
            setSightings(prev => [newSighting, ...prev]);
        }
    };
    
    // Placeholder function to open group view
    const handleViewGroup = () => {
        setIsGroupModalOpen(true);
    };


    return (
        <>
            <AddSightingModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSightingAdded={handleSightingAdded} />
            <GroupViewModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />

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
                        {/* Sightings List */}
                        <div className="lg:col-span-1 bg-v3-bg-card rounded-lg flex flex-col overflow-hidden">
                           {/* ... list header ... */}
                           <div className="flex-grow overflow-y-auto">
                                {loading ? <div className="p-6 text-center">Loading...</div> : sightings.map(sighting => (
                                    <div key={sighting.id} onClick={() => setSelectedSighting(sighting)} className={`p-4 border-b border-v3-border cursor-pointer hover:bg-v3-bg-dark ${selectedSighting?.id === sighting.id ? 'bg-v3-bg-dark' : ''}`}>
                                        <p className="font-bold">{sighting.address_seen}</p>
                                        <p className="text-sm text-v3-text-muted">{new Date(sighting.sighted_at).toLocaleString()}</p>
                                    </div>
                                ))}
                           </div>
                        </div>
                        {/* Map & Details */}
                        <div className="lg:col-span-2 bg-v3-bg-card rounded-lg flex flex-col overflow-hidden">
                            <div ref={mapRef} className="flex-grow w-full h-1/2 min-h-[300px]" style={{backgroundColor: '#1a202c'}}></div>
                            {selectedSighting && (
                                 <div className="p-4 border-t border-v3-border">
                                     <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-xl text-v3-text-lightest">{selectedSighting.make} {selectedSighting.model}</h3>
                                            <p className="font-mono text-lg text-v3-text-light">{selectedSighting.registration_plate}</p>
                                        </div>
                                        <Button onClick={handleViewGroup} className="flex items-center gap-2 text-sm">
                                            <Users size={16} /> View Group
                                        </Button>
                                     </div>
                                     {/* ... rest of the details */}
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