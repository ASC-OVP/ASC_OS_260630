"use client";

import type { ClipboardEvent, CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createStudentFromSheet,
  deleteStudentsFromSheet,
  saveClassLessonConfig,
  updateStudentClassGroup,
  updateStudentLessonCells,
  updateStudentSheetCell,
  updateStudentSheetCustomCells,
  updateStudentSheetCustomColumns,
} from "@/features/students/actions/studentActions";
import { createClassTestAction, deactivateClassTestAction, updateClassTestAction } from "@/features/students/actions/classTestActions";
import type { SheetCustomColumn } from "@/lib/studentSheetCustomColumns";
import type { StudentSheetRow } from "@/features/students/components/StudentSheetMatrix";
import type {
  CellStyle,
  ClassTestExamOption,
  ColorPaletteItem,
  ColumnDragState,
  ContextMenuState,
  DirtyMetaValue,
  DraftStudentRow,
  DragMode,
  EditableGridColumn,
  EditableMetaColumnId,
  GridColumn,
  InsertedLesson,
  Lesson,
  LessonClassGroupOption,
  LessonField,
  LessonFieldId,
  LessonTimeOverride,
  MetaColumnId,
  SelectionMode,
  SelectionRange,
  SheetHistorySnapshot,
  SortDirection,
  StudentLessonSpreadsheetProps,
} from "@/features/students/lib/studentLessonSpreadsheetTypes";
import {
  addDays,
  applyLessonOverrides,
  buildLessonsForClass,
  formatDateInput,
  legacyLessonId,
  lessonId,
  mergeInsertedLessons,
  parseLocalDate,
} from "@/features/students/lib/studentLessonBuilder";
import { ToolbarIcon, ToolbarIconButton } from "@/features/students/components/student-sheet/StudentSheetToolbarIcon";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

export type { ClassTestExamOption, LessonClassGroupOption, StoredClassLesson } from "@/features/students/lib/studentLessonSpreadsheetTypes";

type Props = StudentLessonSpreadsheetProps;

