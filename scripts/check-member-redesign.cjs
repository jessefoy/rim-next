/** Focused regression checks; no live database, Google, Zoom, or email calls.
 * Run: node scripts/check-member-redesign.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let assertions = 0;
let TestDate = Date;
function check(value, expected, label) { assert.deepEqual(value, expected, label); assertions++; }
function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: name => {
    if (name in imports) return imports[name];
    if (name.startsWith('react')) return require(name);
    throw Error(`Unexpected dependency in test: ${name}`);
  }, console, Date: TestDate, URL, setTimeout }, { filename: file });
  return module.exports;
}
const organization = load('lib/fileOrganization.ts');
const json = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
(async () => {
  for (const color of ['#abcdef', '#ABCDEF', null]) check(organization.validFileColor(color), true, 'accept six-digit colors / clear');
  for (const color of ['red', '#fff', '#12345g', 'url(https://example.com)', 123]) check(organization.validFileColor(color), false, 'reject invalid color');
  const folder = 'application/vnd.google-apps.folder';
  const rows = [
    { id:'c', name:'File 10', mimeType:'text/plain', modifiedTime:'2026-09-01' },
    { id:'a', name:'Folder', mimeType:folder, modifiedTime:'2026-09-03' },
    { id:'b', name:'File 2', mimeType:'text/plain', modifiedTime:'2026-09-02' },
    { id:'p', name:'Pinned', mimeType:'text/plain', modifiedTime:null, pinned:true },
  ];
  check(Array.from(organization.orderFiles(rows, 'name'), r=>r.id), ['p','a','b','c'], 'pins first, folders next, numeric names');
  check(Array.from(organization.orderFiles(rows, 'name-desc'), r=>r.id), ['p','a','c','b'], 'reverse names preserve shared pins/folders');
  check(Array.from(organization.orderFiles(rows, 'newest'), r=>r.id), ['p','a','b','c'], 'date order');
  check(rows[0].id, 'c', 'sorting does not mutate input');

  let session = { user: { id: 'member-a', roles: [] } };
  let readable = true, writable = true, held = false, pending = false;
  const writes = [];
  const tx = {
    googleFilePreference: { upsert: async data => { writes.push(['personal', data]); return data; } },
    googleFilePin: { upsert: async data => { writes.push(['pin', data]); }, deleteMany: async data => { writes.push(['unpin',data]); } },
    googleFileAudit: { create: async data => { writes.push(['audit',data]); } },
    googleFileViewPreference: { upsert: async data => { writes.push(['sort',data]); } },
  };
  const db = { ...tx, $transaction: async callback => callback(tx) };
  const gates = {
    isCrossSiteRequest: req => req.headers.get('sec-fetch-site') === 'cross-site',
    authorizeFileRead: async (s, id) => !s ? { ok:false,status:401,error:'Sign in' } : !readable ? { ok:false,status:404,error:'Unavailable' } : { ok:true, data:{ viewer:{ userId:s.user.id, roles:s.user.roles }, file:{ id }, place:{ key:'hub:test',hubId:'team',canWrite:writable }, meta:{heldAt:held ? new Date() : null,pendingDeleteAt:pending ? new Date() : null} } },
    authorizeFileWrite: async () => writable ? {ok:true} : {ok:false,status:403,error:'Read only'},
    filesViewer: s => s ? {userId:s.user.id,roles:s.user.roles} : null,
    resolvePlace: async (id, roles, place) => readable && place === 'hub:test' ? {key:place} : null,
  };
  const imports = {'next/server':json,'@/auth':{auth:async()=>session},'@/lib/db':{db},'@/lib/googleFiles':gates,'@/lib/fileOrganization':organization};
  const route = load('app/api/files/[fileId]/organization/route.ts', imports);
  const sortRoute = load('app/api/files/preferences/route.ts', imports);
  const request = (body, cross = false) => ({ json:async()=>body, headers:{get:()=>cross?'cross-site':'same-origin'} });
  const run = (body, cross = false) => route.PATCH(request(body,cross), {params:Promise.resolve({fileId:'file-1'})});
  check((await run({place:'hub:test',favorite:true})).status,200,'member saves own favorite');
  check(writes[0][1].where.userId_placeKey_googleFileId.userId,'member-a','identity comes from session');
  session.user.id='member-b';
  await run({place:'hub:test',color:'#AABBCC'});
  check(writes[1][1].where.userId_placeKey_googleFileId.userId,'member-b','different member has different key');
  check(writes[1][1].update.color,'#aabbcc','normalize safe color');
  check('favorite' in writes[1][1].update,false,'color save preserves favorite');
  let before = writes.length;
  check((await run({place:'hub:test',favorite:true,userId:'member-a'})).status,400,'reject member spoofing');
  check((await run({place:'hub:test',color:'url(secret)'})).status,400,'reject CSS injection');
  check((await run({place:'hub:test',favorite:'true'})).status,400,'reject wrong type');
  check((await run({place:'hub:other',favorite:true})).status,404,'reject forged place');
  check((await run({place:'hub:test',favorite:true},true)).status,403,'reject cross-site mutation');
  check(writes.length,before,'rejected inputs never write');
  readable=false;
  check((await run({place:'hub:test',favorite:true})).status,404,'revoked access cannot save preferences');
  check((await sortRoute.PATCH(request({place:'hub:test',sort:'name'}))).status,404,'revoked access cannot save view');
  readable=true; writable=false;
  check((await run({place:'hub:test',favorite:true})).status,200,'read-only member can organize personally');
  before=writes.length;
  check((await run({place:'hub:test',pinned:true})).status,403,'read-only member cannot pin');
  check((await run({place:'hub:test',pinned:false})).status,403,'read-only member cannot unpin');
  check(writes.length,before,'shared pins unchanged for readers');
  writable=true; held=true;
  check((await run({place:'hub:test',pinned:true})).status,400,'private drafts cannot be team pins');
  held=false; pending=true;
  check((await run({place:'hub:test',pinned:true})).status,404,'pending-removal file cannot be pinned');
  pending=false;
  check((await run({place:'hub:test',pinned:true})).status,200,'writer can pin');
  check(writes.at(-2)[1].create.pinnedByUserId,'member-b','shared pin has attribution');
  check(writes.at(-1)[1].data.action,'pin','shared pin is audit logged');
  check((await run({place:'hub:test',pinned:false})).status,200,'writer can unpin');
  check(writes.at(-2)[1].where.placeKey,'hub:test','unpin is place-scoped');
  check((await sortRoute.PATCH(request({place:'hub:test',sort:'newest'}))).status,200,'sort persists');
  check(writes.at(-1)[1].where.userId_placeKey.userId,'member-b','sort is personal');
  check((await sortRoute.PATCH(request({place:'hub:test',sort:'invalid'}))).status,400,'invalid sort rejected');
  session=null;
  check((await run({place:'hub:test',favorite:true})).status,401,'signed-out mutation rejected');
  check((await sortRoute.PATCH(request({place:'hub:test',sort:'name'}))).status,401,'signed-out sort rejected');

  // Exercise the real list handler: preferences are looked up only for
  // the filtered visible IDs and the current member, not every team member.
  session={user:{id:'member-a',roles:[]}};
  let prefQuery, pinQuery;
  const visibleRows=[{id:'visible',name:'Shared',held:false},{id:'my-draft',name:'Draft',held:true}];
  const listing=load('app/api/files/list/route.ts', {
    'next/server':json,'@/auth':{auth:async()=>session},
    '@/lib/googleFiles':{...gates,resolveParentFolder:async()=>({name:'Folder'}),buildFileRows:async()=>visibleRows},
    '@/lib/google/drive':{listFiles:async()=>[{id:'visible'},{id:'my-draft'},{id:'someone-elses-draft'}]},
    '@/lib/sessionIdentity':{sessionDisplayName:person=>person.firstName},
    '@/lib/db':{db:{
      googleFilePreference:{findMany:async query=>{prefQuery=query;return [{googleFileId:'visible',favorite:true,color:'#abcdef'}]}},
      googleFilePin:{findMany:async query=>{pinQuery=query;return [{googleFileId:'visible',pinnedByUserId:'member-b'},{googleFileId:'my-draft',pinnedByUserId:'member-b'}]}},
      googleFileViewPreference:{findUnique:async()=>({sort:'newest'})},
      user:{findMany:async()=>[{id:'member-b',firstName:'Taylor'}]},
    }},
  });
  const listResult=await listing.GET({nextUrl:new URL('https://example.test/api/files/list?place=hub:test')});
  check(listResult.status,200,'list succeeds');
  check(prefQuery.where.userId,'member-a','list only reads current member preferences');
  check(Array.from(prefQuery.where.googleFileId.in),['visible','my-draft'],'hidden IDs excluded before preference reads');
  check(pinQuery.where.placeKey,'hub:test','pins scoped to resource place');
  check(listResult.body.files[0].pinnedBy,'Taylor','shared attribution serialized');
  check(listResult.body.files[1].pinned,false,'held file never appears as team pin');
  check(listResult.body.files[1].favorite,false,'missing preference defaults private-neutral');
  check(listResult.body.sort,'newest','saved sort returned');

  // Render the actual public notice component: important updates remain; the
  // routine preparation field cannot leak into either public listing.
  const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
  const Notices = load('components/ProgramCardNotices.tsx').default;
  const publicHtml = renderToStaticMarkup(React.createElement(Notices,{announcement:'Schedule changed',note:'PRIVATE PREPARATION'}));
  check(publicHtml.includes('Schedule changed'),true,'public updates retained');
  check(publicHtml.includes('PRIVATE PREPARATION'),false,'routine notes absent from public cards');

  // The directory must not repeat the old AccountLayout ADMIN bypass.
  let teamQuery;
  session={user:{id:'member-a',roles:['ADMIN']}};
  const Teams=load('app/account/(authenticated)/teams/page.tsx',{
    '@/auth':{auth:async()=>session},'next/navigation':{redirect:()=>{throw Error('redirect')}},
    'next/link':{default:({children,href})=>React.createElement('a',{href},children),__esModule:true},
    '@/lib/db':{db:{hub:{findMany:async query=>{teamQuery=query;return []}}}},
    '@/components/AccountLayout':{default:({children})=>children,__esModule:true},
  }).default;
  await Teams();
  check(teamQuery.where.members.some.userId,'member-a','ADMIN directory still requires membership');
  session.user.roles=['GUIDING_TEACHER'];await Teams();
  check(Object.keys(teamQuery.where).length,0,'guiding teacher retains existing reach');
  // 2026-10-12: members never see archived teams; Coordinator is marked; a
  // guiding teacher's own teams are separated from the ones they oversee; a
  // member with no team gets the volunteer empty state.
  const teamHubs=[
    {slug:'host-team',name:'Host Team',status:'ACTIVE',members:[{isCoordinator:true,status:'ACTIVE'}]},
    {slug:'greeter',name:'Greeters',status:'ACTIVE',members:[{isCoordinator:false,status:'ACTIVE'}]},
    {slug:'old-team',name:'Old Team',status:'ARCHIVED',members:[{isCoordinator:false,status:'ACTIVE'}]},
    {slug:'av',name:'Audio Visual',status:'ACTIVE',members:[]},
  ];
  const TeamsWith=hubs=>load('app/account/(authenticated)/teams/page.tsx',{
    '@/auth':{auth:async()=>session},'next/navigation':{redirect:()=>{throw Error('redirect')}},
    'next/link':{default:({children,href})=>React.createElement('a',{href},children),__esModule:true},
    '@/lib/db':{db:{hub:{findMany:async query=>{teamQuery=query;return hubs}}}},
    '@/components/AccountLayout':{default:({children})=>children,__esModule:true},
  }).default;
  session={user:{id:'member-a',roles:[]}};
  let teamsHtml=renderToStaticMarkup(await TeamsWith([])());
  check(teamQuery.where.status,'ACTIVE','member directory excludes archived teams');
  check(teamsHtml.includes('/volunteerism/volunteer'),true,'no-team member sees the volunteer door');
  teamsHtml=renderToStaticMarkup(await TeamsWith(teamHubs.slice(0,2))());
  check(teamsHtml.includes('Coordinator'),true,'coordinator role is marked');
  check((teamsHtml.match(/Coordinator/g)||[]).length,1,'only the coordinated team is marked');
  // 2026-10-19: a paused coordinator isn't marked (the ACTIVE coordinator rule).
  teamsHtml=renderToStaticMarkup(await TeamsWith([{...teamHubs[0],members:[{isCoordinator:true,status:'PAUSED'}]}])());
  check(teamsHtml.includes('Coordinator'),false,'paused coordinator is not marked');
  session={user:{id:'member-a',roles:['GUIDING_TEACHER']}};
  teamsHtml=renderToStaticMarkup(await TeamsWith(teamHubs)());
  check(teamsHtml.includes('Your teams')&&teamsHtml.includes('Teams you oversee'),true,'guiding teacher sees two groups');
  check(teamsHtml.indexOf('Audio Visual')>teamsHtml.indexOf('Teams you oversee'),true,'non-member team is under oversight');
  check(teamsHtml.indexOf('Old Team')>teamsHtml.indexOf('Audio Visual'),true,'archived team sorts last under oversight');
  // Render the real dashboard under a fixed clock with fixture records.
  // Timing and offering-kind helpers are production code, not test copies.
  let now = '2026-09-21T15:55:00Z';
  TestDate = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new Date(now).getTime(); } };
  session = {user:{id:'member-a',name:'Member',roles:[]}};
  let programs = [{id:'p1',slug:'morning',name:'Morning practice',programFormat:'virtual',startDatetime:new Date('2026-09-21T16:00:00Z'),endDatetime:new Date('2026-09-21T17:00:00Z'),recurrenceFreq:null,recurrenceInterval:null,recurrenceDays:[],recurrenceCount:null,registrationEnabled:false,category:{kind:'DROP_IN'},earlyArrivalMessage:'Preparation note',specialAnnouncement:'Schedule update'}];
  let assignments = [], registrations = [];
  const registrationQueries = [];
  const programKind = load('lib/programKind.ts');
  const Dashboard = load('app/account/(authenticated)/dashboard/page.tsx', {
    '@/auth':{auth:async()=>session},
    // 2026-10-20: My Home's one line when there's news (none in these fixtures).
    '@/lib/notifications':{countUnreadNotices:async()=>0},'next/navigation':{redirect:()=>{throw Error('redirect')}},
    'next/link':{default:({children,href,...props})=>React.createElement('a',{href,...props},children),__esModule:true},
    '@/lib/db':{db:{
      program:{findMany:async()=>programs},
      registration:{findMany:async query=>{registrationQueries.push(query);return registrations}},
      hubMember:{findMany:async()=>[]},
      hostAssignment:{findMany:async()=>assignments},programTeacher:{findMany:async()=>[]},
      // Today's list (2026-10-24): the duty's team still on the program, and active.
      programCoverageHub:{findMany:async()=>assignments.map(x=>({programSlug:x.programSlug,hubSlug:x.hubSlug}))},
      hub:{findMany:async()=>[...new Set(assignments.map(x=>x.hubSlug))].map(slug=>({slug}))},
      user:{findUnique:async()=>({hostWelcomeSeenAt:new Date()})},
    }},
    // scheduleUtils places a session at its Central wall-clock time through
    // lib/timezone (2026-10-16), a pure module with no imports of its own.
    '@/lib/scheduleUtils':load('lib/scheduleUtils.ts',{'./timezone':load('lib/timezone.ts')}),
    '@/lib/programKind':programKind,
    '@/lib/programOffering':load('lib/programOffering.ts',{'@/lib/programKind':programKind}),
    '@/lib/programHub':{getHubCoverageCopy:async hub=>hub==='greeter'?{noun:'Greeter',verb:'greeting',action:'greet'}:{noun:'Host',verb:'hosting',action:'host this'}},
    '@/lib/timezone':load('lib/timezone.ts'),
    '@/lib/sessionWindowConstants':load('lib/sessionWindowConstants.ts'),
    '@/lib/outsideMeeting':load('lib/outsideMeeting.ts'),
    '@/components/AccountLayout':{default:({children})=>children,__esModule:true},
    '@/components/DashboardAutoRefresh':{default:()=>null,__esModule:true},
    '@/components/HostWelcomePanel':{default:()=>null,__esModule:true},
    '@/components/FormDone':{default:({children})=>children,__esModule:true},
    '@/components/HandfulHomeCard':{default:()=>null,__esModule:true},
  }).default;
  const dashboardHtml = async query=>renderToStaticMarkup(await Dashboard({searchParams:Promise.resolve(query??{})}));
  let html = await dashboardHtml();
  check(html.includes('Join on Zoom'),true,'regular join window retained');
  check(html.includes('/session/morning/enter'),true,'Zoom handoff unchanged');
  check(html.includes('Preparation note'),true,'preparation reaches member home');
  check(html.includes('Schedule update'),true,'important update reaches member home');
  check(html.includes('class="rim-session-note">Preparation note'),true,'the session note is a quiet line with the session');
  programs[0].announcementUntil=new Date('2026-09-20T12:00:00Z');html=await dashboardHtml();
  check(html.includes('Schedule update'),false,'an Update past its clear-by day clears itself');
  programs[0].announcementUntil=new Date('2026-09-21T12:00:00Z');html=await dashboardHtml();
  check(html.includes('Schedule update'),true,'an Update shows through its clear-by day');
  programs[0].announcementUntil=null;html=await dashboardHtml();
  check(html.includes('From your teams'),false,'home has no message feed');
  check(registrationQueries.every(q=>q.where.status.notIn.includes('PENDING_PAYMENT')&&q.where.status.notIn.includes('CANCELLED')),true,'held and cancelled registrations remain excluded');
  now='2026-09-21T15:35:00Z';
  html=await dashboardHtml();
  check(html.includes('Join on Zoom'),false,'members cannot join during host-only setup');
  check(html.includes('Opens at'),true,'later session explains availability');
  assignments=[{programSlug:'morning',sessionDate:new Date('2026-09-21T16:00:00Z'),hubSlug:'host-team'}];
  html=await dashboardHtml();check(html.includes('Enter Zoom as host'),true,'host early-entry preserved');
  // A greeter or AV sign-up is not hosting (2026-10-15): no early entry from another team.
  assignments=[{programSlug:'morning',sessionDate:new Date('2026-09-21T16:00:00Z'),hubSlug:'greeter'}];
  html=await dashboardHtml();check(html.includes('Enter Zoom as host'),false,'a greeter sign-up does not open the room early');
  check(html.includes('Opens at'),true,'a greeter sees the session as a member does (opens at the member time)');
  // My Home names the duty in the team's words (Jesse, 2026-10-16), and links Today's list (2026-10-24).
  check(html.includes('re greeting'),true,'a greeter sees their duty in Today');
  check(html.includes('/account/greeting/morning?date='),true,"a greeter's duty line links Today's list");
  assignments=[];now='2026-09-21T15:55:00Z';
  programs[0].category.kind='CLASS';programs[0].registrationEnabled=true;
  html=await dashboardHtml();check(html.includes('Join on Zoom'),false,'registration-required offering hidden from nonregistrant');
  registrations=[{id:'r1',programSlug:'morning',programTitle:'Morning practice',donationStatus:'WAIVED',program:{...programs[0]}}];
  html=await dashboardHtml();check(html.includes('Join on Zoom'),true,'registered participant retains entry');
  // Open entry (program-categories brief): access is the program's own setting. Category and Format are labels and never decide it.
  registrations=[];
  programs[0].offeringCategory='IMMERSION';programs[0].offeringFormat='COURSE';programs[0].openEntry=true;
  html=await dashboardHtml();check(html.includes('Join on Zoom'),true,'Open entry on admits a non-registrant, whatever the Category and Format');
  programs[0].offeringCategory='ONGOING_LEARNING_PRACTICE';programs[0].offeringFormat='DROP_IN';programs[0].openEntry=false;programs[0].registrationEnabled=false;
  html=await dashboardHtml();check(html.includes('Join on Zoom'),false,'A Drop-in with Open entry off is not open to a non-registrant');
  programs[0].offeringCategory='COMMUNITY_GROUP';programs[0].offeringFormat=null;
  html=await dashboardHtml();check(html.includes('Join on Zoom'),false,'A Community Group with registration off is not open unless Open entry is on');
  programs[0].openEntry=true;programs[0].registrationEnabled=true;
  html=await dashboardHtml();check(html.includes('Join on Zoom'),true,'Open entry and registration together: still open');
  programs[0].offeringCategory='SPECIAL_EVENT';
  html=await dashboardHtml();check(html.includes('Join on Zoom'),true,'Open entry is available to any Category, a Special Event included');
  programs[0].openEntry=null;programs[0].category.kind='CLASS';
  html=await dashboardHtml();check(html.includes('Join on Zoom'),false,'Open entry still empty: the old category kind decides, as before');
  // Outside rooms (2026-10-14): Join still goes through RIM's door; the label
  // names the room's service, and an outside room gives hosts no Zoom code.
  programs[0].openEntry=true;programs[0].registrationEnabled=false;programs[0].outsideMeetingUrl='https://meet.google.com/abc-defg-hij';
  html=await dashboardHtml();
  check(html.includes('Join on Google Meet'),true,'an outside Google Meet room says so on My Home');
  check(html.includes('/session/morning/enter'),true,'an outside room still joins through the door');
  check(html.includes('https://meet.google.com'),false,'My Home never prints the outside link');
  programs[0].outsideMeetingUrl='https://example.org/room/7';
  html=await dashboardHtml();check(html.includes('Join online'),true,'an unnamed service reads Join online');
  programs[0].outsideMeetingUrl=null;
  const outside = load('lib/outsideMeeting.ts');
  check(outside.cleanOutsideMeetingUrl('').ok && outside.cleanOutsideMeetingUrl('').value,null,'empty link means RIM\'s Zoom');
  check(outside.cleanOutsideMeetingUrl('  https://us06web.zoom.us/j/123?pwd=x  ').value,'https://us06web.zoom.us/j/123?pwd=x','a pasted Zoom link is trimmed and kept');
  for (const bad of ['http://zoom.us/j/1','javascript:alert(1)','zoom.us/j/1','https://zoom.us/j/1 extra','https://user:pw@zoom.us/j/1','https://localhost/x',42]) check(outside.cleanOutsideMeetingUrl(bad).ok,false,`reject unsafe link ${bad}`);
  check(outside.providerForUrl('https://us06web.zoom.us/j/1'),'zoom','zoom subdomain');
  check(outside.providerForUrl('https://notzoom.us/j/1'),'other','a lookalike domain is not Zoom');
  check(outside.outsideRoomUrl({programFormat:'in-person',outsideMeetingUrl:'https://zoom.us/j/1'}),null,'an in-person program has no outside room');
  check(outside.joinOnlineLabel({programFormat:'virtual',outsideMeetingUrl:null}),'Join on Zoom','RIM\'s own room is Zoom');
  programs=[];registrations=[];
  html=await dashboardHtml();check(html.includes('There are no more sessions today.'),true,'empty day has clear state');
  // 2026-10-20: Coming up and the upcoming view are removed (backlog
  // 2026-10-20-004). Registrations still place today's in-person sessions in Today.
  const rp={endDatetime:null,recurrenceFreq:null,recurrenceInterval:null,recurrenceDays:[],recurrenceCount:null,outsideMeetingUrl:null,earlyArrivalMessage:null,specialAnnouncement:null,announcementUntil:null};
  registrations=[
    {id:'r1',programTitle:'Hall sit',programSlug:'hall-sit',status:'REGISTERED',program:{...rp,programFormat:'in-person',startDatetime:new Date('2026-09-21T18:00:00Z'),endDatetime:new Date('2026-09-21T19:00:00Z')}},
    {id:'r2',programTitle:'Later course',programSlug:'later-course',status:'REGISTERED',program:{...rp,programFormat:'virtual',startDatetime:new Date('2026-10-26T14:30:00Z')}},
  ];
  html=await dashboardHtml();
  check(html.includes('Hall sit'),true,'a registered in-person session today is in Today');
  check(html.includes('Later course')||html.includes('Coming up'),false,'Coming up is gone from My Home');
  check(html.includes('All upcoming programs'),false,'the link to the upcoming view is gone');
  html=await dashboardHtml({view:'upcoming'});
  check(html.includes('Your upcoming programs')||html.includes('Later course'),false,'the old upcoming address shows My Home');
  registrations=[];
  check(html.includes('Cancel registration'),false,'self-cancellation remains removed');

  // Every-other-week rotations (2026-10-18): turns counted from the first
  // date, through five-Thursday months, the Nov 1 time change and the new
  // year. Jessica from Oct 22 and Lorri the weeks between, as they do it.
  const sched = load('lib/scheduleUtils.ts',{'./timezone':load('lib/timezone.ts')});
  const thursdays = ['2026-10-22','2026-10-29','2026-11-05','2026-11-12','2026-11-19','2026-11-26','2026-12-03','2026-12-10','2026-12-17','2026-12-24','2026-12-31','2027-01-07','2027-01-14','2027-04-29','2027-05-06'];
  const turns = thursdays.map((d)=>sched.isCycleWeek('ALT_WEEK_A','2026-10-22',d)?'A':sched.isCycleWeek('ALT_WEEK_B','2026-10-22',d)?'B':'-');
  check(turns.join(''),'ABABABABABABABA','every other week alternates week by week across months and years');
  check(sched.isCycleWeek('ALT_WEEK_A','2026-10-22','2026-10-15'),false,'no turn before the cycle starts');
  check(sched.isCycleWeek('ALT_WEEK_B','2026-10-22','2026-10-15'),false,'the second person has no turn before it starts either');
  check(sched.isCycleWeek('ALL','2026-10-22','2026-10-22'),false,'only the cycle patterns use cycle weeks');
  check(sched.isCycleWeek('ALT_WEEK_A',null,'2026-10-22'),false,'a cycle needs its first date');
  check(sched.isCycleOccurrence('ALT_WEEK_B') && !sched.isCycleOccurrence('FIFTH'),true,'cycle patterns are recognised');

  // Notifications by type and team (2026-10-20). Every kind of notice the code
  // records has a type, so nothing is reachable only under Everything.
  const noticeHubs=[{userId:'member-a',hub:{slug:'host-team',name:'Hosting Team',status:'ACTIVE'}},{userId:'member-a',hub:{slug:'greeter',name:'Greeters',status:'ACTIVE'}},{userId:'member-a',hub:{slug:'closed',name:'Closed Team',status:'ARCHIVED'}},{userId:'member-a',status:'INACTIVE',hub:{slug:'left',name:'Left Team',status:'ACTIVE'}}];
  let noticeRows=[];
  const matches=(row,where)=>Object.entries(where).every(([k,v])=>{
    if(k==='AND') return v.every(w=>matches(row,w));
    if(k==='OR') return v.some(w=>matches(row,w));
    if(v&&typeof v==='object'&&'startsWith' in v) return String(row[k]).startsWith(v.startsWith);
    return row[k]===v;
  });
  const groupBy=({by,where})=>{const out=new Map();for(const r of noticeRows.filter(r=>matches(r,where))){const key=by.map(b=>r[b]).join('|');const g=out.get(key)??{...Object.fromEntries(by.map(b=>[b,r[b]])),_count:{_all:0}};g._count._all++;out.set(key,g);}return [...out.values()];};
  const notices=load('lib/notifications.ts',{'@/lib/db':{db:{
    hubMember:{findMany:async q=>noticeHubs.filter(m=>m.userId===q.where.userId&&m.hub.status===q.where.hub.status&&(m.status??'ACTIVE')!==q.where.status.not)},
    notification:{groupBy:async q=>groupBy(q)},
  }}});
  const plain=v=>JSON.parse(JSON.stringify(v));
  const recorded=new Set();
  const walk=dir=>{for(const f of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.join(dir,f.name);if(f.isDirectory())walk(rel);else if(/\.tsx?$/.test(f.name))for(const m of fs.readFileSync(path.join(root,rel),'utf8').matchAll(/kind:\s*"([a-z0-9-]+)",\s*category:/g))recorded.add(m[1]);}};
  walk('lib');walk('app');
  check(recorded.size>=25,true,'the notice kinds are found in the code');
  check([...recorded].filter(k=>notices.noticeTypeOf(k)===null),[],'every notice kind has a type');
  check(notices.noticeTypeOf('coverage-session-reminder'),'schedule','a coverage reminder is Schedule');
  check(notices.noticeTypeOf('session-reminder'),'programs','a program reminder is Programs');
  let facets=await notices.listNoticeFacets({userId:'member-a'});
  check(plain(facets.sources.map(f=>f.label)),['Greeters','Hosting Team'],'From lists every team before any notice arrives, and no archived team or one they are inactive on');
  check(plain(facets.types.map(f=>f.label)),['Schedule','Conversations','Files','Programs','Your account'],'the types, in order');
  const n=(id,sourceKey,sourceLabel,kind,readAt=null)=>({id,userId:'member-a',sourceKey,sourceLabel,kind,readAt});
  noticeRows=[
    n('1','team:host-team','Hosting Team','coverage-gap-opened'),
    n('2','team:host-team','Hosting Team','hub-conv-new-reply'),
    n('3','team:greeter','Greeters','coverage-gap-opened'),
    n('4','programs','Programs','registration-confirmation'),
    n('5','team:old-team','Old Team','file-shared'),
    n('6','team:host-team','Hosting Team','coverage-lookahead',new Date()),
  ];
  facets=await notices.listNoticeFacets({userId:'member-a'});
  check(facets.unread,5,'Unread counts every unread notice');
  check(facets.sources.find(f=>f.key==='team:old-team')?.label,'Old Team','a team left behind keeps its notices reachable');
  check(facets.types.find(f=>f.key==='schedule').unread,2,'Schedule counts across teams');
  facets=await notices.listNoticeFacets({userId:'member-a',source:'team:host-team'});
  check([facets.unread,facets.types.find(f=>f.key==='schedule').unread],[2,1],'types count within the chosen team');
  facets=await notices.listNoticeFacets({userId:'member-a',type:'schedule'});
  check(plain(facets.sources.map(f=>[f.label,f.unread])),[['Greeters',1],['Hosting Team',1],['Old Team',0]],'teams count within the chosen type');

  // "Opens on" (2026-10-24): one rule for whether a program takes sign-ups.
  const win = load('lib/registrationWindow.ts');
  const at = new Date('2026-10-24T15:00:00Z');
  const p = (o) => ({ registrationEnabled: true, registrationClosed: false, registrationDeadline: null, registrationOpensAt: null, ...o });
  check(win.registrationWindow(p({ registrationEnabled: false, registrationOpensAt: '2026-11-01T14:00:00Z' }), at), 'off', 'off stays off, whatever the opening date');
  check(win.registrationWindow(p({}), at), 'open', 'on with no dates is open');
  check(win.registrationWindow(p({ registrationOpensAt: '2026-11-01T14:00:00Z' }), at), 'notYet', 'an opening date ahead is not open yet');
  check(win.registrationWindow(p({ registrationOpensAt: '2026-10-24T14:59:00Z' }), at), 'open', 'an opening date passed is open');
  check(win.registrationWindow(p({ registrationClosed: true, registrationOpensAt: '2026-11-01T14:00:00Z' }), at), 'closed', 'closed by hand wins over an opening date');
  check(win.registrationWindow(p({ registrationDeadline: '2026-10-20T00:00:00Z' }), at), 'closed', 'a passed closing date closes it');
  const where = JSON.parse(JSON.stringify(win.takingRegistrationsWhere(at)));
  check([where.registrationEnabled, where.registrationClosed, where.AND.length], [true, false, 2], 'the Prisma filter asks the same: on, not closed, deadline and opening date');
  check(win.fmtOpensAt('2026-11-01T14:00:00Z', at), 'Sunday, November 1 at 8:00 AM', 'opening time in Central, after the November time change');

  // Answers by question id, old answers by wording kept (2026-10-24, Phase 3 slice 1).
  const ans = load('lib/registrationAnswers.ts');
  const qs = [{ _key: 'q_diet', label: 'Dietary needs?' }, { label: 'Need a ride?' }];
  const old = { 'Dietary needs?': 'Vegetarian', 'Need a ride?': 'Yes', 'T-shirt size': 'M' };
  check(ans.answerFor(old, qs[0]), 'Vegetarian', 'an answer stored by wording is still read');
  check(ans.answerFor({ q_diet: 'Vegan', 'Dietary needs?': 'Vegetarian' }, qs[0]), 'Vegan', 'the id wins over the wording');
  check(ans.answerFor({ q_diet: '', 'Dietary needs?': 'Vegetarian' }, qs[0]), '', 'a cleared answer by id stays cleared');
  check(ans.answerFor({ 'Dietary needs?': 'Vegetarian' }, { _key: 'q_diet', label: 'Any dietary needs?' }), '', 'a reworded question with no id answer reads empty');
  check(plain(ans.oldAnswers(old, qs)), [{ key: 'T-shirt size', label: 'T-shirt size', value: 'M' }], 'an answer no question has is kept as an old answer');
  check(plain(ans.oldAnswers({ q_gone: 'x', _labels: { q_gone: 'Gone question?' } }, qs)), [{ key: 'q_gone', label: 'Gone question?', value: 'x' }], 'a removed question shows its wording, never its id');
  check(plain(ans.answersForNewRegistration({ q_diet: ' Vegan ', 'Need a ride?': 'No', 'Hacked': 'x', other: '' }, qs)), { q_diet: 'Vegan', 'Need a ride?': 'No', _labels: { q_diet: 'Dietary needs?' } }, 'a new registration keeps only its questions, by id with its wording (wording alone without an id)');
  check(plain(ans.answersForNewRegistration({ 'Dietary needs?': 'Vegan' }, qs)), { q_diet: 'Vegan', _labels: { q_diet: 'Dietary needs?' } }, 'an older form sending wording is stored by id');
  check(ans.answersForNewRegistration({}, qs), null, 'no answers, nothing stored');
  const merged = plain(ans.mergeAnswers(old, { q_diet: 'Vegan', 'T-shirt size': 'L', 'Hacked': 'x' }, qs));
  check(merged, { 'Dietary needs?': 'Vegetarian', 'Need a ride?': 'Yes', 'T-shirt size': 'L', q_diet: 'Vegan', _labels: { q_diet: 'Dietary needs?' } }, 'merging writes by id with its wording, keeps the old wording answer, may change an old answer, adds nothing else');
  check(plain(ans.mergeAnswers(old, { q_diet: 'Vegetarian', 'Need a ride?': ' Yes', 'T-shirt size': 'M', other: '' }, [...qs, { _key: 'q_new', label: 'New?' }])), old, 'saving with nothing changed leaves the stored answers exactly as they were');
  check(ans.answerFor(merged, qs[0]), 'Vegan', 'after merging, the new answer is the one read');

  // Who's asking (2026-10-24, Phase 3 slice 2).
  const ask = load('lib/questionAskers.ts');
  const ctx = { teacherNames: ['Jesse Foy'], teams: [{ id: 'h1', name: 'Greeter Team' }] };
  check(plain(ask.askerOf(undefined, ctx)), { kind: 'registration' }, 'no asker is the registration team');
  check(plain(ask.askerOf('teacher', ctx)), { kind: 'teacher' }, 'the teacher asks when one is linked');
  check(plain(ask.askerOf('teacher', { teacherNames: [], teams: [] })), { kind: 'registration' }, 'no teacher linked: the registration team');
  check(plain(ask.askerOf('team:h1', ctx)), { kind: 'team', hubId: 'h1', name: 'Greeter Team' }, 'a supporting team asks by its id');
  check(plain(ask.askerOf('team:gone', ctx)), { kind: 'registration' }, 'a team no longer on the program: the registration team');
  const flat = ask.groupQuestions([{ label: 'A' }, { label: 'B', askedBy: 'team:gone' }], ctx);
  check(flat.showHeadings, false, 'only the registration team asking: the form looks as it always has');
  const grouped = ask.groupQuestions([{ label: 'A' }, { label: 'B', askedBy: 'team:h1' }, { label: 'C', askedBy: 'teacher' }, { label: 'D' }], ctx);
  check(grouped.showHeadings, true, 'more than one asker: headings show');
  check(plain(grouped.groups.map((g) => [g.heading, g.questions.map((q) => q.index)])), [['For the registration team', [0, 3]], ['For the Greeter Team', [1]], ['From Jesse Foy, your teacher', [2]]], 'groups in order of first appearance, questions in their own order');
  check(plain(ask.withAskers([{ label: 'A', askedBy: 'team:h1' }, { label: 'B', askedBy: 'team:gone' }, { label: 'C', askedBy: 'teacher' }, { label: 'D', askedBy: 'registration' }], new Set(['h1']))), [{ label: 'A', askedBy: 'team:h1' }, { label: 'B' }, { label: 'C', askedBy: 'teacher' }, { label: 'D' }], 'saving keeps a teacher or a team on the program, and drops anything else');

  check(plain(ask.askersUsedBy([{ label: 'A' }, { label: 'B', askedBy: 'team:h1' }], { teacherNames: ['Jesse Foy'], teams: [{ id: 'h1', name: 'Greeter Team' }, { id: 'h2', name: 'AV Team' }] })), { teacherNames: [], teams: [{ id: 'h1', name: 'Greeter Team' }] }, 'only the askers a question uses reach the browser');

  // "First registration here" (2026-10-24, Phase 3 slice 3): only an earlier place counts.
  const first = load('lib/firstRegistration.ts', { '@/lib/db': { db: {} } });
  const d = (x) => new Date(x);
  const ana = { id: 'r3', userId: 'u1', email: 'ana@x.org', createdAt: d('2026-10-20') };
  const ben = { id: 'r4', userId: null, email: 'Ben@x.org', createdAt: d('2026-10-20') };
  check([...first.firstRegistrationIds([ana, ben], [ana, ben])], ['r3', 'r4'], 'no earlier place: first registration here');
  check([...first.firstRegistrationIds([ana, ben], [ana, ben, { id: 'r1', userId: null, email: 'ben@X.org', createdAt: d('2026-09-01') }])], ['r3'], 'an earlier place under the same address, any capitals, counts');
  check([...first.firstRegistrationIds([ana], [ana, { id: 'r2', userId: 'u1', email: 'old@x.org', createdAt: d('2026-09-01') }])], [], 'an earlier place under the same account counts');
  check([...first.firstRegistrationIds([ana], [ana, { id: 'r9', userId: 'u1', email: 'ana@x.org', createdAt: d('2026-11-01') }])], ['r3'], 'a later place does not count');

  // A supporting team's session page (2026-10-24, Phase 3 slice 4): only a real Central day.
  const tz = load('lib/timezone.ts');
  const sh = load('lib/sessionHelpers.ts', { '@/lib/db': { db: {} }, '@/lib/timezone': tz, '@/lib/hubAuth': {} });
  check([sh.cleanDay('2026-11-01'), sh.cleanDay('2026-11-1'), sh.cleanDay(undefined), sh.cleanDay("2026-11-01' OR 1=1"), sh.cleanDay('2026-02-30')], ['2026-11-01', null, null, null, null], 'the page and the route take only a real YYYY-MM-DD day');

  // Teams that prepare (2026-10-24, Phase 3 slice 5): what the editor sends, read safely.
  const helpers = load('lib/programHelpers.ts', { '@/lib/db': { db: {} } });
  check(plain(helpers.cleanHelperTeams([{ hubId: 'b', canReach: true }, { hubId: 'a' }, { hubId: 'b', canReach: false }])), [{ hubId: 'a', canReach: false }, { hubId: 'b', canReach: true }], 'one per team, sorted, can-reach only when said');
  check([helpers.cleanHelperTeams('x'), helpers.cleanHelperTeams([{ hubId: '' }]), helpers.cleanHelperTeams([null])], [null, null, null], 'anything else is refused');

  // Only the registration roles may change who asks (2026-10-24, slice 5 review).
  const stored = [{ _key: 'q1', label: 'A', askedBy: 'team:h1' }, { _key: 'q2', label: 'B' }];
  check(ask.askersChanged([{ _key: 'q1', label: 'A reworded', askedBy: 'team:h1' }, { _key: 'q2', label: 'B', askedBy: 'registration' }], stored), false, 'rewording or naming the registration team is not a change of asker');
  check(ask.askersChanged([{ _key: 'q2', label: 'B', askedBy: 'team:h1' }], stored), true, 'giving a question to a team is');
  check(ask.askersChanged([{ _key: 'q9', label: 'New', askedBy: 'teacher' }], stored), true, 'a new question with an asker is');
  check(ask.askersChanged([{ _key: 'q9', label: 'New' }], null), false, 'a new question for the registration team is not');

  // Reminders counted from the start (2026-10-24, Phase 4).
  const rs = load('lib/reminderSchedule.ts');
  const prog = (o) => ({ registrationEnabled: true, archivedAt: null, startDatetime: null, reminderDate: null, reminderDaysBefore: null, ...o });
  const nov1 = prog({ startDatetime: '2026-11-01T15:00:00Z', reminderDaysBefore: 2 });
  check(rs.reminderSendsAt(nov1).toISOString(), '2026-10-30T14:00:00.000Z', 'two days before a first session after the November time change: the Central day, morning run');
  check([rs.reminderDueAt(nov1, new Date('2026-10-30T14:00:05Z')), rs.reminderDueAt(nov1, new Date('2026-10-31T14:00:05Z')), rs.reminderDueAt(nov1, new Date('2026-11-01T16:00:00Z'))], [true, true, false], 'due from the send day until the program begins, so late registrants get it');
  check(rs.reminderDueAt(nov1, new Date('2026-10-29T14:00:05Z')), false, 'not before the send day');
  const setDate = prog({ reminderDate: '2026-11-12T01:00:00Z', startDatetime: '2026-11-14T15:00:00Z' });
  check([rs.reminderSendsAt(setDate).toISOString(), rs.reminderDueAt(setDate, new Date('2026-11-12T14:00:05Z')), rs.reminderDueAt(setDate, new Date('2026-11-13T14:00:05Z'))], ['2026-11-12T14:00:00.000Z', true, false], 'an older set date: once, in the run after it, as before');
  check(rs.reminderSendsAt(prog({ ...setDate, reminderDaysBefore: 3 })).toISOString(), '2026-11-11T14:00:00.000Z', 'days before wins over a set date');
  check([rs.reminderSendsAt(prog({ ...nov1, archivedAt: '2026-10-01T00:00:00Z' })), rs.reminderDueAt(prog({ ...nov1, registrationEnabled: false }), new Date('2026-10-31T14:00:05Z'))], [null, false], 'archived or registration off: no reminder');

  const evening = prog({ startDatetime: '2026-11-10T01:00:00Z', reminderDaysBefore: 1 });
  check([rs.reachesLateRegistrants(evening, new Date('2026-11-09T13:00:00Z')), rs.reachesLateRegistrants(evening, new Date('2026-11-09T15:00:00Z'))], [true, false], 'after the last morning run before it begins, a late registrant is left to be sent by hand');

  // The note after a program ends (2026-10-24, Phase 4 slice 2).
  const fu = load('lib/followUp.ts');
  const retreat = { followUpEnabled: true, followUpMessage: '<p>Thank you.</p>', recurrenceFreq: null, startDatetime: '2026-11-13T22:00:00Z', endDatetime: '2026-11-15T19:00:00Z', archivedAt: null };
  check(fu.followUpSendsAt(retreat).toISOString(), '2026-11-16T15:00:00.000Z', 'the morning after the last Central day');
  check([fu.followUpDueAt(retreat, new Date('2026-11-16T15:00:05Z')), fu.followUpDueAt(retreat, new Date('2026-11-18T15:00:05Z')), fu.followUpDueAt(retreat, new Date('2026-11-19T15:00:05Z')), fu.followUpDueAt(retreat, new Date('2026-11-15T15:00:05Z'))], [true, true, false, false], 'that day or the two after, never before or later');
  check(fu.followUpDueAt({ ...retreat, archivedAt: '2026-11-16T09:15:00Z' }, new Date('2026-11-16T15:00:05Z')), true, 'archived the morning after by the nightly job: still sends');
  check(fu.followUpSendsAt({ ...retreat, archivedAt: '2026-11-10T00:00:00Z' }), null, 'archived before it ended (cancelled): no thank-you');
  check([fu.followUpSendsAt({ ...retreat, recurrenceFreq: 'WEEKLY' }), fu.followUpSendsAt({ ...retreat, followUpMessage: '<p></p>' }), fu.followUpSendsAt({ ...retreat, followUpEnabled: false })], [null, null, null], 'repeating, empty, or off: no note');

  // Send an update to the people registered (2026-10-24, Phase 4 slice 3).
  const pu = load('lib/programUpdate.ts');
  const own = (v) => JSON.parse(JSON.stringify(v));
  const was = { startDatetime: '2026-11-05T01:00:00Z', endDatetime: '2026-11-05T02:30:00Z', recurrenceFreq: 'WEEKLY', recurrenceInterval: 1, recurrenceDays: ['TH'], recurrenceCount: null, programFormat: 'in-person', place: 'Rooted In Mindfulness, 123 Main St', confirmationMessage: '<p>Bring a cushion.</p>' };
  check(own(pu.changedForPeople(was, { ...was })), [], 'nothing changed: no update');
  check(own(pu.changedForPeople(was, { ...was, recurrenceDays: ['TH'], recurrenceInterval: null, confirmationMessage: '<p>Bring a cushion.</p>' })), [], 'same days, interval 1 as empty, same words: no update');
  check(own(pu.changedForPeople(was, { ...was, startDatetime: '2026-11-05T01:15:00Z', place: 'The community room', confirmationMessage: '<p>Bring a mat.</p>' })), ['when', 'where', 'told'], 'time, place and message, in order');
  check(own(pu.changedForPeople(was, { ...was, recurrenceDays: ['WE'] })), ['when'], 'a different day is a change of time');
  check(own(pu.changedForPeople({ ...was, programFormat: 'virtual', place: null }, { ...was, programFormat: 'virtual', place: 'Old address' })), [], 'an online program: its leftover address is no change');
  check(own(pu.changedForPeople(was, { ...was, programFormat: 'virtual', place: null })), ['where'], 'moving online is a change of place');
  check(own(pu.updateLines({ ...was, programFormat: 'virtual', dateText: 'Thursdays', timeText: '7:00 – 8:30 PM CT' }, ['when', 'where'], was)), { when: 'When: Thursdays, 7:00 – 8:30 PM CT', where: 'Where: online. You join from the program\u2019s page, by the button below.' }, 'the lines name the program as it now is');
  const draft = pu.composeUpdate('Good Evening', { when: 'When: Thursdays', told: 'Bring a mat.' });
  check([draft.subject, draft.message.split('\n\n').length, draft.message.endsWith('let us know.')], ['A change to Good Evening', 4, true], 'the draft: subject, opening, facts, message, closing');
  check([pu.kindsInWords(['when']), pu.kindsInWords(['when', 'where', 'told'])], ['the time', 'the time, the place and the confirmation message'], 'what changed, in words');
  check(pu.plainText('<p>One &amp; two</p><ul><li>Cushion</li></ul>'), 'One & two\n- Cushion', 'the message as plain lines');
  check(pu.changedForPeople(was, { ...was, confirmationMessage: '<p><a href="https://maps.example/new">Directions</a></p>' }).length > 0 && pu.plainText('<p><a href="https://maps.example/new">Directions</a></p>'), 'Directions: https://maps.example/new', 'a link is kept, and a new link is a change');
  const nowAt = new Date('2026-10-25T12:00:00Z');
  check(own(pu.updateLines({ ...was, startDatetime: '2026-11-13T01:00:00Z', dateText: 'Thursdays', timeText: '7:00 PM' }, ['when'], was, nowAt)), { when: 'When: Thursdays, 7:00 PM, starting Thursday, November 12' }, 'a repeating program that moved says its first session');
  check(own(pu.updateLines({ ...was, recurrenceCount: 6, dateText: 'Thursdays', timeText: '7:00 PM' }, ['when'], was, nowAt)), { when: 'When: Thursdays, 7:00 PM, 6 sessions' }, 'and a new number of sessions');
  check(own(pu.updateLines({ ...was, startDatetime: '2026-10-02T00:00:00Z', dateText: 'Thursdays', timeText: '7:00 PM' }, ['when'], was, nowAt)), { when: 'When: Thursdays, 7:00 PM' }, 'a first session already past is not announced');
  check(pu.MESSAGE_MAX_PEOPLE, 50, 'the most sent from here');

  // Start from a shape (2026-10-24, Phase 4 slice 4).
  const ps = load('lib/programShapes.ts');
  const shapeTeams = { prepTeams: [{ id: 'k1', slug: 'kitchen-team', name: 'Kitchen Team' }], canDecideAskers: true };
  const fmtCodes = ['DROP_IN', 'CLASS', 'COURSE', 'WORKSHOP', 'DAY_OF_MINDFULNESS', 'RETREAT'];
  check(own(ps.SHAPES.map((x) => x.code)), fmtCodes, 'one shape for each Format, in order');
  check(fmtCodes.every((c) => ps.shapeStart(c, shapeTeams).offeringFormat === c), true, 'each shape sets its own Format');
  const drop = ps.shapeStart('DROP_IN', shapeTeams);
  check([drop.openEntry, drop.registrationEnabled, drop.reminderDaysBefore, drop.registrationFields.length], [true, false, '', 0], 'a drop-in: open entry, no registration, no reminder, no questions');
  const shRetreat = ps.shapeStart('RETREAT', shapeTeams);
  check(own(shRetreat.registrationFields.map((q) => q.askedBy ?? 'registration')), ['teacher', 'teacher', 'registration', 'team:k1', 'team:k1'], 'a retreat: the teacher and the meals team ask theirs');
  check([own(shRetreat.coverageHubSlugs), own(shRetreat.helperTeams), shRetreat.followUpEnabled, shRetreat.reminderDaysBefore], [[], [{ hubId: 'k1', canReach: false }], false, '2'], 'the meals team (no contact details), no scheduled team (that emails it), no note without words, a reminder 2 days before');
  const bare = ps.shapeStart('RETREAT', { prepTeams: [], canDecideAskers: true });
  check([own(bare.coverageHubSlugs), own(bare.helperTeams), own(bare.registrationFields.map((q) => q.askedBy ?? 'registration'))], [[], [], ['teacher', 'teacher', 'registration', 'registration', 'registration']], 'no team there to tick: the registration team asks');
  const noRole = ps.shapeStart('RETREAT', { ...shapeTeams, canDecideAskers: false });
  check([own(noRole.helperTeams), noRole.registrationFields.every((q) => !('askedBy' in q)), own(noRole.coverageHubSlugs)], [[], true, []], 'without the registration roles: every question the registration team\'s, no team preparing');
  check([ps.isShapeCode('COURSE'), ps.isShapeCode('blank'), ps.isShapeCode(undefined)], [true, false, false], 'a shape by its code only');

  // Copy a program (2026-10-24, Phase 4 slice 5).
  const pc = load('lib/programCopy.ts');
  check([pc.freeSlug('fall-retreat', new Set(['fall-retreat'])), pc.freeSlug('fall-retreat-2', new Set(['fall-retreat', 'fall-retreat-2', 'fall-retreat-3'])), pc.freeSlug('winter-retreat-2025', new Set(['winter-retreat-2025']))], ['fall-retreat-2', 'fall-retreat-4', 'winter-retreat-2025-2'], 'the first free address; a year stays');
  const src = {
    id: 'p1', slug: 'fall-retreat', name: 'Fall Retreat', description: '<p>Words</p>', confirmationMessage: '<p>Bring a cushion.</p>',
    startDatetime: '2025-11-14T17:00', endDatetime: '2025-11-16T13:00', dateText: 'Friday, November 14', timeText: '5:00 PM',
    registrationEnabled: true, registrationClosed: true, registrationCapacity: '14', registrationDeadline: '2025-11-10T12:00', registrationOpensAt: '2025-09-01T09:00',
    registrationFields: [{ _key: 'q1', askedBy: 'teacher', label: 'Practice?', fieldType: 'shortText', required: false, options: [] }, { _key: 'q2', askedBy: 'team:k1', label: 'Diet?', fieldType: 'shortText', required: false, options: [] }],
    reminderDate: '2025-11-12T09:00', reminderDaysBefore: '', specialAnnouncement: 'Cancelled', announcementUntil: '2025-11-14', dashboardShowAt: '2025-11-01T00:00',
    guestAccessKey: 'abc123', isOpenAccess: true, flodeskSegmentId: 'seg', flodeskSegmentName: 'Fall', archived: true, danaMode: 'base_plus_dana', danaBaseAmount: '150',
    helperTeams: [{ hubId: 'k1', canReach: false }], coverageHubSlugs: ['greeter'], programTeachers: [{ id: 'u1', firstName: 'A', lastName: 'B' }],
  };
  const cp = pc.copyForNew(src, { slug: 'fall-retreat-2', canDecideAskers: true });
  check([cp.id, cp.slug, cp.startDatetime, cp.endDatetime, cp.dateText, cp.registrationClosed, cp.registrationDeadline, cp.registrationOpensAt, cp.reminderDate, cp.specialAnnouncement, cp.announcementUntil, cp.dashboardShowAt, cp.guestAccessKey, cp.flodeskSegmentId, cp.archived],
    [undefined, 'fall-retreat-2', '', '', '', false, '', '', '', '', '', '', '', null, false], 'never kept: address, dates, closed, deadlines, opening, reminder date, notice, show-from, guest link, segment, archived');
  check([cp.name, cp.description, cp.confirmationMessage, cp.registrationCapacity, cp.danaMode, cp.danaBaseAmount, cp.isOpenAccess, own(cp.helperTeams), own(cp.coverageHubSlugs), cp.programTeachers.length],
    ['Fall Retreat', '<p>Words</p>', '<p>Bring a cushion.</p>', '14', 'base_plus_dana', '150', true, [{ hubId: 'k1', canReach: false }], ['greeter'], 1], 'kept: words, places, dana, settings, helpers, teachers');
  check([own(cp.registrationFields.map((q) => ['_key' in q, q.askedBy])), cp.reminderDaysBefore], [[[false, 'teacher'], [false, 'team:k1']], '2'], 'questions get new ids and keep who asks; a set reminder date becomes 2 days before');
  const cpNoRole = pc.copyForNew(src, { slug: 'fall-retreat-2', canDecideAskers: false });
  check([cpNoRole.registrationFields.every((q) => !('askedBy' in q)), own(cpNoRole.helperTeams)], [true, []], 'without the registration roles: the registration team asks, no team prepares');
  check([pc.copyForNew({ ...src, removeFromProgramList: true }, { slug: 'x', canDecideAskers: true }).removeFromProgramList, pc.copyForNew({ ...src, removeFromProgramList: true, dashboardShowAt: '' }, { slug: 'x', canDecideAskers: true }).removeFromProgramList], [false, true], 'hidden until a date starts shown; hidden for good stays hidden');
  check(src.slug === 'fall-retreat' && src.registrationFields[0]._key === 'q1', true, 'the original is left as it was');

  // The next morning that sends a reminder (a trial, 2026-10-25: a program
  // made after its first send day was said to have been reminded).
  const rsx = load('lib/reminderSchedule.ts');
  const trial = { registrationEnabled: true, archivedAt: null, startDatetime: '2026-10-26T15:00:00Z', reminderDate: null, reminderDaysBefore: 2 };
  check(rsx.nextReminderRun(trial, new Date('2026-10-25T22:00:00Z')).toISOString(), '2026-10-26T14:00:00.000Z', 'made after its first day: the next morning, before it begins');
  check(rsx.nextReminderRun(trial, new Date('2026-10-23T12:00:00Z')).toISOString(), '2026-10-24T14:00:00.000Z', 'before its first day: that day');
  check(rsx.nextReminderRun(trial, new Date('2026-10-26T14:30:00Z')), null, 'no morning left before it begins: none');
  check(rsx.nextReminderRun({ ...trial, reminderDaysBefore: null, reminderDate: '2026-10-24T14:00:00Z' }, new Date('2026-10-25T22:00:00Z')), null, 'a set date past: none (it sends once)');

  // Contact details close 30 days after a program ends (Jesse, 2026-10-26).
  const cw = load('lib/contactWindow.ts');
  const oneDay = { startDatetime: '2026-11-14T16:00:00Z', endDatetime: '2026-11-14T22:00:00Z', recurrenceFreq: null, archivedAt: null };
  check(cw.contactsCloseAt(oneDay).toISOString(), '2026-12-14T22:00:00.000Z', 'a one-time program: 30 days after its last day');
  check([cw.contactsClosed(oneDay, new Date('2026-12-14T21:00:00Z')), cw.contactsClosed(oneDay, new Date('2026-12-14T23:00:00Z'))], [false, true], 'open until then, closed after');
  check(cw.contactsCloseAt({ ...oneDay, archivedAt: '2026-11-01T12:00:00Z' }).toISOString(), '2026-12-01T12:00:00.000Z', 'cancelled (archived first): 30 days after that');
  check(cw.contactsCloseAt({ ...oneDay, recurrenceFreq: 'WEEKLY' }), null, 'a repeating program, not archived: still open');
  check(cw.contactsCloseAt({ ...oneDay, recurrenceFreq: 'WEEKLY', archivedAt: '2027-01-10T12:00:00Z' }).toISOString(), '2027-02-09T12:00:00.000Z', 'a repeating program: 30 days after it is archived');

  console.log(`Passed ${assertions} member-redesign checks (isolated, no external writes).`);
})().catch(error=>{console.error(error);process.exit(1)});
