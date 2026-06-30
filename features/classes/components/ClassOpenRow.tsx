"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { deleteClassGroupAction } from "@/features/classes/actions/classActions";
import { classIconColor, classIconText, readableTextColor } from "@/features/classes/components/ClassIconFields";
import ClassRemoveButton from "@/features/classes/components/ClassRemoveButton";

type Props = {
  href: string;
  classGroupId: string;
  name: string;
  meta: string;
  iconText?: string | null;
  iconColor?: string | null;
  statusLabel: string;
  statusTone: string;
  teacherName: string;
  assistantName: string;
  studentCount: number;
  schedule: string;
  latestLabel: string;
  latestValue: string;
  averageScore: string;
  attendanceRate: string;
  assignmentRate: string;
  canManage: boolean;
};

export default function ClassOpenRow({
  href,
  classGroupId,
  name,
  meta,
  iconText,
  iconColor,
  statusLabel,
  statusTone,
  teacherName,
  assistantName,
  studentCount,
  schedule,
  latestLabel,
  latestValue,
  averageScore,
  attendanceRate,
  assignmentRate,
  canManage,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(false);
  const open = () => router.push(href);
  const select = (event: MouseEvent<HTMLTableRowElement>) => {
    setSelected(true);
    event.currentTarget.focus();
  };
  const clearSelection = (event: FocusEvent<HTMLTableRowElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setSelected(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === " ") {
      event.preventDefault();
      setSelected(true);
      return;
    }
    if (event.key === "Enter") open();
  };

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={`${name} 상세 화면 열기`}
      title="더블클릭하면 반 상세 화면으로 이동합니다."
      onClick={select}
      onDoubleClick={open}
      onBlur={clearSelection}
      onKeyDown={handleKeyDown}
      style={{ ...row, ...(selected ? selectedRow : {}) }}
    >
      <td style={nameTd}>
        <div style={nameCellLayout}>
          <span
            style={{
              ...classIcon,
              background: classIconColor(iconColor),
              color: readableTextColor(classIconColor(iconColor)),
            }}
            aria-hidden="true"
          >
            {classIconText(iconText)}
          </span>
          <div style={nameCell}>
            <b>{name}</b>
            <span>{meta}</span>
          </div>
        </div>
      </td>
      <td style={td}><span style={{ ...statusBadge, color: statusTone, borderColor: `${statusTone}55` }}>{statusLabel}</span></td>
      <td style={td}>{teacherName}</td>
      <td style={td}>{assistantName}</td>
      <td style={numberTd}>{studentCount}명</td>
      <td style={td}>{schedule}</td>
      <td style={td}>
        <div style={lessonCell}>
          <span>{latestLabel}</span>
          <b>{latestValue}</b>
        </div>
      </td>
      <td style={numberTd}>{averageScore}</td>
      <td style={numberTd}>{attendanceRate}</td>
      <td style={numberTd}>{assignmentRate}</td>
      <td style={actionTd}>
        {canManage && selected && (
          <form
            action={deleteClassGroupAction}
            style={actionForm}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <input type="hidden" name="classGroupId" value={classGroupId} />
            <ClassRemoveButton className={name} />
          </form>
        )}
      </td>
    </tr>
  );
}

const row: CSSProperties = { cursor: "pointer", outlineOffset: -2 };
const selectedRow: CSSProperties = { background: "var(--asc-primary-softer)", boxShadow: "inset 3px 0 0 var(--asc-primary)" };
const td: CSSProperties = { borderBottom: "1px solid var(--asc-border)", padding: "11px 12px", verticalAlign: "middle", whiteSpace: "nowrap", fontSize: 13, fontWeight: 850, color: "var(--asc-text)" };
const nameTd: CSSProperties = { ...td, minWidth: 260 };
const numberTd: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const actionTd: CSSProperties = { ...td, width: 52, padding: "5px 8px", textAlign: "center" };
const nameCellLayout: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
const classIcon: CSSProperties = { width: 36, height: 36, display: "inline-grid", placeItems: "center", flex: "0 0 auto", borderRadius: 8, fontSize: 13, fontWeight: 950, lineHeight: 1, letterSpacing: 0 };
const nameCell: CSSProperties = { display: "grid", gap: 3, minWidth: 0 };
const statusBadge: CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 950, background: "#fff", whiteSpace: "nowrap" };
const lessonCell: CSSProperties = { display: "grid", gap: 2, minWidth: 220 };
const actionForm: CSSProperties = { margin: 0, display: "inline-grid", placeItems: "center" };
