"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { INTEREST_OPTIONS } from "@/lib/profile";
import type { ResultsProfile, ResultsResponse } from "@/types";

type Tab = "top-picks" | "matches";
type SwipeDirection = "left" | "right";
type MatchDialog = {
  id: string;
  name: string;
  phoneNumber?: string;
  matchPhotoUrl?: string;
  myPhotoUrl?: string;
};

const TOP_PICKS_PAGE_SIZE = 12;

const HEART_PATH =
  "M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z";
const PARTICLE_COLORS = ["#ff6b9d", "#ff3366", "#ff8cc8", "#ffb3d1", "#ff4d88", "#c62a6b", "#ffaad4"];

interface HeartParticleData {
  id: number;
  x: number;
  y: number;
  size: number;
  angle: number;
  color: string;
}

function HeartParticle({ x, y, size, angle, color }: Omit<HeartParticleData, "id">) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        pointerEvents: "none",
        animation: "heartFloatFade 1s ease-out forwards",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      >
        <path d={HEART_PATH} fill={color} />
      </svg>
    </div>
  );
}

function HeartButton({
  active,
  disabled,
  ariaLabel,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  const [particles, setParticles] = useState<HeartParticleData[]>([]);
  const [beating, setBeating] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  function handleClick() {
    onClick();
    if (active) return; // only burst when liking

    setBeating(true);
    setRinging(true);
    setTimeout(() => setBeating(false), 420);
    setTimeout(() => setRinging(false), 1050);

    const rect = btnRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const newParticles = Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * 360 + Math.random() * 20 - 10;
      const rad = (angle * Math.PI) / 180;
      const dist = 60 + Math.random() * 70;
      const size = 10 + Math.random() * 16;
      return {
        id: ++counterRef.current,
        x: cx + Math.cos(rad) * dist,
        y: cy + Math.sin(rad) * dist,
        size,
        angle: Math.random() * 360,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      };
    });

    setParticles((p) => [...p, ...newParticles]);
    setTimeout(() => {
      setParticles((p) => p.filter((particle) => !newParticles.find((n) => n.id === particle.id)));
    }, 1100);
  }

  return (
    <>
      {portalTarget &&
        particles.length > 0 &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
            {particles.map((p) => (
              <HeartParticle key={p.id} {...p} />
            ))}
          </div>,
          portalTarget
        )}
      <div style={{ position: "relative" }}>
        {ringing && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: "1.5px solid rgba(244, 63, 94, 0.45)",
              animation: "heartRingExpand 1s ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}
        <button
          ref={btnRef}
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={heartButtonClasses(active)}
          aria-label={ariaLabel}
          style={beating ? { animation: "heartBeat 0.42s cubic-bezier(.17,.67,.35,1.4) forwards" } : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            style={{ filter: active ? "drop-shadow(0 0 6px rgba(255,255,255,0.6))" : "drop-shadow(0 0 4px rgba(244,63,94,0.5))" }}
          >
            <path d={HEART_PATH} fill={active ? "white" : "#f43f5e"} />
          </svg>
        </button>
      </div>
    </>
  );
}

function cardContainerClasses(featured: boolean, transparent = false) {
  if (transparent) {
    return [
      "rounded-[28px] p-5 transition duration-200",
      featured ? "border border-rose-100" : "",
    ].join(" ");
  }
  return [
    "rounded-[28px] border bg-white p-5 shadow-[0_18px_60px_rgba(148,24,70,0.08)] transition duration-200",
    featured ? "border-rose-200" : "border-white/80",
  ].join(" ");
}

function heartButtonClasses(active: boolean) {
  return [
    "relative flex h-11 w-11 items-center justify-center rounded-full border text-xl transition duration-200",
    active
      ? "border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-200"
      : "border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50",
  ].join(" ");
}

function sortProfiles(profiles: ResultsProfile[]) {
  return [...profiles].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

function updateProfileList(
  profiles: ResultsProfile[],
  profileId: string,
  updater: (profile: ResultsProfile) => ResultsProfile
) {
  return profiles.map((profile) => (profile.id === profileId ? updater(profile) : profile));
}

function createSmsHref(phoneNumber: string) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");
  return `sms:${cleaned}`;
}

