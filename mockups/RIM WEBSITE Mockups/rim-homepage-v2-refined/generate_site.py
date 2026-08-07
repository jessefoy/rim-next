from pathlib import Path
from html import escape

OUT = Path('/mnt/data/rim-homepage-v2-refined')

NAV = [
    ('new-here.html', 'New here'),
    ('programs.html', 'Programs'),
    ('this-week.html', 'This week'),
    ('teachings.html', 'Teachings'),
    ('community.html', 'Community'),
    ('about.html', 'About'),
]

def logo():
    return '''<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 55V28"/><path d="M32 33c-9-1-15-7-16-16 9 1 15 7 16 16Z"/><path d="M32 27c8-1 14-6 16-14-8 0-14 5-16 14Z"/><path d="M19 55c3-7 8-11 13-11s10 4 13 11"/></svg></span>'''

def header(active=''):
    links = []
    for href, label in NAV:
        cls = ' aria-current="page"' if active == href else ''
        links.append(f'<a href="{href}"{cls}>{label}</a>')
    return f'''
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="index.html" aria-label="Rooted in Mindfulness home">{logo()}<span>Rooted in Mindfulness</span></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span class="sr-only">Open navigation</span></button>
    <nav class="site-nav" id="site-nav" aria-label="Main navigation">
      {''.join(links)}
      <a class="member-link" href="login.html">Member sign in</a>
    </nav>
  </header>'''

def footer():
    return '''
  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-intro">
        <a class="footer-brand" href="index.html">Rooted in Mindfulness</a>
        <p>A welcoming Dharma community in Greater Milwaukee and online.</p>
        <address>4040 N. Calhoun Rd.<br>Brookfield, WI 53005</address>
      </div>
      <nav aria-label="Explore">
        <span>Explore</span>
        <a href="new-here.html">New here</a><a href="programs.html">Programs</a><a href="this-week.html">This week</a><a href="teachings.html">Teachings</a>
      </nav>
      <nav aria-label="Community">
        <span>Community</span>
        <a href="community.html">Life at RIM</a><a href="join.html">Join RIM</a><a href="support.html">Support RIM</a><a href="about.html">About</a>
      </nav>
      <nav aria-label="Members">
        <span>Members</span>
        <a href="login.html">Sign in</a><a href="member-dashboard.html">Dashboard preview</a><a href="mailto:support@rootedinmindfulness.org">Contact support</a>
      </nav>
    </div>
    <div class="footer-bottom"><span>© 2026 Rooted in Mindfulness · 501(c)(3) nonprofit</span><span>Practice for ourselves, those we love, and the world we share.</span></div>
  </footer>'''

def page(filename, title, body, active='', description='', body_class=''):
    desc = description or 'Rooted in Mindfulness is a welcoming Dharma community offering meditation, Buddhist teachings, and connection in Greater Milwaukee and online.'
    html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{escape(desc)}">
  <title>{escape(title)} · Rooted in Mindfulness</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css?v=20260730-refined">
</head>
<body class="{body_class}">
{header(active)}
<main id="main">{body}</main>
{footer()}
<script src="script.js?v=20260730-refined"></script>
</body>
</html>'''
    (OUT / filename).write_text(html, encoding='utf-8')

home = '''
<section class="home-hero">
  <div class="hero-art" aria-hidden="true"><span class="hero-sun"></span><span class="hero-hill hill-a"></span><span class="hero-hill hill-b"></span><span class="hero-hill hill-c"></span></div>
  <div class="hero-inner reveal">
    <p class="eyebrow">A welcoming Dharma community in Greater Milwaukee + online</p>
    <h1>A place to bring your whole life.</h1>
    <p class="hero-lead">Whether you are carrying stress, grief, uncertainty, or a wish to live with greater clarity and compassion, you are welcome here.</p>
    <div class="button-row"><a class="button primary" href="this-week.html">Join a gathering this week</a><a class="button text" href="new-here.html">See what to expect <span>→</span></a></div>
    <ul class="assurance-list"><li>No experience needed</li><li>No belief required</li><li>In person or online</li><li>Cost is never a barrier</li></ul>
  </div>
</section>

<section class="section first-step" id="begin">
  <div class="first-step-card reveal">
    <div class="first-step-copy">
      <p class="eyebrow">A simple place to begin</p>
      <h2>Come once. See how it feels.</h2>
      <p>You do not need to know how to meditate, identify as Buddhist, or have the right words. Join quietly, listen, practice with us, and decide for yourself whether it is helpful.</p>
      <a class="text-link" href="new-here.html">Read a gentle first-visit guide <span>→</span></a>
    </div>
    <article class="featured-gathering" data-cms-item="recommended-program">
      <div><span class="tag">Good first visit</span><p class="meta">Every Saturday · Drop in</p><h3>Meditation &amp; Dharma Talk</h3><p>Guided meditation, an accessible Buddhist teaching, and optional conversation.</p></div>
      <dl class="compact-details"><div><dt>Time</dt><dd>9:30–10:45 AM CT</dd></div><div><dt>Place</dt><dd>Brookfield + Zoom</dd></div><div><dt>Cost</dt><dd>Offered through generosity</dd></div></dl>
      <a class="button primary full" href="program-detail.html">See gathering details</a>
    </article>
  </div>
</section>

