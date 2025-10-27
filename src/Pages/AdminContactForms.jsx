import React, { useEffect, useState } from 'react';
import { useAuth } from '../useAuth';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Phone, Mail, Building2, MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status', color: 'bg-v3-bg-dark' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500/20 text-yellow-300' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500/20 text-green-300' },
  { value: 'spam', label: 'Spam', color: 'bg-red-500/20 text-red-300' },
];

export default function AdminContactForms() {
  const { apiCall, user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await apiCall(`/contact-forms${params}`);
      setSubmissions(res.submissions || []);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await apiCall('/contact-forms/stats');
      setStats(res || {});
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadSubmissions();
    loadStats();
  }, [filter]);

  const updateSubmission = async (submissionId, updates) => {
    setUpdating(true);
    try {
      await apiCall(`/contact-forms/${submissionId}`, 'PATCH', updates);
      await loadSubmissions();
      await loadStats();
      if (selectedSubmission?.id === submissionId) {
        const updated = await apiCall(`/contact-forms/${submissionId}`);
        setSelectedSubmission(updated);
      }
    } catch (error) {
      console.error('Failed to update submission:', error);
    } finally {
      setUpdating(false);
    }
  };

  const deleteSubmission = async (submissionId) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    try {
      await apiCall(`/contact-forms/${submissionId}`, 'DELETE');
      await loadSubmissions();
      await loadStats();
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission(null);
      }
    } catch (error) {
      console.error('Failed to delete submission:', error);
    }
  };

  const openDetails = (submission) => {
    setSelectedSubmission(submission);
    setAdminNotes(submission.admin_notes || '');
  };

  const saveNotes = async () => {
    if (!selectedSubmission) return;
    await updateSubmission(selectedSubmission.id, { admin_notes: adminNotes });
  };

  const getStatusBadge = (status) => {
    const statusConfig = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    return (
      <Badge className={`${statusConfig.color} border-0`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-v3-bg-darkest p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-v3-text-lightest">Contact Form Submissions</h1>
          <p className="text-sm text-v3-text-muted mt-1">Manage and track customer inquiries</p>
        </div>
        <Button
          onClick={() => { loadSubmissions(); loadStats(); }}
          variant="outline"
          className="bg-v3-bg-dark border-v3-border text-v3-text"
        >
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
          <div className="text-2xl font-bold text-v3-orange">{stats.total || 0}</div>
          <div className="text-xs text-v3-text-muted mt-1">Total</div>
        </div>
        <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending || 0}</div>
          <div className="text-xs text-v3-text-muted mt-1">Pending</div>
        </div>
        <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.contacted || 0}</div>
          <div className="text-xs text-v3-text-muted mt-1">Contacted</div>
        </div>
        <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{stats.resolved || 0}</div>
          <div className="text-xs text-v3-text-muted mt-1">Resolved</div>
        </div>
        <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{stats.spam || 0}</div>
          <div className="text-xs text-v3-text-muted mt-1">Spam</div>
        </div>
        <div className="bg-v3-bg-dark border border-v3-border rounded-lg p-4">
          <div className="text-2xl font-bold text-v3-orange">{stats.callback_requested || 0}</div>
          <div className="text-xs text-v3-text-muted mt-1">Callbacks</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full md:w-64 bg-v3-bg-dark border-v3-border text-v3-text">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="text-center py-12 text-v3-text-muted">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 text-v3-text-muted">No submissions found</div>
      ) : (
        <div className="space-y-3">
          {submissions.map(submission => (
            <div
              key={submission.id}
              className="bg-v3-bg-dark border border-v3-border rounded-lg p-4 hover:border-v3-orange transition-colors cursor-pointer"
              onClick={() => openDetails(submission)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-v3-text-lightest">
                      {submission.full_name}
                    </h3>
                    {getStatusBadge(submission.status)}
                    {submission.callback_requested && (
                      <Badge className="bg-v3-orange/20 text-v3-orange border-0">
                        <Phone className="w-3 h-3 mr-1" />
                        Callback
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-3">
                    <div className="flex items-center gap-2 text-v3-text">
                      <Mail className="w-4 h-4 text-v3-text-muted" />
                      <span className="truncate">{submission.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-v3-text">
                      <Phone className="w-4 h-4 text-v3-text-muted" />
                      <span>{submission.phone}</span>
                    </div>
                    {submission.company_name && (
                      <div className="flex items-center gap-2 text-v3-text">
                        <Building2 className="w-4 h-4 text-v3-text-muted" />
                        <span className="truncate">{submission.company_name}</span>
                      </div>
                    )}
                  </div>

                  {submission.comments && (
                    <div className="text-sm text-v3-text-muted line-clamp-2 mb-2">
                      {submission.comments}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-v3-text-muted">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(submission.created_at)}
                    </div>
                    {submission.assigned_to_name && (
                      <div>Assigned to: {submission.assigned_to_name}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-v3-bg-darker border-v3-border text-v3-text hover:bg-v3-orange hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(submission);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-3xl bg-v3-bg-darker border border-v3-border text-v3-text max-h-[90vh] overflow-y-auto backdrop-blur-none [&>div]:bg-v3-bg-darker">
          <DialogHeader>
            <DialogTitle className="text-v3-text-lightest">Contact Form Details</DialogTitle>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-v3-text-muted">Name</label>
                  <div className="text-v3-text-lightest font-semibold">{selectedSubmission.full_name}</div>
                </div>
                <div>
                  <label className="text-xs text-v3-text-muted">Email</label>
                  <div className="text-v3-text">
                    <a href={`mailto:${selectedSubmission.email}`} className="text-v3-orange hover:underline">
                      {selectedSubmission.email}
                    </a>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-v3-text-muted">Phone</label>
                  <div className="text-v3-text">
                    <a href={`tel:${selectedSubmission.phone}`} className="text-v3-orange hover:underline">
                      {selectedSubmission.phone}
                    </a>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-v3-text-muted">Company</label>
                  <div className="text-v3-text">{selectedSubmission.company_name || '—'}</div>
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="text-xs text-v3-text-muted mb-2 block">Comments</label>
                <div className="bg-v3-bg-darker border border-v3-border rounded p-3 text-v3-text whitespace-pre-wrap">
                  {selectedSubmission.comments || 'No comments'}
                </div>
              </div>

              {/* GPT Reply */}
              {selectedSubmission.gpt_reply && (
                <div>
                  <label className="text-xs text-v3-text-muted mb-2 block">Auto-Generated Reply (GPT)</label>
                  <div className="bg-v3-bg-darker border border-v3-border rounded p-3 text-v3-text whitespace-pre-wrap">
                    {selectedSubmission.gpt_reply}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <label className="text-xs text-v3-text-muted mb-2 block">Quick Actions</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateSubmission(selectedSubmission.id, { status: 'contacted' })}
                    disabled={updating || selectedSubmission.status === 'contacted'}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30"
                  >
                    Mark as Contacted
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateSubmission(selectedSubmission.id, { status: 'resolved' })}
                    disabled={updating || selectedSubmission.status === 'resolved'}
                    className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30"
                  >
                    Mark as Resolved
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateSubmission(selectedSubmission.id, { status: 'spam' })}
                    disabled={updating || selectedSubmission.status === 'spam'}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
                  >
                    Mark as Spam
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateSubmission(selectedSubmission.id, { status: 'pending' })}
                    disabled={updating || selectedSubmission.status === 'pending'}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30"
                  >
                    Mark as Pending
                  </Button>
                </div>
              </div>

              {/* Status Management */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-v3-text-muted mb-2 block">Current Status</label>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedSubmission.status)}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-v3-text-muted mb-2 block">Callback Requested</label>
                  <div className={`px-3 py-2 rounded border ${selectedSubmission.callback_requested ? 'bg-v3-orange/20 text-v3-orange border-v3-orange/30' : 'bg-v3-bg-darker text-v3-text-muted border-v3-border'}`}>
                    {selectedSubmission.callback_requested ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="text-xs text-v3-text-muted mb-2 block">Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this submission..."
                  className="bg-v3-bg-darker border-v3-border text-v3-text min-h-[100px]"
                />
                <Button
                  onClick={saveNotes}
                  disabled={updating}
                  className="mt-2 bg-v3-orange hover:bg-v3-orange/80 text-white"
                >
                  {updating ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="text-xs text-v3-text-muted">Submitted</label>
                  <div className="text-v3-text">{formatDate(selectedSubmission.created_at)}</div>
                </div>
                {selectedSubmission.contacted_at && (
                  <div>
                    <label className="text-xs text-v3-text-muted">Contacted</label>
                    <div className="text-v3-text">{formatDate(selectedSubmission.contacted_at)}</div>
                  </div>
                )}
                {selectedSubmission.resolved_at && (
                  <div>
                    <label className="text-xs text-v3-text-muted">Resolved</label>
                    <div className="text-v3-text">{formatDate(selectedSubmission.resolved_at)}</div>
                  </div>
                )}
              </div>

              {/* Delete Button */}
              {user?.role === 'admin' && (
                <div className="pt-4 border-t border-v3-border">
                  <Button
                    variant="destructive"
                    onClick={() => deleteSubmission(selectedSubmission.id)}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                  >
                    Delete Submission
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
