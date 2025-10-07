import { useState, useEffect } from "react";
import { Copy, CheckCircle2, ExternalLink, Clock, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/useAuth";

export default function AuthorityToActManager() {
  const { user } = useAuth();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Form state for generating new link
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    property_address: "",
    expires_in_days: 30,
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const response = await fetch("/api/admin/authority-to-act/links", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch links");

      const data = await response.json();
      setLinks(data.links || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const token = localStorage.getItem("access_token");
      const response = await fetch("/api/admin/authority-to-act/generate-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to generate link");

      const data = await response.json();

      // Copy URL to clipboard immediately
      await navigator.clipboard.writeText(data.url);
      setCopiedId(data.id);
      setTimeout(() => setCopiedId(null), 3000);

      // Reset form and refresh list
      setFormData({
        client_name: "",
        client_email: "",
        property_address: "",
        expires_in_days: 30,
      });
      setShowForm(false);
      fetchLinks();
    } catch (err) {
      alert("Error generating link: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (url, id) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      alert("Failed to copy to clipboard");
    }
  };

  const getStatusBadge = (link) => {
    if (link.status === "submitted") {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Submitted</span>;
    }
    if (!link.is_valid) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Expired</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Pending</span>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Authority to Act Forms</h1>
          <p className="text-sm text-gray-600 mt-1">
            Generate secure links for clients to submit Authority to Act forms
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? "Cancel" : "+ Generate New Link"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Generate New Link</h2>
          <form onSubmit={generateLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name (optional)
              </label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Email (optional)
              </label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Address (optional)
              </label>
              <input
                type="text"
                value={formData.property_address}
                onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123 Main Street, London, SW1A 1AA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link Expires In (days)
              </label>
              <input
                type="number"
                value={formData.expires_in_days}
                onChange={(e) => setFormData({ ...formData, expires_in_days: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                max="365"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave as 30 for default (30 days), or set to 0 for no expiration
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? "Generating..." : "Generate & Copy Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generated Links ({links.length})</h2>

        {links.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600">No links generated yet.</p>
            <p className="text-sm text-gray-500 mt-1">Click "Generate New Link" to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(link)}
                      <span className="text-xs text-gray-500">
                        Created {new Date(link.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {link.client_name && (
                      <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{link.client_name}</span>
                        {link.client_email && <span className="text-gray-500">({link.client_email})</span>}
                      </div>
                    )}

                    {link.property_address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{link.property_address}</span>
                      </div>
                    )}

                    {link.expires_at && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          Expires {new Date(link.expires_at).toLocaleDateString()} at{" "}
                          {new Date(link.expires_at).toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    {link.submitted_at && (
                      <div className="mt-2 text-sm text-green-700 font-medium">
                        ✓ Submitted {new Date(link.submitted_at).toLocaleDateString()} at{" "}
                        {new Date(link.submitted_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(link.url, link.id)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Copy link"
                    >
                      {copiedId === link.id ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Open link"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-gray-50 rounded font-mono text-xs text-gray-600 break-all">
                  {link.url}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
