import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Shield, Loader2 } from 'lucide-react';

const SignUpPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', email: '', password: '', phone: '',
        address_line_1: '', address_line_2: '', city: '', postcode: '',
        bank_name: '', bank_account_number: '', bank_sort_code: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Define the API URL to work in both development and production
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

            // Use the full, correct URL for the API call
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

    const InputField = ({ name, type, placeholder, required = true, group = false }) => (
        <div className={group ? 'md:col-span-2' : ''}>
            <label htmlFor={name} className="block text-sm font-medium text-v3-text-light capitalize">{placeholder}</label>
            <input
                id={name} name={name} type={type} required={required} value={formData[name]}
                onChange={handleChange} placeholder={`Enter ${placeholder.toLowerCase()}`}
                className="mt-1 block w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
            />
        </div>
    );

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
                                <InputField name="first_name" type="text" placeholder="First Name" />
                                <InputField name="last_name" type="text" placeholder="Last Name" />
                                <InputField name="email" type="email" placeholder="Email Address" />
                                <InputField name="password" type="password" placeholder="Password" />
                                <InputField name="phone" type="tel" placeholder="Phone Number" group={true}/>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-v3-text-lightest">Address</h3>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField name="address_line_1" type="text" placeholder="Address Line 1" group={true} />
                                <InputField name="address_line_2" type="text" placeholder="Address Line 2 (Optional)" required={false} group={true} />
                                <InputField name="city" type="text" placeholder="City / Town" />
                                <InputField name="postcode" type="text" placeholder="Postcode" />
                            </div>
                        </div>
                        
                        <div>
                           <h3 className="text-lg font-medium text-v3-text-lightest">Bank Details for Invoicing</h3>
                           <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField name="bank_name" type="text" placeholder="Bank Name" />
                                <InputField name="bank_account_number" type="text" placeholder="Account Number" />
                                <InputField name="bank_sort_code" type="text" placeholder="Sort Code" group={true}/>
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