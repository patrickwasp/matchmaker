/**
 * POST /api/init-sheets
 *
 * Admin-only endpoint that creates the participants, quiz_questions, and likes
 * sheet tabs and writes the correct header row into each one if needed.
 * Safe to call multiple times.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { initializeSheets } from "@/lib/googleSheets";

function isAdmin(email: string): boolean {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return adminEmails.includes(email.toLowerCase());
}

export async function POST() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    if (!isAdmin(session.user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        await initializeSheets();
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("init-sheets error", err);
        return NextResponse.json(
            { error: "Failed to initialise sheets." },
            { status: 500 }
        );
    }
}
