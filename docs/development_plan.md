# Dashboard Development Plan

Revision source: `/Users/pangsang/Downloads/260630_dash_guide_1.md`, `/Users/pangsang/Downloads/codex_dashboard_plan_revision_feedback.md`, multi-agent coordination notes, and current codebase inspection.

## 1. Product understanding

ASC dashboard must become an operations cockpit, not a passive metric board. Its north-star loop is:

```text
Open ASC
-> See what needs attention today
-> Select a student/class/issue
-> Understand context
-> Move safely to the right action
-> Later record resolution through a persistent workflow
```

The implementation loop should remain:

```text
Operational signal
-> Student / class / task context
-> Recommended safe action
-> Routed domain workflow now, persistent resolution later
```

Important product principles:

- The dashboard must answer "what requires attention today?" within a few seconds.
- Urgent work must be visually dominant; charts and counts are secondary.
- Summary cards are operational entry points, not decorative statistics.
- The Operations Inbox is the primary surface.
- A detail panel is required early so users can understand an item without immediately leaving the dashboard.
- Payment/Materials is product-required. Even before billing/material models exist, the dashboard must reserve visible UI space for it and clearly state that data is not connected yet.
- Search and filtering are core operational UX. Dashboard-local search/filter controls are in scope now; true global search belongs to a later shared AppShell epic.
- Sensitive actions must route to existing safe flows in P0/P1. The dashboard must not directly send SMS, mark payments, edit scores, resolve signals, or delete/overwrite records until schema-backed workflows and confirmations exist.

Primary users:

- `ADMIN` / `MANAGER`: whole-academy operations, risk, staff/task load, payment/material visibility.
- `TEACHER`: today's classes, assigned classes/students, attendance, homework, score risk, counseling follow-up.
- `ASSISTANT`: attendance/homework support, OMR review, assigned tasks/checklists.
- Admin staff role is not currently separate in `UserRole`; until added, treat admin-staff workflows as manager/admin-facing dashboard areas.

## 2. Current implementation assessment

Current route and structure:

- `app/dashboard/page.tsx` is a thin App Router page that imports `DashboardPageView` and exports `dynamic = "force-dynamic"`.
- `features/dashboard/components/DashboardPageView.tsx` currently performs authentication, Prisma reads, metric calculation, JSX rendering, and inline styling in one large server component.
- `features/dashboard/constants.ts`, `features/dashboard/types.ts`, `features/dashboard/lib/dashboardQueries.ts`, `features/dashboard/lib/dashboardMetrics.ts`, and `features/dashboard/lib/dashboardFormatters.ts` exist but are mostly minimal.
- `features/dashboard/components/*Panel.tsx` files currently re-export `DashboardPageView`; they are placeholders and should become real presentational components.

Existing strengths:

- Uses the existing Next.js App Router server component pattern. The installed Next docs describe App Router as React Server Components/Suspense/Server Functions based; preserve the current server-first approach unless browser state is needed.
- Reads academy-scoped data through `requireUser()` and Prisma.
- Already displays summary cards, priority items, open tasks, management-needed students, class signals, and recent memo alerts.
- Existing domain models can support the first implementation waves:
  - Students/classes: `Student`, `StudentClass`, `ClassGroup`, `ClassLesson`
  - Attendance/homework: `AttendanceRecord`, `AssignmentRecord`
  - Tasks: `Task`, `TaskAssignee`, `TaskComment`, task histories/reviews/submissions
  - Memos: `StudentMemo`, `ClassMemo`
  - Messaging: `MessageJob`, `MessageRecipient`, `SmsProviderLog`
  - OMR/score: `OmrUpload`, `OmrRecognizedAnswer`, `Exam`, `ExamResult`, `StudentTestScore`

Current gaps:

