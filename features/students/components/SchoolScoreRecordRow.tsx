"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { deleteSchoolScoreRecord } from "@/features/students/actions/studentActions";

type Props = {
  record: {
    id: string;
    studentId: string;
    term: string;
    examType: string;
    score: number | null;
    grade: string | null;
    memo: string | null;
  };
};

export default function SchoolScoreRecordRow({ record }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ ...scoreRow, ...(hovered ? scoreRowHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span>{record.term}</span>
      <b>{record.examType}</b>
      <span style={scorePill}>{record.score === null ? "-" : `${record.score}점`}</span>
      <span style={softBadge}>{record.grade ?? "-"}</span>
      {record.memo && <span style={softBadge}>{record.memo}</span>}
      <form action={deleteSchoolScoreRecord} style={{ ...deleteForm, opacity: hovered ? 1 : 0, pointerEvents: hovered ? "auto" : "none" }}>
        <input type="hidden" name="recordId" value={record.id} />
        <input type="hidden" name="studentId" value={record.studentId} />
        <button type="submit" style={deleteButton} aria-label="학교 성적 삭제" title="학교 성적 삭제">
          ×
        </button>
      </form>
    </div>
  );
}

const softBadge: CSSProperties = { display: "inline-flex", alignItems: "center", height: 24, padding: "0 9px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" };
const scorePill: CSSProperties = { ...softBadge, background: "#fff", border: "1px solid #d1d5db", color: "#111827" };
const scoreRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 34, padding: "4px 6px 4px 0", borderRadius: 8, fontSize: 14 };
const scoreRowHover: CSSProperties = { background: "#f8fafc" };
const deleteForm: CSSProperties = { display: "inline-grid", placeItems: "center", transition: "opacity 120ms ease" };
const deleteButton: CSSProperties = { width: 22, height: 22, display: "grid", placeItems: "center", border: 0, borderRadius: 999, background: "transparent", color: "#dc2626", fontSize: 18, fontWeight: 950, lineHeight: 1, cursor: "pointer" };
