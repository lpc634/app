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
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Create a New Job</h1>
                <p className="text-muted-foreground">Fill out the details below to create and assign a new job.</p>
            </div>

            <form onSubmit={handleSubmit} className="dashboard-card p-6 space-y-6">
                <div className="flex items-start space-x-4">
                    <Briefcase className="w-6 h-6 text-v3-orange mt-1" />
                    <div className="flex-grow">
                        <label htmlFor="title" className="block text-sm font-medium text-v3-text-lightest mb-1">Job Title</label>
                        <input 
                            type="text" 
                            id="title" 
                            name="title" 
                            value={formData.title} 
                            onChange={handleChange} 
                            required 
                            className="input-field" 
                        />
                    </div>
                </div>

                <div className="flex items-start space-x-4">
                    <MapPin className="w-6 h-6 text-v3-orange mt-1" />
                    <div className="flex-grow">
                        <label htmlFor="address" className="block text-sm font-medium text-v3-text-lightest mb-1">Full Address</label>
                        <input 
                            type="text" 
                            id="address" 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            required 
                            className="input-field" 
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-4">
                        <Calendar className="w-6 h-6 text-v3-orange mt-1" />
                        <div className="flex-grow">
                            <label htmlFor="arrival_time" className="block text-sm font-medium text-v3-text-lightest mb-1">Arrival Date & Time</label>
                            <input 
                                type="datetime-local" 
                                id="arrival_time" 
                                name="arrival_time" 
                                value={formData.arrival_time} 
                                onChange={handleChange} 
                                required 
                                className="input-field" 
                            />
                        </div>
                    </div>
                    <div className="flex items-start space-x-4">
                        <Briefcase className="w-6 h-6 text-v3-orange mt-1" />
                         <div className="flex-grow">
                            <label htmlFor="job_type" className="block text-sm font-medium text-v3-text-lightest mb-1">Job Type</label>
                            <select id="job_type" name="job_type" value={formData.job_type} onChange={handleChange} className="input-field">
                                <option value="Security">Security</option>
                                <option value="Traveller Eviction">Traveller Eviction</option>
                                <option value="Squatter Eviction">Squatter Eviction</option>
                                <option value="Traveller Serve Notice">Traveller Serve Notice</option>
                                <option value="Squatter Serve Notice">Squatter Serve Notice</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-start space-x-4">
                    <Users className="w-6 h-6 text-v3-orange mt-1" />
                    <div className="flex-grow">
                        <label htmlFor="agents_required" className="block text-sm font-medium text-v3-text-lightest mb-1">Agents Required</label>
                        <input 
                            type="number" 
                            id="agents_required" 
                            name="agents_required" 
                            value={formData.agents_required} 
                            onChange={handleChange} 
                            required 
                            className="input-field" 
                            min="1" 
                        />
                    </div>
                </div>
                
                <div className="flex items-start space-x-4">
                    <MessageSquare className="w-6 h-6 text-v3-orange mt-1" />
                    <div className="flex-grow">
                        <label htmlFor="instructions" className="block text-sm font-medium text-v3-text-lightest mb-1">Instructions for Agents</label>
                        <textarea 
                            id="instructions" 
                            name="instructions" 
                            value={formData.instructions} 
                            onChange={handleChange} 
                            rows="4" 
                            className="input-field"
                        ></textarea>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-v3-border flex justify-end">
                    <button type="submit" className="button-refresh w-full sm:w-auto flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        {loading ? 'Creating Job...' : 'Create & Assign Job'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateJob;