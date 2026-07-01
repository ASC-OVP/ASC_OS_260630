# Calendar Development Plan

Revision source: `/Users/pangsang/Downloads/asc_calendar_codex_planning_brief.md`, `/Users/pangsang/Downloads/asc_calendar_codex_plan_feedback.md`, ASC UI/UX guideline, multi-agent coordination notes, Next 16 local docs, Figma reference `Content Calendar with Auto Layout 2025 Community` (`BKQGNDiCqEYpzB4KHfbWVt`, node `0:1`), and current codebase inspection.

## 1. Product understanding

ASC calendar should become an academy operations calendar, not a passive date grid. The screen must help staff answer:

```text
What is scheduled?
What is delayed?
Who owns it?
Which class/student/task is affected?
What is the next safe action?
```

The product loop for calendar work is:

```text
Schedule -> Status -> Responsible staff -> Related class/student/task -> Next action -> History or memo
```

This loop must not be interpreted as `ClassGroup + Task` only. P0 implementation should use existing class/task data safely, but the UI architecture must remain visibly ready for broader ASC operational sources:

```text
Class session
Internal task
Counseling follow-up
Payment due / overdue
OMR review
Attendance not finalized
Message failed
Material/textbook distribution
Student lifecycle event
```

Revised north star:

```text
Open ASC Calendar
-> See what is scheduled and what needs attention
-> Filter by role, class, owner, source, status, or urgency
-> Select an event or issue
-> Understand class/student/payment/message context
-> Move to the safest available action
-> Keep memo/history connected to the source record
```

Primary users:

- `ADMIN` / `MANAGER`: whole-academy operations, weekly schedule, delayed work, staff ownership, cross-class issues.
- `TEACHER`: own classes, own students, class-related tasks, upcoming/delayed work.
- `ASSISTANT`: assigned tasks and assisted class schedules.

Ownership boundary for Agent H2:

- Owns `features/calendar/*` and `app/calendar/*`.
- Owns calendar-only memo behavior in `features/calendar/actions/calendarMemoActions.ts` and `features/calendar/components/CalendarMemoPanel.tsx`.
- Does not own general memo CRUD/list/filter policy in `features/memos/*` or `app/memos/*`.
- Should not change shared memo Prisma models without coordination with Agent H1.

### UI/UX supplement layer

The implementation must not stop conceptually at class/task rendering. Even while P0/P1 uses existing data sources, the calendar UI should be source-driven and ready for ASC's broader operations: counseling, payment, attendance, OMR, message failure, materials, and student lifecycle workflows.

Rules:

- Build safely with existing data.
- Design visibly for the full academy operations calendar.
- Never create fake operational events or fake counts.
- Keep future source expansion cheap through source metadata, shared card/detail variants, and source-specific empty states.
- Defer risky mutations until permissions, confirmation, and audit behavior are clear.

### Cross-domain approval protocol

Calendar is a hub that links to classes, tasks, students, memos, messages, OMR, and future payment/material workflows. H2 agents may discover that a better calendar experience requires edits outside `features/calendar/*` or `app/calendar/*`. Those edits are allowed only after an explicit approval step.

Approval rule:

1. First implement or plan the change inside calendar-owned files when possible.
2. If a non-calendar file must change, stop before editing it.
3. Report the exact file path, owning domain, reason the calendar cannot solve it locally, expected behavior change, risk, and rollback path.
4. Wait for user approval.
5. After approval, make the smallest possible change and document it in the final report.

Examples requiring approval:

- `features/tasks/*`: direct task completion/assignment from calendar, task form changes beyond route query support.
- `features/classes/*`: class schedule edit forms, recurrence semantics, class lesson mutation UI.
- `features/students/*`: student detail/timeline/calendar linkage changes.
- `features/memos/*` or `app/memos/*`: general memo list/filter/model behavior.
- `features/messages/*`: message send/retry actions.
- `features/omr/*`: OMR review data provider or actions.
- future `features/payments/*` or materials files: payment due/status/refund/material workflows.
- shared files such as `prisma/schema.prisma`, `components/ui/*`, `components/Sidebar.tsx`, `lib/auth.ts`, or `lib/scopes.ts`.

## 2. Current implementation assessment

Current route:

- `app/calendar/page.tsx` is a thin route that imports `CalendarView` and exports `dynamic = "force-dynamic"`.
- `app/calendar/actions.ts` re-exports calendar memo actions.

Current data flow:

- `features/calendar/components/CalendarView.tsx` is a server component.
- It uses `requireUser()` and Prisma to load:
  - `ClassGroup` rows with teacher, assistant, class assistants, student count, and lessons.
  - `Task` rows with assignees, class/student context, `dueDate`, and raw queried `startDate`.
  - `CalendarPrivateMemo` for the current user.
  - `CalendarEventMemo` for academy-level event memos.
- It converts classes and tasks into `AcademyCalendarEvent[]`.
- It passes event arrays and filter options into the client component `AcademyCalendar`.

Current UI flow:

- `features/calendar/components/AcademyCalendar.tsx` is a large client component containing:
  - filter state
  - month/week/day view state
  - date cursor state
  - selected event/date state
  - event materialization
  - calendar grid rendering
  - event detail panel
  - date memo panel
  - inline styles
- `CalendarToolbar.tsx`, `CalendarEventList.tsx`, `CalendarEventForm.tsx`, and `CalendarMemoPanel.tsx` currently only re-export `AcademyCalendar`, so they are placeholders rather than true components.

Existing strengths:

- Uses the Next 16 server/client split correctly: database reads are in a server component, interactive filters and selected state are in a client component, and mutations use `"use server"` actions.
- Calendar already has route shell, summary cards, base filters, month/week/day controls, a grid, a right detail panel, and memo forms.
- Existing class and task domain actions already call `revalidatePath("/calendar")`, so the calendar is recognized as a derived surface.
- `CalendarPrivateMemo` and `CalendarEventMemo` already exist in Prisma, so calendar-local memo work does not require a schema change.

Current gaps:

- Summary count scope and visible calendar count can disagree. Example from brief: top card shows `수업 일정 2개`, grid shows `0개 일정`.
- Event counts are currently mixed:
  - summary uses raw `classEvents.length` and `taskEvents.length`.
  - grid count uses `materializedEvents.length` for selected date range and current filters.
- Calendar event type model is too narrow: only `"class"` and `"task"`.
- Status model mixes raw `ClassGroupStatus`, raw `TaskStatus`, and derived `"OVERDUE"`.
- Event cards are visually present in code but too sparse for operations scanning: time and title only, no visible text status badge on the card.
- `eventMemoByKey` lookup is fragile for recurring class events because materialized IDs include the date suffix. This is okay for occurrence-level memos but should be explicitly defined.
- Right panel is useful but not yet operational enough: no severity, no alert state, no owner fallback warnings, no history snippet, and limited quick actions.
- Empty states exist only for unselected detail/date, not for "no schedules in selected period" or "no schedules after filters".
- Loading/error states are not explicit because the page is a server-rendered screen without suspense/error boundaries specific to the calendar.
- No saved view presets exist.
- No direct calendar CRUD model exists. Calendar events are projections of class schedules and tasks.

## 3. Feature scope and priority

### P0: Essential calendar usability

Goal: make the current screen internally consistent and operationally useful without schema changes.

Required:

- Define canonical calendar event types, statuses, severity values, and Korean labels in calendar-owned files.
- Fix or explicitly align summary counts with selected period/filter scope.
- Preserve `ClassGroup` and `Task` as the two MVP event sources.
- Render visible event cards in week/month/day with:
  - type label
  - status text
  - title
  - time/range
  - owner/class/student where available
- Make selected event panel show operational context and next actions.
- Preserve base filters and add active-filter display plus reset.
- Add empty states for no period events and no filtered events.
- Keep date personal memo and event memo in calendar scope.

Expected P0 outcome:

```text
A staff member can open /calendar, see actual class/task schedules for the selected range, select one, understand owner/status/context, and move to the right existing domain workflow.
```

### P1: Operations calendar upgrade

Goal: make calendar useful as a daily/weekly operations cockpit.

Recommended:

- Add preset saved views as in-code filter presets:
  - `전체 일정`
  - `오늘의 운영`
  - `내 일정`
  - `이번 주 수업`
  - `지연 업무`
  - `마감 임박`
  - `미배정 업무`
- Add list/agenda view if the component split makes it simple.
- Add richer task event treatment: start date, due date, priority, overdue, class/student relation.
- Add quick actions that route to existing safe pages:
  - `업무 추가`
  - `업무 상세 보기`
  - `반 상세 보기`
  - `이 반 학생 보기`
  - `학생 상세 보기` where available
- Add front-end readiness for future operational event sources: counseling follow-up, payment due/overdue, OMR review, attendance not finalized, message failed, material distribution, and student lifecycle events. This includes source types, labels, filter options, source-specific empty states, and card/detail-panel compatibility. Do not show fake events or fake counts.

Expected P1 outcome:

```text
Staff can use calendar as a daily/weekly work board, not just a schedule board.
```

P1 acceptance:

- Presets support daily/weekly operation scanning.
- Agenda/list view exists if feasible.
- Rich task treatment includes start/due/priority/overdue/class/student relation where available.
- Front-end source registry supports future ASC operational sources.
- Future source filters and empty states exist without fake events.
- Future metadata does not inflate `전체 일정`, summary cards, or visible range counts.

### P1.5: Recurrence policy decision

Goal: reduce P2 schema/workflow risk before implementing recurrence exceptions.

Required output:

- Short design note only.
- Decide cancellation visibility, holiday closure representation, makeup class relationship, one occurrence vs whole series edit, memo attachment level, confirmation requirements, and audit requirements.
- No Prisma schema changes unless explicitly assigned and coordinated.

### P2: Advanced workflow and safety

Goal: support realistic academy schedule exceptions and sensitive workflow changes.

Defer unless assigned:

