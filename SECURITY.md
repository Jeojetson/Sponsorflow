# SponsorFlow v4 security and privacy notes

## Public website model

The GitHub Pages site is public. The sponsor workflow and project planner use a Google Apps Script web app as the shared data service.

The project planner is deliberately open-edit: any visitor with the site URL can enter a name and create or modify teams, timelines, tasks, parts information, comments, and statuses. Names are attribution labels, not verified identities.

## Appropriate planner content

Use the planner for routine club work such as:

- Design and fabrication tasks
- Test plans and build milestones
- Non-confidential part numbers and vendors
- Approximate project costs
- Owners, handoffs, blockers, and meeting follow-ups
- Sponsor fulfillment and event deadlines

Do not store:

- Passwords or API keys
- Payment-card or bank information
- Private academic or disciplinary records
- Sensitive personal data
- Export-controlled technical data
- Confidential sponsor pricing or contract terms
- Purdue records that require restricted access

## Shared edit risk

Because edits are open, a visitor could make unwanted changes or impersonate another name. Version 4 reduces accidental conflicts by checking each task’s `updatedAt` value before saving, but it cannot prevent intentional misuse.

Recommended controls:

1. Keep the site link within the club rather than widely advertising the planner URL.
2. Review the **Planner Activity** Sheet when a change is unclear.
3. Make periodic Google Sheet copies or exports.
4. Restrict direct Sheet access to current officers and trusted project leads.
5. Remove malicious or obsolete rows directly from the Sheet if necessary.
6. Consider authenticated hosting later if the planner grows into a system containing sensitive or high-value data.

## Apps Script and Sheet

- Keep the Google account that owns Apps Script protected with multi-factor authentication.
- Keep the Google Sheet private; the website talks to it through Apps Script.
- Do not place the admin password in GitHub or `assets/config.js`.
- The Apps Script URL is public by design and is not a password.
- The SponsorFlow admin password remains a salted hash in Script Properties.

## Backups

Before major updates, use **File → Make a copy** in Google Sheets. For routine recovery, retain periodic copies or export the planner tabs to CSV.
