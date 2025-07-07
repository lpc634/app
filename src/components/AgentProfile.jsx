import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, User as UserIcon, Landmark } from 'lucide-react';

const AgentProfile = () => {
  const { apiCall } = useAuth();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await apiCall('/agent/profile');
        setFormData(data);
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
        {/* Personal Details Section */}
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

        {/* Bank Details Section */}
        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold text-v3-text-lightest flex items-center gap-3 mb-6"><Landmark /> Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField name="bank_name" type="text" label="Bank Name" />
            <InputField name="bank_account_number" type="text" label="Account Number" />
            <InputField name="bank_sort_code" type="text" label="Sort Code" />
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