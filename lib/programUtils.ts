import { buildDateLabel, formatTimeRange } from "@/lib/dateLabel";

export function fmtLabel(fmt: string): string {
  switch (fmt) {
    case "virtual":   return "Zoom Only";
    case "hybrid":    return "In-Person & Zoom";
    case "in-person": return "In-Person";
    default:          return fmt;
  }
}

export function buildSubtitle(program: {
  dateText: string | null;
  timeText: string | null;
  programFormat: string;
  startDatetime: Date | string | null;
  endDatetime: Date | string | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
}): string | null {
  const fmt = fmtLabel(program.programFormat);

  const startDatetime = program.startDatetime
    ? typeof program.startDatetime === "string"
      ? program.startDatetime
      : program.startDatetime.toISOString()
    : null;

  const endDatetime = program.endDatetime
    ? typeof program.endDatetime === "string"
      ? program.endDatetime
      : program.endDatetime.toISOString()
    : null;

  if (program.dateText) {
    let label = program.dateText;
    if (startDatetime) {
      const timeStr =
        program.timeText ||
        formatTimeRange(new Date(startDatetime), endDatetime ? new Date(endDatetime) : null);
      label += ` · ${timeStr}`;
    }
    return `${label} | ${fmt}`;
  }

  const autoLabel = buildDateLabel({
    startDatetime,
    endDatetime,
    recurrenceFreq: program.recurrenceFreq,
    recurrenceInterval: program.recurrenceInterval,
    recurrenceDays: program.recurrenceDays,
  });

  if (autoLabel) return `${autoLabel} | ${fmt}`;
  return fmt || null;
}
