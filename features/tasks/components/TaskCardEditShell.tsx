"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  leading: ReactNode;
  trailing: ReactNode;
  editForm: ReactNode;
};

export default function TaskCardEditShell({ leading, trailing, editForm }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={wrap}>
      <div style={actionBar}>
        {leading}
        <button type="button" style={editButton} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          수정
        </button>
        {trailing}
      </div>
      {open && <div style={editPanel}>{editForm}</div>}
    </div>
  );
}

const wrap: CSSProperties = {
  display: "grid",
  gap: 8,
};

const actionBar: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  justifyContent: "flex-end",
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

const editPanel: CSSProperties = {
  width: "100%",
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-lg)",
  background: "var(--asc-bg-subtle)",
  padding: 10,
};
