import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, FileText, Calendar, User, Image as ImageIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import '../../styles/admin/report-viewer.css';

export default function ReportViewer({ report, isOpen, onClose }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);

  if (!report) return null;

  const formTypeNames = {
    'traveller_eviction': 'Traveller Eviction Report',
    'traveller_serve': 'Traveller Serve Report',
    'squatter_serve': 'Squatter Serve Report',
  };

  const reportName = formTypeNames[report.form_type] || report.form_type.replace('_', ' ');
  const photos = report.photo_urls || [];
  const reportData = report.report_data || {};

  // Debug photos
  console.log('📸 ReportViewer - photos:', photos);
  photos.forEach((photo, i) => {
    console.log(`  Photo ${i}:`, photo);
    console.log(`    - Type:`, typeof photo);
    console.log(`    - URL:`, photo?.url || photo);
  });

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

  // Render form data in a readable format
  const renderFormData = () => {
    const sections = [];

    Object.entries(reportData).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === false) return;

      // Format key to be readable
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      // Handle different value types
      let displayValue = value;
      if (typeof value === 'boolean') {
        displayValue = 'Yes';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value, null, 2);
      }

      sections.push(
        <div key={key} className="report-field">
          <span className="report-field-label">{label}</span>
          <span className="report-field-value">{displayValue}</span>
        </div>
      );
    });

    return sections;
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
            <button
              className="report-viewer__close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="report-viewer__body">
            {/* Metadata */}
            <div className="report-viewer__metadata">
              <div className="metadata-item">
                <User size={16} />
                <span>
                  <strong>Agent:</strong> {report.agent_name || 'Unknown'}
                </span>
              </div>
              <div className="metadata-item">
                <Calendar size={16} />
                <span>
                  <strong>Submitted:</strong>{' '}
                  {report.submitted_at
                    ? new Date(report.submitted_at).toLocaleString()
                    : 'Unknown'}
                </span>
              </div>
              {report.reviewed_at && (
                <div className="metadata-item">
                  <Calendar size={16} />
                  <span>
                    <strong>Reviewed:</strong>{' '}
                    {new Date(report.reviewed_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Photos Section */}
            {photos.length > 0 && (
              <div className="report-viewer__section">
                <h3 className="section-title">
                  <ImageIcon size={18} />
                  Photos ({photos.length})
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
                        onLoad={(e) => {
                          console.log(`✅ Photo ${index + 1} loaded successfully:`, e.target.src);
                        }}
                        onError={(e) => {
                          console.log(`❌ Photo ${index + 1} failed to load:`, e.target.src);
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23333" width="200" height="200"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report Data Section */}
            <div className="report-viewer__section">
              <h3 className="section-title">
                <FileText size={18} />
                Report Details
              </h3>
              <div className="report-data">
                {renderFormData()}
              </div>
            </div>
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
    </>
  );
}
