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

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // 3. Verify ownership – parse the URL and check that the path starts
  //    with /profiles/{sanitizedEmail}/ so a crafted subdirectory can't spoof it
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const sanitizedEmail = session.user.email.replace(/[^a-zA-Z0-9]/g, "_");
  const expectedPrefix = `/profiles/${sanitizedEmail}/`;
  if (!parsedUrl.pathname.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Delete from Vercel Blob
  await del(url);

  return NextResponse.json({ ok: true });
}
