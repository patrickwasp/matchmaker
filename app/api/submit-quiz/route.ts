import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { AGE_RANGES } from "@/lib/profile";
import {
    getParticipantByEmail,
    getQuizQuestions,
    updateParticipant,
    updateParticipantQuizAnswers,
} from "@/lib/googleSheets";
import type { ParticipantAnswers } from "@/types";

const QuizPayloadSchema = z.object({
    preferred_age_ranges: z.array(z.enum(AGE_RANGES)).min(1).max(4),
    answers: z
        .record(
            z.string(),
            z.object({
                self: z.string().min(1),
            })
        )
        .default({}),
});

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = QuizPayloadSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed" }, { status: 422 });
    }

    const participant = await getParticipantByEmail(session.user.email);
    if (!participant) {
        return NextResponse.json(
            { error: "Profile not found. Please finish your profile first." },
            { status: 404 }
        );
    }

    let existingAnswers: ParticipantAnswers;
    try {
        existingAnswers = JSON.parse(participant.answers_json) as ParticipantAnswers;
    } catch {
        return NextResponse.json({ error: "Profile data is invalid." }, { status: 500 });
    }

    const questions = (await getQuizQuestions()).filter((question) => question.enabled);
    const answers = parsed.data.answers;

    const invalidQuestion = questions.find((question) => {
        const answer = answers[question.id];
        if (!answer) {
            return true;
        }

        const allowedValues = new Set(question.options.map((option) => option.value));
        if (!allowedValues.has(answer.self)) {
            return true;
        }

        return false;
    });

    if (invalidQuestion) {
        return NextResponse.json(
            { error: `Missing or invalid answer for ${invalidQuestion.id}` },
            { status: 422 }
        );
    }

    const filteredAnswers = Object.fromEntries(
        questions.map((question) => [question.id, answers[question.id]])
    );

    await updateParticipantQuizAnswers(
        session.user.email,
        JSON.stringify(filteredAnswers)
    );

    await updateParticipant(session.user.email, {
        name: participant.name,
        answers_json: JSON.stringify({
            ...existingAnswers,
            preferred_age_ranges: parsed.data.preferred_age_ranges,
        }),
    });

    return NextResponse.json({ ok: true });
}