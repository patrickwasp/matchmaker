/**
 * POST /api/submit-profile
 *
 * Stores or updates the authenticated user's matchmaking questionnaire
 * answers in the Google Sheet "participants" tab.
 *
 * Request body must match ParticipantAnswers shape (validated with Zod).
 * Responds with the stored participant record.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { authOptions } from "@/lib/auth";
import {
  appendParticipant,
  getParticipantByEmail,
  updateParticipant,
} from "@/lib/googleSheets";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const AnswersSchema = z.object({
  display_name: z.string().min(1).max(100),
  age_range: z.enum(["18-25", "26-35", "36-45", "46+"]),
  gender: z.string().min(1).max(50),
  interests: z
    .array(
      z.enum([
        "music",
        "sports",
        "travel",
        "cooking",
        "reading",
        "gaming",
        "art",
        "film",
      ])
    )
    .min(1)
    .max(8),
  looking_for: z.enum(["friendship", "romance", "networking"]),
  location: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse & validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnswersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const answers = parsed.data;
  const email = session.user.email;
  const answersJson = JSON.stringify(answers);

  // 3. Upsert participant
  const existing = await getParticipantByEmail(email);

  if (existing) {
    // Update display_name and answers
    await updateParticipant(email, {
      display_name: answers.display_name,
      answers_json: answersJson,
    });
    return NextResponse.json({
      ...existing,
      display_name: answers.display_name,
      answers_json: answersJson,
    });
  }

  // New participant
  const participant = {
    id: uuidv4(),
    email,
    display_name: answers.display_name,
    answers_json: answersJson,
    created_at: new Date().toISOString(),
  };
  await appendParticipant(participant);

  return NextResponse.json(participant, { status: 201 });
}
