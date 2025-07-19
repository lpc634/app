import React, 'useState'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Shield, Loader2 } from 'lucide-react'

const InputField = ({ name, type, placeholder, required = true, group = false, value, onChange }) => (
    <div className={group ? 'md:col-span-2' : ''}>
        <label htmlFor={name} className="block text-sm font-medium text-v3-text-light capitalize">{placeholder}</label>
        <input
            id={name} name={name} type={type} required={required} value={value}
            onChange={onChange} placeholder={`Enter ${placeholder.toLowerCase()}`}
            className="mt-1 block w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
        />
    </div>
);

const SignUpPage = () => {
    const navigate = useNavigate();
    // --- CHANGE 1: Added new fields to the form's state ---
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', email: '', password: '', phone: '',
        address_line_1: '', address_line_2: '', city: '', postcode: '',
        bank_name: '', bank_account_number: '', bank_sort_code: '',
        utr_number: '', 
        tax_confirmation: false
    });
    const [loading, setLoading] = useState(false);

    // --- CHANGE 2: Updated handleChange to work for both text inputs and checkboxes ---
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // --- CHANGE 3: Added validation to ensure the checkbox is ticked ---
        if (!formData.tax_confirmation) {
            toast.error('Confirmation Required', {
                description: 'You must confirm your tax responsibility to create an account.',
            });
            return; 
        }

        setLoading(true);
        try {
            const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

            // The new form data will be sent automatically
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to register');
            }
            toast.success('Registration successful!', { description: 'You can now log in with your new credentials.' });
            navigate('/login');
        } catch (error) {
            toast.error('Registration Failed', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-v3-bg-darkest flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-v3-orange to-v3-orange-dark">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-v3-text-lightest">Create your Agent Account</h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-3xl">
                <div className="dashboard-card py-8 px-4 sm:px-10">
                    <form className="space-y-8" onSubmit={handleSubmit}>
                        <div>
                            <h3 className="text-lg font-medium text-v3-text-lightest">Personal & Login Details</h3>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField name="first_name" type="text" placeholder="First Name" value={formData.first_name} onChange={handleChange} />
                                <InputField name="last_name" type="text" placeholder="Last Name" value={formData.last_name} onChange={handleChange} />
                                <InputField name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
                                <InputField name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} />
                                <InputField name="phone" type="tel" placeholder="Phone Number" group={true} value={formData.phone} onChange={handleChange} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-v3-text-lightest">Address</h3>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField name="address_line_1" type="text" placeholder="Address Line 1" group={true} value={formData.address_line_1} onChange={handleChange} />
                                <InputField name="address_line_2" type="text" placeholder="Address Line 2 (Optional)" required={false} group={true} value={formData.address_line_2} onChange={handleChange} />
                                <InputField name="city" type="text" placeholder="City / Town" value={formData.city} onChange={handleChange} />
                                <InputField name="postcode" type="text" placeholder="Postcode" value={formData.postcode} onChange={handleChange} />
                            </div>
                        </div>
                        
                        <div>
                           <h3 className="text-lg font-medium text-v3-text-lightest">Bank & Tax Details for Invoicing</h3>
                           <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField name="bank_name" type="text" placeholder="Bank Name" value={formData.bank_name} onChange={handleChange} />
                                <InputField name="bank_account_number" type="text" placeholder="Account Number" value={formData.bank_account_number} onChange={handleChange} />
                                <InputField name="bank_sort_code" type="text" placeholder="Sort Code" value={formData.bank_sort_code} onChange={handleChange} />
                                {/* --- CHANGE 4: Added the UTR Number input field --- */}
                                <InputField name="utr_number" type="text" placeholder="UTR Number" value={formData.utr_number} onChange={handleChange} />
                           </div>
                        </div>

                        {/* --- CHANGE 5: Added the tax confirmation checkbox --- */}
                        <div className="space-y-2">
                            <div className="flex items-start space-x-3">
                                <input
                                    id="tax_confirmation"
                                    name="tax_confirmation"
                                    type="checkbox"
                                    checked={formData.tax_confirmation}
                                    onChange={handleChange}
                                    className="h-4 w-4 mt-1 rounded border-v3-border text-v3-orange focus:ring-v3-orange"
                                />
                                <div className="text-sm">
                                    <label htmlFor="tax_confirmation" className="font-medium text-v3-text-light">
                                        Tax & National Insurance Confirmation
                                    </label>
                                    <p className="text-v3-text-muted">
                                        I confirm that I am responsible for any Tax or National Insurance due on all invoices that I have submitted to V3 Services Ltd.
                                    </p>
                                </div>
                            </div>
                        </div>


                        <div>
                            <button type="submit" disabled={loading} className="w-full button-refresh flex justify-center py-3">
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</> : 'Create Account'}
                            </button>
                        </div>
                    </form>
                     <div className="text-sm text-center mt-6">
                        <Link to="/login" className="font-medium text-v3-orange hover:text-v3-orange-dark">
                            Already have an account? Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;