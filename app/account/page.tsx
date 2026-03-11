"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  AGE_RANGES,
  GENDER_OPTIONS,
  INTEREST_LIMIT,
  INTEREST_OPTIONS,
} from "@/lib/profile";
import type { AgeRange, Gender, Interest, ParticipantAnswers } from "@/types";

const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^(?=.{2,100}$)[\p{L}][\p{L}\p{M}' -]*$/u, "Enter a real first name or full name.");

const phoneSchema = z
  .string()
  .trim()
  .min(10)
  .max(30)
  .regex(/^[0-9()+.\-\s]+$/, "Enter a real phone number.")
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a real phone number.");

// ---------------------------------------------------------------------------
// Image crop modal (same logic as profile page)
// ---------------------------------------------------------------------------

const CROP_VIEWPORT = 280;
const CROP_OUTPUT = 1024;

function getCropImageSize(image: HTMLImageElement) {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

function getCropMinScale(image: HTMLImageElement) {
  const { width, height } = getCropImageSize(image);
  return CROP_VIEWPORT / Math.min(width, height);
}

function clampCropOffset(
  image: HTMLImageElement,
  nextOffset: { x: number; y: number },
  nextScale: number,
) {
  const { width, height } = getCropImageSize(image);
  const scaledWidth = width * nextScale;
  const scaledHeight = height * nextScale;
  return {
    x: Math.min(0, Math.max(CROP_VIEWPORT - scaledWidth, nextOffset.x)),
    y: Math.min(0, Math.max(CROP_VIEWPORT - scaledHeight, nextOffset.y)),
  };
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetAtDragStartRef = useRef({ x: 0, y: 0 });
  const liveStateRef = useRef({ imageEl: null as HTMLImageElement | null, scale: 1, offset: { x: 0, y: 0 } });
  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    imagePoint: { x: number; y: number };
    midpoint: { x: number; y: number };
  } | null>(null);

  liveStateRef.current = { imageEl, scale, offset };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      const { width, height } = getCropImageSize(img);
      const fillScale = getCropMinScale(img);
      const initOffset = {
        x: (CROP_VIEWPORT - width * fillScale) / 2,
        y: (CROP_VIEWPORT - height * fillScale) / 2,
      };
      setImageEl(img);
      setScale(fillScale);
      setOffset(initOffset);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    function getMidpoint(touches: TouchList) {
      const rect = element!.getBoundingClientRect();
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
        y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
      };
    }

    function getDistance(touches: TouchList) {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    }

    function handleTouchStart(event: TouchEvent) {
      const { imageEl, scale, offset } = liveStateRef.current;
      if (!imageEl) return;
      if (event.touches.length === 1) {
        event.preventDefault();
        pinchRef.current = null;
        setIsDragging(true);
        dragStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        offsetAtDragStartRef.current = { ...offset };
      }
      if (event.touches.length === 2) {
        event.preventDefault();
        setIsDragging(false);
        const midpoint = getMidpoint(event.touches);
        pinchRef.current = {
          startDistance: getDistance(event.touches),
          startScale: scale,
          imagePoint: { x: (midpoint.x - offset.x) / scale, y: (midpoint.y - offset.y) / scale },
          midpoint,
        };
      }
    }

    function handleTouchMove(event: TouchEvent) {
      const { imageEl, scale } = liveStateRef.current;
      if (!imageEl) return;
      if (event.touches.length === 1 && !pinchRef.current) {
        event.preventDefault();
        const dx = event.touches[0].clientX - dragStartRef.current.x;
        const dy = event.touches[0].clientY - dragStartRef.current.y;
        setOffset(clampCropOffset(imageEl, { x: offsetAtDragStartRef.current.x + dx, y: offsetAtDragStartRef.current.y + dy }, scale));
      }
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault();
        const minScale = getCropMinScale(imageEl);
        const maxScale = minScale * 4;
        const nextScale = Math.min(maxScale, Math.max(minScale, pinchRef.current.startScale * (getDistance(event.touches) / pinchRef.current.startDistance)));
        const midpoint = getMidpoint(event.touches);
        const nextOffset = clampCropOffset(imageEl, { x: midpoint.x - pinchRef.current.imagePoint.x * nextScale, y: midpoint.y - pinchRef.current.imagePoint.y * nextScale }, nextScale);
        setScale(nextScale);
        setOffset(nextOffset);
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinchRef.current = null;
      if (event.touches.length === 1) {
        dragStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        offsetAtDragStartRef.current = { ...liveStateRef.current.offset };
        setIsDragging(true);
      }
      if (event.touches.length === 0) setIsDragging(false);
    }

    element.addEventListener("touchstart", handleTouchStart, { passive: false });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: false });
    element.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  function handleScaleChange(newScale: number) {
    if (!imageEl) return;
    const cx = (CROP_VIEWPORT / 2 - offset.x) / scale;
    const cy = (CROP_VIEWPORT / 2 - offset.y) / scale;
    setScale(newScale);
    setOffset(clampCropOffset(imageEl, { x: CROP_VIEWPORT / 2 - cx * newScale, y: CROP_VIEWPORT / 2 - cy * newScale }, newScale));
  }

  function applyCrop() {
    if (!imageEl) return;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT;
    canvas.height = CROP_OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCropError("Your browser could not prepare that image."); return; }
    const sourceX = -offset.x / scale;
    const sourceY = -offset.y / scale;
    const sourceSize = CROP_VIEWPORT / scale;
    ctx.drawImage(imageEl, sourceX, sourceY, sourceSize, sourceSize, 0, 0, CROP_OUTPUT, CROP_OUTPUT);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
        else setCropError("Could not convert image. Please try a different photo.");
      },
      "image/webp",
      0.8
    );
  }

  const minScale = imageEl ? getCropMinScale(imageEl) : 0.1;
  const maxScale = minScale * 4;
  const imageSize = imageEl ? getCropImageSize(imageEl) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Crop your photo</h2>
        <p className="text-sm text-slate-500">Drag to reposition · Pinch or use the slider to zoom</p>
        {imageUrl && (
          <>
            <div
              ref={containerRef}
              className="relative mx-auto overflow-hidden rounded-2xl bg-slate-100 cursor-grab active:cursor-grabbing select-none"
              style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT, touchAction: "none" }}
              onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); dragStartRef.current = { x: e.clientX, y: e.clientY }; offsetAtDragStartRef.current = { ...offset }; }}
              onMouseMove={(e) => { if (!isDragging || !imageEl) return; setOffset(clampCropOffset(imageEl, { x: offsetAtDragStartRef.current.x + (e.clientX - dragStartRef.current.x), y: offsetAtDragStartRef.current.y + (e.clientY - dragStartRef.current.y) }, scale)); }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {imageEl && imageSize && (
                <img
                  src={imageUrl}
                  alt="Crop preview"
                  draggable={false}
                  style={{ position: "absolute", left: offset.x, top: offset.y, width: imageSize.width, height: imageSize.height, transform: `scale(${scale})`, transformOrigin: "top left", userSelect: "none", pointerEvents: "none", maxWidth: "none" }}
                />
              )}
            </div>
            <div className="px-1">
              <div className="flex items-center gap-3 text-slate-400">
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8.5" cy="8.5" r="4.75" /><path d="M5.75 8.5h5.5" /><path d="M12.25 12.25 16 16" />
                  </svg>
                </span>
                <input type="range" min={minScale} max={maxScale} step={0.01} value={scale} onChange={(e) => handleScaleChange(Number(e.target.value))} className="w-full accent-rose-500" aria-label="Zoom" />
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center text-slate-500">
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8.5" cy="8.5" r="4.75" /><path d="M5.75 8.5h5.5" /><path d="M8.5 5.75v5.5" /><path d="M12.25 12.25 16 16" />
                  </svg>
                </span>
              </div>
            </div>
          </>
        )}
        {cropError && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{cropError}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={applyCrop} disabled={!imageEl} className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:opacity-50">Use photo</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | "">("");
  const [gender, setGender] = useState<Gender | "">("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [preferredAgeRanges, setPreferredAgeRanges] = useState<AgeRange[]>(AGE_RANGES);

  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loadingPhotoUrls, setLoadingPhotoUrls] = useState<string[]>([]);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status !== "loading") setLoading(false);
      return;
    }

    let cancelled = false;

    fetch("/api/me")
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            // No profile yet – redirect to onboarding
            router.push("/profile");
            return;
          }
          throw new Error("Failed to load profile");
        }
        return res.json();
      })
      .then((participant) => {
        if (cancelled || !participant) return;
        try {
          const answers = JSON.parse(participant.answers_json) as ParticipantAnswers;
          setName(answers.name ?? "");
          setPhone(answers.phone_number ?? "");
          setAgeRange(answers.age_range ?? "");
          setGender(answers.gender ?? "");
          setLocation(answers.location ?? "");
          setBio(answers.bio ?? "");
          setInterests(answers.interests ?? []);
          setPreferredAgeRanges(answers.preferred_age_ranges?.length ? answers.preferred_age_ranges : AGE_RANGES);
          setPhotoUrls(answers.photo_urls ?? []);
        } catch {
          setError("Could not parse your profile data.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your profile. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [status, router]);

  function toggleInterest(interest: Interest) {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= INTEREST_LIMIT) return prev;
      return [...prev, interest];
    });
  }

  async function handlePhotoFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.");
      return;
    }
    setCropFile(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setCropFile(null);
    setPhotoError(null);
    setProcessingPhoto(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", new File([blob], "photo.webp", { type: "image/webp" }));

      const xhr = new XMLHttpRequest();
      const uploadResult = await new Promise<{ url: string }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 95));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error("Invalid server response")); }
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body?.error ?? "Upload failed"));
            } catch { reject(new Error("Upload failed")); }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("POST", "/api/upload-photo");
        xhr.send(formData);
      });

      setUploadProgress(100);

      const newUrls = [...photoUrls, uploadResult.url];
      setPhotoUrls(newUrls);
      setLoadingPhotoUrls((prev) => [...prev, uploadResult.url]);

      // Auto-save photos via checkpoint (partial update, no strict validation)
      await savePhotoCheckpoint(newUrls);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setProcessingPhoto(false);
      setUploadProgress(null);
    }
  }

  async function savePhotoCheckpoint(urls: string[]) {
    const response = await fetch("/api/checkpoint-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_urls: urls }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error((data as { error?: string } | null)?.error ?? "Could not save photos.");
    }
  }

  async function handleDeletePhoto(url: string) {
    const newUrls = photoUrls.filter((u) => u !== url);
    setPhotoUrls(newUrls);

    await savePhotoCheckpoint(newUrls);

    fetch("/api/delete-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

  function buildAnswers(overrides?: Partial<ParticipantAnswers>): ParticipantAnswers {
    return {
      name: name.trim(),
      phone_number: phone.trim(),
      age_range: ageRange as AgeRange,
      preferred_age_ranges: preferredAgeRanges,
      gender: gender as Gender,
      location: location.trim() || undefined,
      bio: bio.trim() || undefined,
      interests,
      photo_urls: photoUrls,
      ...overrides,
    };
  }

  async function saveProfile(overrides?: Partial<ParticipantAnswers>) {
    const answers = buildAnswers(overrides);

    const response = await fetch("/api/submit-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(
        (data as { error?: string })?.error ?? "Failed to save profile"
      );
    }
  }

  async function handleSave() {
    setNameError(null);
    setPhoneError(null);
    setError(null);

    const nameResult = nameSchema.safeParse(name);
    if (!nameResult.success) {
      setNameError(nameResult.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    const phoneResult = phoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      setPhoneError(phoneResult.error.issues[0]?.message ?? "Invalid phone number");
      return;
    }
    if (!ageRange) { setError("Please select your age range."); return; }
    if (!gender) { setError("Please select your gender."); return; }
    if (interests.length === 0) { setError("Please select at least one interest."); return; }

    setSaving(true);
    setSaveSuccess(false);
    try {
      await saveProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const response = await fetch("/api/delete-account", { method: "DELETE" });
      if (!response.ok) throw new Error("Deletion failed");
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Could not delete your account. Please try again.");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-slate-500">Loading your account…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Delete your account?</h2>
            <p className="text-sm leading-6 text-slate-500">
              This will permanently delete your profile, photos, and all your match data. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileSelected}
      />

      {/* Header */}
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
        <div>
          <p className="text-base font-bold text-rose-600">Matchmaker</p>
          <p className="text-xs leading-tight text-slate-400">{session?.user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/matches")}
            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
          >
            Matches
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 sm:px-6 py-6 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 px-1">Account</h1>

        {error && (
          <div className="rounded-[24px] bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* Photos */}
        <Section title="Photos">
          <p className="text-sm text-slate-500">Up to 3 photos. Tap a slot to add or replace.</p>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => {
              const photoUrl = photoUrls[index];
              const isPhotoLoading = photoUrl ? loadingPhotoUrls.includes(photoUrl) : false;
              const filledCount = photoUrls.length;
              const isNextSlot = index === filledCount;
              const uploadLabel = uploadProgress !== null && uploadProgress < 100
                ? `Uploading ${uploadProgress}%`
                : "Saving…";

              return (
                <div key={index} className="relative aspect-square">
                  {photoUrl ? (
                    <>
                      <img
                        src={photoUrl}
                        alt={`Photo ${index + 1}`}
                        onLoad={() => setLoadingPhotoUrls((prev) => prev.filter((u) => u !== photoUrl))}
                        onError={() => { setLoadingPhotoUrls((prev) => prev.filter((u) => u !== photoUrl)); setPhotoError("The uploaded image could not be displayed."); }}
                        className={`h-full w-full rounded-[24px] object-cover transition-opacity ${isPhotoLoading ? "opacity-0" : "opacity-100"}`}
                      />
                      {isPhotoLoading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-[24px] bg-white/75 backdrop-blur-[1px]">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
                        </div>
                      )}
                      {photoUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photoUrl)}
                          aria-label={`Remove photo ${index + 1}`}
                          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-lg transition hover:bg-slate-700"
                        >
                          ×
                        </button>
                      )}
                    </>
                  ) : isNextSlot ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processingPhoto}
                      className="h-full w-full rounded-[24px] border-2 border-dashed border-rose-200 bg-rose-50/70 flex flex-col items-center justify-center gap-1 text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processingPhoto ? (
                        <span className="w-full px-4 text-center">
                          <span className="block text-xs font-medium text-rose-500">{uploadLabel}</span>
                          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-rose-100">
                            <span className="block h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 transition-[width] duration-200" style={{ width: `${uploadProgress ?? 100}%` }} />
                          </span>
                        </span>
                      ) : (
                        <>
                          <span className="text-2xl">+</span>
                          {index === 0 && <span className="text-xs font-medium">Add photo</span>}
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
          {photoError && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{photoError}</p>}
        </Section>

        {/* Basic info */}
        <Section title="Basic info">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                maxLength={100}
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(null); }}
                onBlur={() => {
                  const result = nameSchema.safeParse(name.trim());
                  if (!result.success) setNameError(result.error.issues[0]?.message ?? null);
                }}
                placeholder="Jamie M."
                className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
              />
              {nameError && <p className="mt-1.5 px-1 text-xs text-red-500">{nameError}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
                onBlur={() => {
                  const result = phoneSchema.safeParse(phone.trim());
                  if (!result.success) setPhoneError(result.error.issues[0]?.message ?? null);
                }}
                placeholder="+1 416 555 0100"
                className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
              />
              {phoneError && <p className="mt-1.5 px-1 text-xs text-red-500">{phoneError}</p>}
              <p className="mt-1.5 px-1 text-xs text-slate-400">Only shared with mutual matches.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Age range</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AGE_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setAgeRange(range)}
                    className={[
                      "rounded-[20px] border px-4 py-3 text-sm font-medium transition",
                      ageRange === range
                        ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-200"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-rose-200 hover:bg-rose-50",
                    ].join(" ")}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">I am a</label>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={[
                      "rounded-[20px] border px-4 py-3 text-sm font-medium transition",
                      gender === opt.value
                        ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-200"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-rose-200 hover:bg-rose-50",
                    ].join(" ")}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* About */}
        <Section title="About you">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Location <span className="font-normal text-slate-400">(optional)</span></label>
              <input
                type="text"
                maxLength={100}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Toronto, ON"
                className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Bio <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A little about yourself…"
                className="w-full resize-none rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
              />
            </div>
          </div>
        </Section>

        {/* Interests */}
        <Section title="Interests">
          <p className="text-sm text-slate-500">Pick up to {INTEREST_LIMIT} that best describe you.</p>
          <div className="grid grid-cols-2 gap-2">
            {INTEREST_OPTIONS.map((opt) => {
              const selected = interests.includes(opt.value);
              const atLimit = interests.length >= INTEREST_LIMIT;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleInterest(opt.value)}
                  disabled={!selected && atLimit}
                  className={[
                    "flex items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-medium transition",
                    selected
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40",
                  ].join(" ")}
                >
                  <span className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
                    selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent",
                  ].join(" ")}>✓</span>
                  <span>{opt.emoji} {opt.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Save button */}
        <div className="space-y-3 pb-2">
          {saveSuccess && (
            <div className="rounded-[24px] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 text-center">
              Profile saved ✓
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || processingPhoto}
            className="w-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {/* Danger zone */}
        <Section title="Danger zone">
          <p className="text-sm text-slate-500">
            Permanently delete your account, profile, photos, and all match data.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50"
          >
            Delete account
          </button>
        </Section>

        <div className="h-8" />
      </div>
    </div>
  );
}
