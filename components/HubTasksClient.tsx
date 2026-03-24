"use client";

/**
 * HubTasksClient — redesigned task management UI.
 * Desktop: three-column (rail + task list + detail panel).
 * Mobile (<900px): three-screen flow (lists → tasks → detail) with bottom nav.
 * CSS prefix: hub-tasks-
 */

import { useState, useRef, useCallback, useEffect } from "react";
import RimProseEditor from "@/components/RimProseEditor";

/* ── Types ── */
interface MemberInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface SubtaskData {
  id: string;
  taskId: string;
  title: string;
  body: any;
  assigneeId: string | null;
  assignee: MemberInfo | null;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  dueDate: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  order: number;
  createdAt: string;
}

interface TaskData {
  id: string;
  listId: string;
  title: string;
  body: any;
  assigneeId: string | null;
  assignee: MemberInfo | null;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  dueDate: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  order: number;
  subtasks: SubtaskData[];
  createdAt: string;
}

interface TaskListData {
  id: string;
  hubId: string;
  name: string;
  description: string | null;
  order: number;
  tasks: TaskData[];
}

interface TemplateData {
  id: string;
  name: string;
  _count: { tasks: number };
}

interface Props {
  slug: string;
  initialLists: TaskListData[];
  members: MemberInfo[];
  currentUserId: string;
}

/* ── Helpers ── */
function displayName(m: MemberInfo | null) {
  if (!m) return "";
  return m.preferredName || [m.firstName, m.lastName].filter(Boolean).join(" ") || "?";
}

