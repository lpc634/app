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

    if (loading) {
        return (
            <div className="agent-mobile-content">
                <div className="agent-mobile-loading">
                    <Loader2 className="agent-mobile-loading-spinner" size={32} />
                    <p>Loading job details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="agent-mobile-content">
                <div className="agent-mobile-error">
                    <ServerCrash className="agent-mobile-error-icon" size={48} />
                    <h2 className="agent-mobile-error-title">Connection Error</h2>
                    <p className="agent-mobile-error-message">{error}</p>
                    <Link 
                        to="/agent/dashboard" 
                        className="agent-mobile-button agent-mobile-button-primary"
                    >
                        <ArrowLeft size={16} /> 
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }
    
    if (!job) {
        return (
            <div className="agent-mobile-content">
                <div className="agent-mobile-error">
                    <AlertCircle className="agent-mobile-error-icon" size={48} />
                    <h2 className="agent-mobile-error-title">Job Not Found</h2>
                    <p className="agent-mobile-error-message">The requested job could not be found.</p>
                    <Link 
                        to="/agent/dashboard" 
                        className="agent-mobile-button agent-mobile-button-primary"
                    >
                        <ArrowLeft size={16} /> 
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    const { date, time } = formatDateTime(job.arrival_time);

    // Generate navigation link if not provided
    const navigationLink = job.maps_link || 
        (job.location_lat && job.location_lng ? 
            `https://www.google.com/maps/dir/?api=1&destination=${job.location_lat},${job.location_lng}` : 
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`);

    return (
        <div className="agent-mobile-content">
            {/* Back Navigation */}
            <div className="mb-6">
                <Link 
                    to="/agent/dashboard" 
                    className="agent-mobile-button agent-mobile-button-secondary inline-flex"
                >
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Job Header */}
            <div className="agent-mobile-card" style={{
                background: 'linear-gradient(135deg, var(--v3-orange) 0%, var(--v3-orange-dark) 100%)',
                color: 'white',
                border: 'none'
            }}>
                <div className="agent-mobile-card-header">
                    <h1 className="agent-mobile-card-title" style={{ color: 'white', fontSize: '1.5rem' }}>
                        {job.address}
                    </h1>
                    <p className="text-orange-100 text-lg capitalize font-medium">
                        {job.job_type}
                    </p>
                </div>
            </div>

            {/* Job Instructions */}
            <div className="agent-mobile-section">
                <h2 className="agent-mobile-section-title">
                    <Info size={20} />
                    Job Briefing & Instructions
                </h2>
                <div className="agent-mobile-card">
                    <div className="agent-mobile-card-content">
                        <div style={{ 
                            borderLeft: '4px solid var(--v3-orange)', 
                            paddingLeft: '1rem',
                            background: 'var(--v3-bg-dark)',
                            padding: '1rem',
                            borderRadius: '0.5rem'
                        }}>
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                {job.instructions || "No specific instructions provided."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Weather & Clothing */}
            {(job.weather_forecast || job.clothing_recommendation) && (
                <div className="agent-mobile-section">
                    <h2 className="agent-mobile-section-title">
                        <Cloud size={20} />
                        Weather & Preparation
                    </h2>
                    
                    {job.weather_forecast && (
                        <div className="agent-mobile-card" style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderColor: 'rgba(59, 130, 246, 0.3)'
                        }}>
                            <div className="agent-mobile-card-header">
                                <h3 className="agent-mobile-card-title" style={{ color: '#93c5fd' }}>
                                    <Cloud size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                                    Weather Forecast
                                </h3>
                            </div>
                            <div className="agent-mobile-card-content">
                                <p style={{ color: '#dbeafe' }}>{job.weather_forecast}</p>
                            </div>
                        </div>
                    )}

                    {job.clothing_recommendation && (
                        <div className="agent-mobile-card" style={{
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderColor: 'rgba(34, 197, 94, 0.3)'
                        }}>
                            <div className="agent-mobile-card-header">
                                <h3 className="agent-mobile-card-title" style={{ color: '#86efac' }}>
                                    <ShirtIcon size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                                    Clothing Recommendation
                                </h3>
                            </div>
                            <div className="agent-mobile-card-content">
                                <p style={{ color: '#dcfce7' }}>{job.clothing_recommendation}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Lead Agent Information */}
            {job.lead_agent_name && (
                <div className="agent-mobile-section">
                    <h2 className="agent-mobile-section-title">
                        <Shield size={20} />
                        Lead Agent
                    </h2>
                    <div className="agent-mobile-card">
                        <div className="agent-mobile-card-content">
                            <p className="font-medium text-v3-text-lightest mb-2">{job.lead_agent_name}</p>
                            <p className="text-sm text-v3-text-muted">
                                This agent will coordinate the operation and provide guidance on site.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Urgency Level */}
            <div className="agent-mobile-section">
                <h2 className="agent-mobile-section-title">
                    <AlertCircle size={20} />
                    Priority Level
                </h2>
                <div className="agent-mobile-card">
                    <div className="agent-mobile-card-content">
                        <p className="text-v3-text-light capitalize font-medium">
                            {job.urgency_level || 'Standard'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Job Details */}
            <div className="agent-mobile-section">
                <h2 className="agent-mobile-section-title">
                    <Info size={20} />
                    Job Details
                </h2>
                
                <div className="space-y-4">
                    {/* Key Information Grid */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="agent-mobile-card">
                            <div className="agent-mobile-card-content">
                                <div className="flex items-center gap-3 mb-2">
                                    <Calendar className="text-v3-orange" size={16} />
                                    <span className="text-sm text-v3-text-muted">Date & Time</span>
                                </div>
                                <p className="font-semibold text-v3-text-lightest">{date}</p>
                                <p className="font-semibold text-v3-text-lightest">{time}</p>
                            </div>
                        </div>

                        <div className="agent-mobile-card">
                            <div className="agent-mobile-card-content">
                                <div className="flex items-center gap-3 mb-2">
                                    <MapPin className="text-v3-orange" size={16} />
                                    <span className="text-sm text-v3-text-muted">Location</span>
                                </div>
                                <p className="font-semibold text-v3-text-lightest mb-3">{job.address}</p>
                                <a 
                                    href={navigationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="agent-mobile-button agent-mobile-button-primary w-full"
                                >
                                    <Navigation size={16} />
                                    Navigate to Location
                                </a>
                            </div>
                        </div>

                        <div className="agent-mobile-card">
                            <div className="agent-mobile-card-content">
                                <div className="flex items-center gap-3 mb-2">
                                    <Users className="text-v3-orange" size={16} />
                                    <span className="text-sm text-v3-text-muted">Team Size</span>
                                </div>
                                <p className="font-semibold text-v3-text-lightest">
                                    {job.agents_allocated || 0} of {job.agents_required} agents assigned
                                </p>
                            </div>
                        </div>

                        {job.what3words_address && (
                            <div className="agent-mobile-card">
                                <div className="agent-mobile-card-content">
                                    <div className="flex items-center gap-3 mb-2">
                                        <MapPin className="text-v3-orange" size={16} />
                                        <span className="text-sm text-v3-text-muted">What3Words</span>
                                    </div>
                                    <p className="font-semibold text-v3-text-lightest">{job.what3words_address}</p>
                                </div>
                            </div>
                        )}

                        <div className="agent-mobile-card">
                            <div className="agent-mobile-card-content">
                                <div className="flex items-center gap-3 mb-2">
                                    <FileText className="text-v3-orange" size={16} />
                                    <span className="text-sm text-v3-text-muted">Job Reference</span>
                                </div>
                                <p className="font-semibold text-v3-text-lightest">#{job.id}</p>
                                <p className="text-xs text-v3-text-muted mt-1">Use this ID for invoicing</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobDetails;