import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, FileText, Calendar, User, Image as ImageIcon, Download, ChevronLeft, ChevronRight, MapPin, Clock, Users, Shield, Dog, Home, AlertTriangle, FileDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import '../../styles/admin/report-viewer.css';

// Field label mapping for better display
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
  agent_6: 'Agent 6',
  agent_7: 'Agent 7',
  agent_8: 'Agent 8',
  agent_9: 'Agent 9',
  agent_10: 'Agent 10',
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

// Section definitions for organizing form data
const SECTIONS = {
  squatter_eviction: [
    {
      title: 'Job Details',
      icon: FileText,
      fields: ['client', 'address1', 'address2', 'city', 'postcode', 'date', 'arrival_time']
    },
    {
      title: 'Agents on Site',
      icon: Users,
      fields: ['agent_1', 'agent_2', 'agent_3', 'agent_4', 'agent_5', 'agent_6', 'agent_7', 'agent_8', 'agent_9', 'agent_10',
               'agent_11', 'agent_12', 'agent_13', 'agent_14', 'agent_15', 'agent_16', 'agent_17', 'agent_18', 'agent_19', 'agent_20']
    },
    {
      title: 'Property Details',
      icon: Home,
      fields: ['prior_notice_served', 'property_condition', 'property_damage', 'damage_details',
               'aggressive', 'aggression_details', 'dogs_on_site', 'dog_details',
               'num_males', 'num_females', 'num_children']
    },
    {
      title: 'Eviction Timeline',
      icon: Clock,
      fields: ['timeline_day1', 'timeline_day2', 'timeline_day3', 'timeline_day4', 'timeline_day5', 'timeline_day6', 'timeline_day7']
    },
    {
      title: 'Police Details',
      icon: Shield,
      fields: ['police_attendance', 'cad_number', 'police_force', 'police_notes']
    },
    {
      title: 'Completion',
      icon: Calendar,
      fields: ['departure_time', 'completion_date', 'additional_notes']
    }
  ],
  // Add more form type definitions as needed
  traveller_eviction: [
    {
      title: 'Job Details',
      icon: FileText,
      fields: ['client', 'address1', 'address2', 'city', 'postcode', 'date', 'arrival_time']
    },
    {
      title: 'Agents on Site',
      icon: Users,
      fields: ['agent_1', 'agent_2', 'agent_3', 'agent_4', 'agent_5', 'agent_6', 'agent_7', 'agent_8', 'agent_9', 'agent_10']
    },
    {
      title: 'Site Details',
      icon: Home,
      fields: ['num_caravans', 'num_vehicles', 'num_males', 'num_females', 'num_children', 'dogs_on_site', 'dog_details']
    },
    {
      title: 'Timeline',
      icon: Clock,
      fields: ['timeline_day1', 'timeline_day2', 'timeline_day3', 'timeline_day4', 'timeline_day5', 'timeline_day6', 'timeline_day7']
    },
    {
      title: 'Police Details',
      icon: Shield,
      fields: ['police_attendance', 'cad_number', 'police_force', 'police_notes']
    },
    {
      title: 'Completion',
      icon: Calendar,
      fields: ['departure_time', 'completion_date', 'additional_notes']
    }
  ]
};

