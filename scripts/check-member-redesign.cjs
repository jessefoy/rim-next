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
  // Render the real dashboard under a fixed clock with fixture records.
  // Timing and offering-kind helpers are production code, not test copies.
  let now = '2026-09-21T15:55:00Z';
  TestDate = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new Date(now).getTime(); } };
  session = {user:{id:'member-a',name:'Member',roles:[]}};
  let programs = [{id:'p1',slug:'morning',name:'Morning practice',programFormat:'virtual',startDatetime:new Date('2026-09-21T16:00:00Z'),endDatetime:new Date('2026-09-21T17:00:00Z'),recurrenceFreq:null,recurrenceInterval:null,recurrenceDays:[],recurrenceCount:null,registrationEnabled:false,category:{kind:'DROP_IN'},earlyArrivalMessage:'Preparation note',specialAnnouncement:'Schedule update'}];
  let assignments = [], registrations = [];
  const registrationQueries = [];
  const Dashboard = load('app/account/(authenticated)/dashboard/page.tsx', {
    '@/auth':{auth:async()=>session},'next/navigation':{redirect:()=>{throw Error('redirect')}},
    'next/link':{default:({children,href,...props})=>React.createElement('a',{href,...props},children),__esModule:true},
    '@/lib/db':{db:{
      program:{findMany:async()=>programs},
      registration:{findMany:async query=>{registrationQueries.push(query);return registrations}},
      hubMember:{findMany:async()=>[]},
      hostAssignment:{findMany:async()=>assignments},programTeacher:{findMany:async()=>[]},
      user:{findUnique:async()=>({hostWelcomeSeenAt:new Date()})},
    }},
    '@/lib/scheduleUtils':load('lib/scheduleUtils.ts'),
    '@/lib/programKind':load('lib/programKind.ts'),
    '@/lib/programHub':{getHubCoverageCopy:async()=>({noun:'Host'})},
    '@/lib/sessionWindowConstants':load('lib/sessionWindowConstants.ts'),
    '@/components/AccountLayout':{default:({children})=>children,__esModule:true},
    '@/components/DashboardAutoRefresh':{default:()=>null,__esModule:true},
    '@/components/HostWelcomePanel':{default:()=>null,__esModule:true},
  }).default;
  const dashboardHtml = async query=>renderToStaticMarkup(await Dashboard({searchParams:Promise.resolve(query??{})}));
  let html = await dashboardHtml();
  check(html.includes('Join on Zoom'),true,'regular join window retained');
  check(html.includes('/session/morning/enter'),true,'Zoom handoff unchanged');
  check(html.includes('Preparation note'),true,'preparation reaches member home');
  check(html.includes('Schedule update'),true,'important update reaches member home');
  check(html.includes('<summary>Good to know</summary>'),true,'routine preparation is a disclosure');
  check(html.includes('From your teams'),false,'home has no message feed');
  check(registrationQueries.every(q=>q.where.status.notIn.includes('PENDING_PAYMENT')&&q.where.status.notIn.includes('CANCELLED')),true,'held and cancelled registrations remain excluded');
  now='2026-09-21T15:35:00Z';
  html=await dashboardHtml();
  check(html.includes('Join on Zoom'),false,'members cannot join during host-only setup');
  check(html.includes('Zoom opens at'),true,'later session explains availability');
  assignments=[{programSlug:'morning',sessionDate:new Date('2026-09-21T16:00:00Z')}];
  html=await dashboardHtml();check(html.includes('Enter Zoom as host'),true,'host early-entry preserved');
  assignments=[];now='2026-09-21T15:55:00Z';
  programs[0].category.kind='CLASS';programs[0].registrationEnabled=true;
  html=await dashboardHtml();check(html.includes('Join on Zoom'),false,'registration-required offering hidden from nonregistrant');
  registrations=[{id:'r1',programSlug:'morning',programTitle:'Morning practice',donationStatus:'WAIVED',program:{...programs[0]}}];
  html=await dashboardHtml();check(html.includes('Join on Zoom'),true,'registered participant retains entry');
  programs=[];registrations=[];
  html=await dashboardHtml();check(html.includes('There are no more sessions today.'),true,'empty day has clear state');
  html=await dashboardHtml({view:'upcoming'});check(html.includes('Your upcoming programs'),true,'separate upcoming view remains reachable');
  check(html.includes('Cancel registration'),false,'self-cancellation remains removed');

  console.log(`Passed ${assertions} member-redesign checks (isolated, no external writes).`);
})().catch(error=>{console.error(error);process.exit(1)});
