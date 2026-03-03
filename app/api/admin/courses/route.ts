import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { allCoursesWithLinkedProgramsQuery } from "@/lib/queries";

export interface AdminCourse {
  slug: string;
  name: string;
  accessLevel: string | null;
  linkedByPrograms: { slug: string; name: string }[];
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const courses = await sanityClient.fetch<AdminCourse[]>(
    allCoursesWithLinkedProgramsQuery
  );

  return NextResponse.json(courses);
}
