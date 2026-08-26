/* NeuroBat Lab · shared behaviors */
(function () {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Page load / transitions ---------- */
  window.addEventListener("pageshow", () => {
    document.body.classList.remove("is-leaving");
    document.body.classList.add("is-loaded");
  });
  requestAnimationFrame(() => document.body.classList.add("is-loaded"));

  /* ---------- Reduced motion: stop SVG SMIL animations ---------- */
  if (reduced) {
    document.querySelectorAll("svg").forEach((s) => { if (s.pauseAnimations) s.pauseAnimations(); });
  }

  document.querySelectorAll('a[href$=".html"], a[href="index.html"]').forEach((a) => {
    const url = new URL(a.getAttribute("href"), location.href);
    if (url.origin !== location.origin) return;
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduced) return;
      e.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(() => (location.href = a.href), 280);
    });
  });

  /* ---------- Nav ---------- */
  const nav = document.querySelector(".nav");
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    if (y > 300 && y > lastY + 4) nav.classList.add("is-hidden");
    else if (y < lastY - 4 || y < 300) nav.classList.remove("is-hidden");
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* keyboard focus into the nav must always reveal it */
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    links.classList.toggle("is-open", open);
    nav.classList.toggle("menu-open", open);
    document.documentElement.classList.toggle("scroll-lock", open);
    if (open) {
      nav.classList.remove("is-hidden");
      links.querySelectorAll("li").forEach((li, i) => (li.style.transitionDelay = 60 + i * 45 + "ms"));
    }
  }
  if (toggle) {
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setMenu(false);
    });
  }

  /* ---------- Scroll reveals ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    group.querySelectorAll("[data-reveal]").forEach((el, i) => el.style.setProperty("--rd", i * 0.09 + "s"));
  });

  /* ---------- Custom cursor ---------- */
  if (finePointer && !reduced) {
    document.body.classList.add("has-cursor-fx");
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    document.body.append(dot, ring);
    let mx = -100, my = -100, rx = -100, ry = -100, cursorRaf = null;
    function cursorLoop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      if (Math.abs(mx - rx) + Math.abs(my - ry) < 0.1) {
        rx = mx; ry = my;
        cursorRaf = null;
        return;
      }
      cursorRaf = requestAnimationFrame(cursorLoop);
    }
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (cursorRaf === null) cursorRaf = requestAnimationFrame(cursorLoop);
    }, { passive: true });
    const hoverables = "a, button, .card, .pub-row, .person";
    document.addEventListener("mouseover", (e) => { if (e.target.closest(hoverables)) ring.classList.add("is-hover"); });
    document.addEventListener("mouseout", (e) => { if (e.target.closest(hoverables)) ring.classList.remove("is-hover"); });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduced) {
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18;
        const y = (e.clientY - r.top - r.height / 2) * 0.3;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener("mouseleave", () => (btn.style.transform = ""));
    });
  }

  /* ---------- Venn interaction ---------- */
  const venn = document.querySelector(".venn-svg");
  if (venn) {
    const items = document.querySelectorAll(".venn-item");
    const buttons = document.querySelectorAll(".venn-legend button");
    const circles = { ni: venn.querySelector("[data-c='ni']"), nb: venn.querySelector("[data-c='nb']"), st: venn.querySelector("[data-c='st']") };
    function activate(key) {
      items.forEach((it) => it.classList.toggle("is-active", it.dataset.v === key));
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === key)));
      venn.classList.toggle("has-focus", key !== "core");
      Object.entries(circles).forEach(([k, c]) => {
        if (!c) return;
        c.classList.toggle("is-focus", k === key);
        c.setAttribute("aria-pressed", String(k === key));
      });
    }
    activate("core");
    buttons.forEach((b) => b.addEventListener("click", () => activate(b.dataset.v)));
    Object.entries(circles).forEach(([k, c]) => {
      if (!c) return;
      c.addEventListener("mouseenter", () => activate(k));
      c.addEventListener("click", () => activate(k));
      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(k); }
      });
    });
    const core = venn.querySelector("[data-c='core']");
    if (core) core.addEventListener("mouseenter", () => activate("core"));
  }

  /* ---------- Dimensions interaction (drives the dim canvas) ---------- */
  const dimChips = document.querySelectorAll(".dim-chip");
  if (dimChips.length) {
    let locked = null;
    function render(previewKey) {
      const key = previewKey || locked || null;
      if (window.__dimSet) window.__dimSet(key);
      dimChips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.d === locked)));
    }
    render(null);
    dimChips.forEach((chip) => {
      chip.addEventListener("mouseenter", () => render(chip.dataset.d));
      chip.addEventListener("focus", () => render(chip.dataset.d));
      chip.addEventListener("click", () => {
        locked = locked === chip.dataset.d ? null : chip.dataset.d;
        render(locked ? chip.dataset.d : null);
      });
    });
    const chipsWrap = document.querySelector(".dim-chips");
    if (chipsWrap) chipsWrap.addEventListener("mouseleave", () => render(null));
  }

  /* ---------- Auto-playing videos: reduced motion + offscreen pause ---------- */
  document.querySelectorAll(".auto-video").forEach((v) => {
    if (reduced) { v.pause(); return; }
    let inView = false;
    const vio = new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView) { v.preload = "auto"; v.play().catch(() => {}); }
      else v.pause();
    }, { threshold: 0.1 });
    vio.observe(v);
    /* self-healing loop: restart on end, resume if paused, and un-stick
       stalled decoding (a stalled video is not "paused", so track progress) */
    v.addEventListener("ended", () => { v.currentTime = 0; v.play().catch(() => {}); });
    let lastT = -1, stuck = 0;
    setInterval(() => {
      if (!inView || document.hidden) return;
      if (v.paused) { v.play().catch(() => {}); return; }
      if (v.currentTime === lastT) {
        stuck++;
        if (stuck >= 2) {
          stuck = 0;
          if (v.duration && v.currentTime > v.duration - 0.5) v.currentTime = 0;
          v.play().catch(() => {});
        }
      } else { stuck = 0; }
      lastT = v.currentTime;
    }, 1500);
  });

  /* ---------- Interactive timeline (research toolkit) ---------- */
  /* question landscape: hovering a territory name or peak lights its terrain */
  document.querySelectorAll(".qterrain").forEach((plot) => {
    const glows = plot.querySelectorAll(".qglow");
    const labels = plot.querySelectorAll(".qterr[data-fam]");
    const set = (fams) => {
      glows.forEach((g) => g.classList.toggle("is-on", fams.includes(g.dataset.fam)));
      labels.forEach((l) => l.classList.toggle("is-lit", fams.includes(l.dataset.fam)));
    };
    plot.querySelectorAll("[data-fam]").forEach((el) => {
      if (el.classList.contains("qglow")) return;
      const fams = el.dataset.fam.split(" ");
      el.addEventListener("mouseenter", () => set(fams));
      el.addEventListener("mouseleave", () => set([]));
      el.addEventListener("focus", () => set(fams));
      el.addEventListener("blur", () => set([]));
    });
  });

  document.querySelectorAll(".ttl").forEach((ttl) => {
    const ttlNodes = ttl.querySelectorAll(".ttl-node");
    if (!ttlNodes.length) return;
    const ttlDetails = ttl.querySelectorAll(".ttl-detail");
    function ttlSet(i) {
      ttlNodes.forEach((n) => {
        const on = n.dataset.i === String(i);
        n.classList.toggle("is-active", on);
        n.setAttribute("aria-pressed", String(on));
      });
      ttlDetails.forEach((d) => d.classList.toggle("is-active", d.dataset.i === String(i)));
    }
    let walking = null;
    function stopWalk() {
      if (walking) { clearInterval(walking); walking = null; }
    }
    ttlNodes.forEach((n) => {
      n.addEventListener("mouseenter", () => { stopWalk(); ttlSet(n.dataset.i); });
      n.addEventListener("focus", () => { stopWalk(); ttlSet(n.dataset.i); });
      n.addEventListener("click", () => { stopWalk(); ttlSet(n.dataset.i); });
    });
    /* rest on the newest real entry by default... */
    ttlSet(ttlNodes.length - 2);
    /* ...then, on first sight, walk the whole history once */
    if (!reduced) {
      let walked = false;
      const wio = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting || walked) return;
        walked = true;
        wio.disconnect();
        let i = 0;
        ttlSet(0);
        walking = setInterval(() => {
          i++;
          if (i >= ttlNodes.length) { stopWalk(); return; }
          ttlSet(i);
        }, 750);
      }, { threshold: 0.6 });
      wio.observe(ttl);
    }
  });

  /* ---------- Photo fallbacks ---------- */
  document.querySelectorAll(".photo-frame img").forEach((img) => {
    img.addEventListener("error", () => img.closest(".photo-frame").classList.add("missing"));
    if (img.complete && img.naturalWidth === 0) img.closest(".photo-frame").classList.add("missing");
  });

  /* ---------- Gentle parallax ---------- */
  if (finePointer && !reduced) {
    const plx = document.querySelectorAll("[data-plx]");
    if (plx.length) {
      window.addEventListener(
        "scroll",
        () => {
          const vh = window.innerHeight;
          plx.forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.bottom < 0 || r.top > vh) return;
            const p = (r.top + r.height / 2 - vh / 2) / vh;
            el.style.transform = `translateY(${p * parseFloat(el.dataset.plx || 30)}px)`;
          });
        },
        { passive: true }
      );
    }
  }

  /* ---------- Featured flight video: hover loop + modal ---------- */
  const fwCard = document.querySelector(".fw-video-card");
  if (fwCard) {
    let vm = null;
    function openModal() {
      if (!vm) {
        vm = document.createElement("div");
        vm.className = "vmodal";
        vm.setAttribute("role", "dialog");
        vm.setAttribute("aria-label", "Flight tracking video");
        vm.innerHTML = '<video src="assets/flight-tracking.mp4?v=1787587069" poster="assets/img/flight-tracking-poster.jpg" controls playsinline></video><button class="lb-btn" aria-label="Close video">Close ✕</button>';
        document.body.appendChild(vm);
        vm.querySelector(".lb-btn").addEventListener("click", closeModal);
        vm.addEventListener("click", (e) => { if (e.target === vm) closeModal(); });
      }
      vm.classList.add("is-open");
      document.documentElement.classList.add("scroll-lock");
      const v = vm.querySelector("video");
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    function closeModal() {
      if (!vm) return;
      vm.querySelector("video").pause();
      vm.classList.remove("is-open");
      document.documentElement.classList.remove("scroll-lock");
    }
    fwCard.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; /* Read paper link passes through */
      openModal();
    });
    fwCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && vm && vm.classList.contains("is-open")) closeModal();
    });
  }

  /* ---------- Album lightbox ---------- */
  const phs = [...document.querySelectorAll(".album-ph")];
  if (phs.length) {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-label", "Photo viewer");
    lb.innerHTML = '<img alt=""/><button class="lb-btn lb-close" aria-label="Close">Close ✕</button><button class="lb-btn lb-prev" aria-label="Previous photo">←</button><button class="lb-btn lb-next" aria-label="Next photo">→</button><span class="lb-count"></span>';
    document.body.appendChild(lb);
    const lbImg = lb.querySelector("img");
    const lbCount = lb.querySelector(".lb-count");
    let idx = 0;
    function show(i) {
      idx = (i + phs.length) % phs.length;
      lbImg.src = phs[idx].querySelector("img").src;
      lbCount.textContent = (idx + 1) + " / " + phs.length;
    }
    function openLb(i) { show(i); lb.classList.add("is-open"); document.documentElement.classList.add("scroll-lock"); }
    function closeLb() { lb.classList.remove("is-open"); document.documentElement.classList.remove("scroll-lock"); }
    phs.forEach((ph, i) => ph.addEventListener("click", () => openLb(i)));
    lb.querySelector(".lb-close").addEventListener("click", closeLb);
    lb.querySelector(".lb-prev").addEventListener("click", (e) => { e.stopPropagation(); show(idx - 1); });
    lb.querySelector(".lb-next").addEventListener("click", (e) => { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
