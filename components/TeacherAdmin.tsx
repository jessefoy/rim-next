"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface TeacherRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  lessonCount: number;
  createdAt: string;
}

interface Props {
  teachers: TeacherRow[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function TeacherAdmin({ teachers: initialTeachers }: Props) {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherRow[]>(initialTeachers);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleToggleActive(teacher: TeacherRow) {
    setError("");
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !teacher.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update");
        return;
      }
      const updated = await res.json();
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacher.id ? { ...t, isActive: updated.isActive } : t))
      );
      setMessage(`${teacher.name} ${updated.isActive ? "activated" : "deactivated"}`);
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setError("Network error");
    }
  }

  async function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    try {
      const slug = slugify(newName);
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        return;
      }
      const created = await res.json();
      router.push(`/admin/teachers/${created.slug}`);
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {error && <div className="adm-msg adm-msg--error">{error}</div>}
      {message && <div className="adm-msg adm-msg--success">{message}</div>}

      {teachers.length === 0 ? (
        <p className="adm-empty">No teachers yet. Add one below.</p>
      ) : (
        <table className="adm-teacher-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Lessons</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>
                  <Link href={`/admin/teachers/${teacher.slug}`} className="adm-link">
                    {teacher.name}
                  </Link>
                </td>
                <td>{teacher.lessonCount}</td>
                <td>
                  <span
                    className={`adm-teacher-badge ${
                      teacher.isActive
                        ? "adm-teacher-badge--active"
                        : "adm-teacher-badge--inactive"
                    }`}
                  >
                    {teacher.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/teachers/${teacher.slug}`}
                    className="adm-action-link"
                    style={{ marginRight: 12 }}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="adm-action-btn"
                    onClick={() => handleToggleActive(teacher)}
                  >
                    {teacher.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAddTeacher} className="adm-teacher-add">
        <div className="adm-teacher-add__field">
          <label htmlFor="new-teacher-name" className="adm-teacher-add__label">
            Add Teacher
          </label>
          <input
            id="new-teacher-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Teacher name"
            className="adm-input"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="adm-btn adm-btn--primary"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
