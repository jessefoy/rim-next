const { TextField, Button, Card, Panel, StateMessage } = window.RootedInMindfulnessDesignSystem_980dba;

function Profile() {
  const [saved, setSaved] = React.useState(false);
  return (
    <div style={{ maxWidth:820 }}>
      <h1 style={{ margin:"0 0 10px", fontSize:"var(--text-h1)" }}>My Profile</h1>
      <p style={{ margin:"0 0 36px", color:"var(--rim-text-muted)", fontSize:"var(--text-small)" }}>How we reach you, and how you appear to the community.</p>
      {saved ? <div style={{ marginBottom:20 }}><StateMessage tone="success" label="Saved.">Your changes have been saved.</StateMessage></div> : null}
      <Card padding={32} bordered elevated={false} style={{ marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <TextField label="First name" defaultValue="Marguerite" />
          <TextField label="Last name" defaultValue="Chen" />
          <TextField label="Email address" type="email" defaultValue="marguerite@example.org" help="This is also your sign-in." />
          <TextField label="Phone" type="tel" defaultValue="(414) 555-0148" />
        </div>
        <div style={{ marginTop:24, display:"flex", gap:10 }}>
          <Button onClick={()=>setSaved(true)}>Save changes</Button>
          <Button variant="ghost" onClick={()=>setSaved(false)}>Cancel</Button>
        </div>
      </Card>
      <Panel padding={28}>
        <h3 style={{ margin:"0 0 8px", fontFamily:"var(--font-serif)", fontSize:"var(--text-h4)", fontWeight:500 }}>Community care agreements</h3>
        <p style={{ margin:"0 0 16px", fontSize:16, lineHeight:1.6 }}>You agreed to these when you joined. They're short, and worth rereading now and then.</p>
        <Button variant="secondary" href="#">Read the agreements</Button>
      </Panel>
    </div>
  );
}

Object.assign(window, { Profile });
