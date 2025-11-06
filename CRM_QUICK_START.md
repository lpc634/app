# V3 Services CRM - Quick Start Guide

## What Was Built

Your CRM system is now fully implemented and ready to use! Here's what you can do:

### ✅ Track Three Types of Contacts
1. **Eviction Clients** - Urgent jobs, fast sales cycle (24 hours)
2. **Prevention Prospects** - Proactive security/CCTV sales (longer cycle)
3. **Referral Partners** - Companies that send you business

### ✅ Core Features Working
- Dashboard with live stats (follow-ups, quotes pending, potential revenue)
- Personal view (only YOUR contacts) and Team view (see everyone's)
- Add/edit/delete contacts
- Add notes to track communications
- Set follow-up reminders
- Search and filter contacts
- Track potential deal value
- Sales stage tracking

## How to Get Started

### Step 1: Deploy and Run Migration

If you're deploying to Heroku:
```bash
git add .
git commit -m "Add CRM system for contact management"
git push heroku main
```

The migration will run automatically on deployment.

If running locally:
```bash
flask db upgrade
```

### Step 2: Access the CRM

1. Log in as admin (lance@v3-services.com or tom@v3-services.com)
2. Go to Admin Dashboard
3. Click **"More"** in the bottom navigation
4. Click **"CRM System"** (first item, Users icon)

### Step 3: Add Your First Contact

Click **"+ Add Contact"** button and fill in:

**For an Eviction Client:**
```
Name: John Smith
Email: john@propertygroup.com
Phone: 07700 900000
Company: ABC Property Management
Contact Type: Eviction Client
Service Type: Traveller Eviction
Urgency Level: High
Current Stage: New Inquiry
Next Follow-up: [Tomorrow's date]
Potential Value: 5000
Property Address: Industrial Estate, Leeds
```

**For a Prevention Prospect:**
```
Name: Sarah Johnson
Email: sarah@warehouse.com
Phone: 07700 900001
Company: Warehouse Holdings Ltd
Contact Type: Prevention Prospect
Service Type: CCTV Installation
Urgency Level: Medium
Current Stage: Prospect
Next Follow-up: [Next week]
Potential Value: 15000
Property Address: Distribution Centre, Manchester
```

**For a Referral Partner:**
```
Name: Tom Roberts
Email: tom@landagents.co.uk
Phone: 07700 900002
Company: Roberts & Co Land Agents
Contact Type: Referral Partner
Current Stage: Active Partner
```

### Step 4: Add Notes

1. Click on any contact card
2. In the notes section at the bottom, type a note
3. Select note type (Internal / Phone Call / Email / Meeting / Quote Sent)
4. Click "Add Note"

Example notes:
- "Initial call - interested in CCTV for 3 sites"
- "Sent quote for full security package - £12,500"
- "Waiting for board approval - follow up Friday"
- "Referred us ABC Property Group - invoice sent"

## Daily Workflow

### Morning Routine
1. Open CRM
2. Check dashboard stats - see "Follow-ups Today"
3. Click through contacts that need follow-up
4. Make calls/send emails
5. Add notes after each interaction
6. Update stage if they've progressed
7. Set new follow-up date

### When a New Inquiry Comes In
1. Click "+ Add Contact"
2. Fill in their details
3. Set stage to "New Inquiry" (eviction) or "Prospect" (prevention)
4. Set next follow-up for today or tomorrow
5. Add note about how they found you

### After Each Interaction
1. Open the contact
2. Add a note describing what happened
3. Update the stage if needed (e.g., "Quote Sent")
4. Set new follow-up date
5. Update potential value if you have a better estimate

### When You Win a Deal
1. Open the contact
2. Change status from "Active" to "Won"
3. Update stage to final stage ("Paid" or "Won")
4. Add note celebrating the win! 🎉
5. Update total_revenue when job is invoiced

### When You Lose a Deal
1. Open the contact
2. Change status to "Lost"
3. Add note explaining why (too expensive / went elsewhere / not interested)
4. Keep for future reference

## Views and Filters

### My Contacts vs Team View
- **My Contacts** - Shows only contacts YOU own (created by you)
- **Team View** - Shows ALL contacts (yours + Tom's)

Use "My Contacts" for daily work, "Team View" for coordination with Tom.

### Filters
**By Type:**
- All Types
- Eviction Clients only
- Prevention Prospects only
- Referral Partners only

**By Status:**
- Active (working on them now)
- Won (successfully converted)
- Lost (didn't convert)
- Dormant (not actively pursuing)

**Search:**
Type in the search box to find by name, email, or company name.

## Dashboard Stats Explained

### Follow-ups Today
Number of contacts with next_followup_date = today.
**Action:** Call or email these people today!

### Overdue Follow-ups (Red)
Number of contacts with next_followup_date in the past.
**Action:** These are urgent - reach out ASAP!

### Quotes Pending
Contacts in stage "Quote Sent" or "Thinking About It".
**Action:** Chase these up!

### Potential Revenue
Sum of all potential_value for active contacts.
**Info:** Shows how much business is in the pipeline.

## Sales Stages - When to Use Each

### Eviction Clients (Fast Process)
1. **New Inquiry** → They just called/emailed
2. **Client Pack Sent** → You sent the instruction forms
3. **Awaiting Instruction** → Waiting for forms to come back
4. **Job Booked** → Scheduled the eviction
5. **Job In Progress** → Currently doing the job
6. **Invoiced** → Invoice sent to client
7. **Paid** → Money received ✅

### Prevention Prospects (Slow Process)
1. **Prospect** → Initial contact, not engaged yet
2. **First Contact Made** → Had first conversation
3. **In Discussion** → Actively talking about their needs
4. **Quote Sent** → Sent them a proposal
5. **Thinking About It** → Waiting for their decision
6. **Won** → They accepted! ✅
7. **Lost** → They declined ❌

### Tips
- Update stage after EVERY interaction
- Don't skip stages (follow the process)
- If they go backwards (e.g., "Won" back to "In Discussion"), update it!

## Common Scenarios

### Scenario 1: Traveller Eviction Inquiry
1. Create contact as "Eviction Client"
2. Stage: "New Inquiry"
3. Urgency: "High" or "Urgent"
4. Follow-up: Today (same day)
5. Add note: "Site: [location], Travellers arrived: [date]"
6. Send client pack → Change stage to "Client Pack Sent"
7. Forms received → "Awaiting Instruction"
8. Job scheduled → "Job Booked"

### Scenario 2: CCTV Sales Lead
1. Create contact as "Prevention Prospect"
2. Stage: "Prospect"
3. Urgency: "Medium"
4. Follow-up: Next week
5. Add note: "Interested in CCTV for [number] sites"
6. First call → Stage: "First Contact Made"
7. Needs assessment → Stage: "In Discussion"
8. Quote sent → Stage: "Quote Sent", Follow-up: 3 days
9. Follow up → Add note, update follow-up date
10. Decision → Status: "Won" or "Lost"

### Scenario 3: Referral Partner
1. Create contact as "Referral Partner"
2. Stage: "Active Partner"
3. Add note: "Met at [event/introduction]"
4. When they refer someone → Add note: "Referred [client name]"
5. Update total_jobs_referred manually
6. Update last_referral_date
7. Send thank you / commission payment

## Tips for Success

### Do This ✅
- Set follow-up dates for EVERYTHING
- Add notes after EVERY interaction
- Check dashboard every morning
- Update stages as you progress
- Be consistent with data entry
- Use search to find contacts quickly

### Don't Do This ❌
- Don't forget to set follow-up dates (you'll lose track!)
- Don't skip adding notes (you'll forget what happened)
- Don't let follow-ups go overdue (chase them!)
- Don't create duplicate contacts (search first!)
- Don't leave potential_value blank (estimate something!)

## What's NOT Included Yet (Future Phases)

### Phase 2 - Email Integration
- Automatic email sync from lance@v3-services.com
- View all emails with each contact
- This is built into the models but not activated yet

### Phase 3 - Telegram Reminders
- Get Telegram notification for follow-ups
- Daily digest of what's due today
- Will use existing Telegram bot integration

### Phase 4 - File Uploads
- Upload quotes, contracts, photos
- Store in AWS S3
- Preview files in CRM

### Phase 5 - Job Linking
- Link contacts to actual jobs
- Auto-update revenue when jobs are done
- Track conversion rates

These will be added in future updates.

## Troubleshooting

### Can't see CRM menu option?
- Make sure you're logged in as admin (not agent)
- Check you're in Admin Dashboard (not Agent Dashboard)
- CRM only appears in "More" menu for admins

### Dashboard stats show 0?
- You haven't added any contacts yet
- Add your first contact to see stats update

### Search not working?
- Make sure you have contacts added
- Search looks in name, email, and company fields only

### Can't add note?
- Make sure you typed something in the note box
- Note content is required

## Need Help?

Refer to:
- **CRM_IMPLEMENTATION_SUMMARY.md** - Full technical documentation
- **V3_CRM_IMPLEMENTATION_BRIEF.md** - Complete specification with all code

## Quick Commands

### If Something Breaks
```bash
# Check database migrations
flask db current

# Run migrations
flask db upgrade

# Check for errors
heroku logs --tail
```

---

**You're all set!** 🎉

Start by adding a few test contacts to get familiar with the system, then import your real contacts from email/memory.

The CRM will help you:
- Never forget to follow up
- Track your sales pipeline
- Know which partners send you business
- See potential revenue at a glance
- Coordinate between you and Tom

Good luck with growing the prevention side of the business in 2025! 🚀
