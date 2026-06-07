/* Documentation page behaviour: scrollspy, TOC toggle, code copy. */
(function () {
  "use strict";

  /* ---------- Code block copy ---------- */
  var toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  document.querySelectorAll(".code .copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var block = btn.closest(".code");
      var pre = block && block.querySelector("pre");
      if (!pre) return;
      var text = pre.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { showToast("Copied to clipboard"); });
      } else {
        showToast("Copy failed");
      }
    });
  });

  /* ---------- TOC toggle (mobile) ---------- */
  var side = document.getElementById("docsSide");
  var tocToggle = document.getElementById("tocToggle");
  if (side && tocToggle) {
    tocToggle.addEventListener("click", function () {
      var open = side.classList.toggle("open");
      tocToggle.setAttribute("aria-expanded", String(open));
    });
    side.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 860px)").matches) {
          side.classList.remove("open");
          tocToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  /* ---------- Scrollspy ---------- */
  var sideLinks = Array.prototype.slice.call(
    document.querySelectorAll(".docs-side a[href^='#']")
  );
  var byId = {};
  var sections = [];
  sideLinks.forEach(function (a) {
    var id = a.getAttribute("href").slice(1);
    var sec = document.getElementById(id);
    if (sec) {
      byId[id] = a;
      sections.push(sec);
    }
  });

  function setActive(id) {
    sideLinks.forEach(function (a) { a.classList.remove("active"); });
    if (byId[id]) byId[id].classList.add("active");
  }

  if ("IntersectionObserver" in window && sections.length) {
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0;
      });
      // Pick the most-visible section.
      var bestId = null, best = 0;
      Object.keys(visible).forEach(function (id) {
        if (visible[id] > best) { best = visible[id]; bestId = id; }
      });
      if (bestId) setActive(bestId);
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] });

    sections.forEach(function (s) { spy.observe(s); });
  }
})();
