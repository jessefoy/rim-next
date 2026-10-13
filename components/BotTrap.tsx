"use client";

import { useEffect, useRef } from "react";
import { BOT_TRAP_FIELD, BOT_ELAPSED_FIELD } from "@/lib/botCheck";

/**
 * The invisible bot check for a public form (lib/botCheck.ts): a field no
 * person sees or tabs to, and the time since the form appeared. Render
 * `trap` inside the form and spread `botFields()` into the request body.
 */
export function useBotTrap() {
  const startedAt = useRef<number | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const trap = (
    <div className="bot-trap" aria-hidden="true">
      <label>
        Leave this empty
        <input ref={field} type="text" name={BOT_TRAP_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );

  const botFields = () => ({
    [BOT_TRAP_FIELD]: field.current?.value ?? "",
    [BOT_ELAPSED_FIELD]: startedAt.current ? Date.now() - startedAt.current : 0,
  });

  return { trap, botFields };
}
