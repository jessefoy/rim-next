/**
 * rim-connect.js v2
 * Populates Webflow elements with data from RIM Next API endpoints.
 *
 * LIST pages (programs listing):
 *   data-rim-list="{collection}"         — container; fetches array and clones template
 *   data-rim-item                         — item template (cloned per result)
 *
 * DETAIL pages (single program):
 *   data-rim-page="{collection}"         — on <body> or any wrapper; reads ?slug= from URL
 *
 * Field binding (works inside both list items and detail pages):
 *   data-rim-field="{path}"              — sets textContent (dot notation: "category.name")
 *   data-rim-html="{path}"              — sets innerHTML (for rich text / descriptionHtml)
 *   data-rim-href="{template}"           — sets href; [fieldName] tokens replaced with values
 *   data-rim-src="{path}"               — sets src attribute
 *   data-rim-show="{path}"              — shows element only when field is truthy
 *   data-rim-hide="{path}"              — hides element when field is truthy
 *
 * State elements (inside data-rim-list containers):
 *   data-rim-state="loading|empty|error" — shown/hidden automatically
 */

(function () {
  "use strict";

  var BASE_URL = "https://rim-next.vercel.app";

  var ENDPOINTS = {
    programs: BASE_URL + "/api/public/programs",
  };

  // ── Utilities ────────────────────────────────────────────────────────────────

  function get(obj, path) {
    return path.split(".").reduce(function (v, k) {
      return v != null ? v[k] : undefined;
    }, obj);
  }

  function interpolate(template, item) {
    return template.replace(/\[(\w+)\]/g, function (_, key) {
      var val = item[key];
      return val != null ? String(val) : "";
    });
  }

  // ── Field population ─────────────────────────────────────────────────────────

  function populateFields(root, item) {
    // data-rim-field — textContent
    root.querySelectorAll("[data-rim-field]").forEach(function (el) {
      var val = get(item, el.getAttribute("data-rim-field"));
      el.textContent = val != null ? String(val) : "";
    });

    // data-rim-html — innerHTML (rich text)
    root.querySelectorAll("[data-rim-html]").forEach(function (el) {
      var val = get(item, el.getAttribute("data-rim-html"));
      el.innerHTML = val != null ? String(val) : "";
    });

    // data-rim-href — href with [token] interpolation
    root.querySelectorAll("[data-rim-href]").forEach(function (el) {
      el.href = interpolate(el.getAttribute("data-rim-href"), item);
    });
    if (root.hasAttribute && root.hasAttribute("data-rim-href")) {
      root.href = interpolate(root.getAttribute("data-rim-href"), item);
    }

    // data-rim-src — src attribute
    root.querySelectorAll("[data-rim-src]").forEach(function (el) {
      var val = get(item, el.getAttribute("data-rim-src"));
      if (val) {
        el.src = String(val);
        el.style.display = "";
      } else {
        el.style.display = "none";
      }
    });

    // data-rim-show — visible only when field is truthy
    root.querySelectorAll("[data-rim-show]").forEach(function (el) {
      var val = get(item, el.getAttribute("data-rim-show"));
      el.style.display = val ? "" : "none";
    });

    // data-rim-hide — hidden when field is truthy
    root.querySelectorAll("[data-rim-hide]").forEach(function (el) {
      var val = get(item, el.getAttribute("data-rim-hide"));
      el.style.display = val ? "none" : "";
    });
  }

  // ── List pages ───────────────────────────────────────────────────────────────

  function showState(container, state) {
    container.querySelectorAll("[data-rim-state]").forEach(function (el) {
      el.style.display = el.getAttribute("data-rim-state") === state ? "" : "none";
    });
  }

  function hideAllStates(container) {
    container.querySelectorAll("[data-rim-state]").forEach(function (el) {
      el.style.display = "none";
    });
  }

  function renderList(container, items) {
    var template = container.querySelector("[data-rim-item]");
    if (!template) return;

    container.querySelectorAll("[data-rim-clone]").forEach(function (el) {
      el.parentNode.removeChild(el);
    });

    if (items.length === 0) {
      showState(container, "empty");
      return;
    }

    hideAllStates(container);

    items.forEach(function (item) {
      var clone = template.cloneNode(true);
      clone.removeAttribute("data-rim-item");
      clone.setAttribute("data-rim-clone", "");
      clone.style.display = "";
      populateFields(clone, item);
      container.appendChild(clone);
    });
  }

  function initList(container) {
    var collection = container.getAttribute("data-rim-list");
    var url = ENDPOINTS[collection];
    if (!url) {
      console.warn("rim-connect: no endpoint for collection \"" + collection + "\"");
      return;
    }

    var template = container.querySelector("[data-rim-item]");
    if (template) template.style.display = "none";

    showState(container, "loading");

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data[collection] || []);
        renderList(container, items);
      })
      .catch(function (err) {
        console.error("rim-connect: fetch failed for \"" + collection + "\"", err);
        showState(container, "error");
      });
  }

  // ── Detail pages ─────────────────────────────────────────────────────────────

  function initPage(el) {
    var collection = el.getAttribute("data-rim-page");
    var base = ENDPOINTS[collection];
    if (!base) {
      console.warn("rim-connect: no endpoint for page collection \"" + collection + "\"");
      return;
    }

    // Read slug from ?slug= query param
    var slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      console.warn("rim-connect: no ?slug= in URL for data-rim-page");
      return;
    }

    fetch(base + "/" + encodeURIComponent(slug))
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (item) {
        populateFields(el, item);
      })
      .catch(function (err) {
        console.error("rim-connect: page fetch failed", err);
      });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll("[data-rim-list]").forEach(initList);
    document.querySelectorAll("[data-rim-page]").forEach(initPage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
