import React, { useState } from 'react';
import { useAuth } from "../useAuth";
import { toast } from 'sonner';
import { Briefcase, MapPin, Calendar, Users, MessageSquare, Send, Loader2 } from 'lucide-react';

const CreateJob = () => {
    const { apiCall } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        job_type: 'Security',
        address: '',
        arrival_time: '',
        agents_required: '1',
        instructions: '',
        urgency_level: 'medium',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
                job_type: 'Security', 
                address: '',
                arrival_time: '', 
                agents_required: '1', 
                instructions: '', 
                urgency_level: 'medium',
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

                    {/* Address */}
                    <div className="dashboard-card p-6">
                        <label htmlFor="address" className="flex items-center gap-2 text-sm font-semibold text-v3-text-lightest mb-4">
                            <MapPin className="w-4 h-4 text-v3-orange" />
                            Full Address
                        </label>
                        <input 
                            type="text" 
                            id="address" 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            required 
                            className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:outline-none focus:ring-2 focus:ring-v3-orange-glow transition-all"
                        />
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
                                <option value="Security">Security</option>
                                <option value="Traveller Eviction">Traveller Eviction</option>
                                <option value="Squatter Eviction">Squatter Eviction</option>
                                <option value="Traveller Serve Notice">Traveller Serve Notice</option>
                                <option value="Squatter Serve Notice">Squatter Serve Notice</option>
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
            </div>
        </main>
    );
};

export default CreateJob;