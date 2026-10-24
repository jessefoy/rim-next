/**
 * A program's registration questions keep a stable id (2026-10-23, the
 * Registration plan's "question identity, server-assigned"). Each item in
 * Program.registrationFields carries `_key`, the id the public form and the
 * update page already use for their inputs. The program editor never set
 * one, so every question it added rendered as `reg-custom-undefined` on the
 * public form (labels pointing at the first field).
 *
 * The save routes give each question its id here: the one it came with,
 * else the stored question with the same wording (an editor that hasn't
 * reloaded since its last save sends the question without the id it was
 * given), else a new one. Answers are still stored by the question's
 * wording; this is the identity they will move to.
 */

import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

type Question = Record<string, unknown> & { label?: unknown; _key?: unknown };

function questions(value: unknown): Question[] {
  return Array.isArray(value)
    ? value.filter((q): q is Question => !!q && typeof q === "object" && !Array.isArray(q))
    : [];
}

/** The questions with an id on each, or null when there are none. */
export function withQuestionIds(incoming: unknown, stored: unknown): Prisma.InputJsonObject[] | null {
  const list = questions(incoming);
  if (list.length === 0) return null;
  const used = new Set<string>();
  const storedKeyByLabel = new Map<string, string>();
  for (const q of questions(stored)) {
    if (typeof q._key === "string" && typeof q.label === "string" && !storedKeyByLabel.has(q.label)) {
      storedKeyByLabel.set(q.label, q._key);
    }
  }
  return list.map((q) => {
    let key = typeof q._key === "string" && q._key.trim() ? q._key : null;
    if (key && used.has(key)) key = null;
    if (!key && typeof q.label === "string") {
      const reuse = storedKeyByLabel.get(q.label);
      if (reuse && !used.has(reuse)) key = reuse;
    }
    if (!key) key = `q_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    used.add(key);
    return { ...q, _key: key } as Prisma.InputJsonObject;
  });
}
