"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || redirectedRef.current) return;
    redirectedRef.current = true;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((participant) => {
        if (participant?.answers_json && participant?.quiz_answers_json) {
          router.push("/matches");
        } else {
          router.push("/profile");
        }
      })
      .catch(() => router.push("/profile"));
  }, [status, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center">
        {/* Logo / Title */}
        <div className="mb-2 text-5xl">💘</div>
        <h1 className="mb-2 text-3xl font-bold text-rose-600">Matchmaker</h1>
        <p className="mb-8 text-gray-500">
          Find your perfect match. Sign in with Google to get started.
        </p>

        {status === "loading" ? (
          <div className="text-gray-400">Loading…</div>
        ) : session ? (
          <div className="text-gray-400">Redirecting…</div>
        ) : (
          <button
            onClick={() => signIn("google", { callbackUrl: "/profile" })}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-6 py-3 text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            {/* Google "G" icon */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        )}

        <p className="mt-6 text-xs text-gray-400">
          By signing in you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
