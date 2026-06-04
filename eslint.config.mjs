import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Occurrence logic ("does this program run on date X") has ONE home:
  // lib/scheduleUtils.ts. Three private copies drifted before — the ones in
  // app/api/host/assignments/route.ts and the dashboard's isOccurrenceToday
  // lacked the session-137 endDatetime/DAILY rules, which silently erased
  // recurring programs from the dashboard, /this-week, the Scheduler, and the
  // session-join gate (see RIM_Scheduler.md). This rule fails any re-defined
  // isOccurrence* helper outside lib/scheduleUtils.ts, so the next copy is
  // caught at author time instead of in production.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/scheduleUtils.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "FunctionDeclaration[id.name=/^isOccurrence/]",
          message:
            "Don't redefine occurrence logic here. Import isOccurrenceOnDate / nextOccurrenceOnOrAfter from '@/lib/scheduleUtils' — it is the single source of truth for whether a program runs on a given date (the endDatetime + recurrence rules live there). A private copy will drift. See RIM_Scheduler.md.",
        },
        {
          selector: "VariableDeclarator[id.name=/^isOccurrence/]",
          message:
            "Don't redefine occurrence logic here. Import isOccurrenceOnDate / nextOccurrenceOnOrAfter from '@/lib/scheduleUtils' — it is the single source of truth for whether a program runs on a given date (the endDatetime + recurrence rules live there). A private copy will drift. See RIM_Scheduler.md.",
        },
      ],
    },
  },
]);

export default eslintConfig;