function createLocalId(prefix: string) {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${new Date().getTime()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId}`;
}

function currentClientTime() {
  return new Date().getTime();
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (active) {
    return (
      <span aria-hidden="true" style={sortIconSingle}>
        <span style={direction === "asc" ? sortTriangleUp : sortTriangleDown} />
      </span>
    );
  }

  return (
    <span aria-hidden="true" style={sortIconStack}>
      <span style={sortTriangleUp} />
      <span style={sortTriangleDown} />
    </span>
  );
}


function isDraftStudentRow(row: StudentSheetRow): row is DraftStudentRow {
  return (row as Partial<DraftStudentRow>).isDraft === true;
}

const ALL_TESTS_OPTION_ID = "all-tests";

const lessonFields: LessonField[] = [
  { id: "attendance", label: "출결", width: 92 },
  { id: "assignment", label: "과제", width: 104 },
  { id: "test", label: "테스트", width: 108 },
];

const metaColumns: Array<Extract<GridColumn, { kind: "meta" }>> = [
  { id: "rowNumber", label: "번호", kind: "meta", width: 64 },
  { id: "name", label: "학생명", kind: "meta", width: 136 },
  { id: "phone", label: "학생 연락처", kind: "meta", width: 154 },
  { id: "parentPhone", label: "보호자 연락처", kind: "meta", width: 166 },
  { id: "schoolName", label: "학교", kind: "meta", width: 126 },
  { id: "grade", label: "학년", kind: "meta", width: 78 },
  { id: "classGroup", label: "반", kind: "meta", width: 150 },
  { id: "subject", label: "과목", kind: "meta", width: 84 },
  { id: "currentLevel", label: "레벨", kind: "meta", width: 84 },
  { id: "memo", label: "최근 메모", kind: "meta", width: 230 },
];

const historyLimit = 80;
const addedLessonLabel = "추가된 차시";
const sheetZoomStorageKey = "asc-students-sheet-zoom";
const sheetZoomLevels = [75, 90, 100, 110, 125, 150] as const;
const fillPalette: ColorPaletteItem[] = [
  { label: "검정", value: "#000000" },
  { label: "진회색", value: "#404040" },
  { label: "회색", value: "#737373" },
  { label: "연회색", value: "#a3a3a3" },
  { label: "밝은 회색", value: "#d4d4d4" },
  { label: "흰색", value: "#ffffff" },
  { label: "빨강", value: "#ff0000" },
  { label: "주황", value: "#ff9900" },
  { label: "노랑", value: "#ffff00" },
  { label: "초록", value: "#00ff00" },
  { label: "청록", value: "#00ffff" },
  { label: "파랑", value: "#0000ff" },
  { label: "남색", value: "#4f46e5" },
  { label: "보라", value: "#9900ff" },
  { label: "분홍", value: "#ff00ff" },
  { label: "연빨강", value: "#f4cccc" },
  { label: "연주황", value: "#fce5cd" },
  { label: "연노랑", value: "#fff2cc" },
  { label: "연초록", value: "#d9ead3" },
  { label: "연청록", value: "#d0e0e3" },
  { label: "연파랑", value: "#cfe2f3" },
  { label: "연남색", value: "#d9d2e9" },
  { label: "연보라", value: "#ead1dc" },
  { label: "중간 빨강", value: "#e06666" },
  { label: "중간 주황", value: "#f6b26b" },
  { label: "중간 노랑", value: "#ffd966" },
  { label: "중간 초록", value: "#93c47d" },
  { label: "중간 청록", value: "#76a5af" },
  { label: "중간 파랑", value: "#6fa8dc" },
  { label: "중간 남색", value: "#8e7cc3" },
  { label: "중간 보라", value: "#c27ba0" },
  { label: "진빨강", value: "#cc0000" },
  { label: "진주황", value: "#e69138" },
  { label: "진노랑", value: "#f1c232" },
  { label: "진초록", value: "#6aa84f" },
  { label: "진청록", value: "#45818e" },
  { label: "진파랑", value: "#3d85c6" },
  { label: "진남색", value: "#674ea7" },
  { label: "진보라", value: "#a64d79" },
  { label: "어두운 빨강", value: "#990000" },
  { label: "어두운 주황", value: "#b45f06" },
  { label: "어두운 노랑", value: "#bf9000" },
  { label: "어두운 초록", value: "#38761d" },
  { label: "어두운 청록", value: "#134f5c" },
  { label: "어두운 파랑", value: "#0b5394" },
  { label: "어두운 남색", value: "#351c75" },
  { label: "어두운 보라", value: "#741b47" },
];
export default function StudentLessonSpreadsheet({
  rows,
  customColumns,
  selectedClassGroupId,
  classGroups,
  classTests = [],
  selectedTestExamId = null,
}: Props) {
  const effectiveClassGroupId = useMemo(() => {
    if (selectedClassGroupId) return selectedClassGroupId;
    const rowClassIds = [...new Set(rows.map((row) => row.classGroupId).filter(Boolean))];
    return rowClassIds.length === 1 ? rowClassIds[0] : null;
  }, [rows, selectedClassGroupId]);
  const selectedClassGroup = useMemo(
    () => classGroups.find((classGroup) => classGroup.id === effectiveClassGroupId) ?? null,
    [classGroups, effectiveClassGroupId]
  );
  const scope = useMemo(() => safeScope(effectiveClassGroupId || "all"), [effectiveClassGroupId]);
  const [extraLessonCount, setExtraLessonCount] = useState(0);
  const [lessonLabels, setLessonLabels] = useState<Record<string, string>>({});
  const [lessonDateOverrides, setLessonDateOverrides] = useState<Record<string, string>>({});
  const [lessonTimeOverrides, setLessonTimeOverrides] = useState<Record<string, LessonTimeOverride>>({});
  const [lessonMemoOverrides, setLessonMemoOverrides] = useState<Record<string, string>>({});
  const [insertedLessons, setInsertedLessons] = useState<InsertedLesson[]>([]);
  const [deletedLessonIds, setDeletedLessonIds] = useState<string[]>([]);
  const [lessonConfigDirty, setLessonConfigDirty] = useState(false);
  const [localCustomColumns, setLocalCustomColumns] = useState<SheetCustomColumn[]>(customColumns);
  const [draftRows, setDraftRows] = useState<DraftStudentRow[]>([]);
  const [visibleLessonIds, setVisibleLessonIds] = useState<string[]>([]);
  const [lessonPanelOpen, setLessonPanelOpen] = useState(false);
  const [testPanelMode, setTestPanelMode] = useState<"create" | "manage" | null>(null);
  const [testMenuOpen, setTestMenuOpen] = useState(false);
  const [testMenuBranch, setTestMenuBranch] = useState<"view" | "selectTests" | "manage" | null>(null);
  const [testViewMode, setTestViewMode] = useState<"all" | "selected">(() =>
    selectedTestExamId && selectedTestExamId !== ALL_TESTS_OPTION_ID ? "selected" : "all"
  );
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>(() =>
    selectedTestExamId && selectedTestExamId !== ALL_TESTS_OPTION_ID ? [selectedTestExamId] : []
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rangeStartLessonId, setRangeStartLessonId] = useState("");
  const [rangeEndLessonId, setRangeEndLessonId] = useState("");
  const [lessonOnlyView, setLessonOnlyView] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  const [dirtyMetaValues, setDirtyMetaValues] = useState<Record<string, DirtyMetaValue>>({});
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [selectedCellKeys, setSelectedCellKeys] = useState<string[]>([]);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingMetaKey, setEditingMetaKey] = useState<string | null>(null);
  const [editingCustomColumnId, setEditingCustomColumnId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [metaDrafts, setMetaDrafts] = useState<Record<string, string>>({});
  const [classGroupDraftIds, setClassGroupDraftIds] = useState<Record<string, string>>({});
  const [customColumnDrafts, setCustomColumnDrafts] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => readStoredArray(columnOrderKey(scope)));
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>(() => readStoredArray(hiddenColumnsKey(scope)));
  const [columnDrag, setColumnDrag] = useState<ColumnDragState | null>(null);
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [replaceFindText, setReplaceFindText] = useState("");
  const [replaceWithText, setReplaceWithText] = useState("");
  const [replaceCaseSensitive, setReplaceCaseSensitive] = useState(false);
  const [fillPaletteOpen, setFillPaletteOpen] = useState(false);
  const [columnSearchId, setColumnSearchId] = useState<string>("name");
  const [columnSearch, setColumnSearch] = useState("");
  const [sortColumnId, setSortColumnId] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sheetZoom, setSheetZoom] = useState(() => clampSheetZoom(readStoredNumber(sheetZoomStorageKey) ?? 100));
  const [sheetZoomInput, setSheetZoomInput] = useState(() => String(clampSheetZoom(readStoredNumber(sheetZoomStorageKey) ?? 100)));
  const [formatDraft, setFormatDraft] = useState<CellStyle>(() => defaultSheetFormat());
  const [undoStack, setUndoStack] = useState<SheetHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<SheetHistorySnapshot[]>([]);
  const [statusText, setStatusText] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const sheetWrapRef = useRef<HTMLDivElement | null>(null);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const columnVisibilityRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const testMenuRef = useRef<HTMLDivElement | null>(null);
  const columnOrderScopeRef = useRef(scope);
  const rowDragAnchorRef = useRef<number | null>(null);
  const columnDragAnchorRef = useRef<number | null>(null);
  const suppressNextColumnClickRef = useRef(false);
  const autoHiddenTestIdRef = useRef<string | null>(null);
  const autoHiddenLessonIdsRef = useRef<string[]>([]);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const metaInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const activeRangeEditRef = useRef<{
    targetKey: string;
    lessonCells: Array<{ studentId: string; columnId: string }>;
    metaCells: Array<{ row: StudentSheetRow; columnId: EditableMetaColumnId }>;
    historyCaptured: boolean;
  } | null>(null);
  const suppressBlurSaveRef = useRef(false);
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const allTestsSelected = testViewMode === "all";
  const selectedTestIdSet = useMemo(() => new Set(selectedTestIds), [selectedTestIds]);
  const selectedClassTests = useMemo(() => {
    if (allTestsSelected) return classTests;
    return classTests.filter((test) => selectedTestIdSet.has(test.id));
  }, [allTestsSelected, classTests, selectedTestIdSet]);
  const selectedSingleTest = selectedClassTests.length === 1 ? selectedClassTests[0] : null;
  const testViewSummary = allTestsSelected ? "전체보기" : selectedClassTests.length > 0 ? `선택 ${selectedClassTests.length}` : "선택 없음";

  const baseLessons = useMemo(() => {
    return buildLessonsForClass(selectedClassGroup, extraLessonCount, customColumns);
  }, [customColumns, extraLessonCount, selectedClassGroup]);

  const lessons = useMemo(() => {
    const deleted = new Set(deletedLessonIds);
    return applyLessonOverrides(
      mergeInsertedLessons(baseLessons, insertedLessons).filter((lesson) => !deleted.has(lesson.id)),
      lessonDateOverrides,
      lessonTimeOverrides,
      lessonMemoOverrides
    );
  }, [baseLessons, deletedLessonIds, insertedLessons, lessonDateOverrides, lessonMemoOverrides, lessonTimeOverrides]);

  const activeVisibleLessonIds = useMemo(() => {
    const allowed = new Set(lessons.map((lesson) => lesson.id));
    const visible = visibleLessonIds.filter((lessonId) => allowed.has(lessonId));
    return visible.length > 0 ? visible : lessons.map((lesson) => lesson.id);
  }, [lessons, visibleLessonIds]);

  const visibleLessons = useMemo(() => {
    const visible = lessons.filter((lesson) => activeVisibleLessonIds.includes(lesson.id));
    return visible.length > 0 ? visible : lessons.slice(0, Math.min(5, lessons.length));
  }, [activeVisibleLessonIds, lessons]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const allowedTestIds = new Set(classTests.map((test) => test.id));
      if (selectedTestExamId && selectedTestExamId !== ALL_TESTS_OPTION_ID && allowedTestIds.has(selectedTestExamId)) {
        setTestViewMode("selected");
        setSelectedTestIds([selectedTestExamId]);
        return;
      }
      setSelectedTestIds((current) => current.filter((testId) => allowedTestIds.has(testId)));
      if (!selectedTestExamId || selectedTestExamId === ALL_TESTS_OPTION_ID) setTestViewMode("all");
    }, 0);
    return () => window.clearTimeout(handle);
  }, [classTests, selectedTestExamId]);

  useEffect(() => {
    let handle: number | null = null;
    const selectedSingleTests = selectedClassTests.filter((test) => test.type === "SINGLE");
    if (!allTestsSelected && selectedSingleTests.length > 0 && selectedSingleTests.length === selectedClassTests.length) {
      const linkedLessonIds = lessons
        .filter((lesson) => selectedSingleTests.some((test) => classTestMatchesLesson(test, lesson, lessonLabels)))
        .map((lesson) => lesson.id);
      if (linkedLessonIds.length === 0) return;
      autoHiddenTestIdRef.current = selectedSingleTests.map((test) => test.id).join("|");
      autoHiddenLessonIdsRef.current = linkedLessonIds;
      handle = window.setTimeout(() => {
        setVisibleLessonIds((current) => (sameStringList(current, linkedLessonIds) ? current : linkedLessonIds));
      }, 0);
      return () => {
        if (handle !== null) window.clearTimeout(handle);
      };
    }

    if (!autoHiddenTestIdRef.current) return;
    const autoHiddenLessonIds = autoHiddenLessonIdsRef.current;
    autoHiddenTestIdRef.current = null;
    autoHiddenLessonIdsRef.current = [];
    handle = window.setTimeout(() => {
      setVisibleLessonIds((current) => (sameStringList(current, autoHiddenLessonIds) ? [] : current));
    }, 0);
    return () => {
      if (handle !== null) window.clearTimeout(handle);
    };
  }, [allTestsSelected, lessonLabels, lessons, selectedClassTests]);

  const rangeStartId = useMemo(
    () => (lessons.some((lesson) => lesson.id === rangeStartLessonId) ? rangeStartLessonId : lessons[0]?.id ?? ""),
    [lessons, rangeStartLessonId]
  );
  const rangeEndId = useMemo(
    () => (lessons.some((lesson) => lesson.id === rangeEndLessonId) ? rangeEndLessonId : lessons[lessons.length - 1]?.id ?? ""),
    [lessons, rangeEndLessonId]
  );
  const isAllLessonsVisible = activeVisibleLessonIds.length === lessons.length && lessons.every((lesson) => activeVisibleLessonIds.includes(lesson.id));

  const studentInfoColumns = useMemo<GridColumn[]>(() => {
    const visibleMetaColumns = lessonOnlyView ? metaColumns.filter((column) => column.id === "rowNumber" || column.id === "name") : metaColumns;
    const customGridColumns: Array<Extract<GridColumn, { kind: "custom" }>> = lessonOnlyView
      ? []
      : localCustomColumns
          .filter((column) => column.enabled)
          .map((column) => ({
            id: column.id,
            label: column.label,
            kind: "custom" as const,
            width: 128,
            customColumnId: column.id,
            afterColumnId: column.afterColumnId ?? null,
          }));
    return lessonOnlyView ? visibleMetaColumns : insertCustomColumns(visibleMetaColumns, customGridColumns);
  }, [lessonOnlyView, localCustomColumns]);

  const hideableColumns = useMemo(() => studentInfoColumns.filter(isHideableColumn), [studentInfoColumns]);
  const hiddenColumnSet = useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);
  const hiddenColumnCount = useMemo(
    () => hideableColumns.filter((column) => hiddenColumnSet.has(column.id)).length,
    [hideableColumns, hiddenColumnSet]
  );

  const gridColumns = useMemo<GridColumn[]>(() => {
    const visibleStudentInfoColumns = studentInfoColumns.filter((column) => !isHideableColumn(column) || !hiddenColumnSet.has(column.id));
    const orderedStudentInfoColumns = applyColumnOrder(visibleStudentInfoColumns, columnOrder);
    const lessonColumns = visibleLessons.flatMap((lesson) => {
      const groupLabel = lessonDisplayLabel(lesson, lessonLabels);
      const baseColumns = lessonFields
        .filter((field) => field.id !== "test")
        .map((field) => ({
          id: lessonColumnId(scope, lesson.index, field.id),
          label: field.label,
          kind: "lesson" as const,
          width: field.width,
          lessonId: lesson.id,
          lessonIndex: lesson.index,
          field: field.id,
          groupLabel,
          date: lesson.date,
          dateLabel: lesson.dateLabel,
          scheduleLabel: lesson.scheduleLabel,
        }));
      const testColumns = testsForLesson(lesson, selectedClassTests, lessonLabels).map((test) => {
        const targetExam = examForClassTestLesson(test, lesson);
        return {
          id: lessonColumnId(scope, lesson.index, "test", test.id),
          label: lessonTestColumnLabel(lesson, test),
          kind: "lesson" as const,
          width: Math.max(128, Math.min(210, 76 + test.name.length * 8)),
          lessonId: lesson.id,
          lessonIndex: lesson.index,
          field: "test" as const,
          groupLabel,
          date: lesson.date,
          dateLabel: lesson.dateLabel,
          scheduleLabel: lesson.scheduleLabel,
          classTestId: test.id,
          classTestName: test.name,
          classTestType: test.type,
          examId: targetExam?.id ?? null,
        };
      });
      return [...baseColumns, ...testColumns].filter((column) => !hiddenColumnSet.has(column.id));
    });

    return [
      ...orderedStudentInfoColumns,
      ...lessonColumns,
    ];
  }, [columnOrder, hiddenColumnSet, lessonLabels, scope, selectedClassTests, studentInfoColumns, visibleLessons]);

  const effectiveColumnSearchId = useMemo(() => {
    return gridColumns.some((column) => column.id === columnSearchId) ? columnSearchId : "name";
  }, [columnSearchId, gridColumns]);

  const lessonColumnMap = useMemo(() => {
    const map = new Map<string, Extract<GridColumn, { kind: "lesson" }>>();
    for (const column of gridColumns) {
      if (column.kind === "lesson") map.set(column.id, column);
    }
    return map;
  }, [gridColumns]);

  const lessonColumnsByLessonId = useMemo(() => {
    const map = new Map<string, Array<Extract<GridColumn, { kind: "lesson" }>>>();
    for (const column of gridColumns) {
      if (column.kind !== "lesson") continue;
      const current = map.get(column.lessonId) ?? [];
      current.push(column);
      map.set(column.lessonId, current);
    }
    return map;
  }, [gridColumns]);

  const renderedVisibleLessons = useMemo(
    () => visibleLessons.filter((lesson) => (lessonColumnsByLessonId.get(lesson.id)?.length ?? 0) > 0),
    [lessonColumnsByLessonId, visibleLessons]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalCustomColumns(customColumns);
  }, [customColumns]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      columnOrderScopeRef.current = scope;
      setExtraLessonCount(readStoredNumber(extraLessonCountKey(scope)) ?? 0);
      setLessonLabels({});
      setLessonDateOverrides({});
      setLessonTimeOverrides({});
      setLessonMemoOverrides({});
      setInsertedLessons([]);
      setDeletedLessonIds([]);
      setLessonConfigDirty(false);
      setVisibleLessonIds(readStoredArray(visibleLessonsKey(scope)));
      setLessonPanelOpen(readStoredBoolean(lessonPanelOpenKey(scope)) ?? false);
      setLessonOnlyView(readStoredBoolean(lessonOnlyViewKey(scope)) ?? false);
      setCellStyles(readStoredRecord<CellStyle>(cellStylesKey(scope)));
      setColumnOrder(readStoredArray(columnOrderKey(scope)));
      setHiddenColumnIds(readStoredArray(hiddenColumnsKey(scope)));
      setColumnDrag(null);
      setColumnVisibilityOpen(false);
      setSelectionMode(null);
      setSelectedRowIds([]);
      setSelectedColumnIds([]);
      setSelectedCellKeys([]);
      setDirtyValues({});
      setDirtyMetaValues({});
      setDraftRows([]);
      setCustomColumnDrafts({});
      setEditingCustomColumnId(null);
      setUndoStack([]);
      setRedoStack([]);
      activeRangeEditRef.current = null;
      setStatusText("");
    }, 0);
    return () => window.clearTimeout(handle);
  }, [scope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(extraLessonCountKey(scope), String(extraLessonCount));
  }, [extraLessonCount, scope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(visibleLessonsKey(scope), JSON.stringify(visibleLessonIds));
  }, [scope, visibleLessonIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (columnOrderScopeRef.current !== scope) return;
    window.localStorage.setItem(columnOrderKey(scope), JSON.stringify(columnOrder));
  }, [columnOrder, scope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (columnOrderScopeRef.current !== scope) return;
    window.localStorage.setItem(hiddenColumnsKey(scope), JSON.stringify(hiddenColumnIds));
  }, [hiddenColumnIds, scope]);

  useEffect(() => {
    if (!columnVisibilityOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Node && columnVisibilityRef.current?.contains(event.target)) return;
      setColumnVisibilityOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [columnVisibilityOpen]);

  useEffect(() => {
    if (!testMenuOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Node && testMenuRef.current?.contains(event.target)) return;
      setTestMenuOpen(false);
      setTestMenuBranch(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [testMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(lessonPanelOpenKey(scope), lessonPanelOpen ? "1" : "0");
  }, [lessonPanelOpen, scope]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(lessonOnlyViewKey(scope), lessonOnlyView ? "1" : "0");
  }, [lessonOnlyView, scope]);

  useEffect(() => {
    if (!fillPaletteOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!colorMenuRef.current?.contains(event.target as Node)) {
        setFillPaletteOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [fillPaletteOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnPointerDown = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Node && contextMenuRef.current?.contains(event.target)) return;
      setContextMenu(null);
    };
    const closeOnScroll = () => setContextMenu(null);
    window.addEventListener("mousedown", closeOnPointerDown);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      window.removeEventListener("mousedown", closeOnPointerDown);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(cellStylesKey(scope), JSON.stringify(cellStyles));
  }, [cellStyles, scope]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setValues((current) => {
        const next = { ...current };
        for (const row of rows) {
          for (const column of gridColumns) {
            if (column.kind !== "lesson") continue;
            const key = lessonCellKey(row.id, column.id);
            if (column.field !== "test" && key in next) continue;
            next[key] = initialLessonCellValue(row, column);
          }
        }
        return next;
      });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [gridColumns, rows]);

  useEffect(() => {
    window.localStorage.setItem(sheetZoomStorageKey, String(sheetZoom));
  }, [sheetZoom]);

  useEffect(() => {
    const stopDragging = () => {
      const wasColumnSelecting = columnDragAnchorRef.current !== null;
      setIsDragging(false);
      setDragMode(null);
      setColumnDrag(null);
      rowDragAnchorRef.current = null;
      columnDragAnchorRef.current = null;
      if (wasColumnSelecting) {
        window.setTimeout(() => {
          suppressNextColumnClickRef.current = false;
        }, 0);
      }
    };
    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  const readDisplayedCellValue = useCallback(
    (row: StudentSheetRow, columnId: string) => {
      if (isMetaColumnId(columnId)) {
        if (columnId === "rowNumber") return metaCellValue(row, columnId);
        const key = lessonCellKey(row.id, columnId);
        if (key in metaDrafts) return metaDrafts[key];
        if (columnId === "name") return nameDrafts[row.id] ?? row.name;
        return metaCellValue(row, columnId);
      }
      return cellValue(row, columnId, values);
    },
    [metaDrafts, nameDrafts, values]
  );

  const sortedBaseRows = useMemo(
    () => sortRows(rows, sortColumnId, sortDirection, (row, columnId) => readDisplayedCellValue(row, columnId)),
    [readDisplayedCellValue, rows, sortColumnId, sortDirection]
  );

  const orderedRows = useMemo(
    () => mergeDraftRows(sortedBaseRows, draftRows),
    [draftRows, sortedBaseRows]
  );

  const selectedRowIdSet = useMemo(() => {
    const visibleIds = new Set(orderedRows.map((row) => row.id));
    return new Set(selectedRowIds.filter((id) => visibleIds.has(id)));
  }, [orderedRows, selectedRowIds]);

  const selectedColumnIdSet = useMemo(() => {
    const visibleIds = new Set(gridColumns.map((column) => column.id));
    return new Set(selectedColumnIds.filter((id) => visibleIds.has(id)));
  }, [gridColumns, selectedColumnIds]);
  const selectedCellKeySet = useMemo(() => {
    const visibleRowIds = new Set(orderedRows.map((row) => row.id));
    const visibleColumnIds = new Set(gridColumns.map((column) => column.id));
    return new Set(
      selectedCellKeys.filter((key) => {
        const separator = key.indexOf(":");
        if (separator < 0) return false;
        const rowId = key.slice(0, separator);
        const columnId = key.slice(separator + 1);
        return visibleRowIds.has(rowId) && visibleColumnIds.has(columnId);
      })
    );
  }, [gridColumns, orderedRows, selectedCellKeys]);

  const selectionScope = useMemo(
    () => buildSelectionScope(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, orderedRows, gridColumns),
    [gridColumns, orderedRows, selectedCellKeySet, selectedColumnIdSet, selectedRowIdSet, selection, selectionMode]
  );
  const hasSelectionSearchScope = Boolean(
    selectionMode &&
      selectionScope.rowIds.size > 0 &&
      selectionScope.columnIds.size > 0 &&
      (selectionScope.rowIds.size > 1 || selectionScope.columnIds.size > 1)
  );
  const isGlobalSearchScope = !selectionMode;

  const displayRows = useMemo(
    () =>
      orderedRows.filter((row) => {
        const searchQuery = columnSearch.trim();
        if (searchQuery && hasSelectionSearchScope) {
          if (!selectionScope.rowIds.has(row.id)) return false;
          return [...selectionScope.columnIds].some((columnId) => containsText(readDisplayedCellValue(row, columnId), searchQuery));
        }

        if (searchQuery) {
          if (isGlobalSearchScope) {
            return gridColumns.some((column) => containsText(readDisplayedCellValue(row, column.id), searchQuery));
          }

          const targetValue = readDisplayedCellValue(row, effectiveColumnSearchId);
          if (!containsText(targetValue, searchQuery)) return false;
        }

        return true;
      }),
    [columnSearch, effectiveColumnSearchId, gridColumns, hasSelectionSearchScope, isGlobalSearchScope, orderedRows, readDisplayedCellValue, selectionScope]
  );

  const rangeMatchKeys = useMemo(() => {
    const searchQuery = columnSearch.trim();
    if (!searchQuery || !hasSelectionSearchScope) return new Set<string>();
    const matches = selectedSheetCellsForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns)
      .filter((cell) => containsText(readDisplayedCellValue(cell.row, cell.columnId), searchQuery))
      .map((cell) => lessonCellKey(cell.row.id, cell.columnId));
    return new Set(matches);
  }, [columnSearch, displayRows, gridColumns, hasSelectionSearchScope, readDisplayedCellValue, selectedCellKeySet, selectedColumnIdSet, selectedRowIdSet, selection, selectionMode]);

  const draftStudentIds = useMemo(() => new Set(draftRows.map((row) => row.id)), [draftRows]);
  const dirtyCount =
    Object.keys(dirtyValues).filter((key) => {
      const separator = key.indexOf(":");
      return !draftStudentIds.has(key.slice(0, separator));
    }).length + Object.values(dirtyMetaValues).filter((cell) => !draftStudentIds.has(cell.studentId)).length;
  const draftRowsWithContent = useMemo(
    () => draftRows.filter((row) => draftStudentHasContent(row, readDisplayedCellValue)),
    [draftRows, readDisplayedCellValue]
  );
  const draftRowsMissingName = useMemo(
    () => draftRowsWithContent.filter((row) => !readDisplayedCellValue(row, "name").trim()),
    [draftRowsWithContent, readDisplayedCellValue]
  );
  const draftRowsReadyToCreate = useMemo(
    () => draftRowsWithContent.filter((row) => readDisplayedCellValue(row, "name").trim()),
    [draftRowsWithContent, readDisplayedCellValue]
  );
  const hasPendingChanges = dirtyCount > 0 || lessonConfigDirty || draftRowsWithContent.length > 0;
  const changeSummary = useMemo(() => {
    const parts = [
      draftRowsWithContent.length > 0 ? `신규 학생 ${draftRowsWithContent.length}명` : "",
      dirtyCount > 0 ? `수정 ${dirtyCount}건` : "",
      lessonConfigDirty ? "차시 설정 변경" : "",
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "변경 없음";
  }, [dirtyCount, draftRowsWithContent.length, lessonConfigDirty]);
  const selectionLabel = formatActiveSelectionLabel(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns);
  const selectedColumn = gridColumns.find((column) => column.id === effectiveColumnSearchId);
  const selectedColumnLabel = selectedColumn ? columnLabel(selectedColumn) : "학생명";
  const searchTargetLabel = hasSelectionSearchScope ? "선택 범위" : isGlobalSearchScope ? "전체" : selectedColumnLabel;

  const displayedFormatDraft = useMemo(() => {
    const cells = selectedSheetCellsForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns);
    if (cells.length === 0) {
      return defaultSheetFormat();
    }

    const firstStyle = normalizedSheetFormat(cellStyles[lessonCellKey(cells[0].row.id, cells[0].columnId)]);
    const isSameStyle = cells.every((cell) => sameSheetFormat(firstStyle, normalizedSheetFormat(cellStyles[lessonCellKey(cell.row.id, cell.columnId)])));
    return isSameStyle ? firstStyle : defaultSheetFormat();
  }, [cellStyles, displayRows, gridColumns, selectedCellKeySet, selectedColumnIdSet, selectedRowIdSet, selection, selectionMode]);

  function createHistorySnapshot(): SheetHistorySnapshot {
    const snapshotNameDrafts: Record<string, string> = { ...nameDrafts };
    const snapshotMetaDrafts: Record<string, string> = { ...metaDrafts };
    const snapshotClassGroupDraftIds: Record<string, string> = { ...classGroupDraftIds };

    for (const row of displayRows) {
      snapshotNameDrafts[row.id] = displayName(row);
      snapshotClassGroupDraftIds[row.id] = classGroupDraftIds[row.id] ?? row.classGroupId ?? "";

      for (const column of gridColumns) {
        if (column.kind !== "meta" || column.id === "rowNumber") continue;
        snapshotMetaDrafts[lessonCellKey(row.id, column.id)] = editableMetaValue(row, column.id as EditableMetaColumnId);
      }
    }

    return {
      values: { ...values },
      dirtyValues: { ...dirtyValues },
      dirtyMetaValues: { ...dirtyMetaValues },
      cellStyles: Object.fromEntries(Object.entries(cellStyles).map(([key, style]) => [key, { ...style }])),
      lessonLabels: { ...lessonLabels },
      lessonDateOverrides: { ...lessonDateOverrides },
      lessonTimeOverrides: Object.fromEntries(Object.entries(lessonTimeOverrides).map(([key, value]) => [key, { ...value }])),
      lessonMemoOverrides: { ...lessonMemoOverrides },
      insertedLessons: insertedLessons.map((lesson) => ({ ...lesson })),
      deletedLessonIds: [...deletedLessonIds],
      visibleLessonIds: [...visibleLessonIds],
      extraLessonCount,
      lessonConfigDirty,
      localCustomColumns: localCustomColumns.map((column) => ({ ...column })),
      draftRows: draftRows.map((row) => ({ ...row, customValues: { ...row.customValues } })),
      nameDrafts: snapshotNameDrafts,
      metaDrafts: snapshotMetaDrafts,
      classGroupDraftIds: snapshotClassGroupDraftIds,
      customColumnDrafts: { ...customColumnDrafts },
      formatDraft: { ...formatDraft },
      columnOrder: [...columnOrder],
      hiddenColumnIds: [...hiddenColumnIds],
    };
  }

  function restoreHistorySnapshot(snapshot: SheetHistorySnapshot) {
    suppressBlurSaveRef.current = true;
    activeRangeEditRef.current = null;
    setValues(snapshot.values);
    setDirtyValues(snapshot.dirtyValues);
    setDirtyMetaValues(snapshot.dirtyMetaValues);
    setCellStyles(snapshot.cellStyles);
    setLessonLabels(snapshot.lessonLabels);
    setLessonDateOverrides(snapshot.lessonDateOverrides);
    setLessonTimeOverrides(snapshot.lessonTimeOverrides);
    setLessonMemoOverrides(snapshot.lessonMemoOverrides);
    setInsertedLessons(snapshot.insertedLessons);
    setDeletedLessonIds(snapshot.deletedLessonIds);
    setVisibleLessonIds(snapshot.visibleLessonIds);
    setExtraLessonCount(snapshot.extraLessonCount);
    setLessonConfigDirty(snapshot.lessonConfigDirty);
    setLocalCustomColumns(snapshot.localCustomColumns);
    setDraftRows(snapshot.draftRows);
    setNameDrafts(snapshot.nameDrafts);
    setMetaDrafts(snapshot.metaDrafts);
    setClassGroupDraftIds(snapshot.classGroupDraftIds);
    setCustomColumnDrafts(snapshot.customColumnDrafts);
    setFormatDraft(snapshot.formatDraft);
    setColumnOrder(snapshot.columnOrder);
    setHiddenColumnIds(snapshot.hiddenColumnIds ?? []);
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
    setEditingCustomColumnId(null);
    window.setTimeout(() => {
      suppressBlurSaveRef.current = false;
    }, 0);
  }

  function pushHistory() {
    const snapshot = createHistorySnapshot();
    setUndoStack((current) => [...current.slice(-(historyLimit - 1)), snapshot]);
    setRedoStack([]);
  }

  function undoSheetChange() {
    if (!canUndo) return;
    const currentSnapshot = createHistorySnapshot();
    const previousSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current.slice(-(historyLimit - 1)), currentSnapshot]);
    restoreHistorySnapshot(previousSnapshot);
    setStatusText("되돌림");
  }

  function redoSheetChange() {
    if (!canRedo) return;
    const currentSnapshot = createHistorySnapshot();
    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current.slice(-(historyLimit - 1)), currentSnapshot]);
    restoreHistorySnapshot(nextSnapshot);
    setStatusText("다시 적용됨");
  }

  function persistCustomColumns(columns: SheetCustomColumn[], message = "열 설정 저장됨") {
    const formData = new FormData();
    formData.set("columns", JSON.stringify(columns));
    setStatusText("열 설정 저장 중");
    startTransition(() => {
      void updateStudentSheetCustomColumns(formData)
        .then(() => {
          setStatusText(message);
          router.refresh();
        })
        .catch((error) => setStatusText(error instanceof Error ? error.message : "열 설정 저장 실패"));
    });
  }

  function clearStructuredSelection() {
    setSelectedRowIds([]);
    setSelectedColumnIds([]);
    setSelectedCellKeys([]);
  }

  function clearAllSelection() {
    setSelection(null);
    setSelectionMode(null);
    clearStructuredSelection();
  }

  function applyRowSelection(rowIndex: number, additive: boolean) {
    const row = displayRows[rowIndex];
    if (!row) return;
    setSelection(null);
    setSelectedColumnIds([]);
    setSelectedCellKeys([]);
    setSelectionMode("row");
    setSelectedRowIds((current) => {
      if (!additive) return [row.id];
      return current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id];
    });
  }

  function applyColumnSelection(colIndex: number, additive: boolean) {
    const column = gridColumns[colIndex];
    if (!column || !isColumnSelectable(column)) return;
    setSelection(null);
    setSelectedRowIds([]);
    setSelectedCellKeys([]);
    setSelectionMode("column");
    setColumnSearchId(column.id);
    setSelectedColumnIds((current) => {
      if (!additive) return [column.id];
      return current.includes(column.id) ? current.filter((id) => id !== column.id) : [...current, column.id];
    });
  }

  function rowSelectionAnchorIndex(fallbackIndex: number) {
    if (selectionMode === "row" && selectedRowIds.length > 0) {
      const selectedIndex = displayRows.findIndex((row) => row.id === selectedRowIds[0]);
      if (selectedIndex >= 0) return selectedIndex;
    }
    if (selectionMode === "cell" && selection) {
      return normalizeRange(selection).startRow;
    }
    return fallbackIndex;
  }

  function columnSelectionAnchorIndex(fallbackIndex: number) {
    if (selectionMode === "column" && selectedColumnIds.length > 0) {
      const selectedIndex = gridColumns.findIndex((column) => column.id === selectedColumnIds[0]);
      if (selectedIndex >= 0) return selectedIndex;
    }
    if (selectionMode === "cell" && selection) {
      return normalizeRange(selection).startCol;
    }
    return fallbackIndex;
  }

  function setRowSelectionRange(anchorIndex: number, currentIndex: number) {
    const from = Math.min(anchorIndex, currentIndex);
    const to = Math.max(anchorIndex, currentIndex);
    const ids = displayRows.slice(from, to + 1).map((row) => row.id);
    setSelection(null);
    setSelectedColumnIds([]);
    setSelectedCellKeys([]);
    setSelectionMode(ids.length > 0 ? "row" : null);
    setSelectedRowIds(ids);
  }

  function setColumnSelectionRange(anchorIndex: number, currentIndex: number) {
    const from = Math.min(anchorIndex, currentIndex);
    const to = Math.max(anchorIndex, currentIndex);
    const ids = gridColumns.slice(from, to + 1).filter(isColumnSelectable).map((column) => column.id);
    setSelection(null);
    setSelectedRowIds([]);
    setSelectedCellKeys([]);
    setSelectionMode(ids.length > 0 ? "column" : null);
    setSelectedColumnIds(ids);
  }

  function beginColumnDrag(event: MouseEvent<HTMLElement>, column: GridColumn) {
    if (event.button !== 0) return;
    if (!isReorderableColumn(column)) return;
    if (isInteractiveElement(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    setColumnDrag({ sourceId: column.id, targetId: column.id });
    clearAllSelection();
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
  }

  function enterColumnDrag(column: GridColumn) {
    if (!columnDrag || !isReorderableColumn(column)) return;
    setColumnDrag((current) => (current ? { ...current, targetId: column.id } : current));
  }

  function finishColumnDrag(dropColumn?: GridColumn) {
    if (!columnDrag) return;
    const targetId = dropColumn && isReorderableColumn(dropColumn) ? dropColumn.id : columnDrag.targetId;
    const sourceId = columnDrag.sourceId;
    setColumnDrag(null);
    if (!targetId || sourceId === targetId) return;

    const nextOrder = swapColumnOrder(sourceId, targetId, gridColumns);
    if (nextOrder.length === 0) return;
    pushHistory();
    setColumnOrder(nextOrder);
    setStatusText("열 순서 변경됨");
  }

  function addCustomColumn(afterColumnId?: string | null) {
    const id = createLocalId("custom");
    const nextColumn: SheetCustomColumn = { id, label: "새 열", enabled: true, afterColumnId: afterColumnId ?? null };
    const anchorIndex = afterColumnId ? localCustomColumns.findIndex((column) => column.id === afterColumnId) : -1;
    const nextColumns = [...localCustomColumns];
    if (anchorIndex >= 0) {
      nextColumns.splice(anchorIndex + 1, 0, nextColumn);
    } else {
      nextColumns.push(nextColumn);
    }
    pushHistory();
    setLocalCustomColumns(nextColumns);
    setColumnOrder((current) => insertColumnIntoOrder(id, afterColumnId, current, gridColumns));
    setCustomColumnDrafts((current) => ({ ...current, [id]: nextColumn.label }));
    setEditingCustomColumnId(id);
    persistCustomColumns(nextColumns, "열 추가됨");
  }

  function beginEditCustomColumn(column: Extract<GridColumn, { kind: "custom" }>) {
    setEditingCustomColumnId(column.customColumnId);
    setCustomColumnDrafts((current) => ({ ...current, [column.customColumnId]: column.label }));
  }

  function saveCustomColumnName(columnId: string) {
    const current = localCustomColumns.find((column) => column.id === columnId);
    if (!current) {
      setEditingCustomColumnId(null);
      return;
    }
    const label = (customColumnDrafts[columnId] ?? current.label).trim() || current.label;
    setEditingCustomColumnId(null);
    if (label === current.label) return;
    const nextColumns = localCustomColumns.map((column) => (column.id === columnId ? { ...column, label: label.slice(0, 30) } : column));
    pushHistory();
    setLocalCustomColumns(nextColumns);
    persistCustomColumns(nextColumns, "열 이름 변경됨");
  }

  function contextTargetCustomColumn() {
    const menuColumn = typeof contextMenu?.colIndex === "number" ? gridColumns[contextMenu.colIndex] : null;
    if (menuColumn?.kind === "custom") return menuColumn;

    if (selectionMode === "column" && selectedColumnIdSet.size === 1) {
      const selectedColumn = gridColumns.find((column) => selectedColumnIdSet.has(column.id));
      return selectedColumn?.kind === "custom" ? selectedColumn : null;
    }

    if (!selection) return null;
    const range = normalizeRange(selection);
    if (range.startCol !== range.endCol) return null;
    const selectedColumn = gridColumns[range.startCol];
    return selectedColumn?.kind === "custom" ? selectedColumn : null;
  }

  function contextColumnForInsert() {
    if (typeof contextMenu?.colIndex === "number") {
      const menuColumn = gridColumns[contextMenu.colIndex];
      if (menuColumn?.kind === "meta" || menuColumn?.kind === "custom") return menuColumn.id;
    }

    if (!selection) return null;
    const range = normalizeRange(selection);
    if (range.startCol !== range.endCol) return null;
    const selectedColumn = gridColumns[range.startCol];
    return selectedColumn?.kind === "meta" || selectedColumn?.kind === "custom" ? selectedColumn.id : null;
  }

  function contextLessonForAction() {
    if (!contextMenu?.lessonId) return null;
    return lessons.find((lesson) => lesson.id === contextMenu.lessonId) ?? null;
  }

  function contextColumnsForVisibility() {
    if (!contextMenu) return [];
    const candidates: GridColumn[] = [];

    if (contextMenu.lessonId) {
      candidates.push(...(lessonColumnsByLessonId.get(contextMenu.lessonId) ?? []));
    }

    if (selectionMode === "column" && typeof contextMenu.colIndex === "number") {
      const menuColumn = gridColumns[contextMenu.colIndex];
      const isContextInsideSelection = menuColumn ? selectedColumnIdSet.has(menuColumn.id) : false;
      if (isContextInsideSelection) {
        for (const column of gridColumns) {
          if (selectedColumnIdSet.has(column.id)) candidates.push(column);
        }
      }
    }

    if (selection) {
      const range = normalizeRange(selection);
      const isContextInsideSelection =
        typeof contextMenu.colIndex !== "number" || (contextMenu.colIndex >= range.startCol && contextMenu.colIndex <= range.endCol);
      const isHeaderContext = typeof contextMenu.rowIndex !== "number";
      const isColumnSelection = displayRows.length > 0 && range.startRow === 0 && range.endRow === displayRows.length - 1;

      if (isContextInsideSelection && (isHeaderContext || isColumnSelection)) {
        for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
          const column = gridColumns[colIndex];
          if (column) candidates.push(column);
        }
      }
    }

    if (typeof contextMenu.colIndex === "number") {
      const menuColumn = gridColumns[contextMenu.colIndex];
      if (menuColumn) candidates.push(menuColumn);
    }

    return uniqueColumns(candidates).filter(isHideableColumn);
  }

  function hideContextColumns() {
    const columns = contextColumnsForVisibility();
    if (columns.length === 0) {
      setStatusText("필수 열 또는 차시 열은 숨길 수 없습니다.");
      setContextMenu(null);
      return;
    }

    const ids = columns.map((column) => column.id);
    setHiddenColumnIds((current) => Array.from(new Set([...current, ...ids])));
    setSelectedColumnIds((current) => current.filter((id) => !ids.includes(id)));
    if (ids.includes(effectiveColumnSearchId)) setColumnSearchId("name");
    clearAllSelection();
    setContextMenu(null);
    setColumnVisibilityOpen(false);
    setStatusText(`열 ${ids.length}개 숨김`);
  }

  function setColumnVisible(columnId: string, visible: boolean) {
    setHiddenColumnIds((current) => {
      if (visible) return current.filter((id) => id !== columnId);
      return current.includes(columnId) ? current : [...current, columnId];
    });
    if (!visible) setSelectedColumnIds((current) => current.filter((id) => id !== columnId));
    if (!visible && columnId === effectiveColumnSearchId) setColumnSearchId("name");
    clearAllSelection();
  }

  function showAllColumns() {
    setHiddenColumnIds([]);
    setStatusText("숨긴 열을 모두 다시 표시했습니다.");
  }

  function resetColumnLayout() {
    pushHistory();
    setColumnOrder([]);
    setHiddenColumnIds([]);
    clearAllSelection();
    setColumnVisibilityOpen(false);
    setStatusText("열 보기 기본값으로 복원됨");
  }

  function deleteCustomColumn(column: Extract<GridColumn, { kind: "custom" }> | null) {
    if (!column) {
      setStatusText("기본 학생 정보 열은 삭제할 수 없습니다.");
      return;
    }
    const current = localCustomColumns.find((item) => item.id === column.customColumnId);
    if (!current) return;
    if (!window.confirm(`${current.label} 커스텀 열을 삭제할까요? 기본 학생 정보 열은 삭제할 수 없습니다.`)) return;

    const nextColumns = localCustomColumns.filter((item) => item.id !== column.customColumnId);
    pushHistory();
    setLocalCustomColumns(nextColumns);
    setColumnOrder((current) => current.filter((columnId) => columnId !== column.id && columnId !== column.customColumnId));
    setEditingCustomColumnId(null);
    clearAllSelection();
    setCustomColumnDrafts((currentDrafts) => {
      const next = { ...currentDrafts };
      delete next[column.customColumnId];
      return next;
    });
    setDirtyValues((currentDirty) => {
      const next = { ...currentDirty };
      for (const key of Object.keys(next)) {
        const columnId = key.slice(key.indexOf(":") + 1);
        if (columnId === column.customColumnId) delete next[key];
      }
      return next;
    });
    setCellStyles((currentStyles) => {
      const next = { ...currentStyles };
      for (const key of Object.keys(next)) {
        const columnId = key.slice(key.indexOf(":") + 1);
        if (columnId === column.customColumnId) delete next[key];
      }
      return next;
    });
    persistCustomColumns(nextColumns, "열 삭제됨");
  }

  function selectedRowsForAction() {
    if (selectionMode === "row") {
      const seen = new Set<string>();
      return displayRows.filter((row) => {
        if (!selectedRowIdSet.has(row.id) || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
    }

    if (!selection) return [];
    const range = normalizeRange(selection);
    const selected = displayRows.slice(range.startRow, range.endRow + 1);
    const seen = new Set<string>();
    return selected.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }

  function createDraftStudentRow(afterRowId: string | null): DraftStudentRow {
    const classGroupId = effectiveClassGroupId ?? "";
    return {
      id: createLocalId("draft"),
      no: rows.length + draftRows.length + 1,
      name: "",
      phone: "",
      parentPhone: "",
      schoolName: "",
      grade: "",
      classGroupId,
      classGroupName: selectedClassGroup?.name ?? "",
      subject: "",
      currentLevel: "",
      memo: "",
      attendance: "",
      assignment: "",
      assignmentScore: null,
      score: null,
      maxScore: 100,
      attendanceByDate: {},
      assignmentByDate: {},
      scoreByDate: {},
      customValues: {},
      isDraft: true,
      afterRowId,
      createdAt: currentClientTime(),
    };
  }

  function addDraftRowFromContext() {
    const contextRow = typeof contextMenu?.rowIndex === "number" ? displayRows[contextMenu.rowIndex] : null;
    const draftRow = createDraftStudentRow(contextRow?.id ?? null);
    pushHistory();
    setDraftRows((current) => [...current, draftRow]);
    clearAllSelection();
    setStatusText("신규 학생 행 추가됨 - 학생명 입력 필요");
  }

  function deleteSelectedStudents() {
    const selectedRows = selectedRowsForAction();
    if (selectedRows.length === 0) return;
    const draftSelectedRows = selectedRows.filter(isDraftStudentRow);
    const persistedRows = selectedRows.filter((row) => !isDraftStudentRow(row));
    const confirmMessage = studentDeleteConfirmMessage(selectedRows, persistedRows, draftSelectedRows, displayName);
    if (!window.confirm(confirmMessage)) return;

    if (draftSelectedRows.length > 0) {
      const draftIds = new Set(draftSelectedRows.map((row) => row.id));
      pushHistory();
      setDraftRows((current) => current.filter((row) => !draftIds.has(row.id)));
      setDirtyValues((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          const separator = key.indexOf(":");
          if (draftIds.has(key.slice(0, separator))) delete next[key];
        }
        return next;
      });
      setDirtyMetaValues((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(next)) {
          if (draftIds.has(value.studentId)) delete next[key];
        }
        return next;
      });
      setNameDrafts((current) => {
        const next = { ...current };
        for (const id of draftIds) delete next[id];
        return next;
      });
      setMetaDrafts((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          const separator = key.indexOf(":");
          if (draftIds.has(key.slice(0, separator))) delete next[key];
        }
        return next;
      });
      setClassGroupDraftIds((current) => {
        const next = { ...current };
        for (const id of draftIds) delete next[id];
        return next;
      });
    }

    if (persistedRows.length === 0) {
      clearAllSelection();
      setStatusText("신규 학생 행 삭제됨");
      return;
    }

    const formData = new FormData();
    for (const row of persistedRows) formData.append("studentIds", row.id);
    setStatusText("학생 삭제 중");
    startTransition(() => {
      void deleteStudentsFromSheet(formData)
        .then(() => {
          clearAllSelection();
          setStatusText("학생 삭제됨");
          router.refresh();
        })
        .catch((error) => setStatusText(error instanceof Error ? error.message : "학생 삭제 실패"));
    });
  }

  function getCell(row: StudentSheetRow, columnId: string) {
    return cellValue(row, columnId, values);
  }

  function setCell(row: StudentSheetRow, columnId: string, value: string) {
    const activeRangeEdit = activeRangeEditRef.current;
    const activeLessonCells =
      activeRangeEdit?.targetKey === lessonCellKey(row.id, columnId) && activeRangeEdit.lessonCells.length > 0
        ? activeRangeEdit.lessonCells
        : null;
    const selectedCells = selectedLessonCells(selection, displayRows, gridColumns);
    const targetKey = lessonCellKey(row.id, columnId);
    const shouldFillRange = selectedCells.length > 1 && selectedCells.some((cell) => lessonCellKey(cell.row.id, cell.columnId) === targetKey);
    const nextValues: Record<string, string> = {};

    if (activeLessonCells) {
      for (const cell of activeLessonCells) {
        nextValues[lessonCellKey(cell.studentId, cell.columnId)] = value.slice(0, 500);
      }
    } else if (shouldFillRange) {
      for (const cell of selectedCells) {
        nextValues[lessonCellKey(cell.row.id, cell.columnId)] = value.slice(0, 500);
      }
    } else {
      nextValues[targetKey] = value.slice(0, 500);
    }

    if (activeLessonCells && activeRangeEdit) {
      if (!activeRangeEdit.historyCaptured) {
        pushHistory();
        activeRangeEdit.historyCaptured = true;
      }
    } else {
      pushHistory();
    }
    setValues((current) => ({ ...current, ...nextValues }));
    setDirtyValues((current) => ({ ...current, ...nextValues }));
    setStatusText("저장 대기");
  }

  function setMetaCell(row: StudentSheetRow, columnId: EditableMetaColumnId, value: string) {
    const activeRangeEdit = activeRangeEditRef.current;
    const activeMetaCells =
      activeRangeEdit?.targetKey === lessonCellKey(row.id, columnId) && activeRangeEdit.metaCells.length > 0
        ? activeRangeEdit.metaCells
        : null;
    const selectedCells = selectedEditableCells(selection, displayRows, gridColumns);
    const targetKey = lessonCellKey(row.id, columnId);
    const shouldFillRange = selectedCells.length > 1 && selectedCells.some((cell) => lessonCellKey(cell.row.id, cell.columnId) === targetKey);
    const nextMetaDrafts: Record<string, string> = {};
    const nextDirtyMetaValues: Record<string, DirtyMetaValue> = {};
    const nextClassGroupDraftIds: Record<string, string> = {};

    if (activeMetaCells) {
      for (const cell of activeMetaCells) {
        queueMetaCellUpdate(cell.row, cell.columnId, value, nextMetaDrafts, nextDirtyMetaValues, nextClassGroupDraftIds);
      }
    } else if (shouldFillRange) {
      for (const cell of selectedCells) {
        if (cell.column.kind !== "meta") continue;
        queueMetaCellUpdate(cell.row, cell.column.id, value, nextMetaDrafts, nextDirtyMetaValues, nextClassGroupDraftIds);
      }
    } else {
      queueMetaCellUpdate(row, columnId, value, nextMetaDrafts, nextDirtyMetaValues, nextClassGroupDraftIds);
    }

    if (Object.keys(nextMetaDrafts).length === 0) return;
    if (activeMetaCells && activeRangeEdit) {
      if (!activeRangeEdit.historyCaptured) {
        pushHistory();
        activeRangeEdit.historyCaptured = true;
      }
    } else {
      pushHistory();
    }
    setMetaDrafts((current) => ({ ...current, ...nextMetaDrafts }));
    setDirtyMetaValues((current) => ({ ...current, ...nextDirtyMetaValues }));
    setClassGroupDraftIds((current) => ({ ...current, ...nextClassGroupDraftIds }));
    setStatusText("저장 대기");
  }

  function displayName(row: StudentSheetRow) {
    return nameDrafts[row.id] ?? row.name;
  }

  function beginEditName(row: StudentSheetRow) {
    setNameDrafts((current) => ({ ...current, [row.id]: displayName(row) }));
    setEditingNameId(row.id);
    window.setTimeout(() => {
      nameInputRefs.current[row.id]?.focus();
      nameInputRefs.current[row.id]?.select();
    }, 0);
  }

  function finishNameEdit(row: StudentSheetRow) {
    const value = (nameDrafts[row.id] ?? row.name).trim();
    setEditingNameId(null);
    if (value) setStatusText("저장 대기");
    if (!value && isDraftStudentRow(row)) setStatusText("신규 행은 학생명을 입력해야 저장됩니다.");
  }

  function editableMetaValue(row: StudentSheetRow, columnId: EditableMetaColumnId) {
    const key = lessonCellKey(row.id, columnId);
    if (key in metaDrafts) return metaDrafts[key];
    if (columnId === "name") return displayName(row);
    return metaCellValue(row, columnId);
  }

  function beginEditMeta(row: StudentSheetRow, columnId: MetaColumnId) {
    if (columnId === "rowNumber") return;
    if (columnId === "name") {
      beginEditName(row);
      return;
    }

    const key = lessonCellKey(row.id, columnId);
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(key);
    setMetaDrafts((current) => ({ ...current, [key]: metaCellValue(row, columnId) }));
    if (columnId === "classGroup") {
      setClassGroupDraftIds((current) => ({ ...current, [row.id]: row.classGroupId ?? "" }));
    }
    window.setTimeout(() => {
      metaInputRefs.current[key]?.focus();
      if (metaInputRefs.current[key] instanceof HTMLInputElement) {
        metaInputRefs.current[key]?.select();
      }
    }, 0);
  }

  function cancelMetaEdit(row: StudentSheetRow, columnId: EditableMetaColumnId) {
    const key = lessonCellKey(row.id, columnId);
    setEditingMetaKey(null);
    setMetaDrafts((current) => ({ ...current, [key]: metaCellValue(row, columnId) }));
    if (columnId === "classGroup") {
      setClassGroupDraftIds((current) => ({ ...current, [row.id]: row.classGroupId ?? "" }));
    }
  }

  function finishMetaTextEdit(row: StudentSheetRow, columnId: Exclude<EditableMetaColumnId, "classGroup">) {
    const key = lessonCellKey(row.id, columnId);
    const value = (metaDrafts[key] ?? metaCellValue(row, columnId)).trim();
    setEditingMetaKey(null);
    setMetaDrafts((current) => ({ ...current, [key]: value }));
    setStatusText("저장 대기");
  }

  function setMetaClassGroup(row: StudentSheetRow, classGroupId: string) {
    const key = lessonCellKey(row.id, "classGroup");
    const classGroup = classGroups.find((option) => option.id === classGroupId);
    const classGroupName = classGroup ? classGroup.name : "-";
    const activeRangeEdit = activeRangeEditRef.current;
    const activeClassGroupCells =
      activeRangeEdit?.targetKey === key && activeRangeEdit.metaCells.length > 0
        ? activeRangeEdit.metaCells.filter((cell) => cell.columnId === "classGroup")
        : null;
    const selectedCells = selectedEditableCells(selection, displayRows, gridColumns);
    const shouldFillRange =
      selectedCells.length > 1 &&
      selectedCells.some((cell) => cell.column.kind === "meta" && cell.column.id === "classGroup" && lessonCellKey(cell.row.id, cell.columnId) === key);
    const targetCells =
      activeClassGroupCells ??
      (shouldFillRange
        ? selectedCells.filter((cell) => cell.column.kind === "meta" && cell.column.id === "classGroup").map((cell) => ({ row: cell.row, columnId: cell.column.id }))
        : [{ row, columnId: "classGroup" as const }]);
    const nextMetaDrafts: Record<string, string> = {};
    const nextDirtyMetaValues: Record<string, DirtyMetaValue> = {};
    const nextClassGroupDraftIds: Record<string, string> = {};

    for (const cell of targetCells) {
      const cellKey = lessonCellKey(cell.row.id, "classGroup");
      nextMetaDrafts[cellKey] = classGroupName;
      nextDirtyMetaValues[cellKey] = { studentId: cell.row.id, field: "classGroup", value: classGroupId };
      nextClassGroupDraftIds[cell.row.id] = classGroupId;
    }
    pushHistory();
    activeRangeEditRef.current = null;
    setEditingMetaKey(null);
    setMetaDrafts((current) => ({ ...current, ...nextMetaDrafts }));
    setClassGroupDraftIds((current) => ({ ...current, ...nextClassGroupDraftIds }));
    setDirtyMetaValues((current) => ({ ...current, ...nextDirtyMetaValues }));
    setStatusText("저장 대기");
  }
  function setClassGroupTextDraft(row: StudentSheetRow, value: string) {
    const key = lessonCellKey(row.id, "classGroup");
    setMetaDrafts((current) => ({ ...current, [key]: value }));
  }

  function finishClassGroupTextEdit(row: StudentSheetRow) {
    const key = lessonCellKey(row.id, "classGroup");
    const rawValue = metaDrafts[key] ?? metaCellValue(row, "classGroup");
    const resolved = resolveClassGroupInput(rawValue);
    if (!resolved) {
      setStatusText("일치하는 반을 선택해 주세요.");
      return;
    }
    setMetaClassGroup(row, resolved.id);
  }

  function resolveClassGroupInput(value: string) {
    const normalized = value.trim();
    if (!normalized || normalized === "-" || normalized === "미지정") {
      return { id: "", label: "-" };
    }

    const normalizedLower = normalized.toLocaleLowerCase();
    const match = classGroups.find((option) => {
      const fullLabel = option.teacherName ? `${option.teacherName} / ${option.name}` : option.name;
      return option.id === normalized || option.name === normalized || fullLabel === normalized;
    });

    if (match) return { id: match.id, label: match.name };

    const fuzzyMatches = classGroups.filter((option) => {
      const fullLabel = option.teacherName ? `${option.teacherName} / ${option.name}` : option.name;
      return option.name.toLocaleLowerCase().includes(normalizedLower) || fullLabel.toLocaleLowerCase().includes(normalizedLower);
    });

    return fuzzyMatches.length === 1 ? { id: fuzzyMatches[0].id, label: fuzzyMatches[0].name } : null;
  }

  function buildMetaUpdate(row: StudentSheetRow, columnId: EditableMetaColumnId, rawValue: string) {
    const value = isPhoneMetaColumn(columnId) ? formatPhoneNumber(rawValue).slice(0, 40) : rawValue.slice(0, 500);
    if (columnId === "name" && !value.trim() && !isDraftStudentRow(row)) return null;

    if (columnId === "classGroup") {
      const resolved = resolveClassGroupInput(value);
      if (!resolved) return null;
      return { displayValue: resolved.label, saveValue: resolved.id };
    }

    return { displayValue: value, saveValue: value };
  }

  function queueMetaCellUpdate(
    row: StudentSheetRow,
    columnId: EditableMetaColumnId,
    rawValue: string,
    draftPatch: Record<string, string>,
    dirtyPatch: Record<string, DirtyMetaValue>,
    classGroupPatch: Record<string, string>
  ) {
    const update = buildMetaUpdate(row, columnId, rawValue);
    if (!update) return false;

    const key = lessonCellKey(row.id, columnId);
    draftPatch[key] = update.displayValue;
    dirtyPatch[key] = { studentId: row.id, field: columnId, value: update.saveValue };
    if (columnId === "name") {
      setNameDrafts((current) => ({ ...current, [row.id]: update.displayValue }));
    }
    if (columnId === "classGroup") {
      classGroupPatch[row.id] = update.saveValue;
    }
    return true;
  }

  function updateLessonLabel(lessonId: string, value: string) {
    pushHistory();
    setLessonLabels((current) => ({ ...current, [lessonId]: value.slice(0, 40) }));
    setLessonConfigDirty(true);
  }

  function updateLessonDate(lessonId: string, value: string) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    pushHistory();
    setLessonDateOverrides((current) => ({ ...current, [lessonId]: value }));
    setLessonConfigDirty(true);

    const lessonColumns = gridColumns.filter((column) => column.kind === "lesson" && column.lessonId === lesson.id).map((column) => column.id);
    setDirtyValues((current) => {
      const next = { ...current };
      for (const row of rows) {
        for (const columnId of lessonColumns) {
          next[lessonCellKey(row.id, columnId)] = cellValue(row, columnId, values);
        }
      }
      return next;
    });
    setStatusText("차시 날짜 변경됨 - 저장 필요");
  }

  function updateLessonTime(lessonId: string, field: keyof LessonTimeOverride, value: string) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    pushHistory();
    setLessonTimeOverrides((current) => {
      const previous = current[lessonId] ?? {
        startTime: lesson.startTime ?? "",
        endTime: lesson.endTime ?? "",
      };
      return {
        ...current,
        [lessonId]: {
          ...previous,
          [field]: value,
        },
      };
    });
    setLessonConfigDirty(true);
    setStatusText("차시 시간 변경됨 - 저장 필요");
  }

  function updateLessonMemo(lessonId: string, value: string) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    pushHistory();
    setLessonMemoOverrides((current) => ({ ...current, [lessonId]: value.slice(0, 500) }));
    setLessonConfigDirty(true);
    setStatusText("차시 메모 변경됨 - 저장 필요");
  }

  function currentEditableCells() {
    return selectedEditableCellsForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns);
  }

  function currentSheetCells() {
    return selectedSheetCellsForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns);
  }

  function applyValueToSelection(value: string) {
    const cells = currentEditableCells();
    if (cells.length === 0) return;

    const nextValues: Record<string, string> = {};
    const nextMetaDrafts: Record<string, string> = {};
    const nextDirtyMetaValues: Record<string, DirtyMetaValue> = {};
    const nextClassGroupDraftIds: Record<string, string> = {};

    for (const cell of cells) {
      if (cell.column.kind === "lesson" || cell.column.kind === "custom") {
        nextValues[lessonCellKey(cell.row.id, cell.columnId)] = value.slice(0, 500);
      } else {
        queueMetaCellUpdate(cell.row, cell.column.id, value, nextMetaDrafts, nextDirtyMetaValues, nextClassGroupDraftIds);
      }
    }

    if (Object.keys(nextValues).length > 0) {
      pushHistory();
      setValues((current) => ({ ...current, ...nextValues }));
      setDirtyValues((current) => ({ ...current, ...nextValues }));
    } else if (Object.keys(nextMetaDrafts).length > 0) {
      pushHistory();
    }
    if (Object.keys(nextMetaDrafts).length > 0) {
      setMetaDrafts((current) => ({ ...current, ...nextMetaDrafts }));
      setDirtyMetaValues((current) => ({ ...current, ...nextDirtyMetaValues }));
      setClassGroupDraftIds((current) => ({ ...current, ...nextClassGroupDraftIds }));
    }
    setStatusText("저장 대기");
  }

  function fillSelectionFromAnchor() {
    const fallbackCell = currentEditableCells()[0];
    const anchorRow = selectionMode === "cell" && selection ? displayRows[selection.anchor.rowIndex] : null;
    const anchorColumn = selectionMode === "cell" && selection ? gridColumns[selection.anchor.colIndex] : null;
    const sourceRow = anchorRow && anchorColumn && isEditableGridColumn(anchorColumn) ? anchorRow : fallbackCell?.row;
    const sourceColumn = anchorRow && anchorColumn && isEditableGridColumn(anchorColumn) ? anchorColumn : fallbackCell?.column;
    if (!sourceRow || !sourceColumn) return;
    applyValueToSelection(readDisplayedCellValue(sourceRow, sourceColumn.id));
  }

  function openReplaceDialog() {
    const cells = currentEditableCells();
    if (cells.length === 0) {
      setStatusText("바꾸기를 적용할 편집 가능한 셀이 없습니다.");
      return;
    }
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
    setReplaceDialogOpen(true);
  }

  function applyReplaceToSelection() {
    const findText = replaceFindText;
    if (!findText) {
      setStatusText("찾을 내용을 입력해주세요.");
      return;
    }

    const cells = currentEditableCells();
    const nextValues: Record<string, string> = {};
    const nextMetaDrafts: Record<string, string> = {};
    const nextDirtyMetaValues: Record<string, DirtyMetaValue> = {};
    const nextClassGroupDraftIds: Record<string, string> = {};
    let changedCount = 0;

    for (const cell of cells) {
      const currentValue = readDisplayedCellValue(cell.row, cell.column.id);
      if (!currentValue) continue;
      const replacement = replaceText(currentValue, findText, replaceWithText, replaceCaseSensitive);
      if (!replacement.changed) continue;

      if (cell.column.kind === "lesson" || cell.column.kind === "custom") {
        nextValues[lessonCellKey(cell.row.id, cell.column.id)] = replacement.value.slice(0, 500);
        changedCount += 1;
      } else if (queueMetaCellUpdate(cell.row, cell.column.id, replacement.value, nextMetaDrafts, nextDirtyMetaValues, nextClassGroupDraftIds)) {
        changedCount += 1;
      }
    }

    if (changedCount === 0) {
      setStatusText("변경할 내용이 없습니다.");
      return;
    }

    if (changedCount >= 45 && !window.confirm(`선택 범위 내 ${changedCount}개 셀이 변경됩니다. 계속할까요?`)) return;

    pushHistory();
    if (Object.keys(nextValues).length > 0) {
      setValues((current) => ({ ...current, ...nextValues }));
      setDirtyValues((current) => ({ ...current, ...nextValues }));
    }
    if (Object.keys(nextMetaDrafts).length > 0) {
      setMetaDrafts((current) => ({ ...current, ...nextMetaDrafts }));
      setDirtyMetaValues((current) => ({ ...current, ...nextDirtyMetaValues }));
      setClassGroupDraftIds((current) => ({ ...current, ...nextClassGroupDraftIds }));
    }
    setReplaceDialogOpen(false);
    setStatusText(`바꾸기 ${changedCount}개 셀 변경됨 - 저장 필요`);
  }

  function clearSelectionStyles() {
    const keys = currentSheetCells().map((cell) => lessonCellKey(cell.row.id, cell.columnId));
    if (keys.length === 0) return;

    pushHistory();
    setCellStyles((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function applyStyleToSelection(patch: CellStyle) {
    const keys = currentSheetCells().map((cell) => lessonCellKey(cell.row.id, cell.columnId));
    if (keys.length === 0) return;

    pushHistory();
    setCellStyles((current) => {
      const next = { ...current };
      for (const key of keys) {
        next[key] = { ...(next[key] ?? {}), ...patch };
      }
      return next;
    });
  }

  function updateFormat(patch: CellStyle) {
    setFormatDraft((current) => ({ ...current, ...patch }));
    applyStyleToSelection(patch);
  }

  function stepSheetZoom(direction: -1 | 1) {
    const nextZoom = nextSheetZoom(sheetZoom, direction);
    setSheetZoom(nextZoom);
    setSheetZoomInput(String(nextZoom));
  }

  function applySheetZoomInput() {
    const nextZoom = parseSheetZoomInput(sheetZoomInput, sheetZoom);
    setSheetZoom(nextZoom);
    setSheetZoomInput(String(nextZoom));
  }

  function showLessonRange(start: number, end: number) {
    setVisibleLessonIds(lessons.slice(start - 1, end).map((lesson) => lesson.id));
  }

  function showLessonRangeByIds(startId: string, endId: string) {
    const startIndex = lessons.findIndex((lesson) => lesson.id === startId);
    const endIndex = lessons.findIndex((lesson) => lesson.id === endId);
    if (startIndex === -1 || endIndex === -1) return;
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    setVisibleLessonIds(lessons.slice(from, to + 1).map((lesson) => lesson.id));
  }

  function toggleLesson(lessonId: string) {
    setVisibleLessonIds((current) => {
      const selected = current.length > 0 ? current : lessons.map((lesson) => lesson.id);
      const next = selected.includes(lessonId)
        ? selected.filter((id) => id !== lessonId)
        : [...selected, lessonId];
      return next.length > 0 ? next : selected;
    });
  }

  function toggleSort(columnId: string) {
    setSortColumnId(columnId);
    setSortDirection((current) => (sortColumnId === columnId && current === "asc" ? "desc" : "asc"));
  }

  function addLesson() {
    const nextExtra = extraLessonCount + 1;
    const nextIndex = baseLessons.length + 1;
    const nextId = lessonId(nextIndex);
    pushHistory();
    setExtraLessonCount(nextExtra);
    setLessonLabels((current) => ({ ...current, [nextId]: addedLessonLabel }));
    setVisibleLessonIds((current) => [...new Set([...current, nextId])]);
    setLessonConfigDirty(true);
  }

  function insertLessonAfter(afterLessonId: string) {
    const afterLesson = lessons.find((lesson) => lesson.id === afterLessonId);
    insertLessonNear(afterLessonId, afterLesson ?? null, 1);
  }

  function insertLessonBefore(lessonId: string) {
    const targetIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
    const targetLesson = targetIndex >= 0 ? lessons[targetIndex] : null;
    const previousLessonId = targetIndex > 0 ? lessons[targetIndex - 1]?.id ?? null : null;
    insertLessonNear(previousLessonId, targetLesson, -1);
  }

  function insertLessonNear(afterLessonId: string | null, referenceLesson: Lesson | null, dateOffset: number) {
    const nextIndex = Math.max(0, ...baseLessons.map((lesson) => lesson.index), ...insertedLessons.map((lesson) => lesson.index)) + 1;
    const id = `${createLocalId("manual")}_${nextIndex}`;
    const nextDate = referenceLesson?.date ? formatDateInput(addDays(parseLocalDate(referenceLesson.date), dateOffset)) : "";
    const inserted: InsertedLesson = {
      id,
      index: nextIndex,
      afterId: afterLessonId,
      label: addedLessonLabel,
      date: nextDate,
      startTime: referenceLesson?.startTime ?? selectedClassGroup?.startTime ?? "",
      endTime: referenceLesson?.endTime ?? selectedClassGroup?.endTime ?? "",
      memo: "",
      createdAt: currentClientTime(),
    };
    pushHistory();
    setInsertedLessons((current) => [...current, inserted]);
    setLessonLabels((current) => ({ ...current, [id]: inserted.label }));
    if (nextDate) setLessonDateOverrides((current) => ({ ...current, [id]: nextDate }));
    setLessonTimeOverrides((current) => ({ ...current, [id]: { startTime: inserted.startTime, endTime: inserted.endTime } }));
    setVisibleLessonIds((current) => (current.length > 0 ? [...new Set([...current, id])] : current));
    setLessonConfigDirty(true);
    setStatusText("차시가 추가됨 - 저장 필요");
  }

  function deleteLesson(lessonId: string) {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson || lessons.length <= 1) return;
    const label = lessonDisplayLabel(lesson, lessonLabels) || lesson.defaultLabel;
    if (!window.confirm(`${label} 차시를 삭제할까요? 저장 버튼을 눌러야 최종 반영됩니다.`)) return;

    const deletedColumns = new Set(gridColumns.filter((column) => column.kind === "lesson" && column.lessonId === lesson.id).map((column) => column.id));
    pushHistory();
    setDeletedLessonIds((current) => (current.includes(lessonId) ? current : [...current, lessonId]));
    setInsertedLessons((current) => current.filter((item) => item.id !== lessonId));
    setVisibleLessonIds((current) => current.filter((id) => id !== lessonId));
    setLessonLabels((current) => {
      const next = { ...current };
      delete next[lessonId];
      return next;
    });
    setLessonDateOverrides((current) => {
      const next = { ...current };
      delete next[lessonId];
      return next;
    });
    setLessonTimeOverrides((current) => {
      const next = { ...current };
      delete next[lessonId];
      return next;
    });
    setLessonMemoOverrides((current) => {
      const next = { ...current };
      delete next[lessonId];
      return next;
    });
    setDirtyValues((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        const columnId = key.slice(key.indexOf(":") + 1);
        if (deletedColumns.has(columnId)) delete next[key];
      }
      return next;
    });
    clearAllSelection();
    setEditingCellKey(null);
    setLessonConfigDirty(true);
    setStatusText("차시가 삭제됨 - 저장 필요");
  }

  function selectCell(rowIndex: number, colIndex: number, extend = false) {
    setEditingCellKey(null);
    setEditingNameId(null);
    setSelectedRowIds([]);
    setSelectedColumnIds([]);
    setSelectedCellKeys([]);
    setSelectionMode("cell");
    setSelection((current) => {
      const point = { rowIndex, colIndex };
      if (extend && current) return { anchor: current.anchor, cursor: point };
      return { anchor: point, cursor: point };
    });
  }

  function currentCellSelectionKeys() {
    if (selectionMode !== "cell") return [];
    if (selectedCellKeys.length > 0) return selectedCellKeys.filter((key) => selectedCellKeySet.has(key));
    return selectedSheetCells(selection, displayRows, gridColumns).map((cell) => lessonCellKey(cell.row.id, cell.columnId));
  }

  function toggleCellSelection(rowIndex: number, colIndex: number) {
    const row = displayRows[rowIndex];
    const column = gridColumns[colIndex];
    if (!row || !column) return;

    const key = lessonCellKey(row.id, column.id);
    const currentKeys = currentCellSelectionKeys();
    const nextKeys = currentKeys.includes(key) ? currentKeys.filter((item) => item !== key) : [...currentKeys, key];
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
    setSelection(null);
    setSelectedRowIds([]);
    setSelectedColumnIds([]);
    setSelectedCellKeys(nextKeys);
    setSelectionMode(nextKeys.length > 0 ? "cell" : null);
  }

  function beginRowDrag(event: MouseEvent<HTMLTableCellElement>, rowIndex: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    sheetWrapRef.current?.focus();
    if (event.shiftKey) {
      const anchorIndex = rowSelectionAnchorIndex(rowIndex);
      rowDragAnchorRef.current = anchorIndex;
      setEditingCellKey(null);
      setEditingNameId(null);
      setEditingMetaKey(null);
      setRowSelectionRange(anchorIndex, rowIndex);
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    if (additive) {
      applyRowSelection(rowIndex, true);
      return;
    }
    setIsDragging(true);
    setDragMode("row");
    rowDragAnchorRef.current = rowIndex;
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
    applyRowSelection(rowIndex, false);
  }

  function selectColumn(colIndex: number, additive = false) {
    const column = gridColumns[colIndex];
    if (!column || displayRows.length === 0) return;
    if (!isColumnSelectable(column)) {
      setEditingCellKey(null);
      setEditingNameId(null);
      setEditingMetaKey(null);
      setColumnSearchId(column.id);
      setSelectionMode("cell");
      setSelectedRowIds([]);
      setSelectedColumnIds([]);
      setSelectedCellKeys([]);
      setSelection({ anchor: { rowIndex: 0, colIndex }, cursor: { rowIndex: displayRows.length - 1, colIndex } });
      return;
    }
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
    applyColumnSelection(colIndex, additive);
  }

  function beginEditColumn(colIndex: number) {
    const column = gridColumns[colIndex];
    if (!column || displayRows.length === 0 || !isEditableGridColumn(column)) return;
    selectColumn(colIndex);

    const columnCells = selectedEditableCellsForMode("column", null, new Set<string>(), new Set([column.id]), new Set<string>(), displayRows, gridColumns);
    const firstCell = columnCells[0];
    if (!firstCell) return;

    captureRangeEdit({ row: firstCell.row, columnId: firstCell.columnId }, columnCells);
    beginEditGridCell(firstCell.rowIndex, firstCell.colIndex, { preserveSelection: true });
  }

  function beginColumnSelect(event: MouseEvent<HTMLElement>, colIndex: number) {
    if (event.button !== 0) return;
    if (isInteractiveElement(event.target) && !(event.target instanceof HTMLButtonElement)) return;
    const column = gridColumns[colIndex];
    if (!column || !isColumnSelectable(column)) return;
    event.preventDefault();
    event.stopPropagation();
    sheetWrapRef.current?.focus();
    if (event.shiftKey) {
      const anchorIndex = columnSelectionAnchorIndex(colIndex);
      columnDragAnchorRef.current = anchorIndex;
      suppressNextColumnClickRef.current = true;
      setEditingCellKey(null);
      setEditingNameId(null);
      setEditingMetaKey(null);
      setColumnSelectionRange(anchorIndex, colIndex);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      columnDragAnchorRef.current = null;
      suppressNextColumnClickRef.current = true;
      setEditingCellKey(null);
      setEditingNameId(null);
      setEditingMetaKey(null);
      applyColumnSelection(colIndex, true);
      return;
    }
    columnDragAnchorRef.current = colIndex;
    suppressNextColumnClickRef.current = true;
    setIsDragging(true);
    setDragMode("column");
    setEditingCellKey(null);
    setEditingNameId(null);
    setEditingMetaKey(null);
    applyColumnSelection(colIndex, event.ctrlKey || event.metaKey);
  }

  function beginEditCell(rowIndex: number, colIndex: number, options?: { preserveSelection?: boolean; initialValue?: string }) {
    const column = gridColumns[colIndex];
    const row = displayRows[rowIndex];
    if (!row || (column?.kind !== "lesson" && column?.kind !== "custom")) return;
    const key = lessonCellKey(row.id, column.id);
    if (!options?.preserveSelection) {
      activeRangeEditRef.current = null;
      setSelectionMode("cell");
      clearStructuredSelection();
      setSelection({ anchor: { rowIndex, colIndex }, cursor: { rowIndex, colIndex } });
    }
    setEditingMetaKey(null);
    if (options?.initialValue !== undefined) setCell(row, column.id, options.initialValue);
    setEditingCellKey(key);
    window.setTimeout(() => {
      const input = inputRefs.current[key];
      input?.focus();
      if (options?.initialValue !== undefined) {
        const length = input?.value.length ?? 0;
        input?.setSelectionRange(length, length);
      } else {
        input?.select();
      }
    }, 0);
  }

  function beginEditGridCell(rowIndex: number, colIndex: number, options?: { preserveSelection?: boolean; initialValue?: string }) {
    const column = gridColumns[colIndex];
    const row = displayRows[rowIndex];
    if (!row || !column || !isEditableGridColumn(column)) return;

    if (column.kind === "lesson" || column.kind === "custom") {
      beginEditCell(rowIndex, colIndex, options);
      return;
    }
    if (!options?.preserveSelection) {
      setSelectionMode("cell");
      clearStructuredSelection();
      setSelection({ anchor: { rowIndex, colIndex }, cursor: { rowIndex, colIndex } });
    }
    if (column.id === "name") {
      setEditingCellKey(null);
      setEditingMetaKey(null);
      if (options?.initialValue !== undefined) {
        setMetaCell(row, "name", options.initialValue);
      } else {
        setNameDrafts((current) => ({ ...current, [row.id]: displayName(row) }));
      }
      setEditingNameId(row.id);
      window.setTimeout(() => {
        const input = nameInputRefs.current[row.id];
        input?.focus();
        if (options?.initialValue !== undefined) {
          const length = input?.value.length ?? 0;
          input?.setSelectionRange(length, length);
        } else {
          input?.select();
        }
      }, 0);
      return;
    }
    if (options?.initialValue !== undefined) {
      const key = lessonCellKey(row.id, column.id);
      setEditingCellKey(null);
      setEditingNameId(null);
      if (column.id === "classGroup") {
        setMetaDrafts((current) => ({ ...current, [key]: options.initialValue ?? "" }));
      } else {
        setMetaCell(row, column.id, options.initialValue);
      }
      setEditingMetaKey(key);
      window.setTimeout(() => {
        const input = metaInputRefs.current[key];
        input?.focus();
        if (input instanceof HTMLInputElement) {
          const length = input.value.length;
          input.setSelectionRange(length, length);
        }
      }, 0);
    } else {
      beginEditMeta(row, column.id);
    }
  }

  function beginDrag(event: MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return;
    event.preventDefault();
    sheetWrapRef.current?.focus();
    if (event.ctrlKey || event.metaKey) {
      toggleCellSelection(rowIndex, colIndex);
      return;
    }
    setIsDragging(true);
    setDragMode("cell");
    setEditingMetaKey(null);
    clearStructuredSelection();
    selectCell(rowIndex, colIndex, event.shiftKey);
  }

  function openContextMenu(event: MouseEvent<HTMLElement>, rowIndex?: number, colIndex?: number, lessonId?: string) {
    if (!lessonId && (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
    event.preventDefault();
    event.stopPropagation();
    sheetWrapRef.current?.focus();
    const column = typeof colIndex === "number" ? gridColumns[colIndex] : null;
    const isHeaderContext = typeof rowIndex !== "number" && typeof colIndex === "number";
    const isRowHeaderContext = typeof rowIndex === "number" && column?.id === "rowNumber";

    if (isHeaderContext && column && isColumnSelectable(column)) {
      if (selectionMode !== "column" || !selectedColumnIdSet.has(column.id)) {
        applyColumnSelection(colIndex, false);
      }
    } else if (isRowHeaderContext) {
      const row = displayRows[rowIndex];
      if (row && (selectionMode !== "row" || !selectedRowIdSet.has(row.id))) {
        applyRowSelection(rowIndex, false);
      }
    } else if (typeof rowIndex === "number" && typeof colIndex === "number") {
      const row = displayRows[rowIndex];
      const isInsideSelectedRow = Boolean(row && selectionMode === "row" && selectedRowIdSet.has(row.id));
      const isInsideSelectedColumn = Boolean(column && selectionMode === "column" && selectedColumnIdSet.has(column.id));
      const isInsideCellSelection =
        selectionMode === "cell" &&
        (isSelected(selection, rowIndex, colIndex) || Boolean(row && column && selectedCellKeySet.has(lessonCellKey(row.id, column.id))));
      if (!isInsideSelectedRow && !isInsideSelectedColumn && !isInsideCellSelection) {
        setSelectionMode("cell");
        clearStructuredSelection();
        setSelection({ anchor: { rowIndex, colIndex }, cursor: { rowIndex, colIndex } });
      }
    }
    setContextMenu({ x: event.clientX, y: event.clientY, rowIndex, colIndex, lessonId });
  }

  function enterDrag(rowIndex: number, colIndex: number) {
    if (!isDragging) return;
    if (dragMode === "row") {
      const anchor = rowDragAnchorRef.current ?? rowIndex;
      const from = Math.min(anchor, rowIndex);
      const to = Math.max(anchor, rowIndex);
      const ids = displayRows.slice(from, to + 1).map((row) => row.id);
      setSelectionMode("row");
      setSelection(null);
      setSelectedColumnIds([]);
      setSelectedRowIds(ids);
      return;
    }
    if (dragMode === "column") {
      const anchor = columnDragAnchorRef.current ?? colIndex;
      if (anchor !== colIndex) suppressNextColumnClickRef.current = true;
      setColumnSelectionRange(anchor, colIndex);
      return;
    }
    setSelection((current) => (current ? { ...current, cursor: { rowIndex, colIndex } } : current));
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    if (!["Enter", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();

    const nextCol =
      event.key === "Tab" && !event.shiftKey
        ? colIndex + 1
        : event.key === "Tab"
          ? colIndex - 1
          : event.key === "ArrowRight"
            ? colIndex + 1
            : event.key === "ArrowLeft"
              ? colIndex - 1
              : colIndex;
    const nextRow =
      event.key === "Enter" && !event.shiftKey
        ? rowIndex + 1
        : event.key === "Enter"
          ? rowIndex - 1
          : event.key === "ArrowDown"
            ? rowIndex + 1
            : event.key === "ArrowUp"
              ? rowIndex - 1
              : rowIndex;
    focusCell(nextRow, nextCol);
  }

  function focusCell(rowIndex: number, colIndex: number) {
    if (rowIndex < 0 || rowIndex >= displayRows.length) return;
    if (colIndex < 0 || colIndex >= gridColumns.length) return;
    const column = gridColumns[colIndex];
    if (!column || !isEditableGridColumn(column)) return;

    activeRangeEditRef.current = null;
    setSelectionMode("cell");
    clearStructuredSelection();
    setSelection({ anchor: { rowIndex, colIndex }, cursor: { rowIndex, colIndex } });
    beginEditGridCell(rowIndex, colIndex);
  }

  function captureRangeEdit(targetCell: { row: StudentSheetRow; columnId: string }, cells: ReturnType<typeof selectedEditableCells>) {
    activeRangeEditRef.current = {
      targetKey: lessonCellKey(targetCell.row.id, targetCell.columnId),
      lessonCells: cells
        .filter((cell) => cell.column.kind === "lesson" || cell.column.kind === "custom")
        .map((cell) => ({ studentId: cell.row.id, columnId: cell.columnId })),
      metaCells: cells.flatMap((cell) => {
        if (cell.column.kind !== "meta") return [];
        return [{ row: cell.row, columnId: cell.column.id }];
      }),
      historyCaptured: false,
    };
  }

  function initialValueFromPrintableKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || event.key === "Process") return undefined;
    if (/^[a-zA-Z]$/.test(event.key)) return undefined;
    return event.key;
  }

  function handleSheetKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    const shortcutPressed = event.ctrlKey || event.metaKey;
    if (shortcutPressed && key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoSheetChange();
      } else {
        undoSheetChange();
      }
      return;
    }
    if (shortcutPressed && key === "y") {
      event.preventDefault();
      redoSheetChange();
      return;
    }
    if (shortcutPressed && key === "s") {
      event.preventDefault();
      if (isPending) return;
      if (!hasPendingChanges) {
        setStatusText("변경 없음");
        return;
      }
      saveChanges();
      return;
    }
    if (shortcutPressed && key === "c" && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      void copySelectionToClipboard();
      return;
    }
    if (shortcutPressed && key === "x" && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      void cutSelectionToClipboard();
      return;
    }
    if (event.target instanceof HTMLInputElement) return;
    const selectedCells = currentEditableCells();
    if (selectedCells.length === 0) return;

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      activeRangeEditRef.current = null;
      applyValueToSelection("");
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const firstCell = selectedCells[0];
      const initialValue = initialValueFromPrintableKey(event);
      if (selectedCells.length > 1) {
        captureRangeEdit(firstCell, selectedCells);
      } else {
        activeRangeEditRef.current = null;
      }
      beginEditGridCell(firstCell.rowIndex, firstCell.colIndex, {
        preserveSelection: selectedCells.length > 1,
        ...(initialValue !== undefined ? { initialValue } : {}),
      });
    }
  }


  function selectedTextMatrix() {
    const matrix = selectedMatrixForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns, readDisplayedCellValue);
    return matrix.length > 0 ? matrix.map((row) => row.join("\t")).join("\n") : "";
  }

  async function copySelectionToClipboard() {
    const text = selectedTextMatrix();
    if (!text) return false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setStatusText("복사됨");
      return true;
    } catch {
      setStatusText("브라우저에서 복사를 허용해주세요. Ctrl+C는 사용할 수 있습니다.");
      return false;
    }
  }

  async function cutSelectionToClipboard() {
    const copied = await copySelectionToClipboard();
    if (!copied) return;
    activeRangeEditRef.current = null;
    applyValueToSelection("");
    setStatusText("잘라냄");
  }

  function handleCopy(event: ClipboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement && event.target.selectionStart !== event.target.selectionEnd) return;
    const text = selectedTextMatrix();
    if (!text) return;

    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
  }

  function pasteTextAtSelection(text: string) {
    const startPoint = selectionStartPointForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns);
    if (!text.trim() || !startPoint) return;

    const startRow = startPoint.rowIndex;
    const startCol = startPoint.colIndex;

    const rowsToPaste = text.replace(/\r/g, "").split("\n").filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
    const nextValues: Record<string, string> = {};
    const nextMetaDrafts: Record<string, string> = {};
    const nextDirtyMetaValues: Record<string, DirtyMetaValue> = {};
    const nextClassGroupDraftIds: Record<string, string> = {};

    rowsToPaste.forEach((line, rowOffset) => {
      const row = displayRows[startRow + rowOffset];
      if (!row) return;

      line.split("\t").forEach((value, colOffset) => {
        const column = gridColumns[startCol + colOffset];
        if (!column || !isEditableGridColumn(column)) return;
        if (column.kind === "lesson" || column.kind === "custom") {
          nextValues[lessonCellKey(row.id, column.id)] = value.slice(0, 500);
        } else {
          queueMetaCellUpdate(row, column.id, value, nextMetaDrafts, nextDirtyMetaValues, nextClassGroupDraftIds);
        }
      });
    });

    if (Object.keys(nextValues).length === 0 && Object.keys(nextMetaDrafts).length === 0) return;

    pushHistory();
    if (Object.keys(nextValues).length > 0) {
      setValues((current) => ({ ...current, ...nextValues }));
      setDirtyValues((current) => ({ ...current, ...nextValues }));
    }
    if (Object.keys(nextMetaDrafts).length > 0) {
      setMetaDrafts((current) => ({ ...current, ...nextMetaDrafts }));
      setDirtyMetaValues((current) => ({ ...current, ...nextDirtyMetaValues }));
      setClassGroupDraftIds((current) => ({ ...current, ...nextClassGroupDraftIds }));
    }
    setStatusText("저장 대기");
    return true;
  }

  async function pasteSelectionFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard API unavailable");
      const text = await navigator.clipboard.readText();
      if (pasteTextAtSelection(text)) setStatusText("붙여넣음");
    } catch {
      setStatusText("브라우저에서 붙여넣기를 허용해주세요.");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.trim() || !selectionStartPointForMode(selectionMode, selection, selectedRowIdSet, selectedColumnIdSet, selectedCellKeySet, displayRows, gridColumns)) return;
    pasteTextAtSelection(text);
    event.preventDefault();
  }

  function buildDraftStudentForm(row: DraftStudentRow) {
    const formData = new FormData();
    const classGroupId = classGroupDraftIds[row.id] ?? row.classGroupId ?? effectiveClassGroupId ?? "";
    formData.set("name", readDisplayedCellValue(row, "name").trim());
    formData.set("phone", readDisplayedCellValue(row, "phone").trim());
    formData.set("parentPhone", readDisplayedCellValue(row, "parentPhone").trim());
    formData.set("schoolName", readDisplayedCellValue(row, "schoolName").trim());
    formData.set("grade", readDisplayedCellValue(row, "grade").trim());
    formData.set("subject", readDisplayedCellValue(row, "subject").trim());
    formData.set("currentLevel", readDisplayedCellValue(row, "currentLevel").trim());
    formData.set("memo", readDisplayedCellValue(row, "memo").trim());
    formData.set("classGroupId", classGroupId);
    return formData;
  }

  function saveChanges() {
    const recordCells: Array<{ studentId: string; date: string; field: LessonFieldId; value: string; examId?: string | null; classTestId?: string; classLessonId?: string; lessonPosition?: number }> = [];
    let hasDirtyTestCell = false;
    const customCells: Array<{ studentId: string; columnId: string; value: string }> = [];
    const metaCells = Object.values(dirtyMetaValues).filter((cell) => !draftStudentIds.has(cell.studentId));
    const shouldSaveLessonConfig = lessonConfigDirty && Boolean(effectiveClassGroupId);

    for (const [key, value] of Object.entries(dirtyValues)) {
      const separator = key.indexOf(":" );
      const studentId = key.slice(0, separator);
      const columnId = key.slice(separator + 1);
      const column = lessonColumnMap.get(columnId);
      if (draftStudentIds.has(studentId)) continue;

      if (column && (column.date || column.field === "test")) {
        if (column.field === "test") {
          hasDirtyTestCell = true;
          if (!column.classTestId) continue;
          recordCells.push({
            studentId,
            date: column.date ?? "",
            field: column.field,
            value,
            examId: column.examId ?? null,
            classTestId: column.classTestId,
            classLessonId: column.lessonId,
            lessonPosition: column.lessonIndex,
          });
          continue;
        }
        if (!column.date) continue;
        recordCells.push({ studentId, date: column.date, field: column.field, value });
      } else if (columnId.startsWith(`ls_${scope}_`)) {
        continue;
      } else {
        customCells.push({ studentId, columnId, value });
      }
    }

    if (hasDirtyTestCell && recordCells.length === 0) {
      setStatusText(effectiveClassGroupId ? "Create or select a test first." : "Select a class first.");
      return;
    }

    if (draftRowsMissingName.length > 0) {
      const firstMissingRow = draftRowsMissingName[0];
      const rowIndex = displayRows.findIndex((row) => row.id === firstMissingRow.id);
      const nameColIndex = gridColumns.findIndex((column) => column.id === "name");
      if (rowIndex >= 0 && nameColIndex >= 0) {
        setSelection({ anchor: { rowIndex, colIndex: nameColIndex }, cursor: { rowIndex, colIndex: nameColIndex } });
        beginEditName(firstMissingRow);
      }
      setStatusText(`신규 행 ${draftRowsMissingName.length}개의 학생명을 입력해주세요.`);
      return;
    }

    if (recordCells.length === 0 && customCells.length === 0 && metaCells.length === 0 && draftRowsReadyToCreate.length === 0 && !shouldSaveLessonConfig) return;
    const recordFormData = new FormData();
    recordFormData.set("cells", JSON.stringify(recordCells));
    recordFormData.set("selectedClassTestId", selectedSingleTest?.id ?? "");
    recordFormData.set("selectedClassGroupId", effectiveClassGroupId ?? "");
    const customFormData = new FormData();
    customFormData.set("cells", JSON.stringify(customCells));
    const lessonFormData = new FormData();
    if (shouldSaveLessonConfig && effectiveClassGroupId) {
      lessonFormData.set("classGroupId", effectiveClassGroupId);
      lessonFormData.set(
        "lessons",
        JSON.stringify(
          lessons.map((lesson) => ({
            title: lessonDisplayLabel(lesson, lessonLabels) || lesson.defaultLabel,
            date: lesson.date ?? "",
            startTime: lesson.startTime ?? "",
            endTime: lesson.endTime ?? "",
            memo: lesson.memo ?? "",
          }))
        )
      );
    }
    setStatusText("저장 중");

    startTransition(() => {
      void (async () => {
        if (shouldSaveLessonConfig) await saveClassLessonConfig(lessonFormData);
        for (const row of draftRowsReadyToCreate) {
          await createStudentFromSheet(buildDraftStudentForm(row));
        }
        if (recordCells.length > 0) await updateStudentLessonCells(recordFormData);
        if (customCells.length > 0) await updateStudentSheetCustomCells(customFormData);
        for (const cell of metaCells) {
          const formData = new FormData();
          formData.set("studentId", cell.studentId);
          if (cell.field === "classGroup") {
            formData.set("classGroupId", cell.value);
            await updateStudentClassGroup(formData);
          } else {
            formData.set("field", cell.field);
            formData.set("value", cell.value);
            await updateStudentSheetCell(formData);
          }
        }
      })()
        .then(() => {
          setDirtyValues({});
          setDirtyMetaValues({});
          setDraftRows((current) => {
            const createdIds = new Set(draftRowsReadyToCreate.map((row) => row.id));
            return current.filter((row) => !createdIds.has(row.id));
          });
          setLessonConfigDirty(false);
          setStatusText("저장됨");
          if (shouldSaveLessonConfig) {
            setExtraLessonCount(0);
            setLessonLabels({});
            setLessonDateOverrides({});
            setLessonTimeOverrides({});
            setLessonMemoOverrides({});
            setInsertedLessons([]);
            setDeletedLessonIds([]);
            setVisibleLessonIds([]);
            setRangeStartLessonId("");
            setRangeEndLessonId("");
          }
          if (shouldSaveLessonConfig || metaCells.length > 0 || draftRowsReadyToCreate.length > 0) router.refresh();
        })
        .catch((error) => {
          setStatusText(error instanceof Error ? error.message : "저장 실패");
        });
    });
  }
  const scheduleSummary = selectedClassGroup
    ? `${selectedClassGroup.startDate || "시작일 없음"} ~ ${selectedClassGroup.endDate || "종료일 없음"} · ${
        selectedClassGroup.daysOfWeek || selectedClassGroup.schedule || "요일 미정"
      }`
    : "반 선택 시 운영기간과 요일 기준으로 차시 자동 생성";
  const sheetHeight = isFullscreen ? "calc(100vh - 138px)" : "100%";
  const sheetZoomFactor = sheetZoom / 100;
  const zoomedTableWidth = zoomDimension(totalTableWidth(gridColumns), sheetZoomFactor);
  const zoomedStyles = buildSheetZoomStyles(sheetZoomFactor);
  const replaceTargetCells = currentEditableCells();
  const replaceScopeLabel =
    selectionMode === "row"
      ? `선택된 행 ${displayRows.filter((row) => selectedRowIdSet.has(row.id)).length}개`
      : selectionMode === "column"
        ? `선택된 열 ${gridColumns.filter((column) => selectedColumnIdSet.has(column.id)).length}개`
        : selectedCellKeySet.size > 0
          ? `선택된 셀 ${selectedCellKeySet.size}개`
          : replaceScopeDescription(selection, displayRows, gridColumns, replaceTargetCells);
  const replacePreviewCount = countReplaceChanges(
    replaceTargetCells,
    replaceFindText,
    replaceWithText,
    replaceCaseSensitive,
    readDisplayedCellValue,
    buildMetaUpdate
  );
  const deletableContextColumn = contextMenu ? contextTargetCustomColumn() : null;
  const insertAfterColumnId = contextMenu ? contextColumnForInsert() : null;
  const hideableContextColumns = contextMenu ? contextColumnsForVisibility() : [];
  const contextLesson = contextMenu ? contextLessonForAction() : null;
  const contextRowsForAction = contextMenu ? selectedRowsForAction() : [];
  const contextHasRowsForAction = contextRowsForAction.length > 0;
  const contextHasPersistedRows = contextRowsForAction.some((row) => !isDraftStudentRow(row));
  const hasClipboardSelection = selectedTextMatrix().length > 0;

  function pushTestSelection(nextTestId: string) {
    const params = new URLSearchParams();
    if (effectiveClassGroupId) params.set("classGroupId", effectiveClassGroupId);
    if (nextTestId) params.set("testId", nextTestId);
    const query = params.toString();
    router.push(query ? "/students?" + query : "/students");
  }

  function closeTestMenu() {
    setTestMenuOpen(false);
    setTestMenuBranch(null);
  }

  function showAllClassTests() {
    setTestViewMode("all");
    setSelectedTestIds([]);
    pushTestSelection(ALL_TESTS_OPTION_ID);
    closeTestMenu();
  }

  function toggleSelectedClassTest(testId: string) {
    setTestViewMode("selected");
    setSelectedTestIds((current) => (current.includes(testId) ? current.filter((id) => id !== testId) : [...current, testId]));
  }

  function selectAllClassTestsForView() {
    setTestViewMode("selected");
    setSelectedTestIds(classTests.map((test) => test.id));
  }

  function clearSelectedClassTestsForView() {
    setTestViewMode("selected");
    setSelectedTestIds([]);
  }

  function openTestManagementPanel(mode: "create" | "manage") {
    closeTestMenu();
    setTestPanelMode(mode);
  }

  return (
    <div style={{ ...shell, ...(isFullscreen ? fullscreenShell : {}) }}>
      <div style={toolbar}>
        <div style={toolbarGroup}>
          <ToolbarIconButton icon="undo" title="되돌리기 (Ctrl+Z)" onClick={undoSheetChange} disabled={!canUndo} />
          <ToolbarIconButton icon="redo" title="다시하기 (Ctrl+Y)" onClick={redoSheetChange} disabled={!canRedo} />
          <ToolbarIconButton icon="save" title="저장" onClick={saveChanges} disabled={isPending || !hasPendingChanges} />
        </div>

        <span style={toolbarDivider} />

        <div style={testToolbar}>
          <div ref={testMenuRef} style={testMenuWrap}>
            <button
              type="button"
              style={{ ...testMenuButton, ...(!effectiveClassGroupId ? disabledTestMenuButton : {}) }}
              onClick={() => {
                if (!effectiveClassGroupId) return;
                setTestMenuOpen((current) => !current);
                setTestMenuBranch("view");
              }}
              disabled={!effectiveClassGroupId}
              aria-haspopup="menu"
              aria-expanded={testMenuOpen}
            >
              {"\uD14C\uC2A4\uD2B8"}
              <span style={testMenuChevron}>{"\u25BE"}</span>
            </button>
            {testMenuOpen ? (
              <div style={testMenuPanel} role="menu">
                <div
                  style={testMenuItemWrap}
                  onMouseEnter={() => setTestMenuBranch("view")}
                  onFocus={() => setTestMenuBranch("view")}
                >
                  <button type="button" style={testMenuItemButton} onClick={() => setTestMenuBranch("view")} role="menuitem">
                    <span>{"\uD14C\uC2A4\uD2B8 \uBCF4\uAE30 \uC124\uC815"}</span>
                    <span style={testMenuArrow}>{"\u203A"}</span>
                  </button>
                  {testMenuBranch === "view" || testMenuBranch === "selectTests" ? (
                    <div style={testSubMenuPanel} role="menu">
                      <button
                        type="button"
                        style={{ ...testSubMenuButton, ...(classTests.length === 0 ? disabledTestSubMenuButton : {}) }}
                        onClick={showAllClassTests}
                        disabled={classTests.length === 0}
                        role="menuitem"
                      >
                        {"\uC804\uCCB4\uBCF4\uAE30"}
                      </button>
                      <div
                        style={testMenuItemWrap}
                        onMouseEnter={() => setTestMenuBranch("selectTests")}
                        onFocus={() => setTestMenuBranch("selectTests")}
                      >
                        <button
                          type="button"
                          style={{ ...testSubMenuButton, ...(classTests.length === 0 ? disabledTestSubMenuButton : {}) }}
                          onClick={() => setTestMenuBranch("selectTests")}
                          disabled={classTests.length === 0}
                          role="menuitem"
                        >
                          <span>{"\uC120\uD0DD \uBCF4\uAE30"}</span>
                          <span style={testMenuArrow}>{"\u203A"}</span>
                        </button>
                        {testMenuBranch === "selectTests" ? (
                          <div style={testChecklistPanel} role="menu">
                            <div style={testChecklistActions}>
                              <button type="button" style={testChecklistMiniButton} onClick={selectAllClassTestsForView}>
                                {"\uC804\uCCB4 \uC120\uD0DD"}
                              </button>
                              <button type="button" style={testChecklistMiniButton} onClick={clearSelectedClassTestsForView}>
                                {"\uC120\uD0DD \uD574\uC81C"}
                              </button>
                            </div>
                            <div style={testChecklistList}>
                              {classTests.map((test) => {
                                const checked = !allTestsSelected && selectedTestIdSet.has(test.id);
                                return (
                                  <label key={test.id} style={{ ...testChecklistLabel, ...(checked ? testChecklistLabelChecked : {}) }}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleSelectedClassTest(test.id)} />
                                    <span style={testChecklistText}>{classTestOptionLabel(test, lessons)}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div
                  style={testMenuItemWrap}
                  onMouseEnter={() => setTestMenuBranch("manage")}
                  onFocus={() => setTestMenuBranch("manage")}
                >
                  <button type="button" style={testMenuItemButton} onClick={() => setTestMenuBranch("manage")} role="menuitem">
                    <span>{"\uD14C\uC2A4\uD2B8 \uCD94\uAC00 \uAD00\uB9AC"}</span>
                    <span style={testMenuArrow}>{"\u203A"}</span>
                  </button>
                  {testMenuBranch === "manage" ? (
                    <div style={testSubMenuPanel} role="menu">
                      <button type="button" style={testSubMenuButton} onClick={() => openTestManagementPanel("create")} role="menuitem">
                        {"\uCD94\uAC00"}
                      </button>
                      <button type="button" style={testSubMenuButton} onClick={() => openTestManagementPanel("manage")} role="menuitem">
                        {"\uAD00\uB9AC"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <span style={testMetaText}>{testViewSummary}</span>
          {classTests.length === 0 && effectiveClassGroupId ? <span style={warningText}>시험 관리에서 먼저 등록하세요.</span> : null}
        </div>

        <span style={toolbarDivider} />

        <div style={zoomControl} aria-label="배율 직접 입력">
          <button type="button" onClick={() => stepSheetZoom(-1)} disabled={sheetZoom <= sheetZoomLevels[0]} className="student-sheet-toolbar-button" style={{ ...toolbarIconButton, ...(sheetZoom <= sheetZoomLevels[0] ? disabledZoomButton : {}) }} title="시트 축소" aria-label="시트 축소">-</button>
          <div style={zoomValueBox} title="배율 직접 입력">
            <input
              value={sheetZoomInput}
              onChange={(event) => setSheetZoomInput(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              onBlur={applySheetZoomInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setSheetZoomInput(String(sheetZoom));
                  event.currentTarget.blur();
                }
              }}
              style={zoomInput}
              aria-label="배율 직접 입력"
              inputMode="numeric"
            />
            <span style={zoomPercentMark}>%</span>
          </div>
          <button type="button" onClick={() => stepSheetZoom(1)} disabled={sheetZoom >= sheetZoomLevels[sheetZoomLevels.length - 1]} className="student-sheet-toolbar-button" style={{ ...toolbarIconButton, ...(sheetZoom >= sheetZoomLevels[sheetZoomLevels.length - 1] ? disabledZoomButton : {}) }} title="시트 확대" aria-label="시트 확대">+</button>
        </div>

        <span style={toolbarDivider} />

        <div ref={columnVisibilityRef} style={columnVisibilityMenuWrap}>
          <ToolbarIconButton icon="columns" title={hiddenColumnCount > 0 ? `열 보기 - 숨김 ${hiddenColumnCount}` : "열 보기"} onClick={() => setColumnVisibilityOpen((current) => !current)} active={hiddenColumnCount > 0 || columnVisibilityOpen} />
          {columnVisibilityOpen && (
            <div style={columnVisibilityPanel} role="menu" aria-label="열 보기">
              <div style={columnVisibilityTitle}>열 보기</div>
              <div style={columnVisibilityList}>
                {hideableColumns.map((column) => {
                  const checked = !hiddenColumnSet.has(column.id);
                  return (
                    <label key={column.id} style={columnVisibilityOption}>
                      <input type="checkbox" checked={checked} onChange={(event) => setColumnVisible(column.id, event.target.checked)} />
                      <span>{columnLabel(column)}</span>
                    </label>
                  );
                })}
              </div>
              <div style={columnVisibilityActions}>
                <button type="button" onClick={showAllColumns} style={smallPanelButton}>전체 보이기</button>
                <button type="button" onClick={resetColumnLayout} style={smallPanelButton}>기본값 복원</button>
              </div>
            </div>
          )}
        </div>

        <ColorPaletteDropdown label="" title="채우기 색상" open={fillPaletteOpen} setOpen={setFillPaletteOpen} currentColor={displayedFormatDraft.fill ?? "#ffffff"} palette={fillPalette} onSelect={(value) => updateFormat({ fill: value })} menuRef={colorMenuRef} />
        <select value={displayedFormatDraft.fontFamily ?? "Arial"} onChange={(event) => updateFormat({ fontFamily: event.target.value })} style={compactSelect} aria-label="글꼴">
          <option value="Arial">Arial</option>
          <option value="Inter">Inter</option>
          <option value="'Noto Sans KR'">Noto Sans KR</option>
          <option value="serif">Serif</option>
          <option value="monospace">Mono</option>
        </select>
        <input type="number" min={10} max={24} value={displayedFormatDraft.fontSize ?? "13"} onChange={(event) => updateFormat({ fontSize: event.target.value })} style={sizeInput} aria-label="글자 크기" />
        <button type="button" onClick={() => updateFormat({ bold: !displayedFormatDraft.bold })} className={displayedFormatDraft.bold ? "student-sheet-toolbar-button is-active" : "student-sheet-toolbar-button"} style={formatButton(displayedFormatDraft.bold)} title="Bold" aria-label="Bold">B</button>
        <button type="button" onClick={() => updateFormat({ italic: !displayedFormatDraft.italic })} className={displayedFormatDraft.italic ? "student-sheet-toolbar-button is-active" : "student-sheet-toolbar-button"} style={formatButton(displayedFormatDraft.italic)} title="Italic" aria-label="Italic">I</button>
        <button type="button" onClick={() => updateFormat({ underline: !displayedFormatDraft.underline })} className={displayedFormatDraft.underline ? "student-sheet-toolbar-button is-active" : "student-sheet-toolbar-button"} style={formatButton(displayedFormatDraft.underline)} title="Underline" aria-label="Underline">U</button>
        <ToolbarIconButton icon="border" title="테두리" onClick={() => updateFormat({ border: !displayedFormatDraft.border })} active={Boolean(displayedFormatDraft.border)} />
        <select value={displayedFormatDraft.align ?? "center"} onChange={(event) => updateFormat({ align: event.target.value as CellStyle["align"] })} style={compactSelect} aria-label="정렬">
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
          <option value="right">오른쪽</option>
        </select>
        <ToolbarIconButton icon="reset" title="선택 서식 초기화" onClick={clearSelectionStyles} />

        <span style={toolbarDivider} />

        <ToolbarIconButton icon="fillDown" title="첫 셀 값으로 채우기" onClick={fillSelectionFromAnchor} />
        <ToolbarIconButton icon="eraser" title="선택 범위 지우기" onClick={() => applyValueToSelection("")} />
        <ToolbarIconButton icon="addLesson" title="차시 추가" onClick={addLesson} />
        <ToolbarIconButton icon="allLessons" title="전체 차시 보기" onClick={() => setVisibleLessonIds(lessons.map((lesson) => lesson.id))} />
        <ToolbarIconButton icon="fullscreen" title={isFullscreen ? "ESC로도 닫을 수 있습니다" : "스프레드시트를 화면 전체로 보기"} onClick={() => setIsFullscreen((current) => !current)} active={isFullscreen} />
        <ToolbarIconButton icon="collapse" title={lessonOnlyView ? "전체 정보 보기" : "차시만 보기"} onClick={() => setLessonOnlyView((current) => !current)} active={lessonOnlyView} />
        <ToolbarIconButton icon="panel" title={lessonPanelOpen ? "차시 선택 닫기" : "차시 선택"} onClick={() => setLessonPanelOpen((current) => !current)} active={lessonPanelOpen} />

        <span style={toolbarDivider} />

        <span style={selectedColumnPill} title={searchTargetLabel}><ToolbarIcon name="search" />{searchTargetLabel}</span>
        <input ref={searchInputRef} value={columnSearch} onChange={(event) => setColumnSearch(event.target.value)} placeholder={hasSelectionSearchScope ? "선택 범위에서 검색" : isGlobalSearchScope ? "전체 검색" : "선택한 열에서 검색"} style={toolbarInput} autoComplete="off" />
        {columnSearch && <ToolbarIconButton icon="eraser" title="검색 지우기" onClick={() => setColumnSearch("")} />}

        <div style={sheetMeta} title={scheduleSummary}>
          <b style={sheetMetaStrong}>{selectedClassGroup ? selectedClassGroup.name : "전체 학생"}</b>
          {changeSummary ? <span>{changeSummary}</span> : null}
        </div>
        <span style={selectionBadge}>{selectionLabel}</span>
        {statusText && <span style={{ ...saveStatus, ...(isPending ? pendingStatus : {}) }}>{statusText}</span>}
      </div>

      <div style={{ ...contentGrid, gridTemplateColumns: lessonPanelOpen ? "minmax(0, 1fr) 232px" : "minmax(0, 1fr)", height: sheetHeight }}>
        <div style={sheetPane}>
          <div
            ref={sheetWrapRef}
            style={sheetWrap}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onKeyDown={handleSheetKeyDown}
            onContextMenu={(event) => openContextMenu(event)}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                clearAllSelection();
                setEditingCellKey(null);
                setEditingNameId(null);
                setEditingMetaKey(null);
              }
            }}
            tabIndex={0}
          >
            <table
              style={{ ...sheetTable, ...zoomedStyles.sheetTable, width: zoomedTableWidth, minWidth: zoomedTableWidth }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  clearAllSelection();
                  setEditingCellKey(null);
                  setEditingNameId(null);
                  setEditingMetaKey(null);
                }
              }}
            >
            <thead>
              <tr>
                {gridColumns.map((column, colIndex) => {
                  const isRowNumberColumn = column.kind === "meta" && column.id === "rowNumber";
                  const isColumnSelected = selectionMode === "column" && selectedColumnIdSet.has(column.id);
                  const isSortColumn = sortColumnId === column.id;
                  const canReorderColumn = isReorderableColumn(column);
                  const isColumnDragSource = columnDrag?.sourceId === column.id;
                  const isColumnDropTarget = columnDrag?.targetId === column.id && columnDrag.sourceId !== column.id;
                  const letterIndex = gridColumns.slice(0, colIndex).filter((item) => !(item.kind === "meta" && item.id === "rowNumber")).length;
                  const letter = isRowNumberColumn ? "" : spreadsheetColumnLabel(letterIndex);

                  return (
                    <th
                      key={`sheet-column-${column.id}`}
                      onMouseEnter={() => {
                        enterColumnDrag(column);
                        if (dragMode === "column") enterDrag(0, colIndex);
                      }}
                      onMouseUp={() => finishColumnDrag(column)}
                      onClick={(event) => {
                        if (isRowNumberColumn) return;
                        if (suppressNextColumnClickRef.current) {
                          suppressNextColumnClickRef.current = false;
                          return;
                        }
                        if (event.shiftKey) {
                          const anchorIndex = columnSelectionAnchorIndex(colIndex);
                          setColumnSelectionRange(anchorIndex, colIndex);
                          return;
                        }
                        selectColumn(colIndex, event.ctrlKey || event.metaKey);
                      }}
                      onDoubleClick={() => {
                        if (!isRowNumberColumn) beginEditColumn(colIndex);
                      }}
                      onContextMenu={(event) => openContextMenu(event, undefined, colIndex)}
                      style={{
                        ...columnLetterTh,
                        ...zoomedStyles.columnLetterTh,
                        ...stickyTop,
                        zIndex: 7,
                        minWidth: zoomDimension(column.width, sheetZoomFactor),
                        width: zoomDimension(column.width, sheetZoomFactor),
                        ...(isColumnSelected ? selectedColumnHeaderStyle : {}),
                        ...(isColumnDragSource ? columnDragSourceTh : {}),
                        ...(isColumnDropTarget ? columnDropTargetTh : {}),
                      }}
                      title={isRowNumberColumn ? "행 번호" : `${letter}열 - 클릭 선택, 더블클릭 전체 편집`}
                    >
                      {isRowNumberColumn ? (
                        <span aria-hidden="true" />
                      ) : (
                        <div style={{ ...columnLetterInner, ...zoomedStyles.columnLetterInner }}>
                          {canReorderColumn ? (
                            <button
                              type="button"
                              data-column-drag-handle="true"
                              onMouseDown={(event) => beginColumnDrag(event, column)}
                              onClick={(event) => event.stopPropagation()}
                              style={{
                                ...columnLetterActionButton,
                                ...(isColumnDragSource ? columnDragHandleActive : {}),
                              }}
                              title={`${letter}열 이동`}
                              aria-label={`${letter}열 이동`}
                            >
                              ||
                            </button>
                          ) : (
                            <span style={columnLetterActionSpacer} aria-hidden="true" />
                          )}
                          <button
                            type="button"
                            onMouseDown={(event) => beginColumnSelect(event, colIndex)}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (suppressNextColumnClickRef.current) {
                                suppressNextColumnClickRef.current = false;
                                return;
                              }
                              selectColumn(colIndex, event.ctrlKey || event.metaKey);
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              beginEditColumn(colIndex);
                            }}
                            style={{
                              ...columnLetterButton,
                              ...(isColumnSelected ? selectedColumnButtonStyle : {}),
                            }}
                            title={`${letter}열 선택`}
                            aria-label={`${letter}열 선택`}
                          >
                            {letter}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSort(column.id);
                            }}
                            style={{ ...subSortButton, ...zoomedStyles.subSortButton, ...(isSortColumn ? subSortButtonActive : {}) }}
                            title={`${letter}열 정렬`}
                            aria-label={`${letter}열 정렬`}
                          >
                            <SortIndicator active={isSortColumn} direction={sortDirection} />
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {/* eslint-disable-next-line react-hooks/refs */}
                {gridColumns.map((column, headerColIndex) =>
                  column.kind === "meta" || column.kind === "custom" ? (() => {
                    const isSortColumn = sortColumnId === column.id;
                    const isEditingCustomColumn = column.kind === "custom" && editingCustomColumnId === column.customColumnId;
                    const canReorderColumn = isReorderableColumn(column);
                    const isColumnDragSource = columnDrag?.sourceId === column.id;
                    const isColumnDropTarget = columnDrag?.targetId === column.id && columnDrag.sourceId !== column.id;
                    return (
                      <th
                        key={column.id}
                        rowSpan={2}
                        onMouseEnter={() => {
                          enterColumnDrag(column);
                          if (dragMode === "column") enterDrag(0, headerColIndex);
                        }}
                        onMouseUp={() => finishColumnDrag(column)}
                        onClick={(event) => {
                          if (suppressNextColumnClickRef.current) {
                            suppressNextColumnClickRef.current = false;
                          }
                          event.stopPropagation();
                        }}
                        onDoubleClick={() => {
                          if (column.kind === "custom") beginEditCustomColumn(column);
                        }}
                        onContextMenu={(event) => openContextMenu(event, undefined, headerColIndex)}
                        style={{
                          ...sheetTh,
                          ...zoomedStyles.sheetTh,
                          ...stickyTop,
                          top: zoomDimension(columnLetterHeaderHeight, sheetZoomFactor),
                          minWidth: zoomDimension(column.width, sheetZoomFactor),
                          width: zoomDimension(column.width, sheetZoomFactor),
                          cursor: "default",
                          ...(isColumnDragSource ? columnDragSourceTh : {}),
                          ...(isColumnDropTarget ? columnDropTargetTh : {}),
                        }}
                        title={canReorderColumn ? `${column.label} 열 선택 / 드래그로 열 위치 교환` : `${column.label} 열 선택`}
                      >
                        <div style={{ ...metaHeaderInner, ...zoomedStyles.metaHeaderInner }}>
                          {false && canReorderColumn && !isEditingCustomColumn ? (
                            <button
                              type="button"
                              data-column-drag-handle="true"
                              onMouseDown={(event) => beginColumnDrag(event, column)}
                              onClick={(event) => event.stopPropagation()}
                              style={{
                                ...columnDragHandle,
                                ...zoomedStyles.columnDragHandle,
                                ...(isColumnDragSource ? columnDragHandleActive : {}),
                              }}
                              title={`${column.label} 열 이동`}
                              aria-label={`${column.label} 열 이동`}
                            >
                              ⋮⋮
                            </button>
                          ) : (
                            <span style={{ ...columnDragHandleSpacer, ...zoomedStyles.columnDragHandle }} aria-hidden="true" />
                          )}
                          {isEditingCustomColumn && column.kind === "custom" && (
                            <input
                              value={customColumnDrafts[column.customColumnId] ?? column.label}
                              onChange={(event) => setCustomColumnDrafts((current) => ({ ...current, [column.customColumnId]: event.target.value }))}
                              onBlur={() => saveCustomColumnName(column.customColumnId)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") saveCustomColumnName(column.customColumnId);
                                if (event.key === "Escape") setEditingCustomColumnId(null);
                              }}
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              style={{ ...customHeaderInput, ...zoomedStyles.metaHeaderButton }}
                              autoFocus
                              autoComplete="off"
                              aria-label="커스텀 열 이름"
                            />
                          )}
                          <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            style={{
                              ...metaHeaderButton,
                              ...zoomedStyles.metaHeaderButton,
                              cursor: "default",
                              ...(isEditingCustomColumn ? hiddenHeaderButton : {}),
                            }}
                            title={`${column.label} 열 검색`}
                          >
                            {column.label}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            style={{ ...subSortButton, ...zoomedStyles.subSortButton, ...(isSortColumn ? subSortButtonActive : {}), display: "none" }}
                            title={`${column.label} 정렬`}
                            aria-label={`${column.label} 정렬`}
                          >
                            <SortIndicator active={isSortColumn} direction={sortDirection} />
                          </button>
                        </div>
                      </th>
                    );
                  })() : null
                )}
                {renderedVisibleLessons.map((lesson) => {
                  const label = lessonDisplayLabel(lesson, lessonLabels);
                  return (
                    <th
                      key={lesson.id}
                      colSpan={lessonColumnsByLessonId.get(lesson.id)?.length ?? 1}
                      onContextMenu={(event) => openContextMenu(event, undefined, undefined, lesson.id)}
                      style={{
                        ...lessonGroupTh,
                        ...zoomedStyles.lessonGroupTh,
                        ...stickyTop,
                        top: zoomDimension(columnLetterHeaderHeight, sheetZoomFactor),
                      }}
                    >
                      <div style={{ ...lessonHeaderTop, ...zoomedStyles.lessonHeaderTop }}>
                        <input
                          value={label}
                          onChange={(event) => updateLessonLabel(lesson.id, event.target.value)}
                          style={{ ...lessonNameInput, ...zoomedStyles.lessonNameInput }}
                          aria-label={`${lesson.defaultLabel} 이름`}
                        />
                      </div>
                      <div style={{ ...lessonDateLine, ...zoomedStyles.lessonDateLine }}>
                        <input
                          type="text"
                          value={lesson.date ?? ""}
                          onChange={(event) => updateLessonDate(lesson.id, event.target.value)}
                          style={{ ...lessonDateInput, ...zoomedStyles.lessonDateInput }}
                          placeholder="YYYY-MM-DD"
                          aria-label={`${label || lesson.defaultLabel} 날짜`}
                          onMouseDown={(event) => event.stopPropagation()}
                          autoComplete="off"
                        />
                        <input
                          type="text"
                          value={lesson.startTime ?? ""}
                          onChange={(event) => updateLessonTime(lesson.id, "startTime", event.target.value)}
                          style={{ ...lessonTimeInput, ...zoomedStyles.lessonTimeInput }}
                          placeholder="시작"
                          aria-label={`${label || lesson.defaultLabel} 시작 시간`}
                          onMouseDown={(event) => event.stopPropagation()}
                          autoComplete="off"
                        />
                        <span style={{ ...lessonTimeSeparator, ...zoomedStyles.lessonTimeSeparator }}>~</span>
                        <input
                          type="text"
                          value={lesson.endTime ?? ""}
                          onChange={(event) => updateLessonTime(lesson.id, "endTime", event.target.value)}
                          style={{ ...lessonTimeInput, ...zoomedStyles.lessonTimeInput }}
                          placeholder="종료"
                          aria-label={`${label || lesson.defaultLabel} 종료 시간`}
                          onMouseDown={(event) => event.stopPropagation()}
                          autoComplete="off"
                        />
                      </div>
                      <div style={{ ...lessonMemoRow, ...zoomedStyles.lessonMemoRow }}>
                        <span style={{ ...lessonMemoLabel, ...zoomedStyles.lessonMemoLabel }}>진도</span>
                        <input
                          value={lesson.memo ?? ""}
                          onChange={(event) => updateLessonMemo(lesson.id, event.target.value)}
                          style={{ ...lessonMemoInput, ...zoomedStyles.lessonMemoInput }}
                          placeholder="진도/메모 입력"
                          aria-label={`${label || lesson.defaultLabel} 차시 메모`}
                          onMouseDown={(event) => event.stopPropagation()}
                          autoComplete="off"
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {renderedVisibleLessons.flatMap((lesson) =>
                  (lessonColumnsByLessonId.get(lesson.id) ?? []).map((column) => {
                    const subColumnId = column.id;
                    const isSortColumn = sortColumnId === subColumnId;
                    return (
                      <th
                        key={subColumnId}
                        style={{
                          ...sheetSubTh,
                          ...zoomedStyles.sheetSubTh,
                          top: zoomDimension(columnLetterHeaderHeight + lessonHeaderStickyTop, sheetZoomFactor),
                          minWidth: zoomDimension(column.width, sheetZoomFactor),
                          width: zoomDimension(column.width, sheetZoomFactor),
                        }}
                      >
                        <div style={{ ...subHeaderInner, ...zoomedStyles.subHeaderInner }}>
                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            style={{ ...subHeaderButton, ...zoomedStyles.subHeaderButton, cursor: "default" }}
                            title={`${column.groupLabel} ${column.label}`}
                          >
                            {column.label}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            style={{ ...subSortButton, ...zoomedStyles.subSortButton, ...(isSortColumn ? subSortButtonActive : {}), display: "none" }}
                            title={`${column.groupLabel} ${column.label} 정렬`}
                            aria-label={`${column.groupLabel} ${column.label} 정렬`}
                          >
                            <SortIndicator active={isSortColumn} direction={sortDirection} />
                          </button>
                        </div>
                      </th>
                    );
                  })
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, rowIndex) => {
                const isSelectedRow = selectionMode === "row" && selectedRowIdSet.has(row.id);
                return (
                <tr key={row.id} style={{ ...(isDraftStudentRow(row) ? draftRowStyle : {}), ...(isSelectedRow ? selectedRowStyle : {}) }}>
                  {gridColumns.map((column, colIndex) => {
                    const cellKey = lessonCellKey(row.id, column.id);
                    const selected = selectionMode === "cell" && (isSelected(selection, rowIndex, colIndex) || selectedCellKeySet.has(cellKey));
                    const isSelectedColumn = selectionMode === "column" && selectedColumnIdSet.has(column.id);

                    if (column.kind === "meta") {
                      const isRowNumberCell = column.id === "rowNumber";
                      const isNameCell = column.id === "name";
                      const key = cellKey;
                      const isClassGroupCell = column.id === "classGroup";
                      const canEditMeta = !isRowNumberCell;
                      const isDraftRow = isDraftStudentRow(row);
                      const value = isRowNumberCell ? (isDraftRow ? "신규" : String(rowIndex + 1)) : editableMetaValue(row, column.id as EditableMetaColumnId);
                      const isEditingName = isNameCell && editingNameId === row.id;
                      const isEditingMeta = !isNameCell && canEditMeta && editingMetaKey === key;
                      const localStyle = cellStyles[key] ?? {};
                      const displayValue =
                        isRowNumberCell && isDraftRow ? (
                          <span style={draftRowBadge}>신규</span>
                        ) : isNameCell && isDraftRow && !value ? (
                          <span style={draftNamePlaceholder}>학생명 입력</span>
                        ) : (
                          value
                        );
                      return (
                        <td
                          key={column.id}
                          onMouseDown={(event) => {
                            if (isEditingName || isEditingMeta) return;
                            if (isRowNumberCell) {
                              beginRowDrag(event, rowIndex);
                            } else {
                              beginDrag(event, rowIndex, colIndex);
                            }
                          }}
                          onDoubleClick={() => {
                            beginEditMeta(row, column.id);
                          }}
                          onContextMenu={(event) => openContextMenu(event, rowIndex, colIndex)}
                          onMouseEnter={() => enterDrag(rowIndex, colIndex)}
                          style={{
                            ...metaTd,
                            ...zoomedStyles.metaTd,
                            ...styleToCss(localStyle, sheetZoomFactor),
                            ...(isRowNumberCell ? rowHeaderTd : {}),
                            ...(isDraftRow ? draftCellStyle : {}),
                            ...(isDraftRow && isRowNumberCell ? draftRowHeaderTd : {}),
                            ...(isSelectedRow ? selectedRowCellStyle : {}),
                            ...(isSelectedColumn ? selectedColumnCellStyle : {}),
                            ...(canEditMeta ? clickableMetaTd : {}),
                            ...(selected ? selectedCell : {}),
                            ...(rangeMatchKeys.has(key) ? matchedCell : {}),
                          }}
                          title={isRowNumberCell ? "클릭/드래그: 학생 행 전체 선택" : "드래그: 선택 / 더블클릭: 수정"}
                        >
                          {isEditingName ? (
                            <input
                              ref={(node) => {
                                nameInputRefs.current[row.id] = node;
                              }}
                              value={nameDrafts[row.id] ?? row.name}
                              onChange={(event) => setMetaCell(row, "name", event.target.value)}
                              onBlur={() => {
                                activeRangeEditRef.current = null;
                                if (suppressBlurSaveRef.current) {
                                  setEditingNameId(null);
                                  return;
                                }
                                finishNameEdit(row);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  activeRangeEditRef.current = null;
                                  finishNameEdit(row);
                                }
                                if (event.key === "Escape") setEditingNameId(null);
                              }}
                              style={{ ...nameEditInput, ...zoomedStyles.nameEditInput }}
                              placeholder={isDraftRow ? "학생명 입력" : undefined}
                              autoComplete="off"
                              disabled={isPending}
                              aria-label={`${displayName(row) || "신규 학생"} 학생명`}
                            />
                          ) : isEditingMeta && isClassGroupCell ? (
                            <>
                              <input
                                ref={(node) => {
                                  metaInputRefs.current[key] = node;
                                }}
                                value={metaDrafts[key] ?? metaCellValue(row, "classGroup")}
                                onChange={(event) => setClassGroupTextDraft(row, event.target.value)}
                                onBlur={() => {
                                  finishClassGroupTextEdit(row);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    finishClassGroupTextEdit(row);
                                  }
                                  if (event.key === "Escape") cancelMetaEdit(row, "classGroup");
                                }}
                                onClick={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                                list="student-sheet-class-group-options"
                                style={{ ...nameEditInput, ...zoomedStyles.nameEditInput }}
                                autoComplete="off"
                                disabled={isPending}
                                aria-label={`${row.name} 반`}
                              />
                              <datalist id="student-sheet-class-group-options">
                                <option value="-" />
                                {classGroups.map((option) => (
                                  <option key={option.id} value={option.teacherName ? `${option.teacherName} / ${option.name}` : option.name} />
                                ))}
                              </datalist>
                            </>
                          ) : isEditingMeta ? (
                            <input
                              ref={(node) => {
                                metaInputRefs.current[key] = node;
                              }}
                              value={metaDrafts[key] ?? value}
                              onChange={(event) => setMetaCell(row, column.id as Exclude<EditableMetaColumnId, "classGroup">, event.target.value)}
                              onBlur={() => {
                                activeRangeEditRef.current = null;
                                if (suppressBlurSaveRef.current) {
                                  setEditingMetaKey(null);
                                  return;
                                }
                                finishMetaTextEdit(row, column.id as Exclude<EditableMetaColumnId, "classGroup">);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  activeRangeEditRef.current = null;
                                  finishMetaTextEdit(row, column.id as Exclude<EditableMetaColumnId, "classGroup">);
                                }
                                if (event.key === "Escape") cancelMetaEdit(row, column.id as EditableMetaColumnId);
                              }}
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              style={{ ...nameEditInput, ...zoomedStyles.nameEditInput }}
                              autoComplete="off"
                              disabled={isPending}
                              aria-label={`${row.name} ${column.label}`}
                            />
                          ) : (
                            displayValue
                          )}
                        </td>
                      );
                    }

                    const key = cellKey;
                    const value = getCell(row, column.id);
                    const cellLabel = column.kind === "lesson" ? `${column.groupLabel} ${column.label}` : column.label;
                    const localStyle = cellStyles[key] ?? {};
                    const isDirty = key in dirtyValues;
                    const isRangeMatch = rangeMatchKeys.has(key);
                    const isEditing = editingCellKey === key;

                    return (
                      <td
                        key={column.id}
                        onMouseDown={(event) => beginDrag(event, rowIndex, colIndex)}
                        onDoubleClick={() => beginEditCell(rowIndex, colIndex)}
                        onContextMenu={(event) => openContextMenu(event, rowIndex, colIndex)}
                        onMouseEnter={() => enterDrag(rowIndex, colIndex)}
                        style={{
                          ...lessonTd,
                          ...zoomedStyles.lessonTd,
                          ...styleToCss(localStyle, sheetZoomFactor),
                          ...(isDraftStudentRow(row) ? draftCellStyle : {}),
                          ...(isSelectedRow ? selectedRowCellStyle : {}),
                          ...(isSelectedColumn ? selectedColumnCellStyle : {}),
                          ...(selected ? selectedCell : {}),
                          ...(isRangeMatch ? matchedCell : {}),
                          ...(isDirty ? dirtyCell : {}),
                        }}
                        title="한 번 클릭/드래그: 선택 / 더블클릭: 수정"
                      >
                        {isEditing ? (
                          <input
                              ref={(node) => {
                                inputRefs.current[key] = node;
                              }}
                            value={value}
                            onChange={(event) => setCell(row, column.id, event.target.value)}
                            autoComplete="off"
                            onBlur={() => {
                              activeRangeEditRef.current = null;
                              setEditingCellKey(null);
                            }}
                            onKeyDown={(event) => onCellKeyDown(event, rowIndex, colIndex)}
                            style={{ ...cellInput, ...zoomedStyles.cellInput, textAlign: localStyle.align ?? "center" }}
                            disabled={isPending}
                            aria-label={`${row.name} ${cellLabel}`}
                          />
                        ) : (
                          <div style={{ ...cellDisplay, ...zoomedStyles.cellDisplay, textAlign: localStyle.align ?? "center" }}>{value}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}

              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={gridColumns.length} style={emptyTd}>표시할 학생이 없습니다.</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
          <div style={sheetBottomBar}>
            <Link href="/classes/new" style={sheetTabIconButton} title="반 추가" aria-label="반 추가">+</Link>
            <Link href="/classes" style={sheetTabIconButton} title="반 관리" aria-label="반 관리">{"\u2630"}</Link>
            <nav style={sheetTabs} aria-label="반 시트 탭">
              <Link href="/students?classGroupId=all" style={{ ...sheetTab, ...(!effectiveClassGroupId ? sheetTabActive : {}) }}>
                전체 학생
              </Link>
              {classGroups.map((classGroup) => (
                <Link
                  key={classGroup.id}
                  href={`/students?classGroupId=${encodeURIComponent(classGroup.id)}`}
                  style={{ ...sheetTab, ...(effectiveClassGroupId === classGroup.id ? sheetTabActive : {}) }}
                  title={classGroup.teacherName ? classGroup.teacherName + " / " + classGroup.name : classGroup.name}
                >
                  {classGroup.name}
                </Link>
              ))}
            </nav>
            <span style={sheetBottomStatus}>{visibleLessons.length}차시</span>
          </div>
        </div>
        {lessonPanelOpen && (
          <aside style={{ ...lessonPanel, height: sheetHeight, maxHeight: sheetHeight }}>
            <div style={panelHead}>
                <b>차시 선택</b>
                <button type="button" onClick={() => setLessonPanelOpen(false)} style={panelCloseButton} aria-label="차시 선택 닫기">×</button>
            </div>

            <div style={rangeButtons}>
              <button
                type="button"
                onClick={() => setVisibleLessonIds(lessons.map((lesson) => lesson.id))}
                style={{ ...panelButton, ...(isAllLessonsVisible ? panelButtonActive : {}) }}
              >
                  전체
              </button>
              <button type="button" onClick={() => showLessonRange(1, 5)} style={panelButton}>1-5</button>
              <button type="button" onClick={() => showLessonRange(6, 10)} style={panelButton}>6-10</button>
              <button type="button" onClick={() => showLessonRange(11, 15)} style={panelButton}>11-15</button>
            </div>

            <div style={panelSection}>
                <span style={panelSectionTitle}>범위 지정</span>
              <div style={panelRangeRow}>
                <select
                  value={rangeStartId}
                  onChange={(event) => setRangeStartLessonId(event.target.value)}
                  style={panelSelect}
                    aria-label="시작 차시"
                >
                  {lessons.map((lesson, index) => (
                    <option key={lesson.id} value={lesson.id}>
                      {index + 1}. {lessonDisplayLabel(lesson, lessonLabels) || lesson.defaultLabel}
                    </option>
                  ))}
                </select>
                <span>-</span>
                <select
                  value={rangeEndId}
                  onChange={(event) => setRangeEndLessonId(event.target.value)}
                  style={panelSelect}
                    aria-label="끝 차시"
                >
                  {lessons.map((lesson, index) => (
                    <option key={lesson.id} value={lesson.id}>
                      {index + 1}. {lessonDisplayLabel(lesson, lessonLabels) || lesson.defaultLabel}
                    </option>
                  ))}
                </select>
              </div>
                <button type="button" onClick={() => showLessonRangeByIds(rangeStartId, rangeEndId)} style={panelApplyButton}>범위 보기</button>
            </div>

            <div style={lessonList}>
              {lessons.map((lesson) => {
                const checked = activeVisibleLessonIds.includes(lesson.id);
                const label = lessonDisplayLabel(lesson, lessonLabels) || lesson.defaultLabel;
                return (
                  <label key={lesson.id} style={{ ...lessonToggle, ...(checked ? lessonToggleChecked : {}) }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleLesson(lesson.id)} />
                    <span style={lessonToggleText}>{label}</span>
                      <small style={lessonToggleDate}>{lesson.dateLabel || "날짜 미정"}</small>
                  </label>
                );
              })}
            </div>
          </aside>
        )}
        {testPanelMode && selectedClassGroup ? (
          <TestManagementPanel
            mode={testPanelMode}
            classGroup={selectedClassGroup}
            classTests={classTests}
            lessons={lessons}
            lessonLabels={lessonLabels}
            onClose={() => setTestPanelMode(null)}
          />
        ) : null}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            style={{ ...contextMenuPanel, left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
            role="menu"
            aria-label="셀 작업 메뉴"
          >
            <button
              type="button"
              style={{ ...contextMenuItem, ...(!hasClipboardSelection ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                void cutSelectionToClipboard();
              }}
              disabled={!hasClipboardSelection}
            >
              <span>잘라내기</span>
              <span style={contextMenuShortcut}>Ctrl+X</span>
            </button>
            <button
              type="button"
              style={{ ...contextMenuItem, ...(!hasClipboardSelection ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                void copySelectionToClipboard();
              }}
              disabled={!hasClipboardSelection}
            >
              <span>복사</span>
              <span style={contextMenuShortcut}>Ctrl+C</span>
            </button>
            <button
              type="button"
              style={{ ...contextMenuItem, ...(!hasClipboardSelection ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                void pasteSelectionFromClipboard();
              }}
              disabled={!hasClipboardSelection}
            >
              <span>붙여넣기</span>
              <span style={contextMenuShortcut}>Ctrl+V</span>
            </button>
            <button
              type="button"
              style={{ ...contextMenuItem, ...(replaceTargetCells.length === 0 ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                openReplaceDialog();
              }}
              disabled={replaceTargetCells.length === 0}
            >
              <span>바꾸기</span>
              <span style={contextMenuShortcut}>선택 범위</span>
            </button>
            <div style={contextMenuSeparator} />
            <button
              type="button"
              style={contextMenuItem}
              onClick={() => {
                setContextMenu(null);
                addDraftRowFromContext();
              }}
            >
              <span>행 추가</span>
              <span style={contextMenuShortcut}>빈 학생 행</span>
            </button>
            {contextLesson ? (
              <>
                <div style={contextMenuSeparator} />
                <button
                  type="button"
                  style={contextMenuItem}
                  onClick={() => {
                    insertLessonBefore(contextLesson.id);
                    setContextMenu(null);
                  }}
                >
                  <span>왼쪽에 차시 추가</span>
                  <span style={contextMenuShortcut}>추가된 차시</span>
                </button>
                <button
                  type="button"
                  style={contextMenuItem}
                  onClick={() => {
                    insertLessonAfter(contextLesson.id);
                    setContextMenu(null);
                  }}
                >
                  <span>오른쪽에 차시 추가</span>
                  <span style={contextMenuShortcut}>추가된 차시</span>
                </button>
                <button
                  type="button"
                  style={{ ...contextMenuItem, ...contextMenuDangerItem, ...(lessons.length <= 1 ? disabledContextMenuItem : {}) }}
                  onClick={() => {
                    setContextMenu(null);
                    deleteLesson(contextLesson.id);
                  }}
                  disabled={lessons.length <= 1}
                >
                  <span>차시 삭제</span>
                  <span style={contextMenuShortcut}>{lessons.length <= 1 ? "삭제 불가" : "선택 차시"}</span>
                </button>
              </>
            ) : null}
            <div style={contextMenuSeparator} />
            <button
              type="button"
              style={contextMenuItem}
              onClick={() => {
                setContextMenu(null);
                addCustomColumn(insertAfterColumnId);
              }}
            >
              <span>커스텀 열 추가</span>
              <span style={contextMenuShortcut}>더블클릭으로 이름 변경</span>
            </button>
            <button
              type="button"
              style={{ ...contextMenuItem, ...(hideableContextColumns.length === 0 ? disabledContextMenuItem : {}) }}
              onClick={hideContextColumns}
              disabled={hideableContextColumns.length === 0}
              title={hideableContextColumns.length > 0 ? "선택한 학생 정보 열을 숨깁니다." : "필수 열 또는 차시 열은 숨길 수 없습니다."}
            >
              <span>열 숨기기</span>
              <span style={contextMenuShortcut}>{hideableContextColumns.length > 0 ? `${hideableContextColumns.length}개` : "숨김 불가"}</span>
            </button>
            <button
              type="button"
              style={{ ...contextMenuItem, ...(hiddenColumnIds.length === 0 ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                showAllColumns();
              }}
              disabled={hiddenColumnIds.length === 0}
            >
              <span>열 전부 보이기</span>
              <span style={contextMenuShortcut}>{hiddenColumnIds.length > 0 ? `${hiddenColumnIds.length}개` : "숨김 없음"}</span>
            </button>
            <button
              type="button"
              style={{ ...contextMenuItem, ...contextMenuDangerItem, ...(!deletableContextColumn ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                deleteCustomColumn(deletableContextColumn);
              }}
              disabled={!deletableContextColumn}
              title={deletableContextColumn ? "추가한 커스텀 열만 삭제할 수 있습니다." : "기본 학생 정보 열은 삭제할 수 없습니다."}
            >
              <span>커스텀 열 삭제</span>
              <span style={contextMenuShortcut}>{deletableContextColumn ? "추가한 열만" : "기본 정보 열 삭제 불가"}</span>
            </button>
            <div style={contextMenuSeparator} />
            <button
              type="button"
              style={{ ...contextMenuItem, ...contextMenuDangerItem, ...(!contextHasRowsForAction ? disabledContextMenuItem : {}) }}
              onClick={() => {
                setContextMenu(null);
                deleteSelectedStudents();
              }}
              disabled={!contextHasRowsForAction}
            >
              <span>{contextHasPersistedRows ? "학생 삭제" : "신규 행 삭제"}</span>
              <span style={contextMenuShortcut}>{contextHasPersistedRows ? "실제 학생 기록 삭제" : "저장 전 행 제거"}</span>
            </button>
          </div>
        )}
        {replaceDialogOpen && (
          <div style={replaceModalOverlay} role="dialog" aria-modal="true" aria-label="선택 범위 바꾸기">
            <div style={replaceModal}>
              <header style={replaceModalHeader}>
                <div>
                  <h2 style={replaceModalTitle}>선택 범위 바꾸기</h2>
                  <p style={replaceModalDesc}>적용 범위: {replaceScopeLabel}</p>
                </div>
                <button type="button" onClick={() => setReplaceDialogOpen(false)} style={replaceCloseButton} aria-label="닫기">
                  ×
                </button>
              </header>
              <div style={replaceModalBody}>
                <label style={replaceLabel}>
                  찾을 내용
                  <input
                    value={replaceFindText}
                    onChange={(event) => setReplaceFindText(event.target.value)}
                    style={replaceInput}
                    autoFocus
                    placeholder="예: 영상"
                  />
                </label>
                <label style={replaceLabel}>
                  바꿀 내용
                  <input
                    value={replaceWithText}
                    onChange={(event) => setReplaceWithText(event.target.value)}
                    style={replaceInput}
                    placeholder="빈 값이면 삭제"
                  />
                </label>
                <label style={replaceCheckLabel}>
                  <input
                    type="checkbox"
                    checked={replaceCaseSensitive}
                    onChange={(event) => setReplaceCaseSensitive(event.target.checked)}
                  />
                  대소문자 구분
                </label>
                <div style={replacePreviewBox}>
                  {replaceFindText ? (
                    replacePreviewCount > 0 ? (
                      <span>총 {replacePreviewCount}개 셀이 변경됩니다.</span>
                    ) : (
                      <span>변경할 내용이 없습니다.</span>
                    )
                  ) : (
                    <span>찾을 내용을 입력해주세요.</span>
                  )}
                </div>
              </div>
              <footer style={replaceModalFooter}>
                <button type="button" onClick={() => setReplaceDialogOpen(false)} style={replaceSecondaryButton}>
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyReplaceToSelection}
                  disabled={!replaceFindText || replacePreviewCount === 0}
                  style={{ ...replacePrimaryButton, ...(!replaceFindText || replacePreviewCount === 0 ? replaceDisabledButton : {}) }}
                >
                  바꾸기
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function TestManagementPanel({
  mode,
  classGroup,
  classTests,
  lessons,
  lessonLabels,
  onClose,
}: {
  mode: "create" | "manage";
  classGroup: LessonClassGroupOption;
  classTests: ClassTestExamOption[];
  lessons: Lesson[];
  lessonLabels: Record<string, string>;
  onClose: () => void;
}) {
  const [createType, setCreateType] = useState<"REGULAR" | "SINGLE">("REGULAR");
  const activeLessons = lessons.filter((lesson) => !lesson.id.startsWith("draft_"));

  return (
    <div
      style={testPanelOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "\uC2DC\uD5D8 \uCD94\uAC00" : "\uC2DC\uD5D8 \uAD00\uB9AC"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside style={testPanelModal}>
        <div style={testPanelHeader}>
          <div>
            <b>{mode === "create" ? "\uC2DC\uD5D8 \uCD94\uAC00" : "\uC2DC\uD5D8 \uAD00\uB9AC"}</b>
            <div style={testPanelSubText}>{classGroup.name}</div>
          </div>
          <button type="button" onClick={onClose} style={testPanelCloseButton} aria-label="\uB2EB\uAE30">{"\u00D7"}</button>
        </div>

        {mode === "create" ? (
          <section style={testPanelSection}>
            <b>{"\uC2DC\uD5D8 \uB4F1\uB85D"}</b>
            <form action={createClassTestAction} style={testPanelForm}>
              <input type="hidden" name="classGroupId" value={classGroup.id} />
              <label style={testPanelLabel}>
                {"\uC2DC\uD5D8\uBA85"}
                <input name="name" required maxLength={80} style={testPanelInput} />
              </label>
              <label style={testPanelLabel}>
                {"\uC2DC\uD5D8 \uC885\uB958"}
                <select name="type" value={createType} onChange={(event) => setCreateType(event.target.value as "REGULAR" | "SINGLE")} style={testPanelInput}>
                  <option value="REGULAR">{"\uC815\uAE30 \uC2DC\uD5D8"}</option>
                  <option value="SINGLE">{"\uB2E8\uC77C \uC2DC\uD5D8"}</option>
                </select>
              </label>
              <label style={testPanelLabel}>
                {"\uC5F0\uACB0 \uCC28\uC2DC"}
                <select name="lessonId" disabled={createType !== "SINGLE"} required={createType === "SINGLE"} style={testPanelInput}>
                  <option value="">{createType === "SINGLE" ? "\uCC28\uC2DC \uC120\uD0DD" : "\uC815\uAE30 \uC2DC\uD5D8\uC740 \uC804\uCCB4 \uCC28\uC2DC"}</option>
                  {activeLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lessonOptionLabel(lesson, lessonLabels)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" style={primaryButton}>{"\uB4F1\uB85D"}</button>
            </form>
          </section>
        ) : (
          <section style={testPanelSection}>
            <b>{"\uB4F1\uB85D\uB41C \uC2DC\uD5D8"}</b>
            {classTests.length === 0 ? <p style={testPanelSubText}>{"\uC544\uC9C1 \uB4F1\uB85D\uB41C \uC2DC\uD5D8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</p> : null}
            <div style={testPanelList}>
              {classTests.map((test) => (
                <div key={test.id} style={testPanelItem}>
                  <form action={updateClassTestAction} style={testPanelForm}>
                    <input type="hidden" name="classGroupId" value={classGroup.id} />
                    <input type="hidden" name="classTestId" value={test.id} />
                    <div style={testPanelItemTop}>
                      <span style={testTypeBadge}>{test.type === "REGULAR" ? "\uC815\uAE30" : "\uB2E8\uC77C"}</span>
                      <span style={testPanelSubText}>{classTestPanelSummaryLabel(test, activeLessons)}</span>
                    </div>
                    <input name="name" defaultValue={test.name} maxLength={80} required style={testPanelInput} />
                    <div style={testPanelInlineFields}>
                      <select name="type" defaultValue={test.type} style={testPanelInput}>
                        <option value="REGULAR">{"\uC815\uAE30 \uC2DC\uD5D8"}</option>
                        <option value="SINGLE">{"\uB2E8\uC77C \uC2DC\uD5D8"}</option>
                      </select>
                      <select name="lessonId" defaultValue={test.classLessonId ?? lessonIdForPosition(activeLessons, test.lessonPosition) ?? ""} style={testPanelInput}>
                        <option value="">{"\uC815\uAE30/\uBBF8\uC9C0\uC815"}</option>
                        {activeLessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {lessonOptionLabel(lesson, lessonLabels)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label style={testPanelCheckboxLabel}>
                      <input type="checkbox" name="active" value="1" defaultChecked={test.active !== false} />
                      {"\uC0AC\uC6A9"}
                    </label>
                    <button type="submit" style={panelButton}>{"\uC218\uC815"}</button>
                  </form>
                  <form action={deactivateClassTestAction}>
                    <input type="hidden" name="classGroupId" value={classGroup.id} />
                    <input type="hidden" name="classTestId" value={test.id} />
                    <button type="submit" style={dangerPanelButton} onClick={(event) => { if (!window.confirm("\uC774 \uD14C\uC2A4\uD2B8\uB97C \uC0AD\uC81C\uD560\uAE4C\uC694?")) event.preventDefault(); }}>
                      {"\uC0AD\uC81C"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

function lessonOptionLabel(lesson: Lesson, labels: Record<string, string>) {
  const label = lessonDisplayLabel(lesson, labels) || lesson.defaultLabel;
  const date = lesson.date ?? lesson.dateLabel ?? "\uB0A0\uC9DC \uBBF8\uC815";
  return String(lesson.index) + "\uCC28\uC2DC " + label + " / " + date;
}

function lessonIdForPosition(lessons: Lesson[], position?: number | null) {
  if (!position) return "";
  return lessons.find((lesson) => lesson.index === position)?.id ?? "";
}

function linkedLessonForClassTest(test: ClassTestExamOption, lessons: Lesson[]) {
  return (
    (test.classLessonId ? lessons.find((lesson) => lesson.id === test.classLessonId) ?? null : null) ??
    (test.lessonPosition ? lessons.find((lesson) => lesson.index === test.lessonPosition) ?? null : null) ??
    null
  );
}

function classTestDateLabel(test: ClassTestExamOption, lessons: Lesson[]) {
  const lesson = linkedLessonForClassTest(test, lessons);
  const examDate = test.exams.find((exam) => exam.examDate)?.examDate?.slice(0, 10) ?? null;
  return lesson?.date ?? examDate ?? "\uB0A0\uC9DC \uBBF8\uC815";
}

function classTestOptionLabel(test: ClassTestExamOption, lessons: Lesson[]) {
  if (test.type === "SINGLE") return test.displayName + " / " + classTestDateLabel(test, lessons);
  return test.displayName + " / " + "\uC815\uAE30 \uC2DC\uD5D8";
}


function classTestPanelSummaryLabel(test: ClassTestExamOption, lessons: Lesson[]) {
  if (test.type === "SINGLE") return test.displayName + " / " + classTestDateLabel(test, lessons);
  return test.displayName;
}

function lessonDisplayLabel(lesson: Lesson, labels: Record<string, string>) {
  return Object.prototype.hasOwnProperty.call(labels, lesson.id) ? labels[lesson.id] : lesson.defaultLabel;
}

function lessonColumnId(scope: string, index: number, field: LessonFieldId, testId?: string) {
  const testSuffix = field === "test" && testId ? "_" + safeScope(testId) : "";
  return `ls_${scope}_${index}_${field}${testSuffix}`;
}

function safeScope(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 36) || "all";
}

function classTestMatchesLesson(test: ClassTestExamOption, lesson: Lesson, labels: Record<string, string>) {
  if (test.type === "REGULAR") return !isAddedLesson(lesson, labels);
  if (test.classLessonId && test.classLessonId === lesson.id) return true;
  if (test.lessonPosition && test.lessonPosition === lesson.index) return true;
  return test.exams.some(
    (exam) =>
      (Boolean(exam.classLessonId) && exam.classLessonId === lesson.id) ||
      (Boolean(exam.lessonPosition) && exam.lessonPosition === lesson.index) ||
      (Boolean(exam.examDate && lesson.date) && exam.examDate?.slice(0, 10) === lesson.date)
  );
}

function examForClassTestLesson(test: ClassTestExamOption, lesson: Lesson) {
  return (
    test.exams.find((exam) => Boolean(exam.classLessonId) && exam.classLessonId === lesson.id) ??
    test.exams.find((exam) => Boolean(exam.lessonPosition) && exam.lessonPosition === lesson.index) ??
    test.exams.find((exam) => Boolean(exam.examDate && lesson.date) && exam.examDate?.slice(0, 10) === lesson.date) ??
    null
  );
}

function testsForLesson(
  lesson: Lesson,
  classTests: ClassTestExamOption[],
  labels: Record<string, string>
) {
  return classTests.filter((test) => classTestMatchesLesson(test, lesson, labels));
}

function lessonTestColumnLabel(lesson: Lesson, test: ClassTestExamOption) {
  return String(lesson.index) + "\uCC28\uC2DC " + test.name;
}

function isAddedLesson(lesson: Lesson, labels: Record<string, string>) {
  return lesson.id.startsWith("manual_") || lessonDisplayLabel(lesson, labels).trim() === addedLessonLabel;
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function extraLessonCountKey(scope: string) {
  return `asc.studentLessons.extraCount.v4.${scope}`;
}

function visibleLessonsKey(scope: string) {
  return `asc.studentLessons.visible.v4.${scope}`;
}

function lessonPanelOpenKey(scope: string) {
  return `asc.studentLessons.panelOpen.v1.${scope}`;
}

function lessonOnlyViewKey(scope: string) {
  return `asc.studentLessons.lessonOnly.v1.${scope}`;
}

function columnOrderKey(scope: string) {
  return `asc.studentLessons.columnOrder.v1.${scope}`;
}

function hiddenColumnsKey(scope: string) {
  return `asc.studentLessons.hiddenColumns.v1.${scope}`;
}

function cellStylesKey(scope: string) {
  return `asc.studentLessons.styles.v4.${scope}`;
}

function lessonCellKey(studentId: string, columnId: string) {
  return `${studentId}:${columnId}`;
}

function cellValue(row: StudentSheetRow, columnId: string, values: Record<string, string>) {
  return values[lessonCellKey(row.id, columnId)] ?? row.customValues[columnId] ?? "";
}

function legacyLessonValue(row: StudentSheetRow, column: GridColumn) {
  if (column.kind !== "lesson" || column.field !== "attendance") return "";
  return row.customValues[legacyLessonId(column.lessonIndex)] ?? "";
}

function initialLessonCellValue(row: StudentSheetRow, column: GridColumn) {
  if (column.kind !== "lesson") return "";
  if (column.field === "test") {
    if (column.examId) return row.testScoreByExamId?.[column.examId] ?? "";
    return "";
  }
  if (column.date) {
    if (column.field === "attendance") return row.attendanceByDate?.[column.date] ?? row.customValues[column.id] ?? legacyLessonValue(row, column) ?? "";
    if (column.field === "assignment") return row.assignmentByDate?.[column.date] ?? row.customValues[column.id] ?? "";
  }
  return row.customValues[column.id] ?? legacyLessonValue(row, column) ?? "";
}

function isMetaColumnId(value: string): value is MetaColumnId {
  return metaColumns.some((column) => column.id === value);
}

function insertCustomColumns(
  baseColumns: Array<Extract<GridColumn, { kind: "meta" }>>,
  customColumns: Array<Extract<GridColumn, { kind: "custom" }>>
) {
  const result: GridColumn[] = [...baseColumns];
  const pending = [...customColumns];
  let moved = true;

  while (pending.length > 0 && moved) {
    moved = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const column = pending[index];
      if (!column.afterColumnId) continue;
      const anchorIndex = result.findIndex((item) => item.id === column.afterColumnId);
      if (anchorIndex === -1) continue;
      result.splice(anchorIndex + 1, 0, column);
      pending.splice(index, 1);
      moved = true;
    }
  }

  return [...result, ...pending];
}

function applyColumnOrder(columns: GridColumn[], order: string[]) {
  const fixedLeft = columns.filter((column) => !isReorderableColumn(column));
  const movable = columns.filter(isReorderableColumn);
  const movableById = new Map(movable.map((column) => [column.id, column]));
  const used = new Set<string>();
  const ordered = order
    .map((id) => {
      const column = movableById.get(id);
      if (!column || used.has(column.id)) return null;
      used.add(column.id);
      return column;
    })
    .filter((column): column is GridColumn => Boolean(column));

  return [...fixedLeft, ...ordered, ...movable.filter((column) => !used.has(column.id))];
}

function isReorderableColumn(column: GridColumn) {
  return (column.kind === "meta" && column.id !== "rowNumber") || column.kind === "custom";
}

function isColumnSelectable(column: GridColumn) {
  return column.kind !== "meta" || column.id !== "rowNumber";
}

function isHideableColumn(column: GridColumn) {
  return (column.kind === "meta" && column.id !== "rowNumber") || column.kind === "custom" || column.kind === "lesson";
}

function uniqueColumns(columns: GridColumn[]) {
  const seen = new Set<string>();
  return columns.filter((column) => {
    if (seen.has(column.id)) return false;
    seen.add(column.id);
    return true;
  });
}

function currentReorderableColumnIds(columns: GridColumn[]) {
  return columns.filter(isReorderableColumn).map((column) => column.id);
}

function swapColumnOrder(sourceId: string, targetId: string, columns: GridColumn[]) {
  const ids = currentReorderableColumnIds(columns);
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return [];
  const next = [...ids];
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
  return next;
}

function insertColumnIntoOrder(newColumnId: string, afterColumnId: string | null | undefined, currentOrder: string[], columns: GridColumn[]) {
  const base = currentOrder.length > 0 ? [...currentOrder] : currentReorderableColumnIds(columns);
  const clean = base.filter((columnId) => columnId !== newColumnId);
  const anchorIndex = afterColumnId ? clean.indexOf(afterColumnId) : -1;
  if (anchorIndex >= 0) {
    clean.splice(anchorIndex + 1, 0, newColumnId);
  } else {
    clean.push(newColumnId);
  }
  return clean;
}

function isInteractiveElement(target: EventTarget) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-column-drag-handle='true']")) return false;
  return Boolean(target.closest("button,input,select,textarea,a"));
}

function mergeDraftRows(baseRows: StudentSheetRow[], draftRows: DraftStudentRow[]) {
  if (draftRows.length === 0) return baseRows;

  const result: StudentSheetRow[] = [];
  const draftsByAnchor = new Map<string, DraftStudentRow[]>();
  const visited = new Set<string>();

  for (const draft of draftRows) {
    const anchor = draft.afterRowId ?? "";
    draftsByAnchor.set(anchor, [...(draftsByAnchor.get(anchor) ?? []), draft]);
  }

  function appendDrafts(anchor: string) {
    const anchoredDrafts = draftsByAnchor.get(anchor) ?? [];
    for (const draft of anchoredDrafts) {
      if (visited.has(draft.id)) continue;
      visited.add(draft.id);
      result.push(draft);
      appendDrafts(draft.id);
    }
  }

  appendDrafts("");
  for (const row of baseRows) {
    result.push(row);
    appendDrafts(row.id);
  }
  for (const draft of draftRows) {
    if (visited.has(draft.id)) continue;
    visited.add(draft.id);
    result.push(draft);
  }

  return result;
}

function draftStudentHasContent(row: DraftStudentRow, readValue: (row: StudentSheetRow, columnId: string) => string) {
  const metaColumnIds: EditableMetaColumnId[] = ["name", "phone", "parentPhone", "schoolName", "grade", "subject", "currentLevel", "memo"];
  if (metaColumnIds.some((columnId) => readValue(row, columnId).trim())) return true;
  return Object.values(row.customValues).some((value) => String(value ?? "").trim());
}

function studentDeleteConfirmMessage(
  selectedRows: StudentSheetRow[],
  persistedRows: StudentSheetRow[],
  draftRows: DraftStudentRow[],
  displayName: (row: StudentSheetRow) => string
) {
  if (selectedRows.length === 1) {
    const row = selectedRows[0];
    if (isDraftStudentRow(row)) {
      const name = displayName(row).trim();
      return name
        ? `${name} 신규 학생 행을 삭제할까요? 아직 저장되지 않아 실제 학생 정보는 삭제되지 않습니다.`
        : "저장되지 않은 신규 학생 행을 삭제할까요? 실제 학생 정보는 삭제되지 않습니다.";
    }

    const name = displayName(row).trim() || row.name || "이 학생";
    return `${name} 학생을 삭제할까요? 실제 학생 정보와 연결된 기록이 삭제됩니다.`;
  }

  if (persistedRows.length > 0 && draftRows.length > 0) {
    return `${persistedRows.length}명의 학생과 저장되지 않은 신규 행 ${draftRows.length}개를 삭제할까요? 실제 학생 정보와 연결된 기록이 삭제됩니다.`;
  }

  if (persistedRows.length > 0) {
    return `${persistedRows.length}명의 학생을 삭제할까요? 실제 학생 정보와 연결된 기록이 삭제됩니다.`;
  }

  return `저장되지 않은 신규 학생 행 ${draftRows.length}개를 삭제할까요? 실제 학생 정보는 삭제되지 않습니다.`;
}

function metaCellValue(row: StudentSheetRow, columnId: MetaColumnId) {
  if (columnId === "rowNumber") return String(row.no);
  if (columnId === "name") return row.name;
  if (columnId === "phone") return formatPhoneNumber(row.phone || "");
  if (columnId === "parentPhone") return formatPhoneNumber(row.parentPhone || "");
  if (columnId === "schoolName") return row.schoolName || "";
  if (columnId === "grade") return row.grade || "";
  if (columnId === "classGroup") return row.classGroupName || "-";
  if (columnId === "subject") return row.subject || "";
  if (columnId === "currentLevel") return row.currentLevel || "";
  return row.memo || "";
}

function containsText(value: string, query: string) {
  const trimmedQuery = query.trim();
  const valueDigits = normalizePhoneNumber(value);
  const queryDigits = normalizePhoneNumber(trimmedQuery);
  if (queryDigits.length >= 3 && valueDigits.includes(queryDigits)) return true;
  return value.toLocaleLowerCase().includes(trimmedQuery.toLocaleLowerCase());
}

function isPhoneMetaColumn(columnId: string): columnId is "phone" | "parentPhone" {
  return columnId === "phone" || columnId === "parentPhone";
}

function sortRows(
  rows: StudentSheetRow[],
  columnId: string,
  direction: SortDirection,
  readValue: (row: StudentSheetRow, columnId: string) => string
) {
  const sorted = [...rows].sort((a, b) => {
    const aValue = readValue(a, columnId);
    const bValue = readValue(b, columnId);
    return aValue.localeCompare(bValue, "ko", { numeric: true, sensitivity: "base" });
  });

  return direction === "asc" ? sorted : sorted.reverse();
}

function normalizeRange(selection: SelectionRange) {
  return {
    startRow: Math.min(selection.anchor.rowIndex, selection.cursor.rowIndex),
    endRow: Math.max(selection.anchor.rowIndex, selection.cursor.rowIndex),
    startCol: Math.min(selection.anchor.colIndex, selection.cursor.colIndex),
    endCol: Math.max(selection.anchor.colIndex, selection.cursor.colIndex),
  };
}

function isSelected(selection: SelectionRange | null, rowIndex: number, colIndex: number) {
  if (!selection) return false;
  const range = normalizeRange(selection);
  return rowIndex >= range.startRow && rowIndex <= range.endRow && colIndex >= range.startCol && colIndex <= range.endCol;
}

function selectedLessonCells(selection: SelectionRange | null, rows: StudentSheetRow[], columns: GridColumn[]) {
  if (!selection) return [];
  const range = normalizeRange(selection);
  const cells: Array<{ row: StudentSheetRow; columnId: string }> = [];

  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      const column = columns[colIndex];
      if (column?.kind !== "lesson" && column?.kind !== "custom") continue;
      cells.push({ row, columnId: column.id });
    }
  }

  return cells;
}

function isEditableGridColumn(column: GridColumn): column is EditableGridColumn {
  return column.kind === "lesson" || column.kind === "custom" || (column.kind === "meta" && column.id !== "rowNumber");
}

function selectedEditableCells(selection: SelectionRange | null, rows: StudentSheetRow[], columns: GridColumn[]) {
  if (!selection) return [];
  const range = normalizeRange(selection);
  const cells: Array<{ row: StudentSheetRow; rowIndex: number; colIndex: number; columnId: string; column: EditableGridColumn }> = [];

  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      const column = columns[colIndex];
      if (!column || !isEditableGridColumn(column)) continue;
      cells.push({ row, rowIndex, colIndex, columnId: column.id, column });
    }
  }

  return cells;
}

function selectedEditableCellsForMode(
  mode: SelectionMode,
  selection: SelectionRange | null,
  selectedRowIds: Set<string>,
  selectedColumnIds: Set<string>,
  selectedCellKeys: Set<string>,
  rows: StudentSheetRow[],
  columns: GridColumn[]
) {
  if (mode === "row") {
    const cells: ReturnType<typeof selectedEditableCells> = [];
    rows.forEach((row, rowIndex) => {
      if (!selectedRowIds.has(row.id)) return;
      columns.forEach((column, colIndex) => {
        if (!isEditableGridColumn(column)) return;
        cells.push({ row, rowIndex, colIndex, columnId: column.id, column });
      });
    });
    return cells;
  }

  if (mode === "column") {
    const cells: ReturnType<typeof selectedEditableCells> = [];
    rows.forEach((row, rowIndex) => {
      columns.forEach((column, colIndex) => {
        if (!selectedColumnIds.has(column.id) || !isEditableGridColumn(column)) return;
        cells.push({ row, rowIndex, colIndex, columnId: column.id, column });
      });
    });
    return cells;
  }

  if (mode === "cell" && selectedCellKeys.size > 0) {
    const cells: ReturnType<typeof selectedEditableCells> = [];
    rows.forEach((row, rowIndex) => {
      columns.forEach((column, colIndex) => {
        if (!selectedCellKeys.has(lessonCellKey(row.id, column.id)) || !isEditableGridColumn(column)) return;
        cells.push({ row, rowIndex, colIndex, columnId: column.id, column });
      });
    });
    return cells;
  }

  return selectedEditableCells(selection, rows, columns);
}

function replaceText(value: string, findText: string, replacementText: string, caseSensitive: boolean) {
  if (!findText) return { value, changed: false };
  if (caseSensitive) {
    const nextValue = value.split(findText).join(replacementText);
    return { value: nextValue, changed: nextValue !== value };
  }

  const matcher = new RegExp(escapeRegExp(findText), "gi");
  const nextValue = value.replace(matcher, () => replacementText);
  return { value: nextValue, changed: nextValue !== value };
}

function countReplaceChanges(
  cells: ReturnType<typeof selectedEditableCells>,
  findText: string,
  replacementText: string,
  caseSensitive: boolean,
  readValue: (row: StudentSheetRow, columnId: string) => string,
  buildMetaUpdate: (row: StudentSheetRow, columnId: EditableMetaColumnId, rawValue: string) => { displayValue: string; saveValue: string } | null
) {
  if (!findText) return 0;
  let count = 0;
  for (const cell of cells) {
    const currentValue = readValue(cell.row, cell.column.id);
    if (!currentValue) continue;
    const replacement = replaceText(currentValue, findText, replacementText, caseSensitive);
    if (!replacement.changed) continue;
    if (cell.column.kind === "meta" && !buildMetaUpdate(cell.row, cell.column.id, replacement.value)) continue;
    count += 1;
  }
  return count;
}

function replaceScopeDescription(
  selection: SelectionRange | null,
  rows: StudentSheetRow[],
  columns: GridColumn[],
  cells: ReturnType<typeof selectedEditableCells>
) {
  if (!selection || cells.length === 0) return "선택된 편집 가능 셀 없음";
  const range = normalizeRange(selection);
  const isSingleRow = range.startRow === range.endRow;
  const isSingleColumn = range.startCol === range.endCol;
  const includesAllColumns = range.startCol === 0 && range.endCol === columns.length - 1;
  const includesAllRows = range.startRow === 0 && range.endRow === rows.length - 1;
  if (isSingleRow && includesAllColumns) return `${range.startRow + 1}행`;
  if (isSingleColumn && includesAllRows) return `${columns[range.startCol] ? columnLabel(columns[range.startCol]) : "선택"} 열`;
  if (cells.length === 1) return "선택된 1개 셀";
  return `선택된 ${cells.length}개 셀`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectedSheetCells(selection: SelectionRange | null, rows: StudentSheetRow[], columns: GridColumn[]) {
  if (!selection) return [];
  const range = normalizeRange(selection);
  const cells: Array<{ row: StudentSheetRow; columnId: string }> = [];

  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      const column = columns[colIndex];
      if (!column) continue;
      cells.push({ row, columnId: column.id });
    }
  }

  return cells;
}

function selectedSheetCellsForMode(
  mode: SelectionMode,
  selection: SelectionRange | null,
  selectedRowIds: Set<string>,
  selectedColumnIds: Set<string>,
  selectedCellKeys: Set<string>,
  rows: StudentSheetRow[],
  columns: GridColumn[]
) {
  if (mode === "row") {
    const cells: ReturnType<typeof selectedSheetCells> = [];
    rows.forEach((row) => {
      if (!selectedRowIds.has(row.id)) return;
      columns.forEach((column) => {
        cells.push({ row, columnId: column.id });
      });
    });
    return cells;
  }

  if (mode === "column") {
    const cells: ReturnType<typeof selectedSheetCells> = [];
    rows.forEach((row) => {
      columns.forEach((column) => {
        if (!selectedColumnIds.has(column.id)) return;
        cells.push({ row, columnId: column.id });
      });
    });
    return cells;
  }

  if (mode === "cell" && selectedCellKeys.size > 0) {
    const cells: ReturnType<typeof selectedSheetCells> = [];
    rows.forEach((row) => {
      columns.forEach((column) => {
        if (!selectedCellKeys.has(lessonCellKey(row.id, column.id))) return;
        cells.push({ row, columnId: column.id });
      });
    });
    return cells;
  }

  return selectedSheetCells(selection, rows, columns);
}

function selectedMatrix(
  selection: SelectionRange | null,
  rows: StudentSheetRow[],
  columns: GridColumn[],
  readValue: (row: StudentSheetRow, columnId: string) => string
) {
  if (!selection) return [];
  const range = normalizeRange(selection);
  const matrix: string[][] = [];

  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    const line: string[] = [];
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      const column = columns[colIndex];
      if (!column) continue;
      line.push(readValue(row, column.id));
    }
    matrix.push(line);
  }

  return matrix;
}

function selectedMatrixForMode(
  mode: SelectionMode,
  selection: SelectionRange | null,
  selectedRowIds: Set<string>,
  selectedColumnIds: Set<string>,
  selectedCellKeys: Set<string>,
  rows: StudentSheetRow[],
  columns: GridColumn[],
  readValue: (row: StudentSheetRow, columnId: string) => string
) {
  if (mode === "row") {
    return rows
      .filter((row) => selectedRowIds.has(row.id))
      .map((row) => columns.map((column) => readValue(row, column.id)));
  }

  if (mode === "column") {
    const selectedColumns = columns.filter((column) => selectedColumnIds.has(column.id));
    return rows.map((row) => selectedColumns.map((column) => readValue(row, column.id)));
  }

  if (mode === "cell" && selectedCellKeys.size > 0) {
    return rows
      .map((row) =>
        columns
          .filter((column) => selectedCellKeys.has(lessonCellKey(row.id, column.id)))
          .map((column) => readValue(row, column.id))
      )
      .filter((line) => line.length > 0);
  }

  return selectedMatrix(selection, rows, columns, readValue);
}

function selectionStartPointForMode(
  mode: SelectionMode,
  selection: SelectionRange | null,
  selectedRowIds: Set<string>,
  selectedColumnIds: Set<string>,
  selectedCellKeys: Set<string>,
  rows: StudentSheetRow[],
  columns: GridColumn[]
) {
  if (mode === "row") {
    const rowIndex = rows.findIndex((row) => selectedRowIds.has(row.id));
    const colIndex = columns.findIndex(isEditableGridColumn);
    return rowIndex >= 0 && colIndex >= 0 ? { rowIndex, colIndex } : null;
  }

  if (mode === "column") {
    const colIndex = columns.findIndex((column) => selectedColumnIds.has(column.id) && isEditableGridColumn(column));
    return rows.length > 0 && colIndex >= 0 ? { rowIndex: 0, colIndex } : null;
  }

  if (mode === "cell" && selectedCellKeys.size > 0) {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
        const column = columns[colIndex];
        if (selectedCellKeys.has(lessonCellKey(row.id, column.id))) return { rowIndex, colIndex };
      }
    }
    return null;
  }

  if (!selection) return null;
  const range = normalizeRange(selection);
  return { rowIndex: range.startRow, colIndex: range.startCol };
}

function buildSelectionScope(
  mode: SelectionMode,
  selection: SelectionRange | null,
  selectedRowIds: Set<string>,
  selectedColumnIds: Set<string>,
  selectedCellKeys: Set<string>,
  rows: StudentSheetRow[],
  columns: GridColumn[]
) {
  const rowIds = new Set<string>();
  const columnIds = new Set<string>();

  if (mode === "row") {
    for (const row of rows) {
      if (selectedRowIds.has(row.id)) rowIds.add(row.id);
    }
    for (const column of columns) columnIds.add(column.id);
    return { rowIds, columnIds };
  }

  if (mode === "column") {
    for (const row of rows) rowIds.add(row.id);
    for (const column of columns) {
      if (selectedColumnIds.has(column.id)) columnIds.add(column.id);
    }
    return { rowIds, columnIds };
  }

  if (mode === "cell" && selectedCellKeys.size > 0) {
    for (const row of rows) {
      for (const column of columns) {
        if (!selectedCellKeys.has(lessonCellKey(row.id, column.id))) continue;
        rowIds.add(row.id);
        columnIds.add(column.id);
      }
    }
    return { rowIds, columnIds };
  }

  if (!selection) return { rowIds, columnIds };

  const range = normalizeRange(selection);
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row) rowIds.add(row.id);
  }
  for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
    const column = columns[colIndex];
    if (column) columnIds.add(column.id);
  }
  return { rowIds, columnIds };
}

function formatActiveSelectionLabel(
  mode: SelectionMode,
  selection: SelectionRange | null,
  selectedRowIds: Set<string>,
  selectedColumnIds: Set<string>,
  selectedCellKeys: Set<string>,
  rows: StudentSheetRow[],
  columns: GridColumn[]
) {
  if (mode === "row") {
    const count = rows.filter((row) => selectedRowIds.has(row.id)).length;
    return count > 0 ? `선택된 행 ${count}개` : "선택 없음";
  }

  if (mode === "column") {
    const count = columns.filter((column) => selectedColumnIds.has(column.id)).length;
    return count > 0 ? `선택된 열 ${count}개` : "선택 없음";
  }

  if (mode === "cell" && selectedCellKeys.size > 0) return `선택된 셀 ${selectedCellKeys.size}개`;
  if (mode === "cell" && selection) return formatSelectionLabel(selection, rows, columns);
  return "선택 없음";
}

function formatSelectionLabel(selection: SelectionRange, rows: StudentSheetRow[], columns: GridColumn[]) {
  const range = normalizeRange(selection);
  const rowCount = Math.max(0, range.endRow - range.startRow + 1);
  const colCount = Math.max(0, range.endCol - range.startCol + 1);
  const startColumn = columns[range.startCol] ? columnLabel(columns[range.startCol]) : "?";
  const endColumn = columns[range.endCol] ? columnLabel(columns[range.endCol]) : "?";
  const startRow = rows[range.startRow]?.name ?? `row ${range.startRow + 1}`;
  const endRow = rows[range.endRow]?.name ?? `row ${range.endRow + 1}`;
  return `${startRow} ${startColumn} - ${endRow} ${endColumn} / ${rowCount}x${colCount}`;
}

function columnLabel(column: GridColumn) {
  if (column.kind !== "lesson") return column.label;
  return `${column.groupLabel} ${column.label}`;
}

function spreadsheetColumnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function totalTableWidth(columns: GridColumn[]) {
  return columns.reduce((sum, column) => sum + column.width, 0);
}

function normalizeSheetZoom(value: number) {
  if (!Number.isFinite(value)) return 100;
  return sheetZoomLevels.reduce((closest, level) => {
    return Math.abs(level - value) < Math.abs(closest - value) ? level : closest;
  }, 100);
}

function clampSheetZoom(value: number) {
  if (!Number.isFinite(value)) return 100;
  const minZoom = sheetZoomLevels[0];
  const maxZoom = sheetZoomLevels[sheetZoomLevels.length - 1];
  return Math.min(maxZoom, Math.max(minZoom, Math.round(value)));
}

function parseSheetZoomInput(value: string, fallback: number) {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? clampSheetZoom(parsed) : fallback;
}

function nextSheetZoom(current: number, direction: -1 | 1) {
  const normalized = normalizeSheetZoom(current);
  const currentIndex = sheetZoomLevels.findIndex((level) => level === normalized);
  const nextIndex = Math.min(sheetZoomLevels.length - 1, Math.max(0, currentIndex + direction));
  return sheetZoomLevels[nextIndex] ?? 100;
}

function zoomDimension(value: number, factor: number, min = 1) {
  return Math.max(min, Math.round(value * factor));
}

function zoomPx(value: number, factor: number, min = 1) {
  return `${zoomDimension(value, factor, min)}px`;
}

function buildSheetZoomStyles(factor: number) {
  return {
    sheetTable: { fontSize: zoomDimension(12, factor, 10) },
    columnLetterTh: {
      height: zoomDimension(columnLetterHeaderHeight, factor, 20),
      padding: `0 ${zoomPx(3, factor)}`,
    },
    columnLetterInner: {
      gridTemplateColumns: `${zoomPx(18, factor, 14)} minmax(0, 1fr) ${zoomPx(22, factor, 16)}`,
      gap: zoomDimension(2, factor),
    },
    sheetTh: {
      height: zoomDimension(54, factor, 40),
      padding: `${zoomPx(6, factor)} ${zoomPx(6, factor)}`,
    },
    metaHeaderInner: {
      gridTemplateColumns: `${zoomPx(18, factor, 14)} minmax(0, 1fr) ${zoomPx(22, factor, 16)}`,
      gap: zoomDimension(3, factor),
    },
    columnDragHandle: {
      width: zoomDimension(18, factor, 14),
      height: zoomDimension(22, factor, 16),
      borderRadius: zoomDimension(5, factor),
      fontSize: zoomDimension(10, factor, 8),
    },
    metaHeaderButton: {
      padding: `${zoomPx(2, factor)} ${zoomPx(4, factor)}`,
      borderRadius: zoomDimension(5, factor),
      fontSize: zoomDimension(12, factor, 9),
    },
    subSortButton: {
      width: zoomDimension(22, factor, 16),
      height: zoomDimension(22, factor, 16),
      borderRadius: zoomDimension(5, factor),
      fontSize: zoomDimension(10, factor, 8),
    },
    lessonGroupTh: { height: zoomDimension(lessonHeaderStickyTop, factor, 72) },
    lessonHeaderTop: {
      minHeight: zoomDimension(30, factor, 22),
      padding: `${zoomPx(4, factor)} ${zoomPx(5, factor)} ${zoomPx(2, factor)}`,
    },
    lessonNameInput: { fontSize: zoomDimension(14, factor, 10) },
    lessonDateLine: {
      gap: zoomDimension(3, factor),
      minHeight: zoomDimension(22, factor, 17),
      padding: `0 ${zoomPx(5, factor)} ${zoomPx(2, factor)}`,
      fontSize: zoomDimension(12, factor, 9),
    },
    lessonDateInput: {
      width: zoomDimension(96, factor, 72),
      height: zoomDimension(20, factor, 16),
      fontSize: zoomDimension(11, factor, 9),
    },
    lessonTimeInput: {
      width: zoomDimension(42, factor, 32),
      height: zoomDimension(20, factor, 16),
      fontSize: zoomDimension(11, factor, 9),
    },
    lessonTimeSeparator: { fontSize: zoomDimension(11, factor, 9) },
    lessonMemoRow: {
      gridTemplateColumns: `${zoomPx(34, factor, 24)} minmax(0, 1fr)`,
      minHeight: zoomDimension(23, factor, 17),
    },
    lessonMemoLabel: { fontSize: zoomDimension(11, factor, 9) },
    lessonMemoInput: {
      height: zoomDimension(22, factor, 16),
      padding: `0 ${zoomPx(6, factor)}`,
      fontSize: zoomDimension(11, factor, 9),
    },
    sheetSubTh: {
      height: zoomDimension(30, factor, 22),
      padding: `${zoomPx(3, factor)} ${zoomPx(4, factor)}`,
    },
    subHeaderInner: { gap: zoomDimension(3, factor) },
    subHeaderButton: {
      padding: `${zoomPx(2, factor)} ${zoomPx(4, factor)}`,
      borderRadius: zoomDimension(5, factor),
      fontSize: zoomDimension(12, factor, 9),
    },
    metaTd: {
      height: zoomDimension(30, factor, 22),
      padding: `${zoomPx(3, factor)} ${zoomPx(8, factor)}`,
    },
    lessonTd: { height: zoomDimension(30, factor, 22) },
    cellInput: {
      height: zoomDimension(29, factor, 21),
      padding: `0 ${zoomPx(6, factor)}`,
    },
    nameEditInput: {
      height: zoomDimension(22, factor, 17),
      lineHeight: `${zoomDimension(22, factor, 17)}px`,
    },
    cellDisplay: {
      height: zoomDimension(29, factor, 21),
      padding: `0 ${zoomPx(6, factor)}`,
    },
  } satisfies Record<string, CSSProperties>;
}

function readStoredNumber(key: string) {
  if (typeof window === "undefined") return null;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function readStoredArray(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readStoredBoolean(key: string) {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(key);
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

function readStoredRecord<T>(key: string) {
  if (typeof window === "undefined") return {} as Record<string, T>;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, T>) : {};
  } catch {
    return {} as Record<string, T>;
  }
}

function styleToCss(style: CellStyle, zoomFactor = 1): CSSProperties {
  const parsedFontSize = style.fontSize ? Number(style.fontSize) : null;
  return {
    background: style.fill,
    fontFamily: style.fontFamily,
    fontSize: parsedFontSize && Number.isFinite(parsedFontSize) ? `${zoomDimension(parsedFontSize, zoomFactor, 8)}px` : undefined,
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    outline: style.border ? "1px solid #111827" : undefined,
  };
}

function defaultSheetFormat(): CellStyle {
  return {
    fill: "#ffffff",
    fontFamily: "Arial",
    fontSize: "13",
    align: "center",
    bold: false,
    italic: false,
    underline: false,
    border: false,
  };
}

function normalizedSheetFormat(style?: CellStyle): CellStyle {
  const base = defaultSheetFormat();
  return {
    fill: style?.fill ?? base.fill,
    fontFamily: style?.fontFamily ?? base.fontFamily,
    fontSize: style?.fontSize ?? base.fontSize,
    align: style?.align ?? base.align,
    bold: Boolean(style?.bold),
    italic: Boolean(style?.italic),
    underline: Boolean(style?.underline),
    border: Boolean(style?.border),
  };
}

function sameSheetFormat(left: CellStyle, right: CellStyle) {
  return (
    left.fill === right.fill &&
    left.fontFamily === right.fontFamily &&
    left.fontSize === right.fontSize &&
    left.align === right.align &&
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    Boolean(left.border) === Boolean(right.border)
  );
}

function ColorPaletteDropdown({
  label,
  title,
  open,
  setOpen,
  currentColor,
  palette,
  onSelect,
  menuRef,
}: {
  label: string;
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentColor: string;
  palette: ColorPaletteItem[];
  onSelect: (value: string) => void;
  menuRef?: { current: HTMLDivElement | null };
}) {
  return (
    <div ref={menuRef} style={colorMenu}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="student-sheet-toolbar-button"
        style={colorTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
      >
        <span style={rainbowIcon} />
        <span style={currentColorDot(currentColor)} />
        {label ? <span>{label}</span> : null}
      </button>
      {open && (
        <div style={swatchPanel} role="menu" aria-label={title}>
          <div style={swatchPanelTitle}>{title}</div>
          <div style={swatchGrid}>
            {palette.map((color) => {
              const active = currentColor.toLowerCase() === color.value.toLowerCase();
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => {
                    onSelect(color.value);
                    setOpen(false);
                  }}
                  style={swatchButton(color.value, active)}
                  title={color.label}
                  aria-label={`${title} ${color.label}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
const testPanelOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 120,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(15, 23, 42, 0.34)",
};
const testPanelModal: CSSProperties = {
  width: 520,
  maxWidth: "calc(100vw - 32px)",
  maxHeight: "calc(100vh - 72px)",
  overflow: "auto",
  background: "#fff",
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.24)",
  padding: 16,
};
const testPanelHeader: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 };
const testPanelCloseButton: CSSProperties = {
  width: 28,
  height: 28,
  border: 0,
  background: "transparent",
  color: "#475569",
  fontSize: 24,
  lineHeight: "24px",
  cursor: "pointer",
};
const testPanelSection: CSSProperties = { borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 12 };
const testPanelForm: CSSProperties = { display: "grid", gap: 8, marginTop: 8 };
const testPanelLabel: CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 };
const testPanelInput: CSSProperties = { width: "100%", minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 9px", fontSize: 13, background: "#fff" };
const testPanelInlineFields: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" };
const testPanelList: CSSProperties = { display: "grid", gap: 10, marginTop: 10 };
const testPanelItem: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" };
const testPanelItemTop: CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 };
const testPanelSubText: CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 600 };
const testTypeBadge: CSSProperties = { display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", padding: "2px 7px", fontSize: 11, fontWeight: 800 };
const testPanelCheckboxLabel: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", fontWeight: 700 };
const dangerPanelButton: CSSProperties = { border: "1px solid #fecaca", color: "#b91c1c", background: "#fff1f2", borderRadius: 6, padding: "7px 10px", fontWeight: 800, cursor: "pointer", marginTop: 8 };

const shell: CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  border: "1px solid #d7dce5",
  borderRadius: 8,
  background: "#ffffff",
  overflow: "visible",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const fullscreenShell: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  height: "100vh",
  borderRadius: 0,
  border: 0,
  boxShadow: "none",
};

