import { Building, Clock } from 'lucide-react';

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

const REFERRAL_PARTNER_STAGES = [
  { value: 'new_partner', label: 'New Partner' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export default function CRMKanban({
  contacts,
  loading,
  typeFilter,
  onContactClick,
  onStageChange,
  getPriorityBadge,
  formatCurrency
}) {
  const getKanbanStages = (contactType) => {
    if (!contactType || contactType === 'all') {
      return {
        eviction_client: EVICTION_STAGES,
        prevention_prospect: PREVENTION_STAGES,
        referral_partner: REFERRAL_PARTNER_STAGES
      };
    }

    if (contactType === 'eviction_client') return { eviction_client: EVICTION_STAGES };
    if (contactType === 'prevention_prospect') return { prevention_prospect: PREVENTION_STAGES };
    if (contactType === 'referral_partner') return { referral_partner: REFERRAL_PARTNER_STAGES };
    return {};
  };

  const getDaysInStage = (contact) => {
    if (!contact.updated_at) return 0;
    const updated = new Date(contact.updated_at);
    const now = new Date();
    const diff = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getContactTypeColor = (contactType) => {
    const colors = {
      eviction_client: 'border-blue-500/30 bg-blue-500/5',
      prevention_prospect: 'border-green-500/30 bg-green-500/5',
      referral_partner: 'border-purple-500/30 bg-purple-500/5'
    };
    return colors[contactType] || 'border-gray-500/30 bg-gray-500/5';
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="dashboard-card !p-4">
          <p className="text-center text-v3-text-muted py-6">Loading pipeline...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="dashboard-card !p-4">
          <p className="text-center text-v3-text-muted py-6">No contacts found</p>
        </div>
      ) : (
        (() => {
          const contactTypes = getKanbanStages(typeFilter);

          return Object.entries(contactTypes).map(([contactType, stages]) => {
            const typeContacts = contacts.filter(c => c.contact_type === contactType);
            const totalCount = typeContacts.length;

            // Get section styling
            const sectionColors = {
              eviction_client: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: '📋' },
              prevention_prospect: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: '🏢' },
              referral_partner: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', icon: '🤝' }
            };
            const colors = sectionColors[contactType] || { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', icon: '📁' };

            return (
              <div key={contactType} className="dashboard-card !p-4">
                {/* Section Header */}
                <div className={`${colors.bg} ${colors.border} border-2 rounded-lg p-3 mb-4`}>
                  <div className="flex items-center justify-between">
                    <h2 className={`text-lg font-bold ${colors.text} flex items-center gap-2`}>
                      <span>{colors.icon}</span>
                      <span>{CONTACT_TYPES[contactType].toUpperCase()}</span>
                      <span className="text-sm font-normal text-v3-text-muted">({totalCount})</span>
                    </h2>
                  </div>
                </div>

                {/* Horizontal Stage Columns */}
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-3 min-w-max">
                    {stages.map(stage => {
                      const stageContacts = typeContacts.filter(c => c.current_stage === stage.value);

                      return (
                        <div key={stage.value} className="flex-shrink-0 w-64">
                          {/* Stage Column */}
                          <div className={`rounded-lg border-2 ${getContactTypeColor(contactType)} h-full`}>
                            {/* Column Header */}
                            <div className="p-3 border-b border-gray-700">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm text-v3-text-lightest">{stage.label}</h3>
                                <span className="px-2 py-0.5 bg-v3-brand/20 text-v3-brand text-xs rounded font-medium">
                                  {stageContacts.length}
                                </span>
                              </div>
                            </div>

                            {/* Cards Container */}
                            <div className="p-2 space-y-2 min-h-[150px]">
                              {stageContacts.map((contact) => {
                                const daysInStage = getDaysInStage(contact);
                                return (
                                  <div
                                    key={contact.id}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('contactId', contact.id);
                                      e.dataTransfer.setData('oldStage', contact.current_stage);
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add('ring-2', 'ring-v3-brand');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove('ring-2', 'ring-v3-brand');
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.remove('ring-2', 'ring-v3-brand');
                                      const draggedContactId = e.dataTransfer.getData('contactId');
                                      const oldStage = e.dataTransfer.getData('oldStage');
                                      if (draggedContactId !== contact.id.toString() && stage.value !== oldStage) {
                                        onStageChange(parseInt(draggedContactId), stage.value, oldStage);
                                      }
                                    }}
                                    onClick={() => onContactClick(contact.id)}
                                    className="p-2 bg-v3-bg-card rounded-lg cursor-move hover:bg-v3-bg-darker border border-gray-700 transition-all"
                                  >
                                    {/* Contact Card */}
                                    <div className="space-y-1.5">
                                      {/* Name and Priority */}
                                      <div className="flex items-start justify-between gap-1">
                                        <h4 className="font-semibold text-xs text-v3-text-lightest line-clamp-1">
                                          {contact.name}
                                        </h4>
                                        {getPriorityBadge(contact.priority)}
                                      </div>

                                      {/* Company */}
                                      {contact.company_name && (
                                        <div className="flex items-center gap-1 text-xs text-v3-text-muted">
                                          <Building className="h-3 w-3 flex-shrink-0" />
                                          <span className="truncate">{contact.company_name}</span>
                                        </div>
                                      )}

                                      {/* Days in Stage */}
                                      <div className="flex items-center gap-1 text-xs text-v3-text-muted pt-1.5 border-t border-gray-700">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <span>{daysInStage}d in stage</span>
                                      </div>

                                      {/* Potential Value */}
                                      {contact.potential_value && (
                                        <div className="text-xs font-semibold text-green-600">
                                          {formatCurrency(contact.potential_value)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Drop Zone for empty columns */}
                              {stageContacts.length === 0 && (
                                <div
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.add('bg-v3-brand/10', 'border-v3-brand');
                                  }}
                                  onDragLeave={(e) => {
                                    e.currentTarget.classList.remove('bg-v3-brand/10', 'border-v3-brand');
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('bg-v3-brand/10', 'border-v3-brand');
                                    const contactId = e.dataTransfer.getData('contactId');
                                    const oldStage = e.dataTransfer.getData('oldStage');
                                    if (stage.value !== oldStage) {
                                      onStageChange(parseInt(contactId), stage.value, oldStage);
                                    }
                                  }}
                                  className="h-24 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center text-v3-text-muted text-xs transition-colors"
                                >
                                  Drop here
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          });
        })()
      )}
    </div>
  );
}
