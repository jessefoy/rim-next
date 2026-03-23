"use client";

/**
 * HubTasksClient — full task management UI for hub Tasks tab.
 * Two-panel: list sidebar + task panel. Task detail as right drawer.
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
    if (res.ok) {
      await refreshLists();
    }
  }

  async function refreshLists() {
    const res = await fetch(`/api/hubs/${slug}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setLists(data);
      // Re-select task if it still exists
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
    const res = await fetch(`/api/hubs/${slug}/tasks/lists/${listId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) await refreshLists();
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
    setTemplates([]); // force re-fetch
  }

  // ── Computed views ──
  const allTasks = lists.flatMap((l) => l.tasks.map((t) => ({ ...t, listName: l.name })));

  const myTasks = allTasks.filter(
    (t) => t.assigneeId === currentUserId && t.status !== "DONE",
  );

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

  // ── Handle URL param for task focus ──
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const taskId = sp.get("task");
    if (taskId) {
      for (const l of lists) {
        const t = l.tasks.find((t) => t.id === taskId);
        if (t) { setActiveView(l.id); setSelectedTask(t); break; }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──
  return (
    <div className="hub-tasks">
      {/* ── Sidebar ── */}
      <div className="hub-tasks-sidebar">
        {/* Filters */}
        <button
          className={`hub-tasks-sidebar__filter${activeView === "my-tasks" ? " hub-tasks-sidebar__filter--active" : ""}`}
          onClick={() => { setActiveView("my-tasks"); setSelectedTask(null); }}
        >
          My Tasks <span className="hub-tasks-sidebar__count">{myTasks.length}</span>
        </button>
        <button
          className={`hub-tasks-sidebar__filter${activeView === "due-soon" ? " hub-tasks-sidebar__filter--active" : ""}`}
          onClick={() => { setActiveView("due-soon"); setSelectedTask(null); }}
        >
          Due Soon <span className="hub-tasks-sidebar__count">{dueSoonTasks.length}</span>
        </button>

        <div className="hub-tasks-sidebar__divider" />

        {/* Lists */}
        {lists.map((list) => (
          <div
            key={list.id}
            className={`hub-tasks-sidebar__item${activeView === list.id ? " hub-tasks-sidebar__item--active" : ""}`}
          >
            <button
              className="hub-tasks-sidebar__item-btn"
              onClick={() => { setActiveView(list.id); setSelectedTask(null); }}
            >
              <span className="hub-tasks-sidebar__item-name">{list.name}</span>
              <span className="hub-tasks-sidebar__count">
                {list.tasks.filter((t) => t.status !== "DONE").length}
              </span>
            </button>
            <div className="hub-tasks-sidebar__menu-wrap">
              <button
                className="hub-tasks-sidebar__menu-btn"
                onClick={(e) => { e.stopPropagation(); setListMenu(listMenu === list.id ? null : list.id); }}
              >
                &hellip;
              </button>
              {listMenu === list.id && (
                <div className="hub-tasks-sidebar__menu">
                  <button onClick={() => { const n = prompt("New name:", list.name); if (n) updateList(list.id, { name: n }); setListMenu(null); }}>
                    Rename
                  </button>
                  <button onClick={() => { updateList(list.id, { isArchived: true }); setListMenu(null); if (activeView === list.id) setActiveView(lists[0]?.id ?? "my-tasks"); }}>
                    Archive
                  </button>
                  <button onClick={() => saveAsTemplate(list.id)}>
                    Save as Template
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* New list */}
        {showNewList ? (
          <form
            className="hub-tasks-sidebar__new"
            onSubmit={(e) => {
              e.preventDefault();
              if (newListName.trim()) {
                createList(newListName.trim());
                setNewListName("");
                setShowNewList(false);
              }
            }}
          >
            <input
              autoFocus
              className="hub-tasks-sidebar__new-input"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              onKeyDown={(e) => { if (e.key === "Escape") setShowNewList(false); }}
            />
          </form>
        ) : (
          <button className="hub-tasks-sidebar__add" onClick={() => setShowNewList(true)}>
            + New list
          </button>
        )}

        {/* Templates */}
        <div className="hub-tasks-sidebar__divider" />
        <button
          className="hub-tasks-sidebar__templates-toggle"
          onClick={() => { setShowTemplates(!showTemplates); if (!showTemplates) loadTemplates(); }}
        >
          Templates {showTemplates ? "▾" : "▸"}
        </button>
        {showTemplates && templates.map((t) => (
          <div key={t.id} className="hub-tasks-sidebar__template">
            <span>{t.name}</span>
            <button
              className="hub-tasks-sidebar__template-use"
              onClick={() => {
                const name = prompt("List name:", t.name.replace(" (Template)", ""));
                if (name) {
                  const refDate = prompt("Reference date for due dates? (YYYY-MM-DD, or leave blank to skip)");
                  createList(name, t.id, refDate || undefined);
                }
              }}
            >
              Use
            </button>
          </div>
        ))}
      </div>

      {/* ── Task Panel ── */}
      <div className={`hub-tasks-panel${selectedTask ? " hub-tasks-panel--split" : ""}`}>
        {/* List header */}
        {!isFilterView && activeList && (
          <div className="hub-tasks-panel__header">
            <h2 className="hub-tasks-panel__title">{activeList.name}</h2>
            {activeList.description && (
              <p className="hub-tasks-panel__desc">{activeList.description}</p>
            )}
          </div>
        )}
        {isFilterView && (
          <div className="hub-tasks-panel__header">
            <h2 className="hub-tasks-panel__title">
              {activeView === "my-tasks" ? "My Tasks" : "Due Soon"}
            </h2>
          </div>
        )}

        {/* Task rows */}
        <div className="hub-tasks-list">
          {filteredTasks.length === 0 && (
            <div className="hub-tasks-empty">
              {isFilterView ? "No tasks to show." : "No tasks yet. Add one below."}
            </div>
          )}
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`hub-tasks-row${task.status === "DONE" ? " hub-tasks-row--done" : ""}${selectedTask?.id === task.id ? " hub-tasks-row--selected" : ""}`}
            >
              <button
                className="hub-tasks-row__check"
                onClick={() => updateTask(task.id, { status: task.status === "DONE" ? "OPEN" : "DONE" })}
                aria-label={task.status === "DONE" ? "Mark open" : "Mark done"}
              >
                {task.status === "DONE" ? "✓" : ""}
              </button>
              <button
                className="hub-tasks-row__body"
                onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
              >
                <span className="hub-tasks-row__title">{task.title}</span>
                {isFilterView && "listName" in task && (
                  <span className="hub-tasks-row__list-name">{(task as any).listName}</span>
                )}
              </button>
              <div className="hub-tasks-row__meta">
                {task.assignee && (
                  <span className="hub-tasks-avatar" title={displayName(task.assignee)}>
                    {initials(task.assignee)}
                  </span>
                )}
                {task.dueDate && (
                  <span className={`hub-tasks-due${isOverdue(task.dueDate) ? " hub-tasks-due--overdue" : ""}`}>
                    {isOverdue(task.dueDate) && "Overdue · "}
                    {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add task (list view only) */}
        {!isFilterView && activeList && (
          <form
            className="hub-tasks-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTaskTitle.trim()) {
                createTask(activeList.id, newTaskTitle.trim());
                setNewTaskTitle("");
                newTaskRef.current?.focus();
              }
            }}
          >
            <input
              ref={newTaskRef}
              className="hub-tasks-add__input"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="+ Add task"
            />
          </form>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          slug={slug}
          members={members}
          currentUserId={currentUserId}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onCreateSubtask={createSubtask}
          onUpdateSubtask={updateSubtask}
          onBodyChange={handleBodyChange}
          onClose={() => setSelectedTask(null)}
          onRefresh={refreshLists}
        />
      )}
    </div>
  );
}