<section class="section expect-section">
  <div class="split-heading reveal"><div><p class="eyebrow">What a first visit is like</p><h2>Welcomed, guided, and free to simply listen.</h2></div><p>You do not have to perform calm, sit a certain way, or share anything personal. The structure is simple and your participation remains your own.</p></div>
  <div class="expect-grid expect-grid-three reveal">
    <article><span>01</span><h3>Arrive as you are</h3><p>Come a few minutes early. Someone will help you find the room, a chair or cushion, and anything else you need.</p></article>
    <article><span>02</span><h3>Practice with support</h3><p>A facilitator offers clear guidance. You may change position, keep your eyes open, or step out whenever needed.</p></article>
    <article><span>03</span><h3>Choose your own pace</h3><p>Listen quietly, join optional conversation, return often, or come only once. There is no pressure to speak or commit.</p></article>
  </div>
</section>

<section class="section week-home">
  <div class="split-heading reveal"><div><p class="eyebrow">This week at RIM</p><h2>A few ways to join us.</h2></div><p>Day, time, format, and commitment are visible here so you can decide quickly.</p></div>
  <div class="schedule-preview reveal" data-cms-collection="upcoming-programs">
    <a href="program-detail.html"><time><b>Thu</b><span>Jul 30</span></time><span class="event-name"><b>Essential Dharma Study</b><small>9:30–10:30 AM · Zoom · Drop-in</small></span><span class="arrow">→</span></a>
    <a href="program-detail.html"><time><b>Sat</b><span>Aug 1</span></time><span class="event-name"><b>Meditation &amp; Dharma Talk</b><small>9:30–10:45 AM · Brookfield + Zoom · Drop-in</small></span><span class="tag">Good first visit</span><span class="arrow">→</span></a>
    <a href="program-detail.html"><time><b>Sun</b><span>Aug 2</span></time><span class="event-name"><b>Our Hearts Were Made for This</b><small>9:00–9:45 AM · Zoom · Drop-in</small></span><span class="arrow">→</span></a>
  </div>
  <div class="section-end"><p>Morning and evening silent meditation is also offered through the week.</p><a class="text-link" href="this-week.html">See the complete schedule <span>→</span></a></div>
</section>

<section class="section path-section">
  <div class="center-heading reveal"><p class="eyebrow">A practice for the whole of life</p><h2>Three things support one another.</h2><p>You do not have to choose a category. Most people move naturally among practice, understanding, and relationship.</p></div>
  <div class="path-cards reveal">
    <article class="path-card warm"><span class="path-symbol">◌</span><h3>Practice</h3><p>Meditation and embodied practices that cultivate steadiness, awareness, and a kinder relationship with experience.</p><a href="programs.html">Find a practice <span>→</span></a></article>
    <article class="path-card water"><span class="path-symbol">≈</span><h3>Understanding</h3><p>Buddhist teachings offered in practical language, exploring the causes of well-being and suffering.</p><a href="teachings.html">Explore teachings <span>→</span></a></article>
    <article class="path-card green"><span class="path-symbol">✦</span><h3>Community</h3><p>A sangha in which people practice, learn, remember one another, and offer care over time.</p><a href="community.html">Meet the community <span>→</span></a></article>
  </div>
</section>

<section class="section voices-section">
  <div class="voices-intro reveal"><p class="eyebrow">In the words of community members</p><h2>What people found when they arrived.</h2></div>
  <div class="voice-grid reveal">
    <blockquote><p>“RIM has been a safe place for me to bring my anxiety and brokenness—to feel supported and okay.”</p><cite>Community member</cite></blockquote>
    <blockquote><p>“After the first drop-in session, I knew I was home.”</p><cite>Community member</cite></blockquote>
    <blockquote><p>“The teachings feel accessible to newcomers while still being impactful for seasoned practitioners.”</p><cite>Community member</cite></blockquote>
  </div>
</section>

<section class="section meaning-section">
  <div class="meaning-card reveal">
    <div class="meaning-copy"><p class="eyebrow light">Rooted in a living tradition</p><h2>Accessible, grounded, and deeper than stress relief.</h2><p>RIM draws from Insight Meditation and the teachings of the early Buddhist tradition. Practice supports our own well-being, the people whose lives touch ours, and the world we share.</p><div class="button-row"><a class="button light" href="about.html">Our approach</a><a class="button text light-text" href="teachings.html">Explore free teachings <span>→</span></a></div></div>
    <div class="meaning-visual" aria-label="Practice for yourself, those you love, and the world we share"><span class="meaning-world">The world we share</span><span class="meaning-loved">Those you love</span><span class="meaning-self">Yourself</span></div>
  </div>
</section>

<section class="member-strip">
  <div class="member-strip-inner reveal"><div><p class="eyebrow">Already part of RIM?</p><h2>Your practice links and community resources are in one place.</h2></div><div class="button-row"><a class="button primary" href="login.html">Member sign in</a><a class="button text" href="join.html">Learn about joining <span>→</span></a></div></div>
</section>

<section class="section newsletter-section">
  <div class="newsletter-card reveal"><div><p class="eyebrow">Stay connected</p><h2>A quiet note about what is happening.</h2><p>Programs, retreats, new teachings, and community news. No pressure and no constant stream.</p></div><form class="newsletter-form"><label><span>First name</span><input type="text" name="name" autocomplete="given-name"></label><label><span>Email address</span><input type="email" name="email" autocomplete="email" required></label><button class="button primary" type="submit">Subscribe</button><p class="form-message" aria-live="polite"></p></form></div>
