# ASME Indy SponsorFlow — GitHub Pages Edition v2

SponsorFlow is a free sponsor-outreach workflow for Purdue University Indianapolis ASME.

```text
GitHub Pages member portal
          ↓
Google Apps Script data service and admin dashboard
          ↓
Private Google Sheet
```

The application does not send email automatically. Members draft requests; officers verify recipients, comment, approve, manually copy the final email into `asmeindy@purdue.edu`, and mark the request sent.

## Version 2 highlights

- Member requests are grouped and recovered using the member's full name
- No member accounts, cookies, or edit codes are required
- Members may select a verified sponsor or suggest a new company and email
- Suggested contacts are labeled **Unverified** until an officer confirms them
- Unverified requests cannot be approved or marked sent
- Six shorter, more sponsor-focused templates
- Public sent and active-request leaderboards
- A cumulative sent-email graph
- Existing spreadsheet rows are preserved during upgrades

See [UPGRADE.md](UPGRADE.md) for the exact update steps.

## Files

```text
index.html                 Public member portal
admin.html                 Redirect page to the Apps Script admin dashboard
assets/config.js           Your deployed Apps Script URL
assets/api.js              GitHub Pages ↔ Apps Script bridge
assets/member.js           Member workflow and public statistics
assets/app.css             Public site styling
apps-script/Code.gs        Apps Script backend
apps-script/Admin.html     Officer dashboard
```

## Initial setup

1. Create a blank Google Sheet.
2. Open **Extensions → Apps Script**.
3. Paste `apps-script/Code.gs` into `Code.gs`.
4. Create an HTML file named `Admin` and paste `apps-script/Admin.html` into it.
5. Reload the Sheet and run **SponsorFlow → Initial setup**.
6. Deploy Apps Script as a web app that executes as you and is accessible to **Anyone**.
7. Copy the `/exec` URL into `assets/config.js`.
8. Upload the public files to a GitHub Pages repository.

## Sponsor verification

A member-suggested contact is automatically added to the Contacts sheet as inactive and unverified. The request stores a snapshot of the company, contact name, and email.

In the admin dashboard, an officer can select **Verify & add to directory**. That action:

- Marks the contact verified and active
- Makes it selectable for future members
- Marks matching requests as verified
- Records an audit event

## Statistics

The public statistics page displays:

- Total requests submitted
- Total requests marked sent
- Active queue count
- Number of participating member names
- Leaders by sent requests
- Leaders by active requests
- A cumulative monthly graph based on `sentAt`

A request counts as active when it is pending review, changes requested, or approved but not yet sent.

## Privacy model

This edition intentionally uses names rather than member authentication. Names and leaderboard counts are public, and anyone who enters the same name can view that name's request history. Sponsor email addresses are not included in the public directory or public request response; they remain available in the private Sheet and admin dashboard.

Do not store passwords, payment information, tax records, private academic records, or other sensitive information in SponsorFlow.
