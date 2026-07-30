# v6 interface cleanup

## Critical repair

The `metric-progress` class was being used both as a metric-card tone and as the nested progress-track element. The generic CSS rule for the progress track therefore applied absolute positioning to the entire Overall Progress card. V6 separates the nested element into `planner-progress-track`.

## Layout improvements

- Added `min-width: 0` protections throughout nested flex and grid layouts.
- Added responsive breakpoints for the control deck, timeline heading, metrics, filters, and mobile actions.
- Reduced desktop Kanban column minimum width while preserving a deliberate local scroller.
- Added stable scrollbar gutters and styled horizontal scrollbars.
- Improved Gantt label sizing at desktop, tablet, and mobile widths.
- Prevented medium-width board headings from inheriting a 560-pixel vertical flex basis.

## Interaction improvements

- Standardized minimum control heights around 42–44 pixels.
- Improved native checkbox sizing and alignment.
- Added touch-action behavior and retained keyboard focus visibility.
- Improved wrapping for long task, team, and timeline names.
