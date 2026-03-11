"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuizQuestion } from "@/types";

type AdminTab = "overview" | "users" | "quiz";

type AdminUserSummary = {
    id: string;
    email: string;
    name: string;
    created_at: string;
    age_range?: string;
    gender?: string;
    location?: string;
    interests: string[];
    photo_count: number;
    photo_urls: string[];
    quiz_completed: boolean;
};

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<AdminTab>("overview");

    const [users, setUsers] = useState<AdminUserSummary[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [userError, setUserError] = useState<string | null>(null);
    const [expandedPhotoUserId, setExpandedPhotoUserId] = useState<string | null>(null);

    const [testAction, setTestAction] = useState<"add" | "delete" | null>(null);
    const [testStatus, setTestStatus] = useState<string | null>(null);
    const [testError, setTestError] = useState<string | null>(null);

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

        loadUsers();

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

    async function loadUsers() {
        setLoadingUsers(true);
        setUserError(null);

        try {
            const response = await fetch("/api/admin/users");
            const data = await response.json();
            if (!response.ok) {
                setUserError(data.error ?? "Could not load users.");
            } else {
                setUsers(data as AdminUserSummary[]);
                setExpandedPhotoUserId((current) => {
                    if (!current) {
                        return current;
                    }

                    return (data as AdminUserSummary[]).some((user) => user.id === current) ? current : null;
                });
            }
        } catch {
            setUserError("Network error. Please try again.");
        } finally {
            setLoadingUsers(false);
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

    async function handleTestData(action: "add" | "delete") {
        setTestAction(action);
        setTestStatus(null);
        setTestError(null);

        try {
            const response = await fetch("/api/admin/test-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await response.json();

            if (!response.ok) {
                setTestError(data.error ?? "Could not update test data.");
            } else {
                setTestStatus(
                    action === "add"
                        ? `Added ${data.participants} test users and ${data.likes} likes.`
                        : `Deleted ${data.participants} test users and ${data.likes} likes.`
                );
                await loadUsers();
            }
        } catch {
            setTestError("Network error. Please try again.");
        } finally {
            setTestAction(null);
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
                            Matchmaker1
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

                <section className="rounded-[32px] border border-white/80 bg-white/92 p-3 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
                    <div className="grid gap-2 sm:grid-cols-3">
                        {[
                            { id: "overview", label: "Overview" },
                            { id: "users", label: `Users (${users.length})` },
                            { id: "quiz", label: "Quiz" },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as AdminTab)}
                                className={`rounded-[22px] px-4 py-3 text-sm font-semibold transition ${
                                    activeTab === tab.id
                                        ? "bg-slate-900 text-white"
                                        : "bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </section>

                {activeTab === "overview" && <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
                    <h2 className="text-xl font-semibold text-slate-900">Runtime ranking</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Top Picks are calculated automatically whenever a user opens the results page. There is no manual matching job anymore.
                    </p>
                    <div className="mt-4 rounded-[24px] border border-rose-100 bg-rose-50/60 p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">Current score inputs</p>
                        <p className="mt-2 leading-6">
                            Opposite sex is required. After that, ranking is based on reciprocal age preference fit, shared interests, same-location bonus, and matching quiz answer pairs.
                        </p>
                    </div>
                    <div className="mt-8 border-t border-rose-100 pt-6">
                        <h3 className="text-lg font-semibold text-slate-900">Test data</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Add a small set of realistic demo users and mutual likes, or remove every test record ending in `@matchmaker.test`.
                        </p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => handleTestData("add")}
                                disabled={testAction !== null}
                                className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
                            >
                                {testAction === "add" ? "Adding test values…" : "Add test values"}
                            </button>
                            <button
                                onClick={() => handleTestData("delete")}
                                disabled={testAction !== null}
                                className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                            >
                                {testAction === "delete" ? "Deleting test values…" : "Delete test values"}
                            </button>
                        </div>
                        {testError && <p className="mt-3 text-sm text-red-600">{testError}</p>}
                        {testStatus && <p className="mt-3 text-sm text-emerald-600">{testStatus}</p>}
                    </div>
                </section>}

                {activeTab === "users" && <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Users</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                View every stored participant, including profile completeness and quiz status.
                            </p>
                        </div>
                        <button
                            onClick={loadUsers}
                            disabled={loadingUsers}
                            className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                        >
                            {loadingUsers ? "Refreshing…" : "Refresh users"}
                        </button>
                    </div>

                    {userError && <p className="mt-4 text-sm text-red-600">{userError}</p>}

                    {loadingUsers ? (
                        <p className="mt-6 text-sm text-slate-500">Loading users…</p>
                    ) : users.length === 0 ? (
                        <p className="mt-6 text-sm text-slate-500">No users yet.</p>
                    ) : (
                        <div className="mt-6 space-y-4">
                            {users.map((user) => (
                                <article key={user.id} className="rounded-[28px] border border-rose-100 bg-rose-50/50 p-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">{user.name || "Unnamed user"}</h3>
                                            <p className="text-sm text-slate-500">{user.email}</p>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Joined {new Date(user.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                {user.gender ?? "Unknown gender"}
                                            </span>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                {user.age_range ?? "No age"}
                                            </span>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                {user.quiz_completed ? "Quiz complete" : "Quiz pending"}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedPhotoUserId((current) =>
                                                        current === user.id ? null : user.id
                                                    )
                                                }
                                                disabled={user.photo_urls.length === 0}
                                                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Photos ({user.photo_count})
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                                        <p>
                                            <span className="font-semibold text-slate-900">Location:</span>{" "}
                                            {user.location ?? "Not provided"}
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-900">Interests:</span>{" "}
                                            {user.interests.length > 0 ? user.interests.join(", ") : "None"}
                                        </p>
                                    </div>
                                    {expandedPhotoUserId === user.id && user.photo_urls.length > 0 && (
                                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                            {user.photo_urls.slice(0, 3).map((photoUrl, index) => (
                                                <div key={photoUrl} className="overflow-hidden rounded-[22px] border border-rose-100 bg-white">
                                                    <img
                                                        src={photoUrl}
                                                        alt={`${user.name || user.email} photo ${index + 1}`}
                                                        className="h-44 w-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>}

                {activeTab === "quiz" && <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(190,24,93,0.08)] backdrop-blur">
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
                </section>}
            </div>
        </div>
    );
}