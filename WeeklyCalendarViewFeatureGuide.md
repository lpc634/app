# Weekly Calendar View Feature Guide

## Overview

The Weekly Calendar View is a new feature added to the V3 Services Field Agent Deployment System that provides a visual calendar interface for managing agent availability. This feature enhances the agent management capabilities by allowing administrators to:

- View agent availability for an entire week at a glance
- Toggle availability status for any day with a single click
- Navigate between weeks easily
- Track availability patterns over time

## Location

The Weekly Calendar View is integrated into the **Agent Management** section of the admin dashboard. It appears at the bottom of the page after selecting an agent.

## Features

### 1. Agent Selection

- Click on any agent card to select them
- Use the dropdown menu to quickly switch between agents
- Selected agent's weekly availability is displayed in the calendar view

### 2. Weekly Navigation

- Use the left and right arrows to navigate between weeks
- Click the calendar icon to return to the current week
- Week date range is displayed in the header

### 3. Availability Management

- Each day shows the current availability status:
  - **Available** (green): Agent is available for assignments
  - **Unavailable** (gray): Agent is not available
  - **Away** (red): Agent is away (e.g., vacation, sick leave)
  - **Not Set** (outlined): No availability information recorded

- Click the button on any day to toggle availability status
- Current day is highlighted with a special border

### 4. Real-time Updates

- Changes to availability are saved immediately to the backend
- Status badges update in real-time
- Available agent count updates automatically

## Usage Instructions

### For Administrators

1. Navigate to the **Agent Management** section of the dashboard
2. Select an agent by clicking on their card or using the dropdown
3. Scroll down to view the Weekly Calendar View
4. Navigate between weeks using the arrow buttons
5. Click on any day's "Set Available" button to toggle availability
6. Notice the status badge updates immediately

### Technical Details

The Weekly Calendar View integrates with the backend API through these endpoints:

- `GET /availability/{agent_id}?start_date={date}&end_date={date}` - Retrieves availability for date range
- `POST /availability` - Sets availability for specific dates

## Benefits

- **Improved Planning**: See availability patterns across weeks
- **Quick Management**: Toggle availability with a single click
- **Visual Interface**: Calendar view provides clear visual representation
- **Efficient Operations**: Quickly identify available agents for upcoming jobs
- **Better Resource Allocation**: Plan job assignments based on future availability

## Implementation Notes

This feature was added to complete the V3 Services Field Agent Deployment System, addressing the "coming soon" placeholder that was previously in place. The implementation uses React components and integrates seamlessly with the existing backend API.
