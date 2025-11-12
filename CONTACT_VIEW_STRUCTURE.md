# Contact Detail View Component Structure

## Overview
The CRM system already has a fully functional contact management system built into **CRMPage.jsx** with modal-based UI patterns. This document describes the existing structure and identifies components suitable for integration.

## File Locations

### Main CRM Page
- **C:\app\src\Pages\CRMPage.jsx** (2500+ lines)
  - Complete CRM implementation with contacts, tasks, notes, emails
  - Uses inline modal components (not extracted)
  - V3 Services theme styling

### UI Components & Utilities
- **C:\app\src\components\modals\AdminFormStartModal.tsx** - Reference for modal patterns
- **C:\app\src\components\modals\ReportViewer.jsx** - Reference for modal UI structure
- **C:\app\src\v3-services-theme.css** - V3 theme variables and styling

## 1. Contact Detail Modal (showDetailsModal)

### Location in Code
CRMPage.jsx, lines 1729-1953

### Structure
- Header with Edit/Delete/Close buttons
- Contact Info display section with icons (email, phone, company)
- Sales Info section (type, stage, status, follow-up date, potential value)
- Tasks section with "Add Task" button
- Notes & History timeline section

### State Management
```javascript
const [selectedContact, setSelectedContact] = useState(null);
const [showDetailsModal, setShowDetailsModal] = useState(false);
const [editMode, setEditMode] = useState(false);
const [tasks, setTasks] = useState([]);
const [notes, setNotes] = useState([]);
```

### Relevant Functions
- `fetchContactDetails(contactId)` - Line 421
- `updateContact()` - Line 473
- `deleteContact(contactId)` - Line 839
- `openEditMode()` - Switches to edit mode
- `addNote()` - Line 500

---

## 2. Task Creation Modal (showTaskModal)

### Location in Code
CRMPage.jsx, lines 2075-2153

### Form Fields
1. Task Type (select): call, email, send_docs, site_visit, follow_up, general
2. Title (text input): Required
3. Due Date & Time (datetime-local): Required
4. Notes (textarea): Optional

### Relevant Functions
- `handleAddTask(contact)` - Line 626
- `handleSaveTask()` - Line 638
- `handleCompleteTask(taskId)` - Line 677
- `handleSnoozeTask(taskId, duration)` - Line 702

### API Endpoint
- `POST /api/crm/tasks`

---

## 3. Sales Stage Management

### Eviction Client Stages (Line 36-44)
- new_inquiry
- client_pack_sent
- awaiting_instruction
- job_booked
- job_in_progress
- invoiced
- paid

### Prevention Prospect Stages (Line 46-54)
- prospect
- first_contact
- in_discussion
- quote_sent
- thinking_about_it
- won
- lost

### Stage Selection Logic
```javascript
const getStagesForType = (type) => {
  if (type === 'eviction_client') return EVICTION_STAGES;
  if (type === 'prevention_prospect') return PREVENTION_STAGES;
  return [];
};
```

---

## 4. Notes/Activity Timeline Component

### Location in Code
CRMPage.jsx, lines 1906-1948

### Note Types
- internal
- call
- email
- meeting
- quote_sent

### Features
- Add new note with textarea
- Select note type from dropdown
- Display timeline of notes with creator name and date
- Format: note_type, created_at, content, creator_name

### API Endpoints
- `POST /api/crm/contacts/{contact_id}/notes`

---

## 5. Tasks Section in Contact Details

### Location in Code
CRMPage.jsx, lines 1841-1904

### Features
- Lists all tasks for the contact
- Shows task type, title, due date, notes
- Displays completion status (✓ Completed)
- Action buttons: Complete, Snooze (for pending tasks)
- Badge colors: green (completed), red (overdue), blue (pending)

### API Endpoints
- `GET /api/crm/contacts/{contact_id}/tasks`
- `PUT /api/crm/tasks/{task_id}/complete`
- `PUT /api/crm/tasks/{task_id}/snooze`

---

## 6. Styling & Theme

### CSS Classes Used
- `dashboard-card` - Modal card container
- `v3-input` - Input fields
- `button-refresh` - Primary action buttons
- `v3-text-lightest`, `v3-text-light`, `v3-text-muted` - Text colors
- `v3-bg-card`, `v3-bg-darker` - Background colors

### Modal Container Pattern
```jsx
className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
```

---

## 7. Contact Form Fields

```javascript
{
  name: string,
  email: string,
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

## 8. API Integration

### Base URL
All requests use: `/api/crm/` endpoint

### Authentication
All requests require Bearer token:
```javascript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('crm_token')}`,
  'Content-Type': 'application/json'
}
```

### Key Endpoints
- `GET /api/crm/contacts` - List contacts
- `GET /api/crm/contacts/{id}` - Fetch contact details (with tasks and notes)
- `POST /api/crm/contacts` - Create contact
- `PUT /api/crm/contacts/{id}` - Update contact
- `DELETE /api/crm/contacts/{id}` - Delete contact
- `GET /api/crm/contacts/{id}/tasks` - Fetch contact tasks
- `POST /api/crm/tasks` - Create task
- `PUT /api/crm/tasks/{id}/complete` - Mark task complete
- `PUT /api/crm/tasks/{id}/snooze` - Snooze task
- `POST /api/crm/contacts/{id}/notes` - Add note

---

## Reference Components

### AdminFormStartModal (TypeScript)
Location: C:\app\src\components\modals\AdminFormStartModal.tsx
- Uses React Hook Form for validation
- Uses Framer Motion for animations
- Dialog component from shadcn/ui

### ReportViewer (JSX)
Location: C:\app\src\components\modals\ReportViewer.jsx
- Uses Dialog from shadcn/ui
- Photo gallery navigation
- Custom CSS classes

---

## Recommended Extraction

For better maintainability, consider extracting:
1. **ContactDetailModal.jsx** - Wrapper around showDetailsModal logic
2. **TaskCreationModal.jsx** - Wrapper around showTaskModal logic
3. **NotesTimeline.jsx** - Reusable notes section
4. **TasksList.jsx** - Reusable tasks list

All can use custom hooks for state management:
- `useContactDetails(contactId)`
- `useTasks(contactId)`
- `useNotes(contactId)`

