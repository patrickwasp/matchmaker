"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { z } from "zod";

const nameSchema = z.string().min(2, "Name must be at least 2 characters");
const phoneSchema = z
  .string()
  .regex(/^[+\d\s\-(\)[\]]+$/, "Please enter a valid phone number");
import {
  AGE_RANGES,
  GENDER_OPTIONS,
  INTEREST_LIMIT,
  INTEREST_OPTIONS,
} from "@/lib/profile";
import type {
  ParticipantAnswers,
  ParticipantQuizAnswers,
  QuizQuestion,
} from "@/types";

const PROFILE_STEPS = [
  "name",
  "age_range",
  "gender",
  "location",
  "bio",
  "phone_number",
  "interests",
  "photo",
] as const;

type ProfileStepId = (typeof PROFILE_STEPS)[number];
type MotionDirection = "forward" | "backward";
type QuizStep =
  | { type: "age-preference"; id: "preferred_age_ranges" }
  | { type: "question"; id: string; question: QuizQuestion };

function optionButtonClasses(selected: boolean) {
  return [
    "w-full rounded-[28px] border px-5 py-5 text-left transition duration-200",
    selected
      ? "border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-200"
      : "border-rose-100 bg-white text-slate-900 hover:border-rose-300 hover:bg-rose-50",
  ].join(" ");
}

function checkboxButtonClasses(selected: boolean) {
  return [
    "flex w-full items-center gap-4 rounded-[24px] border px-4 py-4 text-left transition duration-200",
    selected
      ? "border-emerald-500 bg-emerald-50 text-emerald-950"
      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
  ].join(" ");
}

function checkboxIndicator(selected: boolean) {
  return [
    "flex h-6 w-6 items-center justify-center rounded-md border text-sm font-bold transition",
    selected
      ? "border-emerald-500 bg-emerald-500 text-white"
      : "border-slate-300 bg-white text-transparent",
  ].join(" ");
}

function extractValidationMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("error" in payload && typeof payload.error === "string" && payload.error) {
    return payload.error;
  }

  if (
    "details" in payload &&
    payload.details &&
    typeof payload.details === "object" &&
    "fieldErrors" in payload.details &&
    payload.details.fieldErrors &&
    typeof payload.details.fieldErrors === "object"
  ) {
    for (const value of Object.values(payload.details.fieldErrors)) {
      if (Array.isArray(value)) {
        const firstMessage = value.find((item) => typeof item === "string");
        if (typeof firstMessage === "string") {
          return firstMessage;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Image crop modal
// ---------------------------------------------------------------------------

const CROP_VIEWPORT = 280; // display px
const CROP_OUTPUT = 1024;  // output px (square WebP)

function ImageCropModal({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetAtDragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      const minDim = Math.min(img.width, img.height);
      const fillScale = CROP_VIEWPORT / minDim;
      const initOffset = {
        x: (CROP_VIEWPORT - img.width * fillScale) / 2,
        y: (CROP_VIEWPORT - img.height * fillScale) / 2,
      };
      setImageEl(img);
      setScale(fillScale);
      setOffset(initOffset);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clampOffset(newOffset: { x: number; y: number }, currentScale: number) {
    if (!imageEl) return newOffset;
    const scaledW = imageEl.width * currentScale;
    const scaledH = imageEl.height * currentScale;
    return {
      x: Math.min(0, Math.max(CROP_VIEWPORT - scaledW, newOffset.x)),
      y: Math.min(0, Math.max(CROP_VIEWPORT - scaledH, newOffset.y)),
    };
  }

  function handleScaleChange(newScale: number) {
    if (!imageEl) return;
    const cx = (CROP_VIEWPORT / 2 - offset.x) / scale;
    const cy = (CROP_VIEWPORT / 2 - offset.y) / scale;
    const newOffset = {
      x: CROP_VIEWPORT / 2 - cx * newScale,
      y: CROP_VIEWPORT / 2 - cy * newScale,
    };
    setScale(newScale);
    setOffset(clampOffset(newOffset, newScale));
  }

  function startDrag(clientX: number, clientY: number) {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    offsetAtDragStartRef.current = { ...offset };
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setOffset(
      clampOffset(
        { x: offsetAtDragStartRef.current.x + dx, y: offsetAtDragStartRef.current.y + dy },
        scale
      )
    );
  }

  function applyCrop() {
    if (!imageEl) return;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT;
    canvas.height = CROP_OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCropError("Your browser could not prepare that image.");
      return;
    }
    const sourceX = -offset.x / scale;
    const sourceY = -offset.y / scale;
    const sourceSize = CROP_VIEWPORT / scale;
    ctx.drawImage(imageEl, sourceX, sourceY, sourceSize, sourceSize, 0, 0, CROP_OUTPUT, CROP_OUTPUT);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onConfirm(blob);
        } else {
          setCropError("Could not convert image. Please try a different photo.");
        }
      },
      "image/webp",
      0.85
    );
  }

  const minScale = imageEl ? CROP_VIEWPORT / Math.min(imageEl.width, imageEl.height) : 0.1;
  const maxScale = minScale * 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Crop your photo</h2>
        <p className="text-sm text-slate-500">Drag to reposition · Use the slider to zoom</p>

        {imageUrl && (
          <>
            <div
              className="relative mx-auto overflow-hidden rounded-2xl bg-slate-100 cursor-grab active:cursor-grabbing select-none"
              style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT }}
              onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
              onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => { if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
              onTouchMove={(e) => { if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }}
              onTouchEnd={() => setIsDragging(false)}
            >
              {imageEl && (
                <img
                  src={imageUrl}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    position: "absolute",
                    width: imageEl.width * scale,
                    height: imageEl.height * scale,
                    left: offset.x,
                    top: offset.y,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>

            <div className="space-y-1 px-1">
              <input
                type="range"
                min={minScale}
                max={maxScale}
                step={0.01}
                value={scale}
                onChange={(e) => handleScaleChange(Number(e.target.value))}
                className="w-full accent-rose-500"
                aria-label="Zoom"
              />
            </div>
          </>
        )}

        {cropError && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{cropError}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyCrop}
            disabled={!imageEl}
            className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:opacity-50"
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}

function getProfileTitle(step: ProfileStepId, gender?: ParticipantAnswers["gender"]) {
  switch (step) {
    case "name":
      return "What's your name?";
    case "age_range":
      return "How old are you?";
    case "gender":
      return "I am a...";
    case "location":
      return "Where are you based?";
    case "bio":
      return gender === "Woman"
        ? "Tell him about yourself"
        : gender === "Man"
          ? "Tell her about yourself"
          : "Tell them about yourself";
    case "phone_number":
      return "What's your number?";
    case "interests":
      return "What are you into?";
    case "photo":
      return "Add your photos";
    default:
      return "";
  }
}

function getProfileSubtitle(step: ProfileStepId) {
  switch (step) {
    case "phone_number":
      return "Only someone who mutually matches with you will see this.";
    case "interests":
      return "Choose the three that feel most like you.";
    case "photo":
      return "Add up to 3 photos. Tap a slot to add or replace.";
    default:
      return null;
  }
}

function ProfilePageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-sm font-medium text-slate-500">Loading your profile…</p>
    </div>
  );
}

function ProfilePageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [defaultPhase, setDefaultPhase] = useState<"profile" | "quiz">("profile");
  const [phase, setPhase] = useState<"profile" | "quiz">("profile");
  const [profileStepIndex, setProfileStepIndex] = useState(0);
  const [quizStepIndex, setQuizStepIndex] = useState(0);
  const [form, setForm] = useState<Partial<ParticipantAnswers>>({
    interests: [],
    preferred_age_ranges: AGE_RANGES,
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<ParticipantQuizAnswers>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [motionDirection, setMotionDirection] = useState<MotionDirection>("forward");
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentProfileStep = PROFILE_STEPS[profileStepIndex];
  const quizSteps = useMemo<QuizStep[]>(() => {
    return [
      { type: "age-preference", id: "preferred_age_ranges" },
      ...quizQuestions.map(
        (question): QuizStep => ({ type: "question", id: question.id, question })
      ),
    ];
  }, [quizQuestions]);
  const currentQuizStep = quizSteps[quizStepIndex];
  const currentQuizQuestion = currentQuizStep?.type === "question" ? currentQuizStep.question : undefined;
  const currentQuizAnswer = currentQuizQuestion ? quizAnswers[currentQuizQuestion.id] : undefined;
  const quizComplete =
    (form.preferred_age_ranges?.length ?? 0) > 0 &&
    quizQuestions.every((question) => Boolean(quizAnswers[question.id]?.self));

  const profileCardKey = `${phase}-${
    phase === "profile"
      ? currentProfileStep
      : currentQuizStep?.type === "age-preference"
        ? currentQuizStep.id
        : currentQuizQuestion?.id ?? "quiz"
  }`;
  const agePreferenceAllSelected =
    (form.preferred_age_ranges?.length ?? 0) === AGE_RANGES.length;

  function buildProfileUrl(nextPhase: "profile" | "quiz", nextStepId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("phase", nextPhase);
    params.set("step", nextStepId);

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function navigateToProfileStep(
    nextIndex: number,
    direction: MotionDirection,
    historyMode: "push" | "replace" = "push"
  ) {
    const clampedIndex = Math.max(0, Math.min(nextIndex, PROFILE_STEPS.length - 1));
    const url = buildProfileUrl("profile", PROFILE_STEPS[clampedIndex]);

    setMotionDirection(direction);
    setPhase("profile");
    setProfileStepIndex(clampedIndex);

    if (historyMode === "replace") {
      router.replace(url, { scroll: false });
      return;
    }

    router.push(url, { scroll: false });
  }

  function navigateToQuizStep(
    nextIndex: number,
    direction: MotionDirection,
    historyMode: "push" | "replace" = "push"
  ) {
    const clampedIndex = Math.max(0, Math.min(nextIndex, quizSteps.length - 1));
    const nextStep = quizSteps[clampedIndex];
    if (!nextStep) {
      return;
    }

    const url = buildProfileUrl("quiz", nextStep.id);

    setMotionDirection(direction);
    setPhase("quiz");
    setQuizStepIndex(clampedIndex);

    if (historyMode === "replace") {
      router.replace(url, { scroll: false });
      return;
    }

    router.push(url, { scroll: false });
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status !== "loading") {
        setLoadingProfile(false);
      }
      return;
    }

    let cancelled = false;

    Promise.all([
      fetch("/api/me").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/quiz-questions").then(async (response) => {
        if (!response.ok) {
          return [];
        }
        return (await response.json()) as QuizQuestion[];
      }),
    ])
      .then(([participant, questions]) => {
        if (cancelled) {
          return;
        }

        const enabledQuestions = questions.filter((question) => question.enabled);
        setQuizQuestions(enabledQuestions);

        if (participant?.answers_json) {
          const answers = JSON.parse(participant.answers_json) as ParticipantAnswers;
          setForm({
            ...answers,
            interests: answers.interests ?? [],
            preferred_age_ranges: answers.preferred_age_ranges?.length
              ? answers.preferred_age_ranges
              : AGE_RANGES,
          });
          setHasSavedProfile(true);
        }

        if (participant?.quiz_answers_json) {
          setQuizAnswers(JSON.parse(participant.quiz_answers_json));
          setDefaultPhase("profile");
        } else if (participant?.answers_json) {
          setDefaultPhase("quiz");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load your profile right now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (loadingProfile || status !== "authenticated") {
      return;
    }

    const requestedPhase = searchParams.get("phase");
    const requestedStep = searchParams.get("step");

    const resolvedPhase =
      requestedPhase === "quiz" && hasSavedProfile
        ? "quiz"
        : requestedPhase === "profile"
          ? "profile"
          : defaultPhase;

    if (resolvedPhase === "quiz") {
      const nextIndex = quizSteps.findIndex((step) => step.id === requestedStep);
      const resolvedIndex = nextIndex >= 0 ? nextIndex : 0;
      const resolvedStep = quizSteps[resolvedIndex];

      if (!resolvedStep) {
        return;
      }

      if (phase !== "quiz" || quizStepIndex !== resolvedIndex) {
        setPhase("quiz");
        setQuizStepIndex(resolvedIndex);
      }

      if (requestedPhase !== "quiz" || requestedStep !== resolvedStep.id) {
        router.replace(buildProfileUrl("quiz", resolvedStep.id), { scroll: false });
      }

      return;
    }

    const nextIndex = PROFILE_STEPS.indexOf((requestedStep ?? "") as ProfileStepId);
    const resolvedIndex = nextIndex >= 0 ? nextIndex : 0;
    const resolvedStep = PROFILE_STEPS[resolvedIndex];

    if (phase !== "profile" || profileStepIndex !== resolvedIndex) {
      setPhase("profile");
      setProfileStepIndex(resolvedIndex);
    }

    if (requestedPhase !== "profile" || requestedStep !== resolvedStep) {
      router.replace(buildProfileUrl("profile", resolvedStep), { scroll: false });
    }
  }, [
    defaultPhase,
    hasSavedProfile,
    loadingProfile,
    phase,
    profileStepIndex,
    quizStepIndex,
    quizSteps,
    router,
    searchParams,
    status,
  ]);

  function updateForm(
    updater: (previous: Partial<ParticipantAnswers>) => Partial<ParticipantAnswers>
  ) {
    setError(null);
    setForm((previous) => updater(previous));
  }

  function buildCheckpointPayload() {
    return {
      ...form,
      name: form.name?.trim(),
      phone_number: form.phone_number?.trim(),
      location: form.location?.trim() || undefined,
      bio: form.bio?.trim() || undefined,
    };
  }

  function saveCheckpoint() {
    fetch("/api/checkpoint-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCheckpointPayload()),
    }).catch(() => {
      // silently ignore — checkpoint failures don't block navigation
    });
  }

  function goToPreviousProfileStep() {
    setValidationError(null);
    navigateToProfileStep(profileStepIndex - 1, "backward");
  }

  function goToNextProfileStep() {
    setValidationError(null);
    saveCheckpoint();
    navigateToProfileStep(profileStepIndex + 1, "forward");
  }

  function goToPreviousQuizStep() {
    navigateToQuizStep(quizStepIndex - 1, "backward");
  }

  function goToNextQuizStep() {
    navigateToQuizStep(quizStepIndex + 1, "forward");
  }

  function toggleInterest(interest: ParticipantAnswers["interests"][number]) {
    updateForm((previous) => {
      const currentInterests = previous.interests ?? [];

      if (currentInterests.includes(interest)) {
        return {
          ...previous,
          interests: currentInterests.filter((item) => item !== interest),
        };
      }

      if (currentInterests.length >= INTEREST_LIMIT) {
        return previous;
      }

      return {
        ...previous,
        interests: [...currentInterests, interest],
      };
    });
  }

  function togglePreferredAge(ageRange: ParticipantAnswers["age_range"]) {
    updateForm((previous) => {
      const currentRanges = previous.preferred_age_ranges ?? [];
      return {
        ...previous,
        preferred_age_ranges: currentRanges.includes(ageRange)
          ? currentRanges.filter((item) => item !== ageRange)
          : [...currentRanges, ageRange],
      };
    });
  }

  function updateQuizAnswer(
    questionId: string,
    updater: (previous: ParticipantQuizAnswers[string] | undefined) => ParticipantQuizAnswers[string]
  ) {
    setError(null);
    setQuizAnswers((previous) => ({
      ...previous,
      [questionId]: updater(previous[questionId]),
    }));
  }

  function canContinueProfile() {
    switch (currentProfileStep) {
      case "name":
        return Boolean(form.name?.trim()) && nameSchema.safeParse(form.name?.trim()).success;
      case "age_range":
        return Boolean(form.age_range);
      case "gender":
        return Boolean(form.gender);
      case "location":
        return true;
      case "bio":
        return true;
      case "phone_number":
        return Boolean(form.phone_number?.trim()) && phoneSchema.safeParse(form.phone_number?.trim()).success;
      case "interests":
        return (form.interests?.length ?? 0) === INTEREST_LIMIT;
      case "photo":
        return !processingPhoto;
      default:
        return false;
    }
  }

  function canContinueQuiz() {
    if (!currentQuizStep) {
      return false;
    }

    if (currentQuizStep.type === "age-preference") {
      return (form.preferred_age_ranges?.length ?? 0) > 0;
    }

    return Boolean(currentQuizAnswer?.self);
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }

    setPhotoError(null);
    setCropFile(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setCropFile(null);
    setProcessingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", blob, "photo.webp");

      const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setPhotoError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      const { url } = data as { url: string };
      updateForm((previous) => ({
        ...previous,
        photo_urls: [...(previous.photo_urls ?? []), url].slice(0, 3),
      }));
    } catch {
      setPhotoError("Upload failed. Please check your connection.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function handleDeletePhoto(urlToDelete: string) {
    // Optimistically remove from UI immediately
    updateForm((previous) => ({
      ...previous,
      photo_urls: (previous.photo_urls ?? []).filter((u) => u !== urlToDelete),
    }));

    // Best-effort delete from Vercel Blob
    fetch("/api/delete-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlToDelete }),
    }).catch(() => {
      // Silently ignore – the URL has already been removed from the profile
    });
  }

  async function handleSaveProfile() {
    setError(null);
    setSavingProfile(true);

    try {
      const response = await fetch("/api/checkpoint-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCheckpointPayload()),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(extractValidationMessage(data) ?? "Something went wrong.");
        return;
      }

      setHasSavedProfile(true);
      navigateToQuizStep(0, "forward");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveQuiz() {
    if (!quizComplete) {
      return;
    }

    setError(null);
    setSavingQuiz(true);

    try {
      const response = await fetch("/api/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferred_age_ranges:
            form.preferred_age_ranges?.length ? form.preferred_age_ranges : AGE_RANGES,
          answers: quizAnswers,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(extractValidationMessage(data) ?? "Something went wrong.");
        return;
      }

      router.push("/matches");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingQuiz(false);
    }
  }

  function handleTextStepKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && currentProfileStep !== "bio" && canContinueProfile()) {
      event.preventDefault();
      if (currentProfileStep !== "photo") {
        goToNextProfileStep();
      }
    }
  }

  if (status === "loading" || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-slate-500">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col [transform:translateZ(0)]">
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
        <p className="text-base font-bold text-rose-600">Matchmaker T.O.</p>
        <div className="flex items-center gap-2">
          {hasSavedProfile && (
            <button
              onClick={() => router.push("/matches")}
              className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
            >
              Results
            </button>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="h-1 w-full shrink-0 bg-slate-100">
        <div
          className="h-1 bg-rose-500 transition-all"
          style={{
            width:
              phase === "profile"
                ? `${((profileStepIndex + 1) / PROFILE_STEPS.length) * 100}%`
                : `${((quizStepIndex + 1) / Math.max(quizSteps.length, 1)) * 100}%`,
          }}
        />
      </div>

      <div className="flex flex-1 flex-col mx-auto w-full max-w-lg px-5 sm:px-8">
          <AnimatePresence
            mode="wait"
            initial={false}
            custom={motionDirection}
          >
          <motion.div
            key={profileCardKey}
            custom={motionDirection}
            variants={{
              enter: (dir: MotionDirection) => ({ x: dir === "forward" ? 32 : -32, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (dir: MotionDirection) => ({ x: dir === "forward" ? -32 : 32, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex min-h-0 flex-1 flex-col justify-between gap-6"
          >
            {phase === "profile" ? (
              <>
                <div className="flex flex-1 flex-col justify-center">
                  <h1 className="text-3xl font-semibold leading-tight text-slate-950">
                    {getProfileTitle(currentProfileStep, form.gender)}
                  </h1>
                  {getProfileSubtitle(currentProfileStep) && (
                    <p className="mt-3 max-w-sm text-base leading-6 text-slate-500">
                      {getProfileSubtitle(currentProfileStep)}
                    </p>
                  )}

                  <div className="mt-8 space-y-5">
                    {currentProfileStep === "name" && (
                      <>
                        <input
                          autoFocus
                          type="text"
                          maxLength={100}
                          value={form.name ?? ""}
                          onChange={(event) => {
                            setValidationError(null);
                            updateForm((previous) => ({
                              ...previous,
                              name: event.target.value,
                            }));
                          }}
                          onBlur={() => {
                            const trimmed = form.name?.trim() ?? "";
                            if (trimmed) {
                              const result = nameSchema.safeParse(trimmed);
                              if (!result.success) {
                                setValidationError(result.error.issues[0]?.message ?? null);
                              }
                            }
                          }}
                          onKeyDown={handleTextStepKeyDown}
                          placeholder="Jamie M."
                          className="w-full rounded-[28px] border border-rose-100 bg-rose-50/60 px-5 py-5 text-xl text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
                        />
                        {validationError && (
                          <p className="px-2 text-sm text-red-500">{validationError}</p>
                        )}
                      </>
                    )}

                    {currentProfileStep === "age_range" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {AGE_RANGES.map((ageRange) => {
                          const selected = form.age_range === ageRange;
                          return (
                            <button
                              key={ageRange}
                              type="button"
                              onClick={() =>
                                updateForm((previous) => ({
                                  ...previous,
                                  age_range: ageRange,
                                }))
                              }
                              className={optionButtonClasses(selected)}
                            >
                              <span className="block text-lg font-semibold">{ageRange}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {currentProfileStep === "gender" && (
                      <div className="grid gap-3">
                        {GENDER_OPTIONS.map((option) => {
                          const selected = form.gender === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                updateForm((previous) => ({
                                  ...previous,
                                  gender: option.value,
                                }));
                              }}
                              className={optionButtonClasses(selected)}
                            >
                              <span className="flex items-center gap-4">
                                <span className="text-3xl">{option.emoji}</span>
                                <span className="text-lg font-semibold">{option.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {currentProfileStep === "location" && (
                      <input
                        autoFocus
                        type="text"
                        maxLength={100}
                        value={form.location ?? ""}
                        onChange={(event) =>
                          updateForm((previous) => ({
                            ...previous,
                            location: event.target.value,
                          }))
                        }
                        onKeyDown={handleTextStepKeyDown}
                        placeholder="Toronto"
                        className="w-full rounded-[28px] border border-rose-100 bg-rose-50/60 px-5 py-5 text-xl text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
                      />
                    )}

                    {currentProfileStep === "bio" && (
                      <div>
                        <textarea
                          autoFocus
                          rows={5}
                          maxLength={500}
                          value={form.bio ?? ""}
                          onChange={(event) =>
                            updateForm((previous) => ({
                              ...previous,
                              bio: event.target.value,
                            }))
                          }
                          onKeyDown={handleTextStepKeyDown}
                          placeholder="Confident, kind, funny, and actually down to make plans."
                          className="w-full resize-none rounded-[28px] border border-rose-100 bg-rose-50/60 px-5 py-5 text-lg text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
                        />
                        <p className="mt-2 text-right text-xs text-slate-400">
                          {(form.bio ?? "").length} / 500
                        </p>
                      </div>
                    )}

                    {currentProfileStep === "phone_number" && (
                      <>
                        <input
                          autoFocus
                          type="tel"
                          maxLength={30}
                          value={form.phone_number ?? ""}
                          onChange={(event) => {
                            setValidationError(null);
                            updateForm((previous) => ({
                              ...previous,
                              phone_number: event.target.value,
                            }));
                          }}
                          onBlur={() => {
                            const trimmed = form.phone_number?.trim() ?? "";
                            if (trimmed) {
                              const result = phoneSchema.safeParse(trimmed);
                              if (!result.success) {
                                setValidationError(result.error.issues[0]?.message ?? null);
                              }
                            }
                          }}
                          onKeyDown={handleTextStepKeyDown}
                          placeholder="(555) 123-4567"
                          className="w-full rounded-[28px] border border-rose-100 bg-rose-50/60 px-5 py-5 text-xl text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
                        />
                        {validationError && (
                          <p className="px-2 text-sm text-red-500">{validationError}</p>
                        )}
                      </>
                    )}

                    {currentProfileStep === "interests" && (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {INTEREST_OPTIONS.map((interest) => {
                            const selected = form.interests?.includes(interest.value) ?? false;
                            const disabled =
                              !selected && (form.interests?.length ?? 0) >= INTEREST_LIMIT;

                            return (
                              <button
                                key={interest.value}
                                type="button"
                                onClick={() => toggleInterest(interest.value)}
                                disabled={disabled}
                                className={`${optionButtonClasses(selected)} ${
                                  disabled ? "cursor-not-allowed opacity-40" : ""
                                }`}
                              >
                                <span className="flex items-center gap-4">
                                  <span className="text-3xl">{interest.emoji}</span>
                                  <span className="block text-lg font-semibold">{interest.label}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {currentProfileStep === "photo" && (
                      <div className="space-y-5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoChange}
                        />

                        <div className="grid grid-cols-3 gap-3">
                          {Array.from({ length: 3 }).map((_, index) => {
                            const photoUrl = form.photo_urls?.[index];
                            const filledCount = form.photo_urls?.length ?? 0;
                            const isNextSlot = index === filledCount;

                            return (
                              <div key={index} className="relative aspect-square">
                                {photoUrl ? (
                                  <>
                                    <img
                                      src={photoUrl}
                                      alt={`Photo ${index + 1}`}
                                      className="h-full w-full rounded-[24px] object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePhoto(photoUrl)}
                                      aria-label={`Remove photo ${index + 1}`}
                                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-lg transition hover:bg-slate-700"
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : isNextSlot ? (
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={processingPhoto}
                                    className="h-full w-full rounded-[24px] border-2 border-dashed border-rose-200 bg-rose-50/70 flex flex-col items-center justify-center gap-1 text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {processingPhoto ? (
                                      <span className="text-xs font-medium">Uploading…</span>
                                    ) : (
                                      <>
                                        <span className="text-2xl">+</span>
                                        {index === 0 && (
                                          <span className="text-xs font-medium">Add photo</span>
                                        )}
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <div className="h-full w-full rounded-[24px] border border-rose-100 bg-rose-50/40" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {photoError && (
                          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            {photoError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 mt-2 space-y-3 bg-white border-t border-slate-100 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
                  {error && (
                    <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goToPreviousProfileStep}
                      disabled={profileStepIndex === 0}
                      className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Back
                    </button>

                    {currentProfileStep !== "photo" ? (
                      <button
                        type="button"
                        onClick={goToNextProfileStep}
                        disabled={!canContinueProfile()}
                        className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {currentProfileStep === "location" || currentProfileStep === "bio"
                          ? (form[currentProfileStep] ?? "").toString().trim()
                            ? "Continue"
                            : "Skip"
                          : "Continue"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={savingProfile || processingPhoto}
                        className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingProfile ? "Saving profile…" : "Continue to quiz"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-1 flex-col justify-center">
                  <h1 className="text-3xl font-semibold leading-tight text-slate-950">
                    {currentQuizStep?.type === "age-preference"
                      ? "What age range are you open to?"
                      : currentQuizQuestion?.prompt ?? "Loading quiz"}
                  </h1>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    {currentQuizStep?.type === "age-preference"
                      ? "This stays in the quiz so the profile stays about you."
                      : "Pick the one that sounds most like you."}
                  </p>

                  {currentQuizStep?.type === "age-preference" && (
                    <div className="mt-8 space-y-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-500">Choose one or more</p>
                        <button
                          type="button"
                          onClick={() =>
                            updateForm((previous) => ({
                              ...previous,
                              preferred_age_ranges: agePreferenceAllSelected ? [] : AGE_RANGES,
                            }))
                          }
                          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {agePreferenceAllSelected ? "Clear all" : "Select all"}
                        </button>
                      </div>

                      <div className="grid gap-3">
                        {AGE_RANGES.map((ageRange) => {
                          const selected = form.preferred_age_ranges?.includes(ageRange) ?? false;
                          return (
                            <button
                              key={ageRange}
                              type="button"
                              onClick={() => togglePreferredAge(ageRange)}
                              className={checkboxButtonClasses(selected)}
                            >
                              <span className={checkboxIndicator(selected)}>✓</span>
                              <span className="text-base font-semibold">{ageRange}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentQuizQuestion && currentQuizStep?.type === "question" && (
                    <div className="mt-8 space-y-5">
                      <div className="grid gap-3">
                        {currentQuizQuestion.options.map((option) => {
                          const selected = currentQuizAnswer?.self === option.value;
                          return (
                            <button
                              key={`self-${option.value}`}
                              type="button"
                              onClick={() =>
                                updateQuizAnswer(currentQuizQuestion.id, () => ({
                                  self: option.value,
                                }))
                              }
                              className={optionButtonClasses(selected)}
                            >
                              <span className="flex items-center gap-4">
                                {option.emoji && <span className="text-3xl">{option.emoji}</span>}
                                <span className="text-lg font-semibold">{option.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 mt-2 space-y-3 bg-white border-t border-slate-100 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
                  {error && (
                    <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (quizStepIndex === 0) {
                          setMotionDirection("backward");
                          navigateToProfileStep(PROFILE_STEPS.length - 1, "backward");
                          return;
                        }
                        goToPreviousQuizStep();
                      }}
                      className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Back
                    </button>

                    {quizStepIndex < quizSteps.length - 1 ? (
                      <button
                        type="button"
                        onClick={goToNextQuizStep}
                        disabled={!canContinueQuiz()}
                        className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveQuiz}
                        disabled={!quizComplete || savingQuiz}
                        className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingQuiz ? "Saving quiz…" : "See matches"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
          </AnimatePresence>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfilePageContent />
    </Suspense>
  );
}