# ASME Indy SponsorFlow — GitHub Pages Edition

A free, simplified sponsor-outreach workflow for Purdue University Indianapolis ASME.

## What this version does

- Members enter their name instead of creating an account.
- Members choose a verified sponsor contact without seeing the sponsor's email address.
- Members choose and edit polished sponsorship templates.
- Members submit a draft for officer review.
- Each submission receives a request ID and private edit code.
- One shared admin password opens the officer dashboard.
- An admin can comment, request revisions, approve, reject, copy the final email, and mark it sent.
- The admin manually sends through `asmeindy@purdue.edu`.
- Google Sheets keeps the contact directory, requests, revisions, and audit log.

Nothing is sent automatically.

## How the free hosting works

```text
GitHub Pages
Member-facing website (HTML, CSS, JavaScript)
        ↓
Google Apps Script
Data service + password-protected admin dashboard
        ↓
Google Sheet
Contacts, templates, requests, revisions, audit records
```

GitHub Pages is static hosting, so the shared data and admin logic live in Google Apps Script. The admin password is entered on the Apps Script dashboard, not on GitHub Pages.

---

# Part 1 — Create the GitHub repository

You need the GitHub Pages address before configuring the data service.

1. Sign in to GitHub.
2. Select **New repository**.
3. Use a name such as:

   ```text
   asme-sponsorflow
   ```

4. Choose **Public**. GitHub Pages on the free GitHub plan requires a public repository.
5. Do not add a README or `.gitignore`; this package already includes the files you need.
6. Create the repository.

Your eventual project site will look like:

```text
https://YOUR-USERNAME.github.io/asme-sponsorflow/
```

The **origin** used during Apps Script setup is only:

```text
https://YOUR-USERNAME.github.io
```

Do not include `/asme-sponsorflow/` when the setup menu asks for the origin.

---

# Part 2 — Create the Google Sheet database

Use a Google account that the club can retain long term. A club-controlled account or faculty-advisor-controlled account is better than an account that will disappear when an officer graduates.

1. Create a blank Google Sheet.
2. Name it:

   ```text
   ASME SponsorFlow Database
   ```

3. In the Sheet, select **Extensions → Apps Script**.
4. The Apps Script editor opens with a file named `Code.gs`.
5. Delete the sample code in `Code.gs`.
6. Open this package's file:

   ```text
   apps-script/Code.gs
   ```

7. Copy all of it and paste it into the Apps Script `Code.gs` editor.
8. In the Apps Script editor, click **+ → HTML**.
9. Name the new file:

   ```text
   Admin
   ```

10. Open this package's file:

    ```text
    apps-script/Admin.html
    ```

11. Copy all of it into the new Apps Script `Admin.html` file.
12. Save the Apps Script project.
13. Return to the Google Sheet and reload the browser tab.

You should now see a menu named **SponsorFlow** in the Sheet.

---

# Part 3 — Run the initial setup

From the Google Sheet:

1. Select **SponsorFlow → Initial setup**.
2. Google may ask you to authorize the script. Review the request and approve it.
3. Enter one strong admin password with at least 14 characters.
4. Enter your GitHub Pages origin:

   ```text
   https://YOUR-USERNAME.github.io
   ```

The setup creates these Sheet tabs:

```text
Contacts
Templates
Requests
Revisions
Audit
```

It also seeds six polished email templates.

The password itself is not stored in the Sheet. The script stores a salted SHA-256 hash in Apps Script's private Script Properties.

---

# Part 4 — Deploy Google Apps Script

In the Apps Script editor:

1. Select **Deploy → New deployment**.
2. Next to **Select type**, click the gear icon.
3. Select **Web app**.
4. Use these settings:

   ```text
   Description: SponsorFlow production
   Execute as: Me
   Who has access: Anyone
   ```

5. Select **Deploy**.
6. Complete Google's authorization prompts if they appear.
7. Copy the web app URL. It should end in:

   ```text
   /exec
   ```

Keep this URL available for the next step.

### If “Anyone” is not available

The Google Workspace account may prohibit anonymous web apps. Use a Google account that permits anonymous Apps Script deployments, or ask the account administrator whether anonymous Apps Script web apps can be enabled. The member portal cannot accept unsigned submissions without that access setting.

---

# Part 5 — Connect the website to Apps Script

Open:

```text
assets/config.js
```

Replace:

```javascript
API_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"
```

with the copied URL, for example:

```javascript
API_URL: "https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT_ID/exec"
```

Do not put the admin password in this file. The repository is public.

---

# Part 6 — Upload the project to GitHub

## Easiest method: GitHub's web interface

1. Open the empty repository on GitHub.
2. Select **uploading an existing file**.
3. Drag the contents of this folder into the upload area:

   ```text
   index.html
   admin.html
   .nojekyll
   assets/
   apps-script/
   README.md
   SECURITY.md
   ```

