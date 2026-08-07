const { ProgramCard, Eyebrow } = window.RootedInMindfulnessDesignSystem_980dba;

const CATALOG = [
  { heading:"Drop-In Sessions", items:[
    { title:"The Art of Meditation", tags:["Drop-in"], meta:["Tuesdays","9:30 AM","In person & online"], description:"Guided practice and a short teaching, with time for questions." },
    { title:"Meditation and Dharma Talk", tags:["Drop-in"], meta:["Saturdays","9:30 AM","In person & online"], description:"A guided sit followed by a talk on the week's theme." },
    { title:"Awakening the Heart", tags:["Drop-in"], meta:["Mondays","9:30 AM","Online"], description:"Lovingkindness practice to begin the week." },
  ]},
  { heading:"Courses", items:[
    { title:"Foundations of Mindfulness", tags:["Course","Registration"], meta:["8 weeks","Wednesdays","6:30 PM"], description:"Where most people begin. Each session builds a real practice — not just ideas, but skills you can use." },
    { title:"Essential Dharma Study", tags:["Course"], meta:["6 weeks","Thursdays","9:30 AM"], description:"Reading the earliest teachings together, in plain language." },
  ]},
  { heading:"Community Groups", items:[
    { title:"Qigong at RIM", tags:["Group"], meta:["Wednesdays","10:00 AM","Online"], description:"Gentle movement and breath, open to every body." },
    { title:"Nature Meditation Walk", tags:["Group"], meta:["Monthly","Saturdays","In person"], description:"Practice outdoors, weather permitting, at the Calhoun Rd. trails." },
  ]},
];

function ProgramsList({ go }) {
  return (
    <div style={{ background:"var(--rim-bg)" }}>
      <section style={{ minHeight:430, boxSizing:"border-box", display:"flex", alignItems:"center", position:"relative", overflow:"hidden", backgroundColor:"var(--rim-blue)", backgroundImage:"url(../../assets/images/Looking-Up-Pine-Trees.jpg)", backgroundSize:"cover", backgroundPosition:"center 48%" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(13,34,53,0.96) 0%, rgba(49,87,109,0.83) 54%, rgba(49,87,109,0.48) 100%)" }} />
        <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:1140, margin:"0 auto", padding:"72px 40px 76px", boxSizing:"border-box" }}>
          <Eyebrow tone="onDark" style={{ letterSpacing:"0.15em" }}>Community Programs</Eyebrow>
          <h1 style={{ maxWidth:650, margin:"0 0 22px", color:"#fff", fontFamily:"var(--font-serif)", fontSize:"var(--text-hero)", fontWeight:500, letterSpacing:"-0.02em", lineHeight:1.08 }}>
            Everything we offer, in one place
          </h1>
          <p style={{ maxWidth:600, margin:"0 0 34px", color:"rgba(255,255,255,0.88)", fontSize:"var(--text-body)", lineHeight:"var(--lh-body)" }}>
            Drop-ins are open to anyone, any week. Courses run in seasons and ask for registration. Community groups keep going all year.
          </p>
          <a href="#" onClick={(e)=>e.preventDefault()} style={{ minHeight:44, display:"inline-flex", alignItems:"center", gap:12, color:"#fff", fontFamily:"var(--font-sans)", fontSize:"var(--text-small)", fontWeight:600, textDecoration:"none" }}>
            New here? Start with a drop-in <span>→</span>
          </a>
        </div>
      </section>

      <div style={{ padding:"68px 0 88px" }}>
        <div style={{ maxWidth:900, margin:"0 auto 52px", padding:"0 40px", boxSizing:"border-box" }}>
          <Eyebrow tone="blue">The catalog</Eyebrow>
          <h2 style={{ margin:"0 0 18px", fontSize:"var(--text-h1)", fontWeight:400 }}>What's running now</h2>
          <p style={{ margin:0, maxWidth:700, fontSize:"var(--text-body)", lineHeight:"var(--lh-body)" }}>
            No fees, no tuition. Registration exists so we know how many chairs to set out — nothing more.
          </p>
        </div>
        {CATALOG.map((cat)=>(
          <div key={cat.heading} style={{ maxWidth:900, margin:"0 auto 60px", padding:"0 40px", boxSizing:"border-box" }}>
            <h3 style={{ margin:"0 0 18px", fontSize:"var(--text-h2)", fontWeight:400 }}>{cat.heading}</h3>
            <div style={{ display:"grid", gap:14 }}>
              {cat.items.map((p)=> <ProgramCard key={p.title} {...p} href="#" onClick={(e)=>{e.preventDefault();go("detail",p);}} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ProgramsList });
