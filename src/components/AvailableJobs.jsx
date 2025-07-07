import React, { useState, useEffect } from 'react';
import { 
  MapPin, Clock, DollarSign, Shield, Building, Calendar, 
  CheckCircle, XCircle, Filter, Search, ArrowLeft, Star,
  AlertCircle, Users, Camera, Radio, Car, RefreshCw, ServerCrash
} from 'lucide-react';
import { useAuth } from "../useAuth";

const AvailableJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { apiCall } = useAuth();

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    let filtered = jobs;
    
    if (searchTerm) {
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(job => job.type === filterType);
    }
    
    setFilteredJobs(filtered);
  }, [searchTerm, filterType, jobs]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');
      // Replace with actual API endpoint
      const data = await apiCall('/agent/available-jobs');
      setJobs(data);
      setFilteredJobs(data);
    } catch (error) {
      setError('Failed to load available jobs');
      console.error('Available Jobs error:', error);
      // Fallback to mock data for development
      const mockJobs = [
        {
          id: 'JOB001',
          title: 'Event Security - Music Festival',
          client: 'MegaEvents Ltd',
          location: 'Hyde Park, London',
          type: 'event',
          urgency: 'high',
          duration: '12 hours',
          startTime: '2025-06-16T18:00:00',
          endTime: '2025-06-17T06:00:00',
          rate: 25.50,
          description: 'Security coverage for outdoor music festival. Crowd control, access management, and general security duties.',
          requirements: ['SIA License', 'Experience with large crowds', 'Physical fitness'],
          equipment: ['Radio provided', 'High-vis vest', 'Torch'],
          distance: 2.3,
          rating: 4.8,
          spots: 3,
          filled: 1
        },
        {
          id: 'JOB002',
          title: 'Retail Security - Weekend Shift',
          client: 'ShopSafe Security',
          location: 'Westfield Shopping Centre',
          type: 'retail',
          urgency: 'medium',
          duration: '8 hours',
          startTime: '2025-06-16T09:00:00',
          endTime: '2025-06-16T17:00:00',
          rate: 22.00,
          description: 'Floor walking and theft prevention in busy shopping center during weekend peak hours.',
          requirements: ['SIA License', 'Retail experience preferred'],
          equipment: ['Radio system', 'Uniform provided'],
          distance: 5.1,
          rating: 4.5,
          spots: 2,
          filled: 0
        },
        {
          id: 'JOB003',
          title: 'Corporate Security - Night Shift',
          client: 'SecureCorpLtd',
          location: 'Canary Wharf Office Complex',
          type: 'corporate',
          urgency: 'low',
          duration: '12 hours',
          startTime: '2025-06-16T20:00:00',
          endTime: '2025-06-17T08:00:00',
          rate: 28.75,
          description: 'Access control and building security for prestigious office complex.',
          requirements: ['SIA License', 'Clean DBS check', 'Previous corporate experience'],
          equipment: ['Full uniform', 'Access cards', 'CCTV monitoring'],
          distance: 8.7,
          rating: 4.9,
          spots: 1,
          filled: 0
        }
      ];
      setJobs(mockJobs);
      setFilteredJobs(mockJobs);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'event': return Shield;
      case 'retail': return Building;
      case 'corporate': return Building;
      case 'patrol': return Car;
      default: return Shield;
    }
  };

  const getUrgencyBadge = (urgency) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-medium";
    switch(urgency) {
      case 'high': return `${baseClasses} bg-red-500 text-white`;
      case 'medium': return `${baseClasses} bg-v3-orange text-white`;
      case 'low': return `${baseClasses} bg-green-500 text-white`;
      default: return `${baseClasses} bg-v3-text-muted text-white`;
    }
  };

  const handleJobAction = async (jobId, action) => {
    try {
      setLoading(true);
      // Replace with actual API call
      await apiCall(`/agent/jobs/${jobId}/${action}`, { 
        method: 'POST' 
      });
      
      if (action === 'accept') {
        setJobs(prev => prev.filter(job => job.id !== jobId));
        setFilteredJobs(prev => prev.filter(job => job.id !== jobId));
      }
      setSelectedJob(null);
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (selectedJob) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedJob(null)}
            className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Jobs</span>
          </button>
          <div className={getUrgencyBadge(selectedJob.urgency)}>
            {selectedJob.urgency.toUpperCase()} PRIORITY
          </div>
        </div>

        {/* Job Detail Card */}
        <div className="dashboard-card">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-v3-orange to-v3-orange-dark p-6 text-white rounded-t-lg -m-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{selectedJob.title}</h1>
                <p className="text-orange-100 text-lg">{selectedJob.client}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">£{selectedJob.rate}</div>
                <div className="text-orange-100 text-sm">per hour</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <MapPin size={16} />
                <span>{selectedJob.location}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={16} />
                <span>{selectedJob.duration}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>{formatDate(selectedJob.startTime)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users size={16} />
                <span>{selectedJob.spots - selectedJob.filled} spots left</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-v3-text-lightest font-semibold mb-3">Job Description</h3>
              <p className="text-v3-text-light leading-relaxed">{selectedJob.description}</p>
            </div>

            {/* Schedule */}
            <div>
              <h3 className="text-v3-text-lightest font-semibold mb-3">Schedule</h3>
              <div className="bg-v3-bg-dark rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-v3-text-lightest font-medium">Start</div>
                    <div className="text-v3-text-light">{formatDate(selectedJob.startTime)} at {formatTime(selectedJob.startTime)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-v3-text-lightest font-medium">End</div>
                    <div className="text-v3-text-light">{formatDate(selectedJob.endTime)} at {formatTime(selectedJob.endTime)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div>
              <h3 className="text-v3-text-lightest font-semibold mb-3">Requirements</h3>
              <div className="space-y-2">
                {selectedJob.requirements.map((req, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="text-green-500" size={16} />
                    <span className="text-v3-text-light">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <h3 className="text-v3-text-lightest font-semibold mb-3">Equipment Provided</h3>
              <div className="space-y-2">
                {selectedJob.equipment.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Radio className="text-blue-500" size={16} />
                    <span className="text-v3-text-light">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distance & Rating */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-v3-bg-dark rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-v3-text-lightest">{selectedJob.distance} mi</div>
                <div className="text-v3-text-muted text-sm">Distance</div>
              </div>
              <div className="bg-v3-bg-dark rounded-lg p-4 text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Star className="text-yellow-500 fill-current" size={20} />
                  <span className="text-2xl font-bold text-v3-text-lightest">{selectedJob.rating}</span>
                </div>
                <div className="text-v3-text-muted text-sm">Client Rating</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-v3-border">
              <button 
                onClick={() => handleJobAction(selectedJob.id, 'decline')}
                className="flex items-center justify-center space-x-2 bg-v3-text-muted hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105"
                disabled={loading}
              >
                <XCircle size={20} />
                <span>Decline</span>
              </button>
              <button 
                onClick={() => handleJobAction(selectedJob.id, 'accept')}
                className="button-refresh flex items-center justify-center space-x-2"
                disabled={loading}
              >
                <CheckCircle size={20} />
                <span>{loading ? 'Processing...' : 'Accept Job'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-48 bg-v3-bg-card rounded-md"></div>
            <div className="h-4 w-72 bg-v3-bg-card rounded-md mt-2"></div>
          </div>
          <div className="h-10 w-24 bg-v3-bg-card rounded-md"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-v3-bg-card rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <div className="dashboard-card text-center p-8">
        <ServerCrash className="mx-auto h-16 w-16 text-v3-orange mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-v3-text-muted mb-6">{error}</p>
        <button onClick={fetchJobs} className="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Available Jobs</h1>
          <p className="text-muted-foreground">Find and accept security assignments near you</p>
        </div>
        <button onClick={fetchJobs} className="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-v3-text-muted" size={20} />
          <input
            type="text"
            placeholder="Search jobs, clients, or locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-v3-bg-card border border-v3-border rounded-lg pl-10 pr-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:ring-2 focus:ring-v3-orange-glow transition-all"
          />
        </div>
        
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All Jobs', icon: Shield },
            { value: 'event', label: 'Events', icon: Users },
            { value: 'retail', label: 'Retail', icon: Building },
            { value: 'corporate', label: 'Corporate', icon: Building },
            { value: 'patrol', label: 'Patrol', icon: Car }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterType(filter.value)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                filterType === filter.value
                  ? 'bg-gradient-to-r from-v3-orange to-v3-orange-dark text-white'
                  : 'bg-v3-bg-card text-v3-text-light hover:bg-v3-bg-dark border border-v3-border'
              }`}
            >
              <filter.icon size={16} />
              <span>{filter.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="dashboard-card text-center p-8">
          <AlertCircle className="mx-auto text-v3-text-muted mb-4" size={48} />
          <h3 className="text-v3-text-lightest text-xl font-semibold mb-2">No Jobs Available</h3>
          <p className="text-v3-text-muted">Check back later or adjust your search filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const TypeIcon = getTypeIcon(job.type);
            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="dashboard-card cursor-pointer group"
              >
                {/* Job Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center">
                        <TypeIcon className="text-white" size={20} />
                      </div>
                      <div>
                        <h3 className="text-v3-text-lightest font-semibold text-lg">{job.title}</h3>
                        <p className="text-v3-text-muted">{job.client}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-v3-text-lightest">£{job.rate}</div>
                    <div className="text-v3-text-muted text-sm">per hour</div>
                  </div>
                </div>

                {/* Job Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="text-v3-orange" size={16} />
                    <span className="text-v3-text-light text-sm">{job.location}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="text-v3-orange" size={16} />
                    <span className="text-v3-text-light text-sm">{job.duration}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="text-v3-orange" size={16} />
                    <span className="text-v3-text-light text-sm">{formatDate(job.startTime)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="text-v3-orange" size={16} />
                    <span className="text-v3-text-light text-sm">{job.spots - job.filled} spots left</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-v3-border">
                  <div className="flex items-center space-x-4">
                    <div className={getUrgencyBadge(job.urgency)}>
                      {job.urgency.toUpperCase()}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="text-yellow-500 fill-current" size={16} />
                      <span className="text-v3-text-light text-sm">{job.rating}</span>
                    </div>
                  </div>
                  <div className="text-v3-orange opacity-0 group-hover:opacity-100 transition-opacity">
                    View Details →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AvailableJobs;

