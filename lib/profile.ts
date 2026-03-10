import type { AgeRange, Gender, Interest } from "@/types";

export const AGE_RANGES: AgeRange[] = ["18-25", "26-35", "36-45", "46+"];

export const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
    { value: "Man", label: "Man", emoji: "👨" },
    { value: "Woman", label: "Woman", emoji: "👩" },
];

export const INTEREST_LIMIT = 3;

export const INTEREST_OPTIONS: { value: Interest; label: string; emoji: string }[] = [
    { value: "music", label: "Live music nights", emoji: "🎵" },
    { value: "travel", label: "Weekend escapes", emoji: "✈️" },
    { value: "cooking", label: "Cooking together", emoji: "🍳" },
    { value: "reading", label: "Bookshop dates", emoji: "📚" },
    { value: "fitness", label: "Gym mornings", emoji: "🏋️" },
    { value: "art", label: "Gallery hopping", emoji: "🎨" },
    { value: "beach", label: "Beach days", emoji: "🏖️" },
    { value: "dogs", label: "Dog walks", emoji: "🐶" },
];

export function getOppositeGender(gender: Gender): Gender {
    return gender === "Man" ? "Woman" : "Man";
}