"use client";

import { useRef, useState } from "react";

import { usePlanner } from "@/features/planner/planner-context";
import { looksLikeResearchPrompt, runAgenticResearch, type ResearchReport } from "@/features/assistant/research-tool";
import { PointChatAvatar } from "@/features/assistant/point-chat-avatar";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const STARTER: ChatMessage[] = [
  {
    id: "m-1",
    role: "assistant",
    text: "I’m point-chat.ai. I can chat naturally and actively manage your tasks and schedule. Try: add task physics review for 40 min",
  },
];

const QUICK_SUGGESTIONS = [
  "Suggest my best study blocks for today",
  "Optimize my schedule to reduce stress",
  "Find open slots for a 90 minute focus session",
  "Research best way to study Computer Systems effectively",
];

export function AssistantChatClient() {
  const { runPointChat, pendingProposal, confirmPendingProposal, cancelPendingProposal, tasks, events } = usePlanner();
  const idCounterRef = useRef(2);
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [researchReport, setResearchReport] = useState<ResearchReport | null>(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);

  const selectedDay = new Date();
  selectedDay.setDate(selectedDay.getDate() + dayOffset);
  selectedDay.setHours(0, 0, 0, 0);
  const selectedDayEnd = new Date(selectedDay);
  selectedDayEnd.setDate(selectedDayEnd.getDate() + 1);

  const selectedEvents = events
    .filter((event) => {
      const start = new Date(event.startIso).getTime();
      return start >= selectedDay.getTime() && start < selectedDayEnd.getTime();
    })
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  const selectedTaskIds = new Set(selectedEvents.map((event) => event.taskId).filter((value): value is string => Boolean(value)));
  const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id));
  const completedCount = selectedTasks.filter((task) => task.status === "done").length;

  function nextMessageId(role: "u" | "a") {
    idCounterRef.current += 1;
    return `${role}-${idCounterRef.current}`;
  }

  async function sendPrompt(text: string) {
    const cleaned = text.trim();
    if (!cleaned || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: nextMessageId("u"),
      role: "user",
      text: cleaned,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    setIsSending(true);
    if (looksLikeResearchPrompt(cleaned)) {
      const report = await runAgenticResearch(cleaned);
      setResearchReport(report);
      const assistantMessage: ChatMessage = {
        id: nextMessageId("a"),
        role: "assistant",
        text: `${report.summary} I added the key findings, sources, and a relevance graph below.`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsSending(false);
      return;
    }

    const response = runPointChat(cleaned);
    const assistantMessage: ChatMessage = {
      id: nextMessageId("a"),
      role: "assistant",
      text: response.message,
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setResearchReport(null);
    setIsSending(false);
  }

  async function submit() {
    await sendPrompt(input);
  }

  function confirmProposal() {
    const message = confirmPendingProposal();
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId("a"),
        role: "assistant",
        text: message,
      },
    ]);
  }

  function rejectProposal() {
    cancelPendingProposal();
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId("a"),
        role: "assistant",
        text: "All good — I canceled that change. We can try a different plan.",
      },
    ]);
  }

  return (
    <div className="flex h-[80vh] min-h-[640px] flex-col rounded-2xl border border-gold/25 bg-surface/85 shadow-[0_0_0_1px_rgba(200,162,77,0.14),0_28px_70px_rgba(0,0,0,0.55)] md:h-[82vh]">
      <div className="border-b border-surface-border px-5 py-4 md:px-6 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">point-chat.ai</p>
            <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Companion Planner</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsOverviewOpen(true)}
              className="rounded-md border border-surface-border bg-surface/70 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:border-gold/50"
            >
              Day overview
            </button>
            <div className="text-center">
              <PointChatAvatar size={56} />
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-strong">Lock In Twin!!!</p>
            </div>
          </div>
        </div>
      </div>

      {isOverviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div className="onpoint-card w-full max-w-2xl p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">Daily Overview</p>
                <h2 className="mt-1 text-lg font-semibold">
                  {selectedDay.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOverviewOpen(false)}
                className="rounded-md border border-surface-border px-2 py-1 text-xs text-zinc-200"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDayOffset((prev) => prev - 1)}
                className="rounded-md border border-surface-border px-2.5 py-1.5 text-xs"
              >
                Previous day
              </button>
              <button
                type="button"
                onClick={() => setDayOffset(0)}
                className="rounded-md border border-surface-border px-2.5 py-1.5 text-xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDayOffset((prev) => prev + 1)}
                className="rounded-md border border-surface-border px-2.5 py-1.5 text-xs"
              >
                Next day
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-surface-border bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-wide text-gold">Scheduled blocks</p>
                <p className="mt-1 text-lg font-semibold">{selectedEvents.length}</p>
              </div>
              <div className="rounded-md border border-surface-border bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-wide text-gold">Tracked tasks</p>
                <p className="mt-1 text-lg font-semibold">{selectedTasks.length}</p>
              </div>
              <div className="rounded-md border border-surface-border bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-wide text-gold">Completed</p>
                <p className="mt-1 text-lg font-semibold">{completedCount}</p>
              </div>
            </div>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {selectedEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-surface-border bg-surface/65 p-3 text-sm">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-zinc-300">
                    {new Date(event.startIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(event.endIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
              {!selectedEvents.length ? (
                <div className="rounded-md border border-surface-border bg-surface/55 p-3 text-sm text-zinc-400">
                  No scheduled blocks for this day.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[94%] rounded-2xl px-4 py-3.5 text-base md:max-w-[78%] ${
                message.role === "user"
                  ? "border border-gold/50 bg-gold/15 text-zinc-100"
                  : "border border-surface-border bg-background text-zinc-200"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isSending ? (
          <div className="flex justify-start">
            <div className="max-w-[94%] rounded-2xl border border-surface-border bg-background px-4 py-3.5 text-base text-zinc-400 md:max-w-[78%]">
              Thinking...
            </div>
          </div>
        ) : null}

        {researchReport ? (
          <div className="rounded-xl border border-surface-border bg-background p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Research Mode</p>
            <h2 className="mt-1 text-base font-semibold">{researchReport.query}</h2>
            <p className="mt-1 text-zinc-300">{researchReport.summary}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-surface-border bg-surface/65 p-3">
                <p className="text-xs uppercase tracking-wide text-gold">Key findings</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-200">
                  {researchReport.keyFindings.map((finding) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-surface-border bg-surface/65 p-3">
                <p className="text-xs uppercase tracking-wide text-gold">Relevance graph</p>
                <div className="mt-2 space-y-2">
                  {researchReport.graph.map((point) => (
                    <div key={point.label}>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-300">
                        <span>{point.label}</span>
                        <span>{point.score}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-border">
                        <div className="h-2 rounded-full bg-gold/70" style={{ width: `${point.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-surface-border bg-surface/65 p-3">
              <p className="text-xs uppercase tracking-wide text-gold">Sources</p>
              <ul className="mt-2 space-y-2">
                {researchReport.sources.map((source) => (
                  <li key={source.url} className="rounded border border-surface-border bg-background p-2">
                    <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-gold-strong hover:underline">
                      {source.title}
                    </a>
                    <p className="mt-1 text-xs text-zinc-300">{source.snippet}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-zinc-400">Tools used: {researchReport.usedTools.join(" · ")}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-surface-border p-3.5 md:p-4">
        <div className="mb-2.5">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-zinc-400">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void sendPrompt(suggestion)}
                className="rounded-full border border-surface-border bg-surface/70 px-3 py-1.5 text-[11px] text-zinc-200 hover:border-gold/50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {pendingProposal ? (
          <div className="mb-3 rounded-md border border-gold/40 bg-gold/10 p-3 text-xs">
            <p className="font-medium text-gold-strong">Confirmation needed: {pendingProposal.title}</p>
            <p className="mt-1 text-zinc-200">{pendingProposal.summary}</p>
            {pendingProposal.warnings.length ? (
              <ul className="mt-1 list-disc pl-4 text-zinc-300">
                {pendingProposal.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex gap-2">
              <button
                onClick={confirmProposal}
                className="rounded-md border border-gold bg-gold/20 px-2.5 py-1 text-[11px] text-gold-strong"
              >
                Confirm changes
              </button>
              <button
                onClick={rejectProposal}
                className="rounded-md border border-surface-border px-2.5 py-1 text-[11px] text-zinc-200"
              >
                Keep current schedule
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Tell me what to schedule or update..."
            rows={2}
            className="min-h-[64px] flex-1 resize-none rounded-xl border border-surface-border bg-background px-4 py-2.5 text-base"
          />
          <button
            onClick={() => void submit()}
            disabled={isSending}
            className="rounded-xl border border-gold bg-gold/15 px-5 py-3 text-base font-medium text-gold-strong disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