- The dashboard still reads like a statistics/panel screen. The "today operations queue" is not dominant enough.
- Queue items are derived ad hoc and lack a shared typed signal shape.
- No dashboard-local search/filter controls exist.
- No right-side read-only detail panel exists.
- Empty states are too final and do not guide users toward the next useful action.
- Risk logic is shallow: mostly `WATCH`, important memo, non-present attendance, and partial/missing assignment.
- There is no persistent `RiskSignal` / `DashboardSignal` model; therefore `Resolve`, `Snooze`, `Assign`, and durable resolution history cannot be implemented correctly in P0/P1.
- Payment/material models appear absent from the inspected schema. The plan must still include a visible Payment/Materials UI shell, but it must not show fake production numbers.
- Meaningful dashboard work currently collides in one file, so Phase 1 must reduce conflicts before broad parallel implementation.

Explicit non-scope for this dashboard revision:

- Do not modify `components/Sidebar.tsx`.
- Do not modify shared AppShell/header/navigation information architecture.
- Do not add global search to shared shell files.
- Do not change role-based sidebar visibility.
- Do not edit `components/ui/*`, `app/globals.css`, `lib/auth.ts`, or `lib/scopes.ts` unless explicitly assigned.

## 3. Feature scope and priority

### P0: Operations Inbox MVP with local controls

Purpose: make `/dashboard` operationally useful using existing data and derived, non-persistent signals.

Required:

- Refactor dashboard data flow into typed queries, metrics, and presentational components inside `features/dashboard`.
- Define a derived `OperationsInboxItem[]` type.
- Make the Operations Inbox the dominant main area.
- Add dashboard-local search/filter controls:
  - Text search: student name, class name, task/memo/reason text
  - Date scope: today, this week, or a simple current scope if full range is too large
  - Class filter where class data exists
  - Owner/assignee filter where data exists
  - Signal type filter
  - Status/severity filter
  - Visible active filters and reset action
- Show severity/type badges, reason, owner, time/due date, derived status, and safe actions per item.
- Use safe route actions to existing domain pages instead of dashboard mutations.
- Improve empty states with next actions.
- Keep signals derived and non-persistent.

### P1: Read-only Detail Panel and secondary operational widgets

Purpose: make the dashboard feel like an operations cockpit instead of a list of links.

Required immediately after P0:

- Add Phase 2.5 read-only detail panel.
- Selecting an inbox item updates the right panel without losing inbox context.
- The detail panel shows signal title, badges, context, reason, owner, time/due date, current derived status, recent related records, and safe next actions.
- Client components, if introduced, must receive serializable props.
- Add secondary widgets after detail panel:
  - Today Classes
  - Management Needed Students
  - Communication / Counseling
  - Payment / Materials UI Shell
  - OMR / Score Review
  - Recent Activity
- Add data freshness timestamp.

### P2: Interaction polish, role defaults, and data completeness

Purpose: make the dashboard efficient and resilient.

Required:

- Role-aware default sorting and emphasis.
- Better empty/loading/error states.
- Responsive layout pass.
- Text overflow handling.
- Fully wired filters if Phase 2 initially ships a partial UI shell.
- Product/UX acceptance checks.

### P3: Persistent operations workflow

Purpose: enable actual dashboard-owned resolution.

Requires one schema-owning agent:

- Add persistent `DashboardSignal` / `RiskSignal` or equivalent model.
- Add server actions for resolve, snooze, assign, and create linked follow-up task.
- Write resolution history to student timeline or equivalent activity history.
- Coordinate with student/task/memo domains before writing to their records.

### P4: Saved views, preferences, and payment/material integration

Purpose: complete advanced product workflows.

Required:

- Add saved dashboard views and user preferences.
- Connect Payment/Materials widget to real billing/material domain models once available.
- Show real counts and real item links only when model-backed data exists.
- Keep payment mutations inside billing/material owning domain safe flows.

## 4. UX/UI implementation direction

### Desktop layout

Use the current app shell/sidebar as-is. Inside dashboard content:

```text
Dashboard Page
├─ Page header
├─ Dashboard-local search/filter controls
├─ Summary cards
├─ Main work area
│  ├─ Left/wide: Operations Inbox
│  └─ Right/narrow: Read-only Detail Panel
└─ Secondary widgets
   ├─ Today Classes
   ├─ Management Needed Students
   ├─ Communication / Counseling
   ├─ Payment / Materials UI Shell
   ├─ OMR / Score Review
   └─ Recent Activity
```

Layout guidance:

