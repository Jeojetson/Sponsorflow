# ASME Indy SponsorFlow — GitHub Pages Edition v3

SponsorFlow is a free sponsor-outreach workflow for Purdue University Indianapolis ASME.

```text
GitHub Pages member portal
          ↓
Google Apps Script data service and admin dashboard
          ↓
Private Google Sheet
```

The application does not send email automatically. Members prepare sponsor outreach; officers verify destinations, comment, request revisions, approve, manually copy the final message or application package, and mark it submitted from `asmeindy@purdue.edu`.

## Version 3 highlights

- Duplicate-outreach protection by contact record, exact email, and normalized company name
- Highly visible **No prior outreach**, **Active outreach exists**, and **Contacted X×** indicators
- A required acknowledgement before creating an intentional follow-up or separate opportunity
- 18 researched sponsor opportunities imported from official company programs and contact pages
- Official email and application-form routes supported side by side
- Company-specific research briefs with suggested asks, eligibility notes, personalization angles, and a recommended template
- Six tightened sponsorship templates for direct requests, in-kind support, official programs, local grants, follow-ups, and sponsor fulfillment
- Name-based request history and public club leaderboards
- A cumulative sent/submitted outreach graph
- Member-suggested companies and emails remain marked **Unverified** until officer review
- Existing contacts, templates, requests, comments, revisions, and statistics are preserved during the upgrade

See [UPGRADE.md](UPGRADE.md) for the exact upgrade sequence.

## What “validated sponsor” means

The imported records were reviewed on **July 27, 2026** against official program, education, sponsorship, or community-application pages. A validated record confirms a legitimate outreach route; it does not guarantee funding, eligibility, approval, or email delivery.

Some opportunities require a faculty advisor, institutional authorization, a W-9, an EIN, or a U.S. 501(c)(3). SponsorFlow shows those constraints before a member drafts the request. Officers should re-open the official source before submitting.

The full research export is available in:

```text
validated-sponsors.csv
VALIDATED-SPONSORS.md
```

## Duplicate protection

When a member chooses or types a sponsor, SponsorFlow checks prior requests using:

1. The exact directory contact ID
2. The exact normalized email address
3. The normalized company name

The public portal then shows whether the sponsor is available, has an active request, or has already been contacted. Prior outreach does not create a permanent ban: intentional follow-ups and distinct opportunities can proceed after the member acknowledges the history.

The backend repeats the check at submission time, so bypassing the browser warning does not silently create a duplicate.

## Files

```text
index.html                    Public member portal
admin.html                    Redirect page to the Apps Script admin dashboard
assets/config.js              Your deployed Apps Script URL; preserve this during updates
assets/api.js                 GitHub Pages ↔ Apps Script bridge
assets/member.js              Member workflow, duplicate indicators, research, and statistics
assets/app.css                Public site styling
apps-script/Code.gs           Apps Script backend and seeded sponsor research
apps-script/Admin.html        Officer dashboard
validated-sponsors.csv        Portable research export
VALIDATED-SPONSORS.md         Human-readable outreach catalog
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

Initial setup automatically creates the spreadsheet schema, refreshes the six built-in templates, and imports the validated sponsor catalog.

## Sponsor route types

- **EMAIL:** Officers copy the approved subject and body into the club mailbox, send it, then mark the request sent.
- **FORM:** Officers open the official company application, copy the approved application package, submit it, then mark the request submitted. It is recorded as `SENT` for statistics and duplicate protection.

## Privacy model

This edition intentionally uses names rather than member authentication. Names and leaderboard counts are public, and anyone entering the same name can view that name's request history. Sponsor email addresses are not included in the public directory or public request response; they remain available in the private Sheet and admin dashboard.

Do not store passwords, payment information, tax records, private academic records, or other sensitive information in SponsorFlow.
