import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Calendar, User, Image as ImageIcon, Download, ChevronLeft, ChevronRight, X, Clock, Users, Shield, Home, FileDown, Images } from 'lucide-react';
import '../styles/admin/report-viewer.css';

// Field label mapping
const FIELD_LABELS = {
  client: 'Client',
  address1: 'Address Line 1',
  address2: 'Address Line 2',
  city: 'City',
  postcode: 'Postcode',
  date: 'Date',
  arrival_time: 'Arrival Time',
  departure_time: 'Departure Time',
  completion_date: 'Completion Date',
  agent_1: 'Lead Agent',
  agent_2: 'Agent 2',
  agent_3: 'Agent 3',
  agent_4: 'Agent 4',
  agent_5: 'Agent 5',
  prior_notice_served: 'Prior Notice Served',
  property_condition: 'Property Condition',
  property_damage: 'Property Damage',
  damage_details: 'Damage Details',
  aggressive: 'Squatters Aggressive',
  aggression_details: 'Aggression Details',
  dogs_on_site: 'Dogs on Site',
  dog_details: 'Dog Details',
  num_males: 'Adult Males',
  num_females: 'Adult Females',
  num_children: 'Children',
  police_attendance: 'Police Attendance',
  cad_number: 'CAD Number',
  police_force: 'Police Force',
  police_notes: 'Police Notes',
  additional_notes: 'Additional Notes',
};

// Section definitions
const SECTIONS = {
  squatter_eviction: [
    { title: 'Job Details', icon: FileText, fields: ['client', 'address1', 'address2', 'city', 'postcode', 'date', 'arrival_time'] },
    { title: 'Agents on Site', icon: Users, fields: ['agent_1', 'agent_2', 'agent_3', 'agent_4', 'agent_5', 'agent_6', 'agent_7', 'agent_8', 'agent_9', 'agent_10'] },
    { title: 'Property Details', icon: Home, fields: ['prior_notice_served', 'property_condition', 'property_damage', 'damage_details', 'aggressive', 'aggression_details', 'dogs_on_site', 'dog_details', 'num_males', 'num_females', 'num_children'] },
    { title: 'Timeline', icon: Clock, fields: ['timeline_day1', 'timeline_day2', 'timeline_day3', 'timeline_day4', 'timeline_day5', 'timeline_day6', 'timeline_day7'] },
    { title: 'Police Details', icon: Shield, fields: ['police_attendance', 'cad_number', 'police_force', 'police_notes'] },
    { title: 'Completion', icon: Calendar, fields: ['departure_time', 'completion_date', 'additional_notes'] }
  ],
  traveller_eviction: [
    { title: 'Job Details', icon: FileText, fields: ['client', 'address1', 'address2', 'city', 'postcode', 'date', 'arrival_time'] },
    { title: 'Agents on Site', icon: Users, fields: ['agent_1', 'agent_2', 'agent_3', 'agent_4', 'agent_5', 'agent_6', 'agent_7', 'agent_8', 'agent_9', 'agent_10'] },
    { title: 'Site Details', icon: Home, fields: ['num_caravans', 'num_vehicles', 'num_males', 'num_females', 'num_children', 'dogs_on_site', 'dog_details'] },
    { title: 'Timeline', icon: Clock, fields: ['timeline_day1', 'timeline_day2', 'timeline_day3', 'timeline_day4', 'timeline_day5', 'timeline_day6', 'timeline_day7'] },
    { title: 'Police Details', icon: Shield, fields: ['police_attendance', 'cad_number', 'police_force', 'police_notes'] },
    { title: 'Completion', icon: Calendar, fields: ['departure_time', 'completion_date', 'additional_notes'] }
  ]
};

const formTypeNames = {
  'traveller_eviction': 'Traveller Eviction Report',
  'traveller_serve': 'Traveller Serve Report',
  'squatter_serve': 'Squatter Serve Report',
  'squatter_eviction': 'Squatter Eviction Report',
};

