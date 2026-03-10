import type {
    ParticipantQuizAnswer,
    ParticipantQuizAnswers,
    QuizQuestion,
} from "@/types";

export const DEFAULT_QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        id: "weekend_rhythm",
        prompt: "A Saturday that genuinely sounds good to you",
        options: [
            { value: "quiet", label: "Slow morning, good coffee, unhurried plans", emoji: "☕" },
            { value: "host", label: "Having people over, cooking, or hosting something simple", emoji: "🍝" },
            { value: "adventure", label: "Out for a hike, market, museum, or day trip", emoji: "🌿" },
        ],
        position: 1,
        enabled: true,
    },
    {
        id: "communication_style",
        prompt: "When you are getting to know someone, you tend to be",
        options: [
            { value: "steady", label: "Warm and consistent over text", emoji: "💬" },
            { value: "direct", label: "Best with calls and clear plans", emoji: "📞" },
            { value: "present", label: "Much better in person than on a screen", emoji: "🫶" },
        ],
        position: 2,
        enabled: true,
    },
    {
        id: "home_style",
        prompt: "The kind of home life that sounds most like you is",
        options: [
            { value: "cozy", label: "Peaceful, grounded, and cozy", emoji: "🏡" },
            { value: "welcoming", label: "Warm, hospitable, and open to people", emoji: "🕯️" },
            { value: "active", label: "Flexible, active, and often on the move", emoji: "🚗" },
        ],
        position: 3,
        enabled: true,
    },
    {
        id: "social_style",
        prompt: "Your social life feels best when it is",
        options: [
            { value: "close_circle", label: "Mostly one-on-one or close circle time", emoji: "🥂" },
            { value: "regular_gatherings", label: "A few dependable dinners and group hangs", emoji: "🍷" },
            { value: "full_calendar", label: "Active, busy, and often on the go", emoji: "🎉" },
        ],
        position: 4,
        enabled: true,
    },
    {
        id: "life_pace",
        prompt: "Your pace of life usually feels",
        options: [
            { value: "intentional", label: "Deliberate, calm, and not rushed", emoji: "🕊️" },
            { value: "steady", label: "Full but balanced", emoji: "🌱" },
            { value: "fast", label: "Ambitious, busy, and moving quickly", emoji: "⚡" },
        ],
        position: 5,
        enabled: true,
    },
];

export function sortQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
    return [...questions].sort((left, right) => left.position - right.position);
}

export function normalizeQuizAnswers(
    input: unknown
): ParticipantQuizAnswers | undefined {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return undefined;
    }

    const entries = Object.entries(input)
        .map(([key, value]) => {
            if (typeof key !== "string") {
                return null;
            }

            if (typeof value === "string" && value) {
                return [key, { self: value }] as [string, ParticipantQuizAnswer];
            }

            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return null;
            }

            const self = "self" in value && typeof value.self === "string" ? value.self : null;

            if (!self) {
                return null;
            }

            return [key, { self }] as [string, ParticipantQuizAnswer];
        })
        .filter((entry): entry is [string, ParticipantQuizAnswer] => entry !== null);

    if (entries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(entries);
}