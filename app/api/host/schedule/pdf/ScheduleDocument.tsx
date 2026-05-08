/**
 * ScheduleDocument — @react-pdf/renderer document for the host schedule.
 * Letter page, Helvetica, modest 3-color palette: black ink, mid-grey for
 * meta, hairline rules. Designed to match the calm density of the rest of
 * RIM's tools.
 */

import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";

const COLORS = {
  text: "#222",
  mid:  "#7a7068",
  rule: "#d5d5d5",
  bg:   "#f5f5f5",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    lineHeight: 1.4,
  },

  header: { marginBottom: 22 },
  title: { fontSize: 18, fontWeight: 600, marginBottom: 4 },
  range: { fontSize: 10, color: COLORS.mid },

  sectionHeading: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.mid,
    textTransform: "uppercase",
    paddingBottom: 5,
    marginBottom: 8,
    borderBottom: `1pt solid ${COLORS.rule}`,
  },

  rotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${COLORS.rule}`,
  },
  rotName: { fontSize: 10, fontWeight: 500 },
  rotMeta: { fontSize: 10, color: COLORS.mid },

  section: { marginBottom: 22 },

  day: { marginBottom: 12 },
  dayHeading: {
    fontSize: 11,
    fontWeight: 700,
    paddingBottom: 3,
    marginBottom: 4,
    borderBottom: `0.5pt solid ${COLORS.rule}`,
  },
  session: {
    flexDirection: "row",
    paddingVertical: 3,
    fontSize: 10,
  },
  sessionName: { flexGrow: 1, fontWeight: 500 },
  sessionTime: { color: COLORS.mid, marginRight: 14 },
  sessionFmt:  { color: COLORS.mid, fontSize: 9 },

  empty: { fontSize: 10, color: COLORS.mid, fontStyle: "italic" },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 8,
    color: COLORS.mid,
    paddingTop: 8,
    borderTop: `0.5pt solid ${COLORS.rule}`,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export interface ScheduleDocumentProps {
  title: string;
  rangeLabel: string;
  rotations: Array<{ slug: string; name: string; meta: string }>;
  days: Array<{
    dateStr: string;
    daySessions: Array<{
      dateStr: string;
      dateLabel: string;
      programName: string;
      timeLabel: string;
      formatLabel: string;
    }>;
  }>;
  userName: string;
  generatedAt: string;
  totalSessions: number;
}

export function ScheduleDocument({
  title, rangeLabel, rotations, days, userName, generatedAt, totalSessions,
}: ScheduleDocumentProps) {
  return (
    <Document title={title} author="Rooted in Mindfulness">
      <Page size="LETTER" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.range}>{rangeLabel}</Text>
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

          {days.length === 0 ? (
            <Text style={styles.empty}>
              No sessions assigned in this date range.
            </Text>
          ) : (
            days.map((d) => (
              <View key={d.dateStr} style={styles.day} wrap={false}>
                <Text style={styles.dayHeading}>{d.daySessions[0].dateLabel}</Text>
                {d.daySessions.map((s, i) => (
                  <View key={i} style={styles.session}>
                    <Text style={styles.sessionName}>{s.programName}</Text>
                    <Text style={styles.sessionTime}>{s.timeLabel}</Text>
                    {s.formatLabel ? (
                      <Text style={styles.sessionFmt}>{s.formatLabel}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))
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
