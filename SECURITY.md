# SponsorFlow v3 security and privacy notes

SponsorFlow v3 is designed for low-sensitivity student-club outreach, not confidential records.

## Name-based access

Members do not authenticate. A normalized full name is used to find and revise requests. Anyone who knows or guesses the same name can view those requests. This is an intentional convenience tradeoff approved for this club workflow.

Keep email bodies professional and appropriate for broad club visibility. Do not include passwords, payment details, private academic information, medical information, or sensitive personal data.

## Sponsor email privacy

Verified sponsor emails are not sent to the public GitHub Pages frontend. The public portal receives a company name, program name, route type, public official link, research guidance, and aggregate outreach history. Member-suggested emails are submitted directly to the private Sheet and shown only in the admin dashboard.

## Duplicate matching

Duplicate protection compares contact IDs, exact normalized emails, and normalized company names. Company-name matching is intentionally broad and can occasionally flag separate divisions or regional offices. Members may proceed after acknowledging that the outreach is an intentional follow-up, different contact, or separate opportunity.

The warning is a coordination control, not an absolute block. Officers should review the existing request history before approving an acknowledged duplicate.

## Validated sponsor catalog

“Validated” means an official public program, sponsorship page, academic contact, or community-application route was confirmed on July 27, 2026. It does not guarantee eligibility, approval, availability, or deliverability. Official programs can change, so officers should recheck the linked source before submitting.

Some imported opportunities require institutional or nonprofit information. Do not enter Purdue tax documents, banking details, or other institutional records into the public member portal. Coordinate those applications through the faculty advisor or appropriate Purdue office.

## Admin password

The shared admin password is stored as a salted hash in Apps Script properties. It is not stored in GitHub or the Google Sheet. Use at least 14 characters, rotate it during officer transitions, and share it only with current approving officers.

## Apps Script URL

The `/exec` URL in `assets/config.js` is not a password. The backend validates the configured GitHub Pages origin and limits public actions to the member workflow.

## Verification gate

Requests with member-suggested sponsor emails are marked `UNVERIFIED`. The server blocks approval and sent status until an officer verifies the address.

## Google Sheet access

Restrict the Sheet to current officers and the faculty advisor. Remove former members promptly and keep a periodic Sheet backup.
