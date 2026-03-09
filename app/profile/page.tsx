"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ParticipantAnswers, AgeRange, Interest, LookingFor } from "@/types";

const AGE_RANGES: AgeRange[] = ["18-25", "26-35", "36-45", "46+"];

const INTERESTS: { value: Interest; label: string; emoji: string }[] = [
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "cooking", label: "Cooking", emoji: "🍳" },
  { value: "reading", label: "Reading", emoji: "📚" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "art", label: "Art", emoji: "🎨" },
  { value: "film", label: "Film", emoji: "🎬" },
];

const LOOKING_FOR: { value: LookingFor; label: string }[] = [
  { value: "friendship", label: "Friendship" },
  { value: "romance", label: "Romance" },
  { value: "networking", label: "Networking" },
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [form, setForm] = useState<Partial<ParticipantAnswers>>({
    interests: [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users to the home page
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Pre-fill the form if the user already has a profile
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.answers_json) {
          try {
            const answers: ParticipantAnswers = JSON.parse(data.answers_json);
            setForm(answers);
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, [status]);

  function toggleInterest(interest: Interest) {
    setForm((prev) => {
      const current = prev.interests ?? [];
      return {
        ...prev,
        interests: current.includes(interest)
          ? current.filter((i) => i !== interest)
          : [...current, interest],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/submit-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Network error – please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 px-4 py-10">
      {/* Nav */}
      <nav className="mx-auto mb-8 flex max-w-2xl items-center justify-between rounded-xl bg-white p-4 shadow">
        <span className="text-xl font-bold text-rose-600">💘 Matchmaker</span>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-600 sm:block">
            {session?.user?.email}
          </span>
          <button
            onClick={() => router.push("/matches")}
            className="rounded-full bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-100"
          >
            My Matches
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Form card */}
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="mb-1 text-2xl font-bold text-gray-900">
          Your Matchmaking Profile
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Fill in your details so we can find your best matches.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Display name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Display Name *
            </label>
            <input
              type="text"
              required
              value={form.display_name ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, display_name: e.target.value }))
              }
              placeholder="How you'll appear to matches"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Gender *
            </label>
            <input
              type="text"
              required
              value={form.gender ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, gender: e.target.value }))
              }
              placeholder="e.g. Man, Woman, Non-binary, …"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          {/* Age range */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Age Range *
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, age_range: r }))}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    form.age_range === r
                      ? "bg-rose-500 text-white shadow"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Interests * (select at least one)
            </label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleInterest(value)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    form.interests?.includes(value)
                      ? "bg-rose-500 text-white shadow"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Looking for */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              I&apos;m looking for *
            </label>
            <div className="flex flex-wrap gap-2">
              {LOOKING_FOR.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, looking_for: value }))}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    form.looking_for === value
                      ? "bg-rose-500 text-white shadow"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Location (optional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Location{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={form.location ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, location: e.target.value }))
              }
              placeholder="e.g. New York, Remote…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          {/* Bio (optional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Short Bio{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.bio ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, bio: e.target.value }))
              }
              rows={3}
              maxLength={500}
              placeholder="Tell potential matches a bit about yourself…"
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-rose-500 py-3 text-sm font-semibold text-white shadow hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "✅ Saved!" : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
