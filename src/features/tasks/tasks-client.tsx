"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { usePlanner } from "@/features/planner/planner-context";
import type { TaskType } from "@/types/domain";

const TASK_TYPES: TaskType[] = [
  "fixed",
  "flexible",
  "splittable",
  "optional",
  "recurring",
  "time-restricted",
];

export function TasksClient() {
  const { tasks, events } = usePlanner();
  const [filterType, setFilterType] = useState<"all" | TaskType>("all");

  const visibleTasks = useMemo(
    () => tasks.filter((task) => (filterType === "all" ? true : task.type === filterType)),
    [filterType, tasks],
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Track tasks and schedule blocks created by point-chat.ai."
      />

      <SectionCard title="Create tasks in chat" description="Task creation is now fully handled by point-chat.ai.">
        <p className="text-sm text-zinc-300">
          Open Home chat and say something like: “Add task review systems notes at 15:00 for 90 min.” If details are missing,
          point-chat.ai will ask follow-up questions before creating it.
        </p>
      </SectionCard>

      <SectionCard title="Task categories" description="Filter by scheduling type.">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterType("all")} className="rounded-full border border-surface-border px-2.5 py-1 text-xs">All</button>
          {TASK_TYPES.map((type) => (
            <button key={type} onClick={() => setFilterType(type)} className="rounded-full border border-surface-border px-2.5 py-1 text-xs">
              {type}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="All tasks" description="Local task list for MVP behavior testing.">
        <ul className="space-y-2 text-sm">
          {visibleTasks.map((task) => (
            <li key={task.id} className="rounded-md border border-surface-border bg-surface/65 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{task.title}</p>
                <StatusChip label={task.priority} tone={task.priority === "critical" ? "warning" : "neutral"} />
              </div>
              <p className="mt-1 text-zinc-300">
                {task.type} · {task.estimatedMinutes} min · {task.status}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Calendar activities"
        description="All scheduled activities currently reflected inside On Point."
      >
        <ul className="space-y-2 text-sm">
          {events.slice(0, 12).map((event) => (
            <li key={event.id} className="rounded-md border border-surface-border bg-surface/65 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{event.title}</p>
                <StatusChip label={event.source} tone={event.source === "task" ? "gold" : "neutral"} />
              </div>
              <p className="mt-1 text-zinc-300">
                {new Date(event.startIso).toLocaleString()} - {new Date(event.endIso).toLocaleTimeString()}
              </p>
            </li>
          ))}
          {!events.length ? <li className="text-zinc-400">No activities scheduled yet.</li> : null}
        </ul>
      </SectionCard>
    </div>
  );
}
