const { PullQuote, DetailRow, Panel, Button, Eyebrow } = window.RootedInMindfulnessDesignSystem_980dba;

function ProgramDetail({ program = {}, go }) {
  const title = program.title || "The Art of Meditation";
  return (
    <div style={{ background:"var(--rim-bg)" }}>
      <section style={{ backgroundColor:"var(--rim-blue)", backgroundImage:"url(../../assets/images/Forest-Path.jpg)", backgroundSize:"cover", backgroundPosition:"center 44%", padding:"112px 24px 188px", textAlign:"center", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(49,87,109,0.84), rgba(13,34,53,0.91))" }} />
        <div style={{ maxWidth:700, margin:"0 auto", position:"relative", zIndex:1 }}>
          <a href="#" onClick={(e)=>{e.preventDefault();go("programs");}} style={{ display:"inline-block", fontFamily:"var(--font-sans)", fontSize:"var(--text-label)", fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.72)", textDecoration:"none", margin:"0 0 16px" }}>
            {(program.tags && program.tags[0]) || "Drop-in"}
          </a>
          <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-hero)", fontWeight:500, lineHeight:1.15, letterSpacing:"-0.5px", color:"#fff", margin:"0 0 14px" }}>{title}</h1>
          <p style={{ fontFamily:"var(--font-sans)", fontSize:"var(--text-h4)", lineHeight:1.4, color:"rgba(255,255,255,0.85)", margin:0 }}>
            {program.description || "Guided practice and a short teaching, with time for questions."}
          </p>
        </div>
      </section>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"0 24px 96px", boxSizing:"border-box" }}>
        <PullQuote source="— Jesse" floating>
          Meditation isn't a technique you master. It's a relationship you keep returning to.
        </PullQuote>

        <div style={{ background:"var(--rim-surface)", borderRadius:"var(--radius-2xl)", padding:"24px 30px 26px", boxShadow:"var(--card-shadow)", marginBottom:15 }}>
          <h2 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h2)", fontWeight:400, margin:"0 0 16px" }}>Details</h2>
          <DetailRow icon={<i data-lucide="calendar-days"></i>}>{(program.meta && program.meta.slice(0,2).join(", ")) || "Tuesdays, 9:30–10:45 AM"}</DetailRow>
          <DetailRow icon={<i data-lucide="map-pin"></i>} link="Directions →" linkHref="#">4040 N. Calhoun Rd., Brookfield, WI 53005</DetailRow>
          <DetailRow icon={<i data-lucide="video"></i>}>Also offered on Zoom — the link is on your dashboard once you register.</DetailRow>
          <DetailRow icon={<i data-lucide="heart-handshake"></i>} last>Offered freely in the spirit of dana. Give what feels right, or nothing at all.</DetailRow>
          <div style={{ paddingTop:22 }}>
            <Button size="lg" href="#">Register</Button>
          </div>
        </div>

        <Panel padding={30} radius="var(--radius-2xl)" style={{ margin:"5px 0 15px" }}>
          <h3 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h4)", fontWeight:500, margin:"0 0 10px" }}>Before you come</h3>
          <p style={{ margin:0, fontSize:16, lineHeight:1.6 }}>
            Chairs and cushions are both available. Arrive a few minutes early if it's your first time — someone will meet you at the door and show you where things are.
          </p>
        </Panel>

        <div style={{ marginTop:32, fontSize:"var(--text-body)", lineHeight:"var(--lh-body)" }}>
          <h2 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h2)", fontWeight:400, margin:"0 0 16px" }}>About this program</h2>
          <p>We begin with a settling period, move into a guided practice of about twenty-five minutes, and close with a short teaching and open questions. You don't need to have meditated before.</p>
          <p>People come every week; people come twice a year. Both are fine. The door is the same either way.</p>
        </div>

        <div style={{ marginTop:45, background:"var(--rim-bg-accent)", borderRadius:"var(--radius-lg)", padding:"30px 30px 25px" }}>
          <h3 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h2)", fontWeight:400, margin:"0 0 10px" }}>Come sit with us</h3>
          <p style={{ margin:"0 0 16px", fontSize:16, lineHeight:1.6 }}>Registration helps us set out the right number of chairs. It is never a payment.</p>
          <Button href="#">Register for this session</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProgramDetail });
