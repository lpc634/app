import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, User as UserIcon, Landmark, FileUp, CheckCircle, Image as ImageIcon, Download, Trash2 } from 'lucide-react';

const AgentProfile = () => {
  const { user, loading, apiCall } = useAuth();
  const [formData, setFormData] = useState({});
  
  // State for uploaded documents
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address_line_1: user.address_line_1 || '',
        address_line_2: user.address_line_2 || '',
        city: user.city || '',
        postcode: user.postcode || '',
        bank_name: user.bank_name || '',
        bank_account_number: user.bank_account_number || '',
        bank_sort_code: user.bank_sort_code || '',
        utr_number: user.utr_number || ''
      });
      // Load agent documents
      loadDocuments();
    }
  }, [user]);

  const loadDocuments = async () => {
    try {
      const response = await apiCall('/agent/documents');
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (file, documentType) => {
    setUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('document_type', documentType);
      
      await apiCall('/agent/upload-document', {
        method: 'POST',
        body: uploadData,
      });
      
      // Reload documents after successful upload
      await loadDocuments();
      toast.success('Document uploaded successfully!');
      
    } catch (error) {
      toast.error('Failed to upload document', { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentType) => {
    if (!confirm(`Are you sure you want to delete your ${documentType.replace('_', ' ')} document?`)) {
      return;
    }
    
    try {
      await apiCall(`/agent/documents/${documentType}`, {
        method: 'DELETE',
      });
      
      // Reload documents after successful deletion
      await loadDocuments();
      toast.success('Document deleted successfully!');
      
    } catch (error) {
      toast.error('Failed to delete document', { description: error.message });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await apiCall('/agent/profile', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      toast.success('Profile updated successfully!');

    } catch (error) {
      toast.error('Failed to update profile', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ name, type, label, disabled = false }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-v3-text-light">{label}</label>
      <input
        id={name} name={name} type={type}
        value={formData[name] || ''}
        onChange={handleChange}
        disabled={disabled || saving}
        className="mt-1 block w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange disabled:opacity-50"
      />
    </div>
  );

  const DocumentUploadCard = ({ documentType, label, description }) => {
    const existingDoc = documents.find(doc => doc.document_type === documentType);
    
    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileUpload(file, documentType);
      }
    };
    
    return (
      <div className="border border-v3-border rounded-lg p-4">
        <h3 className="font-semibold text-v3-text-lightest mb-2">{label}</h3>
        <p className="text-sm text-v3-text-muted mb-4">{description}</p>
        
        {existingDoc ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-v3-bg-light rounded border">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-v3-text-lightest">{existingDoc.original_filename}</p>
                  <p className="text-xs text-v3-text-muted">
                    Uploaded {new Date(existingDoc.upload_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={existingDoc.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-v3-orange hover:bg-v3-bg-dark rounded"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleDeleteDocument(documentType)}
                  className="p-2 text-red-500 hover:bg-v3-bg-dark rounded"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <label htmlFor={`replace-${documentType}`} className="cursor-pointer text-sm text-v3-orange hover:underline">
              Replace file
            </label>
            <input
              id={`replace-${documentType}`}
              type="file"
              className="sr-only"
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              disabled={uploading}
            />
          </div>
        ) : (
          <div>
            <label htmlFor={documentType} className="cursor-pointer bg-v3-bg-dark border border-v3-border rounded-md py-3 px-4 text-sm text-v3-text-lightest hover:bg-v3-bg-light flex items-center justify-center gap-2">
              <FileUp className="h-4 w-4" />
              {uploading ? "Uploading..." : "Choose File"}
            </label>
            <input
              id={documentType}
              type="file"
              className="sr-only"
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              disabled={uploading}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  if (!user) {
    return <div className="text-center p-8 text-v3-text-lightest">Error: Could not load user profile. Please try logging in again.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">View and update your personal and invoicing details.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Verification Status Indicator */}
        <div className="dashboard-card p-6">
          <div className="flex items-center gap-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              documents.length === 0
                ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' // Neon red - no documents
                : user.verification_status === 'pending' 
                ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse' // Neon yellow - pending
                : user.verification_status === 'verified'
                ? 'bg-green-500 shadow-lg shadow-green-500/50' // Neon green - verified
                : 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse'
            }`}>
              {user.verification_status === 'verified' && (
                <CheckCircle className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-v3-text-lightest text-lg">
                Verification Status: {
                  documents.length === 0
                    ? 'Documents Required'
                    : user.verification_status === 'pending' 
                    ? 'Under Review'
                    : user.verification_status === 'verified'
                    ? 'Verified ✓'
                    : 'Documents Required'
                }
              </h3>
              <p className="text-sm text-v3-text-muted mt-1">
                {documents.length === 0
                  ? 'Please upload your identification documents below to begin verification'
                  : user.verification_status === 'pending' 
                  ? 'Your documents are being reviewed by our admin team'
                  : user.verification_status === 'verified'
                  ? 'Your identity has been successfully verified'
                  : 'Upload required documents to continue'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6"><UserIcon /> Personal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <InputField name="first_name" type="text" label="First Name" />
            <InputField name="last_name" type="text" label="Last Name" />
            <InputField name="email" type="email" label="Email Address" />
            <InputField name="phone" type="tel" label="Phone Number" />
            <InputField name="address_line_1" type="text" label="Address Line 1" />
            <InputField name="address_line_2" type="text" label="Address Line 2 (Optional)" />
            <InputField name="city" type="text" label="City / Town" />
            <InputField name="postcode" type="text" label="Postcode" />
          </div>
        </div>

        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6"><Landmark /> Bank & Tax Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField name="bank_name" type="text" label="Bank Name" />
            <InputField name="bank_account_number" type="text" label="Account Number" />
            <InputField name="bank_sort_code" type="text" label="Sort Code" />
            <InputField name="utr_number" type="text" label="UTR Number" />
          </div>
        </div>
        
        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6">
            <FileUp /> Verification Documents
          </h2>
          <p className="text-sm text-v3-text-muted mb-6">
            Upload clear photos or scans of your documents. Accepted formats: PDF, JPG, PNG. 
            Your account will remain pending until admin verification is complete.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DocumentUploadCard
              documentType="id_card"
              label="Photo ID"
              description="Passport, Driver's License, or National ID"
            />
            <DocumentUploadCard
              documentType="sia_license"
              label="SIA License"
              description="Current SIA Badge or License"
            />
            <DocumentUploadCard
              documentType="passport"
              label="Passport"
              description="UK or EU Passport (if different from Photo ID)"
            />
            <DocumentUploadCard
              documentType="driver_license"
              label="Driver's License"
              description="Valid UK/EU Driver's License (if applicable)"
            />
          </div>
          
          {uploading && (
            <div className="mt-4 flex items-center justify-center text-v3-orange">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Uploading document...
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button type="submit" className="button-refresh w-full sm:w-auto" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentProfile;