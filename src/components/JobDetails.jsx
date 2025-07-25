import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { 
    Loader2, 
    ServerCrash, 
    ArrowLeft, 
    MapPin, 
    Clock, 
    Calendar, 
    Users, 
    Shield,
    Info,
    FileText,
    Navigation,
    AlertCircle,
    Cloud,
    Thermometer,
    ShirtIcon,
    Phone,
    Mail
} from 'lucide-react';

// This helper function is unchanged
const formatDateTime = (isoString) => {
    if (!isoString) return { date: 'N/A', time: 'N/A' };
    const date = new Date(isoString);
    return {
        date: date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
};

const JobDetails = () => {
    // The data fetching logic is unchanged
    const { jobId } = useParams();
    const { apiCall } = useAuth();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchJobDetails = async () => {
            try {
                setLoading(true);
                setError('');
                const data = await apiCall(`/jobs/${jobId}`);
                setJob(data);
            } catch (err) {
                setError(err.message || 'Failed to load job details.');
            } finally {
                setLoading(false);
            }
        };

        if (jobId) {
            fetchJobDetails();
        }
    }, [jobId, apiCall]);

    // The loading and error states are unchanged
    if (loading) {
        return <div className="p-8 text-center text-v3-text-muted"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500">
                <ServerCrash className="h-12 w-12 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Connection Error</h2>
                <p className="mb-4">{error}</p>
                <Link to="/agent/dashboard" className="button-refresh flex items-center gap-2 mx-auto">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </div>
        );
    }
    
    if (!job) {
        return (
            <div className="p-8 text-center">
                 <h2 className="text-xl font-bold mb-2">Job Not Found</h2>
                 <Link to="/agent/dashboard" className="button-refresh flex items-center gap-2 mx-auto">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </div>
        )
    }

    const { date, time } = formatDateTime(job.arrival_time);

    // Generate navigation link if not provided
    const navigationLink = job.maps_link || 
        (job.location_lat && job.location_lng ? 
            `https://www.google.com/maps/dir/?api=1&destination=${job.location_lat},${job.location_lng}` : 
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`);

    // --- UPDATED LAYOUT WITH MORE FIELDS, REMOVED HOURLY RATE ---
    return (
        <main className="p-4 sm:p-6 lg:p-8 bg-v3-bg-darkest min-h-screen text-v3-text-light">
            <div className="mb-6">
                <Link to="/agent/dashboard" className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit">
                    <ArrowLeft size={20} />
                    <span>Back to Dashboard</span>
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                
                {/* Main Content (Left Column) */}
                <div className="flex-grow">
                    <div className="dashboard-card p-0 overflow-hidden">
                        <div className="bg-gradient-to-r from-v3-orange to-v3-orange-dark p-6 text-white">
                            <h1 className="text-2xl lg:text-3xl font-bold mb-1">{job.title}</h1>
                            <p className="text-orange-100 text-lg capitalize">{job.job_type}</p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Enhanced Instructions */}
                            <div>
                                <h2 className="text-xl font-bold text-v3-text-lightest mb-4 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-v3-orange" />
                                    Job Briefing & Instructions
                                </h2>
                                <div className="bg-v3-bg-darker p-4 rounded-lg border-l-4 border-v3-orange">
                                    <p className="whitespace-pre-wrap text-v3-text-light leading-relaxed text-base">
                                        {job.instructions || "No specific instructions provided."}
                                    </p>
                                </div>
                            </div>

                            {/* Weather Forecast & Clothing */}
                            {(job.weather_forecast || job.clothing_recommendation) && (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {job.weather_forecast && (
                                        <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Cloud className="w-5 h-5 text-blue-400" />
                                                <h3 className="font-semibold text-blue-300">Weather Forecast</h3>
                                            </div>
                                            <p className="text-blue-100">{job.weather_forecast}</p>
                                        </div>
                                    )}

                                    {job.clothing_recommendation && (
                                        <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ShirtIcon className="w-5 h-5 text-green-400" />
                                                <h3 className="font-semibold text-green-300">Clothing Recommendation</h3>
                                            </div>
                                            <p className="text-green-100">{job.clothing_recommendation}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Lead Agent Information */}
                            {job.lead_agent_name && (
                                <div className="bg-v3-bg-darker p-4 rounded-lg border border-v3-border">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="w-5 h-5 text-v3-orange" />
                                        <h3 className="font-semibold text-v3-text-lightest">Lead Agent</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-v3-text-light font-medium">{job.lead_agent_name}</p>
                                        <p className="text-sm text-v3-text-muted">
                                            This agent will coordinate the operation and provide guidance on site.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Urgency Level */}
                            <div className="bg-v3-bg-darker p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-5 h-5 text-v3-orange" />
                                    <h3 className="font-semibold text-v3-text-lightest">Urgency Level</h3>
                                </div>
                                <p className="text-v3-text-light capitalize">{job.urgency_level || 'Standard'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar (Right Column) */}
                <div className="lg:w-1/3 lg:max-w-sm flex-shrink-0">
                    <div className="dashboard-card p-6 space-y-5">
                        <h2 className="text-xl font-bold text-v3-text-lightest border-b border-v3-border pb-4">Key Details</h2>
                        
                        <div className="flex items-start gap-4">
                            <Info className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                            <div>
                                <p className="text-sm text-v3-text-muted">Status</p>
                                <p className="font-semibold text-v3-text-lightest capitalize">{job.status}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <Calendar className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                            <div>
                                <p className="text-sm text-v3-text-muted">Date</p>
                                <p className="font-semibold text-v3-text-lightest">{date}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <Clock className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                            <div>
                                <p className="text-sm text-v3-text-muted">Arrival Time</p>
                                <p className="font-semibold text-v3-text-lightest">{time}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <MapPin className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                            <div>
                                <p className="text-sm text-v3-text-muted">Location</p>
                                <p className="font-semibold text-v3-text-lightest mb-2">{job.address}</p>
                                <a 
                                    href={navigationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="button-refresh flex items-center gap-2 w-fit"
                                >
                                    <Navigation size={16} />
                                    Navigate to Entrance
                                </a>
                            </div>
                        </div>
                        
                        {/* Job Type */}
                        <div className="flex items-start gap-4">
                            <FileText className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                            <div>
                                <p className="text-sm text-v3-text-muted">Job Type</p>
                                <p className="font-semibold text-v3-text-lightest capitalize">{job.job_type}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <Users className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                            <div>
                                <p className="text-sm text-v3-text-muted">Agents Allocated</p>
                                <p className="font-semibold text-v3-text-lightest">{job.agents_allocated || 0} of {job.agents_required}</p>
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div className="pt-5 border-t border-v3-border space-y-4">
                            <h3 className="font-semibold text-v3-text-lightest">Additional Information</h3>
                            
                            {job.hourly_rate && (
                                <div className="flex items-start gap-4">
                                    <Thermometer className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                                    <div>
                                        <p className="text-sm text-v3-text-muted">Hourly Rate</p>
                                        <p className="font-semibold text-v3-text-lightest">£{job.hourly_rate}/hour</p>
                                    </div>
                                </div>
                            )}

                            {job.what3words_address && (
                                <div className="flex items-start gap-4">
                                    <MapPin className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                                    <div>
                                        <p className="text-sm text-v3-text-muted">What3Words</p>
                                        <p className="font-semibold text-v3-text-lightest">{job.what3words_address}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-4">
                                <FileText className="w-5 h-5 text-v3-orange flex-shrink-0 mt-1"/>
                                <div>
                                    <p className="text-sm text-v3-text-muted">Job ID for Invoicing</p>
                                    <p className="font-semibold text-v3-text-lightest">{job.id}</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </main>
    );
};

export default JobDetails;