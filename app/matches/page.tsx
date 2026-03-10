"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { INTEREST_OPTIONS } from "@/lib/profile";
import type { ResultsProfile, ResultsResponse } from "@/types";

type Tab = "top-picks" | "matches";
type SwipeDirection = "left" | "right";

function cardContainerClasses(featured: boolean) {
  return [
    "rounded-[28px] border bg-white p-5 shadow-[0_18px_60px_rgba(148,24,70,0.08)] transition duration-200",
    featured ? "border-rose-200" : "border-white/80",
  ].join(" ");
}

function heartButtonClasses(active: boolean) {
  return [
    "flex h-11 w-11 items-center justify-center rounded-full border text-xl transition duration-200",
    active
      ? "border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-200"
      : "border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50",
  ].join(" ");
}

export default function MatchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("top-picks");
  const [matches, setMatches] = useState<ResultsProfile[]>([]);
  const [browse, setBrowse] = useState<ResultsProfile[]>([]);
  const [targetGender, setTargetGender] = useState<ResultsResponse["targetGender"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tabDirection, setTabDirection] = useState<SwipeDirection>("right");
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const interestLookup = useMemo(() => {
    return Object.fromEntries(INTEREST_OPTIONS.map((interest) => [interest.value, interest])) as Record<
      (typeof INTEREST_OPTIONS)[number]["value"],
      (typeof INTEREST_OPTIONS)[number]
    >;
  }, []);

  async function loadResults() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/results");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load results");
      }
      const results = data as ResultsResponse;
      setMatches(results.matches);
      setBrowse(results.browse);
      setTargetGender(results.targetGender);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [router, status]);

  useEffect(() => {
    if (status === "authenticated") {
      loadResults();
    }
  }, [status]);

  async function handleToggleLike(profile: ResultsProfile) {
    setTogglingId(profile.id);
    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetParticipantId: profile.id,
          liked: !profile.likedByMe,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update like");
      }
      await loadResults();
      if (data.mutualMatch) {
        setCelebratingId(profile.id);
        window.setTimeout(() => setCelebratingId((current) => (current === profile.id ? null : current)), 1400);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update like");
    } finally {
      setTogglingId(null);
    }
  }

  function switchTab(nextTab: Tab) {
    if (nextTab === tab) {
      return;
    }

    setTabDirection(nextTab === "matches" ? "right" : "left");
    setTab(nextTab);
  }

  function renderProfileCard(profile: ResultsProfile, featured: boolean) {
    const isCelebrating = celebratingId === profile.id;

    return (
      <article
        key={profile.id}
        className={[
          "relative overflow-hidden",
          cardContainerClasses(featured),
          isCelebrating ? "animate-match-glow border-emerald-300 bg-emerald-50/40" : "",
        ].join(" ")}
      >
        {isCelebrating && <div className="match-burst" />}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.photo_data_url ? (
              <img
                src={profile.photo_data_url}
                alt={profile.name}
                className="h-16 w-16 rounded-[24px] object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-rose-100 text-3xl">
                {targetGender === "Woman" ? "👩" : "👨"}
              </div>
            )}
            <div>
              <p className="text-xl font-semibold text-slate-900">{profile.name}</p>
              <p className="text-sm text-slate-500">
                {profile.age_range}
                {profile.location ? ` · ${profile.location}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => handleToggleLike(profile)}
              disabled={togglingId === profile.id}
              className={`${heartButtonClasses(profile.likedByMe)} ${togglingId === profile.id ? "animate-heart-pop" : ""}`}
              aria-label={profile.likedByMe ? `Unlike ${profile.name}` : `Like ${profile.name}`}
            >
              {profile.likedByMe ? "♥" : "♡"}
            </button>

            <div className="rounded-[20px] bg-slate-100 px-3 py-2 text-center text-slate-700">
              <p className="text-lg font-bold">{profile.score.toFixed(1)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Fit
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.mutualMatch && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Match
            </span>
          )}
          {!profile.mutualMatch && profile.likedYou && (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
              Likes you
            </span>
          )}
          {profile.likedByMe && !profile.mutualMatch && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
              You liked them
            </span>
          )}
        </div>

        {profile.bio && <p className="mt-4 text-sm leading-6 text-slate-600">{profile.bio}</p>}

        {profile.mutualMatch && profile.phone_number && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mt-4 rounded-[24px] bg-emerald-50 px-4 py-4 text-sm text-emerald-800"
          >
            <p className="font-semibold">Matched. Reach out.</p>
            <p className="mt-1">{profile.phone_number}</p>
          </motion.div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {interestLookup[interest]?.emoji} {interestLookup[interest]?.label ?? interest}
            </span>
          ))}
        </div>
      </article>
    );
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-slate-500">Loading your results…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col [transform:translateZ(0)]">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
        <div>
          <p className="text-base font-bold text-rose-600">Matchmaker</p>
          <p className="text-xs leading-tight text-slate-400">{session?.user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/profile")}
            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
          >
            Edit profile
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="relative grid grid-cols-2 gap-2 rounded-[28px] bg-slate-100 p-1">
          <div
            className="absolute bottom-1 top-1 w-[calc(50%-0.125rem)] rounded-[24px] bg-white shadow-sm transition-transform duration-200 ease-out [transform:translateZ(0)]"
            style={{ transform: `translateX(${tab === "top-picks" ? "0%" : "100%"})` }}
          />
          <button
            type="button"
            onClick={() => switchTab("top-picks")}
            className={[
              "relative z-10 rounded-[24px] px-4 py-3 text-sm font-semibold transition",
              tab === "top-picks" ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            Top Picks
          </button>
          <button
            type="button"
            onClick={() => switchTab("matches")}
            className={[
              "relative z-10 rounded-[24px] px-4 py-3 text-sm font-semibold transition",
              tab === "matches"
                ? "text-slate-900"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            Matches
          </button>
        </div>

        {error && (
          <div className="rounded-[28px] bg-red-50 px-4 py-4 text-sm text-red-600">{error}</div>
        )}

        {!error && (
          <AnimatePresence mode="wait" initial={false} custom={tabDirection}>
            {tab === "matches" && (
              <motion.div
                key="matches"
                custom={tabDirection}
                variants={{
                  enter: (dir: SwipeDirection) => ({ x: dir === "right" ? 32 : -32, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: SwipeDirection) => ({ x: dir === "right" ? -32 : 32, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-4 overflow-hidden"
              >
                {matches.length === 0 ? (
                  <div className={cardContainerClasses(false)}>
                    <p className="text-lg font-semibold text-slate-900">No matches yet</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Mutual likes land here, with phone numbers revealed right away.
                    </p>
                  </div>
                ) : (
                  matches.map((profile) => renderProfileCard(profile, true))
                )}
              </motion.div>
            )}

            {tab === "top-picks" && (
              <motion.div
                key="top-picks"
                custom={tabDirection}
                variants={{
                  enter: (dir: SwipeDirection) => ({ x: dir === "right" ? 32 : -32, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: SwipeDirection) => ({ x: dir === "right" ? -32 : 32, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-4 overflow-hidden"
              >
                {browse.map((profile) => renderProfileCard(profile, profile.mutualMatch))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}