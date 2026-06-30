
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClassTestType, OmrTemplateType } from "@/lib/generated/prisma";
import { recordActivity } from "@/lib/activityLog";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOmrTemplate } from "@/features/omr/lib/omrTemplates";
import { cleanId, enumValue, intValue, normalizeAnswer, omrHref, optionalText, scoreValue, text } from "@/features/omr/lib/omrForm";
import { deleteStoredOmrFile } from "@/features/omr/lib/omrFileStorage";
import { canManageExam, findExamForUser } from "@/features/omr/lib/omrPermissions";
import { resolveLessonCandidate, storedLessonCandidate } from "@/features/classes/lib/lessonScheduleCore";

const OMR_TEMPLATE_TYPES = Object.values(OmrTemplateType) as OmrTemplateType[];

function optionalInt(value: string | undefined, min: number, max: number) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

type OmrLessonClassGroup = {
  lessons: Array<{ id: string; position: number; title: string; lessonDate: string | null }>;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  schedule: string | null;
};

function resolveOmrTargetLesson(classGroup: OmrLessonClassGroup, targetLessonId: string) {
  return resolveLessonCandidate(classGroup, targetLessonId, null, 80);
}

export async function createExamAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageExam(user.role)) return;

  const classGroupId = cleanId(text(formData, "classGroupId"));
  const classTestId = cleanId(text(formData, "classTestId"));
  const targetLessonId = text(formData, "targetLessonId");

  if (!classGroupId || !classTestId || !targetLessonId) return;

  const classGroup = await prisma.classGroup.findFirst({
    where: { id: classGroupId, academyId: user.academyId },
    select: {
      id: true,
      name: true,
      subject: true,
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

  if (!classGroup) return;
  if (user.role === "TEACHER" && classGroup.teacherId !== user.id) return;

  const lessonById = new Map(classGroup.lessons.map((lesson) => [lesson.id, lesson]));
  const targetLesson = resolveOmrTargetLesson(classGroup, targetLessonId);
  if (!targetLesson) return;

  const classTest = await prisma.classTest.findFirst({
    where: { id: classTestId, academyId: user.academyId, classGroupId: classGroup.id, active: true },
    select: {
      id: true,
      name: true,
      type: true,
      subject: true,
      classLessonId: true,
      lessonPosition: true,
      totalScore: true,
      questionCount: true,
      templateType: true,
    },
  });

  if (!classTest) return;

  const linkedLesson =
    (classTest.classLessonId ? lessonById.get(classTest.classLessonId) ? storedLessonCandidate(lessonById.get(classTest.classLessonId)!) : null : null) ??
    (classTest.lessonPosition ? resolveOmrTargetLesson(classGroup, "lesson_" + String(classTest.lessonPosition)) : null);

  if (classTest.type === ClassTestType.SINGLE && linkedLesson && linkedLesson.position !== targetLesson.position) return;

  const effectiveLessonInput = classTest.type === ClassTestType.SINGLE ? linkedLesson ?? targetLesson : targetLesson;
  const templateType = enumValue(optionalText(formData, "templateType"), OMR_TEMPLATE_TYPES, classTest.templateType ?? OmrTemplateType.OTHER);
  const template = getOmrTemplate(templateType);
  const questionCount = intValue(optionalText(formData, "questionCount"), classTest.questionCount ?? template.questionCount, 1, 200);
  const totalScore = optionalInt(optionalText(formData, "totalScore"), 1, 1000) ?? classTest.totalScore;

  const exam = await prisma.$transaction(async (tx) => {
    const effectiveLesson = effectiveLessonInput.id
      ? effectiveLessonInput
      : await tx.classLesson.upsert({
          where: { classGroupId_position: { classGroupId: classGroup.id, position: effectiveLessonInput.position } },
          update: {
            title: effectiveLessonInput.title,
            lessonDate: effectiveLessonInput.lessonDate,
            startTime: effectiveLessonInput.startTime,
            endTime: effectiveLessonInput.endTime,
          },
          create: {
            academyId: user.academyId,
            classGroupId: classGroup.id,
            position: effectiveLessonInput.position,
            title: effectiveLessonInput.title,
            lessonDate: effectiveLessonInput.lessonDate,
            startTime: effectiveLessonInput.startTime,
            endTime: effectiveLessonInput.endTime,
          },
        });

    const existingExam = await tx.exam.findFirst({
      where: {
        academyId: user.academyId,
        classGroupId: classGroup.id,
        classTestId: classTest.id,
        OR: [{ classLessonId: effectiveLesson.id }, { lessonPosition: effectiveLesson.position }],
      },
      orderBy: [{ lessonPosition: "asc" }, { createdAt: "asc" }],
    });

    if (existingExam) return existingExam;

    const title = String(effectiveLesson.position) + "\uCC28\uC2DC " + classTest.name;

    return tx.exam.create({
      data: {
        academyId: user.academyId,
        classGroupId: classGroup.id,
        classTestId: classTest.id,
        classLessonId: effectiveLesson.id,
        lessonPosition: effectiveLesson.position,
        title,
        subject: classTest.subject ?? classGroup.subject ?? template.subject,
        examDate: effectiveLesson.lessonDate ?? null,
        templateType,
        questionCount,
        totalScore,
      },
    });
  });

  await recordActivity({
    actor: user,
    action: "CREATE",
    entityType: "Exam",
    entityId: exam.id,
    summary: "OMR exam created: " + exam.title,
    metadata: { templateType: exam.templateType, classGroupId: classGroup.id, classTestId: exam.classTestId, lessonPosition: exam.lessonPosition, questionCount: exam.questionCount },
  });

  revalidatePath("/omr");
  revalidatePath("/students");
  redirect(omrHref(exam.id, { mode: "answers" }));
}

export async function saveAnswerKeyAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageExam(user.role)) return;

  const examId = text(formData, "examId");
  if (!examId) return;

  const exam = await findExamForUser(examId, user.academyId);
  if (!exam) return;

  const template = getOmrTemplate(exam.templateType);
  const questions = template.questions.slice(0, exam.questionCount);

  await prisma.$transaction(
    questions.map((question) => {
      const answer = normalizeAnswer(text(formData, `correct-${question.no}`));
      const score = scoreValue(text(formData, `score-${question.no}`));

      if (!answer) {
        return prisma.examAnswerKey.deleteMany({
          where: { examId, questionNo: question.no },
        });
      }

      return prisma.examAnswerKey.upsert({
        where: { examId_questionNo: { examId, questionNo: question.no } },
        update: { answer, score },
        create: { examId, questionNo: question.no, answer, score },
      });
    })
  );

  await recordActivity({
    actor: user,
    action: "UPDATE",
    entityType: "ExamAnswerKey",
    entityId: examId,
    summary: `정답 저장: ${exam.title}`,
  });

  revalidatePath("/omr");
  redirect(omrHref(examId, { mode: "answers" }));
}

