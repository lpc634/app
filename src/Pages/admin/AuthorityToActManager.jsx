import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SubmissionDetails from "@/components/admin/authority-to-act/SubmissionDetails";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy,
  CheckCircle2,
  ExternalLink,
  Download,
  Search,
  FileText,
  Calendar,
  Loader2,
  Circle,
  CircleDot,
  Mail
} from "lucide-react";
import { useAuth } from "@/useAuth";
import { toast } from "sonner";

const FORM_TYPES = [
  { value: "authority-to-act-squatter-eviction", label: "Authority to Act - Squatter Eviction" },
  { value: "authority-to-act-traveller-eviction", label: "Authority to Act - Traveller Eviction" },
];

export default function AuthorityToActManager() {
  const { apiCall } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormType, setSelectedFormType] = useState(FORM_TYPES[0].value);
  const [permanentLink, setPermanentLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedFormType]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch or create permanent link for selected form type
      const linkResponse = await apiCall(`/admin/authority-to-act/permanent-link?form_type=${selectedFormType}`);
      if (linkResponse?.url) {
        setPermanentLink(linkResponse.url);
      }

      // Fetch all submissions for selected form type
      const submissionsResponse = await apiCall(`/admin/authority-to-act/submissions?form_type=${selectedFormType}`);
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

  const markAsRead = async (submissionId) => {
    try {
      await apiCall(`/admin/authority-to-act/submissions/${submissionId}/mark-read`, {
        method: 'POST'
      });

      // Update local state
      setSubmissions(prev => prev.map(sub =>
        sub.id === submissionId ? { ...sub, is_read: true } : sub
      ));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const openSubmission = async (submission) => {
    setSelectedSubmission(submission);
    setShowDetailDialog(true);

    // Mark as read if not already
    if (!submission.is_read) {
      await markAsRead(submission.id);
    }
  };

  const downloadPdf = async (submissionId, e) => {
    e.stopPropagation(); // Prevent row click
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

  const openEmailDialog = () => {
    setEmailRecipient("");
    setEmailMessage("");
    setShowEmailDialog(true);
  };

  const sendEmail = async () => {
    if (!emailRecipient || !emailMessage) {
      toast.error("Please enter recipient email and message");
      return;
    }

    try {
      setSendingEmail(true);
      const formTypeLabel = FORM_TYPES.find(t => t.value === selectedFormType)?.label;

      await apiCall('/admin/authority-to-act/send-email', {
        method: 'POST',
        body: JSON.stringify({
          recipient_email: emailRecipient,
          message_body: emailMessage,
          form_link: permanentLink,
          form_type_label: formTypeLabel
        })
      });

      toast.success("Email sent successfully!");
      setShowEmailDialog(false);
      setEmailRecipient("");
      setEmailMessage("");
    } catch (err) {
      const errorMessage = err?.message || "Failed to send email";
      toast.error(errorMessage);
      console.error("Email send error:", err);
    } finally {
      setSendingEmail(false);
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
    unread: submissions.filter(s => !s.is_read).length,
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
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
            <CircleDot className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unread}</div>
            <p className="text-xs text-muted-foreground">
              New submissions to review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Form Type Selection & Link Card */}
      <Card>
        <CardHeader>
          <CardTitle>Form Link</CardTitle>
          <CardDescription>
            Select a form type and share the permanent link with clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form Type Dropdown */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Form Type</label>
            <Select value={selectedFormType} onValueChange={setSelectedFormType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select form type" />
              </SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Permanent Link */}
          <div>
            <label className="text-sm font-medium mb-2 block">Form Link</label>
            <div className="flex gap-2">
              <Input
                value={permanentLink || "Loading..."}
                readOnly
                className="font-mono text-sm"
                placeholder="Select a form type to generate link"
              />
              <Button
                onClick={copyToClipboard}
                variant={copiedLink ? "secondary" : "default"}
                className="shrink-0"
                disabled={!permanentLink}
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
                disabled={!permanentLink}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
              <Button
                variant="outline"
                onClick={openEmailDialog}
                className="shrink-0"
                disabled={!permanentLink}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            </div>
          </div>

          {permanentLink && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                This is a permanent link for {FORM_TYPES.find(t => t.value === selectedFormType)?.label}. It can be used multiple times and each submission will appear in the list below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entries ({filteredSubmissions.length})</CardTitle>
              <CardDescription>Click on any row to view full details</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search submissions..."
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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-sm w-8"></th>
                    <th className="text-left p-3 font-medium text-sm">Status</th>
                    <th className="text-left p-3 font-medium text-sm">Submitted</th>
                    <th className="text-left p-3 font-medium text-sm">Name</th>
                    <th className="text-left p-3 font-medium text-sm">Company</th>
                    <th className="text-left p-3 font-medium text-sm">Email</th>
                    <th className="text-left p-3 font-medium text-sm">Phone</th>
                    <th className="text-left p-3 font-medium text-sm">Address</th>
                    <th className="text-left p-3 font-medium text-sm w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => (
                    <tr
                      key={submission.id}
                      onClick={() => openSubmission(submission)}
                      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        {!submission.is_read ? (
                          <Circle className="h-4 w-4 fill-green-600 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-transparent" />
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary">Submitted</Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(submission.submitted_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 text-sm font-medium">
                        {submission.client_name || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {submission.submission_data?.company || '-'}
                      </td>
                      <td className="p-3 text-sm text-blue-600">
                        {submission.client_email || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {submission.submission_data?.client_phone || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {submission.property_address || '-'}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => downloadPdf(submission.id, e)}
                          disabled={downloadingPdf === submission.id}
                        >
                          {downloadingPdf === submission.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog (V3-styled) */}
      <SubmissionDetails
        submission={selectedSubmission}
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        onMarkRead={async (id, next) => {
          try {
            await apiCall(`/admin/authority-to-act/submissions/${id}/${next ? 'mark-read' : 'mark-unread'}`, { method: 'POST' });
            setSubmissions(prev => prev.map(s => s.id === id ? { ...s, is_read: !!next } : s));
          } catch {}
        }}
        onPrint={() => window.print()}
      />

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Send Form Link via Email</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send the {FORM_TYPES.find(t => t.value === selectedFormType)?.label} link to a client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-foreground">Recipient Email</label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="bg-background border-input text-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-foreground">Message</label>
              <Textarea
                placeholder="Enter your message to the client..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={6}
                className="resize-none bg-background border-input text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-2">
                The form link will be automatically included in the email.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowEmailDialog(false)}
                disabled={sendingEmail}
                className="border-border hover:bg-accent"
              >
                Cancel
              </Button>
              <Button
                onClick={sendEmail}
                disabled={sendingEmail || !emailRecipient || !emailMessage}
                className="bg-primary hover:bg-primary/90"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
