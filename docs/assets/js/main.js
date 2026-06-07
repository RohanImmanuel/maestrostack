/* MaestroStack site behaviour: scroll reveals, terminal typing, nav, copy.
   All animation is transform/opacity only and disabled under reduced motion. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Sticky nav state ---------- */
  var nav = document.getElementById("nav");
  function onScrollNav() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 24);
  }

  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.getElementById("navToggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- Terminal typing ---------- */
  var term = document.getElementById("termBody");
  if (term) {
    var lines = [
      { t: "$ ", c: "c-prompt" }, { t: "maestrostack run\n", c: "" },
      { t: "Uploading app: ./apps/app-release.apk\n", c: "c-dim" },
      { t: "Uploading test suite (3 flows)\n", c: "c-dim" },
      { t: "Starting android build\n", c: "c-dim" },
      { t: "\nMaestroStack run started\n", c: "c-ok" },
      { t: "\nProject: Maestro_Test\n", c: "" },
      { t: "Platform: android\n", c: "" },
      { t: "Devices:\n- Samsung Galaxy S20-10.0\n- Google Pixel 7-13.0\n", c: "" },
      { t: "\nApp: bs://5c5ab4...\n", c: "c-dim" },
      { t: "Test suite: bs://89c874...\n", c: "c-dim" },
      { t: "Build ID: 5c5ab4338cec13aeb78f7a69\n", c: "c-id" }
    ];

    if (reduceMotion) {
      term.innerHTML = lines.map(function (l) {
        return l.c ? '<span class="' + l.c + '">' + l.t + "</span>" : l.t;
      }).join("");
    } else {
      typeLines(term, lines);
    }
  }

  function typeLines(target, segments) {
    var si = 0, ci = 0;
    var cursor = document.createElement("span");
    cursor.className = "term-cursor";

    function step() {
      if (si >= segments.length) {
        target.appendChild(cursor);
        return;
      }
      var seg = segments[si];
      if (ci === 0) {
        var span = document.createElement("span");
        if (seg.c) span.className = seg.c;
        seg._node = span;
        target.appendChild(span);
      }
      seg._node.textContent += seg.t.charAt(ci);
      ci++;
      if (ci >= seg.t.length) { si++; ci = 0; }
      // Faster on whitespace-heavy output so it stays snappy.
      var delay = seg.t.charAt(ci - 1) === "\n" ? 90 : 16;
      setTimeout(step, delay);
    }
    step();
  }

  /* ---------- Copy to clipboard ---------- */
  var toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  document.querySelectorAll("[data-copy]").forEach(function (el) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    function flashCopied() {
      el.classList.add("copied");
      clearTimeout(el._copiedT);
      el._copiedT = setTimeout(function () { el.classList.remove("copied"); }, 1600);
    }
    function copy() {
      var text = el.getAttribute("data-copy");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { showToast("Copied to clipboard"); flashCopied(); });
      } else {
        showToast("Copy: " + text);
      }
    }
    el.addEventListener("click", copy);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); }
    });
  });

  /* ---------- Footer year (if present) ---------- */
  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
