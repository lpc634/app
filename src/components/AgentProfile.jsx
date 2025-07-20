import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, User as UserIcon, Landmark, FileUp, CheckCircle, Image as ImageIcon } from 'lucide-react';

const AgentProfile = () => {
  const { user, loading, apiCall } = useAuth();
  const [formData, setFormData] = useState({});
  
  // State for the file objects themselves
  const [idFile, setIdFile] = useState(null);
  const [siaFile, setSiaFile] = useState(null);

  // --- NEW: State for the image previews ---
  const [idPreview, setIdPreview] = useState(null);
  const [siaPreview, setSiaPreview] = useState(null);
  
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
      // Set existing previews from S3 URLs
      if (user.id_document_url) setIdPreview(user.id_document_url);
      if (user.sia_document_url) setSiaPreview(user.sia_document_url);
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  // --- NEW: Reusable function to handle file selection and create previews ---
  const handleFileChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // First, update the text-based profile data
      await apiCall('/agent/profile', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      // Second, if there are new files, upload them
      if (idFile || siaFile) {
        const uploadData = new FormData();
        if (idFile) {
            uploadData.append('id_document', idFile);
        }
        if (siaFile) {
            uploadData.append('sia_document', siaFile);
        }
        
        await apiCall('/agent/upload-documents', {
          method: 'POST',
          body: uploadData,
        });
      }
      
      toast.success('Profile updated successfully! Refreshing to see changes.');
      setTimeout(() => window.location.reload(), 2000);

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

  // --- UPDATED: This component now shows the image preview ---
  const FileInputField = ({ name, label, onChange, fileName, previewUrl }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-v3-text-light">{label}</label>
      <div className="mt-1">
        {previewUrl ? (
          <div className="flex items-center">
            <img src={previewUrl} alt="Preview" className="h-20 w-auto rounded-md border mr-4" />
            <label htmlFor={name} className="cursor-pointer text-sm text-v3-orange hover:underline">
              Change file
            </label>
            <input id={name} name={name} type="file" className="sr-only" onChange={onChange} accept="image/*,application/pdf" />
          </div>
        ) : (
          <div className="flex items-center">
            <label htmlFor={name} className="cursor-pointer bg-v3-bg-dark border border-v3-border rounded-md py-2 px-3 text-sm text-v3-text-lightest hover:bg-v3-bg-light">
              <FileUp className="inline-block h-4 w-4 mr-2" />
              Choose File
            </label>
            <input id={name} name={name} type="file" className="sr-only" onChange={onChange} accept="image/*,application/pdf" />
            {fileName && <span className="ml-3 text-sm text-v3-text-muted">{fileName}</span>}
          </div>
        )}
      </div>
    </div>
  );

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
              !user.id_document_url && !user.sia_document_url 
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
                  !user.id_document_url && !user.sia_document_url 
                    ? 'Documents Required'
                    : user.verification_status === 'pending' 
                    ? 'Under Review'
                    : user.verification_status === 'verified'
                    ? 'Verified ✓'
                    : 'Documents Required'
                }
              </h3>
              <p className="text-sm text-v3-text-muted mt-1">
                {!user.id_document_url && !user.sia_document_url 
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
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6"><FileUp /> Verification Documents</h2>
          <p className="text-sm text-v3-text-muted mb-6">Upload clear photos of your documents. Your account will remain pending until admin verification is complete.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FileInputField 
              name="id_document" 
              label="Passport or Driver's License" 
              onChange={(e) => handleFileChange(e, setIdFile, setIdPreview)}
              fileName={idFile?.name}
              previewUrl={idPreview}
            />
            <FileInputField 
              name="sia_document" 
              label="SIA Badge" 
              onChange={(e) => handleFileChange(e, setSiaFile, setSiaPreview)}
              fileName={siaFile?.name}
              previewUrl={siaPreview}
            />
          </div>
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