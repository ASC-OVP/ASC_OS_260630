"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClassTestType } from "@/lib/generated/prisma";
import { recordActivity } from "@/lib/activityLog";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MAX_GENERATED_LESSONS,
  type LessonCandidate,
  resolveLessonCandidate,
} from "@/features/classes/lib/lessonScheduleCore";

const CLASS_TEST_TYPES = Object.values(ClassTestType) as ClassTestType[];
const maxGeneratedLessons = DEFAULT_MAX_GENERATED_LESSONS;

type ManageableClassGroup = NonNullable<Awaited<ReturnType<typeof findManageableClassGroup>>>;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return value ? String(value).trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function cleanId(value: string | null | undefined) {
  if (!value) return null;
  return /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null;
}

function intOptional(value: string | null, min: number, max: number) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  return Math.min(max, Math.max(min, numeric));
}

function enumValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T) {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

async function findManageableClassGroup(user: Awaited<ReturnType<typeof requireUser>>, classGroupId: string | null) {
  if (!classGroupId) return null;
  const classGroup = await prisma.classGroup.findFirst({
    where: { id: classGroupId, academyId: user.academyId },
    select: {
      id: true,
      teacherId: true,
      startDate: true,
      endDate: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      schedule: true,
      lessons: { orderBy: { position: "asc" }, select: { id: true, position: true, title: true, lessonDate: true } },
    },
  });
  if (!classGroup) return null;
  if (user.role === "TEACHER" && classGroup.teacherId !== user.id) return null;
  return classGroup;
}

function lessonCandidateForPayload(classGroup: ManageableClassGroup, lessonId: string | null, lessonPosition: number | null) {
  return resolveLessonCandidate(classGroup, lessonId, lessonPosition, maxGeneratedLessons);
}

async function ensureClassLesson(classGroup: ManageableClassGroup, lesson: LessonCandidate, academyId: string) {
  if (lesson.id) return lesson;
  const stored = await prisma.classLesson.upsert({
    where: { classGroupId_position: { classGroupId: classGroup.id, position: lesson.position } },
    update: {
      title: lesson.title,
      lessonDate: lesson.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
    },
    create: {
      academyId,
      classGroupId: classGroup.id,
      position: lesson.position,
      title: lesson.title,
      lessonDate: lesson.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
    },
    select: { id: true, position: true, title: true, lessonDate: true },
  });
  return { ...lesson, id: stored.id, position: stored.position, title: stored.title, lessonDate: stored.lessonDate };
}

async function linkedLessonForClassTestPayload(classGroup: ManageableClassGroup, lessonId: string | null, lessonPosition: number | null, academyId: string) {
  const candidate = lessonCandidateForPayload(classGroup, lessonId, lessonPosition);
  return candidate ? ensureClassLesson(classGroup, candidate, academyId) : null;
}

function classTestPayload(formData: FormData) {
  const name = text(formData, "name").slice(0, 80);
  const type = enumValue(optionalText(formData, "type"), CLASS_TEST_TYPES, ClassTestType.SINGLE);
  const lessonId = cleanId(optionalText(formData, "lessonId"));
  const lessonPosition = intOptional(optionalText(formData, "lessonPosition"), 1, 200);
  return { name, type, lessonId, lessonPosition };
}

export async function createClassTestAction(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "MANAGER", "TEACHER"].includes(user.role)) return;

  const classGroupId = cleanId(text(formData, "classGroupId"));
  const classGroup = await findManageableClassGroup(user, classGroupId);
  const payload = classTestPayload(formData);
  if (!classGroup || !payload.name) return;

  const linkedLesson =
    payload.type === ClassTestType.SINGLE
      ? await linkedLessonForClassTestPayload(classGroup, payload.lessonId, payload.lessonPosition, user.academyId)
      : null;

  if (payload.type === ClassTestType.SINGLE && !linkedLesson) return;

  const classTest = await prisma.classTest.create({
    data: {
      academyId: user.academyId,
      classGroupId: classGroup.id,
      classLessonId: linkedLesson?.id ?? null,
      lessonPosition: linkedLesson?.position ?? null,
      name: payload.name,
      type: payload.type,
      active: true,
    },
  });

  await recordActivity({
    actor: user,
    action: "CREATE",
    entityType: "ClassTest",
    entityId: classTest.id,
    summary: "Class test created: " + payload.name,
    metadata: { classGroupId: classGroup.id, type: payload.type, lessonPosition: linkedLesson?.position ?? null },
  });

  revalidatePath("/students");
  revalidatePath("/omr");
  redirect("/students?classGroupId=" + encodeURIComponent(classGroup.id) + "&testId=" + encodeURIComponent(classTest.id));
}

export async function updateClassTestAction(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "MANAGER", "TEACHER"].includes(user.role)) return;

  const classTestId = cleanId(text(formData, "classTestId"));
  const classGroupId = cleanId(text(formData, "classGroupId"));
  const classGroup = await findManageableClassGroup(user, classGroupId);
  const payload = classTestPayload(formData);
  if (!classTestId || !classGroup || !payload.name) return;

  const existing = await prisma.classTest.findFirst({
    where: { id: classTestId, academyId: user.academyId, classGroupId: classGroup.id },
    select: { id: true },
  });
  if (!existing) return;

  const linkedLesson =
    payload.type === ClassTestType.SINGLE
      ? await linkedLessonForClassTestPayload(classGroup, payload.lessonId, payload.lessonPosition, user.academyId)
      : null;
  if (payload.type === ClassTestType.SINGLE && !linkedLesson) return;

  const active = formData.get("active") === "1" || formData.get("active") === "on";

  await prisma.classTest.update({
    where: { id: classTestId },
    data: {
      classLessonId: linkedLesson?.id ?? null,
      lessonPosition: linkedLesson?.position ?? null,
      name: payload.name,
      type: payload.type,
      active,
    },
  });

  await recordActivity({
    actor: user,
    action: "UPDATE",
    entityType: "ClassTest",
    entityId: classTestId,
    summary: "Class test updated: " + payload.name,
    metadata: { classGroupId: classGroup.id, type: payload.type, lessonPosition: linkedLesson?.position ?? null, active },
  });

  revalidatePath("/students");
  revalidatePath("/omr");
  redirect("/students?classGroupId=" + encodeURIComponent(classGroup.id) + "&testId=" + encodeURIComponent(classTestId));
}

export async function deactivateClassTestAction(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "MANAGER", "TEACHER"].includes(user.role)) return;

  const classTestId = cleanId(text(formData, "classTestId"));
  const classGroupId = cleanId(text(formData, "classGroupId"));
  const classGroup = await findManageableClassGroup(user, classGroupId);
  if (!classTestId || !classGroup) return;

  const existing = await prisma.classTest.findFirst({
    where: { id: classTestId, academyId: user.academyId, classGroupId: classGroup.id },
    select: { id: true, name: true },
  });
  if (!existing) return;

  await prisma.classTest.update({ where: { id: classTestId }, data: { active: false } });

  await recordActivity({
    actor: user,
    action: "UPDATE",
    entityType: "ClassTest",
    entityId: classTestId,
    summary: "Class test deactivated: " + existing.name,
    metadata: { classGroupId: classGroup.id },
  });

  revalidatePath("/students");
  revalidatePath("/omr");
  redirect("/students?classGroupId=" + encodeURIComponent(classGroup.id));
}
