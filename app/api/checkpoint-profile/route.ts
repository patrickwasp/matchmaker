/**
 * POST /api/checkpoint-profile
 *
 * Saves a partial profile checkpoint for the authenticated user.
 * All fields are optional — this is called on each step of the profile
 * wizard so progress is persisted incrementally without requiring the
 * entire form to be complete.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { authOptions } from "@/lib/auth";
import { AGE_RANGES, INTEREST_OPTIONS } from "@/lib/profile";
import {
  appendParticipant,
  getParticipantByEmail,
  updateParticipant,
} from "@/lib/googleSheets";

const interestValues = INTEREST_OPTIONS.map((i) => i.value) as [
  string,
  ...string[]
];

const CheckpointSchema = z.object({
  name: z.string().trim().max(100).optional(),
  phone_number: z.string().trim().max(30).optional(),
  age_range: z.enum(["18-25", "26-35", "36-45", "46+"]).optional(),
  preferred_age_ranges: z.array(z.enum(AGE_RANGES)).optional(),
  gender: z.enum(["Man", "Woman"]).optional(),
  interests: z.array(z.enum(interestValues)).optional(),
  location: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  photo_data_url: z.string().max(45000).optional(),
});

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

  const parsed = CheckpointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const email = session.user.email;
  const answersJson = JSON.stringify(data);

  // 3. Upsert participant
  const existing = await getParticipantByEmail(email);

  if (existing) {
    await updateParticipant(email, {
      name: data.name ?? existing.name,
      answers_json: answersJson,
    });
    return NextResponse.json({ ok: true });
  }

  // New participant — create row with whatever partial data is available
  const participant = {
    id: uuidv4(),
    email,
    name: data.name ?? "",
    answers_json: answersJson,
    created_at: new Date().toISOString(),
    quiz_answers_json: "",
  };
  await appendParticipant(participant);

  return NextResponse.json({ ok: true }, { status: 201 });
}
