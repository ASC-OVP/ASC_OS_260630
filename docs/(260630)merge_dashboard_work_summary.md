# Dashboard Work Merge Summary

## Scope

This thread handled Agent I dashboard work for the ASC academy operations dashboard. The work focused on turning `/dashboard` into a compact operations board that helps staff see today's classes, students, tasks, messages, OMR signals, and unresolved operational items from one place.

No Prisma schema changes were made. The latest UI refinement was intentionally limited to the `오늘의 운영 큐` and the right-side selected-item detail panel.

## Product Intent

- Make the dashboard an operations cockpit rather than a passive metric page.
- Keep the dashboard dense, scannable, and similar in scale to the rest of the admin UI.
- Treat the Operations Queue as the primary daily work surface.
- Separate responsibilities:
  - Left queue: scan, compare, filter, and select work.
  - Right panel: understand context and execute the recommended action.
- Route risky or durable actions to existing domain pages instead of directly mutating records from the dashboard.
- Reserve space for required future domains such as payment/materials even when the backing models are not connected yet.

## Files Changed

### `docs/development_plan.md`

Created the dashboard implementation plan from the product docs and current codebase. It covers:

- Product understanding and current implementation assessment.
- Feature scope and priority.
- UX/UI direction for the dashboard as an operations cockpit.
- Data/API implications.
- Phase roadmap, agent-friendly task breakdown, parallel/sequential work separation, QA plan, risks, and recommended execution order.

This file is planning documentation only. It is useful for future dashboard agents because it records the intended architecture and phased implementation boundaries.

### `app/dashboard/page.tsx`

Kept as a thin App Router entry point:

- Imports `DashboardPageView`.
- Exports `dynamic = "force-dynamic"`.
- Delegates all dashboard assembly to the feature module.

Merge note: this file should stay small unless routing-level behavior changes.

### `features/dashboard/types.ts`

Expanded dashboard-specific view types so server data assembly and client UI share one typed shape:

- `DashboardViewData`
- `DashboardSummaryCard`
- `OperationsInboxItem`
- `DashboardFilterState`
- `TodayClassOperation`
- `ManagementStudentItem`
- Communication, OMR, payment/material, and recent activity widget types

Intent: keep dashboard UI decoupled from raw Prisma rows and make Operations Queue items a consistent signal format.

### `features/dashboard/constants.ts`

Centralized dashboard constants:

- List/inbox/widget limits.
- Severity ordering.
- Signal type labels.
- Payment/material unavailable reason.

Intent: avoid hardcoded labels and sort logic inside the UI components.

### `features/dashboard/lib/dashboardQueries.ts`

Added/organized the server-side dashboard data loading layer.

It gathers academy-scoped data needed for the dashboard, including:

- Student counts and statuses.
- Today's attendance and assignment records.
- Student/class/task memo activity.
- Open tasks.
- Attention-needed students.
- Class groups and class-task counts.
- Message recipients.
- OMR uploads.

Intent: keep Prisma reads in one query-focused module and leave UI components to receive prepared view data.

### `features/dashboard/lib/dashboardFormatters.ts`

Added reusable dashboard formatting helpers for:

- Dates and due dates.
- Attendance/assignment/task/message/OMR/student status labels.
- Context labels.
- Text clipping.

Intent: keep Korean display labels and compact dashboard text formatting out of rendering code.

### `features/dashboard/lib/dashboardMetrics.ts`

Implemented the main raw-data-to-view-data transformation.

Key responsibilities:

- Builds top summary cards.
- Builds the Operations Queue from task, attendance, assignment, student, message, and OMR signals.
- Computes today's class operation rows.
- Builds management-needed student data.
- Builds communication, OMR, payment/material, and recent activity widgets.
- Generates dashboard-local filter options.
- Sorts queue items by severity and ownership.

Intent: this is the main dashboard business/view-model layer. Future agents should extend signal generation here before changing the client UI.

### `features/dashboard/components/DashboardPageView.tsx`

Reworked the dashboard server component:

- Requires the current user.
- Loads dashboard raw data via `getDashboardData`.
- Builds `DashboardViewData` through `buildDashboardViewData`.
- Renders a compact top header with academy operations status.
- Passes prepared data into `DashboardClient`.

Recent UI iterations also reduced the header footprint:

- Removed the generated timestamp line from the visible header.
- Moved the description inline beside the academy title.
- Kept `오늘 처리 흐름`, urgent shortcut, and `업무 생성` in the header actions.

### `features/dashboard/components/DashboardClient.tsx`

Implemented the interactive dashboard UI.

Current responsibilities:

- Dashboard-local search/filter state.
- Top summary card rendering.
- Operations Queue filtering and tab state.
- Selected queue item state.
- Right-side selected-item detail panel.
- Lower supporting widgets:
  - 오늘 수업 운영
  - 관리 필요 학생
  - 미납/교재
  - 최근 활동

Major UI changes made during this thread:

- Reduced overall dashboard visual scale to better match other pages.
- Compressed top search/filter controls and KPI cards.
- Added scroll height limits to the Operations Queue.
- Earlier queue version used a 3-column card grid; the latest refinement replaced it with a dense list/table.
- Latest queue columns:
  - 우선순위
  - 유형
  - 업무명
  - 대상
  - 담당자
  - 마감/기준
  - 상태
- Removed repeated per-item action buttons from the left queue.
- Left queue now selects work; right panel now owns the handling actions.
- Selected row is highlighted with subtle background and a left accent line.
- Right detail panel keeps badges, owner/basis date, reason/context, and recommended actions.
- Added a small `처리 액션` label above the right-panel action group.

Merge note: the most recent user request explicitly limited changes to the Operations Queue and right detail panel. Do not merge unrelated top/header/KPI/lower-widget changes from other branches over this file without checking visual regressions.

### `features/dashboard/components/AttentionStudentPanel.tsx`
### `features/dashboard/components/OpenTaskPanel.tsx`
### `features/dashboard/components/RecentMemoPanel.tsx`
### `features/dashboard/components/TodayAssignmentPanel.tsx`
### `features/dashboard/components/TodayAttendancePanel.tsx`
### `features/dashboard/components/DashboardSummaryCards.tsx`

These files currently re-export `DashboardPageView`.

Intent: preserve legacy import compatibility while the dashboard moved to a unified page-level implementation. They are not independent panel implementations yet.

Merge note: if another branch turns these into real components, resolve carefully. The current branch assumes `DashboardClient.tsx` owns the composed dashboard UI.

## Current UI Structure

```text
app/dashboard/page.tsx
-> features/dashboard/components/DashboardPageView.tsx
   -> getDashboardData()
   -> buildDashboardViewData()
   -> DashboardClient
      -> filter/search bar
      -> summary cards
      -> Operations Queue + selected detail panel
      -> lower supporting widgets
```

## Latest Requested Scope Boundary

The final refinement request was scoped to:

- `오늘의 운영 큐`
- Queue display style
- Queue filter/sort density
- Right selected-item detail panel
- Selected item highlight
- Action emphasis

The final refinement explicitly did not change:

- Sidebar
- Top header
- Global/top search and period/class filters
- KPI cards
- Lower support panels
- Existing data model or business logic
- Task creation route
- Routing structure

## Verification

The latest state was verified with:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

All passed.

Known build warnings not introduced by this dashboard UI work:

- Next.js detects multiple lockfiles and infers the workspace root from `/Users/pangsang/package-lock.json`.
- Turbopack reports an NFT tracing warning involving `next.config.ts`, Prisma, and `app/api/classes/create/route.ts`.

## Merge Notes

- This workspace copy does not appear to be a Git repository, so normal `git diff`/`git status` was unavailable here.
- `.next` output and local runtime files should not be treated as source changes.
- The dashboard code uses inline `CSSProperties`; when merging, avoid mixing shorthand and longhand border styles on the same dynamic element because React can warn during rerender.
- The dashboard still routes operational actions to existing pages. There is no schema-backed dashboard signal resolution workflow yet.
- Payment/materials remains a visible unavailable state until billing/material models are added.
