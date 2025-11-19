import { useState, useEffect, useMemo } from 'react';
import { X, Edit2, Trash2, Phone, Mail, Building, CheckCircle, FileText, TrendingUp, AlertCircle, Calendar, Clock, MessageSquare, Folder } from 'lucide-react';
import CRMFiles from './CRMFiles';

const CONTACT_TYPES = {
  eviction_client: 'Eviction Client',
  prevention_prospect: 'Prevention Prospect',
  referral_partner: 'Referral Partner'
};

const EVICTION_STAGES = [
  { value: 'new_inquiry', label: 'New Inquiry' },
  { value: 'client_pack_sent', label: 'Client Pack Sent' },
  { value: 'awaiting_instruction', label: 'Awaiting Instruction Form' },
  { value: 'job_booked', label: 'Job Booked' },
  { value: 'job_in_progress', label: 'Job In Progress' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' }
];

const PREVENTION_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'first_contact', label: 'First Contact Made' },
  { value: 'in_discussion', label: 'In Discussion' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'thinking_about_it', label: 'Thinking About It' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
];

export default function CRMContactModal({
  selectedContact,
  notes,
  tasks,
  emails,
  editMode,
  formData,
  setFormData,
  showStageDropdown,
  setShowStageDropdown,
  showPriorityDropdown,
  setShowPriorityDropdown,
  onClose,
  onEdit,
  onDelete,
  onUpdate,
  onCancelEdit,
  onLogCall,
  onQuickNote,
  onAddTask,
  onChangeStage,
  onChangePriority,
  onCompleteTask,
  onSnoozeTask,
  onRefresh,
  getStatusColor,
  formatDate
}) {
  const [activeTab, setActiveTab] = useState('activity');
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [logCallFormData, setLogCallFormData] = useState({
    outcome: 'Connected - Positive',
    duration: '',
    notes: '',
    createFollowup: false
  });
  const [quickNoteFormData, setQuickNoteFormData] = useState({
    note_type: 'general',
    content: ''
  });

  // Unified Timeline: Merge notes, tasks, emails, and files
  const unifiedTimeline = useMemo(() => {
    const timeline = [];

    // Add notes
    notes?.forEach(note => {
      timeline.push({
        type: 'note',
        id: `note-${note.id}`,
        timestamp: new Date(note.created_at),
        data: note
      });
    });

    // Add tasks
    tasks?.forEach(task => {
      timeline.push({
        type: 'task',
        id: `task-${task.id}`,
        timestamp: new Date(task.created_at || task.due_date),
        data: task
      });
    });

    // Add emails
    emails?.forEach(email => {
      timeline.push({
        type: 'email',
        id: `email-${email.id}`,
        timestamp: new Date(email.date || email.created_at),
        data: email
      });
    });

    // Add files
    selectedContact?.files?.forEach(file => {
      timeline.push({
        type: 'file',
        id: `file-${file.id}`,
        timestamp: new Date(file.created_at),
        data: file
      });
    });

    // Sort by timestamp (newest first)
    return timeline.sort((a, b) => b.timestamp - a.timestamp);
  }, [notes, tasks, emails, selectedContact?.files]);

  const handleLogCall = async () => {
    await onLogCall(logCallFormData);
    setShowLogCallModal(false);
    setLogCallFormData({
      outcome: 'Connected - Positive',
      duration: '',
      notes: '',
      createFollowup: false
    });
  };

  const handleQuickNote = async () => {
    await onQuickNote(quickNoteFormData);
    setShowQuickNoteModal(false);
    setQuickNoteFormData({
      note_type: 'general',
      content: ''
    });
  };

  if (!selectedContact) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="dashboard-card max-w-5xl w-full my-4 flex flex-col max-h-[90vh]">
          {/* Fixed Header */}
          <div className="flex-shrink-0 p-6 pb-4 border-b border-v3-bg-darker">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-v3-text-lightest">{selectedContact.name}</h2>
              <div className="flex gap-2">
                {!editMode && (
                  <>
                    <button onClick={onEdit} className="p-2 hover:bg-v3-bg-darker rounded">
                      <Edit2 className="h-5 w-5 text-v3-text-light" />
                    </button>
                    <button onClick={() => onDelete(selectedContact.id)} className="p-2 hover:bg-v3-bg-darker rounded">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </button>
                  </>
                )}
                <button onClick={onClose}>
                  <X className="h-6 w-6 text-v3-text-muted" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            {editMode ? (
              <div className="space-y-4">
                {/* Edit form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-v3-text-light mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="v3-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-v3-text-light mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="v3-input w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={onCancelEdit}
                    className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onUpdate}
                    className="button-refresh"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Quick Actions Bar - Fixed at Top */}
                <div className="sticky top-0 bg-v3-bg-card border-b border-v3-bg-darker p-4 -mx-6 mb-6 z-10 shadow-md">
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setShowLogCallModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Log Call
                    </button>
                    <button
                      onClick={onAddTask}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Add Task
                    </button>
                    <button
                      onClick={() => setShowQuickNoteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      Quick Note
                    </button>
                    <div className="relative stage-dropdown-container">
                      <button
                        onClick={() => setShowStageDropdown(!showStageDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Change Stage
                      </button>
                      {showStageDropdown && (
                        <div className="absolute top-full mt-1 left-0 bg-v3-bg-darker border border-v3-bg-card rounded shadow-lg z-20 min-w-[200px]">
                          <div className="p-2 border-b border-v3-bg-card text-xs text-v3-text-muted">
                            Current: {selectedContact.current_stage}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {(selectedContact.contact_type === 'eviction_client' ? EVICTION_STAGES : PREVENTION_STAGES).map((stage) => (
                              <button
                                key={stage.value}
                                onClick={() => onChangeStage(stage.value)}
                                className={`w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm ${
                                  selectedContact.current_stage === stage.value
                                    ? 'text-v3-brand font-semibold'
                                    : 'text-v3-text-light'
                                }`}
                              >
                                {stage.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative priority-dropdown-container">
                      <button
                        onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded hover:opacity-90 transition-colors ${
                          selectedContact.priority === 'urgent' ? 'bg-red-600' :
                          selectedContact.priority === 'hot' ? 'bg-yellow-600' :
                          selectedContact.priority === 'nurture' ? 'bg-blue-600' :
                          selectedContact.priority === 'routine' ? 'bg-gray-600' :
                          'bg-gray-700'
                        }`}
                      >
                        <AlertCircle className="h-4 w-4" />
                        Priority: {selectedContact.priority === 'urgent' ? '🔴 Urgent' :
                                   selectedContact.priority === 'hot' ? '🟡 Hot' :
                                   selectedContact.priority === 'nurture' ? '🔵 Nurture' :
                                   selectedContact.priority === 'routine' ? '⚪ Routine' :
                                   'None'}
                      </button>
                      {showPriorityDropdown && (
                        <div className="absolute top-full mt-1 left-0 bg-v3-bg-darker border border-v3-bg-card rounded shadow-lg z-20 min-w-[180px]">
                          <div className="p-2 border-b border-v3-bg-card text-xs text-v3-text-muted">
                            Set Priority
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            <button
                              onClick={() => onChangePriority('urgent')}
                              className="w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm text-red-500 font-semibold"
                            >
                              🔴 Urgent
                            </button>
                            <button
                              onClick={() => onChangePriority('hot')}
                              className="w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm text-yellow-500 font-semibold"
                            >
                              🟡 Hot Lead
                            </button>
                            <button
                              onClick={() => onChangePriority('nurture')}
                              className="w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm text-blue-500"
                            >
                              🔵 Nurture
                            </button>
                            <button
                              onClick={() => onChangePriority('routine')}
                              className="w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm text-gray-400"
                            >
                              ⚪ Routine
                            </button>
                            <button
                              onClick={() => onChangePriority('none')}
                              className="w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm text-v3-text-muted"
                            >
                              No Priority
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Details View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-v3-text-muted uppercase mb-3">Contact Info</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-v3-text-muted" />
                        <span className="text-v3-text-light">{selectedContact.email}</span>
                      </div>
                      {selectedContact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-v3-text-muted" />
                          <span className="text-v3-text-light">{selectedContact.phone}</span>
                        </div>
                      )}
                      {selectedContact.company_name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-v3-text-muted" />
                          <span className="text-v3-text-light">{selectedContact.company_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-v3-text-muted uppercase mb-3">Sales Info</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-v3-text-muted">Type: </span>
                        <span className="text-v3-text-light">{CONTACT_TYPES[selectedContact.contact_type]}</span>
                      </div>
                      <div>
                        <span className="text-v3-text-muted">Stage: </span>
                        <span className="text-v3-text-light">{selectedContact.current_stage}</span>
                      </div>
                      <div>
                        <span className="text-v3-text-muted">Status: </span>
                        <span className={getStatusColor(selectedContact.status)}>{selectedContact.status}</span>
                      </div>
                      {selectedContact.next_followup_date && (
                        <div>
                          <span className="text-v3-text-muted">Follow-up: </span>
                          <span className="text-v3-text-light">{formatDate(selectedContact.next_followup_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="border-t border-v3-bg-card pt-6 mb-6">
                  <div className="flex gap-4 border-b border-v3-bg-darker">
                    <button
                      onClick={() => setActiveTab('activity')}
                      className={`flex items-center gap-2 px-4 py-3 -mb-px transition-colors ${
                        activeTab === 'activity'
                          ? 'border-b-2 border-v3-accent text-v3-accent font-semibold'
                          : 'text-v3-text-muted hover:text-v3-text-light'
                      }`}
                    >
                      <Clock className="h-5 w-5" />
                      Activity Timeline ({unifiedTimeline.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('files')}
                      className={`flex items-center gap-2 px-4 py-3 -mb-px transition-colors ${
                        activeTab === 'files'
                          ? 'border-b-2 border-v3-accent text-v3-accent font-semibold'
                          : 'text-v3-text-muted hover:text-v3-text-light'
                      }`}
                    >
                      <Folder className="h-5 w-5" />
                      Files & Documents ({selectedContact.files?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'activity' ? (
                  /* Unified Activity Timeline */
                  <div className="space-y-3">
                    {unifiedTimeline.length === 0 ? (
                      <p className="text-sm text-v3-text-muted text-center py-8">No activity yet. Start by logging a call, adding a task, or creating a note.</p>
                    ) : (
                      unifiedTimeline.map((item) => {
                        // Render based on type
                        if (item.type === 'note') {
                          const note = item.data;
                          return (
                            <div key={item.id} className="p-4 bg-v3-bg-card rounded-lg border-l-4 border-blue-500">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                  <FileText className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-blue-400 uppercase">{note.note_type}</span>
                                    <span className="text-xs text-v3-text-muted">{formatDate(note.created_at)}</span>
                                  </div>
                                  <p className="text-sm text-v3-text-light whitespace-pre-wrap">{note.content}</p>
                                  <p className="text-xs text-v3-text-muted mt-2">by {note.creator_name}</p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'task') {
                          const task = item.data;
                          return (
                            <div key={item.id} className={`p-4 bg-v3-bg-card rounded-lg border-l-4 ${
                              task.status === 'completed' ? 'border-green-500' : task.is_overdue ? 'border-red-500' : 'border-purple-500'
                            }`}>
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                  task.status === 'completed' ? 'bg-green-500/20' : task.is_overdue ? 'bg-red-500/20' : 'bg-purple-500/20'
                                }`}>
                                  <CheckCircle className={`h-5 w-5 ${
                                    task.status === 'completed' ? 'text-green-400' : task.is_overdue ? 'text-red-400' : 'text-purple-400'
                                  }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 text-xs rounded ${
                                        task.status === 'completed'
                                          ? 'bg-green-600/20 text-green-400'
                                          : task.is_overdue
                                          ? 'bg-red-600/20 text-red-400'
                                          : 'bg-purple-600/20 text-purple-400'
                                      }`}>
                                        {task.task_type}
                                      </span>
                                      {task.status === 'completed' && (
                                        <span className="text-xs text-green-400 font-semibold">✓ COMPLETED</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-v3-text-muted">
                                      Due: {new Date(task.due_date).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-v3-text-lightest mb-1">{task.title}</p>
                                  {task.notes && (
                                    <p className="text-xs text-v3-text-light">{task.notes}</p>
                                  )}
                                  {task.status === 'pending' && (
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={() => onCompleteTask(task.id)}
                                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        ✓ Complete
                                      </button>
                                      <button
                                        onClick={() => onSnoozeTask(task.id, '1hour')}
                                        className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                      >
                                        Snooze 1h
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'email') {
                          const email = item.data;
                          return (
                            <div key={item.id} className={`p-4 bg-v3-bg-card rounded-lg border-l-4 ${
                              email.is_sent ? 'border-green-500' : 'border-blue-500'
                            }`}>
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                  email.is_sent ? 'bg-green-500/20' : 'bg-blue-500/20'
                                }`}>
                                  <Mail className={`h-5 w-5 ${email.is_sent ? 'text-green-400' : 'text-blue-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                      email.is_sent ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                                    }`}>
                                      {email.is_sent ? 'SENT' : 'RECEIVED'}
                                    </span>
                                    <span className="text-xs text-v3-text-muted">
                                      {formatDate(email.date || email.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-v3-text-lightest mb-1">{email.subject}</p>
                                  <p className="text-xs text-v3-text-muted">
                                    {email.is_sent ? `To: ${email.recipient}` : `From: ${email.sender}`}
                                  </p>
                                  {email.body_text && (
                                    <p className="text-xs text-v3-text-light mt-2 line-clamp-2">{email.body_text.substring(0, 150)}...</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'file') {
                          const file = item.data;
                          return (
                            <div key={item.id} className="p-4 bg-v3-bg-card rounded-lg border-l-4 border-orange-500">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                  <Folder className="h-5 w-5 text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="px-2 py-0.5 text-xs rounded bg-orange-600/20 text-orange-400">
                                      FILE UPLOADED
                                    </span>
                                    <span className="text-xs text-v3-text-muted">
                                      {formatDate(file.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-v3-text-lightest mb-1">{file.file_name}</p>
                                  <p className="text-xs text-v3-text-muted">
                                    {file.category && file.category !== 'other' ? `${file.category} • ` : ''}
                                    {file.uploaded_by_name || 'Unknown user'}
                                  </p>
                                  {file.description && (
                                    <p className="text-xs text-v3-text-light mt-2">{file.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })
                    )}
                  </div>
                ) : (
                  /* Files & Documents Tab */
                  <CRMFiles
                    contactId={selectedContact.id}
                    files={selectedContact.files || []}
                    onFileUploaded={onRefresh}
                    onFileDeleted={onRefresh}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Log Call Modal */}
      {showLogCallModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="dashboard-card max-w-lg w-full">
            <h3 className="text-lg font-bold text-v3-text-lightest mb-4">Log Phone Call</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Outcome</label>
                <select
                  value={logCallFormData.outcome}
                  onChange={(e) => setLogCallFormData({...logCallFormData, outcome: e.target.value})}
                  className="v3-input w-full"
                >
                  <option>Connected - Positive</option>
                  <option>Connected - Neutral</option>
                  <option>Connected - Negative</option>
                  <option>Voicemail Left</option>
                  <option>No Answer</option>
                  <option>Wrong Number</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={logCallFormData.duration}
                  onChange={(e) => setLogCallFormData({...logCallFormData, duration: e.target.value})}
                  className="v3-input w-full"
                  placeholder="e.g. 5"
                />
              </div>
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Notes *</label>
                <textarea
                  value={logCallFormData.notes}
                  onChange={(e) => setLogCallFormData({...logCallFormData, notes: e.target.value})}
                  className="v3-input w-full"
                  rows="4"
                  placeholder="What was discussed?"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={logCallFormData.createFollowup}
                  onChange={(e) => setLogCallFormData({...logCallFormData, createFollowup: e.target.checked})}
                  id="createFollowup"
                  className="w-4 h-4"
                />
                <label htmlFor="createFollowup" className="text-sm text-v3-text-light">
                  Create follow-up task after logging
                </label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowLogCallModal(false)}
                  className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogCall}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Log Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showQuickNoteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="dashboard-card max-w-lg w-full">
            <h3 className="text-lg font-bold text-v3-text-lightest mb-4">Add Quick Note</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Note Type</label>
                <select
                  value={quickNoteFormData.note_type}
                  onChange={(e) => setQuickNoteFormData({...quickNoteFormData, note_type: e.target.value})}
                  className="v3-input w-full"
                >
                  <option value="general">General Note</option>
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="quote_sent">Quote Sent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Note *</label>
                <textarea
                  value={quickNoteFormData.content}
                  onChange={(e) => setQuickNoteFormData({...quickNoteFormData, content: e.target.value})}
                  className="v3-input w-full"
                  rows="4"
                  placeholder="Enter your note..."
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowQuickNoteModal(false)}
                  className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickNote}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
