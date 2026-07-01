"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { sheetFillPalette } from "@/lib/colorPalettes";

type Props = {
  defaultValue?: string;
};

const panelWidth = 236;
const panelHeight = 112;
const viewportGap = 8;

export default function TaskFormColorPicker({ defaultValue = "#3d85c6" }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(defaultValue);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const normalizedSelected = selectedColor.toLowerCase();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;

    if (left < viewportGap) left = viewportGap;
    if (left + panelWidth > window.innerWidth - viewportGap) left = window.innerWidth - panelWidth - viewportGap;
    if (top + panelHeight > window.innerHeight - viewportGap) top = rect.top - panelHeight - 6;
    if (top < viewportGap) top = viewportGap;

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || panelRef.current?.contains(target))) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleViewportChange = () => updatePosition();

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePosition]);

  return (
    <div style={fieldWrap} className="asc-field">
      <label style={labelStyle}>업무 색상</label>
      <input type="hidden" name="color" value={selectedColor} />
      <button
        ref={triggerRef}
        type="button"
        style={triggerStyle}
        aria-label="업무 색상 선택"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span style={currentColorDot(selectedColor)} />
      </button>
      {open &&
        createPortal(
          <div ref={panelRef} style={{ ...panelStyle, top: position.top, left: position.left }}>
            {sheetFillPalette.map((color) => {
              const active = normalizedSelected === color.value.toLowerCase();
              return (
                <button
                  key={color.value}
                  type="button"
                  style={swatchStyle(color.value, active)}
                  title={color.label}
                  aria-label={`업무 색상 ${color.label}`}
                  onClick={() => {
                    setSelectedColor(color.value);
                    setOpen(false);
                  }}
                >
                  {active ? "✓" : ""}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

const fieldWrap: CSSProperties = {
  display: "grid",
  gap: 6,
  alignContent: "start",
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "var(--asc-text)",
};

const triggerStyle: CSSProperties = {
  width: 40,
  height: 34,
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--asc-border)",
  borderRadius: "var(--asc-radius-md)",
  background: "var(--asc-surface)",
  cursor: "pointer",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  zIndex: 80,
  width: panelWidth,
  display: "grid",
  gridTemplateColumns: "repeat(8, 22px)",
  gap: 5,
  padding: 9,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.22)",
};

function currentColorDot(color: string): CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid #94a3b8",
    background: color,
  };
}

function swatchStyle(color: string, active: boolean): CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: active ? "2px solid #111827" : "1px solid #cbd5e1",
    background: color,
    boxShadow: active ? "0 0 0 2px #bfdbfe" : "none",
    color: active ? "#111827" : "transparent",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: "18px",
    padding: 0,
    cursor: "pointer",
  };
}
