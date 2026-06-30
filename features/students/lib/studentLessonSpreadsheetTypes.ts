import type { SheetCustomColumn } from "@/lib/studentSheetCustomColumns";
import type { StudentSheetRow } from "@/features/students/components/StudentSheetMatrix";

export type StoredClassLesson = {
  id: string;
  position: number;
  title: string;
  lessonDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
};

export type LessonClassGroupOption = {
  id: string;
  name: string;
  teacherName?: string;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  schedule?: string | null;
  lessons?: StoredClassLesson[];
};

export type ClassTestExamInstance = {
  id: string;
  classLessonId?: string | null;
  lessonPosition?: number | null;
  title: string;
  examDate?: string | null;
  totalScore?: number | null;
  questionCount?: number | null;
};

export type ClassTestExamOption = {
  id: string;
  classGroupId: string;
  classTestId: string;
  classLessonId?: string | null;
  lessonPosition?: number | null;
  type: "REGULAR" | "SINGLE";
  name: string;
  displayName: string;
  subject?: string | null;
  totalScore?: number | null;
  questionCount?: number | null;
  templateType?: string | null;
  active?: boolean;
  exams: ClassTestExamInstance[];
};

export type StudentLessonSpreadsheetProps = {
  rows: StudentSheetRow[];
  customColumns: SheetCustomColumn[];
  selectedClassGroupId?: string | null;
  classGroups: LessonClassGroupOption[];
  classTests?: ClassTestExamOption[];
  selectedTestExamId?: string | null;
};

export type LessonFieldId = "attendance" | "assignment" | "test";
export type MetaColumnId = "rowNumber" | "name" | "phone" | "parentPhone" | "schoolName" | "grade" | "classGroup" | "subject" | "currentLevel" | "memo";
export type EditableMetaColumnId = Exclude<MetaColumnId, "rowNumber">;

export type LessonField = {
  id: LessonFieldId;
  label: string;
  width: number;
};

export type Lesson = {
  id: string;
  index: number;
  defaultLabel: string;
  date?: string;
  dateLabel: string;
  scheduleLabel: string;
  startTime?: string;
  endTime?: string;
  memo?: string;
  source: "schedule" | "manual" | "fallback";
};

export type InsertedLesson = {
  id: string;
  index: number;
  afterId: string | null;
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string;
  createdAt: number;
};

export type DraftStudentRow = StudentSheetRow & {
  isDraft: true;
  afterRowId: string | null;
  createdAt: number;
};

export type GridColumn =
  | { id: MetaColumnId; label: string; kind: "meta"; width: number }
  | { id: string; label: string; kind: "custom"; width: number; customColumnId: string; afterColumnId?: string | null }
  | {
      id: string;
      label: string;
      kind: "lesson";
      width: number;
      lessonId: string;
      lessonIndex: number;
      field: LessonFieldId;
      groupLabel: string;
      date?: string;
      dateLabel: string;
      scheduleLabel: string;
      classTestId?: string;
      classTestName?: string;
      classTestType?: "REGULAR" | "SINGLE";
      examId?: string | null;
    };

export type EditableGridColumn =
  | Extract<GridColumn, { kind: "lesson" }>
  | Extract<GridColumn, { kind: "custom" }>
  | (Extract<GridColumn, { kind: "meta" }> & { id: EditableMetaColumnId });

export type GridPoint = {
  rowIndex: number;
  colIndex: number;
};

export type SelectionRange = {
  anchor: GridPoint;
  cursor: GridPoint;
};

export type SelectionMode = "cell" | "row" | "column" | null;

export type CellStyle = {
  fill?: string;
  fontFamily?: string;
  fontSize?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  border?: boolean;
  align?: "left" | "center" | "right";
};

export type LessonTimeOverride = {
  startTime: string;
  endTime: string;
};

export type DirtyMetaValue = {
  studentId: string;
  field: EditableMetaColumnId;
  value: string;
};

export type SheetHistorySnapshot = {
  values: Record<string, string>;
  dirtyValues: Record<string, string>;
  dirtyMetaValues: Record<string, DirtyMetaValue>;
  cellStyles: Record<string, CellStyle>;
  lessonLabels: Record<string, string>;
  lessonDateOverrides: Record<string, string>;
  lessonTimeOverrides: Record<string, LessonTimeOverride>;
  lessonMemoOverrides: Record<string, string>;
  insertedLessons: InsertedLesson[];
  deletedLessonIds: string[];
  visibleLessonIds: string[];
  extraLessonCount: number;
  lessonConfigDirty: boolean;
  localCustomColumns: SheetCustomColumn[];
  draftRows: DraftStudentRow[];
  nameDrafts: Record<string, string>;
  metaDrafts: Record<string, string>;
  classGroupDraftIds: Record<string, string>;
  customColumnDrafts: Record<string, string>;
  formatDraft: CellStyle;
  columnOrder: string[];
  hiddenColumnIds: string[];
};

export type ContextMenuState = {
  x: number;
  y: number;
  rowIndex?: number;
  colIndex?: number;
  lessonId?: string;
};

export type ColorPaletteItem = {
  label: string;
  value: string;
};

export type SortDirection = "asc" | "desc";
export type DragMode = "cell" | "row" | "column" | null;
export type ColumnDragState = { sourceId: string; targetId: string | null };