const contextMenuPanel: CSSProperties = {
  position: "fixed",
  zIndex: 1500,
  width: 250,
  padding: "6px 0",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 16px 42px rgba(15, 23, 42, 0.2)",
};

const contextMenuItem: CSSProperties = {
  width: "100%",
  height: 34,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  border: 0,
  background: "transparent",
  color: "#111827",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
};

const contextMenuDangerItem: CSSProperties = {
  color: "#b91c1c",
};

const disabledContextMenuItem: CSSProperties = {
  opacity: 0.38,
  cursor: "not-allowed",
};

const contextMenuShortcut: CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const contextMenuSeparator: CSSProperties = {
  height: 1,
  margin: "5px 0",
  background: "#e5e7eb",
};

const replaceModalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(15, 23, 42, 0.34)",
};

const replaceModal: CSSProperties = {
  width: "min(440px, 92vw)",
  background: "#ffffff",
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  boxShadow: "0 24px 58px rgba(15, 23, 42, 0.24)",
  overflow: "hidden",
};

const replaceModalHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 16px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const replaceModalTitle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 950,
};

const replaceModalDesc: CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const replaceCloseButton: CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#ffffff",
  color: "#111827",
  fontSize: 19,
  cursor: "pointer",
};

const replaceModalBody: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 16,
};

