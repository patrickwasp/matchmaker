"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuizQuestion } from "@/types";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<{ matched: number; participants: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [initialising, setInitialising] = useState(false);
    const [initDone, setInitDone] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);
    const [savingQuestions, setSavingQuestions] = useState(false);
    const [questionError, setQuestionError] = useState<string | null>(null);
    const [questionStatus, setQuestionStatus] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [router, status]);

    useEffect(() => {
        if (status !== "authenticated") {
            return;
        }

        fetch("/api/quiz-questions")
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error ?? "Could not load quiz questions");
                }
                return data as QuizQuestion[];
            })
            .then((data) => setQuestions(data))
            .catch((requestError: Error) => setQuestionError(requestError.message))
            .finally(() => setLoadingQuestions(false));
    }, [status]);

    async function handleInitSheets() {
        setInitialising(true);
        setInitDone(false);
        setInitError(null);
        try {
            const response = await fetch("/api/init-sheets", { method: "POST" });
            const data = await response.json();
            if (!response.ok) {
                setInitError(data.error ?? "Something went wrong.");
            } else {
                setInitDone(true);
            }
        } catch {
            setInitError("Network error. Please try again.");
        } finally {
            setInitialising(false);
        }
    }

    async function handleRunMatching() {
        setRunning(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch("/api/run-matching", { method: "POST" });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error ?? "Something went wrong.");
            } else {
                setResult({ matched: data.matched, participants: data.participants });
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setRunning(false);
        }
    }

    function updateQuestion(index: number, updater: (question: QuizQuestion) => QuizQuestion) {
        setQuestionStatus(null);
        setQuestionError(null);
        setQuestions((previous) =>
            previous.map((question, questionIndex) =>
                questionIndex === index ? updater(question) : question
            )
        );
    }

    async function handleSaveQuestions() {
        setSavingQuestions(true);
        setQuestionStatus(null);
        setQuestionError(null);

        try {
            const response = await fetch("/api/quiz-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questions }),
            });
            const data = await response.json();
            if (!response.ok) {
                setQuestionError(data.error ?? "Could not save questions.");
            } else {
                setQuestionStatus("Quiz questions saved.");
            }
        } catch {
            setQuestionError("Network error. Please try again.");
        } finally {
            setSavingQuestions(false);
        }
    }

    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,113,133,0.18),_transparent_30%),linear-gradient(180deg,_#fff8f1_0%,_#fff1f2_55%,_#ffe4e6_100%)]">
                <p className="text-sm font-medium text-slate-500">Loading admin…</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,113,133,0.18),_transparent_30%),linear-gradient(180deg,_#fff8f1_0%,_#fff1f2_55%,_#ffe4e6_100%)] px-4 py-6 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
                <nav className="flex flex-col gap-3 rounded-[28px] border border-white/70 bg-white/90 px-4 py-4 shadow-[0_18px_60px_rgba(148,24,70,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">
                            Matchmaker
                        </p>
                        <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
                        <p className="text-sm text-slate-500">{session?.user?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push("/profile")}
                            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                        >
                            Profile
                        </button>
                        <button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                            Sign out
                        </button>
                    </div>
                </nav>

                <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
                    <h2 className="text-xl font-semibold text-slate-900">Spreadsheet setup</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Creates the participants, matches, and quiz question tabs if they do not exist yet.
                    </p>
                    <button
                        onClick={handleInitSheets}
                        disabled={initialising}
                        className="mt-4 rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
                    >
                        {initialising ? "Initialising…" : "Initialise sheets"}
                    </button>
                    {initError && <p className="mt-3 text-sm text-red-600">{initError}</p>}
                    {initDone && <p className="mt-3 text-sm text-emerald-600">Sheets are ready.</p>}
                </section>

                <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
                    <h2 className="text-xl font-semibold text-slate-900">Run matching</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Builds heterosexual one-to-one matches from saved profiles and quiz answers.
                    </p>
                    <button
                        onClick={handleRunMatching}
                        disabled={running}
                        className="mt-4 rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
                    >
                        {running ? "Running matchmaking…" : "Run matching now"}
                    </button>
                    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                    {result && (
                        <p className="mt-3 text-sm text-emerald-600">
                            Matching complete. {result.matched} pairs created from {result.participants} participants.
                        </p>
                    )}
                </section>

                <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Quiz questions</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Each question asks users to pick one answer for themselves and one or more for a match.
                            </p>
                        </div>
                        <button
                            onClick={handleSaveQuestions}
                            disabled={savingQuestions || loadingQuestions}
                            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                        >
                            {savingQuestions ? "Saving…" : "Save quiz"}
                        </button>
                    </div>

                    {questionError && <p className="mt-4 text-sm text-red-600">{questionError}</p>}
                    {questionStatus && <p className="mt-4 text-sm text-emerald-600">{questionStatus}</p>}

                    {loadingQuestions ? (
                        <p className="mt-6 text-sm text-slate-500">Loading questions…</p>
                    ) : (
                        <div className="mt-6 space-y-5">
                            {questions.map((question, index) => (
                                <article key={question.id} className="rounded-[28px] border border-rose-100 bg-rose-50/50 p-5">
                                    <div className="grid gap-4">
                                        <label className="text-sm font-semibold text-slate-700">
                                            Prompt
                                            <input
                                                type="text"
                                                value={question.prompt}
                                                onChange={(event) =>
                                                    updateQuestion(index, (previous) => ({
                                                        ...previous,
                                                        prompt: event.target.value,
                                                    }))
                                                }
                                                className="mt-2 w-full rounded-[20px] border border-rose-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                                            />
                                        </label>

                                        <div className="grid gap-3 sm:grid-cols-3">
                                            {question.options.map((option, optionIndex) => (
                                                <div key={option.value} className="rounded-[20px] bg-white p-4">
                                                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                        Option {optionIndex + 1}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={option.label}
                                                        onChange={(event) =>
                                                            updateQuestion(index, (previous) => ({
                                                                ...previous,
                                                                options: previous.options.map((existingOption, existingIndex) =>
                                                                    existingIndex === optionIndex
                                                                        ? {
                                                                            ...existingOption,
                                                                            label: event.target.value,
                                                                        }
                                                                        : existingOption
                                                                ),
                                                            }))
                                                        }
                                                        className="mt-2 w-full rounded-[16px] border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={option.emoji ?? ""}
                                                        onChange={(event) =>
                                                            updateQuestion(index, (previous) => ({
                                                                ...previous,
                                                                options: previous.options.map((existingOption, existingIndex) =>
                                                                    existingIndex === optionIndex
                                                                        ? {
                                                                            ...existingOption,
                                                                            emoji: event.target.value || undefined,
                                                                        }
                                                                        : existingOption
                                                                ),
                                                            }))
                                                        }
                                                        className="mt-2 w-full rounded-[16px] border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                                                        placeholder="Emoji"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}