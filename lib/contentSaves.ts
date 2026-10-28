/**
 * The Course Manager's saves (2026-10-28): a course, a lesson, an email
 * template and a teacher's page, moved here from their routes unchanged so
 * the RIM Guide saves through exactly the same steps
 * (app/api/guide-mcp/[key]/route.ts). Whoever calls one has already decided
 * the person may save. Each answers with the status and body its route sends.
 */

import { db } from "@/lib/db";
import { cleanupRemovedBlobs } from "@/lib/blobCleanup";
import { flagsFromAccessLevel, accessLevelFromFlags } from "@/lib/courseAccess";
import type { SaveReply } from "@/lib/programSave";

const reply = (payload: unknown, init?: { status?: number }): SaveReply => ({
  status: init?.status ?? 200,
  body: payload as Record<string, unknown>,
});

/** PATCH /api/courses/[slug]: a course's fields, and its lessons' order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveCourse(slug: string, body: any): Promise<SaveReply> {
  const course = await db.course.findUnique({ where: { slug } });
  if (!course) {
    return reply({ error: "Not found" }, { status: 404 });
  }

  // Handle lesson order update — accepts { id, groupLabel? }[] or legacy string[]
  if (body.lessonOrder && Array.isArray(body.lessonOrder)) {
    await db.courseLesson.deleteMany({ where: { courseId: course.id } });
    await db.courseLesson.createMany({
      data: body.lessonOrder.map(
        (item: string | { id: string; groupLabel?: string | null }, i: number) => ({
          courseId: course.id,
          lessonId: typeof item === "string" ? item : item.id,
          sortOrder: i,
          groupLabel: typeof item === "string" ? null : (item.groupLabel || null),
        })
      ),
    });
  }

  // Handle field updates
  const { lessonOrder, ...fields } = body;
  const updateData: Record<string, unknown> = {};

  if (fields.title !== undefined) updateData.title = fields.title;
  if (fields.slug !== undefined) {
    // Check uniqueness if slug is changing
    if (fields.slug !== slug) {
      const existing = await db.course.findUnique({ where: { slug: fields.slug } });
      if (existing) {
        return reply({ error: "A course with this slug already exists" }, { status: 409 });
      }
    }
    updateData.slug = fields.slug;
  }
  if (fields.subheading !== undefined) updateData.subheading = fields.subheading || null;
  if (fields.description !== undefined) updateData.description = fields.description || null;

  // accessLevel writes also derive the new orthogonal flags during
  // transition. The editor still posts accessLevel; this keeps the new
  // flags consistent with the legacy enum so the access helper (which
  // reads only the flags) sees the right state immediately on save.
  if (fields.accessLevel !== undefined) {
    updateData.accessLevel = fields.accessLevel;
    const flags = flagsFromAccessLevel(fields.accessLevel);
    updateData.allowSelfEnroll = flags.allowSelfEnroll;
    updateData.selfEnrollDanaRequired = flags.selfEnrollDanaRequired;
  }

  // Pass-through of orthogonal flags + content fields. The editor writes
  // these directly (slice 5 — tabbed restructure).
  if (fields.allowSelfEnroll !== undefined) updateData.allowSelfEnroll = Boolean(fields.allowSelfEnroll);

  // Legacy pass-through. New writers send danaMode directly (below);
  // this branch only fires if an older client sends only the boolean.
  // Derive a danaMode so the source-of-truth and mirror don't drift —
  // turning the boolean on yields "voluntary" (the safest default) when
  // there's no current mode; turning it off forces "none".
  if (fields.selfEnrollDanaRequired !== undefined && fields.danaMode === undefined) {
    const onNow = Boolean(fields.selfEnrollDanaRequired);
    updateData.selfEnrollDanaRequired = onNow;
    updateData.danaMode = onNow
      ? course.danaMode === "none" ? "voluntary" : course.danaMode
      : "none";
  }
  if (fields.accessRestrictionMessage !== undefined) updateData.accessRestrictionMessage = fields.accessRestrictionMessage || null;
  if (fields.heroImage !== undefined) updateData.heroImage = fields.heroImage || null;
  if (fields.pullQuote !== undefined) updateData.pullQuote = fields.pullQuote || null;
  if (fields.pullQuoteSource !== undefined) updateData.pullQuoteSource = fields.pullQuoteSource || null;
  if (fields.danaText !== undefined) updateData.danaText = fields.danaText || null;
  if (fields.categoryId !== undefined) updateData.categoryId = fields.categoryId || null;

  // Dana model (slice 5). If the client sends danaMode, derive
  // selfEnrollDanaRequired as a mirror so legacy reads stay consistent.
  if (fields.danaMode !== undefined) {
    updateData.danaMode = fields.danaMode;
    updateData.selfEnrollDanaRequired = fields.danaMode !== "none";
  }
  if (fields.suggestedDana !== undefined) {
    updateData.suggestedDana =
      fields.suggestedDana == null ? null : Number(fields.suggestedDana);
  }
  if (fields.danaBaseAmount !== undefined) {
    updateData.danaBaseAmount =
      fields.danaBaseAmount == null ? null : Number(fields.danaBaseAmount);
  }
  if (fields.danaFixedAmount !== undefined) {
    updateData.danaFixedAmount =
      fields.danaFixedAmount == null ? null : Number(fields.danaFixedAmount);
  }
  if (fields.danaMessage !== undefined) {
    updateData.danaMessage = fields.danaMessage ?? null;
  }

  if (fields.hideFromMemberProfile !== undefined) updateData.hideFromMemberProfile = fields.hideFromMemberProfile;
  if (fields.sortOrder !== undefined) updateData.sortOrder = fields.sortOrder != null ? Number(fields.sortOrder) : null;
  if (fields.isActive !== undefined) updateData.isActive = fields.isActive;
  if (fields.isOnboarding !== undefined) updateData.isOnboarding = fields.isOnboarding;
  if (fields.publishOnPublicCatalog !== undefined) updateData.publishOnPublicCatalog = fields.publishOnPublicCatalog;
  // requiredRoles is now an independent orthogonal field (session 123).
  // Empty array = no role gate; non-empty = visible/enrollable only to
  // members holding at least one listed role (ADMIN bypass). The editor
  // writes this directly. Legacy accessLevel-coupled coercion has been
  // removed — the new model treats requiredRoles as the source of truth.
  if (fields.requiredRoles !== undefined) {
    updateData.requiredRoles = Array.isArray(fields.requiredRoles)
      ? fields.requiredRoles
      : [];
  }

  if (fields.completionNote !== undefined) updateData.completionNote = fields.completionNote || null;

  // ── Keep the legacy accessLevel column in sync with the new flags ──
  // When the editor writes the new flags directly (and doesn't send
  // accessLevel), derive a legacy value from the resulting flag state.
  // Without this, the enum column can drift away from the flags after
  // any flag edit. Lossy by design — the enum drops in a later pass.
  if (
    fields.accessLevel === undefined &&
    (updateData.allowSelfEnroll !== undefined ||
      updateData.requiredRoles !== undefined)
  ) {
    const finalAllowSelfEnroll =
      updateData.allowSelfEnroll !== undefined
        ? Boolean(updateData.allowSelfEnroll)
        : course.allowSelfEnroll;
    const finalRequiredRoles = (updateData.requiredRoles as string[] | undefined) ?? (course.requiredRoles as string[]);
    updateData.accessLevel = accessLevelFromFlags({
      allowSelfEnroll: finalAllowSelfEnroll,
      requiredRoles: finalRequiredRoles,
    });
  }

  const updated = await db.course.update({
    where: { slug },
    data: updateData,
    include: {
      lessons: {
        include: { lesson: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // A new title reaches the donations that keep it, as a program's name does.
  if (typeof updateData.title === "string" && updateData.title !== course.title) {
    await db.donation.updateMany({ where: { courseId: course.id }, data: { courseTitle: updated.title } });
  }

  return reply(updated);
}

/** PATCH /api/lessons/[slug]: a lesson's fields and teachers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveLesson(slug: string, body: any): Promise<SaveReply> {
  const lesson = await db.lesson.findUnique({ where: { slug } });
  if (!lesson) {
    return reply({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.titleInternal !== undefined) updateData.titleInternal = body.titleInternal;
  if (body.titleDisplayed !== undefined) updateData.titleDisplayed = body.titleDisplayed;
  if (body.slug !== undefined) {
    if (body.slug !== slug) {
      const existing = await db.lesson.findUnique({ where: { slug: body.slug } });
      if (existing) {
        return reply({ error: "A lesson with this slug already exists" }, { status: 409 });
      }
    }
    updateData.slug = body.slug;
  }
  if (body.accessLevel !== undefined) updateData.accessLevel = body.accessLevel;
  if (body.body !== undefined) updateData.body = body.body || null;
  if (body.heroImageUrl !== undefined) updateData.heroImageUrl = body.heroImageUrl || null;
  if (body.heroImageAlt !== undefined) updateData.heroImageAlt = body.heroImageAlt || null;
  if (body.audioUrl !== undefined) updateData.audioUrl = body.audioUrl || null;
  if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl || null;
  if (body.headerQuote !== undefined) updateData.headerQuote = body.headerQuote || null;
  if (body.quoteSource !== undefined) updateData.quoteSource = body.quoteSource || null;
  if (body.resources !== undefined) updateData.resources = body.resources;
  if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl || null;
  if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes != null ? Number(body.durationMinutes) : null;
  if (body.reflectionPrompt !== undefined) updateData.reflectionPrompt = body.reflectionPrompt || null;

  // Clean up removed blob images from body
  if (body.body !== undefined) {
    cleanupRemovedBlobs(lesson.body, body.body); // fire-and-forget
  }

  const updated = await db.lesson.update({
    where: { slug },
    data: updateData,
  });

  // Handle teacher associations (User-based via isTeacher flag)
  if (body.teacherIds !== undefined) {
    await db.lessonTeacher.deleteMany({ where: { lessonId: lesson.id } });
    if (Array.isArray(body.teacherIds) && body.teacherIds.length > 0) {
      await db.lessonTeacher.createMany({
        data: body.teacherIds.map((uid: string, order: number) => ({
          lessonId: lesson.id,
          userId: uid,
          order,
        })),
      });
    }
  }

  return reply(updated);
}

/** PATCH /api/admin/emails/[slug]: an email template's subject, body and on/off. */
export async function saveEmailTemplate(
  slug: string,
  { subject, body, enabled, updatedById }: { subject?: string; body?: string; enabled?: boolean; updatedById?: string | null },
): Promise<SaveReply> {
  const template = await db.emailTemplate.findUnique({ where: { slug } });
  if (!template) return reply({ error: "Not found" }, { status: 404 });

  const updated = await db.emailTemplate.update({
    where: { slug },
    data: {
      subject,
      body,
      enabled,
      updatedById: updatedById || null,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      subject: true,
      body: true,
      enabled: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return reply({
    ...updated,
    updatedAt: updated.updatedAt.toISOString(),
    updatedBy: updated.updatedBy
      ? `${updated.updatedBy.firstName ?? ""} ${updated.updatedBy.lastName ?? ""}`.trim()
      : null,
  });
}

/** PATCH /api/admin/members/[id]/teacher-profile: a teacher's page (bio, photo, address, shown or not). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveTeacherProfile(id: string, body: any): Promise<SaveReply> {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, isTeacher: true } });
  if (!user) return reply({ error: "User not found" }, { status: 404 });

  // Validate slug uniqueness if provided
  const slug: string | null = typeof body.slug === "string" ? body.slug.trim() || null : undefined;
  if (slug !== undefined && slug !== null) {
    const conflict = await db.teacherProfile.findFirst({
      where: { slug, userId: { not: id } },
    });
    if (conflict) {
      return reply(
        { error: "That slug is already used by another teacher profile." },
        { status: 409 }
      );
    }
  }

  // Update isTeacher on User and upsert TeacherProfile in a transaction
  const [, profile] = await db.$transaction([
    db.user.update({
      where: { id },
      data: {
        ...(body.isTeacher !== undefined && { isTeacher: Boolean(body.isTeacher) }),
      },
    }),
    db.teacherProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        bio: body.bio ?? null,
        photoUrl: body.photoUrl ?? null,
        slug: slug ?? null,
        isPublic: body.isPublic ?? false,
      },
      update: {
        ...(body.bio !== undefined && { bio: body.bio || null }),
        ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
        ...(slug !== undefined && { slug }),
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      },
    }),
  ]);

  return reply({
    isTeacher: body.isTeacher !== undefined ? Boolean(body.isTeacher) : user.isTeacher,
    bio: profile.bio,
    photoUrl: profile.photoUrl,
    slug: profile.slug,
    isPublic: profile.isPublic,
  });
}
