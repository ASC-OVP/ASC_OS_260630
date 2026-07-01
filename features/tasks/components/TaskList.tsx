import { canCreateTask, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ClassGroup, RecurringTask, Student, Task, TaskChecklistItem, TaskComment, TaskSubmission, User } from "@/lib/generated/prisma";
import { daysOfWeekText, generateDueRecurringTasks, getNextRecurringDate, monthlyDaysText, splitRecurringDescription } from "@/lib/recurringTasks";
import ChecklistBuilder from "./ChecklistBuilder";
import AssigneeFilterDropdown from "./AssigneeFilterDropdown";
import DropdownOptionLink from "./DropdownOptionLink";
import InlineEditDisclosure from "./InlineEditDisclosure";
import TaskCardEditShell from "./TaskCardEditShell";
import RecurringTaskRowShell from "./RecurringTaskRowShell";
import TaskColorPopover from "./TaskColorPopover";
import TaskFormColorPicker from "./TaskFormColorPicker";
import TaskPrioritySelector from "./TaskPrioritySelector";
import RecurringTaskFormControls from "./RecurringTaskFormControls";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Badge, ButtonLink, PageHeader } from "@/components/ui";
import {
  createRecurringTaskAction,
  submitTaskAction,
  toggleRecurringTaskAction,
  updateRecurringTaskAction,
  updateTaskColorAction,
  updateTaskDetailsAction,
  updateTaskStatus,
} from "@/features/tasks/actions/taskActions";

type TaskRow = Task & {
  assignee: Pick<User, "id" | "name" | "role">;
  creator: Pick<User, "id" | "name" | "role">;
  student: Pick<Student, "id" | "name"> | null;
  classGroup: Pick<ClassGroup, "id" | "name" | "teacherId"> | null;
  recurringTask: Pick<RecurringTask, "id" | "title"> | null;
  assignees: Array<{
    assigneeId: string;
    color: string | null;
    assignee: Pick<User, "id" | "name" | "role">;
  }>;
  checklistItems: TaskChecklistItem[];
  comments: Array<TaskComment & { writer: Pick<User, "name"> }>;
  submissions: Array<TaskSubmission & { submittedBy: Pick<User, "name"> }>;
};

type RecurringTaskRow = RecurringTask & {
  assignee: Pick<User, "id" | "name" | "role">;
  creator: Pick<User, "id" | "name" | "role">;
  student: Pick<Student, "id" | "name"> | null;
  classGroup: Pick<ClassGroup, "id" | "name" | "teacherId"> | null;
  tasks: Array<Pick<Task, "id" | "status" | "completedAt" | "assigneeId"> & { assignees: Array<{ assigneeId: string }> }>;
  _count: { tasks: number };
};

type TaskSearchParams = {
  tab?: string;
  view?: string;
  status?: string;
  scope?: string;
  sort?: string;
  assignee?: string;
  manage?: string;
  newRecurring?: string;
  error?: string;
};

type Props = {
  searchParams?: Promise<TaskSearchParams>;
};

type TaskView = "all" | "mine";
type TaskStatusFilter = "all" | "open" | "done";
type TaskScopeFilter = "all" | "recurring" | "general";
type TaskSortKey = "status" | "due" | "priority" | "recent" | "completed";

type TaskControls = {
  view: TaskView;
  status: TaskStatusFilter;
  scope: TaskScopeFilter;
  sort: TaskSortKey;
  assigneeIds: string[];
};

const statusOrder: Record<string, number> = {
  OVERDUE: 0,
  IN_PROGRESS: 1,
  TODO: 2,
  HOLD: 3,
  DONE: 4,
  SUBMITTED: 5,
  REVIEW: 5,
  REJECTED: 5,
};

const priorityOrder: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export default async function SimpleTasksPage({ searchParams }: Props = {}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const isAssistant = user.role === "ASSISTANT";
  const isAdmin = user.role === "ADMIN";
  const canCreate = canCreateTask(user.role);
  const controls = taskControlsFromParams(params, user.role);
  const showRecurringManager = params.manage === "recurring" || params.newRecurring === "1" || params.tab === "recurring";

  const todayKey = toYmd(new Date());
  await generateDueRecurringTasks(user, addDays(new Date(), 45));

  const [tasks, recurringTasks, staff, students, classGroups] = await Promise.all([
    prisma.task.findMany({
      where: taskWhereForRole(user),
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        creator: { select: { id: true, name: true, role: true } },
        student: { select: { id: true, name: true } },
        classGroup: { select: { id: true, name: true, teacherId: true } },
        recurringTask: { select: { id: true, title: true } },
        assignees: {
          orderBy: { createdAt: "asc" },
          include: { assignee: { select: { id: true, name: true, role: true } } },
        },
        checklistItems: { orderBy: { order: "asc" } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { writer: { select: { name: true } } },
        },
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { submittedBy: { select: { name: true } } },
        },
      },
    }),
    prisma.recurringTask.findMany({
      where: recurringTaskWhereForRole(user),
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        creator: { select: { id: true, name: true, role: true } },
        student: { select: { id: true, name: true } },
        classGroup: { select: { id: true, name: true, teacherId: true } },
        tasks: {
          where: { scheduledDate: todayKey },
          select: {
            id: true,
            status: true,
            completedAt: true,
            assigneeId: true,
            assignees: { select: { assigneeId: true } },
          },
        },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.user.findMany({ where: { academyId: user.academyId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.student.findMany({ where: { academyId: user.academyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.classGroup.findMany({
      where: {
        academyId: user.academyId,
        ...(user.role === "TEACHER" ? { teacherId: user.id } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);

  const listTasks = tasks.filter((task) => shouldShowTaskInWorkList(task, todayKey));
  const sortedTasks = sortTasks(listTasks, controls.sort);
  const visibleTasks = filterTasksByControls(sortedTasks, controls, user.id);
  const doneTasks = listTasks.filter((task) => task.status === "DONE");
  const incompleteTasks = listTasks.filter((task) => task.status !== "DONE");
  const overdueTasks = listTasks.filter((task) => effectiveStatus(task) === "OVERDUE");
  const todayTasks = listTasks.filter((task) => isToday(task.dueDate) && task.status !== "DONE");
  const dueSoonTasks = listTasks.filter((task) => isDueSoon(task.dueDate) && task.status !== "DONE");
  const inProgressTasks = listTasks.filter((task) => task.status === "IN_PROGRESS");
  const holdTasks = listTasks.filter((task) => task.status === "HOLD");
  const completedToday = doneTasks.filter((task) => isToday(task.completedAt));
  const completionRate = listTasks.length ? Math.round((doneTasks.length / listTasks.length) * 100) : 0;
  const taskHeaderStats: Array<{ label: string; value: string; tone?: HeaderStatTone }> = isAssistant
    ? [
        { label: "오늘 할 일", value: `${todayTasks.length}개`, tone: todayTasks.length ? "warn" : "default" },
        { label: "진행 중", value: `${inProgressTasks.length}개` },
        { label: "기한 임박", value: `${dueSoonTasks.length}개`, tone: dueSoonTasks.length ? "warn" : "default" },
        { label: "보류", value: `${holdTasks.length}개`, tone: "hold" },
        { label: "완료", value: `${doneTasks.length}개` },
      ]
    : [
        { label: "전체", value: `${sortedTasks.length}개` },
        { label: "완료", value: `${doneTasks.length}개` },
        { label: "미완료", value: `${incompleteTasks.length}개`, tone: incompleteTasks.length ? "warn" : "default" },
        { label: "지연", value: `${overdueTasks.length}개`, tone: overdueTasks.length ? "danger" : "default" },
        { label: "오늘 완료", value: `${completedToday.length}개` },
        { label: "완료율", value: `${completionRate}%` },
      ];

  return (
    <main style={page}>
      <section style={container}>
        <div style={header}>
          <PageHeader
            eyebrow="업무 관리"
            title={
              <span style={titleWithStats}>
                <span>{isAssistant ? "내 업무 처리" : "업무 진행 현황"}</span>
                <HeaderStats items={taskHeaderStats} />
              </span>
            }
            description={
              isAssistant
                ? "배정된 업무를 진행하고, 완료할 때 처리 메모와 증거를 남깁니다."
                : "누가 언제 어떤 업무를 처리했는지 진행 기록과 반복 업무를 확인합니다."
            }
            actions={
              <div className="asc-action-group">
                <Badge tone="navy">{roleLabel(user.role)}</Badge>
                {canCreate && <ButtonLink href="/tasks/new" size="sm">일반 업무 추가</ButtonLink>}
                {canCreate && (
                  <ButtonLink href={showRecurringManager ? "/tasks" : "/tasks?manage=recurring"} variant="tertiary" size="sm">
                    {showRecurringManager ? "정기 업무 접기" : "정기 업무 관리"}
                  </ButtonLink>
                )}
              </div>
            }
          />
        </div>

        {showRecurringManager && (
          <section style={recurringManager}>
            {canCreate && params.newRecurring === "1" && (
              <Panel title="정기 업무 추가" right={<Link href="/tasks?manage=recurring" style={smallLink}>닫기</Link>}>
                {params.error === "empty" && <p style={errorText}>업무명, 담당자, 시작일을 입력해주세요.</p>}
                <RecurringTaskForm staff={staff} students={students} classGroups={classGroups} />
              </Panel>
            )}
            <Panel
              title="정기 업무 목록"
              right={
                canCreate && params.newRecurring !== "1" ? <ButtonLink href="/tasks?manage=recurring&newRecurring=1" variant="tertiary" size="sm">정기 업무 추가</ButtonLink> : null
              }
            >
              <RecurringTaskTable rows={recurringTasks} staff={staff} students={students} classGroups={classGroups} canEdit={canCreate} currentUser={user} />
            </Panel>
          </section>
        )}

        <section style={workSplit}>
          <Panel title={taskPanelTitle(controls, isAssistant)} right={<span style={softText}>{visibleTasks.length}개</span>}>
            <TaskControlsBar controls={controls} isAssistant={isAssistant} isAdmin={isAdmin} staff={staff} />
            <div style={taskList}>
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUser={user}
                  isAssistant={isAssistant}
                  staff={staff}
                  students={students}
                  classGroups={classGroups}
                />
              ))}
              {visibleTasks.length === 0 && <Empty>업무가 없습니다.</Empty>}
            </div>
          </Panel>
          <aside style={stickyCalendarPanel}>
            <div style={stickyCalendarInner}>
              <Panel title={isAssistant ? "내 업무 캘린더" : "업무 기간 캘린더"} right={<Link href="/calendar" style={smallLink}>상세 캘린더</Link>}>
                <CompactTaskCalendar tasks={visibleTasks} currentUserId={user.id} isAssistant={isAssistant} />
              </Panel>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function taskWhereForRole(user: { id: string; academyId: string; role: string }) {
  if (user.role === "ASSISTANT") {
    return {
      academyId: user.academyId,
      OR: [
        { assigneeId: user.id },
        { assignees: { some: { assigneeId: user.id } } },
      ],
    };
  }

  if (user.role === "TEACHER") {
    return {
      academyId: user.academyId,
      OR: [
        { creatorId: user.id },
        { assigneeId: user.id },
        { assignees: { some: { assigneeId: user.id } } },
        { classGroup: { teacherId: user.id } },
        { student: { teacherId: user.id } },
      ],
    };
  }

  return { academyId: user.academyId };
}

function recurringTaskWhereForRole(user: { id: string; academyId: string; role: string }) {
  if (user.role === "ASSISTANT") {
    return { academyId: user.academyId, assigneeId: user.id };
  }

  if (user.role === "TEACHER") {
    return {
      academyId: user.academyId,
      OR: [
        { creatorId: user.id },
        { assigneeId: user.id },
        { classGroup: { teacherId: user.id } },
        { student: { teacherId: user.id } },
      ],
    };
  }

  return { academyId: user.academyId };
}

function shouldShowTaskInWorkList(task: TaskRow, todayKey: string) {
  if (!task.recurringTaskId || !task.scheduledDate) return true;
  return task.scheduledDate <= todayKey;
}

function taskControlsFromParams(params: TaskSearchParams, role: string): TaskControls {
  const isAssistant = role === "ASSISTANT";
  const isAdmin = role === "ADMIN";
  let view = normalizeTaskView(params.view, isAssistant);
  let status = normalizeStatusFilter(params.status);
  let scope = normalizeScopeFilter(params.scope);

  if (!params.view && params.tab === "mine") view = "mine";
  if (!params.status && params.tab === "open") status = "open";
  if (!params.status && params.tab === "done") status = "done";
  if (!params.scope && params.tab === "general") scope = "general";
  if (!params.scope && params.tab === "recurring") scope = "recurring";

  return {
    view: isAssistant || isAdmin ? "all" : view,
    status,
    scope,
    sort: normalizeSortKey(params.sort),
    assigneeIds: isAdmin ? assigneeIdsValue(params.assignee) : [],
  };
}

function assigneeIdsValue(value: string | undefined) {
  if (!value) return [];
  return [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
}

function normalizeTaskView(value: string | undefined, isAssistant: boolean): TaskView {
  if (!isAssistant && value === "mine") return "mine";
  return "all";
}

function normalizeStatusFilter(value: string | undefined): TaskStatusFilter {
  if (value === "open" || value === "done") return value;
  return "all";
}

function normalizeScopeFilter(value: string | undefined): TaskScopeFilter {
  if (value === "recurring" || value === "general") return value;
  return "all";
}

function normalizeSortKey(value: string | undefined): TaskSortKey {
  if (value === "due" || value === "priority" || value === "recent" || value === "completed") return value;
  return "status";
}

function filterTasksByControls(tasks: TaskRow[], controls: TaskControls, userId: string) {
  return tasks.filter((task) => {
    if (controls.view === "mine" && !isTaskAssignedTo(task, userId)) return false;
    if (controls.assigneeIds.length > 0 && !controls.assigneeIds.some((assigneeId) => isTaskAssignedTo(task, assigneeId))) return false;
    if (controls.status === "open" && task.status === "DONE") return false;
    if (controls.status === "done" && task.status !== "DONE") return false;
    if (controls.scope === "recurring" && !task.recurringTaskId) return false;
    if (controls.scope === "general" && task.recurringTaskId) return false;
    return true;
  });
}

function sortTasks(tasks: TaskRow[], sort: TaskSortKey) {
  return [...tasks].sort((a, b) => {
    if (sort === "due") return compareDueAsc(a, b) || compareStatus(a, b) || compareCreatedDesc(a, b);
    if (sort === "priority") return comparePriority(a, b) || compareDueAsc(a, b) || compareCreatedDesc(a, b);
    if (sort === "recent") return compareCreatedDesc(a, b);
    if (sort === "completed") return compareCompletedDesc(a, b) || compareStatus(a, b) || compareDueAsc(a, b);
    return compareStatus(a, b) || compareDueAsc(a, b) || compareCreatedDesc(a, b);
  });
}

function compareStatus(a: TaskRow, b: TaskRow) {
  return (statusOrder[effectiveStatus(a)] ?? 99) - (statusOrder[effectiveStatus(b)] ?? 99);
}

function comparePriority(a: TaskRow, b: TaskRow) {
  return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
}

function compareDueAsc(a: Pick<Task, "dueDate">, b: Pick<Task, "dueDate">) {
  const aTime = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTime = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aTime === bTime) return 0;
  return aTime - bTime;
}

function compareCreatedDesc(a: Pick<Task, "createdAt">, b: Pick<Task, "createdAt">) {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function compareCompletedDesc(a: Pick<Task, "completedAt">, b: Pick<Task, "completedAt">) {
  const aTime = a.completedAt?.getTime() ?? 0;
  const bTime = b.completedAt?.getTime() ?? 0;
  if (aTime === bTime) return 0;
  return bTime - aTime;
}

function isTaskAssignedTo(task: TaskRow, userId: string) {
  return task.assigneeId === userId || task.assignees.some((assignment) => assignment.assigneeId === userId);
}

function assigneeNames(task: TaskRow) {
  const names = task.assignees.map((assignment) => assignment.assignee.name);
  return names.length > 0 ? names.join(", ") : task.assignee.name;
}

function taskDisplayColor(task: TaskRow, currentUserId: string, isAssistant: boolean) {
  const personalColor = task.assignees.find((assignment) => assignment.assigneeId === currentUserId)?.color;
  const assignedColor = (isAssistant ? personalColor : task.color) || task.color || personalColor;
  if (assignedColor) return assignedColor;
  if (task.status === "DONE") return "#3d85c6";
  return statusColor(effectiveStatus(task));
}

function taskPanelTitle(controls: TaskControls, isAssistant: boolean) {
  const base = isAssistant ? "내 업무" : controls.view === "mine" ? "내 담당 업무" : "전체 업무";
  const scope = controls.scope === "recurring" ? "정기" : controls.scope === "general" ? "일반" : "";
  const status = controls.status === "open" ? "미완료" : controls.status === "done" ? "완료" : "";
  const detail = [scope, status].filter(Boolean).join(" ");
  return detail ? `${base} / ${detail}` : base;
}

function TaskControlsBar({
  controls,
  isAssistant,
  isAdmin,
  staff,
}: {
  controls: TaskControls;
  isAssistant: boolean;
  isAdmin: boolean;
  staff: Array<Pick<User, "id" | "name" | "role">>;
}) {
  const viewOptions = [
    { key: "all", label: "전체 업무", href: taskControlsHref(controls, { view: "all" }) },
    { key: "mine", label: "내 담당 업무", href: taskControlsHref(controls, { view: "mine" }) },
  ];
  const statusOptions = [
    { key: "all", label: "전체", href: taskControlsHref(controls, { status: "all" }) },
    { key: "open", label: "미완료", href: taskControlsHref(controls, { status: "open" }) },
    { key: "done", label: "완료", href: taskControlsHref(controls, { status: "done" }) },
  ];
  const scopeOptions = [
    { key: "all", label: "전체", href: taskControlsHref(controls, { scope: "all" }) },
    { key: "recurring", label: "정기 업무", href: taskControlsHref(controls, { scope: "recurring" }) },
    { key: "general", label: "일반 업무", href: taskControlsHref(controls, { scope: "general" }) },
  ];
  const sortOptions = [
    { key: "status", label: "기본순", href: taskControlsHref(controls, { sort: "status" }) },
    { key: "due", label: "마감순", href: taskControlsHref(controls, { sort: "due" }) },
    { key: "priority", label: "우선순위순", href: taskControlsHref(controls, { sort: "priority" }) },
    { key: "recent", label: "최신순", href: taskControlsHref(controls, { sort: "recent" }) },
    { key: "completed", label: "완료일순", href: taskControlsHref(controls, { sort: "completed" }) },
  ];

  return (
    <div style={taskControlsBox}>
      {isAdmin && <AssigneeFilterDropdown assignees={staff} selectedIds={controls.assigneeIds} />}
      {!isAdmin && !isAssistant && <SegmentedControl label="목록" activeKey={controls.view} options={viewOptions} />}
      <ChoiceDropdown label="상태" activeKey={controls.status} options={statusOptions} />
      <ChoiceDropdown label="업무 종류" activeKey={controls.scope} options={scopeOptions} />
      <ChoiceDropdown label="정렬" activeKey={controls.sort} options={sortOptions} />
    </div>
  );
}

function SegmentedControl({
  label,
  activeKey,
  options,
}: {
  label: string;
  activeKey: string;
  options: Array<{ key: string; label: string; href: string }>;
}) {
  return (
    <div style={controlGroup}>
      <span style={controlLabel}>{label}</span>
      <div style={controlButtons}>
        {options.map((option) => (
          <Link key={option.key} href={option.href} style={option.key === activeKey ? controlButtonActive : controlButton}>
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChoiceDropdown({
  label,
  activeKey,
  options,
}: {
  label: string;
  activeKey: string;
  options: Array<{ key: string; label: string; href: string }>;
}) {
  const activeLabel = options.find((option) => option.key === activeKey)?.label ?? options[0]?.label ?? "선택";
  return (
    <div style={controlGroup}>
      <span style={controlLabel}>{label}</span>
      <details style={sortDropdown}>
        <summary style={sortSummary}>{activeLabel}</summary>
        <div style={sortMenu}>
          {options.map((option) => (
            <DropdownOptionLink key={option.key} href={option.href} style={option.key === activeKey ? sortOptionActive : sortOption}>
              {option.label}
            </DropdownOptionLink>
          ))}
        </div>
      </details>
    </div>
  );
}

function taskControlsHref(controls: TaskControls, patch: Partial<TaskControls>) {
  const next = { ...controls, ...patch };
  const query = new URLSearchParams();
  if (next.view !== "all") query.set("view", next.view);
  if (next.status !== "all") query.set("status", next.status);
  if (next.scope !== "all") query.set("scope", next.scope);
  if (next.sort !== "status") query.set("sort", next.sort);
  if (next.assigneeIds.length > 0) query.set("assignee", next.assigneeIds.join(","));
  const suffix = query.toString();
  return suffix ? `/tasks?${suffix}` : "/tasks";
}

function RecurringTaskForm({
  staff,
  students,
  classGroups,
  row,
}: {
  staff: Array<Pick<User, "id" | "name" | "role">>;
  students: Array<Pick<Student, "id" | "name">>;
  classGroups: Array<Pick<ClassGroup, "id" | "name">>;
  row?: RecurringTaskRow;
}) {
  const assignees = staff.filter((member) => member.role === "ASSISTANT" || member.role === "TEACHER" || member.role === "MANAGER");
  const templateDescription = splitRecurringDescription(row?.description);
  return (
    <form action={row ? updateRecurringTaskAction : createRecurringTaskAction} style={recurringForm}>
      {row && <input type="hidden" name="recurringTaskId" value={row.id} />}
      <label style={label}>업무명<input name="title" required defaultValue={row?.title ?? ""} style={input} /></label>
      <label style={label}>업무 유형
        <select name="type" defaultValue={row?.type ?? "OTHER"} style={input}>
          <TaskTypeOptions />
        </select>
      </label>
      <label style={label}>담당자
        <select name="assigneeId" required defaultValue={row?.assigneeId ?? ""} style={input}>
          <option value="">담당자 선택</option>
          {assignees.map((member) => <option key={member.id} value={member.id}>{member.name} / {roleLabel(member.role)}</option>)}
        </select>
      </label>
      <label style={label}>관련 반
        <select name="classGroupId" defaultValue={row?.classGroupId ?? ""} style={input}>
          <option value="">없음</option>
          {classGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <label style={label}>관련 학생
        <select name="studentId" defaultValue={row?.studentId ?? ""} style={input}>
          <option value="">없음</option>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
        </select>
      </label>
      <RecurringTaskFormControls
        priority={row?.priority}
        recurrenceType={row?.recurrenceType}
        daysOfWeek={row?.daysOfWeek}
        dayOfMonth={row?.dayOfMonth}
      />
      <label style={label}>시작일<input name="startDate" type="date" required defaultValue={row?.startDate ?? ""} style={input} /></label>
      <label style={label}>종료일<input name="endDate" type="date" defaultValue={row?.endDate ?? ""} style={input} /></label>
      <label style={activeCheckBox}>
        <input name="isActive" type="checkbox" defaultChecked={row?.isActive ?? true} />
        <span>
          <b>활성화</b>
          <small>체크하면 반복 일정에 맞춰 업무가 생성됩니다.</small>
        </span>
      </label>
      <label style={{ ...label, gridColumn: "1 / -1" }}>설명
        <textarea name="description" rows={3} defaultValue={templateDescription.description} style={textarea} />
      </label>
      <ChecklistBuilder defaultValue={templateDescription.checklist} />
      <button style={smallPrimary}>{row ? "정기 업무 수정" : "정기 업무 저장"}</button>
    </form>
  );
}

function TaskTypeOptions() {
  return (
    <>
      <option value="ATTENDANCE_CHECK">출결 확인</option>
      <option value="ASSIGNMENT_CHECK">과제 검사</option>
      <option value="SCORE_INPUT">성적 입력</option>
      <option value="WRONG_ANSWER">오답 정리</option>
      <option value="COUNSELING_PREP">상담 준비</option>
      <option value="PARENT_CONTACT">보호자 연락</option>
      <option value="MATERIAL_UPLOAD">자료 업로드</option>
      <option value="CLINIC_ASSIGN">클리닉 준비</option>
      <option value="OMR_GRADING">OMR 채점</option>
      <option value="STUDENT_CARE">학생 관리</option>
      <option value="OTHER">기타</option>
    </>
  );
}

function RecurringTaskTable({
  rows,
  staff,
  students,
  classGroups,
  canEdit,
  currentUser,
}: {
  rows: RecurringTaskRow[];
  staff: Array<Pick<User, "id" | "name" | "role">>;
  students: Array<Pick<Student, "id" | "name">>;
  classGroups: Array<Pick<ClassGroup, "id" | "name">>;
  canEdit: boolean;
  currentUser: Pick<User, "id" | "role">;
}) {
  if (rows.length === 0) return <Empty>정기 업무가 없습니다.</Empty>;
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <Th>업무명</Th>
            <Th>반복</Th>
            <Th>담당자</Th>
            <Th>관련 반/학생</Th>
            <Th>기간</Th>
            <Th>다음 생성일</Th>
            <Th>생성된 업무</Th>
            <Th>오늘 업무</Th>
            <Th>상태</Th>
            {canEdit && <Th>관리</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = (
              <>
                <Td>
                  <b>{row.title}</b>
                  <div style={subText}>{typeText(row.type)} / {priorityText(row.priority)}</div>
                  <RecurringChecklistPreview row={row} />
                </Td>
                <Td>{recurringScheduleText(row)}</Td>
                <Td>{row.assignee.name}</Td>
                <Td>{row.classGroup?.name ?? row.student?.name ?? "공통"}</Td>
                <Td>{row.startDate} ~ {row.endDate ?? "계속"}</Td>
                <Td>{row.isActive ? getNextRecurringDate(row) ?? "-" : "-"}</Td>
                <Td>{row._count.tasks}개</Td>
                <Td><RecurringTodayAction row={row} currentUser={currentUser} /></Td>
                <Td><span style={row.isActive ? successBadge : badge}>{row.isActive ? "활성" : "비활성"}</span></Td>
              </>
            );

            if (!canEdit) return <tr key={row.id}>{cells}</tr>;

            return (
              <RecurringTaskRowShell
                key={row.id}
                colSpan={10}
                cells={cells}
                action={
                  <form action={toggleRecurringTaskAction}>
                    <input type="hidden" name="recurringTaskId" value={row.id} />
                    <input type="hidden" name="isActive" value={row.isActive ? "false" : "true"} />
                    <button style={smallGhost}>{row.isActive ? "비활성화" : "활성화"}</button>
                  </form>
                }
                editForm={<RecurringTaskForm row={row} staff={staff} students={students} classGroups={classGroups} />}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecurringChecklistPreview({ row }: { row: RecurringTaskRow }) {
  const { checklist } = splitRecurringDescription(row.description);
  if (checklist.length === 0) return null;

  return (
    <div style={recurringChecklistPreview}>
      <InlineEditDisclosure label={`체크리스트 ${checklist.length}개`}>
        <ul style={recurringChecklistList}>
          {checklist.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </InlineEditDisclosure>
    </div>
  );
}

function RecurringTodayAction({ row, currentUser }: { row: RecurringTaskRow; currentUser: Pick<User, "id" | "role"> }) {
  const task = row.tasks[0];
  if (!task) return <span style={muted}>오늘 없음</span>;

  const assigned = task.assigneeId === currentUser.id || task.assignees.some((assignee) => assignee.assigneeId === currentUser.id);
  if (currentUser.role === "ASSISTANT" && !assigned) return <span style={muted}>담당자만</span>;

  if (task.status === "DONE") {
    return (
      <div style={doneAction}>
        <span style={doneInline}>{task.completedAt ? formatDateTime(task.completedAt) : "완료"}</span>
        <form action={updateTaskStatus} style={completeForm}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="status" value="TODO" />
          <input type="hidden" name="memo" value="정기 업무 완료 취소" />
          <button style={smallGhost}>취소</button>
        </form>
      </div>
    );
  }

  return (
    <form action={submitTaskAction} style={completeForm}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="from" value="/tasks?manage=recurring" />
      <input type="hidden" name="content" value="정기 업무 완료 처리" />
      <button style={smallPrimary}>완료</button>
    </form>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={th}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={td}>{children}</td>;
}

function TaskCard({
  task,
  currentUser,
  isAssistant,
  staff,
  students,
  classGroups,
}: {
  task: TaskRow;
  currentUser: Pick<User, "id" | "role">;
  isAssistant: boolean;
  staff: Array<Pick<User, "id" | "name" | "role">>;
  students: Array<Pick<Student, "id" | "name">>;
  classGroups: Array<Pick<ClassGroup, "id" | "name">>;
}) {
  const effective = effectiveStatus(task);
  const canWork = isAssistant ? isTaskAssignedTo(task, currentUser.id) : true;
  const lastRecord = task.submissions[0]?.content || task.comments[0]?.content || task.evidenceSummary;
  const checkedCount = task.checklistItems.filter((item) => item.isDone).length;
  const displayColor = taskDisplayColor(task, currentUser.id, isAssistant);
  const dday = getTaskDdayInfo(task.dueDate, task.status === "DONE");
  const isDone = task.status === "DONE";

  return (
    <article style={{ ...taskCard, ...(isDone ? completedTaskCard : {}), borderLeft: `6px solid ${displayColor}` }}>
      <div style={taskMain}>
        <div style={taskContent}>
          <div style={taskHeaderLine}>
            <div style={taskTopLine}>
              <span style={statusBadge(effective)}>{statusText(effective)}</span>
              <span style={priorityBadge(task.priority)}>{priorityText(task.priority)}</span>
              <span style={badge}>{typeText(task.type)}</span>
              {task.recurringTaskId && <span style={infoBadge}>정기</span>}
            </div>
            <div style={taskTopTools}>
              <TaskColorPopover taskId={task.id} currentColor={displayColor} action={updateTaskColorAction} />
              <span style={ddayBadge(dday.tone)}>{dday.label}</span>
            </div>
          </div>
          <Link href={`/tasks/${task.id}`} style={taskTitle}>
            {task.title}
          </Link>
          <p style={taskDesc}>{task.description || "업무 설명 없음"}</p>
          <div style={metaLine}>
            <span>담당 {assigneeNames(task)}</span>
            <span>{task.classGroup?.name ?? task.student?.name ?? "공통 업무"}</span>
            <span>{taskPeriodText(task)}</span>
            {task.scheduledDate && <span>예정일 {task.scheduledDate}</span>}
            {task.completedAt && <span>완료 {formatDateTime(task.completedAt)}</span>}
          </div>
          {lastRecord && <p style={taskNoteStyle}>{lastRecord}</p>}
        </div>
        <div style={taskSide}>
          <div style={taskSideMetaBar}>
            <span style={task.status === "DONE" ? successBadge : badge}>체크 {checkedCount}/{task.checklistItems.length}</span>
            {task.actualMinutes && <span style={badge}>{task.actualMinutes}분</span>}
            <span style={badge}>마감 {formatDueFull(task.dueDate)}</span>
          </div>
          <TaskCardEditShell
            leading={<TaskActions task={task} canWork={canWork} />}
            trailing={<Link href={`/tasks/${task.id}`} style={smallActionLink}>상세</Link>}
            editForm={
              <TaskInlineEditor
                task={task}
                canManage={currentUser.role !== "ASSISTANT"}
                staff={staff}
                students={students}
                classGroups={classGroups}
                currentColor={displayColor}
              />
            }
          />
        </div>
      </div>
    </article>
  );
}

function TaskActions({ task, canWork }: { task: TaskRow; canWork: boolean }) {
  if (!canWork) {
    return <span style={muted}>담당자만 완료</span>;
  }

  if (task.status === "DONE") {
    return (
      <div style={doneAction}>
        <span style={doneInline}>{task.completedAt ? formatDateTime(task.completedAt) : "완료됨"}</span>
        <form action={updateTaskStatus} style={completeForm}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="status" value="TODO" />
          <input type="hidden" name="memo" value="완료 취소" />
          <button style={smallGhost}>완료 취소</button>
        </form>
      </div>
    );
  }

  return (
    <form action={submitTaskAction} style={completeForm}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="from" value="/tasks" />
      <input type="hidden" name="content" value="완료 처리" />
      <button style={smallPrimary}>완료</button>
    </form>
  );
}

function TaskInlineEditor({
  task,
  canManage,
  staff,
  students,
  classGroups,
  currentColor,
}: {
  task: TaskRow;
  canManage: boolean;
  staff: Array<Pick<User, "id" | "name" | "role">>;
  students: Array<Pick<Student, "id" | "name">>;
  classGroups: Array<Pick<ClassGroup, "id" | "name">>;
  currentColor: string;
}) {
  const assignees = staff.filter((member) => member.role === "ASSISTANT" || member.role === "TEACHER" || member.role === "MANAGER");
  const selectedAssigneeIds = new Set(task.assignees.length > 0 ? task.assignees.map((assignment) => assignment.assigneeId) : [task.assigneeId]);

  return (
    <form action={updateTaskDetailsAction} style={taskEditBox}>
      <input type="hidden" name="taskId" value={task.id} />
      {canManage && (
        <>
          <label style={label}>업무명<input name="title" required defaultValue={task.title} style={input} /></label>
          <label style={label}>업무 유형
            <select name="type" defaultValue={task.type} style={input}>
              <TaskTypeOptions />
            </select>
          </label>
          <TaskPrioritySelector defaultValue={task.priority} />
          <TaskFormColorPicker defaultValue={currentColor} />
          <fieldset style={assigneeEditField}>
            <legend style={legend}>담당 조교/직원</legend>
            <div style={assigneeEditGrid}>
              {assignees.map((member) => (
                <label key={member.id} style={checkChip}>
                  <input name="assigneeIds" type="checkbox" value={member.id} defaultChecked={selectedAssigneeIds.has(member.id)} />
                  <span>{member.name}</span>
                  <small>{roleLabel(member.role)}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <label style={label}>관련 반
            <select name="classGroupId" defaultValue={task.classGroupId ?? ""} style={input}>
              <option value="">없음</option>
              {classGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label style={label}>관련 학생
            <select name="studentId" defaultValue={task.studentId ?? ""} style={input}>
              <option value="">없음</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <label style={label}>시작일<input name="startDate" type="date" defaultValue={dateInputValue(task.startDate)} style={input} /></label>
          <label style={label}>마감일<input name="dueDate" type="date" defaultValue={dateInputValue(task.dueDate)} style={input} /></label>
        </>
      )}
      {!canManage && <TaskFormColorPicker defaultValue={currentColor} />}
      <label style={wideLabel}>업무 설명
        <textarea name="description" rows={3} defaultValue={task.description ?? ""} style={textarea} />
      </label>
      <div style={wideField}>
        <ChecklistBuilder defaultValue={task.checklistItems.map((item) => item.title)} />
      </div>
      <button style={smallPrimary}>저장</button>
    </form>
  );
}

type HeaderStatTone = "default" | "warn" | "hold" | "danger";

function HeaderStats({ items }: { items: Array<{ label: string; value: string; tone?: HeaderStatTone }> }) {
  return (
    <span style={headerStats} aria-label="업무 요약 통계">
      {items.map((item) => (
        <span key={item.label} style={headerStat}>
          <span style={headerStatLabel}>{item.label}</span>
          <b style={{ ...headerStatValue, ...headerStatValueByTone(item.tone) }}>{item.value}</b>
        </span>
      ))}
    </span>
  );
}

function headerStatValueByTone(tone: HeaderStatTone = "default"): CSSProperties {
  if (tone === "warn") return { color: "var(--asc-warning-text)" };
  if (tone === "hold") return { color: "#6d28d9" };
  if (tone === "danger") return { color: "var(--asc-danger)" };
  return {};
}

function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section style={panel}>
      <div style={panelHead}>
        <h2 style={panelTitle}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={empty}>{children}</div>;
}

function CompactTaskCalendar({ tasks, currentUserId, isAssistant }: { tasks: TaskRow[]; currentUserId: string; isAssistant: boolean }) {
  const today = new Date();
  const days = compactMonthDays(today);
  const firstKey = toYmd(days[0]);
  const lastKey = toYmd(days[days.length - 1]);
  const eventsByDate = new Map<string, TaskRow[]>();

  for (const task of tasks) {
    const range = taskRange(task);
    for (let day = range.start; day.getTime() <= range.end.getTime(); day = addDays(day, 1)) {
      const key = toYmd(day);
      if (key < firstKey || key > lastKey) continue;
      const list = eventsByDate.get(key) ?? [];
      list.push(task);
      eventsByDate.set(key, list);
    }
  }

  return (
    <div style={compactCalendar}>
      <div style={compactCalendarHead}>
        <b>{new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(today)}</b>
        <span>{tasks.length}개 업무</span>
      </div>
      <div style={weekHeaderGrid}>
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div style={compactGrid}>
        {days.map((day) => {
          const key = toYmd(day);
          const list = eventsByDate.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === today.getMonth();
          const current = key === toYmd(today);
          return (
            <div key={key} style={{ ...compactDay, ...(!isCurrentMonth ? compactMutedDay : {}), ...(current ? compactToday : {}) }}>
              <div style={compactDayTop}>
                <b>{day.getDate()}</b>
                <span>{list.length ? `${list.length}` : ""}</span>
              </div>
              <div style={compactEvents}>
                {list.slice(0, 3).map((task) => (
                  <Link
                    key={`${key}-${task.id}`}
                    href={`/tasks/${task.id}`}
                    title={`${task.title} / ${assigneeNames(task)}`}
                    style={{
                      ...compactEvent,
                      background: taskDisplayColor(task, currentUserId, isAssistant),
                    }}
                  >
                    {task.title}
                  </Link>
                ))}
                {list.length > 3 && <span style={compactMore}>+{list.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function effectiveStatus(task: Pick<Task, "status" | "dueDate">) {
  if (task.status !== "DONE" && task.dueDate && task.dueDate.getTime() < Date.now()) return "OVERDUE";
  return task.status;
}

type DdayTone = "gray" | "warning" | "info" | "danger" | "success";

function getTaskDdayInfo(dueDate: Date | null, isCompleted: boolean): { label: string; tone: DdayTone } {
  if (isCompleted) return { label: "완료됨", tone: "success" };
  if (!dueDate || Number.isNaN(dueDate.getTime())) return { label: "마감 미설정", tone: "gray" };

  const today = stripTime(new Date());
  const due = stripTime(dueDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return { label: "D-day", tone: "warning" };
  if (diffDays > 0) return { label: `D-${diffDays}`, tone: diffDays <= 3 ? "warning" : "info" };
  return { label: `지연 ${Math.abs(diffDays)}일`, tone: "danger" };
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    TODO: "해야 함",
    IN_PROGRESS: "진행 중",
    DONE: "완료",
    HOLD: "보류",
    OVERDUE: "지연",
    SUBMITTED: "기록 확인",
    REVIEW: "기록 확인",
    REJECTED: "재처리 필요",
  };
  return labels[status] ?? status;
}

function typeText(type: string) {
  const labels: Record<string, string> = {
    STUDENT_CARE: "학생 관리",
    ATTENDANCE_CHECK: "출결 확인",
    ASSIGNMENT_CHECK: "과제 검사",
    SCORE_INPUT: "성적 입력",
    WRONG_ANSWER: "오답 정리",
    COUNSELING_PREP: "상담 준비",
    PARENT_CONTACT: "보호자 연락",
    MATERIAL_UPLOAD: "자료 업로드",
    CLINIC_ASSIGN: "클리닉 준비",
    OMR_GRADING: "OMR 채점",
    OTHER: "기타",
  };
  return labels[type] ?? type;
}

function priorityText(priority: string) {
  if (priority === "URGENT") return "긴급";
  if (priority === "HIGH") return "높음";
  if (priority === "LOW") return "낮음";
  return "보통";
}

function recurringScheduleText(row: Pick<RecurringTaskRow, "recurrenceType" | "daysOfWeek" | "dayOfMonth">) {
  if (row.recurrenceType === "DAILY") return "매일";
  if (row.recurrenceType === "MONTHLY") return `매월 ${monthlyDaysText(row.daysOfWeek, row.dayOfMonth)}일`;
  const days = daysOfWeekText(row.daysOfWeek);
  return days === "-" ? "요일마다" : `요일마다 / ${days}`;
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "관리자";
  if (role === "MANAGER") return "실장";
  if (role === "TEACHER") return "강사";
  if (role === "ASSISTANT") return "조교";
  return role;
}

function priorityBadge(priority: string): CSSProperties {
  if (priority === "URGENT") return dangerBadge;
  if (priority === "HIGH") return warnBadge;
  if (priority === "LOW") return badge;
  return infoBadge;
}

function statusBadge(status: string): CSSProperties {
  if (status === "DONE") return successBadge;
  if (status === "HOLD") return holdBadge;
  if (status === "OVERDUE" || status === "REJECTED") return dangerBadge;
  if (status === "IN_PROGRESS") return infoBadge;
  return badge;
}

function ddayBadge(tone: DdayTone): CSSProperties {
  if (tone === "success") return successBadge;
  if (tone === "danger") return dangerBadge;
  if (tone === "warning") return warnBadge;
  if (tone === "info") return infoBadge;
  return badge;
}

function statusColor(status: string) {
  if (status === "DONE") return "#16a34a";
  if (status === "IN_PROGRESS") return "#0b50d0";
  if (status === "HOLD") return "#d97706";
  if (status === "OVERDUE" || status === "REJECTED") return "#dc2626";
  return "#64748b";
}

function taskPeriodText(task: Pick<Task, "startDate" | "dueDate">) {
  if (task.startDate && task.dueDate) return `기간 ${formatDue(task.startDate)} ~ ${formatDue(task.dueDate)}`;
  if (task.startDate) return `시작 ${formatDue(task.startDate)}`;
  if (task.dueDate) return `기한 ${formatDue(task.dueDate)}`;
  return "날짜 미설정";
}

function formatDue(date: Date | null) {
  if (!date) return "미설정";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

function dateInputValue(date: Date | null) {
  return date ? toYmd(date) : "";
}

function formatDueFull(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "미설정";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function compactMonthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function taskRange(task: Pick<Task, "startDate" | "dueDate" | "createdAt">) {
  const start = stripTime(task.startDate ?? task.dueDate ?? task.createdAt);
  const end = stripTime(task.dueDate ?? task.startDate ?? task.createdAt);
  return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isToday(date: Date | null) {
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isDueSoon(date: Date | null) {
  if (!date) return false;
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff <= 1000 * 60 * 60 * 24;
}

const page: CSSProperties = { padding: 12, color: "var(--asc-text)", background: "var(--asc-bg-subtle)", minHeight: "100vh" };
const container: CSSProperties = { width: "100%", maxWidth: "none", margin: 0, display: "grid", gap: 10 };
const header: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 };
const titleWithStats: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 };
const headerStats: CSSProperties = { display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 0, paddingLeft: 12, borderLeft: "1px solid var(--asc-border)" };
const headerStat: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 4, padding: "0 10px", borderRight: "1px solid var(--asc-border)", lineHeight: 1.1 };
const headerStatLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 850, whiteSpace: "nowrap" };
const headerStatValue: CSSProperties = { color: "var(--asc-text)", fontSize: 14, fontWeight: 950, whiteSpace: "nowrap" };
const recurringManager: CSSProperties = { display: "grid", gap: 10 };
const workSplit: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)", gap: 10, alignItems: "start", position: "relative", overflow: "visible" };
const stickyCalendarPanel: CSSProperties = { position: "sticky", top: 14, alignSelf: "start", minWidth: 0, height: "fit-content", zIndex: 3 };
const stickyCalendarInner: CSSProperties = { maxHeight: "calc(100vh - 28px)", overflowY: "auto", overscrollBehavior: "contain" };
const panel: CSSProperties = { background: "var(--asc-surface)", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: 10 };
const panelHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 };
const panelTitle: CSSProperties = { margin: 0, fontSize: 16, fontWeight: 950 };
const softText: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 900 };
const taskControlsBox: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  alignItems: "flex-end",
  marginBottom: 10,
  padding: 7,
  border: "1px solid var(--asc-border)",
  borderRadius: 8,
  background: "var(--asc-surface)",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};
const controlGroup: CSSProperties = { display: "grid", gap: 3, minWidth: 136 };
const controlLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 10, fontWeight: 950, lineHeight: 1, paddingLeft: 2 };
const controlButtons: CSSProperties = { display: "inline-flex", flexWrap: "wrap", gap: 4, minWidth: 0 };
const controlButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 34,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--asc-border)",
  borderRadius: 7,
  background: "var(--asc-bg)",
  color: "var(--asc-text-subtle)",
  padding: "0 10px",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};
const controlButtonActive: CSSProperties = { ...controlButton, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
const sortDropdown: CSSProperties = { position: "relative", minWidth: 136, width: "100%" };
const sortSummary: CSSProperties = {
  ...controlButton,
  height: 34,
  justifyContent: "space-between",
  cursor: "pointer",
  listStyle: "none",
  width: "100%",
  borderColor: "var(--asc-border-strong)",
  background: "var(--asc-bg)",
  color: "var(--asc-text)",
  boxShadow: "inset 0 -1px 0 rgba(15, 23, 42, 0.03)",
};
const sortMenu: CSSProperties = {
  position: "absolute",
  zIndex: 20,
  top: 38,
  left: 0,
  minWidth: "100%",
  display: "grid",
  gap: 2,
  padding: 5,
  border: "1px solid var(--asc-border)",
  borderRadius: 8,
  background: "var(--asc-surface)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.16)",
};
const sortOption: CSSProperties = { display: "block", borderRadius: 6, padding: "8px 9px", color: "var(--asc-text-subtle)", textDecoration: "none", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" };
const sortOptionActive: CSSProperties = { ...sortOption, background: "#eff6ff", color: "#1d4ed8" };
const taskList: CSSProperties = { display: "grid", gap: 6 };
const taskCard: CSSProperties = { border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)", background: "var(--asc-bg)", padding: "8px 10px", display: "grid", gap: 6 };
const completedTaskCard: CSSProperties = { background: "#f7fdf9" };
const taskMain: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, alignItems: "start" };
const taskContent: CSSProperties = { minWidth: 0 };
const taskHeaderLine: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 };
const taskTopLine: CSSProperties = { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 };
const taskTopTools: CSSProperties = { display: "inline-flex", gap: 5, alignItems: "center", justifyContent: "flex-end" };
const taskTitle: CSSProperties = { color: "var(--asc-text)", textDecoration: "none", fontSize: 15, fontWeight: 950 };
const taskDesc: CSSProperties = { margin: "3px 0 4px", color: "var(--asc-text-subtle)", maxWidth: 760, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13 };
const taskNoteStyle: CSSProperties = { margin: "3px 0 0", color: "var(--asc-text-muted)", fontSize: 12, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const metaLine: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 900 };
const taskSide: CSSProperties = { display: "grid", gap: 8, justifyItems: "stretch" };
const taskSideMetaBar: CSSProperties = { display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" };
const smallLink: CSSProperties = { color: "var(--asc-primary-hover)", textDecoration: "none", fontWeight: 950, fontSize: 12 };
const smallActionLink: CSSProperties = { display: "inline-flex", alignItems: "center", height: 28, border: "1px solid var(--asc-border-strong)", borderRadius: "var(--asc-radius-md)", background: "var(--asc-bg)", color: "var(--asc-primary-hover)", padding: "0 10px", textDecoration: "none", fontSize: 12, fontWeight: 950 };
const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontWeight: 900, fontSize: 13 };
const wideLabel: CSSProperties = { ...label, gridColumn: "1 / -1" };
const wideField: CSSProperties = { gridColumn: "1 / -1" };
const legend: CSSProperties = { padding: "0 6px", fontSize: 13, fontWeight: 900, color: "var(--asc-text)" };
const errorText: CSSProperties = { background: "var(--asc-danger-soft)", color: "var(--asc-danger)", padding: 10, borderRadius: "var(--asc-radius-lg)", fontWeight: 900 };
const recurringForm: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
const taskEditBox: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, width: "100%" };
const assigneeEditField: CSSProperties = { gridColumn: "1 / -1", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-md)", padding: 10, background: "var(--asc-surface)" };
const assigneeEditGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 8 };
const checkChip: CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-md)", padding: "8px 9px", background: "var(--asc-bg)", fontSize: 13 };
const tableWrap: CSSProperties = { overflow: "auto", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)" };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { textAlign: "left", padding: "8px 9px", background: "var(--asc-bg-subtle)", borderBottom: "1px solid var(--asc-border)", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 9px", borderBottom: "1px solid var(--asc-border)", verticalAlign: "top", whiteSpace: "nowrap" };
const subText: CSSProperties = { marginTop: 3, color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 800 };
const recurringChecklistPreview: CSSProperties = { marginTop: 6 };
const recurringChecklistList: CSSProperties = { margin: "6px 0 0", paddingLeft: 18, color: "var(--asc-text-subtle)", fontSize: 12, lineHeight: 1.6 };
const activeCheckBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "center",
  gap: 9,
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-lg)",
  background: "var(--asc-bg-subtle)",
  padding: "9px 10px",
  fontSize: 13,
};
const textarea: CSSProperties = { width: "100%", border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: 8, resize: "vertical", background: "var(--asc-bg)", color: "var(--asc-text)" };
const input: CSSProperties = { width: "100%", height: 32, border: "1px solid var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: "0 8px", background: "var(--asc-bg)", color: "var(--asc-text)" };
const smallPrimary: CSSProperties = { height: 28, border: "1px solid var(--asc-primary)", borderRadius: "var(--asc-radius-md)", background: "var(--asc-primary)", color: "#fff", padding: "0 9px", fontSize: 12, fontWeight: 950 };
const smallGhost: CSSProperties = { ...smallPrimary, background: "var(--asc-bg)", color: "var(--asc-text)", border: "1px solid var(--asc-border-strong)" };
const completeForm: CSSProperties = { display: "inline-flex" };
const doneAction: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" };
const doneInline: CSSProperties = { color: "var(--asc-success)", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" };
const badge: CSSProperties = { display: "inline-flex", alignItems: "center", height: 22, borderRadius: 999, background: "var(--asc-bg-subtle)", color: "var(--asc-text-subtle)", padding: "0 7px", fontSize: 11, fontWeight: 950, whiteSpace: "nowrap" };
const infoBadge: CSSProperties = { ...badge, background: "var(--asc-info-soft)", color: "var(--asc-info)" };
const warnBadge: CSSProperties = { ...badge, background: "var(--asc-warning-soft)", color: "var(--asc-warning-text)" };
const holdBadge: CSSProperties = { ...badge, background: "#ede9fe", color: "#6d28d9" };
const dangerBadge: CSSProperties = { ...badge, background: "var(--asc-danger-soft)", color: "var(--asc-danger)" };
const successBadge: CSSProperties = { ...badge, background: "var(--asc-success-soft)", color: "var(--asc-success)" };
const muted: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 13, fontWeight: 850 };
const empty: CSSProperties = { border: "1px dashed var(--asc-border)", borderRadius: "var(--asc-radius-lg)", padding: 12, textAlign: "center", color: "var(--asc-text-muted)", fontWeight: 900 };
const compactCalendar: CSSProperties = { display: "grid", gap: 8 };
const compactCalendarHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 };
const weekHeaderGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, color: "#64748b", fontSize: 11, fontWeight: 950, textAlign: "center" };
const compactGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 };
const compactDay: CSSProperties = { minHeight: 68, border: "1px solid #e5e7eb", borderRadius: 7, padding: 4, display: "grid", alignContent: "start", gap: 3, background: "#fff" };
const compactMutedDay: CSSProperties = { background: "#f8fafc", color: "#94a3b8" };
const compactToday: CSSProperties = { border: "1px solid #0b50d0", boxShadow: "inset 0 0 0 1px #0b50d0" };
const compactDayTop: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 };
const compactEvents: CSSProperties = { display: "grid", gap: 3, minWidth: 0 };
const compactEvent: CSSProperties = { display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 5, padding: "3px 4px", color: "#fff", fontSize: 10, fontWeight: 900, textDecoration: "none" };
const compactMore: CSSProperties = { color: "#64748b", fontSize: 10, fontWeight: 950 };
