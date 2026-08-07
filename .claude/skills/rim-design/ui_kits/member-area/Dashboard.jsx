const { Badge, Button, Card } = window.RootedInMindfulnessDesignSystem_980dba;

function SectionLabel({ children }) {
  return <p style={{ margin:"0 0 12px", color:"var(--rim-text-muted)", fontFamily:"var(--font-sans)", fontSize:"var(--text-xxs)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>{children}</p>;
}

function TodayRow({ time, title, meta, state, next, onJoin }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, minHeight: next?92:74, padding:"16px 22px", borderTop:"1px solid var(--rim-rule)", background: state==="live" ? "var(--rim-bg-bright)" : "var(--rim-surface)" }}>
      <div style={{ display:"flex", minWidth:0, flexDirection:"column", gap:2 }}>
        <span style={{ color:"var(--rim-text-muted)", fontSize:"var(--text-xs)" }}>{time}</span>
        <span style={{ fontFamily:"var(--font-serif)", fontSize: next?"var(--text-h4)":"var(--text-small)", color:"var(--rim-text)" }}>{title}</span>
        <span style={{ display:"flex", flexWrap:"wrap", gap:"4px 10px", color:"var(--rim-text-muted)", fontSize:"var(--text-label)", lineHeight:1.35 }}>{meta}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        {state==="live" ? <Badge tone="success" uppercase>Live now</Badge> : null}
        {state==="setup" ? <Badge tone="blue" uppercase>Setup</Badge> : null}
        {onJoin ? <Button size="md" onClick={onJoin}>Join</Button> : <span style={{ color:"var(--rim-text-muted)", fontSize:"var(--text-xs)" }}>Opens 15 min before</span>}
      </div>
    </div>
  );
}

function UpcomingItem({ month, day, title, time, chip }) {
  return (
    <div style={{ display:"flex", alignItems:"center", minHeight:76, borderBottom:"1px solid var(--rim-rule)", background:"var(--rim-surface)" }}>
      <div style={{ width:72, alignSelf:"stretch", background:"var(--rim-bg-bright)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--rim-text-muted)" }}>
        <span style={{ fontSize:"var(--text-xxs)", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{month}</span>
        <span style={{ fontSize:"var(--text-h4)", fontFamily:"var(--font-serif)" }}>{day}</span>
      </div>
      <div style={{ flex:1, padding:16, display:"flex", flexDirection:"column", gap:3 }}>
        <span style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-small)", color:"var(--rim-text)" }}>{title}</span>
        <span style={{ color:"var(--rim-text-muted)", fontSize:"var(--text-label)" }}>{time}</span>
      </div>
      <div style={{ paddingRight:18 }}>{chip}</div>
    </div>
  );
}

function Dashboard({ name, onJoin }) {
  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ margin:"0 0 40px" }}>
        <p style={{ margin:"0 0 8px", color:"var(--rim-text-muted)", fontSize:"var(--text-xs)", fontWeight:600 }}>Tuesday, August 4</p>
        <h1 style={{ margin:"0 0 10px", fontSize:"var(--text-h1)", lineHeight:"var(--lh-heading)" }}>Good morning, {name.split(" ")[0]}.</h1>
        <p style={{ margin:0, color:"var(--rim-text-muted)", fontSize:"var(--text-small)" }}>One session today, and two more this week.</p>
      </div>

      <div style={{ margin:"0 0 44px" }}>
        <SectionLabel>Today</SectionLabel>
        <div style={{ overflow:"hidden", border:"1px solid var(--rim-rule)", borderRadius:"var(--radius-xl)", background:"var(--rim-surface)" }}>
          <div style={{ padding:"12px 22px", background:"var(--rim-bg-bright)", fontSize:"var(--text-xs)", fontWeight:600, color:"var(--rim-text-muted)" }}>Tuesday, August 4</div>
          <TodayRow next time="9:30 AM" title="The Art of Meditation" meta="In person & online · Jesse Foy" state="live" onJoin={onJoin} />
          <TodayRow time="7:30 PM" title="Silent Meditation" meta="Online · 30 minutes" />
        </div>
      </div>

      <div style={{ margin:"0 0 44px" }}>
        <SectionLabel>Coming up</SectionLabel>
        <div style={{ overflow:"hidden", borderRadius:"var(--radius-xl)", background:"var(--rim-surface)" }}>
          <UpcomingItem month="Aug" day="6" title="Qigong at RIM" time="10:00 AM · Online" chip={<Badge tone="success">Registered</Badge>} />
          <UpcomingItem month="Aug" day="7" title="Essential Dharma Study" time="9:30 AM · Online" chip={<Badge tone="success">Registered</Badge>} />
          <UpcomingItem month="Aug" day="13" title="Foundations of Mindfulness — Week 3" time="6:30 PM · In person" chip={<Badge tone="neutral">Dana</Badge>} />
        </div>
      </div>

      <div>
        <SectionLabel>Your teams</SectionLabel>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10 }}>
          {[["Saturday Host Team","Hosting"],["Welcome Team","Hospitality"]].map(([n,t])=>(
            <div key={n} style={{ minHeight:86, padding:18, border:"1px solid var(--rim-rule)", borderRadius:"var(--radius-lg)", background:"var(--rim-surface)" }}>
              <div style={{ color:"var(--rim-text)", fontSize:"var(--text-small)", fontFamily:"var(--font-serif)" }}>{n}</div>
              <div style={{ marginTop:6, color:"var(--rim-text-muted)", fontSize:"var(--text-xxs)", letterSpacing:"0.08em", textTransform:"uppercase" }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, SectionLabel });
