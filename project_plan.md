Build a mobile app and web dashboard system for V3 Services Ltd that allows us to deploy field agents quickly for urgent, last-minute jobs.
This should be a working MVP that we can test and use internally.
---
📱 MOBILE APP – AGENT SIDE
1. **Availability Management**
   - Agents can toggle: `Available` / `Unavailable`
   - Optional: Set availability in advance for specific days (Mon–Sun)
   - Auto-resets daily unless manually preset
   - "I'm Away" mode to block out multiple dates (e.g., holidays)
2. **Weekly Reminder**
   - Every Sunday at 6pm, send a push notification:
     > “Please update your availability status for the coming week.”
3. **Job Notification (Push 1)**
   - When a job is created, send a push to only agents marked as “Available” for that job date
   - Include:
     - Job type
     - Address
     - Arrival time
     - Number of agents required
     - Number of spaces left
     - Estimated travel time from their current location
   - Two response buttons: `Accept Job` / `Decline`
4. **Post-Acceptance Confirmation (Push 2)**
   - If agent accepts the job, immediately send a second push notification that includes:
     - Confirmation: “You’re confirmed for [Job Name]”
     - Job address and arrival time
     - Lead agent name
     - Required gear/instructions (e.g., “Wear black clothing & boots”)
     - **Weather forecast for that job location and time**
       - Example: “🌦️ Light rain, 14°C – bring waterproofs”
5. **Auto-Deactivate**
   - After accepting a job, agent is auto-set to “Unavailable” for the rest of that day (unless overridden)
---
🖥️ WEB DASHBOARD – ADMIN SIDE
1. **Agent Availability View**
   - Live list of agents and their availability
   - Weekly calendar view showing each agent’s status
   - “Away” periods clearly marked
2. **Job Creation Panel**
   - Enter:
     - Job type
     - Address
     - Arrival time
     - Number of agents needed
     - Lead agent name
     - Notes (e.g. gear instructions)
     - Urgency Level: `Low`, `Standard`, `URGENT`
   - System selects eligible agents:
     - Available on the job date
     - Optional: within X miles
   - Sends first push with job details
   - Tracks who accepts and fills slots live
3. **Job Lock & Follow-Up**
   - When all slots are filled:
     - Job is locked
     - Push is sent to all notified agents:
       > “Job has now been filled. No further action needed.”
4. **Shift Logging**
   - Auto-log accepted agents, timestamps, and job metadata
   - Data should be exportable for reports or invoicing
5. **Dashboard Metrics**
   - Show stats like:
     - Agent response rate
     - Avg response time
     - Top 5 most reliable agents
     - Agents with stale availability
---
🔧 FUNCTIONAL REQUIREMENTS
- Build both the agent-facing mobile app (iOS + Android) and the admin-facing web dashboard
- Set up backend with secure authentication, push notification handling, and scheduled jobs (e.g., weekly reminder)
- Integrate a weather API to fetch 1–2 day forecasts by UK postcode or location
- Choose appropriate technologies but explain your decisions
Deliver a complete working MVP we can test internally with real agents and jobs. Prioritize speed, reliability, and ease of use.