4. Commit the upload to the `main` branch.

The `apps-script` folder may remain public because it contains no password, password hash, spreadsheet ID, or admin session tokens. Keeping it in GitHub makes future maintenance easier.

## Terminal method

From the extracted project folder:

```bash
git init
git branch -M main
git add .
git commit -m "Launch ASME SponsorFlow"
git remote add origin https://github.com/YOUR-USERNAME/asme-sponsorflow.git
git push -u origin main
```

---

# Part 7 — Enable GitHub Pages

In the GitHub repository:

1. Select **Settings**.
2. In the left sidebar, select **Pages**.
3. Under **Build and deployment**, choose:

   ```text
   Source: Deploy from a branch
   Branch: main
   Folder: / (root)
   ```

4. Select **Save**.
5. Wait a few minutes.

GitHub displays the live site address when deployment finishes:

```text
https://YOUR-USERNAME.github.io/asme-sponsorflow/
```

---

# Part 8 — Complete the first test

## A. Add a verified sponsor contact

1. Open the GitHub Pages site.
2. Select **Admin**.
3. Select **Open admin dashboard**.
4. Enter the admin password.
5. Open **Sponsor contacts**.
6. Add a contact using an email address you control for testing.
7. Check both:

   ```text
   Verified by an officer
   Active and selectable by members
   ```

## B. Submit a member draft

1. Return to the member portal.
2. Refresh the page so the new contact appears.
3. Enter your name and role.
4. Select the test sponsor and a template.
5. Complete the company connection, request, use, and benefits.
6. Generate and edit the draft.
7. Reach a quality score of at least 70.
8. Submit it.
9. Save the request ID and edit code shown by the app.

## C. Request a revision

1. Return to the admin dashboard.
2. Open the request.
3. Write a specific comment.
4. Select **Request revisions**.
5. Return to the member portal.
6. Open **My requests**.
7. Open the request and select **Revise this draft**.
8. Resubmit the revision.

## D. Approve and send manually

1. In the admin dashboard, open the revised request.
2. Select **Approve**.
3. Use **Copy complete email**.
4. Open `asmeindy@purdue.edu` in Outlook.
5. Paste and send the message.
6. Return to SponsorFlow and select **Mark sent**.

The Requests, Revisions, and Audit Sheet tabs retain the record.

---

# Updating the system later

## Frontend changes

Edit files in GitHub and commit them to `main`. GitHub Pages republishes the site automatically.

## Apps Script changes

Saving code in the Apps Script editor does not automatically update a public versioned deployment.

1. Select **Deploy → Manage deployments**.
2. Select the active deployment.
3. Select the edit/pencil icon.
4. Under **Version**, choose **New version**.
5. Select **Deploy**.

The `/exec` URL remains the same.

---

# Local preview on your Mac

From the project folder:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

The backend accepts local previews from `localhost` and `127.0.0.1`. The deployed site is restricted to the GitHub Pages origin entered during initial setup.

---

# Security and privacy boundaries

This simplified edition intentionally trades individual accountability for ease of use.

- A member name is a label, not verified identity.
- Anyone who can reach the public member site can attempt to submit a request.
- The request ID and edit code protect each member request; the edit code is stored only as a hash.
- Sponsor email addresses are never returned to the public member portal.
- The admin password is entered only on the Apps Script-hosted admin dashboard.
- All officers using the shared password appear in the audit history as `SponsorFlow Admin`.
- This system should not store banking information, purchasing card data, tax records, account passwords, or confidential university information.
- Keep the Google Sheet private to current officers and the faculty advisor.
- Change the admin password when leadership changes or whenever it may have been shared too broadly.
- Use a unique password with at least 14 characters and store it in a password manager.
- Make a backup copy of the Google Sheet at least monthly.
- Never publish the Google Sheet itself.

Read `SECURITY.md` before using real sponsor contacts.

---

# Troubleshooting

## “SponsorFlow is not connected yet”

The Apps Script `/exec` URL was not added correctly to `assets/config.js`, or the updated file has not reached GitHub Pages yet.

## “This website is not allowed”

The origin entered during Initial setup does not exactly match the GitHub Pages origin.

For a site at:

```text
https://example.github.io/asme-sponsorflow/
```

use:

```text
https://example.github.io
```

Change it from **SponsorFlow → Change GitHub Pages origin** in the Sheet.

## No contacts appear

A contact must be both verified and active. Add it in the admin dashboard and refresh the member portal.

## Admin changes do not appear

Refresh the dashboard. If you changed backend code, update the Apps Script deployment to a new version.

## The admin page says the password is incorrect

Use **SponsorFlow → Change admin password** from the Google Sheet. After 12 failed attempts, the login pauses for ten minutes.

## A request cannot be revised

Members can revise only after an admin chooses **Request revisions**. Approved, sent, pending, and rejected requests are locked on the member side.
