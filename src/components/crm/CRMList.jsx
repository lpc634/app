import { Mail, Phone, Building, Calendar, Eye } from 'lucide-react';

const CONTACT_TYPES = {
  eviction_client: 'Eviction Client',
  prevention_prospect: 'Prevention Prospect',
  referral_partner: 'Referral Partner'
};

export default function CRMList({
  contacts,
  loading,
  crmUser,
  syncingEmails,
  onContactClick,
  onSyncEmails,
  onShowEmails,
  onAddTask,
  getStatusColor,
  getPriorityBadge,
  formatDate,
  formatCurrency
}) {
  return (
    <div className="dashboard-card !p-4">
      {loading ? (
        <p className="text-center text-v3-text-muted py-6">Loading contacts...</p>
      ) : contacts.length === 0 ? (
        <p className="text-center text-v3-text-muted py-6">No contacts found</p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => onContactClick(contact.id)}
              className="p-5 bg-v3-bg-card rounded-lg hover:bg-v3-bg-darker cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-v3-text-lightest">{contact.name}</h3>
                    <span className="px-2.5 py-1 bg-v3-brand/20 text-v3-brand text-xs rounded font-medium">
                      {CONTACT_TYPES[contact.contact_type]}
                    </span>
                    <span className={`px-2.5 py-1 text-xs rounded font-medium ${getStatusColor(contact.status)}`}>
                      {contact.status}
                    </span>
                    {getPriorityBadge(contact.priority)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-v3-text-light mb-4">
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    {contact.company_name && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{contact.company_name}</span>
                      </div>
                    )}
                    {contact.next_followup_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Follow-up: {formatDate(contact.next_followup_date)}</span>
                      </div>
                    )}
                  </div>

                  {contact.potential_value && (
                    <div className="mb-4 text-sm">
                      <span className="text-v3-text-muted">Potential: </span>
                      <span className="font-semibold text-green-600">{formatCurrency(contact.potential_value)}</span>
                    </div>
                  )}

                  {/* Email sync buttons */}
                  <div className="flex gap-3 mt-5 pt-4 border-t border-gray-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSyncEmails(contact.id);
                      }}
                      disabled={syncingEmails || !crmUser?.has_email_configured}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {syncingEmails ? 'Syncing...' : '📧 Sync Emails'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowEmails(contact);
                      }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      📨 View Emails ({contact.email_count || 0})
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTask(contact);
                      }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      ⏰ Add Task {contact.task_count > 0 && `(${contact.task_count})`}
                    </button>
                  </div>
                </div>

                <Eye className="h-5 w-5 text-v3-text-muted flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
