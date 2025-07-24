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
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-v3-orange/10 rounded-full mb-4">
                    <Briefcase className="w-8 h-8 text-v3-orange" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-v3-text-lightest to-v3-orange bg-clip-text text-transparent">Create a New Job</h1>
                <p className="text-muted-foreground mt-2">Fill out the details below to create and assign a new job to available agents.</p>
            </div>

            <form onSubmit={handleSubmit} className="dashboard-card p-8 space-y-8 shadow-2xl border border-v3-border/50">
                <div className="group">
                    <div className="flex items-start space-x-4 p-4 rounded-lg border border-transparent group-hover:border-v3-orange/20 transition-all duration-200">
                        <div className="flex items-center justify-center w-10 h-10 bg-v3-orange/10 rounded-lg group-hover:bg-v3-orange/20 transition-colors">
                            <Briefcase className="w-5 h-5 text-v3-orange" />
                        </div>
                        <div className="flex-grow">
                            <label htmlFor="title" className="block text-sm font-semibold text-v3-text-lightest mb-2">Job Title</label>
                            <input 
                                type="text" 
                                id="title" 
                                name="title" 
                                value={formData.title} 
                                onChange={handleChange} 
                                required 
                                className="input-field focus:ring-2 focus:ring-v3-orange/50 focus:border-v3-orange transition-all" 
                            />
                        </div>
                    </div>
                </div>

                <div className="group">
                    <div className="flex items-start space-x-4 p-4 rounded-lg border border-transparent group-hover:border-v3-orange/20 transition-all duration-200">
                        <div className="flex items-center justify-center w-10 h-10 bg-v3-orange/10 rounded-lg group-hover:bg-v3-orange/20 transition-colors">
                            <MapPin className="w-5 h-5 text-v3-orange" />
                        </div>
                        <div className="flex-grow">
                            <label htmlFor="address" className="block text-sm font-semibold text-v3-text-lightest mb-2">Full Address</label>
                            <input 
                                type="text" 
                                id="address" 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                required 
                                className="input-field focus:ring-2 focus:ring-v3-orange/50 focus:border-v3-orange transition-all" 
                            />
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="group">
                        <div className="flex items-start space-x-4 p-4 rounded-lg border border-transparent group-hover:border-v3-orange/20 transition-all duration-200">
                            <div className="flex items-center justify-center w-10 h-10 bg-v3-orange/10 rounded-lg group-hover:bg-v3-orange/20 transition-colors">
                                <Calendar className="w-5 h-5 text-v3-orange" />
                            </div>
                            <div className="flex-grow">
                                <label htmlFor="arrival_time" className="block text-sm font-semibold text-v3-text-lightest mb-2">Arrival Date & Time</label>
                                <input 
                                    type="datetime-local" 
                                    id="arrival_time" 
                                    name="arrival_time" 
                                    value={formData.arrival_time} 
                                    onChange={handleChange} 
                                    required 
                                    className="input-field focus:ring-2 focus:ring-v3-orange/50 focus:border-v3-orange transition-all" 
                                />
                            </div>
                        </div>
                    </div>
                    <div className="group">
                        <div className="flex items-start space-x-4 p-4 rounded-lg border border-transparent group-hover:border-v3-orange/20 transition-all duration-200">
                            <div className="flex items-center justify-center w-10 h-10 bg-v3-orange/10 rounded-lg group-hover:bg-v3-orange/20 transition-colors">
                                <Briefcase className="w-5 h-5 text-v3-orange" />
                            </div>
                             <div className="flex-grow">
                                <label htmlFor="job_type" className="block text-sm font-semibold text-v3-text-lightest mb-2">Job Type</label>
                                <select id="job_type" name="job_type" value={formData.job_type} onChange={handleChange} className="input-field focus:ring-2 focus:ring-v3-orange/50 focus:border-v3-orange transition-all">
                                    <option value="Security">Security</option>
                                    <option value="Traveller Eviction">Traveller Eviction</option>
                                    <option value="Squatter Eviction">Squatter Eviction</option>
                                    <option value="Traveller Serve Notice">Traveller Serve Notice</option>
                                    <option value="Squatter Serve Notice">Squatter Serve Notice</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="group max-w-md">
                    <div className="flex items-start space-x-4 p-4 rounded-lg border border-transparent group-hover:border-v3-orange/20 transition-all duration-200">
                        <div className="flex items-center justify-center w-10 h-10 bg-v3-orange/10 rounded-lg group-hover:bg-v3-orange/20 transition-colors">
                            <Users className="w-5 h-5 text-v3-orange" />
                        </div>
                        <div className="flex-grow">
                            <label htmlFor="agents_required" className="block text-sm font-semibold text-v3-text-lightest mb-2">Agents Required</label>
                            <input 
                                type="number" 
                                id="agents_required" 
                                name="agents_required" 
                                value={formData.agents_required} 
                                onChange={handleChange} 
                                required 
                                className="input-field focus:ring-2 focus:ring-v3-orange/50 focus:border-v3-orange transition-all" 
                                min="1" 
                            />
                        </div>
                    </div>
                </div>
                
                <div className="group">
                    <div className="flex items-start space-x-4 p-4 rounded-lg border border-transparent group-hover:border-v3-orange/20 transition-all duration-200">
                        <div className="flex items-center justify-center w-10 h-10 bg-v3-orange/10 rounded-lg group-hover:bg-v3-orange/20 transition-colors mt-1">
                            <MessageSquare className="w-5 h-5 text-v3-orange" />
                        </div>
                        <div className="flex-grow">
                            <label htmlFor="instructions" className="block text-sm font-semibold text-v3-text-lightest mb-2">Instructions for Agents</label>
                            <textarea 
                                id="instructions" 
                                name="instructions" 
                                value={formData.instructions} 
                                onChange={handleChange} 
                                rows="4" 
                                className="input-field focus:ring-2 focus:ring-v3-orange/50 focus:border-v3-orange transition-all resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>
                
                <div className="pt-6 border-t border-v3-border/50 flex justify-end">
                    <button 
                        type="submit" 
                        className="button-refresh bg-gradient-to-r from-v3-orange to-orange-600 hover:from-v3-orange/90 hover:to-orange-600/90 w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 rounded-lg font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200" 
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        {loading ? 'Creating Job...' : 'Create & Assign Job'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateJob;