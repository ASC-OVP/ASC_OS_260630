"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import ClassIconFields from "@/features/classes/components/ClassIconFields";

type StaffOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  teachers: StaffOption[];
  assistants: StaffOption[];
  currentUserId: string;
  currentUserRole: string;
};

export default function ClassCreateModal({ teachers, assistants, currentUserId, currentUserRole }: Props) {
  const [open, setOpen] = useState(false);
  const isTeacher = currentUserRole === "TEACHER";
  const currentTeacherName = teachers.find((teacher) => teacher.id === currentUserId)?.name ?? "현재 강사";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={triggerButton}>
        반 추가
      </button>

      {open && (
        <div style={overlay} role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-create-title"
            style={modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <form action="/api/classes/create" method="post" style={form}>
              <div style={modalHeader}>
                <h2 id="class-create-title" style={title}>강의 추가</h2>
                <button type="button" onClick={() => setOpen(false)} style={closeButton} aria-label="닫기">
                  ×
                </button>
              </div>

              <div style={identityRow}>
                <ClassIconFields />
                <label style={nameField}>
                  <span style={label}>이름</span>
                  <input name="name" required autoFocus style={input} />
                </label>
              </div>

              <div style={sectionRow}>
                <span style={rowLabel}>일정</span>
                <div style={dateRange}>
                  <input name="startDate" type="date" style={softInput} aria-label="운영 시작일" />
                  <span style={inlineText}>부터</span>
                  <input name="endDate" type="date" style={softInput} aria-label="운영 종료일" />
                  <span style={inlineText}>까지</span>
                </div>
              </div>

              <div style={sectionRow}>
                <span style={rowLabel}>시간</span>
                <div style={timeGrid}>
                  <label style={inlineField}>
                    <span style={smallLabel}>매주</span>
                    <input name="daysOfWeek" placeholder="화목" style={softInput} />
                  </label>
                  <input name="startTime" type="time" style={softInput} aria-label="시작 시간" />
                  <span style={inlineText}>부터</span>
                  <input name="endTime" type="time" style={softInput} aria-label="종료 시간" />
                </div>
              </div>

              <div style={sectionRow}>
                <span style={rowLabel}>담당</span>
                <div style={staffGrid}>
                  {isTeacher ? (
                    <>
                      <input type="hidden" name="teacherId" value={currentUserId} />
                      <input value={currentTeacherName} readOnly style={input} aria-label="담당 강사" />
                    </>
                  ) : (
                    <select name="teacherId" defaultValue="" style={input} aria-label="담당 강사">
                      <option value="">미지정</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                      ))}
                    </select>
                  )}
                  <input type="hidden" name="assistantIds" value="" />
                  <div style={assistantList} aria-label="담당 조교">
                    {assistants.length > 0 ? (
                      assistants.map((assistant) => (
                        <label key={assistant.id} style={assistantChip}>
                          <input type="checkbox" name="assistantIds" value={assistant.id} />
                          <span>{assistant.name}</span>
                        </label>
                      ))
                    ) : (
                      <span style={emptyStaff}>등록된 조교 없음</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={detailGrid}>
                <label style={field}>
                  <span style={label}>과목</span>
                  <input name="subject" placeholder="과학" style={input} />
                </label>
                <label style={field}>
                  <span style={label}>학년</span>
                  <input name="grade" placeholder="고1" style={input} />
                </label>
                <label style={field}>
                  <span style={label}>강의실</span>
                  <input name="room" placeholder="강의실" style={input} />
                </label>
                <label style={field}>
                  <span style={label}>상태</span>
                  <select name="status" defaultValue="ACTIVE" style={input}>
                    <option value="ACTIVE">운영중</option>
                    <option value="UPCOMING">운영 예정</option>
                    <option value="PAUSED">휴강</option>
                    <option value="ENDED">종료</option>
                  </select>
                </label>
              </div>

              <label style={field}>
                <span style={label}>메모</span>
                <textarea name="description" rows={3} style={{ ...input, ...textarea }} />
              </label>

              <div style={actions}>
                <button type="button" onClick={() => setOpen(false)} style={cancelButton}>취소</button>
                <button type="submit" style={submitButton}>확인</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

const triggerButton: CSSProperties = {
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--asc-primary)",
  borderRadius: "var(--asc-radius-md)",
  background: "var(--asc-primary)",
  color: "#fff",
  padding: "0 10px",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "grid",
  placeItems: "center",
  padding: 12,
  background: "rgba(15, 23, 42, 0.48)",
};

const modal: CSSProperties = {
  width: "min(860px, 100%)",
  maxHeight: "calc(100vh - 24px)",
  overflow: "auto",
  border: "1px solid var(--asc-border)",
  borderRadius: 18,
  background: "var(--asc-surface)",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.26)",
};

const form: CSSProperties = { display: "grid", gap: 14, padding: 24 };
const modalHeader: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const title: CSSProperties = { margin: 0, color: "var(--asc-text)", fontSize: 28, fontWeight: 950, lineHeight: 1.05 };
const closeButton: CSSProperties = { border: 0, background: "transparent", color: "var(--asc-text-muted)", fontSize: 24, lineHeight: 1, padding: 2 };
const identityRow: CSSProperties = { display: "grid", gridTemplateColumns: "82px minmax(0, 1fr)", gap: 18, alignItems: "end" };
const nameField: CSSProperties = { display: "grid", gap: 5 };
const field: CSSProperties = { display: "grid", gap: 5, minWidth: 0 };
const label: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 13, fontWeight: 900 };
const input: CSSProperties = { width: "100%", minHeight: 38, border: "1px solid var(--asc-border)", borderRadius: 9, background: "var(--asc-surface)", color: "var(--asc-text)", padding: "7px 10px", fontSize: 14, fontWeight: 800 };
const softInput: CSSProperties = { ...input, width: "auto", minWidth: 140, background: "var(--asc-bg-subtle)", borderColor: "transparent" };
const sectionRow: CSSProperties = { display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: 18, alignItems: "center", borderTop: "1px solid var(--asc-border)", paddingTop: 13 };
const rowLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 17, fontWeight: 900 };
const dateRange: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
const timeGrid: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
const inlineText: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 15, fontWeight: 850 };
const inlineField: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8 };
const smallLabel: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 14, fontWeight: 900 };
const staffGrid: CSSProperties = { display: "grid", gap: 8 };
const assistantList: CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const assistantChip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--asc-border)", borderRadius: 999, background: "var(--asc-bg-subtle)", padding: "5px 9px", fontSize: 12, fontWeight: 850 };
const emptyStaff: CSSProperties = { color: "var(--asc-text-muted)", fontSize: 13, fontWeight: 850 };
const detailGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 };
const textarea: CSSProperties = { minHeight: 62, resize: "vertical" };
const actions: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 0 };
const cancelButton: CSSProperties = { minHeight: 38, border: 0, borderRadius: 10, background: "var(--asc-bg-subtle)", color: "var(--asc-text-muted)", padding: "0 18px", fontSize: 15, fontWeight: 950 };
const submitButton: CSSProperties = { minHeight: 38, border: 0, borderRadius: 10, background: "#0b2f55", color: "#fff", padding: "0 20px", fontSize: 15, fontWeight: 950 };