- Independent `CalendarEvent` model.
- Recurring occurrence exceptions.
- Single occurrence vs whole series edit.
- Makeup/cancelled class workflows.
- Conflict detection.
- Permission-aware edit/delete actions.
- Audit-backed schedule mutation history.
- Payment/message/attendance direct actions from calendar.

## 4. UX/UI implementation direction

### Page structure

Keep the existing app shell/sidebar. Inside `/calendar`, evolve toward:

```text
Calendar page
├─ Page header
│  ├─ title: 운영 일정 캘린더
│  ├─ selected date range/freshness context
│  └─ primary actions: 업무 추가, 반 수업 등록
├─ Summary cards
├─ Preset views and filter bar
├─ Main area
│  ├─ calendar grid or agenda list
│  └─ selected event/date panel
└─ hidden or future: loading/error boundaries
```

### Figma reference interpretation

Reference: Figma `Content Calendar with Auto Layout 2025 Community`, file key `BKQGNDiCqEYpzB4KHfbWVt`, node `0:1`.

Useful patterns to adapt:

- Compact 7-column month grid with fixed day-cell dimensions and predictable row heights.
- Separate weekday header row from date cells.
- Date cells use content/empty and active/disabled variants rather than ad hoc layout.
- Event items are compressed into small pill/tag rows so a month view can show more information with less visual noise.
- `Items` variants support one to five stacked tags, which maps well to "show several events, then overflow" behavior.
- Muted previous/next-month days make the selected month scannable.
- Tag colors are semantic and light-background based, e.g. blue/orange/red/green/gray.

ASC adaptations:

- Do not copy the bright blue page background or content-calendar marketing tone.
- Use ASC admin palette and existing CSS variables where possible.
- Use tag/pill density for event cards, but include Korean text labels for source/status/severity.
- In month view, prefer compact source/status chips and one-line title; in week/day/agenda view, show richer owner/context metadata.
- Keep all cells stable in height; overflow should be handled with `+N개 더 보기` or agenda fallback, not cell expansion.
- Treat disabled days as out-of-range days or permission-limited days, with muted styling and accessible labels.

### Source-driven UI rule

The calendar UI should be source-driven. Event cards, filters, badges, and empty states should read from a source metadata registry so future data providers can be added without redesigning the calendar UI.

### Global search and alert entry points

Calendar should coexist with future top-bar/global search and notifications, but H2 should not implement shared global search inside the calendar scope.

Preparation rules:

- Use stable `sourceKey`, `occurrenceKey`, `source`, and optional link target IDs.
- Keep event cards and detail panels able to receive deep-linked selected event state later.
- Alerts from dashboard/global notifications should eventually be able to open `/calendar` with a source/date/event selection, but route/query design can be deferred.
- Do not modify shared AppShell, top bar, notification, or global search files without explicit approval.

### Student-centered linkage

ASC is student-centered. Calendar events should support student context even when current class events are class-level.

Rules:

- Class events show class summary first.
- If student count exists, show expected student count.
- If student-specific risk/attendance/payment data is unavailable, do not fake it.
- Class event detail should keep route targets for class detail and class student list.
- Future student-specific events should show student name, class, assigned instructor, related status, and student profile route when available.

### Summary cards

P0 cards should use a clearly defined range. Recommended scope: selected visible range after base filters, plus one global active class count if labeled clearly.

P0 card set:

- `표시 일정`: materialized events in the visible range after filters.
- `수업 일정`: class events in the visible range after filters.
- `업무 일정`: task events in the visible range after filters.
- `지연 업무`: delayed task events in the visible range after filters.
- `운영중 반`: global or filter-scoped active classes, but label as `운영중 반 전체` if not date-scoped.

Do not mix raw source-event counts and materialized visible-event counts without label explanation.

### Calendar navigation

Keep:

- previous
- today
- next
- current range title
- month/week/day switcher

Add in P1 if feasible:

- `목록` view mode for agenda scanning.
- selected date highlight separate from today highlight.
- overflow handling for crowded days, e.g. `+3개 더 보기`.

### Event card anatomy

Minimum visible card content:

```text
[정규 수업] [예정]
19:00 중3 수학 A반
김OO · A룸 · 18명
```

For tasks:

```text
[내부 업무] [지연]
기간 OMR 업로드 확인
담당: 박OO · 긴급
```

Rules:

- Status must be text, not color alone.
- Do not rely on tiny dot indicators alone for memos.
- Month view can be denser; week/day can show owner and context.
- Long titles must truncate or wrap predictably without growing cells unexpectedly.

### Right detail panel

Empty state:

```text
일정을 선택해 주세요.
캘린더에서 수업, 업무 일정을 선택하면 상세 정보와 빠른 작업을 확인할 수 있습니다.
```

Selected event sections:

- Header: type badge, status badge, severity badge if relevant.
- Summary: title, time/range, recurrence/occurrence note.
- Ownership: teacher, assistant, assignee, missing-owner warning.
- Context:
  - class: subject, grade, room, operation period, expected student count.
  - task: assignee, priority, related class, related student, due/start range.
- Calendar memo: keep under calendar ownership.
- Quick actions: route-only actions in P0/P1.
- Future history/audit snippet placeholder only if real data exists.

