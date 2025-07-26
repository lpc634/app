import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  FileText, 
  Image as ImageIcon,
  AlertTriangle,
  Loader2
} from 'lucide-react';

const DocumentViewer = ({ document, agent, isOpen, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen && document) {
      fetchPreviewUrl();
    }
    return () => {
      // Cleanup: revoke object URL if it exists
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, document]);

  const fetchPreviewUrl = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      
      // Handle both legacy and S3 file keys
      let fileKey;
      if (document.is_legacy) {
        // For legacy documents, use the file_key directly
        fileKey = document.file_key.replace(/\//g, '__');
      } else {
        // For S3 documents, use the file_key as-is
        fileKey = document.file_key.replace(/\//g, '__');
      }
      
      const response = await fetch(`/api/admin/documents/${fileKey}/preview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get preview URL: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.preview_url) {
        setPreviewUrl(data.preview_url);
      } else {
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (error) {
      console.error('Error fetching preview URL:', error);
      setError(error.message || 'Failed to load document preview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = document.filename || 'document';
      link.target = '_blank';
      link.click();
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(100);
    setRotation(0);
  };

  const getFileType = () => {
    if (!document.filename) return 'unknown';
    const extension = document.filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    return 'unknown';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDocumentType = (type) => {
    const types = {
      'id_card': 'ID Card',
      'passport': 'Passport',
      'driver_license': 'Driver License',
      'sia_license': 'SIA License',
      'other': 'Other Document'
    };
    return types[type] || 'Unknown Document';
  };

  const fileType = getFileType();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Document Viewer
              </DialogTitle>
              <DialogDescription className="mt-1">
                {agent?.name} - {formatDocumentType(document?.metadata?.document_type)}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Document Info Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-6">
              <span className="flex items-center">
                {fileType === 'image' ? <ImageIcon className="h-4 w-4 mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                {document?.filename}
              </span>
              <span>{formatFileSize(document?.size)}</span>
              {document?.metadata?.upload_date && (
                <span>Uploaded: {new Date(document.metadata.upload_date).toLocaleDateString()}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Zoom Controls */}
              {fileType === 'image' && (
                <>
                  <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 25}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[4rem] text-center">{zoom}%</span>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 300}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRotate}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!previewUrl}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Document Preview Area */}
        <div className="flex-1 overflow-auto bg-gray-100">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Loading document preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full p-6">
              <Alert className="max-w-md border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!loading && !error && previewUrl && (
            <div className="flex items-center justify-center min-h-full p-4">
              {fileType === 'image' ? (
                <img
                  src={previewUrl}
                  alt={document.filename}
                  className="max-w-full max-h-full object-contain shadow-lg"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease'
                  }}
                  onError={() => setError('Failed to load image. The file may be corrupted or unsupported.')}
                />
              ) : fileType === 'pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[600px] border-none"
                  title={document.filename}
                  onError={() => setError('Failed to load PDF. Please try downloading the file.')}
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
                  <p className="text-gray-600 mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  <Button onClick={handleDownload} disabled={!previewUrl}>
                    <Download className="h-4 w-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Reset Button */}
        {fileType === 'image' && !loading && !error && (
          <div className="px-6 py-3 border-t bg-gray-50">
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handleResetView}>
                Reset View
              </Button>
              <div className="text-sm text-gray-500">
                Use mouse wheel to zoom, or use the controls above
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewer;