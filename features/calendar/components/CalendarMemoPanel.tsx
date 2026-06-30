"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { saveCalendarEventMemoAction, saveCalendarPrivateMemoAction } from "@/features/calendar/actions/calendarMemoActions";
import { CALENDAR_EVENT_SOURCE_META, CALENDAR_SEVERITY_META, CALENDAR_STATUS_META } from "@/features/calendar/constants";
import { eventTone } from "@/features/calendar/lib/calendarEvents";
import type { CalendarEventMemoView, MaterializedCalendarEvent } from "@/features/calendar/types";

type Props = {
  selectedEvent: MaterializedCalendarEvent | null;
  selectedDate: string | null;
  dateMemo: string;
  eventMemo?: CalendarEventMemoView;
};

export default function CalendarMemoPanel({ selectedEvent, selectedDate, dateMemo, eventMemo }: Props) {
  if (selectedEvent) return <EventDetail event={selectedEvent} memo={eventMemo} />;
  if (selectedDate) return <DateDetail date={selectedDate} memo={dateMemo} />;
  return <EmptyDetail />;
}

function EventDetail({ event, memo }: { event: MaterializedCalendarEvent; memo?: CalendarEventMemoView }) {
  const sourceMeta = CALENDAR_EVENT_SOURCE_META[event.source];
  const statusMeta = CALENDAR_STATUS_META[event.status];
  const severityMeta = CALENDAR_SEVERITY_META[event.severity];

  return (
    <section style={detailCard}>
      <div style={detailHeader}>
        <span style={{ ...badge, ...sourceBadge(eventTone(event)) }}>{sourceMeta.labelKo}</span>
        <span style={badge}>{statusMeta.labelKo}</span>
        <span style={severityBadge(event.severity)}>{severityMeta.labelKo}</span>
      </div>
      <h2 style={detailTitle}>{event.title}</h2>
      {event.subtitle && <p style={subtitle}>{event.subtitle}</p>}

      <div style={section}>
        <h3 style={sectionTitle}>일정 정보</h3>
        <Info label="날짜" value={event.dateKey} />
        <Info label="시간" value={event.displayTime} />
        <Info label="담당" value={event.ownerLabel || (event.isUnassigned ? "담당자 미배정" : "-")} />
        {event.isRecurring && <Info label="반복" value={event.recurrenceLabelKo || "반복 일정"} />}
      </div>

      <div style={section}>
        <h3 style={sectionTitle}>관련 맥락</h3>
        {event.className && <Info label="반" value={event.className} />}
        {event.subject || event.grade ? <Info label="과목/학년" value={[event.subject, event.grade].filter(Boolean).join(" / ")} /> : null}
        {event.room && <Info label="강의실" value={event.room} />}
        {event.expectedStudentCount != null && <Info label="학생 수" value={`${event.expectedStudentCount}명`} />}
        {event.studentName && <Info label="학생" value={event.studentName} />}
        {event.metadata?.priorityLabel && <Info label="우선순위" value={String(event.metadata.priorityLabel)} />}
        {event.metadata?.workStatusLabel && <Info label="근무 상태" value={String(event.metadata.workStatusLabel)} />}
        {event.metadata?.scheduleText && <Info label="일정" value={String(event.metadata.scheduleText)} />}
        {!event.className && !event.studentName && !event.metadata?.priorityLabel && !event.metadata?.workStatusLabel && <p style={hint}>연결된 학생/반 정보가 아직 없습니다.</p>}
      </div>

      {event.description && <p style={description}>{event.description}</p>}

      <form action={saveCalendarEventMemoAction} style={memoForm}>
        <input type="hidden" name="eventKey" value={event.occurrenceKey} />
        <input type="hidden" name="eventDate" value={event.dateKey} />
        <input type="hidden" name="eventType" value={event.source} />
        <input type="hidden" name="title" value={event.title} />
        <label style={memoLabel}>
          일정별 메모
          <textarea key={memo?.updatedAt ?? event.occurrenceKey} name="content" rows={4} defaultValue={memo?.content ?? ""} style={memoTextarea} />
        </label>
        {memo?.writerName && <small style={memoMeta}>마지막 수정: {memo.writerName}</small>}
        <button style={primaryButton}>메모 저장</button>
      </form>

      <div style={detailActions}>
        {event.taskId && <Link href={`/tasks/${event.taskId}`} style={primaryLink}>업무 상세 보기</Link>}
        {event.classGroupId && <Link href={`/classes/${event.classGroupId}`} style={primaryLink}>반 상세 보기</Link>}
        {event.workShiftId && <Link href={`/work?assistantId=${event.assistantId ?? ""}&date=${event.dateKey}&shiftId=${event.workShiftId}`} style={primaryLink}>근무 상세 보기</Link>}
        {event.classGroupId && <Link href={`/students?classGroupId=${event.classGroupId}`} style={secondaryLink}>이 반 학생 보기</Link>}
        {event.studentId && <Link href={`/students/${event.studentId}`} style={secondaryLink}>학생 상세 보기</Link>}
      </div>

      <ManagementSection date={event.dateKey} event={event} />
    </section>
  );
}

function DateDetail({ date, memo }: { date: string; memo: string }) {
  return (
    <section style={detailCard}>
      <span style={badge}>{date}</span>
      <h2 style={detailTitle}>이 날짜에 추가</h2>
      <form action={saveCalendarPrivateMemoAction} style={memoForm}>
        <input type="hidden" name="date" value={date} />
        <label style={memoLabel}>
          개인 메모
          <textarea name="content" rows={5} defaultValue={memo} style={memoTextarea} />
        </label>
        <button style={primaryButton}>메모 저장</button>
      </form>
      <ManagementSection date={date} />
    </section>
  );
}

function EmptyDetail() {
  return (
    <section style={detailCard}>
      <span style={badge}>상세</span>
      <h2 style={detailTitle}>일정을 선택해 주세요</h2>
      <p style={description}>캘린더에서 수업, 업무 일정을 선택하면 상세 정보와 빠른 작업을 확인할 수 있습니다.</p>
      <ManagementSection />
    </section>
  );
}

function ManagementSection({ date, event }: { date?: string; event?: MaterializedCalendarEvent }) {
  const workHref = event?.workShiftId
    ? `/work?assistantId=${event.assistantId ?? ""}&date=${event.dateKey}&shiftId=${event.workShiftId}`
    : date
      ? `/work?date=${date}`
      : "/work";

  return (
    <div style={managementPanel}>
      <h3 style={sectionTitle}>운영일정 관리</h3>
      <div style={managementLinks}>
        <Link href={date ? `/tasks/new?date=${date}` : "/tasks/new"} style={manageLink}>업무 추가</Link>
        <Link href="/classes/new" style={manageLink}>반 수업 추가</Link>
        <Link href={workHref} style={manageLink}>출근 일정 관리</Link>
        <Link href="/tasks" style={manageLink}>업무 목록 관리</Link>
        <Link href="/classes" style={manageLink}>반 일정 관리</Link>
        {event?.taskId && <Link href={`/tasks/${event.taskId}`} style={manageLinkStrong}>선택 업무 수정/삭제</Link>}
        {event?.classGroupId && <Link href={`/classes/${event.classGroupId}`} style={manageLinkStrong}>선택 반 수정/삭제</Link>}
        {event?.workShiftId && <Link href={workHref} style={manageLinkStrong}>선택 출근 수정/삭제</Link>}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRow}>
      <b>{label}</b>
      <span>{value || "-"}</span>
    </div>
  );
}

function sourceBadge(tone: ReturnType<typeof eventTone>): CSSProperties {
  if (tone === "red") return { background: "#fee2e2", color: "#991b1b" };
  if (tone === "orange") return { background: "#ffedd5", color: "#9a3412" };
  if (tone === "green") return { background: "#dcfce7", color: "#166534" };
  if (tone === "purple") return { background: "#ede9fe", color: "#6d28d9" };
  if (tone === "cyan") return { background: "#cffafe", color: "#0e7490" };
  if (tone === "gray") return { background: "#e2e8f0", color: "#475569" };
  return { background: "#dbeafe", color: "#0b50d0" };
}

function severityBadge(severity: MaterializedCalendarEvent["severity"]): CSSProperties {
  if (severity === "critical") return { ...badge, background: "#fee2e2", color: "#991b1b" };
  if (severity === "warning") return { ...badge, background: "#fef3c7", color: "#92400e" };
  if (severity === "resolved") return { ...badge, background: "#dcfce7", color: "#166534" };
  if (severity === "inactive") return { ...badge, background: "#e2e8f0", color: "#475569" };
  return badge;
}

const detailCard: CSSProperties = { border: "1px solid #dfe3ea", borderRadius: 8, background: "#fff", padding: 12, display: "grid", gap: 10 };
const detailHeader: CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
const detailTitle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 950, lineHeight: 1.25 };
const subtitle: CSSProperties = { margin: 0, color: "#64748b", fontSize: 13, fontWeight: 850 };
const section: CSSProperties = { borderTop: "1px solid #eef2f7", paddingTop: 9, display: "grid", gap: 6 };
const sectionTitle: CSSProperties = { margin: 0, fontSize: 13, fontWeight: 950 };
const infoRow: CSSProperties = { display: "grid", gridTemplateColumns: "74px minmax(0, 1fr)", gap: 6, fontSize: 13, alignItems: "start" };
const hint: CSSProperties = { margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.4 };
const description: CSSProperties = { margin: 0, color: "#4b5563", fontSize: 13, lineHeight: 1.45, borderTop: "1px solid #eef2f7", paddingTop: 8 };
const detailActions: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const primaryLink: CSSProperties = { borderWidth: 1, borderStyle: "solid", borderColor: "#111827", background: "#111827", color: "#fff", borderRadius: 7, padding: "8px 10px", textDecoration: "none", fontSize: 12, fontWeight: 950 };
const secondaryLink: CSSProperties = { ...primaryLink, borderColor: "#d1d5db", background: "#fff", color: "#111827" };
const primaryButton: CSSProperties = { border: "1px solid #111827", background: "#111827", color: "#fff", borderRadius: 7, padding: "8px 10px", fontSize: 12, fontWeight: 950 };
const memoForm: CSSProperties = { display: "grid", gap: 6 };
const memoLabel: CSSProperties = { display: "grid", gap: 5, fontSize: 13, fontWeight: 950 };
const memoTextarea: CSSProperties = { width: "100%", border: "1px solid #d1d5db", borderRadius: 7, padding: 8, resize: "vertical", font: "inherit", color: "#111827" };
const memoMeta: CSSProperties = { color: "#6b7280", fontSize: 11, fontWeight: 850 };
const badge: CSSProperties = { display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#f1f5f9", color: "#475569", padding: "4px 8px", fontSize: 12, fontWeight: 950 };
const managementPanel: CSSProperties = { borderTop: "1px solid #eef2f7", paddingTop: 9, display: "grid", gap: 8 };
const managementLinks: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 };
const manageLink: CSSProperties = { border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", color: "#111827", padding: "8px 9px", textDecoration: "none", fontSize: 12, fontWeight: 900, textAlign: "center" };
const manageLinkStrong: CSSProperties = { ...manageLink, borderColor: "#111827", background: "#111827", color: "#fff" };
