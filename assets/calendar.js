(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const CLUB_BOARD_ID = "BOARD-CLUB-MASTER";
  const GENERAL_TEAM_ID = "TEAM-CLUB";
  const DEFAULT_TEAM_ORDER = [
    "TEAM-MECH",
    "TEAM-KART",
    "TEAM-ELEC",
    "TEAM-BATT",
    "TEAM-SOFTWARE",
    "TEAM-MFG",
    "TEAM-OPS"
  ];

  const state = {
    actorName: "",
    afterIdentity: null,
    teams: [],
    boards: [],
    tasks: [],
    calendars: [],
    calendarFeedBaseUrl: "",
    month: `${todayText().slice(0, 7)}-01`,
    scope: "all",
    selectedDate: "",
    editingTask: null,
    dirty: false,
    saving: false,
    view: "month",
    kind: "all"
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    restoreIdentity();
    state.view = window.SponsorFlowStorage.getItem("asmeCalendarView") || (isCompactCalendar() ? "agenda" : "month");
    setCalendarView(state.view);
    state.month = validDateOnly(window.SponsorFlowStorage.getItem("asmeCalendarMonth")) || state.month;
    state.scope = normalizeStoredScope(window.SponsorFlowStorage.getItem("asmeCalendarScope") || "all");
    if (!API || !API.configured()) {
      showConnectionError("SponsorFlow is not connected. Add the Apps Script web app URL to assets/config.js.");
      return;
    }
    await loadCalendar();
  }

  function bindEvents() {
    $("#calendarNavigation").addEventListener("click", event => {
      const button = event.target.closest("[data-calendar-scope]");
      if (!button) return;
      state.scope = button.dataset.calendarScope;
      state.selectedDate = "";
      window.SponsorFlowStorage.setItem("asmeCalendarScope", state.scope);
      $("#calendarScopeSelect").value = state.scope;
      renderCalendar();
      if (isCompactCalendar()) $(".workspace-explorer").open = false;
    });
    $$("[data-calendar-view]").forEach(button => button.addEventListener("click", () => setCalendarView(button.dataset.calendarView)));
    $$("[data-calendar-kind]").forEach(button => button.addEventListener("click", () => {
      state.kind = button.dataset.calendarKind;
      $$("[data-calendar-kind]").forEach(item => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-pressed", String(active)); });
      renderCalendar();
    }));
    $("#calendarSearch").addEventListener("input", renderCalendar);
    $("[data-identity-cancel]").addEventListener("click", () => $("#calendarIdentityDialog").close());
    $("#calendarSaveName").addEventListener("click", () => saveIdentity($("#calendarActorName").value));
    $("#calendarActorName").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); saveIdentity(event.currentTarget.value); }
    });
    $("#calendarIdentitySave").addEventListener("click", () => {
      if (saveIdentity($("#calendarIdentityName").value, true)) $("#calendarIdentityDialog").close();
    });
    $("#calendarIdentityName").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); $("#calendarIdentitySave").click(); }
    });
    $("#calendarScopeSelect").addEventListener("change", event => {
      state.scope = event.currentTarget.value;
      state.selectedDate = "";
      window.SponsorFlowStorage.setItem("asmeCalendarScope", state.scope);
      renderCalendar();
    });
    $("#calendarPrevious").addEventListener("click", () => moveMonth(-1));
    $("#calendarNext").addEventListener("click", () => moveMonth(1));
    $("#calendarToday").addEventListener("click", () => {
      state.month = `${todayText().slice(0, 7)}-01`;
      state.selectedDate = isCompactCalendar() ? todayText() : "";
      window.SponsorFlowStorage.setItem("asmeCalendarMonth", state.month);
      renderCalendar();
    });
    $("#calendarAgendaReset")?.addEventListener("click", () => {
      state.selectedDate = "";
      renderCalendar();
    });
    $("#calendarNewEventTop")?.addEventListener("click", () => openEventDialog("", { startDate: state.selectedDate || todayText() }));
    $("#calendarSubscribe").addEventListener("click", event => { event.currentTarget.closest("details")?.removeAttribute("open"); openSubscriptions(); });
    $("#calendarSnapshot").addEventListener("click", event => { event.currentTarget.closest("details")?.removeAttribute("open"); downloadCurrentCalendar(); });
    [$("#calendarManage"), $("#calendarManageTop")].filter(Boolean).forEach(button => button.addEventListener("click", openCalendarManager));
    $("#calendarManagerNew").addEventListener("click", resetCalendarManagerForm);
    $("#customCalendarReset").addEventListener("click", resetCalendarManagerForm);
    $("#calendarManagerForm").addEventListener("submit", saveCustomCalendar);
    $("#customCalendarDelete").addEventListener("click", archiveCustomCalendar);
    $$('[data-calendar-manager-close]').forEach(button => button.addEventListener("click", () => $("#calendarManagerDialog").close()));

    $("#calendarEventForm").addEventListener("submit", saveEvent);
    $("#calendarEventAllDay").addEventListener("change", () => { updateTimeFields(); markDirty(); });
    $("#calendarEventStartDate").addEventListener("change", () => {
      const start = validDateOnly($("#calendarEventStartDate").value);
      const end = validDateOnly($("#calendarEventEndDate").value);
      if (start && (!end || end < start)) $("#calendarEventEndDate").value = start;
      updateHealth();
      markDirty();
    });
    $("#calendarEventEndDate").addEventListener("change", () => { updateHealth(); markDirty(); });
    ["calendarEventStatus", "calendarEventPriority", "calendarEventProgress", "calendarEventImportant", "calendarEventMilestone"].forEach(id => {
      $("#" + id).addEventListener("change", () => { updateHealth(); markDirty(); });
    });
    $("#calendarEventForm").addEventListener("input", markDirty);
    $("#calendarEventForm").addEventListener("change", markDirty);
    $("#calendarEventArchive").addEventListener("click", archiveEvent);
    $("#calendarEventDownload").addEventListener("click", () => {
      const task = currentFormTask();
      if (task.startDate || task.dueDate) downloadIcs([task], task.title || "ASME event");
    });
    $$('[data-calendar-close]').forEach(button => button.addEventListener("click", closeEventDialog));
    $$('[data-subscription-close]').forEach(button => button.addEventListener("click", () => $("#calendarSubscriptionsDialog").close()));
    [$("#calendarIdentityDialog"), $("#calendarEventDialog"), $("#calendarSubscriptionsDialog"), $("#calendarManagerDialog")].forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        if (dialog.id === "calendarEventDialog") closeEventDialog(); else dialog.close();
      });
      dialog.addEventListener("cancel", event => {
        if (dialog.id === "calendarEventDialog" && state.dirty) { event.preventDefault(); closeEventDialog(); }
      });
      dialog.addEventListener("close", () => {
        if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
      });
    });
  }

  async function loadCalendar() {
    setLoading(true);
    try {
      const data = await API.post("plannerBootstrap");
      state.teams = Array.isArray(data.teams) ? data.teams : [];
      state.boards = Array.isArray(data.boards) ? data.boards : [];
      state.tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeTask);
      state.calendars = Array.isArray(data.calendars) ? data.calendars : [];
      state.calendarFeedBaseUrl = String(data.calendarFeedBaseUrl || "");
      const query = new URLSearchParams(window.location.search);
      const queryBoard = query.get("board") || "";
      if (queryBoard && state.boards.some(board => board.id === queryBoard)) {
        const board = state.boards.find(item => item.id === queryBoard);
        state.scope = `board:${board.id}`;
      }
      state.scope = normalizeScopeAgainstData(state.scope);
      renderScopeOptions();
      renderBoardOptions();
      renderCalendar();
      showConnectionError("");
      const queryTask = query.get("task") || "";
      if (queryTask && state.tasks.some(task => task.id === queryTask)) setTimeout(() => openEventDialog(queryTask), 120);
    } catch (error) {
      showConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function normalizeTask(task) {
    return {
      ...task,
      startDate: validDateOnly(task.startDate),
      dueDate: validDateOnly(task.dueDate),
      startTime: validTime(task.startTime),
      endTime: validTime(task.endTime),
      allDay: task.allDay !== false,
      progress: Number(task.progress || 0),
      importantDate: Boolean(task.importantDate),
      isMilestone: Boolean(task.isMilestone)
    };
  }

  function renderScopeOptions() {
    const teams = calendarTeams();
    const builtIns = [
      '<option value="all">All calendars</option>',
      '<option value="important">Important club events</option>',
      '<option value="general">General timeline</option>'
    ].join("");
    const teamOptions = teams.length
      ? `<optgroup label="Subteam calendars">${teams.map(team => `<option value="team:${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("")}</optgroup>`
      : "";
    const customOptions = state.calendars.length
      ? `<optgroup label="Custom calendars">${state.calendars.map(calendar => `<option value="custom:${escapeHtml(calendar.id)}">${escapeHtml(calendar.name)}</option>`).join("")}</optgroup>`
      : "";
    $("#calendarScopeSelect").innerHTML = builtIns + teamOptions + customOptions + state.boards.map(board => `<option value="board:${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join("");
    state.scope = normalizeScopeAgainstData(state.scope);
    $("#calendarScopeSelect").value = state.scope;
  }

  function calendarTeams() {
    const order = new Map(DEFAULT_TEAM_ORDER.map((id, index) => [id, index]));
    return state.teams
      .filter(team => team.id !== GENERAL_TEAM_ID && team.active !== false)
      .sort((a, b) => {
        const aRank = order.has(a.id) ? order.get(a.id) : 999;
        const bRank = order.has(b.id) ? order.get(b.id) : 999;
        return aRank - bRank || String(a.name || "").localeCompare(String(b.name || ""));
      });
  }

  function normalizeStoredScope(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "club") return "all";
    if (raw === `team:${GENERAL_TEAM_ID}`) return "general";
    return raw;
  }

  function normalizeScopeAgainstData(value) {
    const scope = normalizeStoredScope(value);
    if (scope === "all" || scope === "important" || scope === "general") return scope;
    if (scope.startsWith("board:")) {
      const board = state.boards.find(item => `board:${item.id}` === scope);
      if (!board) return "all";
      return scope;
    }
    if (scope.startsWith("team:")) {
      const teamId = scope.slice(5);
      if (teamId === GENERAL_TEAM_ID) return "general";
      return calendarTeams().some(team => team.id === teamId) ? scope : "all";
    }
    if (scope.startsWith("custom:")) {
      return state.calendars.some(calendar => calendar.id === scope.slice(7)) ? scope : "all";
    }
    return "all";
  }

  function renderBoardOptions(selectedId = "") {
    const grouped = state.teams.map(team => {
      const boards = state.boards.filter(board => board.teamId === team.id);
      return boards.length ? `<optgroup label="${escapeHtml(team.name)}">${boards.map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");
    $("#calendarEventBoard").innerHTML = grouped || '<option value="">No timelines available</option>';
    const target = selectedId && state.boards.some(board => board.id === selectedId) ? selectedId : defaultBoardForScope();
    if (target) $("#calendarEventBoard").value = target;
  }

  function defaultBoardForScope() {
    if (state.scope.startsWith("board:")) return state.scope.slice(6);
    if (state.scope === "general") {
      return state.boards.find(board => board.teamId === GENERAL_TEAM_ID)?.id || state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards[0]?.id || "";
    }
    if (state.scope.startsWith("team:")) {
      return state.boards.find(board => board.teamId === state.scope.slice(5))?.id || state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards[0]?.id || "";
    }
    if (state.scope.startsWith("custom:")) {
      const calendar = state.calendars.find(item => item.id === state.scope.slice(7));
      const firstTeamId = calendar?.teamIds?.[0] || (calendar?.includeGeneral ? GENERAL_TEAM_ID : "");
      return state.boards.find(board => board.teamId === firstTeamId)?.id || state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards[0]?.id || "";
    }
    return state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards.find(board => board.teamId === GENERAL_TEAM_ID)?.id || state.boards[0]?.id || "";
  }

  function scopeMeta() {
    if (state.scope.startsWith("board:")) {
      const board = state.boards.find(item => item.id === state.scope.slice(6));
      return {name:board?.name || "Project", description:board?.description || "This project's dates and deadlines."};
    }
    if (state.scope === "important") {
      return {
        name: "Key dates",
        description: "Meetings, milestones, and critical dates. Funding deadlines are listed with their projects."
      };
    }
    if (state.scope === "general") {
      const team = state.teams.find(item => item.id === GENERAL_TEAM_ID);
      return {
        name: "Club calendar",
        description: team?.description || "Shared club-level milestones, cross-team deadlines, and general planning."
      };
    }
    if (state.scope.startsWith("team:")) {
      const team = state.teams.find(item => item.id === state.scope.slice(5));
      return {
        name: team?.name || "Team calendar",
        description: team?.description || "Every dated item owned by this subteam."
      };
    }
    if (state.scope.startsWith("custom:")) {
      const calendar = state.calendars.find(item => item.id === state.scope.slice(7));
      return {
        name: calendar?.name || "Custom calendar",
        description: calendar?.description || "A member-created combination of team calendars.",
        color: calendar?.color || "GOLD"
      };
    }
    return {
      name: "All dates",
      description: "Events and deadlines across every team."
    };
  }

  function tasksForScope() {
    const tasks = state.tasks.filter(task => !task.archived && (task.startDate || task.dueDate));
    if (state.scope.startsWith("board:")) return tasks.filter(task => task.boardId === state.scope.slice(6));
    if (state.scope === "important") return tasks.filter(isImportantTask);
    if (state.scope === "general") {
      const boardIds = new Set(state.boards.filter(board => board.teamId === GENERAL_TEAM_ID).map(board => board.id));
      return tasks.filter(task => boardIds.has(task.boardId));
    }
    if (state.scope.startsWith("team:")) {
      const boardIds = new Set(state.boards.filter(board => board.teamId === state.scope.slice(5)).map(board => board.id));
      return tasks.filter(task => boardIds.has(task.boardId));
    }
    if (state.scope.startsWith("custom:")) {
      const calendar = state.calendars.find(item => item.id === state.scope.slice(7));
      if (!calendar) return [];
      const teamIds = new Set(calendar.teamIds || []);
      if (calendar.includeGeneral) teamIds.add(GENERAL_TEAM_ID);
      const boardIds = new Set(state.boards.filter(board => teamIds.has(board.teamId)).map(board => board.id));
      const selected = tasks.filter(task => boardIds.has(task.boardId));
      return calendar.importantOnly ? selected.filter(isImportantTask) : selected;
    }
    return tasks;
  }

  function isImportantTask(task) {
    if (task.taskType === "FUNDING") return false;
    return task.importantDate || task.isMilestone || task.priority === "CRITICAL" || task.taskType === "MEETING";
  }

  function renderCalendar() {
    renderCalendarNavigation();
    const monthStart = parseDateOnly(state.month) || new Date();
    monthStart.setDate(1);
    state.month = dateText(monthStart);
    window.SponsorFlowStorage.setItem("asmeCalendarMonth", state.month);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const meta = scopeMeta();
    const compact = isCompactCalendar();
    $("#calendarTitle").textContent = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("#calendarScopeName").textContent = meta.name;
    $("#calendarScopeDescription").textContent = meta.description;

    if (state.selectedDate && !state.selectedDate.startsWith(state.month.slice(0, 7))) state.selectedDate = "";

    const tasks = visibleCalendarTasks().sort((a, b) => (taskBounds(a).start || "").localeCompare(taskBounds(b).start || "") || a.title.localeCompare(b.title));
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const value = dateText(day);
      const dayTasks = tasks.filter(task => marksDate(task, value));
      const outside = day.getMonth() !== monthStart.getMonth();
      const today = value === todayText();
      const selected = value === state.selectedDate;
      const eventButtons = dayTasks.slice(0, 4).map((task, eventIndex) => calendarEventHtml(task, value, eventIndex)).join("");
      const desktopMore = dayTasks.length > 4 ? `<button class="calendar-more-button" type="button" data-focus-date="${value}">+${dayTasks.length - 4} more</button>` : "";
      const mobileMore = dayTasks.length > 2 ? `<button class="calendar-mobile-count" type="button" data-focus-date="${value}" aria-label="Show all ${dayTasks.length} items on ${value}">+${dayTasks.length - 2}</button>` : "";
      cells.push(`<section class="calendar-day${outside ? " is-outside" : ""}${today ? " is-today" : ""}${selected ? " is-selected" : ""}" data-date="${value}" data-select-date="${value}" tabindex="0" aria-label="${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${dayTasks.length ? `, ${dayTasks.length} scheduled item${dayTasks.length === 1 ? "" : "s"}` : ""}">
        <header><time datetime="${value}">${day.getDate()}</time><div>${today ? "<span>Today</span>" : ""}<button class="calendar-day-add" type="button" data-add-date="${value}" aria-label="Add event on ${value}">+</button></div></header>
        <div class="calendar-day-events">${eventButtons}${desktopMore}${mobileMore}</div>
      </section>`);
    }
    $("#calendarGrid").innerHTML = cells.join("");
    $("#calendarGrid").querySelectorAll("[data-add-date]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      openEventDialog("", { startDate: button.dataset.addDate });
    }));
    $("#calendarGrid").querySelectorAll("[data-task-id]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      openEventDialog(button.dataset.taskId);
    }));
    $("#calendarGrid").querySelectorAll("[data-focus-date]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      selectCalendarDate(button.dataset.focusDate, true);
    }));
    $("#calendarGrid").querySelectorAll("[data-select-date]").forEach(cell => {
      cell.addEventListener("keydown", event => {
        if (event.target === cell && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectCalendarDate(cell.dataset.selectDate, true); }
      });
      cell.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        selectCalendarDate(cell.dataset.selectDate, true);
      });
    });

    const startText = dateText(monthStart);
    const endText = dateText(monthEnd);
    const monthTasks = tasks.filter(task => intersects(task, startText, endText));
    const agendaTasks = state.selectedDate
      ? monthTasks.filter(task => marksDate(task, state.selectedDate))
      : monthTasks;
    updateAgendaHeading(agendaTasks.length);
    $("#calendarAgenda").innerHTML = agendaTasks.length
      ? agendaTasks.map(agendaHtml).join("")
      : `<div class="calendar-empty"><span>◇</span><strong>${state.selectedDate ? "Nothing scheduled" : "No dated work this month"}</strong><p>${state.selectedDate ? "Use New event to add something here." : "Try another calendar or add a new event."}</p></div>`;
    $("#calendarAgenda").querySelectorAll("[data-agenda-task]").forEach(button => button.addEventListener("click", () => openEventDialog(button.dataset.agendaTask)));
    $("#calendarAgenda").querySelectorAll("[data-agenda-download]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      const task = state.tasks.find(item => item.id === button.dataset.agendaDownload);
      if (task) downloadIcs([task], task.title);
    }));
  }

  function dependencyList(value) {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || "[]"); if (Array.isArray(parsed)) return parsed; } catch (_) {}
    return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  }

  function visibleCalendarTasks() {
    const search = $("#calendarSearch").value.trim().toLowerCase();
    return tasksForScope().filter(task => {
      if (state.kind === "events" && task.taskType !== "MEETING") return false;
      if (state.kind === "deadlines" && task.taskType === "MEETING") return false;
      return !search || [task.title, task.description, task.ownerNames, task.location].join(" ").toLowerCase().includes(search);
    });
  }

  function setCalendarView(view) {
    state.view = view === "agenda" ? "agenda" : "month";
    document.body.dataset.calendarView = state.view;
    window.SponsorFlowStorage.setItem("asmeCalendarView", state.view);
    $$("[data-calendar-view]").forEach(button => { const active = button.dataset.calendarView === state.view; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
  }

  function renderCalendarNavigation() {
    const host = $("#calendarNavigation");
    const closed = new Set(Array.from(host.querySelectorAll("details:not([open])")).map(item => item.dataset.team));
    const item = (scope, name) => `<button type="button" class="sidebar-item${state.scope === scope ? " is-active" : ""}" data-calendar-scope="${escapeHtml(scope)}"${state.scope === scope ? ' aria-current="true"' : ""}><span>${escapeHtml(name)}</span></button>`;
    host.innerHTML = item("all", "All dates") + item("important", "Key dates") + item("general", "Club calendar") + '<p class="sidebar-label">Teams & projects</p>' + calendarTeams().map(team => `<details class="sidebar-group" data-team="${escapeHtml(team.id)}"${closed.has(team.id) ? "" : " open"}><summary>${escapeHtml(team.name)}</summary>${item("team:" + team.id, "All team dates")}${state.boards.filter(board => board.teamId === team.id).map(board => item("board:" + board.id, board.name)).join("")}</details>`).join("") + (state.calendars.length ? '<p class="sidebar-label">Custom calendars</p>' + state.calendars.map(calendar => item("custom:" + calendar.id, calendar.name)).join("") : "");
  }

  function isCompactCalendar() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function selectCalendarDate(value, scrollToAgenda = false) {
    state.selectedDate = validDateOnly(value);
    renderCalendar();
    if (scrollToAgenda) {
      requestAnimationFrame(() => $("#calendarAgenda")?.closest(".calendar-agenda-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function updateAgendaHeading(count) {
    const selected = validDateOnly(state.selectedDate);
    const reset = $("#calendarAgendaReset");
    $("#calendarAgendaCount").textContent = String(count);
    if (selected) {
      const date = parseDateOnly(selected);
      $("#calendarAgendaKicker").textContent = "Selected day";
      $("#calendarAgendaTitle").textContent = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      reset?.classList.remove("is-hidden");
    } else {
      $("#calendarAgendaKicker").textContent = "Month agenda";
      $("#calendarAgendaTitle").textContent = "This month";
      reset?.classList.add("is-hidden");
    }
  }

  function calendarEventHtml(task, value, eventIndex = 0) {
    const bounds = taskBounds(task);
    const multiDay = Boolean(bounds.start && bounds.end && bounds.start !== bounds.end);
    const marker = multiDay ? (value === bounds.start ? "start" : value === bounds.end ? "due" : "") : "single";
    let label = task.title;
    const endWord = task.taskType === "MEETING" ? "Ends" : "Due";
    if (marker === "start") label = `Starts · ${task.title}`;
    if (marker === "due") label = `${endWord} · ${task.title}`;
    const time = task.allDay === false && task.startTime && marker !== "due" ? formatClock(task.startTime) : "";
    const mobileBase = compactEventLabel(task.title);
    const mobileEnd = task.taskType === "MEETING" ? "E" : "D";
    const mobileLabel = marker === "start" ? `S · ${mobileBase}` : marker === "due" ? `${mobileEnd} · ${mobileBase}` : mobileBase;
    return `<button class="calendar-event calendar-status-${escapeHtml(task.status)} calendar-marker-${marker}${eventIndex >= 2 ? " is-mobile-extra" : ""}" type="button" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(label)}">
      <span class="priority-dot priority-bg-${escapeHtml(task.priority)}"></span><span class="calendar-event-full-label">${time ? `<b>${escapeHtml(time)}</b> ` : ""}${escapeHtml(label)}</span><span class="calendar-event-mobile-label">${escapeHtml(mobileLabel)}</span>
    </button>`;
  }

  function compactEventLabel(title) {
    const words = String(title || "Event").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "Event";
    const first = words[0].replace(/[^A-Za-z0-9&-]/g, "");
    if (first && first.length <= 7) return first;
    const acronym = words.slice(0, 4).map(word => word.replace(/[^A-Za-z0-9]/g, "").charAt(0)).join("").toUpperCase();
    if (acronym.length >= 2) return acronym;
    return String(title).slice(0, 7);
  }

  function agendaHtml(task) {
    const bounds = taskBounds(task);
    const board = state.boards.find(item => item.id === task.boardId);
    const team = state.teams.find(item => item.id === board?.teamId);
    const label = bounds.start === bounds.end ? formatShortDate(bounds.start) : `${formatShortDate(bounds.start)} – ${formatShortDate(bounds.end)}`;
    return `<article class="calendar-agenda-item" data-agenda-date="${escapeHtml(bounds.start)}" data-agenda-id="${escapeHtml(task.id)}">
      <button class="calendar-agenda-main" type="button" data-agenda-task="${escapeHtml(task.id)}">
        <span class="calendar-agenda-date">${escapeHtml(label)}</span>
        <span class="calendar-agenda-copy"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(team?.name || "ASME")} · ${escapeHtml(statusLabel(task.status))}${task.ownerNames ? ` · ${escapeHtml(task.ownerNames)}` : ""}</small></span>
      </button>
      <button class="calendar-agenda-download" type="button" data-agenda-download="${escapeHtml(task.id)}" aria-label="Download ${escapeHtml(task.title)} as .ics">.ics</button>
    </article>`;
  }

  function focusAgenda(value) {
    if (isCompactCalendar()) {
      selectCalendarDate(value, true);
      return;
    }
    const item = $("#calendarAgenda").querySelector(`[data-agenda-date="${CSS.escape(value)}"]`);
    if (!item) return;
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    item.classList.add("is-highlighted");
    setTimeout(() => item.classList.remove("is-highlighted"), 1400);
  }

  function moveMonth(offset) {
    const date = parseDateOnly(state.month) || new Date();
    date.setMonth(date.getMonth() + offset, 1);
    state.month = dateText(date);
    state.selectedDate = "";
    renderCalendar();
  }

  function openEventDialog(taskId = "", defaults = {}) {
    if (!state.actorName) { state.afterIdentity = () => openEventDialog(taskId, defaults); requireActor(); return; }
    resetEventForm();
    const task = taskId ? state.tasks.find(item => item.id === taskId) : null;
    state.editingTask = task || null;
    if (task) {
      $("#calendarEventId").value = task.id;
      $("#calendarEventExpectedUpdatedAt").value = task.updatedAt || "";
      $("#calendarEventDialogTitle").textContent = task.taskType === "MEETING" ? "Edit event" : "Edit calendar item";
      $("#calendarEventEyebrow").textContent = task.taskType === "MEETING" ? "Calendar event" : "Project deadline";
      $("#calendarEventTitle").value = task.title || "";
      renderBoardOptions(task.boardId);
      $("#calendarEventBoard").value = task.boardId;
      $("#calendarEventBoard").disabled = true;
      $("#calendarEventType").value = task.taskType || "WORK";
      $("#calendarEventStartDate").value = task.startDate || "";
      $("#calendarEventEndDate").value = task.dueDate || "";
      $("#calendarEventAllDay").checked = task.allDay !== false;
      $("#calendarEventStartTime").value = task.startTime || "";
      $("#calendarEventEndTime").value = task.endTime || "";
      $("#calendarEventLocation").value = task.location || "";
      $("#calendarEventOwners").value = task.ownerNames || "";
      $("#calendarEventStatus").value = task.status || "PLANNED";
      $("#calendarEventPriority").value = task.priority || "MEDIUM";
      $("#calendarEventProgress").value = String(task.progress || 0);
      $("#calendarEventDescription").value = task.description || "";
      $("#calendarEventMilestone").checked = Boolean(task.isMilestone);
      $("#calendarEventImportant").checked = Boolean(task.importantDate);
      $("#calendarEventUpdatedMeta").textContent = `Last updated ${relativeTime(task.updatedAt)} by ${task.updatedBy || "unknown"}`;
      $("#calendarEventArchive").classList.remove("is-hidden");
      $("#calendarEventDownload").classList.remove("is-hidden");
    } else {
      const start = validDateOnly(defaults.startDate) || todayText();
      $("#calendarEventDialogTitle").textContent = "Add event";
      $("#calendarEventEyebrow").textContent = "New calendar event";
      renderBoardOptions(defaults.boardId || defaultBoardForScope());
      $("#calendarEventBoard").disabled = false;
      $("#calendarEventStartDate").value = start;
      $("#calendarEventEndDate").value = validDateOnly(defaults.endDate) || start;
      $("#calendarEventOwners").value = state.actorName;
    }
    const fullTaskLink = $("#calendarOpenProject");
    fullTaskLink.classList.toggle("is-hidden", !task);
    fullTaskLink.href = task ? `planner.html?board=${encodeURIComponent(task.boardId)}&task=${encodeURIComponent(task.id)}` : "planner.html";
    $(".event-advanced").open = Boolean(task && task.taskType !== "MEETING");
    updateTimeFields();
    updateHealth();
    state.dirty = false;
    showDialog($("#calendarEventDialog"));
    setTimeout(() => $("#calendarEventTitle").focus(), 0);
  }

  function resetEventForm() {
    $("#calendarEventForm").reset();
    $("#calendarEventId").value = "";
    $("#calendarEventExpectedUpdatedAt").value = "";
    $("#calendarEventUpdatedMeta").textContent = "";
    $("#calendarEventAllDay").checked = true;
    $("#calendarEventPriority").value = "MEDIUM";
    $("#calendarEventStatus").value = "PLANNED";
    $("#calendarEventProgress").value = "0";
    $("#calendarEventArchive").classList.add("is-hidden");
    $("#calendarEventDownload").classList.add("is-hidden");
    $("#calendarEventBoard").disabled = false;
    setEventStatus("");
  }

  function currentFormTask() {
    const existing = state.editingTask || {};
    const start = validDateOnly($("#calendarEventStartDate").value);
    const end = validDateOnly($("#calendarEventEndDate").value) || (state.editingTask ? "" : start);
    return normalizeTask({
      ...existing,
      id: $("#calendarEventId").value || existing.id || "",
      boardId: $("#calendarEventBoard").value,
      title: $("#calendarEventTitle").value.trim(),
      description: $("#calendarEventDescription").value,
      taskType: $("#calendarEventType").value,
      status: $("#calendarEventStatus").value,
      priority: $("#calendarEventPriority").value,
      ownerNames: $("#calendarEventOwners").value,
      startDate: start,
      dueDate: end,
      allDay: $("#calendarEventAllDay").checked,
      startTime: validTime($("#calendarEventStartTime").value),
      endTime: validTime($("#calendarEventEndTime").value),
      location: $("#calendarEventLocation").value,
      progress: Number($("#calendarEventProgress").value || 0),
      isMilestone: $("#calendarEventMilestone").checked,
      importantDate: $("#calendarEventImportant").checked
    });
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!requireActor() || state.saving) return;
    const task = currentFormTask();
    if (task.title.length < 2) return setEventStatus("Give this item a clear title.", "error");
    if (!task.boardId) return setEventStatus("Choose a project.", "error");
    if (!task.startDate && !task.dueDate) return setEventStatus("Choose a start or end date.", "error");
    if (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100) return setEventStatus("Progress must be between 0 and 100.", "error");
    if (task.startDate && task.dueDate && task.dueDate < task.startDate) return setEventStatus("The end date must be on or after the start date.", "error");
    if (!task.allDay && task.startDate === task.dueDate && task.startTime && task.endTime && task.endTime <= task.startTime) return setEventStatus("The end time must be after the start time.", "error");

    const existing = state.editingTask || {};
    const payload = {
      id: task.id,
      expectedUpdatedAt: $("#calendarEventExpectedUpdatedAt").value,
      boardId: task.boardId,
      title: task.title,
      description: task.description,
      taskType: task.taskType || "MEETING",
      status: task.status || "PLANNED",
      priority: task.priority || "MEDIUM",
      ownerNames: task.ownerNames,
      startDate: task.startDate,
      dueDate: task.dueDate,
      allDay: task.allDay,
      startTime: task.startTime,
      endTime: task.endTime,
      location: task.location,
      progress: task.status === "DONE" ? 100 : task.progress,
      isMilestone: task.isMilestone,
      importantDate: task.importantDate,
      tags: existing.tags || (task.taskType === "MEETING" ? "event" : ""),
      campus: existing.campus || "",
      fundingMin: existing.fundingMin ?? "",
      fundingMax: existing.fundingMax ?? "",
      fundingAmountLabel: existing.fundingAmountLabel || "",
      sourceUrl: existing.sourceUrl || "",
      sourceConfidence: existing.sourceConfidence || "TEAM_ENTERED",
      requirements: existing.requirements || "",
      partName: existing.partName || "",
      partNumber: existing.partNumber || "",
      vendor: existing.vendor || "",
      quantity: existing.quantity ?? "",
      estimatedCost: existing.estimatedCost ?? "",
      orderStatus: existing.orderStatus || "NOT_NEEDED",
      dependencyIds: JSON.stringify(dependencyList(existing.dependencyIds)),
      actorName: state.actorName
    };

    state.saving = true;
    setButtonBusy($("#calendarEventSave"), true, "Saving…");
    setEventStatus("Saving to the shared calendar…");
    try {
      const saved = normalizeTask(await API.post("savePlannerTask", payload));
      // Keep the assigned ID if a later refresh fails, so retrying cannot create a duplicate.
      state.editingTask = saved;
      $("#calendarEventId").value = saved.id;
      $("#calendarEventExpectedUpdatedAt").value = saved.updatedAt || "";
      const data = await API.post("plannerBootstrap");
      state.teams = Array.isArray(data.teams) ? data.teams : state.teams;
      state.boards = Array.isArray(data.boards) ? data.boards : state.boards;
      state.tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeTask);
      state.calendarFeedBaseUrl = String(data.calendarFeedBaseUrl || state.calendarFeedBaseUrl);
      const verified = state.tasks.find(item => item.id === saved.id);
      if (!verified || verified.startDate !== task.startDate || verified.dueDate !== task.dueDate) throw new Error("The event was saved, but its dates did not verify correctly. Refresh and try once more.");
      state.month = `${(verified.startDate || verified.dueDate).slice(0, 7)}-01`;
      state.selectedDate = isCompactCalendar() ? (verified.startDate || verified.dueDate) : "";
      window.SponsorFlowStorage.setItem("asmeCalendarMonth", state.month);
      state.dirty = false;
      $("#calendarEventDialog").close();
      renderCalendar();
      setPageMessage(`${verified.title} saved on ${formatShortDate(verified.startDate || verified.dueDate)}.`, "success");
    } catch (error) {
      setEventStatus(error.message, "error");
    } finally {
      state.saving = false;
      setButtonBusy($("#calendarEventSave"), false, "Save event");
    }
  }

  async function archiveEvent() {
    const task = state.editingTask;
    if (!task || !window.confirm(`Archive “${task.title}”?`)) return;
    setEventStatus("Archiving…");
    try {
      await API.post("archivePlannerTask", { taskId: task.id, actorName: state.actorName, expectedUpdatedAt: task.updatedAt || "" });
      state.tasks = state.tasks.filter(item => item.id !== task.id);
      state.dirty = false;
      $("#calendarEventDialog").close();
      renderCalendar();
      setPageMessage("Calendar item archived.", "success");
    } catch (error) { setEventStatus(error.message, "error"); }
  }

  function closeEventDialog() {
    if (state.dirty && !window.confirm("Discard unsaved changes?")) return;
    state.dirty = false;
    $("#calendarEventDialog").close();
  }

  function markDirty() {
    if (!$("#calendarEventDialog").open) return;
    state.dirty = true;
  }

  function updateTimeFields() {
    const allDay = $("#calendarEventAllDay").checked;
    $("#calendarEventTimeFields").classList.toggle("is-hidden", allDay);
    $("#calendarEventStartTime").disabled = allDay;
    $("#calendarEventEndTime").disabled = allDay;
  }

  function updateHealth() {
    const task = currentFormTask();
    const host = $("#calendarEventHealth");
    if (!task.startDate && !task.dueDate) {
      host.className = "task-health-card health-neutral";
      host.innerHTML = "<span>Schedule health</span><strong>Add a date</strong><p>Choose dates to place this item on the shared calendar.</p>";
      return;
    }
    const today = todayText();
    let tone = "ontrack", title = !task.startDate ? `Due ${formatShortDate(task.dueDate)}` : !task.dueDate ? `Starts ${formatShortDate(task.startDate)}` : task.startDate === task.dueDate ? formatShortDate(task.startDate) : `${formatShortDate(task.startDate)} – ${formatShortDate(task.dueDate)}`;
    let detail = task.allDay ? "All-day calendar item." : `${formatClock(task.startTime || "09:00")} – ${formatClock(task.endTime || "10:00")}`;
    if (task.status !== "DONE" && task.dueDate && task.dueDate < today) { tone = "overdue"; title = "Past due"; detail = `Ended ${formatShortDate(task.dueDate)}.`; }
    else if (task.status === "BLOCKED") { tone = "blocked"; title = "Blocked"; detail = "Resolve the blocker before this date."; }
    host.className = `task-health-card health-${tone}`;
    host.innerHTML = `<span>Schedule health</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>`;
  }

  function openSubscriptions() {
    if (!state.calendarFeedBaseUrl) return setPageMessage("The live calendar backend is unavailable. Redeploy the current Apps Script version.", "error");
    const feeds = [
      ...(state.scope.startsWith("board:") ? [{name:scopeMeta().name, description:"Dates for this project.", url:feedUrl("board", state.scope.slice(6))}] : []),
      { name: "All dates", description: "Every dated item across the entire workspace.", url: feedUrl("club") },
      { name: "Key dates", description: "Meetings, milestones, and critical dates. Funding deadlines are listed with their projects.", url: feedUrl("important") },
      { name: "Club calendar", description: "Shared club-level planning and cross-team milestones.", url: feedUrl("team", GENERAL_TEAM_ID) },
      ...calendarTeams().map(team => ({ name: team.name, description: team.description || "This subteam's dated work.", url: feedUrl("team", team.id) })),
      ...state.calendars.map(calendar => ({ name: calendar.name, description: calendar.description || "Member-created calendar.", url: feedUrl("custom", calendar.id), custom: true, color: calendar.color }))
    ];
    $("#calendarSubscriptionList").innerHTML = feeds.map(feed => `<article class="calendar-subscription-card${feed.custom ? " is-custom" : ""}">
      <div class="calendar-subscription-copy"><span class="calendar-feed-kind${feed.custom ? ` calendar-color-${escapeHtml(feed.color || "GOLD")}` : ""}">${feed.custom ? "Custom" : "Live"}</span><strong>${escapeHtml(feed.name)}</strong><p>${escapeHtml(feed.description)}</p></div>
      <div class="calendar-subscription-actions">
        <button class="button button-secondary button-small" type="button" data-copy-feed="${escapeHtml(feed.url)}">Copy URL</button>
        <a class="button button-ghost button-small" href="${escapeHtml(feed.url)}" target="_blank" rel="noreferrer">Open feed</a>
      </div>
    </article>`).join("");
    $("#calendarSubscriptionList").querySelectorAll("[data-copy-feed]").forEach(button => button.addEventListener("click", () => copyText(button.dataset.copyFeed)));
    setSubscriptionStatus("");
    showDialog($("#calendarSubscriptionsDialog"));
  }

  function feedUrl(scope, id = "") {
    const url = new URL(state.calendarFeedBaseUrl);
    url.searchParams.set("feed", "calendar");
    url.searchParams.set("scope", scope);
    if (id) url.searchParams.set("id", id);
    url.searchParams.set("app", new URL("calendar.html", window.location.href).href);
    return url.toString();
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      setSubscriptionStatus("Subscription URL copied.", "success");
    } catch (_) {
      window.prompt("Copy this calendar subscription URL:", value);
    }
  }

  function downloadCurrentCalendar() {
    const tasks = tasksForScope();
    if (!tasks.length) return setPageMessage("This calendar has no dated items to download.", "error");
    downloadIcs(tasks, scopeMeta().name);
    setPageMessage(`${tasks.length} calendar ${tasks.length === 1 ? "item" : "items"} downloaded.`, "success");
  }

  function downloadIcs(tasks, name) {
    const events = tasks.filter(task => task.startDate || task.dueDate).map(taskIcs).join("\r\n");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Purdue Indianapolis ASME//ASME Indy Workspace 1.3//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(name || "ASME Indy Calendar")}`, events, "END:VCALENDAR", ""].join("\r\n");
    downloadFile(`${slugify(name || "asme-indy-calendar")}.ics`, body, "text/calendar;charset=utf-8");
  }

  function taskIcs(task) {
    const bounds = taskBounds(task);
    const board = state.boards.find(item => item.id === task.boardId);
    const team = state.teams.find(item => item.id === board?.teamId);
    const description = [task.description, `Team: ${team?.name || "ASME"}`, `Timeline: ${board?.name || "Project planner"}`, task.ownerNames ? `Owners: ${task.ownerNames}` : "", `Status: ${statusLabel(task.status)}`, `Priority: ${priorityLabel(task.priority)}`].filter(Boolean).join("\n");
    const lines = ["BEGIN:VEVENT", `UID:${icsEscape(task.id || crypto.randomUUID())}@asmeindy.purdue.edu`, `DTSTAMP:${icsTimestamp(new Date())}`, `LAST-MODIFIED:${icsTimestamp(new Date(task.updatedAt || Date.now()))}`];
    if (task.allDay === false && task.startTime) {
      lines.push(`DTSTART;TZID=America/Indiana/Indianapolis:${icsDateTime(bounds.start, task.startTime)}`);
      lines.push(`DTEND;TZID=America/Indiana/Indianapolis:${icsDateTime(bounds.end, task.endTime || addMinutes(task.startTime, 60))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${bounds.start.replaceAll("-", "")}`);
      lines.push(`DTEND;VALUE=DATE:${addDays(bounds.end, 1).replaceAll("-", "")}`);
    }
    lines.push(`SUMMARY:${icsEscape(task.title || "ASME item")}`, `DESCRIPTION:${icsEscape(description)}`);
    if (task.location) lines.push(`LOCATION:${icsEscape(task.location)}`);
    lines.push("STATUS:CONFIRMED", "TRANSP:TRANSPARENT", "END:VEVENT");
    return lines.join("\r\n");
  }

  function openCalendarManager() {
    if (!requireActor()) return;
    renderCalendarManagerTeams();
    renderCustomCalendarList();
    resetCalendarManagerForm();
    showDialog($("#calendarManagerDialog"));
  }

  function renderCalendarManagerTeams() {
    $("#customCalendarTeams").innerHTML = calendarTeams().map(team => `<label class="calendar-team-option"><input type="checkbox" value="${escapeHtml(team.id)}"><span><b>${escapeHtml(team.name)}</b><small>${escapeHtml(team.description || "Include this team's dated work")}</small></span></label>`).join("") || '<p class="calendar-manager-empty">No active subteams are available.</p>';
  }

  function renderCustomCalendarList() {
    $("#customCalendarCount").textContent = String(state.calendars.length);
    $("#customCalendarList").innerHTML = state.calendars.length ? state.calendars.map(calendar => {
      const teamNames = (calendar.teamIds || []).map(id => state.teams.find(team => team.id === id)?.name).filter(Boolean);
      if (calendar.includeGeneral) teamNames.unshift("Club calendar");
      return `<button class="custom-calendar-card calendar-color-${escapeHtml(calendar.color || "GOLD")}" type="button" data-edit-calendar="${escapeHtml(calendar.id)}">
        <span class="custom-calendar-swatch"></span><span><strong>${escapeHtml(calendar.name)}</strong><small>${escapeHtml(calendar.description || teamNames.join(" · ") || "Custom calendar")}</small><em>${escapeHtml(teamNames.join(" · ") || "No sources")}${calendar.importantOnly ? " · Important only" : ""}</em></span><b aria-hidden="true">→</b>
      </button>`;
    }).join("") : '<div class="calendar-manager-empty"><span>⌁</span><strong>No custom calendars yet</strong><p>Create one to combine the subteams and dates that matter to a specific group.</p></div>';
    $("#customCalendarList").querySelectorAll("[data-edit-calendar]").forEach(button => button.addEventListener("click", () => editCustomCalendar(button.dataset.editCalendar)));
  }

  function resetCalendarManagerForm() {
    $("#calendarManagerForm").reset();
    $("#customCalendarId").value = "";
    $("#customCalendarFormTitle").textContent = "Create a calendar";
    $("#customCalendarDelete").classList.add("is-hidden");
    $("#customCalendarColor").value = "GOLD";
    setCalendarManagerStatus("");
  }

  function editCustomCalendar(id) {
    const calendar = state.calendars.find(item => item.id === id);
    if (!calendar) return;
    $("#customCalendarId").value = calendar.id;
    $("#customCalendarName").value = calendar.name || "";
    $("#customCalendarDescription").value = calendar.description || "";
    $("#customCalendarGeneral").checked = Boolean(calendar.includeGeneral);
    $("#customCalendarImportant").checked = Boolean(calendar.importantOnly);
    $("#customCalendarColor").value = calendar.color || "GOLD";
    const selected = new Set(calendar.teamIds || []);
    $("#customCalendarTeams").querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selected.has(input.value); });
    $("#customCalendarFormTitle").textContent = "Edit calendar";
    $("#customCalendarDelete").classList.remove("is-hidden");
    setCalendarManagerStatus("");
    $("#customCalendarName").focus();
  }

  async function saveCustomCalendar(event) {
    event.preventDefault();
    if (!requireActor()) return;
    const button = $("#customCalendarSave");
    const teamIds = $("#customCalendarTeams").querySelectorAll('input[type="checkbox"]:checked');
    const payload = {
      id: $("#customCalendarId").value,
      actorName: state.actorName,
      name: $("#customCalendarName").value,
      description: $("#customCalendarDescription").value,
      teamIds: JSON.stringify(Array.from(teamIds, input => input.value)),
      includeGeneral: $("#customCalendarGeneral").checked,
      importantOnly: $("#customCalendarImportant").checked,
      color: $("#customCalendarColor").value
    };
    setButtonBusy(button, true, "Saving…");
    setCalendarManagerStatus("");
    try {
      const saved = await API.post("savePlannerCalendar", payload);
      const index = state.calendars.findIndex(item => item.id === saved.id);
      if (index === -1) state.calendars.push(saved); else state.calendars[index] = saved;
      state.calendars.sort((a, b) => a.name.localeCompare(b.name));
      state.scope = `custom:${saved.id}`;
      window.SponsorFlowStorage.setItem("asmeCalendarScope", state.scope);
      renderScopeOptions();
      renderCalendar();
      renderCustomCalendarList();
      editCustomCalendar(saved.id);
      setCalendarManagerStatus(`${saved.name} is ready to view and subscribe to.`, "success");
      setPageMessage(`${saved.name} saved.`, "success");
    } catch (error) {
      setCalendarManagerStatus(error.message, "error");
    } finally {
      setButtonBusy(button, false, "Save calendar");
    }
  }

  async function archiveCustomCalendar() {
    const id = $("#customCalendarId").value;
    const calendar = state.calendars.find(item => item.id === id);
    if (!calendar || !requireActor()) return;
    if (!window.confirm(`Remove “${calendar.name}”? Tasks and events will stay in their original team timelines.`)) return;
    const button = $("#customCalendarDelete");
    setButtonBusy(button, true, "Removing…");
    try {
      await API.post("archivePlannerCalendar", { id, actorName: state.actorName });
      state.calendars = state.calendars.filter(item => item.id !== id);
      if (state.scope === `custom:${id}`) state.scope = "all";
      window.SponsorFlowStorage.setItem("asmeCalendarScope", state.scope);
      renderScopeOptions();
      renderCalendar();
      renderCustomCalendarList();
      resetCalendarManagerForm();
      setCalendarManagerStatus("Calendar removed. Its tasks and events were not changed.", "success");
    } catch (error) {
      setCalendarManagerStatus(error.message, "error");
    } finally {
      setButtonBusy(button, false, "Remove calendar");
    }
  }

  function setCalendarManagerStatus(message, tone = "") {
    const host = $("#calendarManagerStatus");
    host.textContent = message || "";
    host.className = `form-status${tone ? ` is-${tone}` : ""}`;
  }

  function restoreIdentity() {
    state.actorName = normalizeName(window.SponsorFlowStorage.getItem("asmePlannerName") || "");
    $("#calendarActorName").value = state.actorName;
    $("#calendarIdentityName").value = state.actorName;
    updateIdentityUi();

  }

  function saveIdentity(value, fromDialog = false) {
    const clean = normalizeName(value);
    const status = fromDialog ? $("#calendarIdentityStatus") : $("#calendarNameStatus");
    if (clean.length < 2) {
      status.textContent = "Enter your full name so changes have an owner.";
      status.classList.add("is-error");
      return false;
    }
    state.actorName = clean;
    window.SponsorFlowStorage.setItem("asmePlannerName", clean);
    $("#calendarActorName").value = clean;
    $("#calendarIdentityName").value = clean;
    updateIdentityUi();
    if (state.afterIdentity) { const next = state.afterIdentity; state.afterIdentity = null; setTimeout(next, 0); }
    return true;
  }

  function updateIdentityUi() {
    const status = $("#calendarNameStatus");
    status.textContent = state.actorName ? `Editing as ${state.actorName}` : "Required to edit";
    status.classList.toggle("is-ready", Boolean(state.actorName));
  }

  function requireActor() {
    if (state.actorName) return true;
    $("#calendarIdentityStatus").textContent = "Enter your name before making changes.";
    showDialog($("#calendarIdentityDialog"));
    return false;
  }

  function taskBounds(task) {
    let start = validDateOnly(task.startDate) || validDateOnly(task.dueDate);
    let end = validDateOnly(task.dueDate) || start;
    if (start && end && end < start) [start, end] = [end, start];
    return { start, end };
  }

  function touchesDate(task, value) {
    const { start, end } = taskBounds(task);
    return Boolean(start && end && value >= start && value <= end);
  }

  // Month cells deliberately mark only meaningful endpoints for ranged work.
  // A task that runs for weeks no longer paints every day in the calendar.
  function marksDate(task, value) {
    const { start, end } = taskBounds(task);
    if (!start || !end) return false;
    if (start === end) return value === start;
    return value === start || value === end;
  }

  function intersects(task, startRange, endRange) {
    const { start, end } = taskBounds(task);
    return Boolean(start && end && start <= endRange && end >= startRange);
  }

  function parseDateOnly(value) {
    const text = validDateOnly(value);
    if (!text) return null;
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function validDateOnly(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const candidate = `${match[1]}-${match[2]}-${match[3]}`;
    const date = parseDateOnlyUnsafe(candidate);
    return date && dateText(date) === candidate ? candidate : "";
  }

  function parseDateOnlyUnsafe(value) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function validTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "";
    const hour = Number(match[1]), minute = Number(match[2]);
    return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : "";
  }

  function todayText() { return dateText(new Date()); }
  function dateText(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function addDays(value, amount) { const date = parseDateOnly(value); date.setDate(date.getDate() + amount); return dateText(date); }
  function formatShortDate(value) { const date = parseDateOnly(value); return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }) : "—"; }
  function formatClock(value) { const time = validTime(value); if (!time) return ""; const [h, m] = time.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function addMinutes(value, amount) { const [h, m] = validTime(value).split(":").map(Number); const total = (h * 60 + m + amount) % 1440; return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
  function icsDateTime(date, time) { return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`; }
  function icsTimestamp(value) { const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date(); return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function icsEscape(value) { return String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
  function statusLabel(value) { return ({ BACKLOG: "Backlog", PLANNED: "Planned", IN_PROGRESS: "In progress", BLOCKED: "Blocked", REVIEW: "Review / test", DONE: "Done" })[value] || value || "Planned"; }
  function priorityLabel(value) { return ({ CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" })[value] || value || "Medium"; }
  function normalizeName(value) { return String(value || "").trim().replace(/\s+/g, " "); }
  function relativeTime(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "recently";
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return "just now";
    const format = new Intl.RelativeTimeFormat("en", {numeric:"auto"});
    if (seconds < 3600) return format.format(-Math.floor(seconds / 60), "minute");
    if (seconds < 86400) return format.format(-Math.floor(seconds / 3600), "hour");
    return format.format(-Math.floor(seconds / 86400), "day");
  }
  function slugify(value) { return String(value || "calendar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

  function showDialog(dialog) { document.body.classList.add("dialog-open"); dialog.showModal(); }
  function setLoading(active) { $("#calendarLoading").classList.toggle("is-hidden", !active); }
  function showConnectionError(message) {
    const host = $("#calendarConnectionBanner");
    host.replaceChildren();
    host.classList.toggle("is-hidden", !message);
    if (!message) return;
    const text = document.createElement("span");
    text.textContent = message;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary button-small connection-retry";
    retry.textContent = "Retry";
    retry.addEventListener("click", loadCalendar, { once: true });
    host.append(text, retry);
  }
  function setPageMessage(message, tone = "") { const host = $("#calendarMessage"); host.textContent = message || ""; host.className = `form-status calendar-page-message${tone ? ` is-${tone}` : ""}`; }
  function setEventStatus(message, tone = "") { const host = $("#calendarEventFormStatus"); host.textContent = message || ""; host.className = `form-status event-form-status${tone ? ` is-${tone}` : ""}`; }
  function setSubscriptionStatus(message, tone = "") { const host = $("#calendarSubscriptionStatus"); host.textContent = message || ""; host.className = `form-status${tone ? ` is-${tone}` : ""}`; }
  function setButtonBusy(button, busy, label) { button.disabled = busy; button.textContent = label; }
  function downloadFile(name, body, type) { const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 500); }
})();