### Filters and presets

Keep existing base filters:

- event type
- teacher
- assistant/assignee
- class
- subject
- status

Add:

- active filter chips or summary text.
- `필터 초기화`.
- preset views as simple client-side state presets, not a database saved-view system.

Do not implement user-customizable saved views in this phase.

## 5. Data model and API implications

### Existing data model mapping

MVP calendar event sources:

- `ClassGroup` plus `ClassLesson`
  - recurring class schedule from `daysOfWeek`, `startTime`, `endTime`, `startDate`, `endDate`.
  - saved lesson occurrences from `ClassLesson.lessonDate`, `startTime`, `endTime`.
- `Task`
  - task range from raw `Task.startDate` and Prisma `Task.dueDate`.
  - status from `Task.status` plus derived overdue state.
- `CalendarPrivateMemo`
  - personal date memo, unique by `userId + date`.
- `CalendarEventMemo`
  - academy-level event/occurrence memo, unique by `academyId + eventKey`.

### Proposed calendar-owned types

Create or expand calendar-owned type definitions in `features/calendar/types.ts`:

```ts
export type CalendarEventSource =
  | "class_session"
  | "internal_task"
  | "counseling_followup"
  | "payment_due"
  | "omr_review"
  | "attendance_not_finalized"
  | "message_failed"
  | "material_distribution"
  | "student_lifecycle";

type CalendarEventStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "delayed"
  | "cancelled"
  | "needs_review"
  | "unassigned";

type CalendarSeverity = "critical" | "warning" | "normal" | "resolved" | "inactive";
```

Optional P2 source candidates, only if staff schedule/payroll is confirmed as calendar scope:

```ts
// P2 candidate only
type CalendarStaffSource = "staff_shift" | "payroll_review";
```

Define source metadata in `features/calendar/constants.ts`:

```ts
export type CalendarEventSourceMeta = {
  labelKo: string;
  shortLabelKo: string;
  descriptionKo: string;
  defaultSeverity: CalendarSeverity;
  isImplemented: boolean;
  showInSourceFilter: boolean;
  emptyStateTitleKo: string;
  emptyStateDescriptionKo: string;
};
```

Required source metadata:

- `class_session`: implemented, normal severity, label `수업 일정`.
- `internal_task`: implemented, normal severity, label `업무 일정`.
- `counseling_followup`: unimplemented, warning severity, label `상담 follow-up`.
- `payment_due`: unimplemented, critical severity, label `결제 마감`.
- `omr_review`: unimplemented, warning severity, label `OMR 검토`.
- `attendance_not_finalized`: unimplemented, warning severity, label `출결 미완료`.
- `message_failed`: unimplemented, critical severity, label `문자 실패`.
- `material_distribution`: unimplemented, warning severity, label `교재/자료 배부`.
- `student_lifecycle`: unimplemented, warning severity, label `학생 상태 변경`.

Front-end behavior rules:

- Future source filters may appear with `연결 전` or source-specific empty-state copy.
- Selecting an unimplemented source filter should show a helpful empty state, not a blank grid.
- Summary cards must only count real events.
- Metadata must not create fake events.
- Event cards and detail panels should use source metadata so later `payment_due` or `omr_review` providers can be added without UI redesign.

Map current records into this canonical UI model:

- `ClassGroupStatus.ACTIVE` -> `scheduled`
- `ClassGroupStatus.UPCOMING` -> `scheduled`
- `ClassGroupStatus.PAUSED` -> `cancelled` or filtered out depending on recurrence plan
- `ClassGroupStatus.ENDED` -> `inactive`
- `TaskStatus.TODO` -> `scheduled`
- `TaskStatus.IN_PROGRESS` -> `in_progress`
- `TaskStatus.DONE` -> `completed`
- `TaskStatus.HOLD` -> `needs_review` or `scheduled` with hold label
- derived overdue task -> `delayed`
- no owner/assignee -> `unassigned`

Keep raw source status in metadata if needed for links or exact labels.

Future source mapping examples:

| Future source | Example condition | Status | Severity |
|---|---|---|---|
| `payment_due` | due date passed and unpaid | `delayed` | `critical` |
| `payment_due` | due within 3 days | `scheduled` | `warning` |
| `message_failed` | failed after send attempt | `needs_review` | `critical` |
| `omr_review` | low-confidence recognition | `needs_review` | `warning` |
| `attendance_not_finalized` | class ended but attendance not finalized | `needs_review` | `warning` |
| `counseling_followup` | follow-up date passed | `delayed` | `warning` |
| `material_distribution` | required but not distributed | `scheduled` | `warning` |

### Recommended event shape

Codex may adapt naming, but the UI needs enough room for future sources:

