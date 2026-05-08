/**
 * ScheduleDocument — @react-pdf/renderer document for the host schedule.
 *
 * Layout: Letter, Helvetica.
 * Sessions render as a clean table with month dividers — eye sweeps the
 * date column. The next upcoming session has a left ▸ marker and a
 * subtle teal-tinted row.
 *
 * Type sizes are tuned for arm's-length printed reading:
 * - 17pt title, 10pt body, 9pt secondary, 8pt section eyebrows.
 */

import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";

const COLORS = {
  text:     "#222",
  textMid:  "#555",
  mid:      "#7a7068",
  midLight: "#a39b95",
  rule:     "#d5d5d5",
  ruleSoft: "#e8e6e3",
  accent:   "#135274", // RIM teal
  nextBg:   "#eef5f9", // pale teal tint for the next-session row
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 50,
    lineHeight: 1.4,
  },

  // Header
  header:   { marginBottom: 22 },
  title:    { fontSize: 17, fontWeight: 700, marginBottom: 3 },
  range:    { fontSize: 10, color: COLORS.mid, marginBottom: 1 },
  summary:  { fontSize: 10, color: COLORS.textMid },

  // Section
  section:        { marginBottom: 22 },
  sectionHeading: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: COLORS.mid,
    textTransform: "uppercase",
    paddingBottom: 5,
    marginBottom: 6,
    borderBottom: `1pt solid ${COLORS.rule}`,
  },

  // Standing rotations
  rotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${COLORS.ruleSoft}`,
  },
  rotName: { fontSize: 10, fontWeight: 500 },
  rotMeta: { fontSize: 10, color: COLORS.mid },

  // Session table
  colHeader: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottom: `0.5pt solid ${COLORS.rule}`,
  },
  colHeaderText: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.midLight,
    textTransform: "uppercase",
  },

  monthDivider: {
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: COLORS.text,
    textTransform: "uppercase",
    paddingTop: 12,
    paddingBottom: 4,
  },

  row: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottom: `0.5pt solid ${COLORS.ruleSoft}`,
  },
  rowNext: { backgroundColor: COLORS.nextBg },

  // Columns
  cMarker:  { width: 14, fontSize: 11, fontWeight: 700, color: COLORS.accent },
  cDay:     { width: 36, color: COLORS.mid },
  cDate:    { width: 74, fontWeight: 500 },
  cTime:    { width: 64, color: COLORS.mid },
  cProgram: { flex: 1, fontWeight: 500, paddingRight: 8 },
  cFormat:  { width: 80, color: COLORS.mid, fontSize: 9, textAlign: "right" },

  empty: { fontSize: 10, color: COLORS.mid, fontStyle: "italic" },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 50,
    right: 50,
    fontSize: 8,
    color: COLORS.mid,
    paddingTop: 8,
    borderTop: `0.5pt solid ${COLORS.rule}`,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export interface PdfSession {
  dayShort:    string; // "Thu"
  dateLabel:   string; // "May 14"
  timeLabel:   string; // "8:15 AM"
  programName: string;
  formatLabel: string;
  monthKey:    string; // "2026-05"
  monthLabel:  string; // "May 2026"
  isNext:      boolean;
}

export interface ScheduleDocumentProps {
  title:         string;
  rangeLabel:    string;
  summaryLabel:  string | null;
  rotations:     Array<{ slug: string; name: string; meta: string }>;
  sessions:      PdfSession[];
  totalSessions: number;
  userName:      string;
  generatedAt:   string;
}

export function ScheduleDocument({
  title, rangeLabel, summaryLabel, rotations, sessions, totalSessions,
  userName, generatedAt,
}: ScheduleDocumentProps) {

  // Track month transitions during render so we insert dividers inline.
  let renderedMonth = "";

  return (
    <Document title={title} author="Rooted in Mindfulness">
      <Page size="LETTER" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.range}>{rangeLabel}</Text>
          {summaryLabel && <Text style={styles.summary}>{summaryLabel}</Text>}
        </View>

        {/* Standing rotations */}
        {rotations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Standing Rotations</Text>
            {rotations.map((r) => (
              <View key={r.slug} style={styles.rotRow}>
                <Text style={styles.rotName}>{r.name}</Text>
                <Text style={styles.rotMeta}>{r.meta}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            Sessions ({totalSessions})
          </Text>

          {sessions.length === 0 ? (
            <Text style={styles.empty}>
              No sessions assigned in this date range.
            </Text>
          ) : (
            <>
              <View style={styles.colHeader} fixed>
                <View style={styles.cMarker} />
                <Text style={[styles.colHeaderText, styles.cDay]}>Day</Text>
                <Text style={[styles.colHeaderText, styles.cDate]}>Date</Text>
                <Text style={[styles.colHeaderText, styles.cTime]}>Time</Text>
                <Text style={[styles.colHeaderText, styles.cProgram]}>Program</Text>
                <Text style={[styles.colHeaderText, styles.cFormat]}>Format</Text>
              </View>

              {sessions.map((s, i) => {
                const showDivider = s.monthKey !== renderedMonth;
                renderedMonth = s.monthKey;
                const rowStyle = s.isNext ? [styles.row, styles.rowNext] : styles.row;
                return (
                  <View key={i} wrap={false}>
                    {showDivider && (
                      <Text style={styles.monthDivider}>{s.monthLabel}</Text>
                    )}
                    <View style={rowStyle}>
                      <Text style={styles.cMarker}>{s.isNext ? "▸" : ""}</Text>
                      <Text style={styles.cDay}>{s.dayShort}</Text>
                      <Text style={styles.cDate}>{s.dateLabel}</Text>
                      <Text style={styles.cTime}>{s.timeLabel}</Text>
                      <Text style={styles.cProgram}>{s.programName}</Text>
                      <Text style={styles.cFormat}>{s.formatLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Footer (fixed) */}
        <View style={styles.footer} fixed>
          <Text>Schedule for {userName}</Text>
          <Text>Generated {generatedAt} · rootedinmindfulness.org</Text>
        </View>
      </Page>
    </Document>
  );
}