</section>
'''
page('index.html', 'A place to bring your whole life', home, body_class='home-page')

new_here = '''
<section class="inner-hero soft-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">New here</p><h1>You do not have to know how to begin.</h1><p>Most people arrive with questions, uncertainty, or something in life asking for care. You are welcome to take one small step and decide the rest later.</p><a class="button primary" href="program-detail.html">Try Saturday meditation</a></div><div class="hero-note reveal"><p>Come once. Sit in a chair. Keep your camera off online. Say nothing. Leave whenever you need to.</p><strong>All of that is okay.</strong></div></section>
<section class="section new-first"><div class="split-heading reveal"><div><p class="eyebrow">Our recommendation</p><h2>Begin with a drop-in.</h2></div><p>You do not need to compare every program. Saturday Meditation &amp; Dharma Talk is the simplest first visit for most people.</p></div><article class="wide-program-card reveal"><div><span class="tag">Good first visit</span><h3>Meditation &amp; Dharma Talk</h3><p>Guided meditation, a practical teaching, and optional conversation in a warm, grounded setting.</p></div><dl><div><dt>When</dt><dd>Saturdays, 9:30–10:45 AM</dd></div><div><dt>Where</dt><dd>Brookfield + Zoom</dd></div><div><dt>Commitment</dt><dd>Come once or return when helpful</dd></div><div><dt>Cost</dt><dd>Offered through generosity</dd></div></dl><a class="button primary" href="program-detail.html">See details</a></article></section>
<section class="section literal-expect"><div class="center-heading reveal"><p class="eyebrow">What happens when you arrive</p><h2>The ordinary details.</h2></div><div class="timeline reveal"><article><span>Before</span><h3>Arrive a little early</h3><p>There is parking at the center. Come through the main entrance and someone will help you settle in. Online, use the Zoom link in your member dashboard.</p></article><article><span>During</span><h3>Sit, listen, and participate at your own pace</h3><p>We usually begin with meditation, followed by a teaching and sometimes optional discussion. Chairs and cushions are available. You are never required to speak.</p></article><article><span>After</span><h3>Leave quietly or stay for conversation</h3><p>You may head out when the gathering ends, ask a question, or meet someone. No one will pressure you to join, donate, or return.</p></article></div></section>
<section class="section faq-section"><div class="faq-layout"><div class="reveal"><p class="eyebrow">Questions people often carry</p><h2>You are allowed to be cautious.</h2><p>RIM does not ask you to adopt a belief, present yourself in a particular way, or pretend that a practice is helping when it is not.</p></div><div class="accordion reveal"><details open><summary>Do I have to be Buddhist?</summary><p>No. RIM is honest about its Buddhist roots, while welcoming people with religious, spiritual, secular, uncertain, or changing perspectives.</p></details><details><summary>What if I cannot sit on the floor?</summary><p>Most people use chairs. You may change position, stand, or step out. Practice should meet the reality of your body.</p></details><details><summary>Will I be expected to talk?</summary><p>No. Conversation is optional. Listening quietly is a complete form of participation.</p></details><details><summary>What does it cost?</summary><p>Regular programs are offered in the spirit of dana, or generosity. Donations are welcome, but cost is never a barrier.</p></details><details><summary>Do I need an account?</summary><p>You can attend in person without navigating a complex registration process. A free account gives you online links and access to the member dashboard.</p></details></div></div></section>
<section class="closing-invite"><div class="closing-inner reveal"><p class="eyebrow light">Take one small step</p><h2>You are welcome to come exactly as you are.</h2><a class="button light" href="this-week.html">See what is happening this week</a></div></section>
'''
page('new-here.html', 'New here', new_here, active='new-here.html')

program_cards = [
('Drop-in', 'Meditation & Dharma Talk', 'Saturdays · 9:30–10:45 AM', 'Brookfield + Zoom', 'Guided meditation and a Dharma teaching connected to everyday life.', 'Good first visit'),
('Drop-in', 'The Art of Meditation', 'Tuesdays · 9:30–10:30 AM', 'Brookfield + Zoom', 'Develop and deepen a skillful meditation practice with guidance and questions.', 'Beginner friendly'),
('Drop-in', 'Awakening the Heart', 'Mondays · 9:30–10:30 AM', 'Zoom', 'Loving-kindness, compassion, appreciative joy, and equanimity in practice.', ''),
('Daily practice', 'Good Morning Silent Meditation', 'Weekdays · 6:30–7:00 AM', 'Zoom', 'A simple half-hour of community-supported silent meditation.', '30 minutes'),
('Daily practice', 'Good Evening Silent Meditation', 'Sun–Thu · 7:30–8:00 PM', 'Zoom', 'Close the day in shared silence and steady awareness.', '30 minutes'),
('Study', 'Essential Dharma Study', 'Thursdays · 9:30–10:30 AM', 'Zoom', 'Explore core Buddhist teachings through study, reflection, and spiritual friendship.', ''),
('Community', 'Qigong at RIM', 'Wednesdays · 10:00–10:45 AM', 'Zoom', 'Gentle movement and embodied awareness with community.', ''),
('Community', 'Recovery Dharma', 'Sundays · 9:30–11:00 AM', 'Zoom', 'A peer-led Buddhist approach to healing from addiction and habitual suffering.', ''),
('Retreat', 'The Heart of Wisdom', 'September 10–13', 'Holy Wisdom Monastery', 'Four days of meditation, teachings, silence, rest, and compassionate community.', 'Registration required'),
]
program_palette = ['sunrise', 'lake', 'grove', 'paper']

def render_program_card(item, palette_index=0):
    cat, name, when, where, desc, badge = item
    color = program_palette[palette_index % len(program_palette)]
    return f'''<article class="program-card program-card--{color}" data-category="{cat.lower().replace(' ', '-')}"><div class="program-card-top"><span class="program-type">{cat}</span>{f'<span class="tag">{badge}</span>' if badge else ''}</div><div class="program-card-copy"><h3><a href="program-detail.html">{name}</a></h3><p>{desc}</p></div><dl class="program-card-facts"><div><dt>When</dt><dd>{when}</dd></div><div><dt>Where</dt><dd>{where}</dd></div></dl><a class="card-link" href="program-detail.html">Explore this program <span>→</span></a></article>'''

program_groups = [
    ('drop-ins', 'Open practice & learning', 'Drop in without a long commitment. These gatherings combine meditation, teaching, and practical support for everyday life.', [program_cards[0], program_cards[1], program_cards[2], program_cards[5]]),
    ('daily', 'Silent meditation', 'Short, steady periods of shared silence for beginning or ending the day with awareness.', [program_cards[3], program_cards[4]]),
    ('community-programs', 'Community groups', 'Practice also grows through movement, peer support, spiritual friendship, and conversation.', [program_cards[6], program_cards[7]]),
    ('retreats', 'Retreats & special programs', 'Longer periods of practice offer room to settle, listen more deeply, and step out of ordinary momentum.', [program_cards[8]]),
]

group_html = ''
card_index = 0
for group_id, title, intro, items in program_groups:
    cards = ''
    for item in items:
        cards += render_program_card(item, card_index)
        card_index += 1
    group_html += f'''<section class="program-family" id="{group_id}" data-cms-group="program-category"><header class="program-family-heading reveal"><div><p class="eyebrow">Programs</p><h2>{title}</h2></div><p>{intro}</p></header><div class="program-grid reveal" data-cms-collection="programs">{cards}</div></section>'''

programs = f'''
<section class="inner-hero programs-intro-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">Programs</p><h1>Ways to practice, learn, and connect.</h1><p>Begin with one drop-in, find a steady rhythm, explore the teachings, or make room for retreat. Time, format, and commitment are visible before you click.</p><div class="button-row"><a class="button primary" href="this-week.html">See what is happening this week</a><a class="button text" href="#drop-ins">Browse programs <span>↓</span></a></div></div><div class="programs-hero-art reveal" aria-hidden="true"><span></span><span></span><span></span></div></section>
<section class="section programs-welcome"><div class="programs-welcome-card reveal"><div><p class="eyebrow">New here?</p><h2>Start with a drop-in.</h2></div><p>You do not need to compare every offering. Saturday Meditation &amp; Dharma Talk is a gentle first visit, and you are welcome to participate as quietly as you wish.</p><a class="text-link" href="program-detail.html">See the Saturday gathering <span>→</span></a></div></section>
<section class="section program-directory">{group_html}</section>
<section class="section program-help"><div class="help-card reveal"><div><p class="eyebrow">A note about cost</p><h2>Programs are offered through generosity.</h2><p>Donations help sustain RIM, but cost is never a barrier to participating in regular community programs.</p></div><a class="button outline" href="support.html">How dana works</a></div></section>
'''
page('programs.html', 'Programs', programs, active='programs.html')

week_days = [
('Thursday', 'July 30', [('9:30–10:30 AM', 'Essential Dharma Study', 'Zoom', 'Drop-in')]),
('Friday', 'July 31', [('6:30–7:00 AM', 'Good Morning Silent Meditation', 'Zoom', 'Noble silence')]),
('Saturday', 'August 1', [('9:30–10:45 AM', 'Meditation & Dharma Talk', 'Brookfield + Zoom', 'Good first visit')]),
('Sunday', 'August 2', [('9:00–9:45 AM', 'Our Hearts Were Made for This', 'Zoom', 'Drop-in'), ('9:30–11:00 AM', 'Recovery Dharma', 'Zoom', 'Peer-led')]),
('Monday', 'August 3', [('6:30–7:00 AM', 'Good Morning Silent Meditation', 'Zoom', 'Noble silence'), ('9:30–10:30 AM', 'Awakening the Heart', 'Zoom', 'Drop-in'), ('7:30–8:00 PM', 'Good Evening Silent Meditation', 'Zoom', 'Noble silence')]),
('Tuesday', 'August 4', [('6:30–7:00 AM', 'Good Morning Silent Meditation', 'Zoom', 'Noble silence'), ('9:30–10:30 AM', 'The Art of Meditation', 'Brookfield + Zoom', 'Beginner friendly')]),
('Wednesday', 'August 5', [('6:30–7:00 AM', 'Good Morning Silent Meditation', 'Zoom', 'Noble silence'), ('10:00–10:45 AM', 'Qigong at RIM', 'Zoom', 'Gentle movement')]),
]
week_html = ''
for day,date,events in week_days:
    month, number = date.split()
    short_day = day[:3]
    ev = ''.join(f'''<a class="week-event" href="program-detail.html"><span class="week-event-main"><strong>{name}</strong><small>{note}</small></span><span class="week-event-when"><b>{time}</b><small>{place}</small></span><span class="arrow">→</span></a>''' for time,name,place,note in events)
    weekend = ' weekend' if day in ('Saturday', 'Sunday') else ''
    week_html += f'''<section class="schedule-day{weekend}" data-cms-item="day"><div class="schedule-date"><span>{short_day}</span><b>{number}</b><small>{month}</small></div><div class="schedule-day-body"><h2>{day}</h2>{ev}</div></section>'''
this_week = f'''
<section class="inner-hero week-intro-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">July 30–August 5 · Central Time</p><h1>This week at RIM.</h1><p>A simple day-by-day view of what you can join now. Come for one gathering or return throughout the week.</p><div class="button-row"><a class="button primary" href="#schedule">See the schedule</a><a class="button text" href="programs.html">Browse all programs <span>→</span></a></div></div><div class="week-hero-note reveal"><span class="tag">Good first visit</span><h3>Saturday Meditation &amp; Dharma Talk</h3><p>9:30–10:45 AM · Brookfield + Zoom</p></div></section>
<section class="section week-page" id="schedule"><div class="schedule-note reveal"><span class="live-dot"></span><p><strong>New here?</strong> Saturday Meditation &amp; Dharma Talk and Tuesday’s Art of Meditation are especially welcoming first visits.</p><a href="new-here.html">What to expect <span>→</span></a></div><div class="full-week reveal" data-cms-collection="weekly-events">{week_html}</div><p class="schedule-disclaimer">Schedule is subject to change. All times are Central Time.</p></section>
<section class="section week-notes"><div class="note-grid reveal"><article><p class="eyebrow">Joining online</p><h3>Zoom links live in your dashboard.</h3><p>Create a free account or sign in. On the day of a gathering, the correct link appears in your member area.</p><a class="text-link" href="login.html">Sign in <span>→</span></a></article><article><p class="eyebrow">Coming in person</p><h3>4040 N. Calhoun Rd., Brookfield</h3><p>Come a few minutes early. Chairs and cushions are available, and someone will help you settle in.</p><a class="text-link" href="new-here.html">First-visit guide <span>→</span></a></article></div></section>
'''
page('this-week.html', 'This week', this_week, active='this-week.html')

program_detail = '''
<article class="program-landing" data-cms-template="program">
  <section class="program-cover">
    <div class="program-cover-copy reveal"><a class="back-link" href="programs.html">← All programs</a><p class="eyebrow" data-cms-field="program-type">Weekly drop-in</p><h1 data-cms-field="title">Meditation &amp; Dharma Talk</h1><p class="program-promise" data-cms-field="short-description">A welcoming Saturday gathering for guided meditation, practical Buddhist teaching, and shared reflection.</p><blockquote data-cms-block="quote"><p>“Mindfulness helps us see what we are adding to our experience—not only in meditation, but everywhere.”</p><cite>Sharon Salzberg</cite></blockquote></div>
    <aside class="program-facts reveal" aria-label="Program details"><span class="tag">Good first visit</span><dl><div><dt>When</dt><dd>Saturdays<br>9:30–10:45 AM CT</dd></div><div><dt>Where</dt><dd>Brookfield + Zoom</dd></div><div><dt>Commitment</dt><dd>Drop in anytime</dd></div><div><dt>Experience</dt><dd>None required</dd></div><div><dt>Cost</dt><dd>Suggested donation $10–$20<br><small>Cost is never a barrier</small></dd></div></dl><a class="button primary full" href="login.html">Sign in for the Zoom link</a><p class="microcopy">Coming in person? Simply arrive a few minutes early.</p></aside>
  </section>
  <section class="program-story section-narrow reveal" data-cms-field="long-description"><p class="opening">Saturday mornings at RIM are a place to slow down, sit together, and listen.</p><p>Each gathering pairs guided meditation with a Dharma talk—a teaching drawn from Buddhist wisdom and brought into the real questions of how we live, how we relate, and how we meet difficulty with steadiness and care.</p><p>You may come because life feels overwhelming, because you want to develop a regular practice, or because meditation apps no longer feel like enough. You do not need to arrive calm, spiritually certain, or prepared to speak. You may simply take a seat and begin where you are.</p><p>This is RIM’s longest-running weekly gathering. Some people attend every Saturday; others come occasionally. Both are complete ways to participate.</p></section>
  <section class="program-experience section-narrow" data-cms-block="highlights"><div class="section-title reveal"><p class="eyebrow">What the morning holds</p><h2>A simple, supportive rhythm.</h2></div><div class="experience-list reveal"><article><span>01</span><div><h3>Arrive and settle</h3><p>There is time to find a chair or cushion and let the pace of the morning soften.</p></div></article><article><span>02</span><div><h3>Guided meditation</h3><p>Clear, accessible instructions support beginners while leaving room for experienced practitioners.</p></div></article><article><span>03</span><div><h3>Dharma teaching</h3><p>A traditional teaching is translated into the ordinary territory of work, relationships, loss, habit, and care.</p></div></article><article><span>04</span><div><h3>Optional conversation</h3><p>You may ask a question, share a reflection, or simply listen. Speaking is never required.</p></div></article></div></section>
  <section class="program-teacher section-narrow reveal" data-cms-block="facilitators"><div><p class="eyebrow">Facilitator</p><h2>Jesse Foy</h2><p>Jesse is RIM’s founder and guiding teacher. His teaching brings traditional Buddhist psychology and contemporary mindfulness approaches into language that is practical, humane, and relevant to everyday life.</p><a class="text-link" href="about.html#jesse">Meet Jesse and learn about RIM’s approach <span>→</span></a></div><div class="teacher-mark" aria-hidden="true"><span>JF</span></div></section>
  <section class="program-join"><div class="program-join-inner reveal"><div><p class="eyebrow light">Join this Saturday</p><h2>Come once and see how it feels.</h2><p>Attend in person without advance registration, or sign in to your free member account for the Zoom link.</p></div><div class="button-row"><a class="button light" href="login.html">Member sign in</a><a class="button text light-text" href="join.html">Create a free account <span>→</span></a></div></div></section>
