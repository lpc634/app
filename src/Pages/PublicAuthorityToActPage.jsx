import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

export default function PublicAuthorityToActPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchFormData();
  }, [token]);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/authority-to-act/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("This link is invalid or does not exist.");
        } else if (response.status === 410) {
          setError("This link has expired or has already been used.");
        } else {
          setError("Unable to load form. Please contact V3 Services.");
        }
        return;
      }

      const data = await response.json();
      setFormData(data);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (submissionData) => {
    try {
      const response = await fetch(`/api/public/authority-to-act/${token}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      setSubmitted(true);
    } catch (err) {
      alert("Error submitting form: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Form</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact V3 Services for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Submitted Successfully</h1>
          <p className="text-gray-600 mb-4">
            Thank you for submitting the Authority to Act form.
          </p>
          <p className="text-sm text-gray-500">
            V3 Services has been notified and will be in touch with you shortly.
          </p>
        </div>
      </div>
    );
  }

  // User will add their form component here
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Authority to Act
          </h1>
          <p className="text-gray-600 mb-8">
            Squatter Eviction Services - Client Instruction Form
          </p>

          {/* User will replace this placeholder with their actual form */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-500">
              Form component will be added here by user
            </p>
            <p className="text-sm text-gray-400 mt-2">
              File: ClientInstructionFormAuthorityToActSquatterEviction.tsx
            </p>
          </div>

          {/* Example of how to use the form data and submit handler */}
          {formData && (
            <div className="mt-4 p-4 bg-gray-50 rounded text-sm">
              <p className="font-medium mb-2">Pre-filled data (if any):</p>
              <ul className="space-y-1 text-gray-600">
                {formData.client_name && <li>Client: {formData.client_name}</li>}
                {formData.client_email && <li>Email: {formData.client_email}</li>}
                {formData.property_address && <li>Property: {formData.property_address}</li>}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={() => handleSubmit({ test: "data" })}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Test Submit (will be replaced by actual form)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
