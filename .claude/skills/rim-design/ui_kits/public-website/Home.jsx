const { HeroPanel, ScheduleRow, Testimonial, Card, Eyebrow } = window.RootedInMindfulnessDesignSystem_980dba;

const SCHEDULE = [
  { day:"Monday", name:"Awakening the Heart", description:"Lovingkindness practice", time:"9:30 AM", format:"Online" },
  { day:"Tuesday", name:"The Art of Meditation", description:"Guided practice and teaching", time:"9:30 AM", format:"In person & online", inPerson:true },
  { day:"Wednesday", name:"Qigong at RIM", description:"Gentle movement and breath", time:"10:00 AM", format:"Online" },
  { day:"Thursday", name:"Essential Dharma Study", description:"Teaching and dialogue", time:"9:30 AM", format:"Online" },
  { day:"Saturday", name:"Meditation and Dharma Talk", description:"Guided sit and teaching", time:"9:30 AM", format:"In person & online", inPerson:true },
  { day:"Sunday", name:"Our Hearts Were Made for This", description:"Lovingkindness practice", time:"9:00 AM", format:"Online" },
  { day:"Every day", name:"Silent Meditation", description:"Morning · Evening", time:"6:30 AM · 7:30 PM", format:"Online" },
];

function Section({ tone="white", narrow=false, children }) {
  const bg = { white:"var(--rim-surface)", grey:"var(--rim-bg)", teal:"var(--rim-blue)" }[tone];
  return (
    <section style={{ background:bg, paddingTop:96, paddingBottom:96, color: tone==="teal" ? "rgba(255,255,255,0.92)" : "var(--rim-text)" }}>
      <div style={{ width:"100%", maxWidth: narrow ? 700 : 1140, margin:"0 auto", padding:"0 40px", boxSizing:"border-box" }}>{children}</div>
    </section>
  );
}

function ArrowLink({ children, onClick }) {
  return <a href="#" onClick={(e)=>{e.preventDefault();onClick&&onClick();}} style={{ fontFamily:"var(--font-sans)", fontSize:"var(--text-body)", color:"var(--rim-mid)", fontWeight:500, textDecoration:"none" }}>{children}</a>;
}

