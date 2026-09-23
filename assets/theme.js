(() => {
  "use strict";

  const STORAGE_KEY = "asmeWorkspaceTheme";
  const root = document.documentElement;
  const page = location.pathname.split("/").pop() || "index.html";

  const icons = {
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H7v-7h10v7"></path></svg>',
    outreach: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H7l-3 3V4Z"></path><path d="m7 8 5 3 5-3"></path></svg>',
    planner: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M8 2v4M16 2v4M7 10h4M7 14h7"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path><path d="M8 14h2M12 14h2M16 14h1M8 17h2M12 17h2"></path></svg>',
    attendance: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><path d="M3.5 19c.8-3.5 2.7-5.2 5.5-5.2s4.7 1.7 5.5 5.2"></path><path d="m15.5 12 2 2 3.5-4"></path></svg>',
    games: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4"></rect><path d="M6 12h6M9 9v6M16 10h.01M18 14h.01"></path></svg>',
    reels: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"></rect><path d="m10 8 6 4-6 4Z"></path></svg>',
    admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v5c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10V6l-8-3Z"></path><path d="M9 12l2 2 4-5"></path></svg>'
  };

  function savedTheme() {
    try { return window.SponsorFlowStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function currentTheme() {
    return savedTheme() === "light" ? "light" : "dark";
  }

  function renderToggle(button, theme) {
    const dark = theme === "dark";
    button.innerHTML = `${dark ? icons.moon : icons.sun}<span>${dark ? "Dark" : "Light"}</span>`;
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  function applyTheme(theme, persist = false) {
    const safe = theme === "dark" ? "dark" : "light";
    root.dataset.theme = safe;
    root.style.colorScheme = safe;
    if (persist) {
      try { window.SponsorFlowStorage.setItem(STORAGE_KEY, safe); } catch (_) {}
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = safe === "dark" ? "#202431" : "#ffffff";
    document.querySelectorAll("[data-theme-toggle]").forEach(button => renderToggle(button, safe));
  }

  function injectThemeToggle() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector("[data-theme-toggle]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.dataset.themeToggle = "";
    button.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true));
    header.appendChild(button);
  }

  function mobileLink(href, label, icon, matches) {
    const active = matches.includes(page);
    return `<a class="mobile-app-link${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>${icons[icon]}<span>${label}</span></a>`;
  }

  function injectMobileNavigation() {
    if (document.querySelector(".mobile-app-nav")) return;
    const nav = document.createElement("nav");
    nav.className = "mobile-app-nav";
    nav.setAttribute("aria-label", "Mobile navigation");
    nav.innerHTML = [
      mobileLink("index.html", "Home", "home", ["", "index.html"]),
      mobileLink("outreach.html", "Outreach", "outreach", ["outreach.html"]),
      mobileLink("planner.html", "Projects", "planner", ["planner.html"]),
      mobileLink("calendar.html", "Calendar", "calendar", ["calendar.html"]),
      mobileLink("attendance.html", "Attend", "attendance", ["attendance.html"]),
      mobileLink("games.html", "Games", "games", ["games.html"]),
      mobileLink("reels.html", "Reels", "reels", ["reels.html"])
    ].join("");
    document.body.appendChild(nav);
    // Keep useful tap targets as the app grows. Scroll the current page into view.
    requestAnimationFrame(() => { const active = nav.querySelector('[aria-current]'); if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2; });
  }

  function enableMobileNavAutoHide() {
    const nav = document.querySelector(".mobile-app-nav");
    if (!nav || !window.matchMedia?.("(max-width: 720px)").matches) return;
    let lastY = Math.max(0, window.scrollY);
    let ticking = false;
    const update = () => {
      const currentY = Math.max(0, window.scrollY);
      const nearTop = currentY < 70;
      const nearBottom = currentY + window.innerHeight >= document.documentElement.scrollHeight - 48;
      if (nearTop || nearBottom || currentY < lastY - 8) nav.classList.remove("is-hidden-by-scroll");
      else if (currentY > lastY + 12 && !document.body.classList.contains("dialog-open")) nav.classList.add("is-hidden-by-scroll");
      lastY = currentY;
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  window.addEventListener("storage", event => { if (event.key === STORAGE_KEY) applyTheme(currentTheme()); });
  applyTheme(currentTheme());
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".site-header");
    if (header && !header.querySelector(".mobile-officer-link")) {
      const officer = document.createElement("a"); officer.href = "admin.html"; officer.className = "mobile-officer-link"; officer.textContent = "Admin"; header.appendChild(officer);
    }
    injectThemeToggle();
    injectMobileNavigation();

    applyTheme(currentTheme());
  });
})();