const replaceLabel: CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#111827",
  fontSize: 12,
  fontWeight: 900,
};

const replaceInput: CSSProperties = {
  height: 34,
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  padding: "0 10px",
  color: "#111827",
  fontWeight: 800,
  outline: "none",
};

const replaceCheckLabel: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
};

const replacePreviewBox: CSSProperties = {
  minHeight: 30,
  display: "flex",
  alignItems: "center",
  padding: "7px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  background: "#f8fafc",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
};

const replaceModalFooter: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: 12,
  borderTop: "1px solid #e5e7eb",
  background: "#ffffff",
};

const replaceSecondaryButton: CSSProperties = {
  height: 32,
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#ffffff",
  color: "#111827",
  padding: "0 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const replacePrimaryButton: CSSProperties = {
  height: 32,
  border: 0,
  borderRadius: 7,
  background: "#111827",
  color: "#ffffff",
  padding: "0 13px",
  fontWeight: 950,
  cursor: "pointer",
};

const replaceDisabledButton: CSSProperties = {
  opacity: 0.42,
  cursor: "not-allowed",
};

const selectionBadge: CSSProperties = {
  padding: "0 8px",
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid transparent",
  borderRadius: 14,
  background: "#ffffff",
  color: "#5f6368",
  fontSize: 12,
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

const toolbar: CSSProperties = {
  minHeight: 38,
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
  overflowX: "visible",
  overflowY: "visible",
  padding: "4px 8px",
  borderBottom: "1px solid #dfe3eb",
  background: "#f1f3f4",
  scrollbarWidth: "none",
};

const toolbarGroup: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  flexWrap: "nowrap",
  flex: "0 0 auto",
};