/* ── Task Detail ── */
interface DetailProps {
  task: TaskData;
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
  task, slug, members, currentUserId,
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

  // Sync title when task changes
  useEffect(() => { setTitle(task.title); setEditTitle(false); }, [task.id, task.title]);

  const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length;
  const totalSubtasks = task.subtasks.length;
  const allSubsDone = totalSubtasks > 0 && doneSubtasks === totalSubtasks;

  const filteredMembers = members.filter((m) => {
    const name = displayName(m).toLowerCase();
    return name.includes(assigneeSearch.toLowerCase());
  });

  const createdByName = [task.createdBy.firstName, task.createdBy.lastName].filter(Boolean).join(" ") || "Unknown";

  return (
    <div className="hub-tasks-detail">
      <div className="hub-tasks-detail__header">
        <button className="hub-tasks-detail__close" onClick={onClose}>&larr; Back</button>
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
            className={`hub-tasks-status-btn${task.status === s ? " hub-tasks-status-btn--active" : ""}`}
            onClick={() => onUpdate(task.id, { status: s })}
          >
            {s === "OPEN" ? "Open" : s === "IN_PROGRESS" ? "In Progress" : "Done"}
          </button>
        ))}
      </div>

      {/* Assignee */}
      <div className="hub-tasks-detail__field">
        <span className="hub-tasks-detail__label">Assignee</span>
        <div className="hub-tasks-detail__assignee">
          {task.assignee ? (
            <span className="hub-tasks-detail__assignee-name">
              <span className="hub-tasks-avatar">{initials(task.assignee)}</span>
              {displayName(task.assignee)}
              <button
                className="hub-tasks-detail__clear"
                onClick={() => onUpdate(task.id, { assigneeId: null })}
              >
                &times;
              </button>
            </span>
          ) : (
            <button className="hub-tasks-detail__assign-btn" onClick={() => setShowAssignee(!showAssignee)}>
              Assign to...
            </button>
          )}
          {showAssignee && (
            <div className="hub-tasks-assignee-dropdown">
              <input
                autoFocus
                className="hub-tasks-assignee-dropdown__search"
                placeholder="Search members..."
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
              />
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  className="hub-tasks-assignee-dropdown__item"
                  onClick={() => {
                    onUpdate(task.id, { assigneeId: m.id });
                    setShowAssignee(false);
                    setAssigneeSearch("");
                  }}
                >
                  <span className="hub-tasks-avatar">{initials(m)}</span>
                  {displayName(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Due date */}
      <div className="hub-tasks-detail__field">
        <span className="hub-tasks-detail__label">Due date</span>
        <div className="hub-tasks-detail__due">
          <input
            type="date"
            className="hub-tasks-detail__date-input"
            value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
            onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
          />
          {task.dueDate && (
            <button className="hub-tasks-detail__clear" onClick={() => onUpdate(task.id, { dueDate: null })}>
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="hub-tasks-detail__body">
        <RimProseEditor
          value={task.body}
          onChange={(json) => onBodyChange(task.id, json)}
          variant="document"
          placeholder="Add notes, details, or context..."
          minHeight={120}
        />
      </div>

      {/* Subtasks */}
      <div className="hub-tasks-subtasks">
        <div className="hub-tasks-subtasks__header">
          <span className="hub-tasks-detail__label">Subtasks</span>
          {totalSubtasks > 0 && (
            <span className="hub-tasks-subtasks__progress">
              {doneSubtasks} of {totalSubtasks} complete
            </span>
          )}
        </div>

        {task.subtasks.map((sub) => (
          <div key={sub.id} className="hub-tasks-subtask">
            <div className="hub-tasks-subtask__row">
              <button
                className="hub-tasks-row__check"
                onClick={() => onUpdateSubtask(sub.id, { status: sub.status === "DONE" ? "OPEN" : "DONE" })}
              >
                {sub.status === "DONE" ? "✓" : ""}
              </button>
              <button
                className={`hub-tasks-subtask__title${sub.status === "DONE" ? " hub-tasks-subtask__title--done" : ""}`}
                onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
              >
                {sub.title}
              </button>
              <div className="hub-tasks-row__meta">
                {sub.assignee && (
                  <span className="hub-tasks-avatar hub-tasks-avatar--sm" title={displayName(sub.assignee)}>
                    {initials(sub.assignee)}
                  </span>
                )}
                {sub.dueDate && (
                  <span className={`hub-tasks-due${isOverdue(sub.dueDate) ? " hub-tasks-due--overdue" : ""}`}>
                    {formatDate(sub.dueDate)}
                  </span>
                )}
              </div>
            </div>
            {expandedSub === sub.id && (
              <SubtaskDetail sub={sub} members={members} onUpdate={onUpdateSubtask} />
            )}
          </div>
        ))}

        {/* Add subtask */}
        <form
          className="hub-tasks-subtask__add"
          onSubmit={(e) => {
            e.preventDefault();
            if (newSubtitle.trim()) {
              onCreateSubtask(task.id, newSubtitle.trim());
              setNewSubtitle("");
            }
          }}
        >
          <input
            className="hub-tasks-subtask__add-input"
            value={newSubtitle}
            onChange={(e) => setNewSubtitle(e.target.value)}
            placeholder="+ Add subtask"
          />
        </form>

        {/* All subtasks done prompt */}
        {allSubsDone && task.status !== "DONE" && (
          <div className="hub-tasks-subtasks__all-done">
            All subtasks complete. Mark this task done?{" "}
            <button
              className="hub-tasks-subtasks__done-btn"
              onClick={() => onUpdate(task.id, { status: "DONE" })}
            >
              Mark done
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="hub-tasks-detail__footer">
        <span className="hub-tasks-detail__meta">
          Created by {createdByName} on {formatDate(task.createdAt)}
        </span>
        {confirmDelete ? (
          <div className="hub-tasks-detail__delete-confirm">
            <span>Delete this task and its subtasks? This can&rsquo;t be undone.</span>
            <button className="hub-tasks-detail__delete-yes" onClick={() => onDelete(task.id)}>
              Delete
            </button>
            <button className="hub-tasks-detail__delete-no" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
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
  sub,
  members,
  onUpdate,
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
      {/* Assignee */}
      <div className="hub-tasks-subtask__field">
        {sub.assignee ? (
          <span className="hub-tasks-subtask__assignee">
            <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(sub.assignee)}</span>
            {displayName(sub.assignee)}
            <button className="hub-tasks-detail__clear" onClick={() => onUpdate(sub.id, { assigneeId: null })}>
              &times;
            </button>
          </span>
        ) : (
          <button className="hub-tasks-detail__assign-btn" onClick={() => setShowAssignee(!showAssignee)}>
            Assign to...
          </button>
        )}
        {showAssignee && (
          <div className="hub-tasks-assignee-dropdown">
            {members.map((m) => (
              <button
                key={m.id}
                className="hub-tasks-assignee-dropdown__item"
                onClick={() => { onUpdate(sub.id, { assigneeId: m.id }); setShowAssignee(false); }}
              >
                <span className="hub-tasks-avatar hub-tasks-avatar--sm">{initials(m)}</span>
                {displayName(m)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Due date */}
      <div className="hub-tasks-subtask__field">
        <input
          type="date"
          className="hub-tasks-detail__date-input"
          value={sub.dueDate ? sub.dueDate.slice(0, 10) : ""}
          onChange={(e) => onUpdate(sub.id, { dueDate: e.target.value || null })}
        />
        {sub.dueDate && (
          <button className="hub-tasks-detail__clear" onClick={() => onUpdate(sub.id, { dueDate: null })}>
            &times;
          </button>
        )}
      </div>

      {/* Body */}
      {showBody ? (
        <RimProseEditor
          value={sub.body}
          onChange={(json) => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => onUpdate(sub.id, { body: json }), 1500);
          }}
          variant="compact"
          placeholder="Details..."
          minHeight={80}
        />
      ) : (
        <button className="hub-tasks-subtask__add-details" onClick={() => setShowBody(true)}>
          Add details
        </button>
      )}
    </div>
  );
}