export default function PublicReportPage() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingPhotos, setIsDownloadingPhotos] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [token]);

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/public/report/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Report not found or link has expired');
        }
        throw new Error('Failed to load report');
      }
      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      // For public reports, we need to generate PDF on the fly
      // We'll open the print dialog as a fallback
      window.print();
    } catch (err) {
      alert('Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadPhotos = async () => {
    setIsDownloadingPhotos(true);
    try {
      const response = await fetch(`/api/public/report/${token}/photos/download`);
      if (!response.ok) throw new Error('Failed to download photos');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download photos: ' + err.message);
    } finally {
      setIsDownloadingPhotos(false);
    }
  };

  const formatValue = (key, value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === '') return null;

    if (key.startsWith('timeline_day') && typeof value === 'object') {
      const entries = Object.entries(value).filter(([_, v]) => v && String(v).trim());
      if (entries.length === 0) return null;
      return (
        <div className="timeline-entries">
          {entries.map(([time, text]) => (
            <div key={time} className="timeline-entry">
              <span className="timeline-time">{time}</span>
              <span className="timeline-text">{text}</span>
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'number') return value.toString();

    if (key.includes('date') && typeof value === 'string') {
      try {
        const date = new Date(value);
        if (!isNaN(date)) {
          return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      } catch (e) {}
    }

    return value;
  };

  const getLabel = (key) => {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    if (key.match(/^agent_\d+$/)) {
      const num = key.split('_')[1];
      return `Agent ${num}`;
    }
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="public-report-loading">
        <div className="loading-spinner"></div>
        <p>Loading report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-report-error">
        <FileText size={64} />
        <h1>Report Not Available</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!report) return null;

  const reportData = report.report_data || {};
  const photos = report.photo_urls || [];
  const reportName = formTypeNames[report.form_type] || report.form_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Job Report';

  const renderSections = () => {
    const sections = SECTIONS[report.form_type] || SECTIONS.squatter_eviction;

    return sections.map((section, sectionIndex) => {
      const Icon = section.icon;
      const sectionFields = [];

      section.fields.forEach(fieldKey => {
        const value = reportData[fieldKey];
        const formatted = formatValue(fieldKey, value);

        if (formatted !== null) {
          sectionFields.push(
            <div key={fieldKey} className="report-field">
              <span className="report-field-label">{getLabel(fieldKey)}</span>
              <span className="report-field-value">{formatted}</span>
            </div>
          );
        }
      });

      if (sectionFields.length === 0) return null;

      return (
        <div key={sectionIndex} className="report-viewer__section">
          <h3 className="section-title">
            <Icon size={18} />
            {section.title}
          </h3>
          <div className="report-data">
            {sectionFields}
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <div className="public-report-page">
      <style>{`
        .public-report-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0e14 0%, #1a1f2e 100%);
          padding: 2rem;
        }

        .public-report-container {
          max-width: 1000px;
          margin: 0 auto;
          background-color: #0a0e14;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .public-report-header {
          background: linear-gradient(135deg, #1a1f2e 0%, #141922 100%);
          border-bottom: 2px solid #ff6b35;
          padding: 2rem;
        }

        .public-report-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .public-report-header .subtitle {
          color: #9ca3af;
          font-size: 0.9rem;
        }

        .public-report-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        .public-report-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .public-report-btn.primary {
          background: linear-gradient(135deg, #ff6b35, #e55a2b);
          color: white;
        }

        .public-report-btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #d1d5db;
        }

        .public-report-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
        }

        .public-report-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .public-report-body {
          padding: 2rem;
        }

        .public-report-branding {
          text-align: center;
          padding: 1.5rem;
          background: rgba(255, 107, 53, 0.05);
          border-top: 1px solid rgba(255, 107, 53, 0.1);
        }

        .public-report-branding img {
          height: 40px;
          opacity: 0.8;
        }

        .public-report-branding p {
          color: #6b7280;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }

        .public-report-loading,
        .public-report-error {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0e14 0%, #1a1f2e 100%);
          color: white;
          text-align: center;
          padding: 2rem;
        }

        .public-report-error svg {
          color: #9ca3af;
          margin-bottom: 1rem;
        }

        .public-report-error h1 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .public-report-error p {
          color: #9ca3af;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 107, 53, 0.2);
          border-top-color: #ff6b35;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Photo gallery overlay */
        .photo-gallery-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gallery-close {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .gallery-close:hover {
          background: #ff6b35;
          border-color: #ff6b35;
        }

        .gallery-image-wrapper {
          max-width: 90%;
          max-height: 90%;
          position: relative;
        }

        .gallery-image-wrapper img {
          max-width: 100%;
          max-height: 85vh;
          object-fit: contain;
          border-radius: 8px;
        }

        .gallery-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .gallery-nav-btn:hover {
          background: #ff6b35;
          border-color: #ff6b35;
        }

        .gallery-nav-btn.prev { left: 2rem; }
        .gallery-nav-btn.next { right: 2rem; }

        .gallery-counter {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-weight: 600;
        }

        @media print {
          .public-report-actions,
          .public-report-branding {
            display: none !important;
          }

          .public-report-page {
            background: white;
            padding: 0;
          }

          .public-report-container {
            box-shadow: none;
          }
        }

        @media (max-width: 768px) {
          .public-report-page {
            padding: 1rem;
          }

          .public-report-header {
            padding: 1.5rem;
          }

          .public-report-header h1 {
            font-size: 1.25rem;
          }

          .public-report-actions {
            flex-direction: column;
          }

          .public-report-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      <div className="public-report-container">
        {/* Header */}
        <div className="public-report-header">
          <h1>
            <FileText size={28} />
            {reportName}
          </h1>
          <p className="subtitle">
            Submitted: {report.submitted_at ? new Date(report.submitted_at).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Unknown'}
          </p>

          <div className="public-report-actions">
            <button
              className="public-report-btn primary"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              <FileDown size={18} />
              {isDownloadingPdf ? 'Preparing...' : 'Print / Save as PDF'}
            </button>

            {photos.length > 0 && (
              <button
                className="public-report-btn secondary"
                onClick={handleDownloadPhotos}
                disabled={isDownloadingPhotos}
              >
                <Images size={18} />
                {isDownloadingPhotos ? 'Downloading...' : `Download All Photos (${photos.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="public-report-body">
          {/* Metadata */}
          <div className="report-viewer__metadata">
            <div className="metadata-item">
              <User size={16} />
              <span><strong>Submitted by:</strong> {report.agent_name || 'Unknown'}</span>
            </div>
            <div className="metadata-item">
              <Calendar size={16} />
              <span>
                <strong>Date:</strong>{' '}
                {report.submitted_at ? new Date(report.submitted_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                }) : 'Unknown'}
              </span>
            </div>
          </div>

          {/* Photos Section */}
          {photos.length > 0 && (
            <div className="report-viewer__section">
              <h3 className="section-title">
                <ImageIcon size={18} />
                Photos & Evidence ({photos.length})
              </h3>
              <div className="photo-grid">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="photo-thumbnail"
                    onClick={() => {
                      setCurrentPhotoIndex(index);
                      setShowPhotoGallery(true);
                    }}
                  >
                    <img
                      src={photo.url || photo}
                      alt={`Photo ${index + 1}`}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23333" width="200" height="200"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Sections */}
          {renderSections()}
        </div>

        {/* Branding Footer */}
        <div className="public-report-branding">
          <p>Report generated by V3 Services</p>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      {showPhotoGallery && photos.length > 0 && (
        <div className="photo-gallery-overlay">
          <button className="gallery-close" onClick={() => setShowPhotoGallery(false)}>
            <X size={24} />
          </button>

          {photos.length > 1 && (
            <button
              className="gallery-nav-btn prev"
              onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <div className="gallery-image-wrapper">
            <img
              src={photos[currentPhotoIndex].url || photos[currentPhotoIndex]}
              alt={`Photo ${currentPhotoIndex + 1}`}
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23222" width="800" height="600"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="24"%3EImage not available%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="gallery-counter">
              {currentPhotoIndex + 1} / {photos.length}
            </div>
          </div>

          {photos.length > 1 && (
            <button
              className="gallery-nav-btn next"
              onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