const toolbarDivider: CSSProperties = {
  width: 1,
  height: 22,
  margin: "0 3px",
  background: "#d6dbe3",
  flex: "0 0 auto",
};

const sheetMeta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  flex: "0 1 auto",
  minWidth: 0,
  maxWidth: 430,
  overflow: "hidden",
  color: "#5f6368",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const sheetMetaStrong: CSSProperties = {
  color: "#202124",
  fontSize: 12,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 150,
};

const warningText: CSSProperties = {
  color: "#b45309",
  fontWeight: 700,
};

const toolbarButton: CSSProperties = {
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 8px",
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#3c4043",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
  cursor: "pointer",
  flex: "0 0 auto",
};

const toolbarIconButton: CSSProperties = {
  width: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#3c4043",
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
  flex: "0 0 auto",
};

const zoomControl: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 28,
  border: 0,
  borderRadius: 4,
  overflow: "hidden",
  background: "transparent",
  flex: "0 0 auto",
};

const zoomValueBox: CSSProperties = {
  minWidth: 54,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 1,
  border: 0,
  borderRadius: 4,
  background: "#ffffff",
  color: "#3c4043",
  fontSize: 12,
  fontWeight: 800,
};

const zoomInput: CSSProperties = {
  width: 34,
  height: 26,
  border: 0,
  outline: 0,
  background: "transparent",
  color: "#111827",
  fontSize: 12,
  fontWeight: 900,
  textAlign: "right",
};

