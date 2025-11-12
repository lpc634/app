# Component Structure Summary - Quick Reference

## Files Found

### 1. Main CRM Page
- **File**: `C:\app\src\Pages\CRMPage.jsx`
- **Size**: 2500+ lines
- **Status**: Production-ready, fully functional

### 2. Modal Components
- **File**: `C:\app\src\components\modals\AdminFormStartModal.tsx`
- **File**: `C:\app\src\components\modals\ReportViewer.jsx`

### 3. Styling
- **File**: `C:\app\src\v3-services-theme.css`

---

## Contact Detail Modal (Lines 1729-1953)

TRIGGER: Click contact -> `setShowDetailsModal(true)`

STRUCTURE:
- Header with Edit/Delete/Close buttons
- Contact Info Panel (email, phone, company with Lucide icons)
- Sales Info Panel (type, stage, status, follow-up, potential value)
- Tasks Section (with "+ Add Task" button)
- Notes & History Timeline

STATE:
```javascript
const [selectedContact, setSelectedContact] = useState(null);
const [showDetailsModal, setShowDetailsModal] = useState(false);
const [editMode, setEditMode] = useState(false);
const [tasks, setTasks] = useState([]);
const [notes, setNotes] = useState([]);
const [newNote, setNewNote] = useState('');
const [noteType, setNoteType] = useState('internal');
```

KEY FUNCTIONS:
- `fetchContactDetails(contactId)` - Line 421
- `updateContact()` - Line 473
- `deleteContact(contactId)` - Line 839
- `addNote()` - Line 500

---

## Task Creation Modal (Lines 2075-2153)

TRIGGER: Click "+ Add Task" button in contact detail

FORM FIELDS:
1. Task Type (select): call, email, send_docs, site_visit, follow_up, general
2. Title (required text input)
3. Due Date & Time (required datetime)
4. Notes (optional textarea)

STATE:
```javascript
const [showTaskModal, setShowTaskModal] = useState(false);
const [taskFormData, setTaskFormData] = useState({
  task_type: 'call',
  title: '',
  due_date: '',
  notes: ''
});
```

KEY FUNCTIONS:
- `handleAddTask(contact)` - Line 626
- `handleSaveTask()` - Line 638
- `handleCompleteTask(taskId)` - Line 677
- `handleSnoozeTask(taskId, duration)` - Line 702

API: `POST /api/crm/tasks`

---

## Notes & Activity Timeline (Lines 1906-1948)

COMPONENT: Part of contact detail modal

FEATURES:
- Add note with textarea
- Select note type (internal, call, email, meeting, quote_sent)
- Display timeline with creator name and date

API: `POST /api/crm/contacts/{contact_id}/notes`

---

## Sales Stage Management (Lines 30-54, 890-894)

EVICTION CLIENT PIPELINE:
1. new_inquiry
2. client_pack_sent
3. awaiting_instruction
4. job_booked
5. job_in_progress
6. invoiced
7. paid

PREVENTION PROSPECT PIPELINE:
1. prospect
2. first_contact
3. in_discussion
4. quote_sent
5. thinking_about_it
6. won
7. lost

SELECTION:
```javascript
const getStagesForType = (type) => {
  if (type === 'eviction_client') return EVICTION_STAGES;
  if (type === 'prevention_prospect') return PREVENTION_STAGES;
  return [];
};
```

---

## Tasks List in Contact Detail (Lines 1841-1904)

FEATURES:
- List contact tasks
- Show task type, title, due date, notes
- Display completion status
- Complete/Snooze buttons (for pending tasks)

BADGE COLORS:
- completed: bg-green-600/20 text-green-400
- overdue: bg-red-600/20 text-red-400
- pending: bg-blue-600/20 text-blue-400

API:
- `GET /api/crm/contacts/{contact_id}/tasks`
- `PUT /api/crm/tasks/{id}/complete`
- `PUT /api/crm/tasks/{id}/snooze`

---

## CSS Classes Used

Modal Container:
```jsx
className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
```

Card:
```jsx
className="dashboard-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
```

Inputs:
```jsx
className="v3-input w-full"
```

Buttons:
```jsx
className="button-refresh"  // Primary
className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
```

Text Colors:
```
--v3-text-lightest: #F5F5F5
--v3-text-light: #CCCCCC
--v3-text-muted: #888888
--v3-bg-card: #242424
--v3-bg-darker: #1A1A1A
```

---

## Contact Form Fields

```javascript
{
  name: string (required),
  email: string (required),
  phone: string,
  company_name: string,
  contact_type: 'eviction_client' | 'prevention_prospect' | 'referral_partner',
  current_stage: string,
  status: 'active' | 'won' | 'lost' | 'dormant',
  next_followup_date: date,
  potential_value: number,
  property_address: string
}
```

---

## API Authentication

All requests require Bearer token:
```javascript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('crm_token')}`,
  'Content-Type': 'application/json'
}
```

Base URL: `/api/crm/`

KEY ENDPOINTS:
- POST /api/crm/tasks
- POST /api/crm/contacts/{id}/notes
- GET /api/crm/contacts/{id}/tasks
- PUT /api/crm/tasks/{id}/complete
- PUT /api/crm/tasks/{id}/snooze

