"use client";

import { createContext, useContext, useState } from "react";

import { mockCalendar, mockProfile, mockTasks } from "@/lib/mock/mock-data";
import type { Task, TaskPriority, TaskType } from "@/types/domain";

export type PlannerEvent = {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  source: "task" | "calendar" | "ai";
  taskId?: string;
};

type FreeTimeBlock = {
  startIso: string;
  endIso: string;
  minutes: number;
};

type PlannerProposalOperation =
  | {
      kind: "create";
      title: string;
      minutes: number;
      priority: TaskPriority;
      type: TaskType;
      startIso: string;
      endIso: string;
    }
  | {
      kind: "move";
      eventId: string;
      startIso: string;
      endIso: string;
    }
  | {
      kind: "delete";
      taskId: string;
      taskTitle: string;
    }
  | {
      kind: "update";
      taskId: string;
      patch: Partial<Pick<Task, "title" | "priority" | "type" | "estimatedMinutes">>;
    };

type PlannerProposal = {
  id: string;
  title: string;
  summary: string;
  warnings: string[];
  operations: PlannerProposalOperation[];
};

type PointChatResult = {
  message: string;
  warnings: string[];
  needsConfirmation: boolean;
};

type PlannerContextValue = {
  tasks: Task[];
  events: PlannerEvent[];
  addTask: (input: { title: string; type: TaskType; priority: TaskPriority; estimatedMinutes: number; startIso?: string; endIso?: string }) => Task;
  updateTask: (id: string, input: { title: string; type: TaskType; priority: TaskPriority; estimatedMinutes: number }) => Task | null;
  deleteTask: (id: string) => boolean;
  moveEvent: (eventId: string, startIso: string, endIso: string) => PlannerEvent | null;
  markTaskDoneByTitle: (title: string) => Task | null;
  addEvent: (input: { title: string; startIso: string; endIso: string; source: "calendar" | "ai"; taskId?: string }) => PlannerEvent;
  pendingProposal: PlannerProposal | null;
  confirmPendingProposal: () => string;
  cancelPendingProposal: () => void;
  runPointChat: (prompt: string) => PointChatResult;
  runAssistantCommand: (prompt: string) => string;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

const SLEEP_START_HOUR = 23;
const DAY_START_HOUR = 7;

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 5,
  essential: 4,
  important: 3,
  optional: 2,
  leisure: 1,
};

