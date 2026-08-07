const { ListRow, Badge } = window.RootedInMindfulnessDesignSystem_980dba;

function Registrations() {
  return (
    <div style={{ maxWidth:820 }}>
      <h1 style={{ margin:"0 0 10px", fontSize:"var(--text-h1)" }}>My Registrations</h1>
      <p style={{ margin:"0 0 36px", color:"var(--rim-text-muted)", fontSize:"var(--text-small)" }}>What you've said yes to. Cancel any time — no explanation needed.</p>
      <SectionLabel>Active</SectionLabel>
      <div style={{ display:"grid", gap:12, marginBottom:44 }}>
        <ListRow name="Foundations of Mindfulness" badge="Week 3 of 8" schedule="Wednesdays · 6:30 PM · In person" actionLabel="Cancel" />
        <ListRow name="Essential Dharma Study" schedule="Thursdays · 9:30 AM · Online" actionLabel="Cancel" />
        <ListRow name="Qigong at RIM" schedule="Wednesdays · 10:00 AM · Online" note="Kate is covering the next two weeks." actionLabel="Cancel" />
      </div>
      <SectionLabel>Past</SectionLabel>
      <div style={{ display:"grid", gap:12 }}>
        <ListRow name="Nature Meditation Walk" schedule="July 12 · In person" actionLabel="Registered" actionDisabled />
        <ListRow name="Half-Day Retreat" schedule="June 21 · In person" actionLabel="Registered" actionDisabled />
      </div>
    </div>
  );
}

Object.assign(window, { Registrations });
