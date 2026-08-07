const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');

if (navToggle && nav) {
  const closeMenu = () => {
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
}

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  revealItems.forEach(item => observer.observe(item));
} else {
  revealItems.forEach(item => item.classList.add('visible'));
}

const filters = document.querySelectorAll('.filter[data-filter]');
const programCards = document.querySelectorAll('.program-card[data-category]');
filters.forEach(filter => {
  filter.addEventListener('click', () => {
    filters.forEach(button => button.classList.remove('active'));
    filter.classList.add('active');
    const value = filter.dataset.filter;
    programCards.forEach(card => {
      card.hidden = value !== 'all' && card.dataset.category !== value;
    });
  });
});

const newsletter = document.querySelector('.newsletter-form');
if (newsletter) {
  newsletter.addEventListener('submit', event => {
    event.preventDefault();
    const message = newsletter.querySelector('.form-message');
    if (message) message.textContent = 'Thank you. This prototype form is ready to connect to the RIM newsletter system.';
  });
}

/* ── RIM three-door menu ─────────────────────────────────────── */
(function () {
  var triggers = Array.prototype.slice.call(document.querySelectorAll('.nav-door__trigger'));
  if (!triggers.length) return;

  function closeAll(except) {
    triggers.forEach(function (t) {
      if (t === except) return;
      t.setAttribute('aria-expanded', 'false');
      var m = document.getElementById(t.getAttribute('aria-controls'));
      if (m) m.setAttribute('data-open', 'false');
    });
  }

  triggers.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = t.getAttribute('aria-expanded') === 'true';
      closeAll(t);
      t.setAttribute('aria-expanded', String(!open));
      var m = document.getElementById(t.getAttribute('aria-controls'));
      if (m) m.setAttribute('data-open', String(!open));
    });
  });

  document.addEventListener('click', function () { closeAll(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll(null);
  });
})();