export default function ReportViewer({ report, isOpen, onClose, onDelete }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!report) return null;

  const formTypeNames = {
    'traveller_eviction': 'Traveller Eviction Report',
    'traveller_serve': 'Traveller Serve Report',
    'squatter_serve': 'Squatter Serve Report',
    'squatter_eviction': 'Squatter Eviction Report',
  };

  const reportName = formTypeNames[report.form_type] || report.form_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Job Report';
  const photos = report.photo_urls || [];

  // Handle potential nested structure - data might be in report_data directly or in report_data.formData
  const rawReportData = report.report_data || {};
  const reportData = rawReportData.formData || rawReportData;

  const handlePhotoClick = (index) => {
    setCurrentPhotoIndex(index);
    setShowPhotoGallery(true);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Format a field value for display
  const formatValue = (key, value) => {
    // Handle null/undefined but NOT empty string or false or 0
    if (value === null || value === undefined) return null;

    // Boolean values - always show Yes/No
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    // Empty string - skip
    if (value === '') return null;

    // Timeline objects (hourly entries)
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

    // Numbers - show even if 0
    if (typeof value === 'number') {
      return value.toString();
    }

    // Date formatting
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

  // Debug: log report data to see what fields exist
  console.log('📋 Raw report.report_data:', rawReportData);
  console.log('📋 Processed reportData:', reportData);
  console.log('📋 Report form_type:', report.form_type);
  console.log('📋 Key fields check - client:', reportData.client, 'address1:', reportData.address1, 'agent_1:', reportData.agent_1);
  console.log('📋 All keys in reportData:', Object.keys(reportData));

  // Get label for a field
  const getLabel = (key) => {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];

    // Handle agent fields beyond 10
    if (key.match(/^agent_\d+$/)) {
      const num = key.split('_')[1];
      return `Agent ${num}`;
    }

    // Handle day-specific agent fields
    if (key.match(/^day\d+_/)) {
      const parts = key.split('_');
      const dayNum = parts[0].replace('day', '');
      const rest = parts.slice(1).join(' ');
      return `Day ${dayNum} - ${rest.charAt(0).toUpperCase() + rest.slice(1)}`;
    }

    // Default: convert snake_case to Title Case
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Render sections based on form type
  const renderSections = () => {
    const sections = SECTIONS[report.form_type] || SECTIONS.squatter_eviction;
    const renderedFieldKeys = new Set();

    return sections.map((section, sectionIndex) => {
      const Icon = section.icon;
      const sectionFields = [];

      section.fields.forEach(fieldKey => {
        const value = reportData[fieldKey];
        const formatted = formatValue(fieldKey, value);

        if (formatted !== null) {
          renderedFieldKeys.add(fieldKey);
          sectionFields.push(
            <div key={fieldKey} className="report-field">
              <span className="report-field-label">{getLabel(fieldKey)}</span>
              <span className="report-field-value">{formatted}</span>
            </div>
          );
        }
      });

      // Don't render empty sections
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

  // Render any remaining fields not in sections
  const renderRemainingFields = () => {
    const sections = SECTIONS[report.form_type] || SECTIONS.squatter_eviction;
    const definedFields = new Set(sections.flatMap(s => s.fields));

    // Add common skip fields
    const skipFields = new Set([
      'more_than_10', 'need_more_entries', 'need_more_photos',
      'day2_enabled', 'day3_enabled', 'day4_enabled', 'day5_enabled', 'day6_enabled', 'day7_enabled',
      'day2_same_agents', 'day3_same_agents', 'day4_same_agents', 'day5_same_agents', 'day6_same_agents', 'day7_same_agents',
      'photo_of_serve', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13'
    ]);

    const remainingFields = [];

    Object.entries(reportData).forEach(([key, value]) => {
      if (definedFields.has(key) || skipFields.has(key)) return;

      const formatted = formatValue(key, value);
      if (formatted !== null) {
        remainingFields.push(
          <div key={key} className="report-field">
            <span className="report-field-label">{getLabel(key)}</span>
            <span className="report-field-value">{formatted}</span>
          </div>
        );
      }
    });

    if (remainingFields.length === 0) return null;

    return (
      <div className="report-viewer__section">
        <h3 className="section-title">
          <FileText size={18} />
          Additional Information
        </h3>
        <div className="report-data">
          {remainingFields}
        </div>
      </div>
    );
  };

  // Export to PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/v3-reports/${report.id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const data = await response.json();

      if (data.pdf_url) {
        // Open PDF in new tab or download
        window.open(data.pdf_url, '_blank');
      } else {
        throw new Error('No PDF URL returned');
      }
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Delete report
  const handleDeleteReport = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/v3-reports/${report.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete report');
      }

      setShowDeleteConfirm(false);
      onClose();
      // Call onDelete callback to refresh the parent component
      if (onDelete) {
        onDelete(report.id);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete report: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="report-viewer-modal">
          {/* Header */}
          <div className="report-viewer__header">
            <div className="report-viewer__header-content">
              <h2 className="report-viewer__title">
                <FileText size={24} />
                {reportName}
              </h2>
              <p className="report-viewer__subtitle">Report #{report.id}</p>
            </div>
            <div className="report-viewer__header-actions">
              <button
                className="report-viewer__export-btn"
                onClick={handleExportPDF}
                disabled={isExporting}
                title="Export to PDF"
              >
                <FileDown size={18} />
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                className="report-viewer__delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                title="Delete Report"
              >
                <Trash2 size={18} />
              </button>
              <button
                className="report-viewer__close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="report-viewer__body">
            {/* Metadata */}
            <div className="report-viewer__metadata">
              <div className="metadata-item">
                <User size={16} />
                <span>
                  <strong>Submitted by:</strong> {report.agent_name || 'Unknown'}
                </span>
              </div>
              <div className="metadata-item">
                <Calendar size={16} />
                <span>
                  <strong>Submitted:</strong>{' '}
                  {report.submitted_at
                    ? new Date(report.submitted_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Unknown'}
                </span>
              </div>
              {report.reviewed_at && (
                <div className="metadata-item">
                  <Calendar size={16} />
                  <span>
                    <strong>Reviewed:</strong>{' '}
                    {new Date(report.reviewed_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              <div className="metadata-item">
                <FileText size={16} />
                <span>
                  <strong>Status:</strong>{' '}
                  <span className={`status-badge status-${report.status || 'submitted'}`}>
                    {(report.status || 'submitted').charAt(0).toUpperCase() + (report.status || 'submitted').slice(1)}
                  </span>
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
                      onClick={() => handlePhotoClick(index)}
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

            {/* Debug: Show all raw data if sections aren't rendering */}
            {Object.keys(reportData).length > 0 && (
              <div className="report-viewer__section" style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255, 107, 53, 0.1)', borderRadius: '8px', border: '1px dashed rgba(255, 107, 53, 0.3)' }}>
                <h3 className="section-title" style={{ fontSize: '0.85rem', color: '#ff6b35' }}>
                  <FileText size={16} />
                  Debug: Raw Form Data ({Object.keys(reportData).length} fields)
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', maxHeight: '200px', overflow: 'auto' }}>
                  <strong>client:</strong> "{reportData.client || '(empty)'}"<br/>
                  <strong>address1:</strong> "{reportData.address1 || '(empty)'}"<br/>
                  <strong>agent_1:</strong> "{reportData.agent_1 || '(empty)'}"<br/>
                  <strong>All keys:</strong> {Object.keys(reportData).join(', ')}
                </div>
              </div>
            )}

            {/* Organized Report Sections */}
            {renderSections()}

            {/* Any remaining fields not in predefined sections */}
            {renderRemainingFields()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Gallery Modal */}
      {showPhotoGallery && photos.length > 0 && (
        <Dialog open={showPhotoGallery} onOpenChange={setShowPhotoGallery}>
          <DialogContent className="photo-gallery-modal">
            <button
              className="gallery-close-btn"
              onClick={() => setShowPhotoGallery(false)}
            >
              <X size={24} />
            </button>

            <div className="gallery-content">
              {photos.length > 1 && (
                <button className="gallery-nav gallery-nav-prev" onClick={prevPhoto}>
                  <ChevronLeft size={32} />
                </button>
              )}

              <div className="gallery-image-container">
                <img
                  src={photos[currentPhotoIndex].url || photos[currentPhotoIndex]}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  className="gallery-image"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23222" width="800" height="600"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="24"%3EImage not available%3C/text%3E%3C/svg%3E';
                  }}
                />
                <div className="gallery-counter">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              </div>

              {photos.length > 1 && (
                <button className="gallery-nav gallery-nav-next" onClick={nextPhoto}>
                  <ChevronRight size={32} />
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="delete-confirm-modal">
            <div className="delete-confirm-content">
              <div className="delete-confirm-icon">
                <AlertTriangle size={48} />
              </div>
              <h3 className="delete-confirm-title">Delete Report?</h3>
              <p className="delete-confirm-message">
                Are you sure you want to delete this report? This action cannot be undone and will also remove all associated photos.
              </p>
              <div className="delete-confirm-actions">
                <button
                  className="delete-confirm-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="delete-confirm-delete"
                  onClick={handleDeleteReport}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Report'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
