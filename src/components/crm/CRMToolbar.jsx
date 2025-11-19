import { Plus, Search, List, LayoutGrid, AlertCircle } from 'lucide-react';

const CONTACT_TYPES = {
  eviction_client: 'Eviction Client',
  prevention_prospect: 'Prevention Prospect',
  referral_partner: 'Referral Partner'
};

const CONTACT_STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'dormant', label: 'Dormant' }
];

export default function CRMToolbar({
  crmUser,
  view,
  setView,
  viewMode,
  setViewMode,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  searchTerm,
  setSearchTerm,
  priorityCounts,
  onAddContact
}) {
  return (
    <>
      {/* Controls */}
      <div className="dashboard-card !p-3 mb-4">
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('my')}
              className={`px-3 py-1.5 text-sm rounded ${view === 'my' ? 'bg-v3-brand text-white' : 'bg-v3-bg-darker text-v3-text-light'}`}
            >
              My Contacts
            </button>
            {crmUser?.is_super_admin && (
              <button
                onClick={() => setView('team')}
                className={`px-3 py-1.5 text-sm rounded ${view === 'team' ? 'bg-v3-brand text-white' : 'bg-v3-bg-darker text-v3-text-light'}`}
              >
                Team View
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex gap-0 ml-4 bg-v3-bg-darker rounded overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${viewMode === 'list' ? 'bg-v3-brand text-white' : 'text-v3-text-light hover:bg-v3-bg-darker/50'}`}
              >
                <List className="h-4 w-4" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${viewMode === 'pipeline' ? 'bg-v3-brand text-white' : 'text-v3-text-light hover:bg-v3-bg-darker/50'}`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>Pipeline</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 flex-1 justify-end">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="v3-input text-sm py-1.5"
            >
              <option value="all">All Types</option>
              {Object.entries(CONTACT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="v3-input text-sm py-1.5"
            >
              <option value="all">Active</option>
              {CONTACT_STATUS.map(({ value, label}) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="v3-input text-sm py-1.5"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="hot">🟡 Hot</option>
              <option value="nurture">🔵 Nurture</option>
              <option value="routine">⚪ Routine</option>
              <option value="none">No Priority</option>
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-v3-text-muted" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="v3-input text-sm py-1.5 pl-8 w-48"
              />
            </div>

            <button
              onClick={onAddContact}
              className="px-3 py-1.5 text-sm bg-v3-brand text-white rounded hover:bg-v3-brand/80 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* Priority Dashboard Widget */}
      {(priorityCounts.urgent > 0 || priorityCounts.hot > 0) && (
        <div className="dashboard-card !p-4 bg-gradient-to-r from-red-500/10 to-yellow-500/10 border-l-4 border-red-500 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="text-sm font-semibold text-v3-text-lightest mb-1">Priority Contacts Requiring Attention</h3>
                <div className="flex items-center gap-4 text-sm">
                  {priorityCounts.urgent > 0 && (
                    <span className="text-red-500 font-semibold">
                      🔴 {priorityCounts.urgent} Urgent
                    </span>
                  )}
                  {priorityCounts.hot > 0 && (
                    <span className="text-yellow-500 font-semibold">
                      🟡 {priorityCounts.hot} Hot Lead{priorityCounts.hot > 1 ? 's' : ''}
                    </span>
                  )}
                  {priorityCounts.nurture > 0 && (
                    <span className="text-blue-500 font-medium">
                      🔵 {priorityCounts.nurture} Nurture
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setPriorityFilter(priorityCounts.urgent > 0 ? 'urgent' : 'hot')}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              View Now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
