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
    admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v5c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10V6l-8-3Z"></path><path d="M9 12l2 2 4-5"></path></svg>'
  };

  function readSavedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function preferredTheme() {
    const saved = readSavedTheme();
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme, persist = false) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) { try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {} }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#090b10" : "#f4f2ec";
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      const dark = theme === "dark";
      button.innerHTML = `${dark ? icons.sun : icons.moon}<span>${dark ? "Light" : "Dark"}</span>`;
      button.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
      button.title = `Switch to ${dark ? "light" : "dark"} mode`;
    });
  }

  function toggleTheme() {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  }

  function injectThemeToggle() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector("[data-theme-toggle]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.dataset.themeToggle = "";
    button.addEventListener("click", toggleTheme);
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
      mobileLink("planner.html", "Planner", "planner", ["planner.html"]),
      mobileLink("calendar.html", "Calendar", "calendar", ["calendar.html"]),
      mobileLink("admin.html", "Admin", "admin", ["admin.html"])
    ].join("");
    document.body.appendChild(nav);
  }

  applyTheme(preferredTheme());
  document.addEventListener("DOMContentLoaded", () => {
    injectThemeToggle();
    injectMobileNavigation();
    applyTheme(root.dataset.theme || preferredTheme());
  });

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", () => {
      if (!readSavedTheme()) applyTheme(media.matches ? "dark" : "light");
    });
  }
})();
