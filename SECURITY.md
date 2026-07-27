# SponsorFlow Security Notes

## Intended use

This project is a lightweight student-club workflow for drafting and reviewing sponsor outreach. It is not an identity system, purchasing system, financial ledger, or confidential records platform.

## Important limitations

1. **Names are not authentication.** A user's typed name is only organizational metadata.
2. **The member portal is public.** Anyone with the GitHub Pages link can attempt to submit a draft.
3. **One admin password means one admin identity.** The system cannot determine which officer performed an admin action.
4. **Request access is possession-based.** Anyone with a request ID and edit code can view that request. Edit codes are hashed in storage but must still be protected by users.
5. **Google Apps Script has service quotas.** Heavy traffic or abuse can temporarily prevent submissions.

## Protections included

- The admin password is salted and hashed before storage in Script Properties.
- Admin sessions are random, short-lived, and kept in the Apps Script browser session.
- Sponsor email addresses are excluded from member-facing data.
- Request edit codes are stored as SHA-256 hashes with an application salt.
- Admin login attempts are throttled after repeated failures.
- Writes use Apps Script locking to reduce concurrent-edit problems.
- Spreadsheet formula prefixes are escaped before storage.
- The member backend validates the exact configured GitHub Pages origin.
- The admin password is never included in GitHub code or configuration.
- The admin interface is served by Google Apps Script rather than GitHub Pages.

## Operating rules

- Use a unique admin password of at least 14 characters.
- Change it each officer transition and after suspected disclosure.
- Restrict the database Sheet to current officers and the faculty advisor.
- Do not share the Sheet through a public link.
- Keep at least one monthly backup copy.
- Do not store passwords, card data, bank data, government identifiers, tax documents, student records, or private university data.
- Use test contacts before entering real sponsor information.
- Review every approved email in Outlook before sending it from `asmeindy@purdue.edu`.

## Recommended future upgrade

If the club later needs verified user identities, per-officer audit attribution, file attachments, formal purchase approvals, or sensitive records, migrate to Purdue SSO or another individually authenticated backend rather than expanding this shared-password edition.