function initials(m: MemberInfo | null) {
  if (!m) return "?";
  const f = m.firstName?.[0] ?? "";
  const l = m.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isDueSoon(dueDate: string | null) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return d >= new Date(now.toDateString()) && d <= week;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const LIST_COLORS = ["#1D9E75", "#E6890D", "#5B7FD6", "#D66B5B", "#8B5FC7", "#2BA8C3", "#C75BA3"];
function listColor(index: number) {
  return LIST_COLORS[index % LIST_COLORS.length];
}

type MobileScreen = "lists" | "tasks" | "detail";

/* ── Main Component ── */
export default function HubTasksClient({ slug, initialLists, members, currentUserId }: Props) {
  const [lists, setLists] = useState<TaskListData[]>(initialLists);
  const [activeView, setActiveView] = useState<string>(lists[0]?.id ?? "my-tasks");
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [listMenu, setListMenu] = useState<string | null>(null);
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>("lists");
  const newTaskRef = useRef<HTMLInputElement>(null);

  // Fetch templates on first expand
  async function loadTemplates() {
    if (templates.length > 0) return;
    const res = await fetch(`/api/hubs/${slug}/tasks/templates`);
    if (res.ok) setTemplates(await res.json());
  }

  // ── API helpers ──
  async function createList(name: string, templateId?: string, referenceDate?: string) {
    let res;
    if (templateId) {
      res = await fetch(`/api/hubs/${slug}/tasks/lists/from-template/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, referenceDate }),
      });
    } else {
      res = await fetch(`/api/hubs/${slug}/tasks/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
    if (res.ok) await refreshLists();
  }

  async function refreshLists() {
    const res = await fetch(`/api/hubs/${slug}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setLists(data);
      if (selectedTask) {
        for (const l of data) {
          const found = l.tasks.find((t: TaskData) => t.id === selectedTask.id);
          if (found) { setSelectedTask(found); return; }
        }
        setSelectedTask(null);
      }
    }
  }

  async function updateList(listId: string, data: Record<string, any>) {
    await fetch(`/api/hubs/${slug}/tasks/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await refreshLists();
  }

  async function createTask(listId: string, title: string) {
    await fetch(`/api/hubs/${slug}/tasks/lists/${listId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await refreshLists();
  }

  async function updateTask(taskId: string, data: Record<string, any>) {
    const res = await fetch(`/api/hubs/${slug}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          tasks: l.tasks.map((t) => (t.id === taskId ? updated : t)),
        })),
      );
      if (selectedTask?.id === taskId) setSelectedTask(updated);
    }
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/hubs/${slug}/tasks/${taskId}`, { method: "DELETE" });
    setSelectedTask(null);
    setMobileScreen("tasks");
    await refreshLists();
  }

  async function createSubtask(taskId: string, title: string) {
    await fetch(`/api/hubs/${slug}/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await refreshLists();
  }

  async function updateSubtask(subtaskId: string, data: Record<string, any>) {
    await fetch(`/api/hubs/${slug}/tasks/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await refreshLists();
  }

  async function saveAsTemplate(listId: string) {
    await fetch(`/api/hubs/${slug}/tasks/lists/${listId}/save-as-template`, { method: "POST" });
    setListMenu(null);
    setTemplates([]);
  }

  // ── Computed views ──
  const allTasks = lists.flatMap((l) => l.tasks.map((t) => ({ ...t, listName: l.name })));
  const myTasks = allTasks.filter((t) => t.assigneeId === currentUserId && t.status !== "DONE");
  const dueSoonTasks = allTasks
    .filter((t) => t.dueDate && t.status !== "DONE" && (isDueSoon(t.dueDate) || isOverdue(t.dueDate)))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const activeList = lists.find((l) => l.id === activeView);
  const isFilterView = activeView === "my-tasks" || activeView === "due-soon";
  const filteredTasks = activeView === "my-tasks"
    ? myTasks
    : activeView === "due-soon"
      ? dueSoonTasks
      : activeList?.tasks ?? [];

  const openTasks = filteredTasks.filter((t) => t.status !== "DONE");
  const doneTasks = filteredTasks.filter((t) => t.status === "DONE");

  // ── Body autosave ──
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const handleBodyChange = useCallback(
    (taskId: string, json: any) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => updateTask(taskId, { body: json }), 1500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── URL param for task focus ──
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const taskId = sp.get("task");
    if (taskId) {
      for (const l of lists) {
        const t = l.tasks.find((t) => t.id === taskId);
        if (t) {
          setActiveView(l.id);
          setSelectedTask(t);
          setMobileScreen("detail");
          break;
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation helpers (mobile) ──
  function selectList(viewId: string) {
    setActiveView(viewId);
    setSelectedTask(null);
    setMobileScreen("tasks");
  }

  function selectTask(task: TaskData) {
    setSelectedTask(task);
    setMobileScreen("detail");
  }

  function goBackToLists() {
    setMobileScreen("lists");
    setSelectedTask(null);
  }

  function goBackToTasks() {
    setMobileScreen("tasks");
    setSelectedTask(null);
  }

  const activeListIndex = lists.findIndex((l) => l.id === activeView);
  const activeViewLabel = isFilterView
    ? activeView === "my-tasks" ? "My Tasks" : "Due Soon"
    : activeList?.name ?? "Tasks";

  // ── Render helpers ──
  function renderTaskRow(task: TaskData & { listName?: string }, showListBadge = false) {
    const isSelected = selectedTask?.id === task.id;
    const isDone = task.status === "DONE";
    const doneSubCount = task.subtasks.filter((s) => s.status === "DONE").length;

    return (
      <div
        key={task.id}
        className={`hub-tasks-row${isDone ? " hub-tasks-row--done" : ""}${isSelected ? " hub-tasks-row--selected" : ""}`}
      >
        <div className="hub-tasks-row__left">
          {/* Status pip */}
          <span className={`hub-tasks-row__pip hub-tasks-row__pip--${task.status.toLowerCase()}`} />
          {/* Checkbox */}
          <button
            className={`hub-tasks-row__check${isDone ? " hub-tasks-row__check--done" : ""}`}
            onClick={() => updateTask(task.id, { status: isDone ? "OPEN" : "DONE" })}
            aria-label={isDone ? "Mark open" : "Mark done"}
          >
            {isDone && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" fill="none" /></svg>}
          </button>
        </div>
        <button
          className="hub-tasks-row__body"
          onClick={() => selectTask(task)}
        >
          <span className="hub-tasks-row__title">{task.title}</span>
          <span className="hub-tasks-row__chips">
            {task.dueDate && (
              <span className={`hub-tasks-chip${isOverdue(task.dueDate) ? " hub-tasks-chip--overdue" : isDueSoon(task.dueDate) ? " hub-tasks-chip--soon" : ""}`}>
                {formatDate(task.dueDate)}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="hub-tasks-chip hub-tasks-chip--sub">
                {doneSubCount} of {task.subtasks.length}
              </span>
            )}
            {showListBadge && task.listName && (
              <span className="hub-tasks-chip hub-tasks-chip--list">{task.listName}</span>
            )}
          </span>
        </button>
        <div className="hub-tasks-row__right">
          {task.assignee && (
            <span className="hub-tasks-avatar" title={displayName(task.assignee)}>
              {initials(task.assignee)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop Render ──
  return (
    <div className="hub-tasks">
      {/* ─── RAIL ─── */}
      <div className={`hub-tasks-rail${mobileScreen === "lists" ? " hub-tasks-rail--mobile-visible" : ""}`}>
        {/* Mobile heading */}
        <h2 className="hub-tasks-rail__heading">Tasks</h2>

        {/* Views */}
        <div className="hub-tasks-rail__section-label">Views</div>
        <button
          className={`hub-tasks-rail__item${activeView === "my-tasks" ? " hub-tasks-rail__item--active" : ""}`}
          onClick={() => selectList("my-tasks")}
        >
          <span className="hub-tasks-rail__item-name">My Tasks</span>
          <span className="hub-tasks-rail__badge">{myTasks.length}</span>
        </button>
        <button
          className={`hub-tasks-rail__item${activeView === "due-soon" ? " hub-tasks-rail__item--active" : ""}`}
          onClick={() => selectList("due-soon")}
        >
          <span className="hub-tasks-rail__item-name">Due Soon</span>
          <span className="hub-tasks-rail__badge">{dueSoonTasks.length}</span>
        </button>

        {/* Lists */}
        <div className="hub-tasks-rail__section-label">Lists</div>
        {lists.map((list, i) => {
          const openCount = list.tasks.filter((t) => t.status !== "DONE").length;
          const hasOverdue = list.tasks.some((t) => t.status !== "DONE" && isOverdue(t.dueDate));
          return (
            <div
              key={list.id}
              className={`hub-tasks-rail__list-item${activeView === list.id ? " hub-tasks-rail__list-item--active" : ""}`}
            >
              <button className="hub-tasks-rail__list-btn" onClick={() => selectList(list.id)}>
                <span className="hub-tasks-rail__dot" style={{ background: listColor(i) }} />
                <span className="hub-tasks-rail__item-name">{list.name}</span>
                <span className={`hub-tasks-rail__badge${hasOverdue ? " hub-tasks-rail__badge--overdue" : ""}`}>
                  {openCount}
                </span>
              </button>
              {/* Desktop three-dot menu */}
              <div className="hub-tasks-rail__menu-wrap">
                <button
                  className="hub-tasks-rail__menu-btn"
                  onClick={(e) => { e.stopPropagation(); setListMenu(listMenu === list.id ? null : list.id); }}
                >
                  &hellip;
                </button>
                {listMenu === list.id && (
                  <div className="hub-tasks-rail__menu">
                    <button onClick={() => { const n = prompt("New name:", list.name); if (n) updateList(list.id, { name: n }); setListMenu(null); }}>Rename</button>
                    <button onClick={() => { updateList(list.id, { isArchived: true }); setListMenu(null); if (activeView === list.id) setActiveView(lists[0]?.id ?? "my-tasks"); }}>Archive</button>
                    <button onClick={() => saveAsTemplate(list.id)}>Save as Template</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Templates */}
        <div className="hub-tasks-rail__section-label hub-tasks-rail__section-label--templates">
          <button
            className="hub-tasks-rail__templates-toggle"
            onClick={() => { setShowTemplates(!showTemplates); if (!showTemplates) loadTemplates(); }}
          >
            Templates {showTemplates ? "▾" : "▸"}
          </button>
        </div>
        {showTemplates && templates.map((t) => (
          <div key={t.id} className="hub-tasks-rail__template">
            <span className="hub-tasks-rail__template-icon">☰</span>
            <span className="hub-tasks-rail__item-name">{t.name}</span>
            <button
              className="hub-tasks-rail__template-use"
              onClick={() => {
                const name = prompt("List name:", t.name.replace(" (Template)", ""));
                if (name) {
                  const refDate = prompt("Reference date for due dates? (YYYY-MM-DD, or leave blank)");
                  createList(name, t.id, refDate || undefined);
                }
              }}
            >
              Use
            </button>
          </div>
        ))}

        {/* New list */}
        {showNewList ? (
          <form
            className="hub-tasks-rail__new"
            onSubmit={(e) => {
              e.preventDefault();
              if (newListName.trim()) { createList(newListName.trim()); setNewListName(""); setShowNewList(false); }
            }}
          >
            <input
              autoFocus
              className="hub-tasks-rail__new-input"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              onKeyDown={(e) => { if (e.key === "Escape") setShowNewList(false); }}
            />
          </form>
        ) : (
          <button className="hub-tasks-rail__add" onClick={() => setShowNewList(true)}>
            + New list
          </button>
        )}
      </div>

      {/* ─── TASK LIST ─── */}
      <div className={`hub-tasks-list-col${mobileScreen === "tasks" ? " hub-tasks-list-col--mobile-visible" : ""}`}>
        {/* Mobile back */}
        <div className="hub-tasks-list-col__mobile-header">
          <button className="hub-tasks-list-col__back" onClick={goBackToLists}>&lsaquo; Tasks</button>
          <span className="hub-tasks-list-col__name">{activeViewLabel}</span>
        </div>

        {/* Desktop header */}
        <div className="hub-tasks-list-col__header">
          <h3 className="hub-tasks-list-col__title">{activeViewLabel}</h3>
          {!isFilterView && activeList?.description && (
            <p className="hub-tasks-list-col__desc">{activeList.description}</p>
          )}
        </div>

        {/* Section: Open */}
        {openTasks.length > 0 && (
          <>
            <div className="hub-tasks-section-label">
              <span>Open · {openTasks.length}</span>
              <span className="hub-tasks-section-label__rule" />
            </div>
            {openTasks.map((task) => renderTaskRow(task, isFilterView))}
          </>
        )}

        {/* Section: Done */}
        {doneTasks.length > 0 && (
          <>
            <div className="hub-tasks-section-label hub-tasks-section-label--done">
              <span>Done · {doneTasks.length}</span>
              <span className="hub-tasks-section-label__rule" />
            </div>
            {doneTasks.map((task) => renderTaskRow(task, isFilterView))}
          </>
        )}

        {filteredTasks.length === 0 && (
          <div className="hub-tasks-empty">
            {isFilterView ? "No tasks to show." : "No tasks yet. Add one below."}
          </div>
        )}

        {/* Add task */}
        {!isFilterView && activeList && (
          <form
            className="hub-tasks-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTaskTitle.trim()) { createTask(activeList.id, newTaskTitle.trim()); setNewTaskTitle(""); newTaskRef.current?.focus(); }
            }}
          >
            <span className="hub-tasks-add__dash-check" />
            <input
              ref={newTaskRef}
              className="hub-tasks-add__input"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add task…"
            />
          </form>
        )}

        {/* Mobile FAB */}
        {!isFilterView && activeList && (
          <button
            className="hub-tasks-fab"
            onClick={() => { newTaskRef.current?.focus(); }}
            aria-label="Add task"
          >
            +
          </button>
        )}
      </div>

      {/* ─── DETAIL PANEL ─── */}
      <div className={`hub-tasks-detail-col${selectedTask ? " hub-tasks-detail-col--visible" : ""}${mobileScreen === "detail" ? " hub-tasks-detail-col--mobile-visible" : ""}`}>
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            listName={lists.find((l) => l.id === selectedTask.listId)?.name ?? ""}
            slug={slug}
            members={members}
            currentUserId={currentUserId}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onCreateSubtask={createSubtask}
            onUpdateSubtask={updateSubtask}
            onBodyChange={handleBodyChange}
            onClose={goBackToTasks}
            onRefresh={refreshLists}
          />
        )}
      </div>
    </div>
  );
}

/* ── Task Detail ── */
interface DetailProps {
  task: TaskData;
  listName: string;
  slug: string;
  members: MemberInfo[];
  currentUserId: string;
  onUpdate: (taskId: string, data: Record<string, any>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onCreateSubtask: (taskId: string, title: string) => Promise<void>;
  onUpdateSubtask: (subtaskId: string, data: Record<string, any>) => Promise<void>;
  onBodyChange: (taskId: string, json: any) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

function TaskDetail({
  task, listName, slug, members, currentUserId,
  onUpdate, onDelete, onCreateSubtask, onUpdateSubtask, onBodyChange,
  onClose, onRefresh,
}: DetailProps) {
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [newSubtitle, setNewSubtitle] = useState("");
  const [showAssignee, setShowAssignee] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  useEffect(() => { setTitle(task.title); setEditTitle(false); setConfirmDelete(false); }, [task.id, task.title]);

  const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length;
  const totalSubtasks = task.subtasks.length;
  const allSubsDone = totalSubtasks > 0 && doneSubtasks === totalSubtasks;
  const progressPct = totalSubtasks > 0 ? (doneSubtasks / totalSubtasks) * 100 : 0;

  const filteredMembers = members.filter((m) =>
    displayName(m).toLowerCase().includes(assigneeSearch.toLowerCase()),
  );

  const createdByName = [task.createdBy.firstName, task.createdBy.lastName].filter(Boolean).join(" ") || "Unknown";

  return (
    <div className="hub-tasks-detail">
      {/* Mobile back */}
      <div className="hub-tasks-detail__mobile-header">
        <button className="hub-tasks-detail__back-mobile" onClick={onClose}>&lsaquo; {listName}</button>
      </div>

      {/* Title */}
      {editTitle ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && title !== task.title) onUpdate(task.id, { title: title.trim() });
            setEditTitle(false);
          }}
          className="hub-tasks-detail__title-form"
        >
          <input
            autoFocus
            className="hub-tasks-detail__title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== task.title) onUpdate(task.id, { title: title.trim() });
              setEditTitle(false);
            }}
          />
        </form>
      ) : (
        <h2 className="hub-tasks-detail__title" onClick={() => setEditTitle(true)}>
          {task.title}
        </h2>
      )}

      {/* Status */}
      <div className="hub-tasks-detail__status">
        {(["OPEN", "IN_PROGRESS", "DONE"] as const).map((s) => (
          <button
            key={s}
            className={`hub-tasks-status-btn hub-tasks-status-btn--${s.toLowerCase()}${task.status === s ? " hub-tasks-status-btn--active" : ""}`}
            onClick={() => onUpdate(task.id, { status: s })}
          >
            {s === "OPEN" ? "Open" : s === "IN_PROGRESS" ? "In Progress" : "Done"}
          </button>
        ))}
      </div>

      <div className="hub-tasks-detail__divider" />

      {/* Fields row */}
      <div className="hub-tasks-detail__fields">
        <div className="hub-tasks-detail__field">
          <span className="hub-tasks-detail__label">Assigned to</span>
          <div className="hub-tasks-detail__field-value">
            {task.assignee ? (
              <span className="hub-tasks-detail__assignee-name">
                <span className="hub-tasks-avatar">{initials(task.assignee)}</span>
                {displayName(task.assignee)}
                <button className="hub-tasks-detail__clear" onClick={() => onUpdate(task.id, { assigneeId: null })}>&times;</button>
              </span>
            ) : (
              <button className="hub-tasks-detail__assign-btn" onClick={() => setShowAssignee(!showAssignee)}>
                Assign…
              </button>
            )}
            {showAssignee && (
              <div className="hub-tasks-assignee-dropdown">
                <input
                  autoFocus
                  className="hub-tasks-assignee-dropdown__search"
                  placeholder="Search members…"
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                />
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    className="hub-tasks-assignee-dropdown__item"
                    onClick={() => { onUpdate(task.id, { assigneeId: m.id }); setShowAssignee(false); setAssigneeSearch(""); }}
                  >
                    <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(m)}</span>
                    {displayName(m)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hub-tasks-detail__field">
          <span className="hub-tasks-detail__label">Due date</span>
          <div className="hub-tasks-detail__field-value hub-tasks-detail__due">
            <input
              type="date"
              className="hub-tasks-detail__date-input"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
            />
            {task.dueDate && (
              <button className="hub-tasks-detail__clear" onClick={() => onUpdate(task.id, { dueDate: null })}>&times;</button>
            )}
          </div>
        </div>

        <div className="hub-tasks-detail__field">
          <span className="hub-tasks-detail__label">List</span>
          <span className="hub-tasks-detail__field-value hub-tasks-detail__field-muted">{listName}</span>
        </div>

        <div className="hub-tasks-detail__field">
          <span className="hub-tasks-detail__label">Created by</span>
          <span className="hub-tasks-detail__field-value hub-tasks-detail__field-muted">{createdByName}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="hub-tasks-detail__section">
        <span className="hub-tasks-detail__section-label">Notes</span>
        <div className="hub-tasks-detail__body">
          <RimProseEditor
            value={task.body}
            onChange={(json) => onBodyChange(task.id, json)}
            variant="document"
            placeholder="Add notes, details, or context…"
            minHeight={120}
          />
        </div>
      </div>

      {/* Subtasks + Activity side by side on desktop */}
      <div className="hub-tasks-detail__bottom">
        <div className="hub-tasks-detail__subtasks-col">
          <div className="hub-tasks-subtasks__header">
            <span className="hub-tasks-detail__section-label">
              Subtasks{totalSubtasks > 0 && <span className="hub-tasks-subtasks__count"> ({doneSubtasks} of {totalSubtasks})</span>}
            </span>
            <form
              className="hub-tasks-subtask__add-inline"
              onSubmit={(e) => {
                e.preventDefault();
                if (newSubtitle.trim()) { onCreateSubtask(task.id, newSubtitle.trim()); setNewSubtitle(""); }
              }}
            >
              <input
                className="hub-tasks-subtask__add-input"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="+ Add"
              />
            </form>
          </div>

          {/* Progress bar */}
          {totalSubtasks > 0 && (
            <div className="hub-tasks-progress">
              <div className="hub-tasks-progress__fill" style={{ width: `${progressPct}%` }} />
            </div>
          )}

          {task.subtasks.map((sub) => (
            <div key={sub.id} className="hub-tasks-subtask">
              <div className="hub-tasks-subtask__row">
                <button
                  className={`hub-tasks-subtask__check${sub.status === "DONE" ? " hub-tasks-subtask__check--done" : ""}`}
                  onClick={() => onUpdateSubtask(sub.id, { status: sub.status === "DONE" ? "OPEN" : "DONE" })}
                >
                  {sub.status === "DONE" && <svg width="8" height="7" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="2" fill="none" /></svg>}
                </button>
                <button
                  className={`hub-tasks-subtask__title${sub.status === "DONE" ? " hub-tasks-subtask__title--done" : ""}`}
                  onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                >
                  {sub.title}
                </button>
                <span className="hub-tasks-subtask__meta">
                  {sub.dueDate && (
                    <span className={`hub-tasks-chip hub-tasks-chip--sm${isOverdue(sub.dueDate) ? " hub-tasks-chip--overdue" : ""}`}>
                      {formatDate(sub.dueDate)}
                    </span>
                  )}
                  {sub.assignee && (
                    <span className="hub-tasks-avatar hub-tasks-avatar--sm" title={displayName(sub.assignee)}>
                      {initials(sub.assignee)}
                    </span>
                  )}
                </span>
              </div>
              {expandedSub === sub.id && (
                <SubtaskDetail sub={sub} members={members} onUpdate={onUpdateSubtask} />
              )}
            </div>
          ))}

          {allSubsDone && task.status !== "DONE" && (
            <div className="hub-tasks-subtasks__all-done">
              All subtasks complete. Mark this task done?{" "}
              <button className="hub-tasks-subtasks__done-btn" onClick={() => onUpdate(task.id, { status: "DONE" })}>
                Mark done
              </button>
            </div>
          )}
        </div>

        {/* Activity log placeholder */}
        <div className="hub-tasks-detail__activity-col">
          <span className="hub-tasks-detail__section-label">Activity</span>
          <div className="hub-tasks-detail__activity-list">
            <div className="hub-tasks-activity__item">
              <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(task.createdBy as MemberInfo)}</span>
              <span className="hub-tasks-activity__text">Created this task</span>
              <span className="hub-tasks-activity__time">{formatDate(task.createdAt)}</span>
            </div>
            {task.assignee && (
              <div className="hub-tasks-activity__item">
                <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(task.assignee)}</span>
                <span className="hub-tasks-activity__text">Assigned to {displayName(task.assignee)}</span>
              </div>
            )}
            {task.subtasks.filter((s) => s.status === "DONE").map((s) => (
              <div key={s.id} className="hub-tasks-activity__item">
                <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(s.createdBy as MemberInfo)}</span>
                <span className="hub-tasks-activity__text">Completed &ldquo;{s.title}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="hub-tasks-detail__footer">
        <span className="hub-tasks-detail__footer-meta">
          Last updated {formatDate(task.createdAt)} · {listName}
        </span>
        {confirmDelete ? (
          <div className="hub-tasks-detail__delete-confirm">
            <span>Delete this task and its subtasks?</span>
            <button className="hub-tasks-detail__delete-yes" onClick={() => onDelete(task.id)}>Delete</button>
            <button className="hub-tasks-detail__delete-no" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button className="hub-tasks-detail__delete-btn" onClick={() => setConfirmDelete(true)}>
            Delete task
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Subtask Expanded Detail ── */
function SubtaskDetail({
  sub, members, onUpdate,
}: {
  sub: SubtaskData;
  members: MemberInfo[];
  onUpdate: (subtaskId: string, data: Record<string, any>) => Promise<void>;
}) {
  const [showBody, setShowBody] = useState(!!sub.body);
  const [showAssignee, setShowAssignee] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  return (
    <div className="hub-tasks-subtask__detail">
      <div className="hub-tasks-subtask__field">
        {sub.assignee ? (
          <span className="hub-tasks-subtask__assignee">
            <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(sub.assignee)}</span>
            {displayName(sub.assignee)}
            <button className="hub-tasks-detail__clear" onClick={() => onUpdate(sub.id, { assigneeId: null })}>&times;</button>
          </span>
        ) : (
          <button className="hub-tasks-detail__assign-btn" onClick={() => setShowAssignee(!showAssignee)}>Assign…</button>
        )}
        {showAssignee && (
          <div className="hub-tasks-assignee-dropdown">
            {members.map((m) => (
              <button key={m.id} className="hub-tasks-assignee-dropdown__item"
                onClick={() => { onUpdate(sub.id, { assigneeId: m.id }); setShowAssignee(false); }}>
                <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(m)}</span>
                {displayName(m)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="hub-tasks-subtask__field">
        <input type="date" className="hub-tasks-detail__date-input" value={sub.dueDate ? sub.dueDate.slice(0, 10) : ""} onChange={(e) => onUpdate(sub.id, { dueDate: e.target.value || null })} />
        {sub.dueDate && <button className="hub-tasks-detail__clear" onClick={() => onUpdate(sub.id, { dueDate: null })}>&times;</button>}
      </div>
      {showBody ? (
        <RimProseEditor value={sub.body} onChange={(json) => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => onUpdate(sub.id, { body: json }), 1500); }} variant="compact" placeholder="Details…" minHeight={80} />
      ) : (
        <button className="hub-tasks-subtask__add-details" onClick={() => setShowBody(true)}>Add details</button>
      )}
    </div>
  );
}
