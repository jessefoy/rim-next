/**
 * update-manual-course-hub.mjs — Targeted drift fix for the
 * Courses & Lessons chapter.
 *
 * The original (extracted from the retired ManualContent.tsx) is 642
 * lines and was written before Course Manager moved from the Course
 * Hub to /tools/learning (session 76). It claims teachers manage
 * series and lessons inside the Course Hub at /account/hub/courses/
 * — that's no longer true. Series and lessons are now managed in
 * the Course Manager tool at /tools/learning. The Course Hub is now
 * the team workspace (conversations, documents, members) with an
 * app link to the Course Manager.
 *
 * This is a "remove what's wrong" pass. The replacement is shorter
 * and accurate; rich field-by-field detail can come back in a
 * future focused rewrite.
 *
 * Body is plain HTML string. Idempotent at the record level.
 * Wired into migrate.mjs with a v1 flag.
 */

const COURSE_HUB_BODY = `<p>The courses system at RIM is a library of structured teaching materials — public dharma series, retreat recordings, study collections, internal volunteer training, role-specific content. All of it lives in the same system, organized by access level.</p>
<p>The system has two building blocks:</p>
<ul>
<li><strong>A series</strong> is a container — a course, a collection, a training program. The series page is where members go to see the lesson list, track progress, and work through the content.</li>
<li><strong>A lesson</strong> is a single piece of content — an audio recording, a video, a written teaching, a guided practice, or a mix.</li>
</ul>
<p>A lesson can belong to more than one series. A guided breathing meditation might appear in an introductory series for new members, in a retreat preparation series, and in a standalone lesson library, all at once. The lesson is created once; the series just references it.</p>
<p>A naming note: the database still uses the word "Course" and the URL is still <code>/course/[slug]</code>. Throughout the staff UI and to members, the word <strong>Series</strong> is used — it better fits how these collections are actually used at RIM. They mean the same thing.</p>
<h2>Where members find courses</h2>
<p><strong>The browse page at <code>/courses/</code>.</strong> Any logged-in member can see all active series. They can filter by category. Each series shows an enrollment status — blank if not enrolled, "Enrolled" with a progress indicator if working through it, "Completed" if finished, or "Registration required" for series gated by program registration.</p>
<p><strong>The library at <code>/account/courses/</code>.</strong> A member's personal view, organized by progress: in progress, not started, completed.</p>
<p><strong>The series page at <code>/course/[slug]</code>.</strong> The series page itself, with the title, optional description, and the lesson list as cards. When enrolled, a progress bar and a Continue button appear.</p>
<p><strong>The lesson page at <code>/lessons/[slug]</code>.</strong> Each lesson has its own page with an audio player when there's audio, body content, teacher names, downloadable resources, and a <strong>Mark as complete</strong> button at the bottom.</p>
<h2>Access levels</h2>
<p>Every series has an access level that controls who can view it. Access is the door; enrollment is the decision to walk through it.</p>
<ul>
<li><strong>All Members.</strong> Any logged-in member can view.</li>
<li><strong>Registration Required.</strong> Access is granted when the member registers for a linked program.</li>
<li><strong>Role Required.</strong> Access is granted to members holding one of the selected roles. Used for volunteer training and role-specific content.</li>
</ul>
<p>An admin can override any of these from a member's profile page. Edge cases — scholarships, members who missed registration, anyone who needs access to a role-gated series without holding the role — are handled this way.</p>
<h2>Enrollment</h2>
<p>Enrollment is the act of saying "I want to work through this series." There are four ways a member becomes enrolled:</p>
<ul>
<li><strong>Self.</strong> The member clicks "Enroll in this series" on the series page. They can un-enroll later from their library.</li>
<li><strong>Program.</strong> Registration for a linked program enrolls them automatically. Cannot be self-removed.</li>
<li><strong>Onboarding.</strong> New members are auto-enrolled in series marked as onboarding. Cannot be self-removed.</li>
<li><strong>Role.</strong> A volunteer role is assigned that matches one of the series' required roles. Auto-enrolled.</li>
</ul>
<p>When access is granted by an admin, enrollment happens automatically too — the member doesn't have to find the series and click Enroll.</p>
<h2>Completion</h2>
<p>At the bottom of every lesson page, there's a <strong>Mark as complete</strong> button. Clicking it records the completion. Clicking again un-marks it — useful if a member wants to revisit fresh.</p>
<p>Series progress shows on the series page when a member is enrolled: <em>"3 of 8 complete."</em> The Continue button skips to the next incomplete, available lesson.</p>
<p>When the last lesson is marked complete, the lesson page shows a quiet completion message: <em>"You've completed this series. Take a moment to let that land."</em> If the teacher wrote a completion note for the series, it appears below in italic text. The series moves to the Completed section of the member's library — fully accessible, encouraged to revisit.</p>
<h2>Where the work happens</h2>
<p>There are two surfaces for the courses team — they serve different purposes.</p>
<p><strong>The Course Manager</strong> at <strong>/tools/learning</strong> is where series and lessons are created and managed. Two main views:</p>
<ul>
<li><strong>Series</strong> — create new series, edit existing ones, manage the lesson list, set access levels, configure drip scheduling.</li>
<li><strong>Lessons</strong> — create new lessons, edit existing ones, upload media, assign teachers, add downloadable resources.</li>
</ul>
<p>The Course Manager is where teachers and the courses team spend most of their working time.</p>
<p><strong>The Course Hub</strong> at <strong>/account/hub/courses/</strong> is the team workspace — conversations, documents, members, and an app link to the Course Manager. The Course Hub itself doesn't house the series or lessons editor; it's where the team coordinates.</p>
<h2>Who has access to what</h2>
<ul>
<li><strong>TEACHER role</strong> grants access to the Course Manager and Course Hub by default.</li>
<li><strong>ADMIN</strong> has access to everything.</li>
<li><strong>Course Hub membership</strong> can also be person-assigned, separately from roles. An admin grants access from a member's profile page in the <strong>Hub Access</strong> section. This matters for visiting teachers who contribute one series — they can have hub access without holding a global TEACHER role.</li>
</ul>
<h2>A note on the slug</h2>
<p>A series' slug is part of its URL. Once a series is published and members are enrolled, <strong>don't change the slug.</strong> Changing it breaks every existing link — bookmarks, emails, anything that linked to that series page. The slug field in the editor is locked by default for this reason.</p>`;

export async function updateManualCourseHub(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "course-hub" },
    select: { id: true },
  });

  const data = {
    title: "Courses & Lessons",
    description: "How RIM's series and lessons are organized, accessed, and managed.",
    hubSlug: "courses",
    body: COURSE_HUB_BODY,
    relations: ["volunteer-roles", "registration"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "course-hub" },
      data,
    });
    console.log("  ✔ Updated manual section: course-hub");
  } else {
    await db.manualSection.create({
      data: { slug: "course-hub", order: 5, ...data },
    });
    console.log("  ✔ Created manual section: course-hub");
  }
}