- Summary card row: 5-6 cards where width allows; wrap responsively.
- Operations Inbox: approximately 60-70% of main work area width.
- Detail Panel: approximately 340-400px on desktop.
- Secondary widgets: compact cards below the main area.
- Card padding: about 16px.
- Section spacing: about 24px.
- Base spacing unit: 8px.
- Maintain dense admin-software readability; avoid marketing-style hero treatment.

### Header and controls

Recommended structure:

```text
[Page Header]
오늘의 운영 현황
2026-06-30 16:20 기준 · 테스트학원 · 전체 반 · 원장 보기

[Dashboard Controls]
Search input | Date scope | Class filter | Assignee filter | Signal type filter | Reset
```

Search placeholder:

```text
학생명, 반명, 업무 내용 검색
```

Rules:

- Dashboard-local search/filter is in scope now.
- True global search across students, parent phone, classes, schools, instructors, payments, messages, counseling notes, exams, and OMR records is a later AppShell-level epic.
- Do not modify shared AppShell files for this dashboard task.

### Summary cards

Recommended cards:

1. `오늘 수업`
2. `긴급 신호`
3. `관리 필요 학생`
4. `미처리 메시지`
5. `미납/교재`
6. `OMR/성적 검토`

Payment/Materials card behavior:

```text
미납/교재
데이터 연결 예정
결제·교재 모델 추가 후 자동 표시됩니다.
```

Do not display `0명`, `₩0`, or equivalent production-looking values unless real model-backed data verifies zero.

### Operations Inbox

Recommended tabs:

```text
전체
긴급
주의
오늘 마감
내 담당
보류
```

If persistent snooze/resolution does not exist yet, hide or disable `보류`; do not show a misleading functional tab.

Operations inbox item anatomy:

- Severity badge: `긴급`, `주의`, `확인`, `일반`
- Type badge: attendance, homework, task, memo, OMR, message, lifecycle, payment/material placeholder
- Main target: student name or class name
- Context: school/grade/class/instructor when available
- Reason: one sentence explaining why the item exists
- Time: occurredAt, updatedAt, or due date
- Owner: task assignee, class teacher, student teacher, or unassigned
- Resolution state: derived now, persistent later
- Actions: `학생 보기`, `반 보기`, `업무 보기/생성`, `메모 추가`, `문자 보내기`, `OMR 검토`, `요구사항 보기`

### Detail panel

Default sections:

```text
선택 항목 상세
- Title
- Severity/type badges
- Student/class context
- Reason
- Owner/assignee
- Time/due date
- Recommended actions
- Recent related records
```

Default empty state:

```text
오늘의 운영 큐에서 항목을 선택하세요.
학생/반 맥락, 최근 기록, 권장 액션을 이곳에서 확인할 수 있습니다.
```

Detail panel rules:

- Read-only in P1.
- Safe navigation actions only.
- No direct resolve, snooze, assign, send SMS, mark paid, edit score, delete, or overwrite.
- Preserve inbox context when selecting an item.

### Payment / Materials UI shell

Treat Payment/Materials as product-required but model-blocked.

Allowed now:

- Summary card slot.
- Secondary widget shell.
- Unavailable state.
- Interface contract.
- Safe requirement/documentation link if a route or doc exists.

Not allowed now:

- Fake production data.
- New payment mutation from dashboard.
- Mark as paid from dashboard.
- Refund/cancel from dashboard.
- Schema edits unless assigned to billing/material owner.

Unavailable widget copy:

```text
결제·교재 데이터 연결 예정
수강료, 교재비, 교재 배부 상태는 결제/교재 모델 연결 후 표시됩니다.
```

Suggested data contract:

```ts
type PaymentMaterialsWidgetData =
  | {
      status: "unavailable";
      reason: "billing_material_models_not_connected";
    }
  | {
      status: "available";
      overdueStudents: number;
      unpaidTuitionCount: number;
      unpaidMaterialCount: number;
      undistributedMaterialCount: number;
      refundReviewCount: number;
      items: Array<{
        id: string;
        studentName: string;
        className?: string;
        itemLabel: string;
        amount?: number;
        statusLabel: string;
        dueText?: string;
        href: string;
      }>;
    };
```

## 5. Data model and API implications

### Existing data that can power P0/P1

