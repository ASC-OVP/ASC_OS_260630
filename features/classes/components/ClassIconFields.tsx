"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { sheetFillPalette } from "@/lib/colorPalettes";

type Props = {
  defaultText?: string | null;
  defaultColor?: string | null;
  compact?: boolean;
};

const defaultIconText = "강의";
const defaultIconColor = "#1558d6";
const classIconPalette = [{ label: "ASC 파랑", value: defaultIconColor }, ...sheetFillPalette];

export function classIconText(value?: string | null) {
  const text = (value ?? "").trim().slice(0, 3);
  return text || defaultIconText;
}

export function classIconColor(value?: string | null) {
  const color = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : defaultIconColor;
}

export function readableTextColor(color: string) {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

export default function ClassIconFields({ defaultText, defaultColor, compact = false }: Props) {
  const [iconText, setIconText] = useState(classIconText(defaultText));
  const [iconColor, setIconColor] = useState(classIconColor(defaultColor));
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  return (
    <div style={compact ? compactWrap : iconEditor}>
      <input
        name="iconText"
        value={iconText}
        onChange={(event) => setIconText(event.target.value.slice(0, 3))}
        maxLength={3}
        style={{ ...(compact ? compactTile : lectureTile), background: iconColor, color: readableTextColor(iconColor) }}
        aria-label="아이콘 글자"
        autoComplete="off"
      />
      <div style={colorPickerWrap}>
        <button
          type="button"
          onClick={() => setColorPickerOpen((current) => !current)}
          style={colorTrigger}
          aria-haspopup="menu"
          aria-expanded={colorPickerOpen}
          aria-label="아이콘 색상 선택"
          title="아이콘 색상"
        >
          <span style={{ ...colorTriggerDot, background: iconColor }} />
        </button>
        {colorPickerOpen && (
          <div style={palettePanel} role="menu" aria-label="아이콘 색상">
            <div style={paletteTitle}>아이콘 색상</div>
            <div style={swatchGrid}>
              {classIconPalette.map((color) => {
                const active = iconColor.toLowerCase() === color.value.toLowerCase();
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      setIconColor(color.value);
                      setColorPickerOpen(false);
                    }}
                    style={swatchButton(color.value, active)}
                    title={color.label}
                    aria-label={`아이콘 색상 ${color.label}`}
                  />
                );
              })}
            </div>
            <label style={customColorLabel}>
              직접 선택
              <input
                type="color"
                value={iconColor}
                onChange={(event) => setIconColor(event.target.value)}
                style={customColorInput}
                aria-label="아이콘 색상 직접 선택"
              />
            </label>
          </div>
        )}
      </div>
      <input type="hidden" name="iconColor" value={iconColor} />
    </div>
  );
}

function swatchButton(color: string, active: boolean): CSSProperties {
  return {
    width: 18,
    height: 18,
    border: active ? "2px solid #111827" : "1px solid #d1d5db",
    borderRadius: 5,
    background: color,
    boxShadow: color.toLowerCase() === "#ffffff" ? "inset 0 0 0 1px #e5e7eb" : undefined,
    cursor: "pointer",
  };
}

const iconEditor: CSSProperties = { position: "relative", display: "grid", gridTemplateColumns: "58px 24px", alignItems: "end", gap: 6 };
const compactWrap: CSSProperties = { position: "relative", display: "grid", gridTemplateColumns: "50px 24px", alignItems: "end", gap: 6 };
const lectureTile: CSSProperties = { width: 58, height: 58, display: "grid", placeItems: "center", border: 0, borderRadius: 10, textAlign: "center", fontSize: 21, fontWeight: 950, padding: "0 4px", outlineOffset: 2 };
const compactTile: CSSProperties = { ...lectureTile, width: 50, height: 50, borderRadius: 9, fontSize: 18 };
const colorPickerWrap: CSSProperties = { position: "relative", display: "grid", justifyItems: "center", gap: 4 };
const colorTrigger: CSSProperties = { width: 24, height: 24, display: "grid", placeItems: "center", border: "1px solid var(--asc-border)", borderRadius: 7, background: "var(--asc-surface)", padding: 0, cursor: "pointer" };
const colorTriggerDot: CSSProperties = { width: 14, height: 14, borderRadius: 4, border: "1px solid rgba(15, 23, 42, .18)" };
const palettePanel: CSSProperties = { position: "absolute", left: -8, top: 30, zIndex: 4, width: 218, padding: 9, border: "1px solid var(--asc-border)", borderRadius: 10, background: "var(--asc-surface)", boxShadow: "0 18px 38px rgba(15, 23, 42, 0.2)" };
const paletteTitle: CSSProperties = { marginBottom: 7, color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 900 };
const swatchGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(8, 18px)", gap: 6 };
const customColorLabel: CSSProperties = { marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "var(--asc-text-muted)", fontSize: 12, fontWeight: 900 };
const customColorInput: CSSProperties = { width: 42, height: 24, border: "1px solid var(--asc-border)", borderRadius: 6, padding: 1, background: "var(--asc-surface)" };
