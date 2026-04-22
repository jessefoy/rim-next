/**
 * rim-connect.js v1
 * Populates Webflow elements with data from RIM Next API endpoints.
 *
 * Attribute vocabulary (v1):
 *   data-rim-list="{collection}"   — list container; triggers a fetch
 *   data-rim-item                  — item template inside the container (cloned per result)
 *   data-rim-field="{path}"        — sets textContent from a field (dot notation supported)
 *   data-rim-href="{template}"     — sets href; [fieldName] tokens are replaced with field values
 *   data-rim-src="{path}"          — sets src from a field
 *   data-rim-state="loading|empty|error" — state elements shown/hidden automatically
 */

(function () {
  "use strict";

  var BASE_URL = "https://rim-next.vercel.app";

  var ENDPOINTS = {
    programs: BASE_URL + "/api/public/programs",
  };

  // Resolve a dot-notation path against an object: get(obj, "category.name")
  function get(obj, path) {
    return path.split(".").reduce(function (v, k) {
      return v != null ? v[k] : undefined;
    }, obj);
  }

  // Replace [token] placeholders in a string with field values from an item
  function interpolate(template, item) {
    return template.replace(/\[(\w+)\]/g, function (_, key) {
      var val = item[key];
      return val != null ? String(val) : "";
    });
  }

  function showState(container, state) {
    var states = container.querySelectorAll("[data-rim-state]");
    states.forEach(function (el) {
      el.style.display = el.getAttribute("data-rim-state") === state ? "" : "none";
    });
  }

  function hideAllStates(container) {
    var states = container.querySelectorAll("[data-rim-state]");
    states.forEach(function (el) {
      el.style.display = "none";
    });
  }

  function renderList(container, items) {
    var template = container.querySelector("[data-rim-item]");
    if (!template) return;

    // Remove any previously rendered clones (but not the template itself)
    var existing = container.querySelectorAll("[data-rim-clone]");
    existing.forEach(function (el) { el.parentNode.removeChild(el); });

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

      // data-rim-field — set textContent
      clone.querySelectorAll("[data-rim-field]").forEach(function (el) {
        var path = el.getAttribute("data-rim-field");
        var val = get(item, path);
        el.textContent = val != null ? String(val) : "";
      });

      // data-rim-href — set href with [token] interpolation
      clone.querySelectorAll("[data-rim-href]").forEach(function (el) {
        var tmpl = el.getAttribute("data-rim-href");
        el.href = interpolate(tmpl, item);
      });
      // Also handle the clone root if it has data-rim-href
      if (clone.hasAttribute("data-rim-href")) {
        clone.href = interpolate(clone.getAttribute("data-rim-href"), item);
      }

      // data-rim-src — set src
      clone.querySelectorAll("[data-rim-src]").forEach(function (el) {
        var path = el.getAttribute("data-rim-src");
        var val = get(item, path);
        if (val) {
          el.src = String(val);
        } else {
          el.style.display = "none";
        }
      });

      container.appendChild(clone);
    });
  }

  function initList(container) {
    var collection = container.getAttribute("data-rim-list");
    var url = ENDPOINTS[collection];
    if (!url) {
      console.warn("rim-connect: no endpoint registered for collection \"" + collection + "\"");
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
        // Support both { programs: [...] } and flat array responses
        var items = Array.isArray(data) ? data : (data[collection] || []);
        renderList(container, items);
      })
      .catch(function (err) {
        console.error("rim-connect: fetch failed for \"" + collection + "\"", err);
        showState(container, "error");
      });
  }

  function init() {
    var lists = document.querySelectorAll("[data-rim-list]");
    lists.forEach(initList);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
