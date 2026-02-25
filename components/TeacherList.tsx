import Link from "next/link";

/**
 * TeacherList — teacher-container w-inline-block rows
 *
 * variant="lesson"    → image-11 class, shows "By " prefix (lessons, class-recordings)
 * variant="program"   → facilitator class (35×35), no "By " prefix (programs, volunteer positions)
 */

export type TeacherListTeacher = {
  name: string;
  slug: { current: string };
  bioPicture?: { asset?: { url?: string } };
};

type TeacherListVariant = "lesson" | "program";

export default function TeacherList({
  teachers,
  variant = "lesson",
}: {
  teachers: TeacherListTeacher[];
  variant?: TeacherListVariant;
}) {
  if (!teachers || teachers.length === 0) return null;

  return (
    <div className="lesson-teachers">
      {teachers.map((teacher) => (
        <Link
          key={teacher.slug.current}
          href={`/team/${teacher.slug.current}`}
          className="teacher-container w-inline-block"
        >
          {teacher.bioPicture?.asset?.url && (
            variant === "lesson" ? (
              <img
                src={teacher.bioPicture.asset.url}
                alt={teacher.name}
                className="image-11"
                loading="lazy"
              />
            ) : (
              <img
                src={teacher.bioPicture.asset.url}
                alt={teacher.name}
                className="facilitator"
                width={35}
                height={35}
              />
            )
          )}
          {variant === "lesson" && (
            <div className="facilitator-name letter-space">By </div>
          )}
          <div className="facilitator-name underline">{teacher.name}</div>
        </Link>
      ))}
    </div>
  );
}
