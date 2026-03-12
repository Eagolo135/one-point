"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { usePlanner } from "@/features/planner/planner-context";
import type { Task, TaskPriority, TaskType } from "@/types/domain";

type TaskForm = {
  title: string;
  type: TaskType;
  priority: TaskPriority;
  estimatedMinutes: number;
  startTime: string;
  endTime: string;
};

const TASK_TYPES: TaskType[] = [
  "fixed",
  "flexible",
  "splittable",
  "optional",
  "recurring",
  "time-restricted",
];

const PRIORITIES: TaskPriority[] = ["critical", "essential", "important", "optional", "leisure"];

const INITIAL_FORM: TaskForm = {
  title: "",
  type: "flexible",
  priority: "important",
  estimatedMinutes: 45,
  startTime: "",
  endTime: "",
};

function timeToIsoToday(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function TasksClient() {
  const { tasks, addTask, updateTask, events } = usePlanner();
  const [form, setForm] = useState<TaskForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | TaskType>("all");
  const [formError, setFormError] = useState<string | null>(null);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => (filterType === "all" ? true : task.type === filterType)),
    [filterType, tasks],
  );

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setFormError(null);
  }

  async function submitTask() {
    if (!form.title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    setFormError(null);

    if (editingId) {
      updateTask(editingId, {
        title: form.title,
        type: form.type,
        priority: form.priority,
        estimatedMinutes: form.estimatedMinutes,
      });

      resetForm();
      return;
    }

    if (!form.startTime || !form.endTime) {
      setFormError("Start time and end time are required.");
      return;
    }

    const startIso = timeToIsoToday(form.startTime);
    const endIso = timeToIsoToday(form.endTime);
    const estimatedMinutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);

    if (estimatedMinutes <= 0) {
      setFormError("End time must be later than start time.");
      return;
    }

    addTask({
      title: form.title,
      type: form.type,
      priority: form.priority,
      estimatedMinutes,
      startIso,
      endIso,
    });

    resetForm();
  }

  function editTask(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      type: task.type,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      startTime: "",
      endTime: "",
    });
    setFormError(null);
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Manage daily, weekly, recurring, and optional work."
        action={
          <button
            onClick={resetForm}
            className="rounded-lg border border-gold bg-gold/15 px-3 py-2 text-xs font-medium text-gold-strong"
          >
            {editingId ? "Create new" : "Reset"}
          </button>
        }
      />

      <SectionCard title={editingId ? "Edit task" : "Create task"} description="Local-only form for MVP iteration.">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="task-title" className="text-zinc-300">Title</label>
            <input
              id="task-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5"
              placeholder="Task name"
            />
          </div>

          <div>
            <label htmlFor="task-type" className="text-zinc-300">Type</label>
            <select
              id="task-type"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as TaskType }))}
              className="mt-1 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5"
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-priority" className="text-zinc-300">Priority</label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as TaskPriority }))}
              className="mt-1 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-minutes" className="text-zinc-300">Estimated minutes</label>
            <input
              id="task-minutes"
              type="number"
              min={5}
              max={480}
              value={form.estimatedMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, estimatedMinutes: Number(event.target.value) }))}
              className="mt-1 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5"
            />
          </div>

          <div>
            <label htmlFor="task-start" className="text-zinc-300">From (start time)</label>
            <input
              id="task-start"
              type="time"
              value={form.startTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
              className="mt-1 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5"
            />
          </div>

          <div>
            <label htmlFor="task-end" className="text-zinc-300">To (end time)</label>
            <input
              id="task-end"
              type="time"
              value={form.endTime}
              onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
              className="mt-1 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5"
            />
          </div>
        </div>

        {formError ? <p className="mt-3 text-xs text-red-300">{formError}</p> : null}

        <div className="mt-4 flex gap-2">
          <button onClick={() => void submitTask()} className="rounded-md border border-gold bg-gold/15 px-3 py-2 text-sm text-gold-strong">
            {editingId ? "Save task" : "Add task"}
          </button>
          {editingId ? (
            <button onClick={resetForm} className="rounded-md border border-surface-border px-3 py-2 text-sm">
              Cancel edit
            </button>
          ) : null}
        </div>
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
              <button onClick={() => editTask(task)} className="mt-2 rounded-md border border-surface-border px-2 py-1 text-xs">
                Edit
              </button>
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
