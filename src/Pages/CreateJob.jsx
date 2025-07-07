import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../useAuth.jsx'
import { toast } from 'sonner';
import { Loader2, PlusCircle, MapPin, X } from 'lucide-react';

// --- Reusable InputField component ---
const InputField = ({ label, name, value, onChange, type = 'text', required = false, placeholder }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder || `Enter ${label.toLowerCase()}`} className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest placeholder-gray-400 focus:outline-none focus:ring-v3-orange focus:border-v3-orange" />
    </div>
);

// --- Reusable SelectField component ---
const SelectField = ({ label, name, value, onChange, options, required = false }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <select id={name} name={name} value={value} onChange={onChange} required={required} className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange">
        {options.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
      </select>
    </div>
);

// --- Map Modal Component for setting precise location ---
const MapModal = ({ isOpen, onClose, address, onLocationConfirm }) => {
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const [map, setMap] = useState(null);
    const [currentW3W, setCurrentW3W] = useState('loading...');
    const [loading, setLoading] = useState(true);
    const { apiCall } = useAuth();

    useEffect(() => {
        if (isOpen && !map && window.L) {
            const mapInstance = window.L.map(mapRef.current).setView([51.505, -0.09], 13);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance);
            setMap(mapInstance);
        }
    }, [isOpen, map]);

    useEffect(() => {
        if (map && address) {
            setLoading(true);
            apiCall('/jobs/convert-address', { method: 'POST', body: JSON.stringify({ address }) })
                .then(data => {
                    const { lat, lon } = data.coordinates;
                    map.setView([lat, lon], 16);
                    if (markerRef.current) {
                        markerRef.current.setLatLng([lat, lon]);
                    } else {
                        const marker = window.L.marker([lat, lon], { draggable: true }).addTo(map);
                        markerRef.current = marker;

                        marker.on('dragend', function (event) {
                            const newLatLng = event.target.getLatLng();
                            updateW3W(newLatLng.lat, newLatLng.lng);
                        });
                    }
                    updateW3W(lat, lon);
                })
                .catch((error) => {
                    toast.error("Could not find location for the address.", { description: error.message });
                })
                .finally(() => setLoading(false));
        }
    }, [map, address, apiCall]);

    const updateW3W = async (lat, lon) => {
        setCurrentW3W('loading...');
        try {
            const result = await apiCall('/jobs/convert-coords-to-w3w', {
                method: 'POST',
                body: JSON.stringify({ lat, lng: lon })
            });
            if (result && result.w3w_address) {
                setCurrentW3W(result.w3w_address);
            } else {
                throw new Error("Invalid response from server.");
            }
        } catch (error) {
            console.error("what3words conversion failed:", error);
            setCurrentW3W('unavailable');
            toast.error("what3words lookup failed", { description: "Could not get a 3-word address for this location."});
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-v3-bg-card rounded-lg w-full max-w-4xl h-[80vh] flex flex-col p-4">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-v3-text-lightest">Set Precise Location</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <div ref={mapRef} className="w-full h-full rounded-md flex-grow bg-gray-700">
                    {loading && <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-10 w-10 text-v3-orange"/></div>}
                </div>
                <div className="flex justify-between items-center mt-4 flex-shrink-0">
                    <div className="text-v3-text-lightest">
                        <span className="font-bold">what3words:</span> ///{currentW3W}
                    </div>
                    <button onClick={() => onLocationConfirm(currentW3W)} disabled={currentW3W === 'loading...' || currentW3W === 'unavailable'} className="button-refresh">Confirm Location</button>
                </div>
            </div>
        </div>
    );
};


const CreateJob = () => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    job_type: 'Traveller Eviction',
    number_of_dwellings: '',
    police_liaison_required: false,
    address: '',
    postcode: '',
    what3words_address: '',
    arrival_time: '',
    agents_required: '1',
    lead_agent_name: '',
    instructions: '',
    urgency_level: 'Standard',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  
  const handleLocationConfirm = (w3w) => {
      setFormData(prev => ({...prev, what3words_address: w3w}));
      setIsMapOpen(false);
      toast.success("Precise location set!", { description: `what3words: ///${w3w}`});
  };

  const handleOpenMap = () => {
      if (!formData.address || !formData.postcode) {
          toast.error("Address Required", { description: "Please enter an address and postcode before setting the precise location."});
          return;
      }
      setIsMapOpen(true);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
          ...formData,
          agents_required: parseInt(formData.agents_required, 10),
          number_of_dwellings: parseInt(formData.number_of_dwellings, 10) || null,
      };
      
      // --- THIS IS THE CORRECTED LINE ---
      const result = await apiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      toast.success('Job created successfully!', { 
          description: result.job.notification_status || 'Notification status unknown.' 
      });

      // Clear the form
      setFormData({
        title: '', job_type: 'Traveller Eviction', number_of_dwellings: '', police_liaison_required: false, address: '', postcode: '', what3words_address: '', arrival_time: '', agents_required: '1', lead_agent_name: '', instructions: '', urgency_level: 'Standard',
      });
    } catch (error) {
      toast.error('Failed to create job', { description: error.message || 'Please check the details and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
        <MapModal 
            isOpen={isMapOpen} 
            onClose={() => setIsMapOpen(false)} 
            address={`${formData.address}, ${formData.postcode}`}
            onLocationConfirm={handleLocationConfirm}
        />
        <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest mb-6">Create New Job</h1>
        <form onSubmit={handleSubmit} className="dashboard-card max-w-4xl mx-auto p-8 space-y-6">
            <InputField label="Job Title" name="title" value={formData.title} onChange={handleChange} required />
            <InputField label="Full Address" name="address" value={formData.address} onChange={handleChange} required placeholder="e.g., 123 Main Street, Camberley"/>
            <InputField label="Postcode" name="postcode" value={formData.postcode} onChange={handleChange} required />
            
            <div className="p-4 border border-v3-border rounded-lg bg-v3-bg-card space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-semibold text-v3-text-lightest">Precise Location (what3words)</h3>
                        <p className="text-sm text-gray-400">
                            {formData.what3words_address ? `///${formData.what3words_address}` : 'Not set'}
                        </p>
                    </div>
                    <button type="button" onClick={handleOpenMap} className="button-refresh whitespace-nowrap flex items-center gap-2">
                        <MapPin size={16}/>
                        Set Precise Location on Map
                    </button>
                </div>
            </div>

            <SelectField label="Job Type" name="job_type" value={formData.job_type} onChange={handleChange} options={[
                { value: 'Traveller Eviction', label: 'Traveller Eviction'}, { value: 'Squatter Eviction', label: 'Squatter Eviction'}, { value: 'Traveller Serve Notice', label: 'Traveller Serve Notice'}, { value: 'Squatter Serve Notice', label: 'Squatter Serve Notice'}, { value: 'Abandoned Vehicle Notice', 'label': 'Abandoned Vehicle Notice'}, { value: 'Door Shift', label: 'Door Shift'},
            ]} required/>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Number of Dwellings (Est.)" name="number_of_dwellings" type="number" value={formData.number_of_dwellings} onChange={handleChange} />
                <div className="flex items-center pt-6">
                    <input type="checkbox" id="police_liaison_required" name="police_liaison_required" checked={formData.police_liaison_required} onChange={handleChange} className="h-5 w-5 rounded border-gray-300 text-v3-orange focus:ring-v3-orange bg-v3-bg-dark" />
                    <label htmlFor="police_liaison_required" className="ml-3 block text-sm font-medium text-gray-300">Police Liaison Required?</label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Agents Required" name="agents_required" type="number" value={formData.agents_required} onChange={handleChange} required />
                <InputField label="Arrival Date & Time" name="arrival_time" type="datetime-local" value={formData.arrival_time} onChange={handleChange} required />
            </div>

            <InputField label="Lead Agent (Optional)" name="lead_agent_name" value={formData.lead_agent_name} onChange={handleChange} />
            
            <div className="pt-4 flex justify-end">
                <button type="submit" className="button-refresh flex items-center gap-2" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                    {loading ? 'Creating Job...' : 'Create and Dispatch Job'}
                </button>
            </div>
      </form>
    </div>
  );
};

export default CreateJob;