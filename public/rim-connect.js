/**
 * rim-connect.js v3
 * Populates Webflow elements with data from RIM Next API endpoints.
 *
 * FLAT LIST (simple program list):
 *   data-rim-list="{collection}"         — container; fetches array and clones template
 *   data-rim-item                         — item template (cloned per result)
 *
 * GROUPED LIST (programs grouped by category):
 *   data-rim-group-list="{collection}"   — outer container
 *   data-rim-group-item                  — category template (cloned per category)
 *   data-rim-group-field="{path}"        — field on the category template (e.g. "name")
 *   data-rim-items                       — program list wrapper inside the category template
 *   data-rim-item                        — program template inside data-rim-items
 *
 * DETAIL pages (single program):
 *   data-rim-page="{collection}"         — on <body> or any wrapper; reads ?slug= from URL
 *
 * Field binding (works everywhere):
 *   data-rim-field="{path}"              — sets textContent (dot notation: "category.name")
 *   data-rim-html="{path}"              — sets innerHTML (for rich text / descriptionHtml)
 *   data-rim-href="{template}"           — sets href; [fieldName] tokens replaced with values
 *   data-rim-src="{path}"               — sets src attribute
 *   data-rim-bg="{path}"                — swaps the url() portion of the element's
 *                                         background-image. All other background
 *                                         settings (size, position, repeat, gradient
 *                                         overlays) come from Webflow Designer — JS
 *                                         does not override them. If Designer sets
 *                                         "linear-gradient(teal, teal), url(default.jpg)"
 *                                         then only url(default.jpg) is replaced.
 *   data-rim-show="{path}"              — shows element only when field is truthy
 *   data-rim-hide="{path}"              — hides element when field is truthy
 *
 * State elements (inside data-rim-list or data-rim-group-list containers):
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

    // data-rim-bg — swap the url() in background-image, preserve everything else
    function applyBg(el, val) {
      if (!val) return;
      var safe = String(val).replace(/'/g, "\\'");
      var newUrl = "url('" + safe + "')";
      var current = window.getComputedStyle(el).backgroundImage;
      el.style.backgroundImage =
        current && current !== "none" && current.indexOf("url(") !== -1
          ? current.replace(/url\([^)]+\)/, newUrl)
          : newUrl;
    }
    root.querySelectorAll("[data-rim-bg]").forEach(function (el) {
      applyBg(el, get(item, el.getAttribute("data-rim-bg")));
    });
    if (root.hasAttribute && root.hasAttribute("data-rim-bg")) {
      applyBg(root, get(item, root.getAttribute("data-rim-bg")));
    }

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

  // ── Grouped list pages ───────────────────────────────────────────────────────

  function renderGroupedList(container, groups) {
    var groupTemplate = container.querySelector("[data-rim-group-item]");
    if (!groupTemplate) return;

    container.querySelectorAll("[data-rim-group-clone]").forEach(function (el) {
      el.parentNode.removeChild(el);
    });

    if (groups.length === 0) {
      showState(container, "empty");
      return;
    }

    hideAllStates(container);

    groups.forEach(function (group) {
      var groupClone = groupTemplate.cloneNode(true);
      groupClone.removeAttribute("data-rim-group-item");
      groupClone.setAttribute("data-rim-group-clone", "");
      groupClone.style.display = "";

      // Populate category-level fields
      groupClone.querySelectorAll("[data-rim-group-field]").forEach(function (el) {
        var path = el.getAttribute("data-rim-group-field");
        var val = get(group, path);
        el.textContent = val != null ? String(val) : "";
      });

      // Find the program list wrapper inside this category clone
      var itemsWrapper = groupClone.querySelector("[data-rim-items]");
      var programTemplate = itemsWrapper
        ? itemsWrapper.querySelector("[data-rim-item]")
        : groupClone.querySelector("[data-rim-item]");

      if (programTemplate) {
        programTemplate.style.display = "none";
        var programs = group.programs || [];
        programs.forEach(function (program) {
          var progClone = programTemplate.cloneNode(true);
          progClone.removeAttribute("data-rim-item");
          progClone.setAttribute("data-rim-clone", "");
          progClone.style.display = "";
          populateFields(progClone, program);
          var parent = itemsWrapper || programTemplate.parentNode;
          parent.appendChild(progClone);
        });
      }

      container.appendChild(groupClone);
    });
  }

  function initGroupedList(container) {
    var collection = container.getAttribute("data-rim-group-list");
    var url = ENDPOINTS[collection];
    if (!url) {
      console.warn("rim-connect: no endpoint for grouped collection \"" + collection + "\"");
      return;
    }

    var groupTemplate = container.querySelector("[data-rim-group-item]");
    if (groupTemplate) groupTemplate.style.display = "none";

    showState(container, "loading");

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var groups = data.grouped || [];
        renderGroupedList(container, groups);
      })
      .catch(function (err) {
        console.error("rim-connect: grouped fetch failed for \"" + collection + "\"", err);
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
        el.setAttribute("data-rim-ready", "");
      })
      .catch(function (err) {
        console.error("rim-connect: page fetch failed", err);
        el.setAttribute("data-rim-ready", "");
      });
  }

  // ── Base styles ──────────────────────────────────────────────────────────────
  // Injected once so templates and state elements don't need display:none in
  // the designer. JS inline styles (showState, renderList) override as needed.

  (function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      "[data-rim-item],",
      "[data-rim-group-item],",
      "[data-rim-state] { display: none !important; }",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-field],",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-html],",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-href],",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-src],",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-bg],",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-show],",
      "[data-rim-page]:not([data-rim-ready]) [data-rim-hide] { opacity: 0; }",
      "[data-rim-page] [data-rim-field],",
      "[data-rim-page] [data-rim-html],",
      "[data-rim-page] [data-rim-href],",
      "[data-rim-page] [data-rim-src],",
      "[data-rim-page] [data-rim-bg],",
      "[data-rim-page] [data-rim-show],",
      "[data-rim-page] [data-rim-hide] { transition: opacity 180ms ease; }",
    ].join(" ");
    document.head.appendChild(style);
  })();

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll("[data-rim-list]").forEach(initList);
    document.querySelectorAll("[data-rim-group-list]").forEach(initGroupedList);
    document.querySelectorAll("[data-rim-page]").forEach(initPage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
