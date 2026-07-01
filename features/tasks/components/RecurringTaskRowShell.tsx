"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  colSpan: number;
  cells: ReactNode;
  action: ReactNode;
  editForm: ReactNode;
};

export default function RecurringTaskRowShell({ colSpan, cells, action, editForm }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr>
        {cells}
        <td style={cell}>
          <div style={actions}>
            {action}
            <button type="button" style={editButton} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "접기" : "수정"}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={colSpan} style={panelCell}>
            <div style={panel}>{editForm}</div>
          </td>
        </tr>
      )}
    </>
  );
}

const cell: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--asc-border)",
  verticalAlign: "top",
};

const actions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 6,
  flexWrap: "wrap",
};

const editButton: CSSProperties = {
  height: 28,
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
};

const panelCell: CSSProperties = {
  padding: 0,
  borderBottom: "1px solid var(--asc-border)",
  background: "var(--asc-bg-subtle)",
};

const panel: CSSProperties = {
  padding: 12,
};
