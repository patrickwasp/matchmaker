/**
 * POST /api/run-matching
 *
 * Admin-only endpoint kept for compatibility.
 *
 * Matches are now derived at read time from mutual likes, so there is no
 * persisted matches sheet to write to anymore.
 *
 * A user is considered an admin if their email is included in the
 * ADMIN_EMAILS environment variable (comma-separated list).
 *
 * Existing matches are cleared before writing new ones.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAllParticipants } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Admin guard
// ---------------------------------------------------------------------------

function isAdmin(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const participants = await getAllParticipants();

  return NextResponse.json({
    matched: 0,
    participants: participants.length,
    runtime: true,
    message: "Matches are calculated at runtime from mutual likes.",
  });
}