- Student status/risk: `Student.status`, `StudentMemo.isImportant`, `StudentMemo.type`
- Class context: `ClassGroup`, `ClassLesson`, `StudentClass`, `ClassMemo`
- Attendance: `AttendanceRecord.status`, `AttendanceRecord.date`
- Homework: `AssignmentRecord.status`, `AssignmentRecord.date`
- Tasks: `Task.status`, `Task.priority`, `Task.dueDate`, `Task.assigneeId`, `Task.studentId`, `Task.classGroupId`
- Communication: `MessageJob.status`, `MessageRecipient.status`, `MessageRecipient.errorMessage`
- OMR/score: `OmrUpload.recognizeStatus`, `matchStatus`, `gradingStatus`, `OmrRecognizedAnswer.status`, `ExamResult.reviewNeededCount`, `StudentTestScore`

### Dashboard data architecture

- Keep read queries in `features/dashboard/lib/dashboardQueries.ts`.
- Keep signal derivation, filtering, sorting, and role emphasis in `features/dashboard/lib/dashboardMetrics.ts`.
- Keep labels, date text, status text, and clipping in `features/dashboard/lib/dashboardFormatters.ts`.
- Keep shared types in `features/dashboard/types.ts`.
- Keep product constants, severity order, list limits, filter defaults, and unavailable reasons in `features/dashboard/constants.ts`.
- Keep page-level data fetching in server components.
- Introduce a client component only for local search/filter state and detail-panel selection if server links/search params are insufficient.
- If a client component is introduced, pass only serializable DTOs, not raw Prisma Date objects or relation-heavy records.

### P0/P1 signal strategy

Use derived, non-persistent `OperationsInboxItem[]` from existing records:

- Open tasks
- Important memos
- `WATCH`, `PAUSED`, or lifecycle attention states
- Attendance exceptions and missing attendance checks
- Missing or partial assignments
- Failed/pending message recipients
- OMR recognition/grading/review-needed states
- Today class operation gaps
- Payment/material unavailable placeholder item only if useful, clearly marked as unavailable and not a real operational debt count

### Future schema concept for P3

Do not merge this into P0/P1 unless a schema owner is explicitly assigned.

```text
DashboardSignal / RiskSignal
- id
- academyId
- studentId?
- classGroupId?
- taskId?
- sourceType
- sourceId?
- signalType
- severity
- title
- reason
- recommendedAction
- status
- assigneeId?
- occurredAt
- dueAt?
- snoozedUntil?
- resolvedAt?
- resolvedById?
- resolutionNote?
- createdAt
- updatedAt
```

Potential saved view model:

```text
DashboardSavedView
- id
- academyId
- userId
- name
- filtersJson
- sortJson
- isDefault
- createdAt
- updatedAt
```

Potential preferences model:

```text
DashboardPreference
- id
- academyId
- userId
- widgetOrderJson
- hiddenWidgetsJson
- density
- createdAt
- updatedAt
```

## 6. Phase-based implementation roadmap

### Phase 0: Preparation and boundaries

- Confirm dashboard ownership: `features/dashboard/*` and `app/dashboard/page.tsx`.
- Treat shared files as controlled areas.
- Do not modify sidebar/AppShell/global navigation.
- Do not add dependencies.
- Keep `/dashboard` route.
- Keep current Next.js App Router server-first style.

### Phase 1: Data/type refactor

Goal: make later work parallelizable.

- Move constants from `DashboardPageView.tsx` to `features/dashboard/constants.ts`.
- Expand `features/dashboard/types.ts` with:
  - `DashboardSummaryCard`
  - `OperationsInboxItem`
  - `DashboardSignalSeverity`
  - `DashboardSignalType`
  - `DashboardFilterState`
  - `DashboardDetail`
  - `TodayClassOperation`
  - `PaymentMaterialsWidgetData`
- Move Prisma reads into `getDashboardData()` or related functions in `features/dashboard/lib/dashboardQueries.ts`.
- Move class date matching, attendance/homework checks, signal derivation, filtering, and sorting into `features/dashboard/lib/dashboardMetrics.ts`.
- Move labels/formatting into `features/dashboard/lib/dashboardFormatters.ts`.
- Convert placeholder panel files into actual presentational components or replace them with clearly named new components.
- Keep visual behavior mostly stable until shared types land.

### Phase 2: Operations Inbox MVP

Goal: dashboard becomes queue-first.

- Build derived `OperationsInboxItem[]`.
- Make Operations Inbox the largest and most important screen area.
- Add severity/type badges, reason, owner, timestamp/due date, state, and safe route actions.
- Add dashboard-local filter/search area. If full wiring is too large, ship the UI shell and wire primary text/type/date filters first.
- Add active filter display and reset filters.
- Improve empty states with guided next actions.
- Keep actions as safe links to owning domain pages.
- Do not implement direct resolve/snooze/assign mutations.

### Phase 2.5: Read-only Dashboard Detail Panel

Goal: preserve context while users inspect a selected issue.

- Implement `DashboardDetailPanel`.
- Selecting an Operations Inbox item updates the right panel without navigating away.
- Show selected signal title, badges, student/class context, related class/instructor/assignee, reason, time/due date, current derived status, recent related records, and safe actions.
- If no item is selected, show guided empty state.
- Ensure client/server boundary props are serializable.
- Keep actions as safe links only.
- No direct resolve/snooze/assign/send/mark/edit/delete mutations.

### Phase 3: Secondary widgets and UI shells

Goal: make the dashboard cover daily academy operations.

- Implement `TodayClassesWidget`.
- Implement `ManagementNeededStudentsPanel`.
- Implement `CommunicationWidget`.
- Implement `OmrScoreReviewWidget`.
- Implement `RecentActivityPanel`.
- Implement `PaymentMaterialsWidget` with unavailable state.
- Add Payment/Materials summary card slot.
- Add data freshness timestamp.
- Fully wire dashboard-local filters if Phase 2 shipped partial wiring.

### Phase 4: Role defaults and interaction polish

Goal: make the dashboard feel finished and role-aware.

- Add role-aware default sorting/emphasis:
  - `ADMIN` / `MANAGER`: academy-wide risk, tasks, messages, OMR, payment/material shell
  - `TEACHER`: own classes/students and teaching signals first
  - `ASSISTANT`: attendance/homework/OMR/assigned tasks first
- Improve empty/loading/error states.
- Add responsive behavior pass.
- Handle text overflow in cards, tabs, buttons, and detail panel.
- Confirm active filters and reset behavior.
- Run product/UX acceptance checks.

### Phase 5: Persistent resolution workflow

Goal: support durable dashboard-owned workflow state.

- Schema-owning agent adds persistent signal/resolution models and migrations.
- Dashboard action agent adds server actions for resolve, snooze, assign, and create follow-up task.
- Coordinate with student/task/memo domains before writing to their timelines/history.
- Add audit/activity logging for sensitive changes.

### Phase 6: Saved views, preferences, and Payment/Materials integration

- Add saved views and user dashboard preferences.
- Connect Payment/Materials widget to real billing/material domain models once available.
- Add real payment/material counts and item links.
- Keep sensitive payment/material mutations inside owning domain safe flows.

## 7. Codex-agent-friendly task breakdown

### Agent I-A: Dashboard data foundation

Owned files:

- `features/dashboard/types.ts`
- `features/dashboard/constants.ts`
- `features/dashboard/lib/dashboardQueries.ts`
- `features/dashboard/lib/dashboardMetrics.ts`
- `features/dashboard/lib/dashboardFormatters.ts`

Tasks:

- Define dashboard DTOs and shared types.
- Implement academy-scoped dashboard query functions.
- Implement derived signal generation, filtering, sorting, and summary counts.
- Add `PaymentMaterialsWidgetData` unavailable/available contract.
- Avoid UI layout changes except import adjustments needed by UI agents.

### Agent I-B: Operations Inbox UI

Owned files:

- `features/dashboard/components/DashboardPageView.tsx`
- new or repurposed `features/dashboard/components/OperationsInboxPanel.tsx`
- `features/dashboard/components/DashboardSummaryCards.tsx`

Tasks:

- Make Operations Inbox the dominant screen area.
- Render typed queue items with severity, type, reason, owner, due/time, status, and safe actions.
- Ensure layout leaves room for a right detail panel.
- Add guided empty states.
- Do not implement direct mutation actions in P0.

### Agent I-C: Today classes and risk panels

Owned files:

- `features/dashboard/components/TodayAttendancePanel.tsx`
- `features/dashboard/components/TodayAssignmentPanel.tsx`
- `features/dashboard/components/AttentionStudentPanel.tsx`
- optionally new `features/dashboard/components/TodayClassesWidget.tsx`

Tasks:

- Implement today class list with attendance/homework state.
- Implement management-needed student cards with risk reasons.
- Keep business logic in `dashboardMetrics.ts`, not component files.

### Agent I-D: Communication and OMR widgets

Owned files:

- new `features/dashboard/components/CommunicationWidget.tsx`
- new `features/dashboard/components/OmrScoreReviewWidget.tsx`
- `features/dashboard/lib/dashboardQueries.ts`
- `features/dashboard/types.ts`

Tasks:

- Add failed/pending message summary and safe links to `/messages`.
- Add OMR recognition/grading/review-needed summary and links to `/omr`.
- Do not implement SMS retry or OMR mutation from dashboard.

### Agent I-E: Read-only Detail Panel

Owned files:

- new `features/dashboard/components/DashboardDetailPanel.tsx`
- possibly new client shell component under `features/dashboard/components/`

Tasks:

- Implement selected item detail behavior after Operations Inbox item types stabilize.
- Add client-side selection only if necessary.
- Ensure props crossing client boundary are serializable.
- Use safe link actions only.
- Show guided empty state when no item is selected.

### Agent I-G: Payment / Materials UI Shell

Owned files:

- new `features/dashboard/components/PaymentMaterialsWidget.tsx`
- `features/dashboard/components/DashboardSummaryCards.tsx`
- `features/dashboard/types.ts`
- `features/dashboard/lib/dashboardMetrics.ts`

Tasks:

- Add Payment/Materials summary card slot.
- Add secondary widget shell with unavailable state.
- Do not show fake production counts.
- Do not add schema or payment mutations.
- Reserve layout space for later billing/material integration.

### Agent I-H: Dashboard Filters / Search

Owned files:

- new `features/dashboard/components/DashboardFilterBar.tsx`
- `features/dashboard/types.ts`
- `features/dashboard/lib/dashboardMetrics.ts`
- `features/dashboard/lib/dashboardFormatters.ts`

Tasks:

- Add local search input.
- Add class/type/status/assignee/date filters where data exists.
- Show active filters.
- Add reset filters.
- Do not modify shared global AppShell search.

### Agent I-F: Persistent signal model

Owned files:

- `prisma/schema.prisma`
- migration files
- dashboard server actions under `features/dashboard/actions/*` or `app/dashboard/actions.ts` if project convention requires

Tasks:

- Add persistent signal/resolution models.
- Implement resolve/snooze/assign actions.
- Coordinate with student/task domains before writing to their timelines.
- Run only after P0/P1 dashboard types and workflows are stable.

## 8. Parallelizable vs sequential task separation

Parallelizable after Phase 1 types are stable:

- Summary card presentation
- Operations Inbox presentation
- Dashboard-local filter UI presentation
- Today Classes widget
- Management Needed Students panel
- Communication widget
- OMR/Score Review widget
- Payment/Materials UI shell
- Recent Activity panel
- Empty/loading/error state pass

Sequential:

- Phase 1 shared types/constants before broad UI work.
- `dashboardQueries.ts` before widgets rely on query data.
- `dashboardMetrics.ts` signal derivation before Inbox and summary cards finalize behavior.
- Operations Inbox item type before Detail Panel.
- Detail Panel before broad polish, so layout problems are found early.
- Persistent resolve/snooze/assign after schema migration, and never in parallel with unrelated Prisma edits.
- Real Payment/Materials integration after billing/material domain models exist.
- Shared AppShell/sidebar/global search changes are separate later epics, not dashboard work.

## 9. Testing and QA plan

Static checks:

- Run `npm run lint` after each implementation phase.
- Run `npm run build` after Phase 2 and later broad UI/data changes.

Data scenarios:

