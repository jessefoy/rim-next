/* Offline regression checks. All mail, subscriber, auth and database calls are mocked. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
function loader(mocks = {}) {
  const cache = {};
  function load(relative) {
    const file = path.join(root, relative);
    if (cache[file]) return cache[file].exports;
    const m = new Module(file, module);
    cache[file] = m; m.filename = file; m.paths = Module._nodeModulePaths(root);
    m.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'next/navigation') return { useRouter: () => ({ push() {} }) };
      if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (id.startsWith('@/')) {
        const stem = id.slice(2);
        if (stem.endsWith('.json')) return req('./' + stem);
        return load(stem + (fs.existsSync(path.join(root, stem + '.ts')) ? '.ts' : '.tsx'));
      }
      return req(id);
    };
    m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
    return m.exports;
  }
  return load;
}
const load = loader();
const { authReturnPath, authCallbackPath, authReturnFromCallback } = load('lib/authReturn.ts');
const destination = '/programs/awakening-to-the-beauty-of-this-moment/register';
const callback = authCallbackPath(destination);
for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/programs/a?next=x', '/programs/../admin', '/api/auth/signout', '/programs/%2f%2fevil.test', undefined, ['/programs/foo']]) assert.equal(authReturnPath(value), '/account/dashboard');
assert.equal(authReturnPath(destination), destination);
assert.equal(authReturnPath('/kalyana-mitta/kalyana-mitta-group-application'), '/kalyana-mitta/kalyana-mitta-group-application');
assert.equal(authReturnFromCallback('https://rim-next.vercel.app' + callback), destination);
assert.equal(authReturnFromCallback('/account/return?to=https://evil.test'), '/account/dashboard');
assert.equal(authReturnFromCallback('https://evil.test/steal'), '/account/dashboard');
const { centralMinute, nextScheduledStart } = load('lib/nextScheduledStart.ts');
const morning = { id: 'morning', startDatetime: new Date('2026-07-01T11:30:00Z') };
const evening = { id: 'evening', startDatetime: new Date('2026-07-01T23:30:00Z') };
const groups = [{ dateStr: '2026-11-02', programs: [evening, morning, { id: 'unscheduled', startDatetime: null }] }];
assert.equal(centralMinute(morning.startDatetime), 390);
assert.equal(nextScheduledStart(groups, new Date('2026-11-02T12:29:00Z')).program.id, 'morning');
assert.equal(nextScheduledStart(groups, new Date('2026-11-02T12:30:00Z')).program.id, 'evening');
assert.equal(nextScheduledStart(groups, new Date('2026-11-03T02:00:00Z')), null);
const { programGivingSummary, requiredDanaCents, resolveDanaCharge, participationLabel, programLocationLabel } = load('lib/programUtils.ts');
const voluntary = { danaMode: 'voluntary', suggestedDana: 175, danaFixedAmount: null, danaBaseAmount: null };
assert.equal(requiredDanaCents(voluntary), 0);
assert.match(programGivingSummary(voluntary), /Voluntary.*\$175.*no required amount/);
assert.deepEqual(resolveDanaCharge(voluntary, 2500), { ok: true, totalCents: 2500, feeCents: 0, giftCents: 2500 });
assert.equal(requiredDanaCents({ ...voluntary, danaMode: 'fixed', danaFixedAmount: 175 }), 17500);
assert.match(participationLabel({ category: { kind: 'DROP_IN' }, registrationEnabled: true }), /Drop-in.*available/);
assert.equal(participationLabel({ category: { kind: 'COMMUNITY_GROUP' }, registrationEnabled: true }), 'Registration required');
assert.equal(programLocationLabel({ programFormat: 'in-person', venue: 'other', locationText: 'Menomonee Park' }), 'Menomonee Park');
const fields = [ { label: 'Dietary needs', fieldType: 'shortText', required: false }, { label: 'Access requests', fieldType: 'longText', required: false }, { label: 'Attend', fieldType: 'yesNo', required: true }, { label: 'Option', fieldType: 'select', required: true, options: ['One', 'Two'] } ];
const Registration = load('components/RegistrationForm.tsx').default;
const Update = load('components/UpdateForm.tsx').default;
const Footer = load('components/Footer.tsx').default;
for (const [name, element] of [
  ['registration', React.createElement(Registration, { program: { _id: 'fixture', slug: { current: 'fixture' }, name: 'Fixture', registrationFields: fields, danaMode: 'none' }, spotsRemaining: null })],
  ['update', React.createElement(Update, { token: 'fixture', fields, currentCustomFields: { 'Dietary needs': 'vegetarian', 'Access requests': 'chair', 'Attend': 'Yes', 'Option': 'Two', 'Removed question': 'preserved' } })],
  ['footer', React.createElement(Footer)],
  ['two-updates', React.createElement(React.Fragment, null, ...[1,2].map(n => React.createElement(Update, { key: n, token: 'fixture', fields, currentCustomFields: {} })))],
]) {
  const html = renderToStaticMarkup(element);
  const ids = [...html.matchAll(/\bid="([^"]*)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, `${name}: duplicate ID`);
  for (const match of html.matchAll(/\bfor="([^"]*)"/g)) assert(ids.includes(match[1]), `${name}: orphan label`);
  assert(!html.includes('reg-custom-undefined'));
  if (name === 'registration') { assert(!html.includes('novalidate')); for (let i = 0; i < 4; i++) assert(html.includes(`-custom-${i}`)); }
  if (name === 'update') for (const text of ['vegetarian', 'chair', 'preserved']) assert(html.includes(text));
}
// Compare the teaching and diagram against the commit before the entire review.
const before = execFileSync('git', ['show', '369b931^:app/care/page.tsx'], { cwd: root, encoding: 'utf8' });
const after = fs.readFileSync(path.join(root, 'app/care/page.tsx'), 'utf8');
const marker = '            <p>\n              This is an introduction';
assert(before.includes(marker) && after.includes(marker));
assert.equal(after.slice(after.indexOf(marker)), before.slice(before.indexOf(marker)));
async function main() {
  // Public participation is rendered from the same kind rules as Zoom entry.
  for (const [kind, optional] of [['DROP_IN', true], ['COMMUNITY_GROUP', false], ['RETREAT', false]]) {
    const fixture = {
      id: 'fixture', slug: 'fixture', name: 'Fixture', archivedAt: null,
      category: { kind, name: 'Practice' }, programTeachers: [], teacherFacilitators: ['A facilitator'],
      registrationEnabled: true, registrationCapacity: null, registrationClosed: false,
      programFormat: 'hybrid', venue: 'at-rim', danaMode: 'voluntary', suggestedDana: 15,
      startDatetime: new Date('2026-09-27T14:30:00Z'), endDatetime: new Date('2026-09-27T15:30:00Z'),
      recurrenceFreq: 'WEEKLY', recurrenceInterval: 1, recurrenceDays: ['SU'],
    };
    const pageLoad = loader({
      '@/auth': { auth: async () => null },
      '@/lib/db': { db: { program: { findUnique: async () => fixture } } },
      '@/lib/renderRichContentServer': { renderContentBodyAsync: async () => '', renderFormattedTextAsync: async () => '' },
      '@/components/RegistrationForm': { __esModule: true, default: () => React.createElement('div', null, 'Form') },
    });
    const Detail = pageLoad('app/programs/[slug]/page.tsx').default;
    const detail = renderToStaticMarkup(await Detail({ params: Promise.resolve({ slug: 'fixture' }) }));
    assert.equal(detail.includes('Registration is available, but is not needed to attend.'), optional);
    assert.equal(detail.includes('Register (optional)'), optional);
    assert.equal(detail.includes('Sign in to join on Zoom'), optional);
    assert(detail.includes('Upstairs by stairs only; no elevator.'));
    assert(detail.includes('A facilitator'));
    const Register = pageLoad('app/programs/[slug]/register/page.tsx').default;
    const registration = renderToStaticMarkup(await Register({ params: Promise.resolve({ slug: 'fixture' }) }));
    assert.equal(registration.includes('Registration is optional for this drop-in.'), optional);
  }
  // The new migration preserves editor changes and operational fields, and only runs once.
  {
    const source = fs.readFileSync(path.join(root, 'prisma/migrate.mjs'), 'utf8');
    const start = source.indexOf('  // Authorized whole-review editorial integration.');
    const end = source.indexOf('  await db.$disconnect();', start);
    const block = source.slice(start, end).replaceAll('import.meta.url', 'migrationUrl');
    const run = new Function('db', 'migrationUrl', `return (async () => {${block}})()`);
    const fixes = JSON.parse(fs.readFileSync(path.join(root, 'prisma/newcomer-copy-integration-2026-09-26.json'), 'utf8'));
    const records = new Map();
    for (const fix of fixes) {
      const record = records.get(fix.slug) || { id: fix.slug, updatedAt: 1, registrationEnabled: true, danaMode: 'voluntary', privateNote: 'Preserve me', categoryId: 'drop-in', category: { kind: 'DROP_IN' }, teacherFacilitators: [], programTeachers: [] };
      for (const field of fix.fields) record[field] = [...(record[field] || []), { text: fix.from }];
      records.set(fix.slug, record);
    }
    // Live nature copy separates the bold label from the sentence. Match the sentence,
    // preserving formatting, and leave an already-published replacement untouched.
    const nature = records.get('nature-meditation-km-group');
    nature.description[nature.description.length - 1] = `<p><strong>Who it’s for:</strong> ${fixes.at(-1).from}</p>`;
    const alreadyApplied = fixes.find(f => f.slug === 'good-evening-silent-meditation');
    const evening = records.get(alreadyApplied.slug);
    evening.description[0] = { text: alreadyApplied.to };
    // An editor has already replaced this description; it must survive.
    records.get('awakening-to-the-beauty-of-this-moment').description.push({ text: 'Lovingly offered by Pam Miller and Amy Gardner' });
    const edited = records.get('the-art-of-meditation'); edited.description = '<p>Editor revision</p>';
    let applied = false, count = 0;
    const db = {
      $queryRawUnsafe: async () => applied ? [{ name: 'flag' }] : [],
      $executeRawUnsafe: async () => { applied = true; },
      $transaction: async fn => fn(db),
      programCategory: { findFirst: async () => ({ id: 'community-groups' }) },
      program: {
        findUnique: async ({ where }) => records.get(where.slug),
        updateMany: async ({ where, data }) => {
          const item = records.get(where.id); assert.equal(item.updatedAt, where.updatedAt);
          if (where.categoryId) assert.equal(item.categoryId, where.categoryId);
          assert(Object.keys(data).every(key => ['description', 'tagline', 'categoryId', 'teacherFacilitators'].includes(key)));
          Object.assign(item, data); count++; return { count: 1 };
        },
      },
    };
    const migrationUrl = require('node:url').pathToFileURL(path.join(root, 'prisma/migrate.mjs')).href;
    const savedLog = console.log;
    try {
      console.log = () => {};
      await run(db, migrationUrl);
      assert(applied); assert(count > 0); assert.equal(edited.description, '<p>Editor revision</p>');
      for (const fix of fixes.filter(f => f.slug !== edited.id)) for (const field of fix.fields) {
        assert(JSON.stringify(records.get(fix.slug)[field]).includes(fix.to));
        if (!fix.to.includes(fix.from)) assert(!JSON.stringify(records.get(fix.slug)[field]).includes(fix.from));
      }
      for (const record of records.values()) { assert.equal(record.registrationEnabled, true); assert.equal(record.danaMode, 'voluntary'); assert.equal(record.privateNote, 'Preserve me'); }
      assert.equal(records.get('essential-dharma-study').categoryId, 'community-groups');
      assert.deepEqual(records.get('awakening-to-the-beauty-of-this-moment').teacherFacilitators, ['Pam Miller', 'Amy Gardner']);
      const firstCount = count; await run(db, migrationUrl); assert.equal(count, firstCount);
    } finally { console.log = savedLog; }
  }

  // Real return route: unauthenticated, welcome, archived and ordinary member.
  for (const [session, expected] of [
    [null, `/login?returnTo=${encodeURIComponent(destination)}`],
    [{ user: { id: 'member', agreedToTerms: false } }, `/account/welcome?returnTo=${encodeURIComponent(destination)}`],
    [{ user: { id: 'member', agreedToTerms: true, archivedAt: 'date' } }, `/account/reactivate?returnTo=${encodeURIComponent(destination)}`],
    [{ user: { id: 'member', agreedToTerms: true, archivedAt: null } }, destination],
  ]) {
    const route = loader({ '@/auth': { auth: async () => session }, 'next/navigation': { redirect: url => { throw new Error(url); } } })('app/account/return/page.tsx').default;
    await assert.rejects(route({ searchParams: Promise.resolve({ to: destination }) }), { message: expected });
  }
  // Real join endpoint: capture signIn's destination; never run after() or send.
  let captured;
  const join = loader({
    'next/server': { NextResponse: Response, after: () => {} },
    '@/auth': { signIn: async (...args) => { captured = args; return '/login/check-email'; } },
    '@/lib/db': { db: { user: { findUnique: async () => null, upsert: async () => ({ id: 'test' }) } } },
    '@/lib/email': {}, '@/lib/enrollment': {},
    '@/lib/rateLimit': { checkRateLimit: async () => ({ allowed: true }), getRequestIp: () => 'test' },
  })('app/api/account/join/route.ts').POST;
  const response = await join(new Request('https://rim.test/api/account/join', { method: 'POST', body: JSON.stringify({ firstName: 'Test', lastName: 'Member', email: 'test@example.test', agreedToTerms: true, returnTo: destination }) }));
  assert.equal(response.status, 200);
  assert.equal(captured[1].redirectTo, callback);
  // Exercise custom input handlers through to the real form's request payload.
  const savedFormFetch = global.fetch;
  try {
    const values = []; let cursor = 0; let submitted;
    const Form = loader({ react: { ...React, useId: () => "fixture", useState: initial => {
      const index = cursor++; if (!(index in values)) values[index] = initial;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    } } })('components/RegistrationForm.tsx').default;
    const props = { program: { _id: 'fixture', slug: { current: 'fixture' }, name: 'Fixture', registrationFields: fields, danaMode: 'none' }, spotsRemaining: null, sessionUserId: 'member', userProfile: { firstName: 'Test', lastName: 'Member', email: 'test@example.test' } };
    const render = () => { cursor = 0; return Form(props); };
    const find = (node, predicate) => {
      if (!node || typeof node !== 'object') return null;
      if (predicate(node)) return node;
      for (const child of React.Children.toArray(node.props?.children)) { const found = find(child, predicate); if (found) return found; }
      return null;
    };
    for (const [index, value] of ['vegetarian', 'chair near door', 'Yes', 'Two'].entries()) {
      const input = find(render(), node => node.props?.id === `fixture-custom-${index}`);
      assert(input, `Missing field ${index}`); input.props.onChange({ target: { value } });
    }
    global.fetch = async (_url, options) => { submitted = JSON.parse(options.body); return Response.json({ error: 'Please try again.' }, { status: 503 }); };
    await render().props.onSubmit({ preventDefault() {} });
    assert.deepEqual(submitted.customFields, { 'Dietary needs': 'vegetarian', 'Access requests': 'chair near door', Attend: 'Yes', Option: 'Two' });
    assert(find(render(), node => node.props?.role === 'alert' && node.props.children === 'Please try again.'));
  } finally { global.fetch = savedFormFetch; }
  // Run the actual guarded migration block against an in-memory database.
  const migration = fs.readFileSync(path.join(root, 'prisma/migrate.mjs'), 'utf8');
  const start = migration.indexOf('  // Finish the newcomer review.');
  const end = migration.indexOf('  // Authorized whole-review editorial integration.', start);
  assert(start > 0 && end > start);
  const block = migration.slice(start, end).replaceAll('import.meta.url', 'migrationUrl');
  const runMigration = new Function('db', 'migrationUrl', `return (async () => {${block}})()`);
  const fixes = JSON.parse(fs.readFileSync(path.join(root, 'prisma/newcomer-copy-followup-2026-09-26.json'), 'utf8'));
  const oldLog = console.log;
  try {
    console.log = () => {};
    for (const initialPrice of [175, 200]) {
      let applied = false, updates = 0;
      const records = new Map();
      for (const fix of fixes) {
        const record = records.get(fix.slug) || { id: fix.slug, updatedAt: 1 };
        for (const field of fix.fields) record[field] = [...(record[field] || []), { text: fix.from }];
        records.set(fix.slug, record);
      }
      const retreat = { id: 'retreat', updatedAt: 1, danaMode: 'fixed', danaFixedAmount: initialPrice };
      records.set('awakening-to-the-beauty-of-this-moment', retreat);
      const db = {
        $queryRawUnsafe: async () => applied ? [{ name: 'flag' }] : [],
        $executeRawUnsafe: async () => { applied = true; },
        $transaction: async fn => fn(db),
        program: {
          findUnique: async ({ where }) => records.get(where.slug),
          updateMany: async ({ where, data }) => { const item = [...records.values()].find(r => r.id === where.id && r.updatedAt === where.updatedAt); assert(item); Object.assign(item, data); updates++; return { count: 1 }; },
        },
      };
      await runMigration(db, require('node:url').pathToFileURL(path.join(root, 'prisma/migrate.mjs')).href);
      assert(applied); assert.equal(retreat.danaMode, initialPrice === 175 ? 'voluntary' : 'fixed');
      if (initialPrice === 175) { assert.equal(retreat.suggestedDana, 175); assert.equal(retreat.danaFixedAmount, null); }
      for (const fix of fixes) for (const field of fix.fields) { if (!fix.to.includes(fix.from)) assert(!JSON.stringify(records.get(fix.slug)[field]).includes(fix.from)); }
      const beforeRepeat = updates;
      await runMigration(db, require('node:url').pathToFileURL(path.join(root, 'prisma/migrate.mjs')).href);
      assert.equal(updates, beforeRepeat);
    }
  } finally { console.log = oldLog; }
  // Newsletter uses actual route; mock every external request, including retries.
  const subscribe = load('app/api/subscribe/route.ts').POST;
  const savedFetch = global.fetch, savedKey = process.env.FLODESK_API_KEY;
  const savedError = console.error, savedWarn = console.warn;
  try {
    process.env.FLODESK_API_KEY = 'mock-only'; console.error = () => {}; console.warn = () => {};
    let calls = [];
    global.fetch = async (...args) => { calls.push(args); throw new Error('Unexpected network'); };
    for (const body of ['{', JSON.stringify({ email: 1 }), JSON.stringify({ email: 'bad@' })]) {
      assert.equal((await subscribe(new Request('https://rim.test', { method: 'POST', body }))).status, 400);
    }
    assert.equal(calls.length, 0);
    for (const [statuses, expected, count] of [[[200,200],200,2], [[200,503,200],200,3], [[200,503,503],503,3], [[503],503,1]]) {
      calls = []; let i = 0;
      global.fetch = async (...args) => { calls.push(args); return Response.json({ id: 'fixture' }, { status: statuses[i++] }); };
      const result = await subscribe(new Request('https://rim.test', { method: 'POST', body: JSON.stringify({ email: ' TEST@example.test ', first_name: 7 }) }));
      assert.equal(result.status, expected); assert.equal(calls.length, count);
      assert.equal(JSON.parse(calls[0][1].body).email, 'test@example.test');
      assert.equal(JSON.parse(calls[0][1].body).first_name, '');
      if (expected === 200) assert.equal((await result.json()).success, true);
      else assert((await result.json()).error);
    }
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal((await subscribe(new Request('https://rim.test', { method: 'POST', body: JSON.stringify({ email: 'test@example.test' }) }))).status, 500);
  } finally { global.fetch = savedFetch; console.error = savedError; console.warn = savedWarn; if (savedKey === undefined) delete process.env.FLODESK_API_KEY; else process.env.FLODESK_API_KEY = savedKey; }
  // Staging and production metadata. Reload module for each environment.
  const oldURL = process.env.NEXTAUTH_URL, oldEnv = process.env.VERCEL_ENV, oldIndexing = process.env.RIM_PUBLIC_INDEXING;
  try {
    for (const [url, env, enabled, index] of [['https://rim-next.vercel.app','production','true',false],['https://www.rootedinmindfulness.org','preview','true',false],['https://www.rootedinmindfulness.org','production','false',false],['https://www.rootedinmindfulness.org','production','true',true]]) {
      process.env.NEXTAUTH_URL = url; process.env.VERCEL_ENV = env; process.env.RIM_PUBLIC_INDEXING = enabled;
      const metadata = loader()('lib/publicMetadata.ts'); assert.equal(metadata.publicIndexing, index);
      assert.equal(metadata.publicPageMetadata('Title','Description','/new-to-rim').alternates.canonical, url + '/new-to-rim');
    }
  } finally { if (oldURL === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = oldURL; if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv; if (oldIndexing === undefined) delete process.env.RIM_PUBLIC_INDEXING; else process.env.RIM_PUBLIC_INDEXING = oldIndexing; }
  console.log('PASS: all auth return gates, join callback, hostile destinations, CT/DST next starts, voluntary vs required dana, participation/place labels, registration/update label IDs and saved values, independent submitted custom answers, announced API failure, guarded/idempotent migrations preserving editor changes, optional vs required registration rendering, center access facts, native form validation, newsletter failure/retry/success cases, preview/production indexing, byte-identical CARE handout. No external messages or transactions.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
