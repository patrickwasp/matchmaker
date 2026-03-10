import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { getQuizQuestions, replaceQuizQuestions } from "@/lib/storage";

const QuizQuestionSchema = z.object({
    id: z.string().min(1),
    prompt: z.string().min(1).max(200),
    options: z
        .array(
            z.object({
                value: z.string().min(1).max(100),
                label: z.string().min(1).max(100),
                emoji: z.string().max(10).optional(),
            })
        )
        .min(2)
        .max(6),
    position: z.number().int().min(1).max(20),
    enabled: z.boolean(),
});

const QuizQuestionsPayloadSchema = z.object({
    questions: z.array(QuizQuestionSchema).min(1).max(20),
});

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questions = await getQuizQuestions();
    return NextResponse.json(questions);
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminEmail(session.user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = QuizQuestionsPayloadSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed" }, { status: 422 });
    }

    await replaceQuizQuestions(parsed.data.questions);
    return NextResponse.json({ ok: true });
}