"use client";

import type { CSSProperties, ReactNode } from "react";
import { CALENDAR_CONTENT_FILTERS } from "@/features/calendar/constants";
import { CALENDAR_EVENT_CATEGORY_ITEMS, type CalendarEventCategoryTone } from "@/features/calendar/lib/calendarEvents";
import type { CalendarContentFilter, CalendarDisplayMode, CalendarFilterOption, CalendarFilterValue, CalendarViewMode } from "@/features/calendar/types";

type Props = {
  filters: CalendarFilterValue;
  viewMode: CalendarViewMode;
  displayMode: CalendarDisplayMode;
  staffOptions: CalendarFilterOption[];
  canViewStaffCalendars: boolean;
  onFilterChange: (filters: CalendarFilterValue) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onDisplayModeChange: (mode: CalendarDisplayMode) => void;
};

export default function CalendarToolbar({
  filters,
  viewMode,
  displayMode,
  staffOptions,
  canViewStaffCalendars,
  onFilterChange,
  onViewModeChange,
  onDisplayModeChange,
}: Props) {
  function toggleFilter(contentType: CalendarContentFilter) {
    onFilterChange({
      ...filters,
      contentTypes: filters.contentTypes.includes(contentType)
        ? filters.contentTypes.filter((item) => item !== contentType)
        : [...filters.contentTypes, contentType],
    });
  }

  return (
    <section style={shell}>
      <div style={filterRow}>
        <div style={contentButtons} aria-label="표시 항목 선택">
          {CALENDAR_CONTENT_FILTERS.map((filter) => {
            const active = filters.contentTypes.includes(filter.id);
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => toggleFilter(filter.id)}
                style={{ ...filterButton, ...(active ? filterButtonActive : {}) }}
                title={filter.description}
                aria-pressed={active}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {canViewStaffCalendars && (
          <label style={staffSelectLabel}>
            <span>직원 화면</span>
            <select value={filters.staffId} onChange={(event) => onFilterChange({ ...filters, staffId: event.target.value })} style={staffSelect}>
              <option value="all">전체 직원</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div style={viewRow}>
        <div style={legend} aria-label="일정 색상 범례">
          {CALENDAR_EVENT_CATEGORY_ITEMS.map((item) => (
            <span key={item.label} style={legendItem}>
              <span style={{ ...legendDot, ...legendDotTone(item.tone) }} />
              {item.label}
            </span>
          ))}
        </div>
        <div style={viewTabs} aria-label="기간 단위 선택">
          <ViewButton active={viewMode === "month"} onClick={() => onViewModeChange("month")}>월</ViewButton>
          <ViewButton active={viewMode === "week"} onClick={() => onViewModeChange("week")}>주</ViewButton>
          <ViewButton active={viewMode === "day"} onClick={() => onViewModeChange("day")}>일</ViewButton>
        </div>
        <div style={layoutTabs} aria-label="표시 방식 선택">
          <ViewButton active={displayMode === "calendar"} onClick={() => onDisplayModeChange("calendar")}>달력</ViewButton>
          <ViewButton active={displayMode === "list"} onClick={() => onDisplayModeChange("list")}>목록</ViewButton>
        </div>
      </div>
    </section>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ ...viewButton, ...(active ? viewButtonActive : {}) }} aria-pressed={active}>
      {children}
    </button>
  );
}

function legendDotTone(tone: CalendarEventCategoryTone): CSSProperties {
  if (tone === "red") return { background: "#ef4444" };
  if (tone === "orange") return { background: "#f97316" };
  if (tone === "green") return { background: "#22c55e" };
  if (tone === "purple") return { background: "#8b5cf6" };
  if (tone === "amber") return { background: "#f59e0b" };
  if (tone === "teal") return { background: "#14b8a6" };
  return { background: "#2563eb" };
}

const shell: CSSProperties = {
  border: "1px solid #dfe3ea",
  borderRadius: 8,
  background: "#fff",
  padding: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};
const filterRow: CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const contentButtons: CSSProperties = { display: "inline-flex", gap: 4, padding: 2, border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff" };
const filterButton: CSSProperties = { border: 0, borderRadius: 5, background: "transparent", color: "#64748b", padding: "6px 9px", fontSize: 12, fontWeight: 850, cursor: "pointer" };
const filterButtonActive: CSSProperties = { background: "#eef2f7", color: "#111827" };
const staffSelectLabel: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 12, fontWeight: 950 };
const staffSelect: CSSProperties = { height: 34, minWidth: 150, border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", color: "#111827", padding: "0 8px", fontSize: 12, fontWeight: 850 };
const viewRow: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
const viewTabs: CSSProperties = { display: "inline-flex", gap: 3, border: "1px solid #d1d5db", borderRadius: 7, padding: 2, background: "#f8fafc" };
const layoutTabs: CSSProperties = { ...viewTabs };
const viewButton: CSSProperties = { border: 0, borderRadius: 5, background: "transparent", padding: "6px 10px", fontSize: 12, fontWeight: 950, cursor: "pointer", color: "#475569" };
const viewButtonActive: CSSProperties = { background: "#111827", color: "#fff" };
const legend: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 11, fontWeight: 850 };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" };
const legendDot: CSSProperties = { width: 7, height: 7, borderRadius: 999, display: "inline-block" };