```ts
export type CalendarEventLinkTargets = {
  classGroupId?: string;
  taskId?: string;
  studentId?: string;
  paymentId?: string;
  counselingId?: string;
  messageId?: string;
  examId?: string;
  materialId?: string;
};

export type AcademyCalendarEvent = {
  id: string;
  sourceKey: string;
  occurrenceKey: string;
  source: CalendarEventSource;
  status: CalendarEventStatus;
  severity: CalendarSeverity;

  title: string;
  subtitle?: string;
  description?: string;

  startAt: string;
  endAt?: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrenceLabelKo?: string;

  ownerLabel?: string;
  ownerIds?: string[];
  isUnassigned?: boolean;

  classGroupId?: string;
  className?: string;
  subject?: string;
  grade?: string;
  room?: string;
  expectedStudentCount?: number;

  studentId?: string;
  studentName?: string;

  taskId?: string;
  paymentId?: string;
  counselingId?: string;
  messageId?: string;
  examId?: string;
  materialId?: string;

  sourceStatusRaw?: string;
  metadata?: Record<string, unknown>;
};
```

Rules:

- Current class/task mapping does not need to populate every field.
- Optional fields should allow future integrations without changing the whole component tree.
- Detail panel should render only fields that exist.
- Every event should support related student context when data exists, because ASC is student-centered.

### API/server action plan

P0/P1 should not add independent calendar schedule CRUD actions.

Allowed server actions:

- Keep `saveCalendarPrivateMemoAction`.
- Keep `saveCalendarEventMemoAction`.
- Harden calendar memo actions if touched:
  - validate `eventKey`, `eventDate`, `eventType`.
  - authenticate via `requireUser()`.
  - scope updates by academy/user.
  - revalidate `/calendar`.

Route-only quick actions:

- `업무 추가` -> `/tasks/new?date=YYYY-MM-DD`
- `반 수업 등록` -> `/classes/new`
- `업무 상세 보기` -> `/tasks/[taskId]`
- `반 상세 보기` -> `/classes/[classGroupId]`
- `이 반 학생 보기` -> `/students?classGroupId=...`

### Direct action safety matrix

Direct CRUD or state changes should be chosen by feasibility and safety, not categorically forbidden or required.

| Action type | Calendar implementation decision | Reason |
|---|---|---|
| Route-only navigation | Implement in P0/P1 | Safe, no mutation |
| Create task with date prefilled | Implement route action in P0/P1 | Existing task domain owns creation |
| View class/task/student detail | Implement in P0/P1 | Safe, preserves context |
| Save calendar-local memo | Implement in P0/P1 | Existing calendar-owned models exist |
| Mark task complete | May implement only if existing safe task server action, permission behavior, audit/revalidation, and UI confirmation expectations are verified | Useful, but cross-domain side effects must be controlled |
| Assign task owner | May implement only if existing task action safely supports it and user approves cross-domain edit if needed | Operationally valuable, permission-sensitive |
| Edit class schedule | Defer or route to class domain | Recurrence/exception ambiguity |
| Delete class/task/event | Defer | Destructive, requires confirmation/audit |
| Bulk message send | Defer to message workflow | Requires preview, recipient validation, confirmation |
| Payment status change/refund | Defer to payment workflow | Financial audit and confirmation required |
| Recurring occurrence edit | P2 | Requires occurrence exception model |

Rule:

- If a direct action mutates data outside calendar-owned memo models, Codex must verify safe domain action availability, permission behavior, confirmation/undo requirement, audit implication, and `revalidatePath("/calendar")` behavior.
- If any condition is unclear, use route-only action instead.
- If implementation requires editing another domain's files, follow the cross-domain approval protocol before making changes.

Schema changes:

- No schema change for P0/P1.
- If implementing standalone events or recurrence exceptions, coordinate a single schema-owning agent before touching `prisma/schema.prisma`.

Potential future models:

- `CalendarEvent`
- `CalendarEventOccurrenceException`
- `CalendarEventStatusHistory`
- `ScheduleConflict`

Do not create these in P0/P1.

## 6. Phase-based implementation roadmap

### Phase 1: Calendar type and data cleanup

Target files:

- `features/calendar/types.ts`
- `features/calendar/constants.ts`
- `features/calendar/lib/calendarFormatters.ts`
- `features/calendar/lib/calendarEvents.ts`
- `features/calendar/components/CalendarView.tsx`

Tasks:

- Define canonical event source, status, severity, and label maps.
- Define expanded `CalendarEventSource` union for implemented and future operational sources.
- Define `CALENDAR_EVENT_SOURCE_META` with labels, default severity, `isImplemented`, filter visibility, and source-specific empty state copy.
- Move date/status/color/priority formatting out of `AcademyCalendar.tsx`.
- Normalize class/task records to a richer `AcademyCalendarEvent` shape.
- Decide and document event key rules:
  - source key: stable object key, e.g. `class:<classGroupId>`, `task:<taskId>`.
  - occurrence key: materialized date-specific key, e.g. `class:<classGroupId>:2026-06-30`.
  - memo key should use occurrence key if memo is date-specific.
- Add unit-like pure functions where possible for materialization and filtering.

Acceptance:

- Types are serializable from server to client.
- No Prisma schema change.
- Existing class/task events still render.
- Future source metadata exists but does not create fake events.

### Phase 2: Count consistency and summary scope

Target files:

- `features/calendar/components/CalendarView.tsx`
- `features/calendar/components/AcademyCalendar.tsx`
- optional new `features/calendar/components/CalendarSummaryCards.tsx`