const zoomPercentMark: CSSProperties = {
  color: "#111827",
  fontSize: 12,
  fontWeight: 900,
};

const disabledZoomButton: CSSProperties = {
  opacity: 0.35,
  cursor: "not-allowed",
};

const columnVisibilityMenuWrap: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const columnVisibilityPanel: CSSProperties = {
  position: "absolute",
  top: 34,
  left: 0,
  zIndex: 80,
  width: 220,
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.16)",
};

const columnVisibilityTitle: CSSProperties = {
  marginBottom: 8,
  color: "#111827",
  fontSize: 12,
  fontWeight: 900,
};

const columnVisibilityList: CSSProperties = {
  display: "grid",
  gap: 6,
  maxHeight: 220,
  overflowY: "auto",
  paddingRight: 2,
};

const columnVisibilityOption: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#111827",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const columnVisibilityActions: CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "flex-end",
  marginTop: 10,
  paddingTop: 8,
  borderTop: "1px solid #e5e7eb",
};

const smallPanelButton: CSSProperties = {
  height: 26,
  padding: "0 8px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#f8fafc",
  color: "#111827",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  ...toolbarButton,
  background: "#0b57d0",
  color: "#ffffff",
  fontWeight: 800,
};

const saveStatus: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: 12,
  fontWeight: 800,
};

