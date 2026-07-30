# Live calendar subscriptions

SponsorFlow v8 publishes live iCalendar feeds from the Apps Script web app.

## Available feeds

- **Club-wide** — all dated tasks from every active team, including Finance & Sponsorship.
- **Important Dates** — explicit important dates plus milestones, critical work, funding opportunities, meetings, competitions, inspections, presentations, and deadline-tagged tasks.
- **Team calendars** — Mechanical Design, Kart Setup, Wiring Harness, Battery, Software, Manufacturing Lead, Finance & Sponsorship, and any teams added later.
- **Current timeline** — only the selected timeline.

Users may subscribe to any combination. For example, a mechanical member might subscribe to Club-wide, Important Dates, and Mechanical Design.

## Editing

The subscription itself is read-only. Users edit the source task in SponsorFlow:

- Click a calendar event to edit it.
- Click the `+` button on a day to create an event on that date.
- Use **+ Add event** for a new dated item.
- Mark an item **Important date** to include it in the Important Dates feed.

Saved title, dates, priority, owners, funding details, requirements, team, timeline, and source URL are reflected in the next feed refresh.

## Calendar-app setup

### Apple Calendar

Use **Open subscription**, or choose **File → New Calendar Subscription** on Mac and paste the URL.

### Google Calendar

On a computer, open **Other calendars → Add other calendars → From URL**, paste the URL, and add it.

### Outlook

Choose **Add calendar → Subscribe from web** and paste the URL.

## Refresh behavior

SponsorFlow publishes the latest data every time the feed URL is requested. Each calendar application decides when to request it again. Changes therefore appear after the calendar application's next refresh, not immediately.

## Privacy

The planner and subscription feeds are public to anyone who has the URL. Do not store confidential student records, payment information, passwords, private sponsor terms, or controlled technical information in calendar-visible task fields.
