"use client";

import { useState, type CSSProperties } from "react";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type Props = {
  defaultValue?: string;
};

const priorityOptions: Array<{ value: Priority; label: string; style: CSSProperties }> = [
  { value: "LOW", label: "낮음", style: { background: "#dcfce7", borderColor: "#86efac", color: "#166534" } },
  { value: "NORMAL", label: "보통", style: { background: "#e0f2fe", borderColor: "#7dd3fc", color: "#075985" } },
  { value: "HIGH", label: "높음", style: { background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" } },
  { value: "URGENT", label: "긴급", style: { background: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" } },
];

function normalizedPriority(value?: string): Priority {
  return value === "LOW" || value === "HIGH" || value === "URGENT" ? value : "NORMAL";
}

export default function TaskPrioritySelector({ defaultValue }: Props) {
  const [selectedPriority, setSelectedPriority] = useState<Priority>(normalizedPriority(defaultValue));

  return (
    <section style={controlGroup} className="asc-field">
      <span style={controlTitle}>우선순위</span>
      <input type="hidden" name="priority" value={selectedPriority} />
      <div style={segmentedGrid}>
        {priorityOptions.map((option) => {
          const active = selectedPriority === option.value;
          return (
            <button
              key={option.value}
              type="button"
              style={{ ...segmentButton, ...option.style, ...(active ? activeSegment : inactiveSegment) }}
              aria-pressed={active}
              onClick={() => setSelectedPriority(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const controlGroup: CSSProperties = {
  display: "grid",
  gap: 6,
  alignContent: "start",
};

const controlTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "var(--asc-text)",
};

const segmentedGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 4,
};

const segmentButton: CSSProperties = {
  minWidth: 0,
  height: 32,
  border: "1px solid",
  borderRadius: 8,
  padding: "0 7px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
};

const activeSegment: CSSProperties = {
  boxShadow: "inset 0 0 0 2px rgba(15, 23, 42, 0.16)",
};

const inactiveSegment: CSSProperties = {
  opacity: 0.72,
};