const pendingStatus: CSSProperties = {
  background: "#fff7ed",
  color: "#c2410c",
};

const toolbarInput: CSSProperties = {
  height: 28,
  minWidth: 112,
  padding: "0 9px",
  border: "1px solid transparent",
  borderRadius: 14,
  background: "#ffffff",
  color: "#202124",
  fontSize: 12,
  outline: "none",
  flex: "0 0 auto",
};

const compactSelect: CSSProperties = {
  height: 28,
  padding: "0 8px",
  border: "1px solid transparent",
  borderRadius: 4,
  background: "transparent",
  color: "#3c4043",
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
  flex: "0 0 auto",
};

const colorMenu: CSSProperties = {
  position: "relative",
  display: "inline-flex",
};

const colorTrigger: CSSProperties = {
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 8px",
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#3c4043",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const rainbowIcon: CSSProperties = {
  width: 18,
  height: 12,
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  background: "linear-gradient(90deg, #fecaca, #fed7aa, #fef08a, #bbf7d0, #bfdbfe, #c7d2fe, #e9d5ff)",
};

function currentColorDot(color: string): CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "1px solid #94a3b8",
    background: color,
  };
}

const swatchPanel: CSSProperties = {
  position: "absolute",
  top: 34,
  left: 0,
  zIndex: 50,
  width: 266,
  padding: 10,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.18)",
};