function createInitialEvents(): PlannerEvent[] {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today
    .getDate()
    .toString()
    .padStart(2, "0")}`;

  return mockCalendar.daily.map((entry) => ({
    id: entry.id,
    title: entry.title,
    startIso: `${dateKey}T${entry.start}:00`,
    endIso: `${dateKey}T${entry.end}:00`,
    source: "calendar" as const,
  }));
}

function addMinutes(dateIso: string, minutes: number): string {
  const date = new Date(dateIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function parseTimeToday(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(bStart).getTime() < new Date(aEnd).getTime();
}

function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = new Date(now);
  end.setHours(SLEEP_START_HOUR, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const end = new Date(endIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${start}-${end}`;
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [events, setEvents] = useState<PlannerEvent[]>(createInitialEvents);
  const [pendingProposal, setPendingProposal] = useState<PlannerProposal | null>(null);

  function tool_get_schedule() {
    const { startIso, endIso } = dayBounds();
    return [...events]
      .filter((event) => overlaps(event.startIso, event.endIso, startIso, endIso))
      .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
  }

  function tool_get_free_time_blocks(minMinutes = 15): FreeTimeBlock[] {
    const schedule = tool_get_schedule();
    const { startIso, endIso } = dayBounds();
    const blocks: FreeTimeBlock[] = [];
    let cursor = new Date(startIso);

    for (const event of schedule) {
      const eventStart = new Date(event.startIso);
      if (eventStart.getTime() > cursor.getTime()) {
        const minutes = Math.round((eventStart.getTime() - cursor.getTime()) / 60000);
        if (minutes >= minMinutes) {
          blocks.push({
            startIso: cursor.toISOString(),
            endIso: eventStart.toISOString(),
            minutes,
          });
        }
      }
      const eventEnd = new Date(event.endIso);
      if (eventEnd.getTime() > cursor.getTime()) {
        cursor = eventEnd;
      }
    }

    const dayEnd = new Date(endIso);
    if (dayEnd.getTime() > cursor.getTime()) {
      const minutes = Math.round((dayEnd.getTime() - cursor.getTime()) / 60000);
      if (minutes >= minMinutes) {
        blocks.push({
          startIso: cursor.toISOString(),
          endIso: dayEnd.toISOString(),
          minutes,
        });
      }
    }

    return blocks;
  }

  function assessWarnings(startIso: string, endIso: string, priority: TaskPriority): string[] {
    const warnings: string[] = [];
    const endHour = new Date(endIso).getHours();
    if (endHour >= SLEEP_START_HOUR) {
      warnings.push("This cuts into your sleep window.");
    }

    const schedule = tool_get_schedule();
    const heavyCountInWindow = schedule.filter((event) => {
      const task = event.taskId ? tasks.find((item) => item.id === event.taskId) : null;
      if (!task) {
        return false;
      }
      const heavy = PRIORITY_WEIGHT[task.priority] >= PRIORITY_WEIGHT.important;
      return heavy && overlaps(event.startIso, event.endIso, addMinutes(startIso, -90), addMinutes(endIso, 90));
    }).length;

    if (heavyCountInWindow >= 2 && PRIORITY_WEIGHT[priority] >= PRIORITY_WEIGHT.important) {
      warnings.push("This stacks too many demanding tasks close together.");
    }

    const totalMinutes = schedule.reduce((sum, event) => {
      const duration = Math.max(0, (new Date(event.endIso).getTime() - new Date(event.startIso).getTime()) / 60000);
      return sum + duration;
    }, 0);
    if (totalMinutes > 10 * 60) {
      warnings.push("Your day is heavily booked already; this may increase stress.");
    }

    return warnings;
  }

  function pickBestSlot(minutes: number, priority: TaskPriority) {
    const blocks = tool_get_free_time_blocks(minutes);
    if (!blocks.length) {
      return null;
    }

    const productiveWindows = mockProfile.productiveWindows;

    const scored = blocks.map((block) => {
      const start = new Date(block.startIso);
      const endIso = addMinutes(block.startIso, minutes);
      const hhmm = `${start.getHours().toString().padStart(2, "0")}:${start
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      const inProductiveWindow = productiveWindows.some(
        (window) => hhmm >= window.start && hhmm <= window.end,
      );
      const warnings = assessWarnings(block.startIso, endIso, priority);
      const score = (inProductiveWindow ? 2 : 0) - warnings.length;
      return {
        startIso: block.startIso,
        endIso,
        score,
        warnings,
      };
    });

    scored.sort((a, b) => b.score - a.score || new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
    return scored[0];
  }

  function findTaskByTitle(title: string) {
    const lower = title.trim().toLowerCase();
    return tasks.find((task) => task.title.toLowerCase().includes(lower));
  }

  function tool_create_task(input: {
    title: string;
    type: TaskType;
    priority: TaskPriority;
    estimatedMinutes: number;
    startIso?: string;
    endIso?: string;
  }) {
    const fallback = pickBestSlot(input.estimatedMinutes, input.priority);
    const chosenStart = input.startIso ?? fallback?.startIso ?? addMinutes(new Date().toISOString(), 20);
    const chosenEnd = input.endIso ?? addMinutes(chosenStart, input.estimatedMinutes);
    const chosenEstimatedMinutes = Math.max(
      5,
      Math.round((new Date(chosenEnd).getTime() - new Date(chosenStart).getTime()) / 60000),
    );

    const task: Task = {
      id: `task-${Date.now()}`,
      title: input.title,
      type: input.type,
      priority: input.priority,
      status: "not-started",
      estimatedMinutes: chosenEstimatedMinutes,
    };

    setTasks((prev) => [task, ...prev]);
    setEvents((prev) => [
      {
        id: `event-${Date.now()}`,
        title: task.title,
        startIso: chosenStart,
        endIso: chosenEnd,
        source: "task",
        taskId: task.id,
      },
      ...prev,
    ]);

    return { task, startIso: chosenStart, endIso: chosenEnd, warnings: fallback?.warnings ?? [] };
  }

  function tool_move_task(eventId: string, startIso: string, endIso: string) {
    let moved: PlannerEvent | null = null;
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) {
          return event;
        }
        moved = { ...event, startIso, endIso };
        return moved;
      }),
    );
    return moved;
  }

  function tool_update_task(
    id: string,
    input: { title: string; type: TaskType; priority: TaskPriority; estimatedMinutes: number },
  ) {
    let updatedTask: Task | null = null;

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) {
          return task;
        }

        updatedTask = {
          ...task,
          title: input.title,
          type: input.type,
          priority: input.priority,
          estimatedMinutes: input.estimatedMinutes,
        };

        return updatedTask;
      }),
    );

    setEvents((prev) =>
      prev.map((event) => {
        if (event.taskId !== id) {
          return event;
        }

        return {
          ...event,
          title: input.title,
          endIso: addMinutes(event.startIso, input.estimatedMinutes),
        };
      }),
    );

    return updatedTask;
  }

  function tool_delete_task(taskId: string) {
    let removed = false;
    setTasks((prev) => {
      const next = prev.filter((task) => task.id !== taskId);
      removed = next.length !== prev.length;
      return next;
    });
    setEvents((prev) => prev.filter((event) => event.taskId !== taskId));
    return removed;
  }

  function tool_reorder_tasks(taskOrder: string[]) {
    const schedule = tool_get_schedule();
    const now = new Date();
    const freeBlocks = tool_get_free_time_blocks(15);
    const taskEvents = schedule
      .filter((event) => event.taskId && taskOrder.includes(event.taskId) && new Date(event.startIso).getTime() >= now.getTime())
      .sort((a, b) => {
        const ai = taskOrder.indexOf(a.taskId ?? "");
        const bi = taskOrder.indexOf(b.taskId ?? "");
        return ai - bi;
      });

    let blockIndex = 0;
    for (const event of taskEvents) {
      const duration = Math.max(15, Math.round((new Date(event.endIso).getTime() - new Date(event.startIso).getTime()) / 60000));
      while (blockIndex < freeBlocks.length && freeBlocks[blockIndex].minutes < duration) {
        blockIndex += 1;
      }
      if (blockIndex >= freeBlocks.length) {
        break;
      }
      const block = freeBlocks[blockIndex];
      void tool_move_task(event.id, block.startIso, addMinutes(block.startIso, duration));
      const newStart = new Date(block.startIso);
      newStart.setMinutes(newStart.getMinutes() + duration + 5);
      freeBlocks[blockIndex] = {
        startIso: newStart.toISOString(),
        endIso: block.endIso,
        minutes: Math.max(0, block.minutes - duration - 5),
      };
    }
  }

  function tool_optimize_day_plan() {
    const schedule = tool_get_schedule();
    const flexTaskEvents = schedule.filter((event) => {
      if (!event.taskId) {
        return false;
      }
      const task = tasks.find((item) => item.id === event.taskId);
      return Boolean(task && task.type !== "fixed" && task.status !== "done");
    });

    const prioritized = [...flexTaskEvents].sort((a, b) => {
      const taskA = tasks.find((task) => task.id === a.taskId);
      const taskB = tasks.find((task) => task.id === b.taskId);
      const pa = taskA ? PRIORITY_WEIGHT[taskA.priority] : 0;
      const pb = taskB ? PRIORITY_WEIGHT[taskB.priority] : 0;
      return pb - pa;
    });

    const ids = prioritized.map((event) => event.taskId).filter((id): id is string => Boolean(id));
    tool_reorder_tasks(ids);
    return prioritized.length;
  }

  function addTask(input: { title: string; type: TaskType; priority: TaskPriority; estimatedMinutes: number; startIso?: string; endIso?: string }) {
    return tool_create_task(input).task;
  }

  function updateTask(
    id: string,
    input: { title: string; type: TaskType; priority: TaskPriority; estimatedMinutes: number },
  ) {
    return tool_update_task(id, input);
  }

  function deleteTask(id: string) {
    return tool_delete_task(id);
  }

  function moveEvent(eventId: string, startIso: string, endIso: string) {
    return tool_move_task(eventId, startIso, endIso);
  }

  function markTaskDoneByTitle(title: string) {
    const normalized = title.toLowerCase();
    const target = tasks.find((task) => task.title.toLowerCase().includes(normalized));

    if (!target) {
      return null;
    }

    const updated: Task = { ...target, status: "done" };

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== target.id) {
          return task;
        }

        return updated;
      }),
    );

    return updated;
  }

  function addEvent(input: { title: string; startIso: string; endIso: string; source: "calendar" | "ai"; taskId?: string }) {
    const event: PlannerEvent = {
      id: `event-${Date.now()}`,
      title: input.title,
      startIso: input.startIso,
      endIso: input.endIso,
      source: input.source,
      taskId: input.taskId,
    };

    setEvents((prev) => [event, ...prev]);
    return event;
  }

  function runAssistantCommand(prompt: string): string {
    return runPointChat(prompt).message;
  }

  function applyProposalOperations(operations: PlannerProposalOperation[]) {
    for (const operation of operations) {
      if (operation.kind === "create") {
        void tool_create_task({
          title: operation.title,
          type: operation.type,
          priority: operation.priority,
          estimatedMinutes: operation.minutes,
          startIso: operation.startIso,
        });
      }
      if (operation.kind === "move") {
        void tool_move_task(operation.eventId, operation.startIso, operation.endIso);
      }
      if (operation.kind === "delete") {
        void tool_delete_task(operation.taskId);
      }
      if (operation.kind === "update") {
        const existing = tasks.find((task) => task.id === operation.taskId);
        if (!existing) {
          continue;
        }
        void tool_update_task(operation.taskId, {
          title: operation.patch.title ?? existing.title,
          type: operation.patch.type ?? existing.type,
          priority: operation.patch.priority ?? existing.priority,
          estimatedMinutes: operation.patch.estimatedMinutes ?? existing.estimatedMinutes,
        });
      }
    }
  }

  function confirmPendingProposal() {
    if (!pendingProposal) {
      return "No pending plan to confirm.";
    }
    applyProposalOperations(pendingProposal.operations);
    const summary = pendingProposal.summary;
    setPendingProposal(null);
    return `Done. ${summary}`;
  }

  function cancelPendingProposal() {
    setPendingProposal(null);
  }

  function runPointChat(prompt: string): PointChatResult {
    const text = prompt.trim();
    const lower = text.toLowerCase();
    const warnings: string[] = [];

    if (pendingProposal && /(yes|confirm|do it anyway|i insist|proceed|go ahead)/i.test(lower)) {
      const result = confirmPendingProposal();
      return {
        message: `Got you. ${result}`,
        warnings: [],
        needsConfirmation: false,
      };
    }

    if (pendingProposal && /(cancel|never mind|stop|no thanks)/i.test(lower)) {
      cancelPendingProposal();
      return {
        message: "No problem — I canceled that proposed change.",
        warnings: [],
        needsConfirmation: false,
      };
    }

    const schedule = tool_get_schedule();
    const freeBlocks = tool_get_free_time_blocks(15);

    if (/(availability|free time|open slots|calendar availability|when am i free)/i.test(lower)) {
      const top = freeBlocks.slice(0, 4);
      if (!top.length) {
        return {
          message:
            "You’re currently fully booked until your sleep window. I can reorganize lower-priority blocks if you want.",
          warnings,
          needsConfirmation: false,
        };
      }

      return {
        message: `You have ${top.length} good openings: ${top
          .map((block) => `${formatTimeRange(block.startIso, block.endIso)} (${block.minutes}m)`)
          .join(", ")}. Want me to place something in one of these?`,
        warnings,
        needsConfirmation: false,
      };
    }

    if (/(optimize|reorganize|rebalance|plan my day|fix my schedule)/i.test(lower)) {
      const movedCount = tool_optimize_day_plan();

      return {
        message:
          movedCount > 0
            ? `I optimized your day and rebalanced ${movedCount} flexible task blocks for a smoother workload.`
            : "Your schedule already looks pretty balanced. I don’t see a better rearrangement right now.",
        warnings,
        needsConfirmation: false,
      };
    }

    const deleteMatch = text.match(/(?:delete|remove)\s+task\s+(.+)$/i);
    if (deleteMatch) {
      const targetTitle = deleteMatch[1].trim();
      const task = findTaskByTitle(targetTitle);
      if (!task) {
        return {
          message: `I couldn't find a task matching "${targetTitle}".`,
          warnings,
          needsConfirmation: false,
        };
      }

      const proposal: PlannerProposal = {
        id: `proposal-${Date.now()}`,
        title: "Delete task",
        summary: `Removed "${task.title}" from your tasks and schedule.`,
        warnings: ["This is a major change and will remove scheduled blocks tied to this task."],
        operations: [{ kind: "delete", taskId: task.id, taskTitle: task.title }],
      };

      setPendingProposal(proposal);

      return {
        message: `I can delete "${task.title}". This will remove it from your plan. Confirm if you want me to do that.`,
        warnings: proposal.warnings,
        needsConfirmation: true,
      };
    }

    const moveMatch = text.match(/(?:move|reschedule)\s+(.+?)\s+to\s+(\d{1,2}:\d{2})/i);
    if (moveMatch) {
      const targetTitle = moveMatch[1].trim();
      const time = moveMatch[2];
      const event = schedule.find((item) => item.title.toLowerCase().includes(targetTitle.toLowerCase()));
      if (!event) {
        return {
          message: `I couldn't find an event or task matching "${targetTitle}" to move.`,
          warnings,
          needsConfirmation: false,
        };
      }

      const duration = Math.max(15, Math.round((new Date(event.endIso).getTime() - new Date(event.startIso).getTime()) / 60000));
      const startIso = parseTimeToday(time);
      const endIso = addMinutes(startIso, duration);
      const conflict = schedule.find((item) => item.id !== event.id && overlaps(item.startIso, item.endIso, startIso, endIso));

      if (conflict) {
        return {
          message: `That time conflicts with "${conflict.title}". I can move that item, choose a later opening, or reorganize your afternoon. What do you want?`,
          warnings,
          needsConfirmation: false,
        };
      }

      const moveWarnings = assessWarnings(startIso, endIso, "important");
      const proposal: PlannerProposal = {
        id: `proposal-${Date.now()}`,
        title: "Move schedule item",
        summary: `Moved "${event.title}" to ${formatTimeRange(startIso, endIso)}.`,
        warnings: moveWarnings,
        operations: [{ kind: "move", eventId: event.id, startIso, endIso }],
      };

      setPendingProposal(proposal);

      return {
        message: `I can move "${event.title}" to ${formatTimeRange(startIso, endIso)}.${
          moveWarnings.length ? ` Heads up: ${moveWarnings.join(" ")}` : ""
        } Confirm and I’ll apply it.`,
        warnings: moveWarnings,
        needsConfirmation: true,
      };
    }

    const addOrScheduleMatch = text.match(
      /(?:add\s+task|schedule|add)\s+(.+?)(?:\s+at\s+(\d{1,2}:\d{2}))?(?:\s+for\s+(\d+)\s*min)?$/i,
    );

    if (addOrScheduleMatch) {
      const title = addOrScheduleMatch[1].trim();
      const requestedTime = addOrScheduleMatch[2];
      const minutes = Math.max(15, Number(addOrScheduleMatch[3] ?? 60));
      const priority: TaskPriority = /exam|deadline|urgent|critical/i.test(title) ? "critical" : "important";

      if (requestedTime) {
        const startIso = parseTimeToday(requestedTime);
        const endIso = addMinutes(startIso, minutes);
        const conflict = schedule.find((item) => overlaps(item.startIso, item.endIso, startIso, endIso));

        if (conflict) {
          const nextBlock = tool_get_free_time_blocks(minutes).find((block) => new Date(block.startIso).getTime() > new Date(startIso).getTime());
          const alternativeText = nextBlock
            ? `or place it at ${formatTimeRange(nextBlock.startIso, addMinutes(nextBlock.startIso, minutes))}`
            : "or reorganize your schedule";

          return {
            message: `You already have "${conflict.title}" around ${requestedTime}. I can move that task, ${alternativeText}, or rebuild the day to make room. What would you like me to do?`,
            warnings,
            needsConfirmation: false,
          };
        }

        const addWarnings = assessWarnings(startIso, endIso, priority);
        const proposal: PlannerProposal = {
          id: `proposal-${Date.now()}`,
          title: "Schedule new task",
          summary: `Scheduled "${title}" at ${formatTimeRange(startIso, endIso)}.`,
          warnings: addWarnings,
          operations: [
            {
              kind: "create",
              title,
              minutes,
              priority,
              type: "flexible",
              startIso,
              endIso,
            },
          ],
        };

        if (addWarnings.length) {
          setPendingProposal(proposal);
          return {
            message: `I can place "${title}" at ${formatTimeRange(startIso, endIso)}, but ${addWarnings.join(" ")} If you still want it, confirm and I’ll do it.`,
            warnings: addWarnings,
            needsConfirmation: true,
          };
        }

        const created = tool_create_task({
          title,
          estimatedMinutes: minutes,
          priority,
          type: "flexible",
          startIso,
        });
        return {
          message: `Done — I scheduled "${title}" at ${formatTimeRange(created.startIso, created.endIso)}.`,
          warnings: [],
          needsConfirmation: false,
        };
      }

      const slot = pickBestSlot(minutes, priority);
      if (!slot) {
        const proposal: PlannerProposal = {
          id: `proposal-${Date.now()}`,
          title: "Reorganize to fit new task",
          summary: `Reorganized your day and added "${title}".`,
          warnings: ["Your current day is full, so this requires moving other blocks."],
          operations: [
            {
              kind: "create",
              title,
              minutes,
              priority,
              type: "splittable",
              startIso: addMinutes(new Date().toISOString(), 30),
              endIso: addMinutes(addMinutes(new Date().toISOString(), 30), minutes),
            },
          ],
        };

        setPendingProposal(proposal);
        return {
          message:
            "Your schedule is packed for the remaining day. I can still fit this by reorganizing lower-priority blocks. Confirm if you want me to proceed.",
          warnings: proposal.warnings,
          needsConfirmation: true,
        };
      }

      const created = tool_create_task({
        title,
        estimatedMinutes: minutes,
        priority,
        type: "flexible",
        startIso: slot.startIso,
      });
      return {
        message: `I looked across your whole day and scheduled "${title}" at ${formatTimeRange(
          created.startIso,
          created.endIso,
        )}.`,
        warnings: slot.warnings,
        needsConfirmation: false,
      };
    }

    const doneMatch = text.match(/(mark|set)\s+(.+?)\s+(done|complete)/i);
    if (doneMatch) {
      const title = doneMatch[2].trim();
      const updated = markTaskDoneByTitle(title);
      if (updated) {
        return {
          message: `Nice work — marked "${updated.title}" as done.`,
          warnings,
          needsConfirmation: false,
        };
      }
      return {
        message: `I couldn't find a task matching "${title}".`,
        warnings,
        needsConfirmation: false,
      };
    }

    if (lower.includes("show") && lower.includes("calendar")) {
      return {
        message: `You currently have ${schedule.length} scheduled items and ${freeBlocks.length} open blocks today.`,
        warnings,
        needsConfirmation: false,
      };
    }

    return {
      message:
        "I’m here for you. Ask me to add, move, edit, delete, or optimize tasks, and I’ll analyze your full day before making changes.",
      warnings,
      needsConfirmation: false,
    };
  }

  const value: PlannerContextValue = {
    tasks,
    events,
    addTask,
    updateTask,
    deleteTask,
    moveEvent,
    markTaskDoneByTitle,
    addEvent,
    pendingProposal,
    confirmPendingProposal,
    cancelPendingProposal,
    runPointChat,
    runAssistantCommand,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error("usePlanner must be used inside PlannerProvider.");
  }
  return context;
}
