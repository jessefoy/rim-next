import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is not configured" }, { status: 500 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Auth check here — only runs for token generation requests from the browser,
        // not for the completion callback from Vercel's servers
        const session = await auth();
        if (!session?.user) {
          throw new Error("Unauthorized");
        }
        // ADMIN and SUPPORT: any content type (support inbox needs arbitrary files)
        // Everyone else: media types only (images, audio, PDFs for documents/lessons)
        const hasFullAccess = session.user.roles?.some((r) => ["SUPPORT", "ADMIN"].includes(r));
        return {
          allowedContentTypes: hasFullAccess ? undefined : ["image/*", "audio/*", "application/pdf"],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
        };
      },
      onUploadCompleted: async () => {
        // No post-upload processing needed
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("Blob upload failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
