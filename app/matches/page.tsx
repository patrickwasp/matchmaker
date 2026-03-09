"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MatchWithPartner } from "@/types";

const INTEREST_EMOJIS: Record<string, string> = {
  music: "🎵",
  sports: "⚽",
  travel: "✈️",
  cooking: "🍳",
  reading: "📚",
  gaming: "🎮",
  art: "🎨",
  film: "🎬",
};

export default function MatchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [matches, setMatches] = useState<MatchWithPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/my-matches")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load matches");
        setMatches(data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
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
          <button
            onClick={() => router.push("/profile")}
            className="rounded-full bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-100"
          >
            My Profile
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl">
        <h2 className="mb-1 text-2xl font-bold text-gray-900">
          Your Matches
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Signed in as {session?.user?.email}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!error && matches.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-xl">
            <div className="mb-3 text-5xl">🔍</div>
            <p className="text-gray-500">
              No matches yet. Check back after the admin runs the matching
              algorithm!
            </p>
          </div>
        )}

        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.match_id}
              className="rounded-2xl bg-white p-6 shadow-lg"
            >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-2xl">
                    💖
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {match.partner.display_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {match.partner.age_range} · {match.partner.location ?? "Undisclosed location"}
                    </p>
                  </div>
                </div>
                {/* Compatibility score badge */}
                <div className="flex flex-col items-center rounded-xl bg-rose-50 px-3 py-1.5">
                  <span className="text-lg font-bold text-rose-600">
                    {match.score.toFixed(1)}
                  </span>
                  <span className="text-xs text-rose-400">/10</span>
                </div>
              </div>

              {/* Bio */}
              {match.partner.bio && (
                <p className="mb-3 text-sm text-gray-600 italic">
                  &quot;{match.partner.bio}&quot;
                </p>
              )}

              {/* Interests */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {match.partner.interests.map((i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {INTEREST_EMOJIS[i]} {i}
                  </span>
                ))}
              </div>

              {/* Looking for */}
              <p className="text-xs text-gray-400">
                Looking for:{" "}
                <span className="font-medium text-gray-600 capitalize">
                  {match.partner.looking_for}
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-300">
                Matched{" "}
                {new Date(match.revealed_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