</article>
'''
page('program-detail.html', 'Meditation & Dharma Talk', program_detail, body_class='program-detail-page')

teachings = '''
<section class="inner-hero teaching-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">Teachings</p><h1>Something to receive before you are asked for anything.</h1><p>Explore meditation guidance, Dharma talks, and learning resources freely. Begin with what is relevant to your life and test the teachings in your own experience.</p></div><div class="hero-note reveal"><p>RIM is rooted in Insight Meditation and the early Buddhist tradition, offered in language that welcomes both secular and spiritual seekers.</p></div></section>
<section class="section featured-teaching"><div class="featured-resource reveal"><div class="resource-art"><span>◌</span></div><div><p class="eyebrow">A place to begin</p><h2>The Handful of Leaves</h2><p>A practical framework for understanding the essential Dharma: what supports well-being, what gives rise to suffering, and how awareness, ethics, compassion, and wisdom work together.</p><div class="resource-meta"><span>Learning path</span><span>Read at your own pace</span><span>Free</span></div><a class="button primary" href="#">Begin the learning path</a></div></div></section>
<section class="section topic-section"><div class="split-heading reveal"><div><p class="eyebrow">Explore by what you are meeting</p><h2>Teachings for lived experience.</h2></div><p>You do not need to know Buddhist terminology. Start with a question that is already alive in you.</p></div><div class="topic-grid reveal"><a href="#"><h3>Stress and difficult emotions</h3><p>Meeting anxiety, grief, reactivity, and uncertainty without abandoning ourselves.</p><span>Explore topic →</span></a><a href="#"><h3>Meditation foundations</h3><p>Breath, body, feeling, mind, and the conditions that support steady practice.</p><span>Explore topic →</span></a><a href="#"><h3>Compassion and relationships</h3><p>Kindness, boundaries, communication, and caring without losing ourselves.</p><span>Explore topic →</span></a><a href="#"><h3>The Buddhist path</h3><p>Ethics, concentration, wisdom, and freedom in language grounded in daily life.</p><span>Explore topic →</span></a></div></section>
<section class="section tradition-explain"><div class="two-column-copy reveal"><div><p class="eyebrow">A named tradition</p><h2>Insight Meditation, honestly and accessibly offered.</h2></div><div><p>RIM shares the heart of Buddhist wisdom through Insight, or Vipassana, practice—rooted in the Pāli Canon and enriched by the wider Dharma of Buddhist traditions.</p><p>Dharma language is translated rather than hidden. You are welcome to engage as a Buddhist practitioner, a secular student of mindfulness, a person of another faith, or someone who is still unsure.</p><a class="text-link" href="about.html">Read about RIM’s approach and lineage <span>→</span></a></div></div></section>
'''
page('teachings.html', 'Teachings', teachings, active='teachings.html')

community = '''
<section class="inner-hero community-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">Community</p><h1>Practice becomes a refuge we help create together.</h1><p>RIM is not only a place to receive instruction. It is a sangha—a community of people learning how to meet life with awareness, compassion, and care for one another.</p></div><div class="hero-note reveal"><p>Community can feel vulnerable. You are welcome to come quietly and let belonging grow at its own pace.</p></div></section>
<section class="section community-meaning"><div class="split-heading reveal"><div><p class="eyebrow">What community means here</p><h2>More than attending the same class.</h2></div><p>It can be as simple as someone remembering your name, noticing when you have been away, or sitting beside you during a difficult season.</p></div><div class="community-practices reveal"><article><h3>Shared practice</h3><p>Regular meditation, teachings, retreats, and study create a rhythm that people can return to.</p></article><article><h3>Spiritual friendship</h3><p>Kalyana Mitta means “spiritual friend”—relationships that support honesty, learning, and wise care.</p></article><article><h3>Care in action</h3><p>Members welcome newcomers, tend the space, support programs, and bring practice into the wider community.</p></article></div></section>
<section class="section voices-long"><div class="quote-wall reveal"><blockquote><p>“After the first drop-in session, I knew I was home. The warm, welcoming community was where I wanted to grow my practice.”</p></blockquote><blockquote><p>“RIM and this sangha is an exquisite gift of ever-growing well-being—to me and to every relationship and being I encounter.”</p></blockquote><blockquote><p>“Right now the most I can offer is my presence.”</p></blockquote></div></section>
<section class="section community-paths"><div class="center-heading reveal"><p class="eyebrow">Ways community can deepen</p><h2>There is no ladder to climb.</h2><p>These are invitations, not levels of achievement.</p></div><div class="path-list reveal"><a href="programs.html"><span>Practice regularly</span><small>Drop-ins, daily meditation, study, and retreat</small><b>→</b></a><a href="join.html"><span>Become a community member</span><small>Shared agreements, deeper connection, and member resources</small><b>→</b></a><a href="support.html"><span>Offer time, care, or financial support</span><small>Specific ways to contribute when it feels natural</small><b>→</b></a></div></section>
'''
page('community.html', 'Community', community, active='community.html')

about = '''
<section class="inner-hero about-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">About RIM</p><h1>A modern Dharma center with clear roots.</h1><p>Rooted in Mindfulness is a nonprofit community in Brookfield, Wisconsin, offering meditation, Buddhist teachings, and spiritual friendship in person and online.</p></div><div class="hero-note reveal"><p>Our aim is not to create better spiritual consumers. It is to help one another cultivate the causes of well-being and transform the causes of suffering.</p></div></section>
<section class="section about-purpose"><div class="two-column-copy reveal"><div><p class="eyebrow">Our purpose</p><h2>Practice that benefits more than one person.</h2></div><div><p>We practice to care for our own hearts and minds, to meet the people in our lives with greater wisdom and compassion, and to participate more responsibly in the world we share.</p><p>RIM welcomes newcomers, experienced practitioners, secular and spiritual seekers, and people whose relationship to Buddhism is still unfolding.</p></div></div></section>
<section class="section principles-section"><div class="principles-grid reveal"><article><span>01</span><h3>Direct experience</h3><p>Teachings are invitations to investigate life, not doctrines you are required to accept.</p></article><article><span>02</span><h3>Ethical roots</h3><p>Mindfulness belongs with compassion, wise speech, non-harming, and responsibility.</p></article><article><span>03</span><h3>Generosity</h3><p>Regular teachings are offered without tuition so money does not determine belonging.</p></article><article><span>04</span><h3>Community</h3><p>Awakening is not only personal. We create the conditions for one another to practice and grow.</p></article></div></section>
<section class="section teacher-section" id="jesse"><div class="teacher-profile reveal"><div class="teacher-mark large"><span>JF</span></div><div><p class="eyebrow">Guiding teacher</p><h2>Jesse Foy</h2><p>Jesse is the founder and guiding teacher of Rooted in Mindfulness. His teaching is informed by more than twenty-five years of learning and practice, interdisciplinary education in Buddhism and contemplative psychology at Naropa University, advanced Mindfulness-Based Stress Reduction training, clinical mind-body work, and retreat practice with Western and Eastern teachers.</p><p>Community members often describe his particular gift as bringing newcomers into the conversation without reducing the depth or significance of the teachings.</p><blockquote><p>“There are those who teach, those who do, and only one I have found who does both.”</p><cite>Community member</cite></blockquote></div></div></section>
<section class="section governance-note"><div class="note-card reveal"><div><p class="eyebrow">An organization shaped by the practice</p><h2>The center should embody what it teaches.</h2></div><p>RIM is a 501(c)(3) nonprofit supported by community generosity, volunteers, teachers, and a board. Transparency, care, and shared responsibility are part of the practice—not administrative details separate from it.</p></div></section>
'''
page('about.html', 'About RIM', about, active='about.html')

join = '''
<section class="inner-hero join-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">Join RIM</p><h1>Participation can begin before belonging has a name.</h1><p>You are welcome to attend a gathering without making a commitment. A free account simply makes online participation easier. Community membership is available when a deeper relationship feels honest.</p></div></section>
<section class="section account-choice"><div class="choice-grid reveal"><article><p class="eyebrow">Start here</p><h2>Create a free account</h2><p>Use the member dashboard to access Zoom links, register for programs when needed, and keep practical information in one place.</p><ul><li>No fee</li><li>No required donation</li><li>No promise to attend regularly</li></ul><a class="button primary" href="login.html">Create account</a></article><article><p class="eyebrow">When you are ready</p><h2>Become a community member</h2><p>Membership is a way of naming a mutual relationship with the sangha. It includes community care agreements and opportunities for deeper participation.</p><ul><li>Shared commitments to care and non-harming</li><li>Community communication and resources</li><li>Ways to support and co-create RIM</li></ul><a class="button outline" href="#agreements">Read the community agreements</a></article></div></section>
<section class="section agreements" id="agreements"><div class="two-column-copy reveal"><div><p class="eyebrow">Community care agreements</p><h2>Belonging includes how we treat one another.</h2></div><div><p>This prototype reserves space for the actual RIM agreements from the CMS. They should be written plainly, kept short enough to read, and presented before the membership form—not hidden behind a checkbox.</p><p>The agreements should address confidentiality, wise speech, respect for difference, boundaries, non-harming, and how concerns are brought forward.</p><a class="text-link" href="#">Read the full agreements <span>→</span></a></div></div></section>
'''
page('join.html', 'Join RIM', join)

support = '''
<section class="inner-hero support-hero"><div class="inner-hero-copy reveal"><p class="eyebrow">Support RIM</p><h1>Generosity is one way practice moves outward.</h1><p>RIM is sustained by people offering what they genuinely can: presence, attention, practical help, teaching, care, and financial support.</p></div></section>
<section class="section dana-section"><div class="two-column-copy reveal"><div><p class="eyebrow">Dana</p><h2>Teachings offered freely, community sustained freely.</h2></div><div><p>Dana is a Pāli word for generosity. In the Buddhist tradition, teachings are offered without a price, and the community responds according to its means and appreciation.</p><p>A donation is never a fee for spiritual access. It helps sustain the center, teachers, technology, scholarships, and the conditions that let another person walk through the door.</p><a class="button primary" href="https://www.rootedinmindfulness.org/donate">Offer a donation</a></div></div></section>
<section class="section volunteer-section"><div class="center-heading reveal"><p class="eyebrow">Offer your presence</p><h2>Specific ways to help.</h2><p>Service is most supportive when expectations are concrete and honest.</p></div><div class="volunteer-grid reveal"><article><h3>Welcome team</h3><p>Greet people before gatherings and help newcomers understand the space.</p><span>About 20 minutes before a program</span></article><article><h3>Space care</h3><p>Help with cushions, tea, plants, light cleaning, or preparing the room.</p><span>Occasional or recurring</span></article><article><h3>Community communications</h3><p>Support the newsletter, calendar, or program information.</p><span>Remote-friendly</span></article><article><h3>Greater community service</h3><p>Help organize opportunities for the sangha to support local organizations.</p><span>Project-based</span></article></div><div class="section-end"><p>More roles can be populated from the volunteer CMS collection.</p><a class="button outline" href="mailto:support@rootedinmindfulness.org">Ask about volunteering</a></div></section>
'''
page('support.html', 'Support RIM', support)

login = '''
<section class="auth-page"><div class="auth-art"><div><p class="eyebrow light">Member area</p><h1>Your practice links, gathered in one place.</h1><p>Sign in for today’s Zoom sessions, registrations, learning resources, and community updates.</p></div></div><div class="auth-panel"><a class="back-link" href="index.html">← Back to public site</a><div class="auth-form"><p class="eyebrow">Welcome back</p><h2>Member sign in</h2><form><label>Email address<input type="email" autocomplete="email" placeholder="you@example.com" required></label><label>Password<input type="password" autocomplete="current-password" required></label><div class="form-between"><label class="check"><input type="checkbox"> Keep me signed in</label><a href="#">Forgot password?</a></div><a class="button primary full" href="member-dashboard.html">Sign in</a></form><p class="auth-switch">New to RIM? <a href="join.html">Create a free account</a></p><p class="auth-help">Having trouble? <a href="mailto:support@rootedinmindfulness.org">Contact support</a>.</p></div></div></section>
'''
page('login.html', 'Member sign in', login, body_class='auth-body')

dashboard = '''
<section class="dashboard-shell"><aside class="dashboard-nav"><a class="brand compact" href="index.html">''' + logo() + '''<span>RIM</span></a><nav><a class="active" href="member-dashboard.html">Today</a><a href="#upcoming">My programs</a><a href="teachings.html">Learning library</a><a href="#community">Community</a><a href="#account">Account</a></nav><a class="dashboard-exit" href="index.html">← Public site</a></aside><div class="dashboard-main"><header class="dashboard-header"><div><p class="eyebrow">Thursday, July 30</p><h1>Welcome, friend.</h1></div><button class="avatar">JF</button></header><section class="today-panel"><div class="panel-heading"><div><p class="eyebrow">Today at RIM</p><h2>Your session links.</h2></div><span class="live-status">Links open shortly before start</span></div><div class="session-list"><article><time>9:30 AM</time><div><h3>Essential Dharma Study</h3><p>Zoom · 60 minutes</p></div><a class="button primary" href="#">Join Zoom</a></article><article><time>7:30 PM</time><div><h3>Good Evening Silent Meditation</h3><p>Zoom · 30 minutes · Noble silence</p></div><a class="button outline" href="#">Join Zoom</a></article></div></section><section class="dashboard-grid" id="upcoming"><article class="dashboard-card"><p class="eyebrow">Coming up</p><h2>Saturday Meditation &amp; Dharma Talk</h2><p>Saturday, 9:30–10:45 AM<br>Brookfield + Zoom</p><a class="text-link" href="program-detail.html">View details <span>→</span></a></article><article class="dashboard-card"><p class="eyebrow">Continue learning</p><h2>The Handful of Leaves</h2><p>Resume the introductory learning path.</p><div class="progress"><span style="width:35%"></span></div><a class="text-link" href="teachings.html">Continue lesson <span>→</span></a></article><article class="dashboard-card" id="community"><p class="eyebrow">Community note</p><h2>Tea and conversation after Saturday practice</h2><p>Stay for a little while after the gathering. No registration needed.</p><a class="text-link" href="community.html">Community updates <span>→</span></a></article><article class="dashboard-card quiet-card" id="account"><p class="eyebrow">Need help?</p><h2>We are here.</h2><p>Questions about Zoom, registration, or your account can go to community support.</p><a class="text-link" href="mailto:support@rootedinmindfulness.org">Contact support <span>→</span></a></article></section></div></section>
'''
page('member-dashboard.html', 'Member dashboard', dashboard, body_class='dashboard-body')

readme = '''# Rooted in Mindfulness — Refined Site Concept

