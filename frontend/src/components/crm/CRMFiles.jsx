import { useState, useRef } from 'react';
import { Upload, File, FileText, Image, Trash2, Download, X, Eye } from 'lucide-react';
import axios from 'axios';

const FILE_ICONS = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/gif': Image,
  'image/webp': Image,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.ms-excel': FileText,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileText,
  'default': File
};

const FILE_CATEGORIES = [
  { value: 'quote', label: 'Quote' },
  { value: 'contract', label: 'Contract' },
  { value: 'photo', label: 'Photo' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' }
];

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function CRMFiles({ contactId, files = [], onFileUploaded, onFileDeleted }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    category: 'other',
    description: ''
  });
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadForm.category);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      const response = await axios.post(
        `/api/crm/contacts/${contactId}/files`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Reset form
      setUploadForm({ category: 'other', description: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notify parent
      if (onFileUploaded) {
        onFileUploaded(response.data.file);
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await axios.delete(`/api/crm/files/${fileId}`);
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
    } catch (error) {
      console.error('File delete error:', error);
      alert(error.response?.data?.error || 'Failed to delete file');
    }
  };

  const getFileIcon = (fileType) => {
    const Icon = FILE_ICONS[fileType] || FILE_ICONS['default'];
    return <Icon className="h-8 w-8 text-v3-accent" />;
  };

  const isImage = (fileType) => {
    return fileType?.startsWith('image/');
  };

  const isPDF = (fileType) => {
    return fileType === 'application/pdf';
  };

  const canPreview = (fileType) => {
    return isImage(fileType) || isPDF(fileType);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="dashboard-card p-6">
        <h3 className="text-lg font-semibold text-v3-text-lightest mb-4">Upload Files</h3>

        {/* Category & Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-v3-text-light mb-2">Category</label>
            <select
              value={uploadForm.category}
              onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
              className="v3-input w-full"
            >
              {FILE_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-v3-text-light mb-2">Description (Optional)</label>
            <input
              type="text"
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="e.g., Site inspection photos"
              className="v3-input w-full"
            />
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-v3-accent bg-v3-accent/10'
              : 'border-v3-bg-darker hover:border-v3-accent/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <Upload className="h-12 w-12 text-v3-text-muted mx-auto mb-4" />

          {uploading ? (
            <p className="text-v3-text-light">Uploading...</p>
          ) : (
            <>
              <p className="text-v3-text-light mb-2">
                Drag and drop a file here, or
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="button-refresh"
              >
                Choose File
              </button>
              <p className="text-sm text-v3-text-muted mt-2">
                Supports: Documents, Images, PDFs
              </p>
            </>
          )}
        </div>
      </div>

      {/* Files List */}
      <div className="dashboard-card p-6">
        <h3 className="text-lg font-semibold text-v3-text-lightest mb-4">
          Uploaded Files ({files.length})
        </h3>

        {files.length === 0 ? (
          <div className="text-center py-8 text-v3-text-muted">
            <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No files uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 bg-v3-bg-card rounded-lg hover:bg-v3-bg-darker transition-colors"
              >
                {/* File Icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(file.file_type)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-v3-text-lightest truncate">
                      {file.file_name}
                    </p>
                    {file.category && file.category !== 'other' && (
                      <span className="px-2 py-0.5 bg-v3-accent/20 text-v3-accent text-xs rounded">
                        {FILE_CATEGORIES.find(c => c.value === file.category)?.label || file.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-v3-text-muted">
                    <span>{formatFileSize(file.file_size)}</span>
                    {file.uploaded_by_name && (
                      <>
                        <span>•</span>
                        <span>Uploaded by {file.uploaded_by_name}</span>
                      </>
                    )}
                    {file.created_at && (
                      <>
                        <span>•</span>
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  {file.description && (
                    <p className="text-sm text-v3-text-light mt-1">{file.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canPreview(file.file_type) && (
                    <button
                      onClick={() => setShowPreview(file)}
                      className="p-2 hover:bg-v3-bg-darker rounded"
                      title="Preview"
                    >
                      <Eye className="h-5 w-5 text-v3-text-light" />
                    </button>
                  )}
                  <a
                    href={file.s3_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-v3-bg-darker rounded"
                    title="Download"
                  >
                    <Download className="h-5 w-5 text-v3-text-light" />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-2 hover:bg-v3-bg-darker rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-v3-bg-darker rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-v3-bg-card">
              <h3 className="text-lg font-semibold text-v3-text-lightest">
                {showPreview.file_name}
              </h3>
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 hover:bg-v3-bg-card rounded"
              >
                <X className="h-6 w-6 text-v3-text-muted" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {isImage(showPreview.file_type) ? (
                <img
                  src={showPreview.s3_url}
                  alt={showPreview.file_name}
                  className="max-w-full h-auto mx-auto rounded"
                />
              ) : isPDF(showPreview.file_type) ? (
                <iframe
                  src={showPreview.s3_url}
                  className="w-full h-[70vh] rounded"
                  title={showPreview.file_name}
                />
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-v3-bg-card flex justify-end gap-2">
              <a
                href={showPreview.s3_url}
                target="_blank"
                rel="noopener noreferrer"
                className="button-refresh"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
