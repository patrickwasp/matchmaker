/**
 * POST /api/run-matching
 *
 * Admin-only endpoint that reads all participants from the Google Sheet,
 * runs the compatibility matching algorithm, and writes results to the
 * "matches" sheet tab.
 *
 * A user is considered an admin if their email is included in the
 * ADMIN_EMAILS environment variable (comma-separated list).
 *
 * Existing matches are cleared before writing new ones.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getAllParticipants,
  clearMatches,
  appendMatches,
} from "@/lib/googleSheets";
import { generateMatches } from "@/utils/matching";

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

  // 1. Fetch all participants
  const participants = await getAllParticipants();
  if (participants.length < 2) {
    return NextResponse.json(
      { error: "Not enough participants to match (need at least 2)" },
      { status: 400 }
    );
  }

  // 2. Generate matches
  const matches = generateMatches(participants);

  // 3. Persist: clear old matches then write new ones
  await clearMatches();
  await appendMatches(matches);

  return NextResponse.json({
    matched: matches.length,
    participants: participants.length,
    matches,
  });
}