const swatchPanelTitle: CSSProperties = {
  marginBottom: 8,
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
};

const swatchGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, 24px)",
  gap: 5,
};

function swatchButton(color: string, active: boolean): CSSProperties {
  return {
    width: 24,
    height: 24,
    border: active ? "2px solid #111827" : "1px solid #cbd5e1",
    borderRadius: 999,
    background: color,
    boxShadow: active ? "0 0 0 2px #bfdbfe" : "none",
    cursor: "pointer",
  };
}

const sizeInput: CSSProperties = {
  ...toolbarInput,
  minWidth: 54,
  width: 62,
};

function formatButton(active?: boolean): CSSProperties {
  return {
    ...toolbarButton,
    minWidth: 28,
    padding: "0 7px",
    background: active ? "#dfe8fd" : "transparent",
    border: 0,
    color: active ? "#174ea6" : "#3c4043",
    fontWeight: 850,
  };
}

const selectedColumnPill: CSSProperties = {
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 8px",
  border: "1px solid transparent",
  borderRadius: 4,
  background: "transparent",
  color: "#5f6368",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};
const contentGrid: CSSProperties = {
  display: "grid",
  alignItems: "stretch",
  gap: 0,
  minHeight: 0,
};

const sheetPane: CSSProperties = {
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto",
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  background: "#ffffff",
};

const lessonPanel: CSSProperties = {
  position: "sticky",
  top: 0,
  alignSelf: "stretch",
  display: "grid",
  gridTemplateRows: "auto auto auto minmax(0, 1fr)",
  borderLeft: "1px solid #d7dce5",
  background: "#f8fafc",
  padding: 10,
  overflow: "hidden",
  maxHeight: "100%",
};

const panelHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
  color: "#111827",
};

const panelButton: CSSProperties = {
  height: 26,
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const panelCloseButton: CSSProperties = {
  width: 28,
  height: 28,
  border: 0,
  background: "transparent",
  color: "#111827",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const panelButtonActive: CSSProperties = {
  border: "1px solid #0b50d0",
  background: "#e8f0fe",
  color: "#083891",
};

const rangeButtons: CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
  marginBottom: 10,
};

const panelSection: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "8px 0 10px",
  borderTop: "1px solid #e5e7eb",
  borderBottom: "1px solid #e5e7eb",
  marginBottom: 10,
};

const panelSectionTitle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const panelRangeRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 5,
};

const panelSelect: CSSProperties = {
  minWidth: 0,
  height: 28,
  padding: "0 6px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  fontWeight: 700,
};

const panelApplyButton: CSSProperties = {
  ...panelButton,
  width: "100%",
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
};

const lessonList: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 6,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 2,
};

const lessonToggle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  alignItems: "center",
  gap: "2px 6px",
  padding: "6px 7px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#ffffff",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const lessonToggleChecked: CSSProperties = {
  border: "1px solid #93c5fd",
  background: "#e8f0fe",
};

const lessonToggleText: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const lessonToggleDate: CSSProperties = {
  gridColumn: "2",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const sheetWrap: CSSProperties = {
  overflow: "auto",
  minHeight: 0,
  background: "#ffffff",
  userSelect: "none",
};

const sheetBottomBar: CSSProperties = {
  position: "sticky",
  bottom: 0,
  zIndex: 12,
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  gap: 0,
  padding: "0 8px",
  borderTop: "1px solid #dfe3eb",
  background: "#f8f9fa",
  boxShadow: "0 -1px 2px rgba(15, 23, 42, 0.04)",
};

const sheetTabs: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 0,
  minWidth: 0,
  overflowX: "auto",
  flex: "1 1 auto",
  height: 34,
};

const sheetTab: CSSProperties = {
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  maxWidth: 190,
  padding: "0 14px",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: "#3c4043",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flex: "0 0 auto",
};

const sheetTabIconButton: CSSProperties = {
  width: 36,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: "#3c4043",
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1,
  textDecoration: "none",
  flex: "0 0 auto",
};

const sheetTabActive: CSSProperties = {
  background: "#e8f0fe",
  color: "#1a73e8",
  boxShadow: "inset 0 -2px 0 #1a73e8",
};

const sheetBottomStatus: CSSProperties = {
  flex: "0 0 auto",
  padding: "0 8px",
  color: "#5f6368",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const sheetTable: CSSProperties = {
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  fontSize: 12,
  userSelect: "none",
};

const stickyTop: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
};

const lessonHeaderStickyTop = 98;
const columnLetterHeaderHeight = 24;

const columnLetterTh: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 7,
  height: columnLetterHeaderHeight,
  padding: "0 3px",
  borderRight: "1px solid #dfe3eb",
  borderBottom: "1px solid #cfd8e3",
  background: "#f8fafc",
  color: "#202124",
  fontWeight: 800,
  textAlign: "center",
  verticalAlign: "middle",
  cursor: "pointer",
};

const columnLetterInner: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr) 22px",
  alignItems: "center",
  gap: 2,
  minWidth: 0,
};

const columnLetterButton: CSSProperties = {
  minWidth: 0,
  width: "100%",
  height: 20,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#202124",
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
};

const columnLetterActionButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 20,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "grab",
};

const columnLetterActionSpacer: CSSProperties = {
  width: 18,
  height: 20,
  display: "inline-block",
};

const sheetTh: CSSProperties = {
  height: 54,
  padding: "6px 6px",
  borderRight: "1px solid #dfe3eb",
  borderBottom: "1px solid #dfe3eb",
  background: "#f6f8fb",
  color: "#202124",
  fontWeight: 750,
  textAlign: "center",
};

const columnDragSourceTh: CSSProperties = {
  opacity: 0.7,
  boxShadow: "0 6px 18px rgba(37, 99, 235, 0.18)",
  outline: "2px solid #60a5fa",
  outlineOffset: -2,
};

const columnDropTargetTh: CSSProperties = {
  background: "#e8f0fe",
  boxShadow: "inset 0 0 0 2px #0b50d0",
};

const metaHeaderInner: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr) 22px",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  minWidth: 0,
};

const columnDragHandle: CSSProperties = {
  width: 18,
  height: 22,
  border: "1px solid transparent",
  borderRadius: 5,
  background: "transparent",
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "grab",
  padding: 0,
};

const columnDragHandleActive: CSSProperties = {
  color: "#083891",
  background: "#e8f0fe",
  borderColor: "#93c5fd",
  cursor: "grabbing",
};

const columnDragHandleSpacer: CSSProperties = {
  width: 18,
  height: 22,
  display: "inline-block",
};

const metaHeaderButton: CSSProperties = {
  minWidth: 0,
  maxWidth: "100%",
  padding: "2px 4px",
  border: "1px solid transparent",
  borderRadius: 5,
  background: "transparent",
  color: "#111827",
  fontSize: 12,
  fontWeight: 900,
  overflow: "visible",
  textOverflow: "clip",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const customHeaderInput: CSSProperties = {
  ...metaHeaderButton,
  width: "100%",
  border: "1px solid #93c5fd",
  background: "#ffffff",
  textAlign: "center",
  userSelect: "text",
};

const hiddenHeaderButton: CSSProperties = {
  visibility: "hidden",
};

const lessonGroupTh: CSSProperties = {
  height: lessonHeaderStickyTop,
  padding: 0,
  borderRight: "1px solid #cfd8e3",
  borderBottom: "1px solid #dfe3eb",
  background: "#f3f6fb",
  color: "#202124",
  textAlign: "center",
  verticalAlign: "top",
};

const sheetSubTh: CSSProperties = {
  position: "sticky",
  zIndex: 4,
  height: 30,
  padding: "3px 4px",
  borderRight: "1px solid #dfe3eb",
  borderBottom: "1px solid #dfe3eb",
  background: "#fafbfe",
  color: "#3c4043",
  fontWeight: 750,
  textAlign: "center",
};

const subHeaderInner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
};

const subHeaderButton: CSSProperties = {
  minWidth: 0,
  padding: "2px 4px",
  border: "1px solid transparent",
  borderRadius: 5,
  background: "transparent",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const sortIconStack: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  width: 10,
  height: 14,
  pointerEvents: "none",
};

const sortIconSingle: CSSProperties = { ...sortIconStack, gap: 0 };

const sortTriangleUp: CSSProperties = {
  width: 0,
  height: 0,
  borderLeft: "4px solid transparent",
  borderRight: "4px solid transparent",
  borderBottom: "5px solid currentColor",
};

const sortTriangleDown: CSSProperties = {
  width: 0,
  height: 0,
  borderLeft: "4px solid transparent",
  borderRight: "4px solid transparent",
  borderTop: "5px solid currentColor",
};

const subSortButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  appearance: "none",
  width: 22,
  height: 22,
  padding: 0,
  border: "1px solid transparent",
  borderRadius: 5,
  background: "transparent",
  color: "#5f6368",
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
};

const subSortButtonActive: CSSProperties = {
  border: "1px solid transparent",
  background: "transparent",
  color: "#174ea6",
};

const lessonHeaderTop: CSSProperties = {
  display: "grid",
  alignItems: "center",
  minHeight: 30,
  padding: "4px 5px 2px",
};

const lessonNameInput: CSSProperties = {
  width: "100%",
  border: 0,
  outline: 0,
  background: "transparent",
  color: "#111827",
  fontSize: 14,
  fontWeight: 900,
  textAlign: "center",
  userSelect: "text",
};

const lessonDateLine: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  minHeight: 22,
  padding: "0 5px 2px",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
  borderTop: "1px solid rgba(148, 163, 184, 0.45)",
};

const lessonDateInput: CSSProperties = {
  width: 96,
  height: 20,
  border: 0,
  outline: 0,
  borderRadius: 0,
  background: "transparent",
  color: "#334155",
  fontSize: 11,
  fontWeight: 800,
  textAlign: "center",
  userSelect: "text",
};

const lessonTimeInput: CSSProperties = {
  width: 42,
  height: 20,
  border: 0,
  outline: 0,
  borderRadius: 0,
  background: "transparent",
  color: "#334155",
  fontSize: 11,
  fontWeight: 800,
  textAlign: "center",
  userSelect: "text",
};

const lessonTimeSeparator: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
};

const lessonMemoRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  minHeight: 23,
  borderTop: "1px solid rgba(148, 163, 184, 0.55)",
  background: "rgba(248, 250, 252, 0.48)",
};

const lessonMemoLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: "1px solid rgba(148, 163, 184, 0.55)",
  color: "#334155",
  fontSize: 11,
  fontWeight: 900,
};

const lessonMemoInput: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 22,
  border: 0,
  outline: 0,
  borderRadius: 0,
  padding: "0 6px",
  background: "transparent",
  color: "#334155",
  fontSize: 11,
  fontWeight: 700,
  textAlign: "left",
  userSelect: "text",
};

const metaTd: CSSProperties = {
  height: 30,
  padding: "3px 8px",
  borderRight: "1px solid #e7ebf0",
  borderBottom: "1px solid #e7ebf0",
  background: "#fbfcfe",
  color: "#202124",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowHeaderTd: CSSProperties = {
  background: "#f6f8fb",
  color: "#5f6368",
  textAlign: "center",
  cursor: "grab",
};

const clickableMetaTd: CSSProperties = {
  cursor: "pointer",
};

const draftRowStyle: CSSProperties = {
  background: "#fffdf0",
};

const draftCellStyle: CSSProperties = {
  background: "#fffdf0",
};

const draftRowHeaderTd: CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
};

const draftRowBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 34,
  height: 18,
  padding: "0 6px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 11,
  fontWeight: 950,
};

const draftNamePlaceholder: CSSProperties = {
  color: "#b45309",
  fontSize: 12,
  fontWeight: 850,
};

const lessonTd: CSSProperties = {
  height: 30,
  padding: 0,
  borderRight: "1px solid #e7ebf0",
  borderBottom: "1px solid #e7ebf0",
  background: "#ffffff",
};

const cellInput: CSSProperties = {
  width: "100%",
  height: 29,
  boxSizing: "border-box",
  border: 0,
  outline: 0,
  padding: "0 6px",
  background: "transparent",
  color: "#111827",
  fontSize: "inherit",
  fontFamily: "inherit",
  fontWeight: 400,
  userSelect: "text",
};

const nameEditInput: CSSProperties = {
  ...cellInput,
  height: 22,
  minWidth: 0,
  padding: 0,
  lineHeight: "22px",
  fontWeight: 400,
  background: "transparent",
};

const cellDisplay: CSSProperties = {
  width: "100%",
  height: 29,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 6px",
  boxSizing: "border-box",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const selectedCell: CSSProperties = {
  boxShadow: "inset 0 0 0 2px #1a73e8",
  background: "#e8f0fe",
};

const selectedRowStyle: CSSProperties = {
  background: "#f1f7ff",
};

const selectedRowCellStyle: CSSProperties = {
  background: "#f1f7ff",
};

const selectedColumnCellStyle: CSSProperties = {
  background: "#f5f9ff",
};

const selectedColumnHeaderStyle: CSSProperties = {
  background: "#e8f0fe",
  boxShadow: "inset 0 0 0 1px #8ab4f8",
};

const selectedColumnButtonStyle: CSSProperties = {
  background: "#dfe8fd",
  color: "#174ea6",
  borderColor: "transparent",
};

const matchedCell: CSSProperties = {
  background: "#fef3c7",
};

const dirtyCell: CSSProperties = {
  boxShadow: "inset 0 -2px 0 #f59e0b",
};

const emptyTd: CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#64748b",
};

const testToolbar: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "nowrap", flex: "0 0 auto" };
const testMetaText: CSSProperties = { color: "#5f6368", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const testMenuWrap: CSSProperties = { position: "relative", display: "inline-flex" };
const testMenuButton: CSSProperties = {
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid transparent",
  borderRadius: 4,
  background: "transparent",
  color: "#202124",
  padding: "0 8px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const disabledTestMenuButton: CSSProperties = { color: "#9aa0a6", cursor: "not-allowed" };
const testMenuChevron: CSSProperties = { color: "#5f6368", fontSize: 11, lineHeight: 1 };
const testMenuPanel: CSSProperties = {
  position: "absolute",
  top: 32,
  left: 0,
  zIndex: 80,
  width: 210,
  padding: "6px 0",
  border: "1px solid #dadce0",
  borderRadius: 4,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(60,64,67,0.18)",
};
const testMenuItemWrap: CSSProperties = { position: "relative" };
const testMenuItemButton: CSSProperties = {
  width: "100%",
  height: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  border: 0,
  background: "transparent",
  color: "#202124",
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};
const testMenuArrow: CSSProperties = { color: "#5f6368", fontSize: 14, lineHeight: 1 };
const testSubMenuPanel: CSSProperties = {
  position: "absolute",
  top: -6,
  left: "calc(100% + 2px)",
  zIndex: 81,
  width: 150,
  padding: "6px 0",
  border: "1px solid #dadce0",
  borderRadius: 4,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(60,64,67,0.18)",
};
const testSubMenuButton: CSSProperties = {
  width: "100%",
  height: 32,
  display: "flex",
  alignItems: "center",
  border: 0,
  background: "transparent",
  color: "#202124",
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};
const disabledTestSubMenuButton: CSSProperties = { color: "#bdc1c6", cursor: "not-allowed" };
const testChecklistPanel: CSSProperties = {
  position: "absolute",
  top: -6,
  left: "calc(100% + 2px)",
  zIndex: 82,
  width: 280,
  maxHeight: 360,
  display: "grid",
  gap: 6,
  padding: 8,
  border: "1px solid #dadce0",
  borderRadius: 4,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(60,64,67,0.18)",
};
const testChecklistActions: CSSProperties = { display: "flex", gap: 6, paddingBottom: 6, borderBottom: "1px solid #edf0f3" };
const testChecklistMiniButton: CSSProperties = {
  height: 26,
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#f8fafc",
  color: "#334155",
  padding: "0 8px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};
const testChecklistList: CSSProperties = { display: "grid", gap: 4, maxHeight: 300, overflow: "auto" };
const testChecklistLabel: CSSProperties = {
  minHeight: 32,
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  alignItems: "center",
  gap: 7,
  borderRadius: 4,
  padding: "5px 6px",
  color: "#202124",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const testChecklistLabelChecked: CSSProperties = { background: "#e8f0fe", color: "#174ea6" };
const testChecklistText: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
