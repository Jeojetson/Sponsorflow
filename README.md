# ASME Indy SponsorFlow + Project Planner — GitHub Pages Edition v4

Version 4 combines the existing sponsor-outreach workflow with a collaborative engineering planner designed for Purdue University Indianapolis ASME.

```text
GitHub Pages
  ├─ Sponsor outreach portal
  └─ Shared project planner
           ↓
Google Apps Script data service
           ↓
Private Google Sheet
```

The planner is intentionally account-free. Everyone with the site link can view and edit it after entering a name. Names are recorded with task changes and comments so the club can coordinate work without managing individual accounts.

## Project Planner features

- Separate teams and multiple timelines per team
- Seeded workspaces for club-wide, mechanical, electrical, battery, manufacturing/parts, and operations work
- Monday-style Kanban board with drag-and-drop status changes
- Gantt-style timeline with milestones, progress bars, today marker, deadlines, and overdue indicators
- Sortable visual task table
- Priorities: Critical, High, Medium, and Low
- Statuses: Backlog, Planned, In progress, Blocked, Review/test, and Done
- Owners, tags, descriptions, acceptance criteria, start dates, due dates, and percent complete
- Parts and purchasing fields for vendor, part number, quantity, estimated cost, and order status
- Task dependencies with circular-dependency prevention
- Comments and recent activity history
- Optimistic conflict protection when two people edit the same task
- Search, owner, status, priority, parts-only, and hide-completed filters
- Board health metrics for progress, overdue/blocked work, near-term deadlines, and parts awaiting action
- Board link sharing and CSV export
- Responsive layouts for laptop, tablet, and phone use

## SponsorFlow features retained

- Name-based request access
- Verified and member-suggested sponsors
- Duplicate-outreach warnings
- Officer comments, revision requests, approval, manual send, and sent history
- Polished sponsor templates
- Public club outreach statistics and leaderboards
- Validated sponsor opportunity catalog

## Files

```text
index.html                    Sponsor outreach portal
planner.html                  Collaborative project planner
admin.html                    Redirect to the Apps Script admin dashboard
assets/config.js              Your Apps Script URL; preserve this during updates
assets/api.js                 GitHub Pages ↔ Apps Script bridge
assets/member.js              Sponsor outreach member workflow
assets/planner.js             Planner boards, timeline, tasks, parts, and comments
assets/app.css                Shared responsive design system
apps-script/Code.gs           Backend, Sheet schema, sponsor workflow, and planner API
apps-script/Admin.html        Officer sponsor-review dashboard
UPGRADE.md                    Exact v3 → v4 migration instructions
SECURITY.md                   Privacy, backup, and public-editing guidance
```

## Data added to the Google Sheet

Version 4 creates these new tabs without clearing existing sponsor data:

```text
Planner Teams
Planner Boards
Planner Tasks
Planner Comments
Planner Activity
```

## Initial setup

For a brand-new installation:

1. Create a blank Google Sheet.
2. Open **Extensions → Apps Script**.
3. Paste `apps-script/Code.gs` into `Code.gs`.
4. Create an HTML file named `Admin` and paste `apps-script/Admin.html` into it.
5. Reload the Sheet and run **SponsorFlow → Initial setup**.
6. Deploy Apps Script as a web app that executes as you and is accessible to **Anyone**.
7. Paste the `/exec` URL into `assets/config.js`.
8. Upload the public files to GitHub Pages.

Existing installations should follow [UPGRADE.md](UPGRADE.md).

## Editing model

There is no member authentication. The planner stores the entered editor name with each task change and comment. This is coordination, not identity verification. Anyone who knows the public site URL can potentially view or change planner data.

Use the planner for ordinary club planning only. Do not put passwords, private student information, export-controlled designs, payment-card data, confidential sponsor terms, or sensitive university records into tasks or comments.
