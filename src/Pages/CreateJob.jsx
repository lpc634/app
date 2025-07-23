import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../useAuth.jsx';
import { Loader2, ArrowLeft, PlusCircle } from 'lucide-react';

const CreateJob = () => {
    const { apiCall } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        address: '',
        arrival_time: '',
        agents_required: '1',
        instructions: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await apiCall('/jobs', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    agents_required: parseInt(formData.agents_required, 10),
                }),
            });
            toast.success('Job Created!', { 
                description: result.job.notification_status 
            });
            // --- FIX: Changed redirect path ---
            navigate('/');
        } catch (error) {
            toast.error('Failed to create job', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <button onClick={() => navigate(-1)} className="flex items-center text-sm font-semibold text-gray-400 hover:text-white">
                        <ArrowLeft size={16} className="mr-2" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-white mt-2">Create New Job</h1>
                    <p className="text-gray-400">This will automatically notify all currently available agents.</p>
                </div>

                <form onSubmit={handleSubmit} className="dashboard-card p-6 rounded-lg shadow-lg space-y-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">Job Title</label>
                        <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-v3-orange focus:border-v3-orange" />
                    </div>
                    <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-1">Location / Address</label>
                        <input type="text" name="address" id="address" value={formData.address} onChange={handleChange} required className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-v3-orange focus:border-v3-orange" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="arrival_time" className="block text-sm font-medium text-gray-300 mb-1">Arrival Date & Time</label>
                            <input type="datetime-local" name="arrival_time" id="arrival_time" value={formData.arrival_time} onChange={handleChange} required className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-v3-orange focus:border-v3-orange" />
                        </div>
                        <div>
                            <label htmlFor="agents_required" className="block text-sm font-medium text-gray-300 mb-1">Agents Required</label>
                            <input type="number" name="agents_required" id="agents_required" min="1" value={formData.agents_required} onChange={handleChange} required className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-v3-orange focus:border-v3-orange" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="instructions" className="block text-sm font-medium text-gray-300 mb-1">Instructions / Notes</label>
                        <textarea name="instructions" id="instructions" value={formData.instructions} onChange={handleChange} rows="4" className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-v3-orange focus:border-v3-orange"></textarea>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button type="submit" disabled={loading} className="button-refresh flex items-center justify-center w-56">
                            {loading ? <Loader2 className="animate-spin" /> : <><PlusCircle className="mr-2" /> Create & Notify Agents</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateJob;