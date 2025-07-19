import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, User as UserIcon, Landmark, FileUp } from 'lucide-react';

const AgentProfile = () => {
  const { apiCall } = useAuth();
  // --- CHANGE 1: Added state for all fields, including files ---
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address_line_1: '', address_line_2: '', city: '', postcode: '',
    bank_name: '', bank_account_number: '', bank_sort_code: '',
    utr_number: ''
  });
  const [idFile, setIdFile] = useState(null);
  const [siaFile, setSiaFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await apiCall('/agent/profile');
        // --- CHANGE 2: Ensure all form fields are populated from the API, providing fallbacks ---
        setFormData({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || '',
            phone: data.phone || '',
            address_line_1: data.address_line_1 || '',
            address_line_2: data.address_line_2 || '',
            city: data.city || '',
            postcode: data.postcode || '',
            bank_name: data.bank_name || '',
            bank_account_number: data.bank_account_number || '',
            bank_sort_code: data.bank_sort_code || '',
            utr_number: data.utr_number || ''
        });
      } catch (error) {
        toast.error('Failed to load profile', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [apiCall]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- CHANGE 3: Added handlers for file inputs ---
  const handleIdFileChange = (e) => {
    setIdFile(e.target.files[0]);
  };

  const handleSiaFileChange = (e) => {
    setSiaFile(e.target.files[0]);
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

      // Next, upload the files if they have been selected
      const uploadData = new FormData();
      if (idFile) uploadData.append('id_document', idFile);
      if (siaFile) uploadData.append('sia_document', siaFile);
      
      if (idFile || siaFile) {
        // This uses a new backend endpoint we will create
        await apiCall('/agent/upload-documents', {
          method: 'POST',
          body: uploadData,
          // Important: Let the browser set the Content-Type header for FormData
          headers: {} 
        });
      }

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
        className="mt-1 block w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-v3-orange focus:border-v3-orange disabled:opacity-50"
      />
    </div>
  );

  // --- CHANGE 4: Added a component for the file input UI ---
  const FileInputField = ({ name, label, onChange, fileName }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-v3-text-light">{label}</label>
      <div className="mt-1 flex items-center">
        <label htmlFor={name} className="cursor-pointer bg-v3-bg-dark border border-v3-border rounded-md py-2 px-3 text-sm text-v3-text-lightest hover:bg-v3-bg-light">
          Choose File
        </label>
        <input id={name} name={name} type="file" className="sr-only" onChange={onChange} />
        {fileName && <span className="ml-3 text-sm text-v3-text-muted">{fileName}</span>}
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">View and update your personal and invoicing details.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6"><UserIcon /> Personal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField name="first_name" type="text" label="First Name" />
            <InputField name="last_name" type="text" label="Last Name" />
            <InputField name="email" type="email" label="Email Address" disabled={true} />
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
        
        {/* --- CHANGE 5: Added the new document upload section --- */}
        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6"><FileUp /> Verification Documents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FileInputField 
              name="id_document" 
              label="Passport or Driver's License" 
              onChange={handleIdFileChange}
              fileName={idFile?.name}
            />
            <FileInputField 
              name="sia_document" 
              label="SIA Badge" 
              onChange={handleSiaFileChange}
              fileName={siaFile?.name}
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