function PhotoDeckOverlay({
  photos,
  name,
  onClose,
}: {
  photos: string[];
  name: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  function navigate(dir: "next" | "prev") {
    const d = dir === "next" ? 1 : -1;
    setDirection(d);
    setCurrent((prev) => (prev + d + photos.length) % photos.length);
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") navigate("next");
      if (e.key === "ArrowLeft") navigate("prev");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, photos.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(8,7,6,0.88)", backdropFilter: "blur(18px) saturate(0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center gap-5"
        style={{ width: "min(90vw, 90vh, 540px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card stage */}
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{
            aspectRatio: "1 / 1",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.07), 0 40px 120px rgba(0,0,0,0.7), 0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <AnimatePresence initial={false} custom={direction}>
            <motion.img
              key={current}
              src={photos[current]}
              alt={`${name} photo ${current + 1}`}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: `${d * 108}%`, opacity: 0, scale: 0.92 }),
                center: { x: "0%", opacity: 1, scale: 1 },
                exit: (d: number) => ({ x: `${d * -108}%`, opacity: 0, scale: 0.9 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white active:scale-95"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {photos.length > 1 && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap text-[11px] tracking-widest text-white/35">
              ← → arrow keys
            </p>
          )}
        </div>

        {/* Navigation controls */}
        {photos.length > 1 && (
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate("prev")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 backdrop-blur-sm transition hover:bg-white/20 hover:text-white active:scale-95"
              aria-label="Previous photo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === current ? "20px" : "6px",
                    background: i === current ? "#c9a96e" : "rgba(255,255,255,0.25)",
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate("next")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 backdrop-blur-sm transition hover:bg-white/20 hover:text-white active:scale-95"
              aria-label="Next photo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}


export default function MatchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("top-picks");
  const [matches, setMatches] = useState<ResultsProfile[]>([]);
  const [browse, setBrowse] = useState<ResultsProfile[]>([]);
  const [targetGender, setTargetGender] = useState<ResultsResponse["targetGender"] | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tabDirection, setTabDirection] = useState<SwipeDirection>("right");
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [matchDialog, setMatchDialog] = useState<MatchDialog | null>(null);
  const [visibleTopPickCount, setVisibleTopPickCount] = useState(TOP_PICKS_PAGE_SIZE);
  const topPicksLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [photoDeck, setPhotoDeck] = useState<{ photos: string[]; name: string } | null>(null);

  const interestLookup = useMemo(() => {
    return Object.fromEntries(INTEREST_OPTIONS.map((interest) => [interest.value, interest])) as Record<
      (typeof INTEREST_OPTIONS)[number]["value"],
      (typeof INTEREST_OPTIONS)[number]
    >;
  }, []);

  const sortedBrowse = useMemo(() => sortProfiles(browse), [browse]);
  const sortedMatches = useMemo(() => sortProfiles(matches), [matches]);
  const visibleTopPicks = useMemo(
    () => sortedBrowse.slice(0, visibleTopPickCount),
    [sortedBrowse, visibleTopPickCount]
  );

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
      setMyPhotoUrl(results.myPhotoUrl);
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

  useEffect(() => {
    setVisibleTopPickCount(TOP_PICKS_PAGE_SIZE);
  }, [sortedBrowse.length]);

  useEffect(() => {
    if (tab !== "top-picks") {
      return;
    }

    const node = topPicksLoadMoreRef.current;
    if (!node || visibleTopPickCount >= sortedBrowse.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleTopPickCount((current) =>
          Math.min(current + TOP_PICKS_PAGE_SIZE, sortedBrowse.length)
        );
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [tab, visibleTopPickCount, sortedBrowse.length]);

  async function handleToggleLike(profile: ResultsProfile) {
    const nextLiked = !profile.likedByMe;
    setTogglingId(profile.id);
    setError(null);

    setBrowse((current) =>
      updateProfileList(current, profile.id, (entry) => ({
        ...entry,
        likedByMe: nextLiked,
        mutualMatch: nextLiked && entry.likedYou,
        phone_number: nextLiked && entry.likedYou ? entry.phone_number : undefined,
      }))
    );
    setMatches((current) => {
      if (nextLiked && profile.likedYou) {
        const matchProfile = { ...profile, likedByMe: true, mutualMatch: true };
        const withoutExisting = current.filter((entry) => entry.id !== profile.id);
        return sortProfiles([...withoutExisting, matchProfile]);
      }

      return current.filter((entry) => entry.id !== profile.id);
    });

    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetParticipantId: profile.id,
          liked: !profile.likedByMe,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        mutualMatch: boolean;
        phoneNumber?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update like");
      }

      const nextBrowse = updateProfileList(browse, profile.id, (entry) => ({
        ...entry,
        likedByMe: nextLiked,
        mutualMatch: data.mutualMatch,
        phone_number: data.mutualMatch ? data.phoneNumber ?? entry.phone_number : undefined,
      }));
      setBrowse(nextBrowse);

      const refreshedProfile = nextBrowse.find((entry) => entry.id === profile.id);
      setMatches((current) => {
        if (!refreshedProfile) {
          return current.filter((entry) => entry.id !== profile.id);
        }

        if (!data.mutualMatch) {
          return current.filter((entry) => entry.id !== profile.id);
        }

        const withoutExisting = current.filter((entry) => entry.id !== profile.id);
        return sortProfiles([...withoutExisting, refreshedProfile]);
      });

      if (data.mutualMatch && nextLiked) {
        setCelebratingId(profile.id);
        setMatchDialog({
          id: profile.id,
          name: profile.name,
          phoneNumber: data.phoneNumber,
          matchPhotoUrl: profile.photo_urls?.[0] ?? profile.photo_data_url,
          myPhotoUrl,
        });
        window.setTimeout(() => setCelebratingId((current) => (current === profile.id ? null : current)), 1400);
      }
    } catch (requestError) {
      setBrowse((current) =>
        updateProfileList(current, profile.id, (entry) => ({
          ...entry,
          likedByMe: profile.likedByMe,
          mutualMatch: profile.mutualMatch,
          phone_number: profile.phone_number,
        }))
      );
      setMatches((current) => {
        if (profile.mutualMatch) {
          const withoutExisting = current.filter((entry) => entry.id !== profile.id);
          return sortProfiles([...withoutExisting, profile]);
        }

        return current.filter((entry) => entry.id !== profile.id);
      });
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

  function renderProfileCard(profile: ResultsProfile, featured: boolean, context: Tab) {
    const isCelebrating = celebratingId === profile.id;

    return (
      <article
        key={profile.id}
        className={[
          "relative overflow-hidden",
          cardContainerClasses(featured, context === "top-picks"),
          isCelebrating ? "animate-match-glow border-emerald-300 bg-emerald-50/40" : "",
        ].join(" ")}
      >
        {isCelebrating && <div className="match-burst" />}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {(() => {
              const photos = [
                ...(profile.photo_urls ?? []),
                ...(profile.photo_data_url && !(profile.photo_urls?.length) ? [profile.photo_data_url] : []),
              ];
              if (photos.length > 0) {
                return (
                  <button
                    type="button"
                    className="relative flex-shrink-0 group"
                    onClick={() => setPhotoDeck({ photos, name: profile.name })}
                    aria-label={`View ${profile.name}'s photos`}
                  >
                    <img
                      src={photos[0]}
                      alt={profile.name}
                      className="h-16 w-16 rounded-[24px] object-cover"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 transition-transform group-hover:scale-110">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="12" cy="12" r="3.5" />
                      </svg>
                    </div>
                  </button>
                );
              }
              return (
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-rose-100 text-3xl">
                  {targetGender === "Woman" ? "👩" : "👨"}
                </div>
              );
            })()}
            <div>
              <p className="text-xl font-semibold text-slate-900">{profile.name}</p>
              <p className="text-sm text-slate-500">
                {profile.age_range}
                {profile.location ? ` · ${profile.location}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <HeartButton
              active={profile.likedByMe}
              disabled={togglingId === profile.id}
              ariaLabel={profile.likedByMe ? `Unlike ${profile.name}` : `Like ${profile.name}`}
              onClick={() => handleToggleLike(profile)}
            />

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
          {profile.likedByMe && !profile.mutualMatch && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
              You liked them
            </span>
          )}
        </div>

        {profile.bio && <p className="mt-4 text-sm leading-6 text-slate-600">{profile.bio}</p>}

        {profile.mutualMatch && profile.phone_number && context === "matches" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mt-4 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(209,250,229,0.9))] px-4 py-4 text-sm text-emerald-900 shadow-[0_14px_30px_rgba(16,185,129,0.12)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Direct line</p>
            <a
              href={createSmsHref(profile.phone_number)}
              className="mt-2 inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-emerald-500"
            >
              Text {profile.phone_number}
            </a>
            <p className="mt-2 text-sm text-emerald-700">Tap to open your messaging app.</p>
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
    <>
    <div className="min-h-screen bg-white flex flex-col [transform:translateZ(0)]">
      <AnimatePresence>
        {matchDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
            onClick={() => setMatchDialog(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="match-dialog relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,#fff7ed_0%,#ffe4e6_54%,#fff1f2_100%)] p-6 shadow-[0_24px_80px_rgba(244,63,94,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="match-dialog-hearts" aria-hidden="true">
                <span>♥</span>
                <span>♥</span>
                <span>♥</span>
                <span>♥</span>
                <span>♥</span>
              </div>
              <div className="relative text-center">
                {/* Photo pair */}
                <div className="flex items-center justify-center gap-3">
                  <motion.div
                    initial={{ scale: 0.7, x: -16, opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-rose-100 shadow-[0_8px_24px_rgba(244,63,94,0.22)] flex items-center justify-center text-4xl"
                  >
                    {matchDialog.myPhotoUrl ? (
                      <img src={matchDialog.myPhotoUrl} alt="You" className="h-full w-full object-cover" />
                    ) : (
                      <span>🙂</span>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.7, 1.2, 1], opacity: 1 }}
                    transition={{ duration: 0.65, delay: 0.15, times: [0, 0.55, 1] }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500 shadow-[0_8px_24px_rgba(244,63,94,0.38)]"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.7))" }}>
                      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" fill="white" />
                    </svg>
                  </motion.div>

                  <motion.div
                    initial={{ scale: 0.7, x: 16, opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-rose-100 shadow-[0_8px_24px_rgba(244,63,94,0.22)] flex items-center justify-center text-4xl"
                  >
                    {matchDialog.matchPhotoUrl ? (
                      <img src={matchDialog.matchPhotoUrl} alt={matchDialog.name} className="h-full w-full object-cover" />
                    ) : (
                      <span>🙂</span>
                    )}
                  </motion.div>
                </div>

                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.28em] text-rose-500">It&apos;s a match!</p>
                <h2 className="mt-2 text-[1.75rem] font-semibold text-slate-900">{matchDialog.name} is into you too.</h2>
                {matchDialog.phoneNumber && (
                  <a
                    href={createSmsHref(matchDialog.phoneNumber)}
                    className="mt-5 inline-flex items-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Text {matchDialog.phoneNumber}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setMatchDialog(null)}
                  className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                >
                  Keep browsing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <div className="relative grid grid-cols-2 gap-2 rounded-[30px] bg-slate-100 p-1.5">
          <div
            className="absolute bottom-1.5 top-1.5 rounded-[24px] bg-white shadow-sm transition-all duration-200 ease-out [transform:translateZ(0)]"
            style={{
              left: tab === "top-picks" ? "0.375rem" : "calc(50% + 0.125rem)",
              width: "calc(50% - 0.5rem)",
            }}
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
            Matches ({sortedMatches.length})
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
                  sortedMatches.map((profile) => renderProfileCard(profile, true, "matches"))
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
                {visibleTopPicks.map((profile, index) => renderProfileCard(profile, index < 3, "top-picks"))}
                {visibleTopPickCount < sortedBrowse.length && (
                  <div ref={topPicksLoadMoreRef} className="flex justify-center py-4">
                    <div className="rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
                      Loading more picks
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>

      <AnimatePresence>
        {photoDeck && (
          <PhotoDeckOverlay
            photos={photoDeck.photos}
            name={photoDeck.name}
            onClose={() => setPhotoDeck(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}