Tasks:

- Move summary cards closer to the same date/filter state used by the grid, or clearly label server-side global counts.
- Preferred P0: client computes visible-range summary from `materializedEvents` after filters.
- Keep `운영중 반 전체` as a separate global count if needed.
- Add visible label for selected range.
- Ensure unimplemented source metadata does not inflate summary cards.

Acceptance:

- `표시 일정` count equals rendered event occurrences in the selected range after filters.
- No unexplained mismatch between top cards and grid count.
- Future source filters do not inflate counts.

### Phase 3: Component split and event card rendering

Target files:

- `features/calendar/components/AcademyCalendar.tsx`
- `features/calendar/components/CalendarToolbar.tsx`
- `features/calendar/components/CalendarEventList.tsx`
- optional new `features/calendar/components/CalendarEventCard.tsx`

Tasks:

- Convert placeholder re-export components into real components.
- Keep `AcademyCalendar` as state coordinator.
- Render richer source-driven event cards with text badges.
- Adapt the Figma reference pattern: fixed day cells, compact tag-like event rows, source/status chips, muted out-of-range days, and controlled overflow.
- Add no-events-in-period and no-events-after-filters empty states.
- Improve keyboard behavior:
  - avoid nested interactive ambiguity where possible.
  - event card should be a button if it opens detail.
  - day cell can be a separate button or non-button container.

Acceptance:

- Week view displays readable event cards.
- Status labels are visible on cards.
- Keyboard selection works with Enter/Space.
- A test fixture using a future source event can render through the same card component without layout redesign.

### Phase 4: Detail panel and calendar memo panel

Target files:

- `features/calendar/components/CalendarMemoPanel.tsx`
- `features/calendar/components/AcademyCalendar.tsx`
- optional new `features/calendar/components/CalendarEventDetailPanel.tsx`
- `features/calendar/actions/calendarMemoActions.ts`

Tasks:

- Make `CalendarMemoPanel.tsx` a real component for date/event memo UI.
- Split `EventDetail`, `DateQuickAdd`, and `EmptyDetail` out of `AcademyCalendar.tsx`.
- Add owner/context/quick-action sections.
- Add a standardized related-context section that can later support class, task, student, payment, message, OMR, counseling, and material links.
- Keep calendar-local event memo behavior.
- Ensure H1 memo ownership is not changed.

Acceptance:

- Selecting event updates panel with operational context.
- Selecting date opens date memo plus add shortcuts.
- Saving/removing memo revalidates calendar and does not affect general memo CRUD.
- Future source detail mappings can be added without rewriting the panel.

### Phase 5: Filter presets and active filters

Target files:

- `features/calendar/components/CalendarToolbar.tsx`
- `features/calendar/lib/calendarFilters.ts`
- `features/calendar/constants.ts`

Tasks:

- Add filter reset.
- Add active filter chips or concise active filter text.
- Add presets:
  - `전체 일정`
  - `오늘의 운영`
  - `내 일정`
  - `이번 주 수업`
  - `지연 업무`
  - `마감 임박`
  - `미배정 업무`
- Presets should change existing client state, not create database saved views.
- Event source filter should include future source options where useful, with clear `연결 전` empty-state behavior.
- Presets should not select unimplemented sources by default unless the preset is explicitly source-specific, such as `상담 예정`, `결제 마감`, or `OMR 검토`.

Acceptance:

- Filters remain predictable.
- Users can reset to default.
- Presets do not hide data without visible active-state feedback.
- Unimplemented source filters show source-specific empty states and no fake cards/counts.

### Phase 6: P1 agenda view and future event source readiness

Target files:

- `features/calendar/components/CalendarEventList.tsx`
- `features/calendar/components/AcademyCalendar.tsx`
- `features/calendar/types.ts`

Tasks:

- Add `목록` view if scope allows.
- Prepare front-end source readiness for:
  - `counseling_followup`
  - `payment_due`
  - `omr_review`
  - `attendance_not_finalized`
  - `message_failed`
  - `material_distribution`
  - `student_lifecycle`
- Do not display fake counts or fake events.
- Add source-specific empty states for unconnected data.
- Add TODO-free structured metadata instead of placeholder comments.

Acceptance:

- Agenda view groups events by date with the same filters and selection behavior.
- Future source filters are visible and understandable.
- Unconnected future sources show useful empty states.
- Adding a future data provider later does not require event card/detail/filter redesign.

### Phase 7: P1.5 recurrence policy design note

Target files:

- `docs/development_plan_1.md` update or follow-up design doc.

Tasks:

- Produce a short design note for recurrence and exception policy before P2 implementation.
- Decide whether a cancelled class appears as a `cancelled` event or disappears.
- Decide whether holiday closure is an exception or separate blocked date.
- Decide whether makeup class attaches to original class series or becomes a separate event.
- Decide one occurrence vs whole series edit behavior.
- Decide whether event memos attach to series, occurrence, or both.
- Decide confirmation and audit requirements for changing all future occurrences.
- Do not implement schema changes unless explicitly assigned.

Acceptance:

- Product decisions are documented before schema implementation.
- No uncoordinated schema edits.

### Phase 8: P2 advanced workflow and safety

Target files:

- To be assigned after P1.5 design note and schema ownership decision.

Tasks:

- Independent `CalendarEvent` model if needed.
- Occurrence exceptions.
- Makeup/cancelled workflows.
- Conflict detection.
- Permission-aware edit/delete actions.
- Audit-backed mutations.
- Payment/message/attendance direct actions only after safety flows exist.

Acceptance:

- Direct schedule mutation, recurrence exceptions, standalone events, payment/message/attendance actions are implemented only with permission, confirmation, and audit behavior.

## 7. Codex-agent-friendly task breakdown

### Agent H2-A: Calendar data/type normalization

Owns:

- `features/calendar/types.ts`
- `features/calendar/constants.ts`
- `features/calendar/lib/calendarEvents.ts`
- `features/calendar/lib/calendarFormatters.ts`
- selected edits in `features/calendar/components/CalendarView.tsx`

Deliverables:

- canonical event/status/severity types.
- mapping functions for class/task source records.
- stable materialized event key rules.
- future event source registry with implemented/unimplemented metadata, Korean labels, empty-state copy, and default severity.
- source metadata that does not require Prisma schema changes in P0/P1.

Do not edit:

- `features/memos/*`
- `prisma/schema.prisma`
- shared UI components.

### Agent H2-B: Calendar shell, grid, and cards

Owns:

- `features/calendar/components/AcademyCalendar.tsx`
- `features/calendar/components/CalendarToolbar.tsx`
- `features/calendar/components/CalendarEventList.tsx`
- optional `features/calendar/components/CalendarEventCard.tsx`

Deliverables:

- cleaner component split.
- readable event cards.
- count consistency implementation.
- empty state handling.

Depends on:

- H2-A types and event shape.

### Agent H2-C: Detail panel and memo panel

Owns:

- `features/calendar/components/CalendarMemoPanel.tsx`
- optional `features/calendar/components/CalendarEventDetailPanel.tsx`
- selected edits in `features/calendar/components/AcademyCalendar.tsx`
- selected edits in `features/calendar/actions/calendarMemoActions.ts`

Deliverables:

- selected event panel.
- selected date panel.
- calendar event memo and date memo UI.
- safe route actions.

Depends on:

- H2-A event shape.

Coordinates with:

- Agent H1 if changing `CalendarEventMemo` semantics visible in `/memos`.

### Agent H2-D: Filter presets and QA

Owns:

- `features/calendar/lib/calendarFilters.ts`
- `features/calendar/constants.ts`
- `features/calendar/components/CalendarToolbar.tsx`
- documentation of QA outcomes.

Deliverables:

- active filters.
- reset.
- preset views.
- source filter options for implemented and unimplemented operational sources.
- empty state behavior when a future source is selected but has no data provider.
- test checklist and bug fixes inside calendar scope.
- QA that future source filters do not create fake cards or fake counts.

Depends on:

- H2-B state structure.

## 8. Parallelizable vs sequential task separation

Sequential:

1. H2-A must define canonical types and event shape first.
2. H2-B should then update grid/card rendering and count consistency.
3. H2-C should wire detail panel against the finalized event shape.
4. H2-D should add presets after filter state names and event fields are stable.
5. Full lint/build should run after integration.

Parallelizable after H2-A:

- H2-B event card rendering and H2-C detail panel component can proceed in parallel if they agree on the event prop type.
- H2-D can prepare label maps and preset definitions in constants while H2-B works on grid UI.
- Calendar memo action hardening can happen independently if it does not change field names or schema.

Do not parallelize:

- Multiple agents editing `AcademyCalendar.tsx` at the same time before component split.
- Any `prisma/schema.prisma` change.
- Shared UI component changes.
- Cross-domain edits in `features/tasks`, `features/classes`, or `features/memos`.
- Any non-calendar domain edit before user approval. Calendar agents must first report the target file, owning domain, reason, risk, and expected change.

## 9. Testing and QA plan

### Static checks

Run after implementation:

```bash
npm run lint
npm run build
```

If only planning docs are changed, code checks are optional.

### Data scenarios

Test calendar with:

- no class events and no task events.
- recurring class schedule only.
- saved `ClassLesson` occurrences only.
- class with room/teacher/assistant missing.
- task with start date only.
- task with due date only.
- task range spanning multiple days.
- overdue task.
- completed task.
- task with multiple assignees.
- personal date memo.
- event memo on a recurring occurrence.
- filters producing zero matches.

### Role scenarios

Test as:

- `ADMIN` / `MANAGER`: all academy events.
- `TEACHER`: own classes, own/related tasks.
- `ASSISTANT`: assigned tasks and assisted classes where available.

Verify:

- inaccessible data does not appear.
- quick actions point to routes the user can access or are hidden/disabled.
- memo saves are scoped correctly.

### UX QA

Verify:

