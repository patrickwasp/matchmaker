/**
 * POST /api/delete-photo
 *
 * Deletes a profile photo from Vercel Blob Storage.
 * Only allows deletion of blobs that belong to the authenticated user
 * (verified by checking the blob path includes the user's sanitised email).
 */

import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

function extractBlobPathname(url: string) {
  if (url.startsWith("/api/photo/")) {
    return url.slice("/api/photo/".length);
  }

  if (url.startsWith("/profiles/")) {
    return url.slice(1);
  }

  try {
    const parsedUrl = new URL(url);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith("/api/photo/")) {
      return pathname.slice("/api/photo/".length);
    }

    if (pathname.startsWith("/profiles/")) {
      return pathname.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}

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

  // 2. Parse body
  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const sanitizedEmail = session.user.email.replace(/[^a-zA-Z0-9]/g, "_");
  const blobPathname = extractBlobPathname(url);
  if (!blobPathname) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const expectedPrefix = `profiles/${sanitizedEmail}/`;
  if (!blobPathname.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Delete from Vercel Blob
  try {
    await del(blobPathname);
  } catch (error) {
    console.error("Blob delete failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && process.env.NODE_ENV !== "production"
            ? `Delete failed: ${error.message}`
            : "Delete failed. Please check your blob storage configuration.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
