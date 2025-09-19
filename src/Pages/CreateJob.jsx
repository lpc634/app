import React, { useState } from 'react';
import { useAuth } from "../useAuth";
import { toast } from 'sonner';
import { Briefcase, MapPin, Calendar, Users, MessageSquare, Send, Loader2, Navigation, ExternalLink, DollarSign } from 'lucide-react';
import { extractUkPostcode } from '../utils/ukPostcode';
import { Switch } from '@/components/ui/switch.jsx';
import AgentMultiSelect from '@/components/forms/AgentMultiSelect.jsx';
import LocationPicker from '@/components/LocationPicker.jsx';

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
    const [notifyAll, setNotifyAll] = useState(true);
    const [selectedAgents, setSelectedAgents] = useState([]);
    const [locationPickerOpen, setLocationPickerOpen] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const openLocationSelector = () => {
        const full = (formData.address || '').trim();
        if (!full) {
            toast.error("Please enter a full address first");
            return;
        }
        setLocationPickerOpen(true);
    };

    const handleLocationChange = (next) => {
        const lat = Number(next?.lat);
        const lng = Number(next?.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            setFormData((prev) => ({
                ...prev,
                location_lat: '',
                location_lng: '',
                maps_link: ''
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            location_lat: lat.toString(),
            location_lng: lng.toString(),
            maps_link: next?.maps_link || `https://www.google.com/maps?q=${lat},${lng}`
        }));
    };

    const parseCoordinate = (value) => {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
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

            // Notification targeting (admins only)
            const notifyPayload = (user?.role === 'admin' || user?.role === 'manager') ? {
                notify_all: Boolean(notifyAll),
                notify_agents: notifyAll ? [] : selectedAgents.map(id => Number(id))
            } : {};

            const response = await apiCall('/jobs', {
                method: 'POST',
                body: JSON.stringify({ ...jobData, ...notifyPayload }),
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
            setNotifyAll(true);
            setSelectedAgents([]);
            setLocationPickerOpen(false);
            
            // Reset billing data
            setBillingData({
                hourly_rate_net: '',
                first_hour_rate_net: '',
                notice_fee_net: '',
                vat_rate: '0.20',
                agent_count: '',
                billable_hours_override: ''
            });
            

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
                            
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={openLocationSelector}
                                    disabled={!formData.address.trim()}
                                    className="button-refresh flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Navigation className="w-4 h-4" />
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

                                {/* Detected Postcode chip */}
                                {extractUkPostcode(formData.address || '') && (
                                    <div className="px-3 py-2 bg-v3-bg-dark border border-v3-border rounded-lg text-xs text-v3-text-lightest">
                                        Detected Postcode: <span className="text-v3-orange font-semibold">{extractUkPostcode(formData.address)}</span>
                                    </div>
                                )}
                            </div>
                            
                            <p className="text-xs text-v3-text-muted">
                                Pin is based on the postcode extracted from the address. You can drag to refine.
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
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
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
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
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
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
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
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
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
                                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
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

                    {/* Notifications Targeting (Admin Only) */}
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <div className="dashboard-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-semibold text-v3-text-lightest">Send to all agents</p>
                                    <p className="text-xs text-v3-text-muted">Turn off to choose specific agents.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {/* Primary control */}
                                  <Switch checked={notifyAll} onCheckedChange={setNotifyAll} />
                                  {/* Fallback explicit controls for visibility */}
                                  <div className="flex items-center gap-3 text-xs">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name="notifyMode" checked={notifyAll} onChange={() => setNotifyAll(true)} />
                                      <span>All</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name="notifyMode" checked={!notifyAll} onChange={() => setNotifyAll(false)} />
                                      <span>Selected</span>
                                    </label>
                                  </div>
                                </div>
                            </div>
                            {!notifyAll && (
                                <AgentMultiSelect value={selectedAgents} onChange={setSelectedAgents} />
                            )}
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

                <LocationPicker
                    isOpen={locationPickerOpen}
                    onClose={() => setLocationPickerOpen(false)}
                    address={formData.address}
                    postcode={extractUkPostcode(formData.address || '')}
                    value={{
                        lat: parseCoordinate(formData.location_lat),
                        lng: parseCoordinate(formData.location_lng),
                        maps_link: formData.maps_link
                    }}
                    onChange={handleLocationChange}
                />
            </div>
        </main>
    );
};

export default CreateJob;




