import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import ClientAuthorityToActSquatterEviction from "@/components/forms/ClientInstructionFormAuthorityToActSquatterEviction";

// Minimal V3 dark styling for the public success page (parity with form theme)
const V3_SUCCESS_CSS = String.raw`
:root, .dark {
  --v3-orange:#FF6A2B; --v3-orange-dark:#D84E17; --v3-orange-glow:rgba(255,106,43,.45);
  --v3-bg-darkest:#0D0D0E; --v3-bg-dark:#141416; --v3-bg:#111114; --v3-bg-card:#15161A; --v3-border:#2B2D33;
  --v3-text-strong:#F8F8FA; --v3-text:#E6E6EA; --v3-text-muted:#9CA3AF;
}
.v3-success-root{ min-height:100vh; background:
  radial-gradient(circle at 20% 80%, rgba(255, 106, 43, 0.15) 0%, transparent 50%),
  radial-gradient(circle at 80% 20%, rgba(255, 106, 43, 0.1) 0%, transparent 50%),
  radial-gradient(circle at 40% 40%, rgba(255, 106, 43, 0.05) 0%, transparent 50%),
  linear-gradient(135deg, var(--v3-bg-darkest) 0%, #0A0A0B 50%, #050505 100%);
  color:var(--v3-text);
}
.star-border-container{ display:block; position:relative; border-radius:20px; overflow:hidden; width:100% }
.border-gradient-bottom{ position:absolute; width:300%; height:50%; opacity:.7; bottom:-12px; right:-250%; border-radius:50%; animation:star-movement-bottom linear infinite alternate; z-index:0; pointer-events:none; will-change:transform, opacity }
.border-gradient-top{ position:absolute; width:300%; height:50%; opacity:.7; top:-12px; left:-250%; border-radius:50%; animation:star-movement-top linear infinite alternate; z-index:0; pointer-events:none; will-change:transform, opacity }
.inner-content{ position:relative; border:1px solid var(--v3-border); background:rgba(17,17,20,.6); backdrop-filter:blur(8px); color:var(--v3-text); font-size:16px; padding:24px; border-radius:20px; z-index:1; box-shadow: inset 0 0 0 1px var(--v3-orange) }
@keyframes star-movement-bottom{ 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(-100%,0);opacity:0} }
@keyframes star-movement-top{ 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(100%,0);opacity:0} }
`;

export default function PublicAuthorityToActPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchFormData();
  }, [token]);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/form/${token}`);

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
      // Add client_name, client_email, property_address to top level for backend filtering
      const payload = {
        ...submissionData,
        client_name: `${submissionData.firstName} ${submissionData.lastName}`,
        client_email: submissionData.email,
        property_address: `${submissionData.siteAddress.line1}, ${submissionData.siteAddress.city}, ${submissionData.siteAddress.postcode}`,
      };

      const response = await fetch(`/api/form/${token}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      setSubmitted(true);
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div className="v3-success-root" style={{minHeight:'100vh', display:'grid', placeItems:'center', padding:'24px'}}>
        <style>{V3_SUCCESS_CSS}</style>
        <div style={{width:'100%', maxWidth:520, padding:'0 12px'}}>
          <div className="star-border-container">
            <div className="border-gradient-top"/>
            <div className="inner-content" style={{textAlign:'center'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16}}>
                <div style={{width:56, height:56, borderRadius:'50%', background:'rgba(34,197,94,.12)', display:'grid', placeItems:'center', border:'1px solid rgba(34,197,94,.35)'}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              </div>
              <h1 style={{fontSize:'1.5rem', fontWeight:800, color:'var(--v3-text-strong)', marginBottom:8}}>Form Submitted Successfully</h1>
              <p style={{color:'var(--v3-text)'}}>Thank you for submitting the Authority to Act form.</p>
              <p style={{color:'var(--v3-text-muted)', fontSize:14, marginTop:8}}>V3 Services has been notified and will be in touch with you shortly.</p>
            </div>
            <div className="border-gradient-bottom"/>
          </div>
        </div>
      </div>
    );
  }

  // Render the actual form in a controlled scroll container
  return (
    <div
      id="form-scroll-root"
      ref={scrollRef}
      style={{
        minHeight: "100vh",
        overflowY: "auto",
        position: "relative",
      }}
    >
      <ClientAuthorityToActSquatterEviction
        onSubmit={handleSubmit}
        scrollContainer={scrollRef.current}
      />
    </div>
  );
}
