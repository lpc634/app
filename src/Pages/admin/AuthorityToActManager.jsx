import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Copy,
  CheckCircle2,
  ExternalLink,
  Download,
  Search,
  FileText,
  Calendar,
  User,
  MapPin,
  Mail,
  Loader2
} from "lucide-react";
import { useAuth } from "@/useAuth";
import { toast } from "sonner";

export default function AuthorityToActManager() {
  const { apiCall } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permanentLink, setPermanentLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch or create permanent link
      const linkResponse = await apiCall('/admin/authority-to-act/permanent-link');
      if (linkResponse?.url) {
        setPermanentLink(linkResponse.url);
      }

      // Fetch all submissions
      const submissionsResponse = await apiCall('/admin/authority-to-act/submissions');
      if (submissionsResponse?.submissions) {
        setSubmissions(submissionsResponse.submissions);
      }
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(permanentLink);
      setCopiedLink(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const downloadPdf = async (submissionId) => {
    try {
      setDownloadingPdf(submissionId);

      const response = await fetch(`/api/admin/authority-to-act/submissions/${submissionId}/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to download PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `authority-to-act-${submissionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("PDF downloaded successfully");
    } catch (err) {
      toast.error("Failed to download PDF");
      console.error(err);
    } finally {
      setDownloadingPdf(null);
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sub.client_name?.toLowerCase().includes(search) ||
      sub.client_email?.toLowerCase().includes(search) ||
      sub.property_address?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: submissions.length,
    thisWeek: submissions.filter(s => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(s.submitted_at) > weekAgo;
    }).length,
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authority to Act Forms</h1>
        <p className="text-muted-foreground mt-2">
          Share the form link with clients to collect Authority to Act submissions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All time submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Submissions in last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Permanent Link Card */}
      <Card>
        <CardHeader>
          <CardTitle>Form Link</CardTitle>
          <CardDescription>
            Share this permanent link with clients. The form is always accessible via this URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={permanentLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              onClick={copyToClipboard}
              variant={copiedLink ? "secondary" : "default"}
              className="shrink-0"
            >
              {copiedLink ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(permanentLink, "_blank")}
              className="shrink-0"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
          </div>

          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              This is a permanent link that can be used multiple times. Each submission will appear in the list below.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Form Submissions</CardTitle>
              <CardDescription>View and download all submitted forms</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No submissions yet</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm
                  ? "No submissions match your search"
                  : "Share the form link with clients to start receiving submissions"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubmissions.map((submission) => (
                <Card key={submission.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        {/* Client Name */}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-lg">
                            {submission.client_name || "Unknown Client"}
                          </span>
                          <Badge variant="secondary" className="ml-2">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(submission.submitted_at).toLocaleDateString()}
                          </Badge>
                        </div>

                        {/* Email */}
                        {submission.client_email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>{submission.client_email}</span>
                          </div>
                        )}

                        {/* Property Address */}
                        {submission.property_address && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{submission.property_address}</span>
                          </div>
                        )}

                        {/* Submission Time */}
                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(submission.submitted_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdf(submission.id)}
                          disabled={downloadingPdf === submission.id}
                        >
                          {downloadingPdf === submission.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
