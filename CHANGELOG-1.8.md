# SponsorFlow 1.8 UI hardening

SponsorFlow 1.8 is a frontend-only polish release focused on modal geometry, contrast, control consistency, and responsive containment.

## Modal fixes

- Fixed several dialogs whose inner card was wider than the native `<dialog>` container.
- Calendar event editor now uses a correctly sized 1120px desktop dialog.
- Attendance administration now uses a correctly sized 1180px desktop dialog.
- Calendar manager and subscription dialogs are contained by their parent dialogs.
- Planner quick-event editor remains intentionally compact instead of inheriting the wide calendar editor width.
- Close buttons, headings, sticky footers, and form columns reserve enough space and cannot push a modal off-center.
- Large editors become full-screen app sheets on phones; small confirmation/identity dialogs remain centered cards.

## Contrast fixes

- Rebuilt the final light/dark semantic color tokens with stronger text contrast.
- Raised contrast for muted text, faint metadata, eyebrow labels, and Purdue-gold text on light surfaces.
- Added dark-mode-safe red, green, amber, and blue semantic colors used by errors, success states, status badges, and due-date warnings.
- Reworked dark-mode priority/status pills so light pastel backgrounds no longer clash with dark surfaces.
- Inputs, selects, textareas, sticky editor footers, modal surfaces, and secondary buttons now remain visually distinct in both themes.

## Alignment and controls

- Standardized primary hit targets to at least 44px.
- Normalized button, icon-button, navigation, and theme-toggle vertical alignment.
- Fixed dialog action rows and modal header padding.
- Added missing `--gray-300` legacy token used by neutral health cards.
- Strengthened borders around active segmented controls and planner tabs.
- Preserved existing SponsorFlow 1.7 data, attendance, calendars, planner behavior, and Apps Script backend.
