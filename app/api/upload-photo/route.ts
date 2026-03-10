/**
 * POST /api/upload-photo
 *
 * Accepts a single WebP image file (FormData field "file") and uploads it to
 * Vercel Blob Storage. Returns the public URL of the uploaded blob.
 *
 * The blob is stored under profiles/{sanitised-email}/{timestamp}.webp so
 * ownership can be verified by the delete endpoint.
 */

import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      access: "public",
      contentType: "image/webp",
    });

    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 }
    );
  }
}
