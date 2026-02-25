/**
 * nav.js — RIM Website navigation
 *
 * Loaded BEFORE webflow.js (see base.njk) so our DOMContentLoaded handlers
 * register first. stopImmediatePropagation on hamburger and dropdown clicks
 * prevents webflow.js from double-handling those same events.
 */
document.addEventListener('DOMContentLoaded', function () {

  // ── Desktop dropdowns ────────────────────────────────────────
  // CSS handles hover (custom.css). JS handles click + outside-close.

  document.querySelectorAll('.w-dropdown').forEach(function (dropdown) {
    var toggle = dropdown.querySelector('.w-dropdown-toggle');
    var list   = dropdown.querySelector('.w-dropdown-list');
    if (!toggle || !list) return;

    toggle.addEventListener('click', function (e) {
      e.stopImmediatePropagation(); // prevents webflow.js handler from also firing
      e.stopPropagation();
      var isOpen = dropdown.classList.contains('w--open');

      closeAllDropdowns();

      if (!isOpen) {
        dropdown.classList.add('w--open');
        list.classList.add('w--open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });


  // ── Mobile hamburger ─────────────────────────────────────────

  document.querySelectorAll('.w-nav-button').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopImmediatePropagation(); // prevents webflow.js handler from also firing
      e.stopPropagation();          // prevents document close handler from firing
      var nav  = this.closest('.w-nav');
      var menu = nav ? nav.querySelector('.w-nav-menu') : null;
      if (!menu) return;

      var isOpen = menu.classList.contains('w--open');
      menu.classList.toggle('w--open', !isOpen);
      this.classList.toggle('w--open', !isOpen);
      this.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  // Close mobile menu when a nav link inside it is tapped
  document.querySelectorAll('.mobile-nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      closeAllMobileMenus();
    });
  });


  // ── Global close handlers ────────────────────────────────────
  // These only fire for clicks that were NOT stopPropagated above.

  document.addEventListener('click', function (e) {
    closeAllDropdowns();
    if (!e.target.closest('.w-nav')) {
      closeAllMobileMenus();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeAllMobileMenus();
    }
  });


  // ── Helpers ──────────────────────────────────────────────────

  function closeAllDropdowns() {
    document.querySelectorAll('.w-dropdown.w--open').forEach(function (d) {
      d.classList.remove('w--open');
      var list   = d.querySelector('.w-dropdown-list');
      var toggle = d.querySelector('.w-dropdown-toggle');
      if (list)   list.classList.remove('w--open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function closeAllMobileMenus() {
    document.querySelectorAll('.w-nav-menu.w--open').forEach(function (menu) {
      menu.classList.remove('w--open');
    });
    document.querySelectorAll('.w-nav-button.w--open').forEach(function (btn) {
      btn.classList.remove('w--open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

});
