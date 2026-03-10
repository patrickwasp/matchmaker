/**
 * POST /api/upload-photo
 *
 * Accepts a single WebP image file (FormData field "file") and uploads it to
 * Vercel Blob Storage. Returns a relative app path that serves the private
 * blob through a serverless route.
 *
 * The blob is stored under profiles/{sanitised-email}/{timestamp}.webp so
 * ownership can be verified by the delete endpoint.
 */

import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { buildPhotoProxyPath } from "@/lib/photoUrls";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Blob storage is not configured locally. Run `vercel link` and `vercel env pull .env.local`, then restart the dev server.",
      },
      { status: 500 }
    );
  }

  // 2. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large (max 2 MB)" },
      { status: 413 }
    );
  }

  // 3. Build a scoped storage path so we can verify ownership on delete
  const sanitizedEmail = session.user.email.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `profiles/${sanitizedEmail}/${Date.now()}.webp`;

  // 4. Upload to Vercel Blob
  try {
    const blob = await put(filename, file, {
      access: "private",
      contentType: "image/webp",
    });

    const photoUrl = buildPhotoProxyPath(blob.pathname);

    return NextResponse.json({ url: photoUrl });
  } catch (error) {
    console.error("Blob upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && process.env.NODE_ENV !== "production"
            ? `Upload failed: ${error.message}`
            : "Upload failed. Please check your blob storage configuration.",
      },
      { status: 502 }
    );
  }
}
