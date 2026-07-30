# ASME Indy SponsorFlow 1.0

SponsorFlow combines sponsor outreach, an officer review workflow, team project planning, parts and funding tracking, editable calendars, and live iCalendar subscriptions using GitHub Pages, Google Apps Script, and a private Google Sheet.

## Planner views

- **Board** — status-based task workflow
- **Timeline** — Gantt-style schedule
- **Calendar** — editable month calendar and agenda
- **Table** — compact project inventory
- **Insights** — status, priority, workload, funding, and parts visualizations

## Calendar behavior

Use **+ Event** for races, meetings, inspections, deadlines, testing days, travel, and presentations. Events can be one day or span several days. They can be all-day or timed and may include a location.

Use **Subscribe** to add live read-only calendars for the entire club, Important Dates, individual teams, or individual timelines. Calendar apps control how often subscriptions refresh. Edits remain in SponsorFlow.

## Data model

The Google Sheet remains the shared source of truth. The 1.0 migration only adds missing schema and starter records; it never rewrites existing planner work. Names provide attribution rather than verified identity. SponsorFlow 1.0 also keeps temporary unsaved drafts in the current browser to reduce accidental data loss.

Do not store passwords, banking information, payment-card data, private student records, or restricted technical data in the public planner.
