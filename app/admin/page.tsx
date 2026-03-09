"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    participants: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  async function handleRunMatching() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/run-matching", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult({ matched: data.matched, participants: data.participants });
      }
    } catch {
      setError("Network error – please try again.");
    } finally {
      setRunning(false);
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
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-2 text-4xl">⚙️</div>
          <h2 className="mb-1 text-2xl font-bold text-gray-900">Admin Panel</h2>
          <p className="mb-2 text-sm text-gray-500">
            Signed in as{" "}
            <span className="font-medium">{session?.user?.email}</span>
          </p>
          <p className="mb-8 text-sm text-gray-400">
            Only users whose email is listed in{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              ADMIN_EMAILS
            </code>{" "}
            can use this panel. Non-admin requests will be rejected by the API.
          </p>

          <button
            onClick={handleRunMatching}
            disabled={running}
            className="w-full rounded-full bg-rose-500 py-3 text-sm font-semibold text-white shadow hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
          >
            {running ? "Running matchmaking algorithm…" : "🚀 Run Matching Now"}
          </button>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              ✅ Matching complete!{" "}
              <strong>{result.matched} pairs</strong> created from{" "}
              <strong>{result.participants} participants</strong>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