function Home({ go }) {
  return (
    <>
      <HeroPanel variant="video" heading="Awaken your Mind, Open your Heart, Nourish your Life, Beautify the World." cta="Join us–today" ctaHref="#" secondary="See what's happening this week" backgroundVideo="../../assets/video/Bodhi_Leaves-transcode.mp4" backgroundImage="../../assets/images/Bodhi_Leaves-poster.jpg">
        We're a meditation and dharma community in Brookfield, Wisconsin. We sit together, we study the teachings, and we try to bring what we find into the rest of our lives. Buddhist-rooted, open to everyone, and offered in the spirit of generosity.
      </HeroPanel>

      <Section narrow>
        <p style={{ margin:"0 0 24px", fontSize:"var(--text-body)", lineHeight:"var(--lh-body)" }}>
          People come to RIM for different reasons. Some want to learn to meditate. Some have been practicing on their own and are ready for a teacher and a community. Some are going through something hard and need a place where they don't have to explain themselves.
        </p>
        <p style={{ margin:0, fontFamily:"var(--font-serif)", fontSize:"var(--text-h3)", color:"var(--rim-mid)", lineHeight:1.5 }}>
          Whatever brought you here, you're welcome. No experience needed. No fees. Come as you are, and see what you find.
        </p>
      </Section>

      <Section tone="grey">
        <h2 style={{ margin:"0 0 36px" }}>This Week at RIM</h2>
        <div style={{ borderTop:"1px solid var(--rim-rule)", marginBottom:20 }}>
          {SCHEDULE.map((r)=> <ScheduleRow key={r.day} {...r} />)}
        </div>
        <p style={{ fontSize:"var(--text-small)", color:"var(--rim-text-muted)", lineHeight:"var(--lh-body)", margin:"0 0 28px" }}>
          New to meditation? <strong>Tuesdays</strong> and <strong>Saturdays</strong> are great places to start — both are offered in person at the center and online.
        </p>
        <ArrowLink onClick={()=>go("programs")}>See All Programs →</ArrowLink>
      </Section>

      <Section>
        <h2 style={{ fontSize:"var(--text-h3)", margin:"0 0 48px", textAlign:"center" }}>What people find here</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
          <Testimonial>"RIM has been a safe place for me to bring my anxiety and brokenness — to feel supported and okay. You allow me to show up with all my baggage and leave it here. Feeling lighter."</Testimonial>
          <Testimonial>"I have not found anyone else who melds the philosophy of mindfulness with the practice itself. There are those who teach, those who do, and only one I have found who does both."</Testimonial>
          <Testimonial>"After the first drop-in session, I knew I was home. The warm, welcoming, engaging community were where I wanted to grow my practice."</Testimonial>
        </div>
      </Section>

      <Section tone="grey">
        <h2 style={{ maxWidth:620, margin:"0 0 48px" }}>Wherever you are, there's a place to practice</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", borderTop:"1px solid var(--rim-rule)", borderBottom:"1px solid var(--rim-rule)" }}>
          {[
            ["Drop-In Sessions","The open door. Guided meditation, short teaching, time for questions. Come when you can, as often as you like. No commitment, no experience needed."],
            ["Courses","Multi-week programs for those ready to go deeper. Foundations of Mindfulness is where most people begin. Each course builds a real practice — not just ideas, but skills you can use."],
            ["Study & Community Groups","Dharma study, book clubs, qigong, nature meditation, community service. For the practitioner who wants to keep going — and wants company on the way."],
          ].map(([name,body],i)=>(
            <div key={name} style={{ padding:"36px 32px 36px 0", paddingLeft: i>0?32:0, borderRight: i<2?"1px solid var(--rim-rule)":"none" }}>
              <h3 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h4)", fontWeight:400, color:"var(--rim-blue)", margin:"0 0 12px" }}>{name}</h3>
              <p style={{ margin:0, fontSize:"var(--text-body)", lineHeight:"var(--lh-body)" }}>{body}</p>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:32, marginTop:32 }}>
          <ArrowLink onClick={()=>go("programs")}>See All Programs →</ArrowLink>
          <ArrowLink onClick={()=>go("programs")}>Upcoming Courses →</ArrowLink>
        </div>
      </Section>

      <Section tone="teal">
        <h2 style={{ textAlign:"center", color:"#fff", margin:"0 0 56px" }}>Why we practice together</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:48 }}>
          {[
            ["For yourself.","This is where practice begins — a steadier mind, a more open heart, a clearer way of being in your own life."],
            ["For those you love.","What changes in you moves outward. The way you listen, the way you respond, the patience you bring home."],
            ["For our shared world.","We don't practice only for ourselves. We practice because the world needs people who are present, compassionate, and willing to show up."],
          ].map(([t,b])=>(
            <div key={t}>
              <h3 style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h3)", fontWeight:400, color:"#fff", margin:"0 0 16px" }}>{t}</h3>
              <p style={{ margin:0, color:"rgba(255,255,255,0.88)" }}>{b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section narrow>
        <h2 style={{ margin:"0 0 20px" }}>A generosity-based community</h2>
        <p style={{ margin:"0 0 18px" }}>Everything at RIM is offered in the spirit of <em>dana</em> — a Pāli word meaning generosity of heart, mind, and action.</p>
        <p style={{ margin:"0 0 18px" }}>In the Buddhist tradition, teachers offer their teachings freely, and the community supports the teachers and the center to the level of their ability. RIM follows this model. We don't charge fees or tuition.</p>
        <p style={{ margin:"0 0 18px" }}><em>RIM is a 501(c)(3) nonprofit organization.</em></p>
        <div style={{ display:"flex", gap:32, marginTop:8 }}>
          <ArrowLink>Give a Donation →</ArrowLink>
          <ArrowLink>Volunteer →</ArrowLink>
        </div>
      </Section>

      <Section tone="grey" narrow>
        <blockquote style={{ margin:0, padding:"0 0 0 28px", borderLeft:"3px solid var(--rim-rule)" }}>
          <p style={{ fontFamily:"var(--font-serif)", fontSize:"var(--text-h3)", fontStyle:"italic", lineHeight:1.45, margin:"0 0 16px" }}>
            "If something brought you here, that's enough. Come to a drop-in. Sit for an hour. See what you notice."
          </p>
          <footer style={{ fontSize:"var(--text-small)", color:"var(--rim-text-muted)", fontWeight:600 }}>— Jesse</footer>
        </blockquote>
        <div style={{ marginTop:36 }}><ArrowLink onClick={()=>go("programs")}>This Week's Schedule →</ArrowLink></div>
      </Section>
    </>
  );
}

Object.assign(window, { Home, Section, ArrowLink });
