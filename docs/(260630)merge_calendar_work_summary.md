# Calendar Work Merge Summary

## Scope

This thread implemented and iterated on Agent H2 calendar functionality. The work stayed within the calendar-owned surface except for documentation. No Prisma schema changes were made.

## Product Intent

- Make the calendar a practical operations view for lesson schedules, internal tasks, assistant work shifts, and calendar-only memos.
- Keep general memo CRUD/model ownership outside calendar, while allowing calendar-only memo display and editing inside the calendar UI.
- Let managers/admins/teachers view staff calendars without exposing another user's private calendar memo.
- Keep the left calendar/list compact and use the right detail panel for full context and management links.

## Files Changed

### `docs/development_plan_1.md`

Created the implementation plan for H2 calendar work, including product understanding, scope, roadmap, agent task breakdown, sequencing, testing, and risks.

### `features/calendar/types.ts`

Expanded calendar domain types:

- Added event sources for class sessions, internal tasks, assistant work shifts, and private calendar memos.
- Added `CalendarDisplayMode` to separate `month/week/day` range selection from `calendar/list` display mode.
- Replaced the broad source/teacher/class/status filter model with a simpler content filter model:
  - `lesson_schedule`
  - `assistant_work_shift`
  - `private_memo`
- Added link targets such as `workShiftId`.

### `features/calendar/constants.ts`

Centralized calendar metadata:

- Event source labels and empty states.
- Content filter button definitions.
- Default filters.
- Status/severity metadata.

### `features/calendar/lib/calendarFormatters.ts`

Added shared date/range formatting helpers for calendar views:

- Date normalization
- Month/week/day title formatting
- Weekday labels
- Time extraction for detailed event display

### `features/calendar/lib/calendarEvents.ts`

Implemented calendar event materialization and display logic:

- Expands recurring class schedules into visible date occurrences.
- Groups events by date.
- Computes summary counts.
- Maps task/class/work-shift statuses into calendar statuses.
- Defines display categories and colors for:
  - 수업
  - 해야할 일
  - 진행 중
  - 완료
  - 지연
  - 메모
  - 출근

### `features/calendar/lib/calendarFilters.ts`

Rebuilt filtering around the new simpler UI:

- Content-type filtering for lesson schedule, assistant work shift, and private memo.
- Staff calendar filtering for manager/admin/teacher views.
- Private memos are excluded when viewing another staff member.
- Empty-state copy now follows selected content filters.

### `features/calendar/actions/calendarMemoActions.ts`

Updated event memo persistence so calendar event memos can store the newer calendar event source values rather than only legacy `class/task` values.

### `features/calendar/components/CalendarView.tsx`

Reworked the server-side calendar data assembly:

- Class groups are mapped into `class_session` calendar events.
- Tasks are mapped into `internal_task` calendar events.
- `AssistantWorkShift` rows are mapped into `assistant_work_shift` calendar events.
- Private calendar memos and event memos are loaded and passed to the client calendar.
- Admin/manager/teacher roles can see staff calendar filter options; assistants do not.
- For calendar scope, admin/manager/teacher can see broader class/task/work-shift events, while assistants stay scoped to their own assigned items.

### `features/calendar/components/AcademyCalendar.tsx`

Main client coordinator for the calendar UI:

- Holds filter, view, display mode, cursor date, selected date, and selected event state.
- Separates `month/week/day` from `calendar/list`.
- Adds private memo events into the visible event stream only when allowed.
- Moves summary metrics into the top header, aligned to the right.
- Keeps the toolbar and calendar/list in the left column and the detail panel in the right column.

### `features/calendar/components/CalendarToolbar.tsx`

Rebuilt toolbar UI:

- Minimal content toggles for:
  - 회차 일정
  - 조교 출근 일정
  - 작성한 메모
- Staff screen selector for non-assistant roles.
- Color legend for event categories.
- Month/week/day and calendar/list toggles.
- Recent iteration swapped legend and view toggle positions per feedback.

### `features/calendar/components/CalendarEventList.tsx`

Implemented compact calendar/list rendering:

- Supports calendar grid mode and list mode using the same date range.
- Removed fixed wide grid constraints to reduce internal scrolling.
- Keeps cards compact and delegates detail to the right panel.

### `features/calendar/components/CalendarEventCard.tsx`

Simplified event cards:

- Removed visible time labels from cards to compress the left-side calendar/list.
- Shows only category, title, optional memo badge, and owner where useful.
- Adjusted category colors so 수업 and 해야할 일 are easier to distinguish.

### `features/calendar/components/CalendarMemoPanel.tsx`

Expanded right-side detail panel:

- Shows selected event details and calendar-only event memo form.
- Shows selected date private memo form.
- Adds management links for operational schedules:
  - Add task
  - Add class session/class
  - Manage work shifts
  - Manage task/class lists
  - Deep links for selected task/class/work-shift

## UX Iterations Applied

- `목록` is no longer a fourth date range tab. It is now a display mode paired with `월/주/일`.
- Old broad filters were removed in favor of three compact content toggles.
- Left calendar/list is intentionally compact; full information lives in the right panel.
- Staff calendar filtering is only shown to admin/manager/teacher roles.
- Summary metrics were moved into the top calendar header and aligned to the right.
- Summary label and value font sizes were made equal per final feedback.
- Color legend and view toggles were reordered per final feedback.

## Verification

The following checks passed after the calendar changes:

```bash
npm run lint
npm run build
```

`next build` still reports an existing Turbopack/workspace-root warning related to multiple lockfiles and NFT tracing. It is not introduced by this calendar work and does not block build completion.

## Merge Notes

- No database migration is required.
- No shared memo model or general memo page behavior was changed.
- Calendar-only memo behavior remains under `features/calendar/*`.
- Assistant work shifts are displayed using existing `AssistantWorkShift` data.
- Operational schedule creation/edit/delete is currently handled by linking to existing task, class, and work pages rather than introducing a new calendar CRUD model.