- No students/classes/tasks: guided empty states appear.
- Today has classes but no attendance records: inbox shows attendance missing.
- Today has attendance with `ABSENT`, `LATE`, or other non-present statuses: inbox explains reason.
- Today has assignment `PARTIAL` or `MISSING`: inbox explains homework risk.
- Student has `WATCH` and important memo: risk reasons merge without duplicates.
- Task is `URGENT` or `HIGH` and open: severity and ordering are correct.
- Message recipient failed: communication widget links to message context.
- OMR upload has recognition/grading/review-needed state: OMR widget links to review.
- Payment/material model is unavailable: card/widget show unavailable copy, not fake zero values.
- Teacher role sees own classes/students first.
- Assistant role sees attendance/homework/OMR/assigned tasks first.

Search/filter QA:

- User can filter Operations Inbox without leaving dashboard.
- Active filters are visible.
- Reset filters clears local dashboard filters.
- Text search covers student name, class name, and task/memo/reason text.
- Summary card behavior under filters is documented or predictable.
- Filter implementation does not require shared AppShell changes.

Detail panel QA:

- Selecting an inbox item updates the right panel without losing inbox context.
- Panel explains why the issue exists.
- Panel shows at least one safe next action.
- Panel empty state is useful when nothing is selected.
- Client component props are serializable.

Product/UX QA:

- Dashboard reads as an operations cockpit, not a metric board.
- User can identify urgent work within 5 seconds.
- Operations Inbox is visually dominant.
- Summary cards act as operational entry points.
- Every major queue item has a clear reason.
- Every major queue item has at least one safe next action.
- Status colors are paired with text labels.
- Empty states suggest useful next actions.
- Sensitive actions route to existing safe flows rather than executing immediately.
- Dashboard remains readable at dense admin-software information density.

Regression checks:

- `/dashboard` loads for authenticated users.
- Existing links to `/students`, `/classes`, `/tasks`, `/memos`, `/messages`, and `/omr` remain valid.
- No generated Prisma files are manually edited.
- No broad formatting-only diffs.
- No sidebar/AppShell/global navigation changes are made in this dashboard task.

## 10. Risks, ambiguities, assumptions, and recommended execution order

### Risks

- Persistent resolution cannot be correct without a new model or agreed reuse of an existing activity/history model.
- Payment/material workflows are product-required but model-blocked.
- Client-side selection can accidentally receive non-serializable server data if DTO boundaries are not defined.
- Broad dashboard refactors can create conflicts because current logic is concentrated in `DashboardPageView.tsx`.
- Role-specific scoping may need `lib/scopes.ts`; keep initial role behavior conservative unless the auth/scopes owner coordinates.
- Showing Payment/Materials as unavailable must be visually clear so users do not interpret it as a true zero state.

### Ambiguities

- Whether future `Resolve`, `Snooze`, and `Assign` should update a new signal record, create/update tasks, or write student memo/history.
- Exact score-risk thresholds: sharp drop, three consecutive decline, and class-average gap need product values.
- Exact payment/material domain model and route names are not available.
- Whether saved dashboard views should be per-user, per-role, or academy-wide defaults.
- Whether local filters should update summary card counts or only the inbox. Pick one behavior in implementation and label it clearly.

### Assumptions

- P0/P1 can be delivered with derived, non-persistent signals.
- Dashboard remains read-heavy until schema-backed resolution is introduced.
- Existing domain pages own sensitive mutations and confirmations.
- Payment/Materials gets visible unavailable UI before real billing/material data exists.
- Sidebar/AppShell/global search are out of scope for this dashboard revision.
- The current Next.js App Router server component pattern remains the default.

### Recommended execution order

1. Phase 1: land dashboard data/type refactor.
2. Phase 2: land Operations Inbox MVP with local search/filter controls.
3. Phase 2.5: land read-only Detail Panel.
4. Phase 3: land secondary widgets, including Payment/Materials UI Shell.
5. Phase 4: land role defaults, responsive behavior, and interaction polish.
6. Phase 5: decide and land persistent signal/resolution schema through one schema owner.
7. Phase 6: add saved views/preferences and connect real Payment/Materials when domain models are available.

