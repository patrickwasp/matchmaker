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
import { AGE_RANGES, INTEREST_OPTIONS, INTEREST_LIMIT } from "@/lib/profile";
import {
  appendParticipant,
  getParticipantByEmail,
  updateParticipant,
} from "@/lib/googleSheets";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^(?=.{2,100}$)[\p{L}][\p{L}\p{M}' -]*$/u, "Enter a real first name or full name.");

const phoneSchema = z
  .string()
  .trim()
  .min(10)
  .max(30)
  .regex(/^[0-9()+.\-\s]+$/, "Enter a real phone number.")
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a real phone number.");

const AnswersSchema = z.object({
  name: nameSchema,
  phone_number: phoneSchema,
  age_range: z.enum(["18-25", "26-35", "36-45", "46+"]),
  preferred_age_ranges: z
    .array(z.enum(AGE_RANGES))
    .min(1)
    .max(4),
  gender: z.enum(["Man", "Woman"]),
  interests: z
    .array(
      z.enum(INTEREST_OPTIONS.map((interest) => interest.value) as [
        (typeof INTEREST_OPTIONS)[number]["value"],
        ...(typeof INTEREST_OPTIONS)[number]["value"][]
      ])
    )
    .length(INTEREST_LIMIT),
  location: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  photo_data_url: z
    .string()
    .max(45000)
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "Upload a valid image.")
    .optional(),
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
    // Update name and answers
    await updateParticipant(email, {
      name: answers.name,
      answers_json: answersJson,
    });
    return NextResponse.json({
      ...existing,
      name: answers.name,
      answers_json: answersJson,
    });
  }

  // New participant
  const participant = {
    id: uuidv4(),
    email,
    name: answers.name,
    answers_json: answersJson,
    created_at: new Date().toISOString(),
    quiz_answers_json: "",
  };
  await appendParticipant(participant);

  return NextResponse.json(participant, { status: 201 });
}
