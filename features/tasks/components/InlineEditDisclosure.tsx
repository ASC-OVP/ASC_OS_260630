"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label?: string;
};

export default function InlineEditDisclosure({ children, label = "수정" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={wrap}>
      <button type="button" style={editButton} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {label}
      </button>
      {open && children}
    </div>
  );
}

const wrap: CSSProperties = {
  display: "grid",
  gap: 8,
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