This is a separate refinement prototype. It does not overwrite the restored original or the first Version 2 concept.

## Content architecture

### Public journey
1. **Home** — emotional recognition, reassurance, one recommended gathering, weekly preview, depth, belonging.
2. **New Here** — literal first-visit expectations, practical questions, and one recommended first step.
3. **Programs** — CMS-driven directory with visible schedule, format, commitment, and dana information.
4. **This Week** — CMS-driven date view optimized for scanning in under ten seconds.
5. **Program Detail** — reusable CMS template modeled on a book jacket: promise, description, practical panel, experience, facilitator, CTA.
6. **Teachings** — freely offered resources and clear Buddhist roots.
7. **Community** — belonging, Kalyana Mitta, member voices, and deeper participation.
8. **About** — tradition, purpose, guiding teacher, and organizational grounding.
9. **Join RIM** — separates a free account from deeper community membership.
10. **Support RIM** — dana and specific volunteer paths.

### Member journey
11. **Login** — focused sign-in with no public-site distractions.
12. **Member Dashboard** — today’s links first, followed by upcoming programs, learning, and community notices.

## Navigation decision

Primary public navigation: **New here · Programs · This week · Teachings · Community · About**

A visually distinct **Member sign in** action is always available. Support and membership links are in the footer and contextual sections rather than competing with the first invitation to attend.

## CMS model

The prototype includes attributes such as `data-cms-template`, `data-cms-field`, `data-cms-block`, and `data-cms-collection` to show intended bindings.

Program cards and detail pages should share these fields:
- title
- slug
- type/category
- short description
- long description
- recurrence / dates
- start and end time
- timezone
- format
- location
- commitment level
- experience level
- dana / fee language
- primary CTA label and destination
- optional first-visit badge
- optional quote
- optional highlights
- one or more facilitators

Optional blocks should be conditionally removed when empty.

## Notes

- Newsletter, login, Zoom, account creation, registration, and donation actions are demonstration links.
- Weekly dates are static prototype content and should come from the event database in production.
- Actual community-care agreements should replace the placeholder copy on `join.html`.
- The design deliberately uses member voices and transparent descriptions while original community photography is not yet available.
'''
(OUT / 'README.md').write_text(readme, encoding='utf-8')
