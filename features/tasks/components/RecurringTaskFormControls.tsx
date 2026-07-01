"use client";

import { useState, type CSSProperties } from "react";
import { weekdayOptions } from "@/lib/recurringTasks";
import TaskPrioritySelector from "./TaskPrioritySelector";

type RecurrenceType = "DAILY" | "WEEKLY" | "MONTHLY";

type Props = {
  recurrenceType?: string;
  daysOfWeek?: string | null;
  dayOfMonth?: number | null;
  priority?: string;
};

const recurrenceOptions: Array<{ value: RecurrenceType; label: string }> = [
  { value: "DAILY", label: "매일" },
  { value: "WEEKLY", label: "요일마다" },
  { value: "MONTHLY", label: "매월 날짜" },
];

function normalizedRecurrence(value?: string): RecurrenceType {
  return value === "DAILY" || value === "MONTHLY" ? value : "WEEKLY";
}

export default function RecurringTaskFormControls({
  recurrenceType,
  daysOfWeek,
  dayOfMonth,
  priority,
}: Props) {
  const [selectedRecurrence, setSelectedRecurrence] = useState<RecurrenceType>(normalizedRecurrence(recurrenceType));
  const [selectedDays, setSelectedDays] = useState(() => String(daysOfWeek ?? "").split(",").filter(Boolean));
  const selectedDaySet = new Set(selectedDays);
  const monthlyDaysValue = selectedRecurrence === "MONTHLY" ? daysOfWeek || (dayOfMonth ? String(dayOfMonth) : "") : "";

  function toggleDay(value: string) {
    setSelectedDays((current) => (current.includes(value) ? current.filter((day) => day !== value) : [...current, value]));
  }

  return (
    <>
      <TaskPrioritySelector defaultValue={priority} />

      <section style={{ ...controlGroup, gridColumn: "1 / -1" }}>
        <span style={controlTitle}>반복 방식</span>
        <input type="hidden" name="recurrenceType" value={selectedRecurrence} />
        <div style={recurrenceGrid}>
          {recurrenceOptions.map((option) => {
            const active = selectedRecurrence === option.value;
            return (
              <button
                key={option.value}
                type="button"
                style={active ? activeRecurrenceButton : recurrenceButton}
                aria-pressed={active}
                onClick={() => setSelectedRecurrence(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {selectedRecurrence === "WEEKLY" && (
          <div style={subControl}>
            <span style={subTitle}>요일</span>
            <div style={dayGrid}>
              {weekdayOptions.map((day) => (
                <label key={day.value} style={selectedDaySet.has(day.value) ? activeDayPill : dayPill}>
                  <input
                    type="checkbox"
                    name="daysOfWeek"
                    value={day.value}
                    checked={selectedDaySet.has(day.value)}
                    onChange={() => toggleDay(day.value)}
                    style={visuallyHidden}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {selectedRecurrence === "MONTHLY" && (
          <label style={monthControl}>
            <span style={subTitle}>날짜</span>
            <input name="monthlyDays" type="text" defaultValue={monthlyDaysValue} placeholder="예: 2,3,7-12" style={monthInput} />
          </label>
        )}
      </section>
    </>
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

const recurrenceGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
  maxWidth: 520,
};

const recurrenceButton: CSSProperties = {
  height: 34,
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-md)",
  background: "var(--asc-bg)",
  color: "var(--asc-text-subtle)",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
};

const activeRecurrenceButton: CSSProperties = {
  ...recurrenceButton,
  border: "1px solid var(--asc-primary)",
  background: "var(--asc-primary-soft)",
  color: "var(--asc-primary-hover)",
  boxShadow: "inset 0 0 0 1px var(--asc-primary)",
};

const subControl: CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 2,
};

const subTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "var(--asc-text-muted)",
};

const dayGrid: CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const dayPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 36,
  height: 30,
  border: "1px solid var(--asc-border)",
  borderRadius: 999,
  background: "var(--asc-bg)",
  color: "var(--asc-text)",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
};

const activeDayPill: CSSProperties = {
  ...dayPill,
  border: "1px solid var(--asc-primary)",
  background: "var(--asc-primary-soft)",
  color: "var(--asc-primary-hover)",
  boxShadow: "inset 0 0 0 1px var(--asc-primary)",
};

const visuallyHidden: CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
};

const monthControl: CSSProperties = {
  display: "inline-grid",
  gridTemplateColumns: "auto minmax(180px, 260px)",
  alignItems: "center",
  gap: 6,
  marginTop: 2,
  width: "min(100%, 340px)",
};

const monthInput: CSSProperties = {
  width: "100%",
  height: 32,
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-md)",
  padding: "0 8px",
  background: "var(--asc-bg)",
  color: "var(--asc-text)",
};
