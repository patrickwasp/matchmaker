import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getOppositeGender } from "@/lib/profile";
import { normalizeQuizAnswers } from "@/lib/quiz";
import {
    getAllParticipants,
    getAllLikes,
    getParticipantByEmail,
} from "@/lib/googleSheets";
import { computeScore } from "@/utils/matching";
import type { ParticipantAnswers, ParticipantQuizAnswers, ResultsResponse } from "@/types";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await getParticipantByEmail(session.user.email);
    if (!me) {
        return NextResponse.json(
            { error: "Profile not found. Please submit your profile first." },
            { status: 404 }
        );
    }

    let myAnswers: ParticipantAnswers;
    try {
        myAnswers = JSON.parse(me.answers_json);
    } catch {
        return NextResponse.json({ error: "Profile data is invalid." }, { status: 500 });
    }

    const targetGender = getOppositeGender(myAnswers.gender);
    const myQuizAnswers = normalizeQuizAnswers(
        me.quiz_answers_json ? JSON.parse(me.quiz_answers_json) : undefined
    );

    const [allParticipants, likes] = await Promise.all([
        getAllParticipants(),
        getAllLikes(),
    ]);

    const likedByMe = new Set(
        likes
            .filter((like) => like.liker_id === me.id && like.liked)
            .map((like) => like.liked_id)
    );
    const likedYou = new Set(
        likes
            .filter((like) => like.liked_id === me.id && like.liked)
            .map((like) => like.liker_id)
    );

    const ranked = allParticipants
        .filter((participant) => participant.id !== me.id)
        .map((participant) => {
            try {
                const answers = JSON.parse(participant.answers_json) as ParticipantAnswers;
                return {
                    participant,
                    answers,
                    quizAnswers: normalizeQuizAnswers(
                        participant.quiz_answers_json
                            ? JSON.parse(participant.quiz_answers_json)
                            : undefined
                    ),
                };
            } catch {
                return null;
            }
        })
        .filter(
            (
                item
            ): item is {
                participant: (typeof allParticipants)[number];
                answers: ParticipantAnswers;
                quizAnswers: ParticipantQuizAnswers | undefined;
            } => Boolean(item)
        )
        .filter((item) => item.answers.gender === targetGender)
        .map((item) => {
            const mutualMatch = likedByMe.has(item.participant.id) && likedYou.has(item.participant.id);
            return {
                id: item.participant.id,
                name: item.answers.name,
                interests: item.answers.interests,
                age_range: item.answers.age_range,
                bio: item.answers.bio,
                location: item.answers.location,
                photo_data_url: item.answers.photo_data_url,
                score: computeScore(myAnswers, item.answers, myQuizAnswers, item.quizAnswers),
                likedByMe: likedByMe.has(item.participant.id),
                likedYou: likedYou.has(item.participant.id),
                mutualMatch,
                phone_number: mutualMatch ? item.answers.phone_number : undefined,
            };
        })
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    const response: ResultsResponse = {
        matches: ranked.filter((profile) => profile.mutualMatch),
        browse: ranked,
        targetGender,
    };

    return NextResponse.json(response);
}