- Summary counts and grid counts use a visible shared scope or are clearly labeled.
- Week view shows readable cards without color-only status.
- Month view handles overflow gracefully.
- Day view gives enough detail.
- Detail panel updates without full navigation.
- Empty states are helpful.
- Active filters are visible.
- Reset returns to default state.
- Text does not overflow buttons/cards.
- Keyboard focus is visible and event selection works.
- Figma-inspired compact month layout remains stable with one to five event/tag rows.
- Out-of-range or disabled days are visibly muted and still accessible.

### Future-source QA

Verify:

- Select `상담 follow-up` filter when no counseling provider exists.
  - Expected: no fake events, no fake counts, clear source-specific empty state.
- Select `결제 마감` filter when no payment provider exists.
  - Expected: no fake events, no fake counts, clear source-specific empty state.
- Select `OMR 검토` filter when no OMR provider exists.
  - Expected: no fake events, no fake counts, clear source-specific empty state.
- Select `출결 미완료`, `문자 실패`, `교재/자료 배부`, and `학생 상태 변경` filters before providers exist.
  - Expected: no fake events, no fake counts, clear source-specific empty states.
- `전체 일정` does not inflate counts with unimplemented source metadata.
- Future source labels use text and do not rely on color alone.
- Source registry metadata drives filter labels and empty states.
- UI still works when future source metadata exists but no source events are loaded.
- Adding a sample real future event in a local fixture or small unit-like check renders through the same `CalendarEventCard` and `CalendarEventDetailPanel` without layout break.

### Regression checks

Verify:

- `/memos` can still read calendar private/event memos.
- `/tasks/new?date=YYYY-MM-DD` still pre-fills task dates.
- class/task updates still revalidate `/calendar`.
- no generated Prisma files are modified.
- No cross-domain files are modified without the documented user approval step.

## 10. Risks, ambiguities, assumptions, and recommended execution order

### Risks

- Count mismatch can reappear if server summary cards and client filters remain separate.
- Recurring event memo keys can be confusing: series-level memo vs occurrence-level memo must be explicit.
- `ClassGroup.daysOfWeek` may contain Korean weekday text or numeric values depending on upstream input; mapping must be verified.
- `Task.startDate` appears accessed via raw SQL. This suggests generated Prisma types may lag schema or the field is not represented as expected. Avoid broad schema changes until confirmed.
- `AcademyCalendar.tsx` is a large hot file. Split it before multiple agents work on UI details.
- `CalendarEventMemo` is displayed on `/memos`; changing event type labels or key semantics can affect H1's memo list.
- Direct schedule edit/delete from calendar would cross into class/task ownership and require confirmation/audit design.
- Future source metadata can create user confusion if filters appear connected when no provider exists. Use `연결 전` empty states and never show fake counts.
- Figma reference uses large, colorful content-calendar styling. ASC should borrow density and auto-layout patterns, not its visual identity.
- Cross-domain changes may be necessary for direct actions or deeper integration. These must go through user approval before editing non-calendar files.

### Ambiguities

- Should `수업 일정` count series once or each visible occurrence? Recommendation: visible occurrence count for calendar range; use `운영중 반 전체` for global class count.
- Should recurring class memos attach to the series or to one date occurrence? Recommendation: P0 occurrence-level memo because current materialized IDs are date-specific; later add explicit series memo if requested.
- Should paused classes appear as cancelled events or disappear? Recommendation: P0 preserve current behavior unless product decides 휴강 visibility is required; P2 should model cancelled occurrences.
- Future operational event data may not be ready. The front-end should still define source metadata, labels, filter options, card/detail compatibility, and source-specific empty states. It must not create fake events or fake counts.
- Is mobile a first-class scope now? Assumption: desktop-first; ensure responsive basic layout but do not optimize complex mobile workflows in P0.
- Should future source filters be enabled or disabled before provider connection? Recommendation: show them if product wants visible roadmap, but label unconnected states clearly. If this feels noisy in implementation review, keep only implemented filters visible and expose future-source empty states through source-specific presets later.

### Assumptions

- No new dependencies.
- No Prisma schema changes for P0/P1.
- Calendar remains a derived surface over class/task data.
- Calendar-only memos remain under H2.
- General memo policy/list/filter remains under H1.
- Direct destructive actions are out of scope until confirmation and audit flows exist.
- Non-calendar domain edits require user approval before implementation, even when they improve the calendar workflow.

### Recommended execution order

1. Normalize calendar types, labels, status/severity mapping, and event key policy.
2. Refactor event materialization/filtering into calendar lib functions.
3. Make summary counts use the same visible range/filter scope as rendered events.
4. Split `AcademyCalendar.tsx` into toolbar, event card/list, and detail/memo panel components.
5. Improve event cards with type/status/owner/context text.
6. Improve selected event/date panel and calendar-local memo UX.
7. Add reset and preset filters.
8. Add future-source metadata, source-specific empty states, and no-fake-count behavior.
9. Add empty states and basic error/loading boundaries if practical.
10. Produce P1.5 recurrence policy note before any schema work.
11. Run lint/build and manual role/data QA.
12. If any direct action or integration needs non-calendar file edits, request user approval with exact paths and rationale before editing.