export async function deleteExamAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageExam(user.role)) return;

  const examId = text(formData, "examId");
  if (!examId) return;

  const exam = await prisma.exam.findFirst({
    where: { id: examId, academyId: user.academyId },
    select: {
      id: true,
      title: true,
      uploads: {
        select: {
          id: true,
          filePath: true,
          previewImagePath: true,
        },
      },
    },
  });

  if (!exam) return;

  await prisma.$transaction([
    prisma.examResult.deleteMany({ where: { academyId: user.academyId, examId: exam.id } }),
    prisma.examAnswerKey.deleteMany({ where: { examId: exam.id } }),
    prisma.omrUpload.deleteMany({ where: { academyId: user.academyId, examId: exam.id } }),
    prisma.exam.delete({ where: { id: exam.id } }),
  ]);

  const storedPaths = new Set(
    exam.uploads
      .flatMap((upload) => [upload.filePath, upload.previewImagePath])
      .filter((filePath): filePath is string => Boolean(filePath))
  );
  await Promise.all([...storedPaths].map((filePath) => deleteStoredOmrFile(filePath)));

  await recordActivity({
    actor: user,
    action: "DELETE",
    entityType: "Exam",
    entityId: exam.id,
    summary: `OMR 검사 삭제: ${exam.title}`,
    metadata: { uploadCount: exam.uploads.length, scoreRecordPolicy: "kept" },
  });

  revalidatePath("/omr");
  redirect("/omr");
}
