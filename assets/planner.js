(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const STATUS = [
    { id: "BACKLOG", label: "Backlog", help: "Captured but not scheduled" },
    { id: "PLANNED", label: "Planned", help: "Ready and scheduled" },
    { id: "IN_PROGRESS", label: "In progress", help: "Actively being worked" },
    { id: "BLOCKED", label: "Blocked", help: "Waiting on a decision or dependency" },
    { id: "REVIEW", label: "Review / test", help: "Needs validation or approval" },
    { id: "DONE", label: "Done", help: "Completed and documented" }
  ];
  const PRIORITY = [
    { id: "CRITICAL", label: "Critical" },
    { id: "HIGH", label: "High" },
    { id: "MEDIUM", label: "Medium" },
    { id: "LOW", label: "Low" }
  ];
  const TASK_TYPE = [
    { id: "WORK", label: "Work item" },
    { id: "FUNDING", label: "Funding opportunity" },
    { id: "PURCHASE", label: "Purchase / part" },
    { id: "MEETING", label: "Event / meeting" }
  ];
  const SOURCE_CONFIDENCE = [
    { id: "OFFICIAL_CURRENT", label: "Official · current details" },
    { id: "OFFICIAL_NO_CURRENT_DEADLINE", label: "Official · deadline not posted" },
    { id: "VERIFY_CURRENT", label: "Official older guidance · verify" },
    { id: "CONTACT_REQUIRED", label: "Contact Purdue for details" },
    { id: "TEAM_ENTERED", label: "Team-entered information" }
  ];
  const ORDER_STATUS = [
    { id: "NOT_NEEDED", label: "Not a purchase" },
    { id: "NEEDS_SPEC", label: "Needs specification" },
    { id: "NEEDS_QUOTE", label: "Needs quote" },
    { id: "READY_TO_ORDER", label: "Ready to order" },
    { id: "ORDERED", label: "Ordered" },
    { id: "SHIPPED", label: "Shipped" },
    { id: "RECEIVED", label: "Received" }
  ];
  const ACTIVE_STATUSES = new Set(["BACKLOG", "PLANNED", "IN_PROGRESS", "BLOCKED", "REVIEW"]);
  const CLUB_TEAM_ID = "TEAM-CLUB";
  const AGGREGATE_BOARD_ID = "BOARD-CLUB-PORTFOLIO";

  const state = {
    actorName: "",
    teams: [],
    boards: [],
    tasks: [],
    currentTeamId: "",
    currentBoardId: "",
    view: "board",
    loading: false,
    taskDetail: null,
    draggedTaskId: "",
    insightsScope: "board",
    calendarMonth: `${todayText().slice(0, 7)}-01`,
    calendarFeedBaseUrl: "",
    pendingTaskId: "",
    taskDirty: false,
    eventDirty: false,
    suppressDirty: false,
    taskDraftTimer: 0,
    eventDraftTimer: 0,
    savingTask: false,
    savingEvent: false
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    populateStaticOptions();
    bindEvents();
    restoreIdentity();
    state.view = localStorage.getItem("asmePlannerView") || "board";
    state.calendarMonth = localStorage.getItem("asmePlannerCalendarMonth") || state.calendarMonth;
    if (!API || !API.configured()) {
      showConnectionError("SponsorFlow is not connected. Add the Apps Script web app URL to assets/config.js.");
      return;
    }
    await loadPlanner();
  }

  function populateStaticOptions() {
    $("#statusFilter").innerHTML += STATUS.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#priorityFilter").innerHTML += PRIORITY.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#taskType").innerHTML = TASK_TYPE.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#taskStatus").innerHTML = STATUS.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#taskPriority").innerHTML = PRIORITY.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#taskOrderStatus").innerHTML = ORDER_STATUS.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#taskSourceConfidence").innerHTML = SOURCE_CONFIDENCE.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
    $("#eventPriority").innerHTML = PRIORITY.map(item => `<option value="${item.id}">${item.label}</option>`).join("");
  }

  function bindEvents() {
    $("#savePlannerNameButton").addEventListener("click", () => saveIdentity($("#plannerActorName").value));
    $("#plannerActorName").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); saveIdentity(event.currentTarget.value); }
    });
    $("#identityDialogSave").addEventListener("click", () => {
      if (saveIdentity($("#identityDialogName").value, true)) $("#identityDialog").close();
    });
    $("#identityDialogName").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); $("#identityDialogSave").click(); }
    });

    $("#teamFilter").addEventListener("change", handleTeamChange);
    $("#boardSelect").addEventListener("change", handleBoardChange);
    $$("[data-planner-view]").forEach(button => button.addEventListener("click", () => setPlannerView(button.dataset.plannerView)));
    $("#newTaskButton").addEventListener("click", () => openTaskDialog());
    $("#newTaskTopButton").addEventListener("click", () => openTaskDialog());
    $("#newEventTopButton").addEventListener("click", () => openEventDialog());
    $("#newEventButton").addEventListener("click", () => openEventDialog());
    $("#manageWorkspaceButton").addEventListener("click", openWorkspaceDialog);
    $$("[data-open-workspace]").forEach(button => button.addEventListener("click", openWorkspaceDialog));
    $("#editBoardButton").addEventListener("click", editCurrentBoard);
    $("#shareBoardButton").addEventListener("click", shareBoard);
    $("#exportBoardButton").addEventListener("click", exportBoardCsv);
    $("#exportCalendarButton").addEventListener("click", downloadBoardCalendar);
    $("#downloadCalendarButton").addEventListener("click", downloadBoardCalendar);
    $("#calendarSubscriptionsButton").addEventListener("click", openCalendarSubscriptions);
    $("#openCalendarSubscriptionsButton").addEventListener("click", openCalendarSubscriptions);
    $("#addCalendarEventButton").addEventListener("click", () => openEventDialog("", { startDate: todayText(), endDate: todayText() }));
    $("#calendarPreviousButton").addEventListener("click", () => moveCalendarMonth(-1));
    $("#calendarTodayButton").addEventListener("click", () => { state.calendarMonth = `${todayText().slice(0, 7)}-01`; renderCalendar(); });
    $("#calendarNextButton").addEventListener("click", () => moveCalendarMonth(1));

    ["taskSearch", "statusFilter", "priorityFilter", "ownerFilter", "partsOnlyFilter", "hideDoneFilter"].forEach(id => {
      $("#" + id).addEventListener(id.endsWith("Filter") && !["taskSearch"].includes(id) ? "change" : "input", renderCurrentBoard);
    });
    $("#clearPlannerFilters").addEventListener("click", clearFilters);
    $("#timelineScale").addEventListener("change", renderGantt);
    $("#insightsScope").addEventListener("change", event => { state.insightsScope = event.currentTarget.value; renderInsights(); });

    $("#teamForm").addEventListener("submit", saveTeam);
    $("#boardForm").addEventListener("submit", saveBoard);
    $("#resetTeamForm").addEventListener("click", resetTeamForm);
    $("#resetBoardForm").addEventListener("click", resetBoardForm);
    $("#workspaceDirectoryList").addEventListener("click", handleWorkspaceDirectoryClick);

    $("#taskForm").addEventListener("submit", saveTask);
    $("#taskBoardId").addEventListener("change", () => renderDependencyPicker($("#taskId").value, selectedDependencies()));
    $("#archiveTaskButton").addEventListener("click", archiveTask);
    $("#downloadTaskCalendarButton").addEventListener("click", downloadTaskCalendarFromForm);
    $("#addTaskCommentButton").addEventListener("click", addTaskComment);
    ["taskType", "taskStatus", "taskPriority", "taskProgress", "taskStartDate", "taskDueDate", "taskOrderStatus", "taskIsMilestone", "taskImportantDate", "taskSourceConfidence"].forEach(id => {
      $("#" + id).addEventListener("change", () => { updateFundingEditor(); updateTaskHealthPreview(); updateTaskCalendarButton(); });
    });
    ["taskTitle", "taskDescription", "taskOwners", "taskTags", "taskRequirements", "taskSourceUrl", "taskStartTime", "taskEndTime", "taskLocation"].forEach(id => {
      $("#" + id).addEventListener("input", () => { updateTaskCalendarButton(); markTaskDirty(); });
    });
    ["taskBoardId", "taskType", "taskStatus", "taskPriority", "taskProgress", "taskStartDate", "taskDueDate", "taskAllDay", "taskIsMilestone", "taskImportantDate", "taskOrderStatus", "taskSourceConfidence"].forEach(id => {
      $("#" + id).addEventListener("change", () => { markTaskDirty(); updateTaskTimeFields(); });
    });
    $("#taskForm").addEventListener("input", markTaskDirty);
    $("#taskCancelButton").addEventListener("click", () => requestDialogClose("taskDialog"));
    $$("[data-task-tab]").forEach(button => button.addEventListener("click", () => setTaskTab(button.dataset.taskTab)));

    $("#eventForm").addEventListener("submit", saveCalendarEvent);
    $("#eventCancelButton").addEventListener("click", () => requestDialogClose("eventDialog"));
    $("#eventArchiveButton").addEventListener("click", archiveCalendarEvent);
    $("#eventOpenFullTaskButton").addEventListener("click", openEventInFullEditor);
    $("#eventAllDay").addEventListener("change", () => { updateEventTimeFields(); markEventDirty(); });
    $("#eventStartDate").addEventListener("change", () => {
      if (!$("#eventEndDate").value || $("#eventEndDate").value < $("#eventStartDate").value) $("#eventEndDate").value = $("#eventStartDate").value;
      markEventDirty();
    });
    $("#eventBoardId").addEventListener("change", markEventDirty);
    $("#eventForm").addEventListener("input", markEventDirty);
    $("#eventForm").addEventListener("change", markEventDirty);

    $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => {
      requestDialogClose(button.dataset.closeDialog);
    }));
    $$("dialog.modal").forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target === dialog) requestDialogClose(dialog.id);
      });
      dialog.addEventListener("cancel", event => {
        if ((dialog.id === "taskDialog" && state.taskDirty) || (dialog.id === "eventDialog" && state.eventDirty)) {
          event.preventDefault();
          requestDialogClose(dialog.id);
        }
      });
      dialog.addEventListener("close", () => {
        if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
      });
    });
  }

  function restoreIdentity() {
    const remembered = localStorage.getItem("asmePlannerName") || "";
    state.actorName = normalizeDisplayName(remembered);
    $("#plannerActorName").value = state.actorName;
    updateIdentityUi();
    if (!state.actorName) {
      window.setTimeout(() => {
        if (!$("#identityDialog").open) showPlannerDialog($("#identityDialog"));
        $("#identityDialogName").focus();
      }, 250);
    }
  }

  function saveIdentity(value, fromDialog = false) {
    const clean = normalizeDisplayName(value);
    const status = fromDialog ? $("#identityDialogStatus") : $("#plannerNameStatus");
    if (clean.length < 2) {
      status.textContent = "Enter your full name so changes have an owner.";
      status.classList.add("is-error");
      return false;
    }
    state.actorName = clean;
    localStorage.setItem("asmePlannerName", clean);
    $("#plannerActorName").value = clean;
    $("#identityDialogName").value = clean;
    status.textContent = "Name saved";
    status.classList.remove("is-error");
    updateIdentityUi();
    if (state.pendingTaskId) {
      const pending = state.pendingTaskId;
      state.pendingTaskId = "";
      window.setTimeout(() => openTaskDialog(pending), 50);
    }
    return true;
  }

  function updateIdentityUi() {
    const status = $("#plannerNameStatus");
    if (state.actorName) {
      status.textContent = `Editing as ${state.actorName}`;
      status.classList.add("is-ready");
    } else {
      status.textContent = "Required to edit";
      status.classList.remove("is-ready");
    }
  }

  function requireActor() {
    if (state.actorName) return true;
    $("#identityDialogStatus").textContent = "Enter your name before making changes.";
    showPlannerDialog($("#identityDialog"));
    $("#identityDialogName").focus();
    return false;
  }

  async function loadPlanner(options = {}) {
    const requestedTask = new URLSearchParams(window.location.search).get("task") || "";
    const previousBoardId = options.boardId || state.currentBoardId || "";
    const previousView = state.view;
    const previousMonth = state.calendarMonth;
    setLoading(true);
    try {
      const data = await API.post("plannerBootstrap");
      applyPlannerBootstrap(data, previousBoardId);
      state.view = options.preserveView === false ? "board" : previousView;
      state.calendarMonth = previousMonth || state.calendarMonth;
      setPlannerView(state.view);
      renderCurrentBoard();
      hideConnectionError();
      if (requestedTask) {
        state.pendingTaskId = requestedTask;
        if (state.actorName) {
          window.setTimeout(() => openTaskDialog(requestedTask), 100);
          state.pendingTaskId = "";
        }
      }
    } catch (error) {
      showConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function applyPlannerBootstrap(data, preferredBoardId = "") {
    state.teams = Array.isArray(data.teams) ? data.teams : [];
    state.boards = Array.isArray(data.boards) ? data.boards : [];
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    state.calendarFeedBaseUrl = String(data.calendarFeedBaseUrl || "");
    renderContextOptions();
    chooseInitialBoard(preferredBoardId);
  }

  function chooseInitialBoard(preferredId = "") {
    const queryBoard = new URLSearchParams(window.location.search).get("board") || "";
    const stored = localStorage.getItem("asmePlannerBoard") || "";
    const fallback = state.teams.some(team => team.id === CLUB_TEAM_ID) ? AGGREGATE_BOARD_ID : state.boards[0]?.id || "";
    const candidate = preferredId || queryBoard || stored || fallback;
    if (candidate === AGGREGATE_BOARD_ID) {
      state.currentBoardId = AGGREGATE_BOARD_ID;
      state.currentTeamId = CLUB_TEAM_ID;
    } else {
      const selected = state.boards.find(board => board.id === candidate) || state.boards[0] || null;
      state.currentBoardId = selected?.id || "";
      state.currentTeamId = selected?.teamId || state.teams[0]?.id || "";
    }
    $("#teamFilter").value = state.currentTeamId;
    renderBoardOptions();
    $("#boardSelect").value = state.currentBoardId;
    persistBoardSelection();
  }

  function renderContextOptions() {
    $("#teamFilter").innerHTML = state.teams.length
      ? state.teams.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("")
      : '<option value="">No teams yet</option>';
    $("#boardTeamId").innerHTML = state.teams.length
      ? state.teams.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("")
      : '<option value="">Create a team first</option>';
    populateTaskBoardOptions();
    populateEventBoardOptions();
    renderBoardOptions();
    renderWorkspaceDirectory();
  }

  function populateTaskBoardOptions(selectedId = "") {
    const grouped = state.teams.map(team => {
      const boards = state.boards.filter(board => board.teamId === team.id);
      if (!boards.length) return "";
      return `<optgroup label="${escapeHtml(team.name)}">${boards.map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join("")}</optgroup>`;
    }).join("");
    $("#taskBoardId").innerHTML = grouped || '<option value="">Create a timeline first</option>';
    if (selectedId && state.boards.some(board => board.id === selectedId)) $("#taskBoardId").value = selectedId;
  }

  function populateEventBoardOptions(selectedId = "") {
    const grouped = state.teams.map(team => {
      const boards = state.boards.filter(board => board.teamId === team.id);
      if (!boards.length) return "";
      return `<optgroup label="${escapeHtml(team.name)}">${boards.map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join("")}</optgroup>`;
    }).join("");
    $("#eventBoardId").innerHTML = grouped || '<option value="">Create a timeline first</option>';
    const candidate = selectedId && state.boards.some(board => board.id === selectedId) ? selectedId : defaultTaskBoardId();
    if (candidate) $("#eventBoardId").value = candidate;
  }

  function renderBoardOptions() {
    const filtered = state.boards.filter(board => !state.currentTeamId || board.teamId === state.currentTeamId);
    const aggregate = state.currentTeamId === CLUB_TEAM_ID
      ? `<option value="${AGGREGATE_BOARD_ID}">Club-wide portfolio · all teams</option>`
      : "";
    $("#boardSelect").innerHTML = aggregate + (filtered.length
      ? filtered.map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join("")
      : aggregate ? "" : '<option value="">No timelines for this team</option>');
  }

  function handleTeamChange() {
    state.currentTeamId = $("#teamFilter").value;
    renderBoardOptions();
    const available = state.boards.filter(board => board.teamId === state.currentTeamId);
    state.currentBoardId = state.currentTeamId === CLUB_TEAM_ID ? AGGREGATE_BOARD_ID : available[0]?.id || "";
    $("#boardSelect").value = state.currentBoardId;
    persistBoardSelection();
    renderCurrentBoard();
  }

  function handleBoardChange() {
    state.currentBoardId = $("#boardSelect").value;
    const board = currentBoard();
    if (board) {
      state.currentTeamId = board.teamId;
      $("#teamFilter").value = board.teamId;
      localStorage.setItem("asmePlannerBoard", board.id);
    }
    persistBoardSelection();
    renderCurrentBoard();
  }

  function persistBoardSelection() {
    const url = new URL(window.location.href);
    if (state.currentBoardId) url.searchParams.set("board", state.currentBoardId);
    else url.searchParams.delete("board");
    url.searchParams.delete("task");
    window.history.replaceState({}, "", url);
  }

  function aggregateBoard() {
    const dated = state.tasks.filter(task => !task.archived && (task.startDate || task.dueDate));
    const dates = dated.flatMap(task => [task.startDate, task.dueDate]).filter(Boolean).sort();
    return {
      id: AGGREGATE_BOARD_ID,
      teamId: CLUB_TEAM_ID,
      name: "Club-wide Portfolio",
      description: "One shared view of every active team timeline, including Finance & Sponsorship opportunities, deadlines, parts, testing, and important club dates.",
      targetStart: dates[0] || "",
      targetEnd: dates[dates.length - 1] || "",
      active: true,
      isAggregate: true
    };
  }

  function isAggregateBoard(board = currentBoard()) { return Boolean(board?.isAggregate || board?.id === AGGREGATE_BOARD_ID); }
  function currentBoard() { return state.currentBoardId === AGGREGATE_BOARD_ID ? aggregateBoard() : state.boards.find(board => board.id === state.currentBoardId) || null; }
  function currentTeam() { const board = currentBoard(); return state.teams.find(team => team.id === (board?.teamId || state.currentTeamId)) || null; }
  function boardTasks() { return isAggregateBoard() ? state.tasks.filter(task => !task.archived) : state.tasks.filter(task => task.boardId === state.currentBoardId && !task.archived); }
  function actualBoardForTask(task) { return state.boards.find(board => board.id === task?.boardId) || null; }
  function teamForTask(task) { const board = actualBoardForTask(task); return state.teams.find(team => team.id === board?.teamId) || null; }
  function defaultTaskBoardId() {
    if (!isAggregateBoard() && state.boards.some(board => board.id === state.currentBoardId)) return state.currentBoardId;
    return state.boards.find(board => board.teamId === CLUB_TEAM_ID)?.id || state.boards[0]?.id || "";
  }

  function filteredTasks() {
    const search = $("#taskSearch").value.trim().toLowerCase();
    const status = $("#statusFilter").value;
    const priority = $("#priorityFilter").value;
    const owner = $("#ownerFilter").value;
    const partsOnly = $("#partsOnlyFilter").checked;
    const hideDone = $("#hideDoneFilter").checked;
    return boardTasks().filter(task => {
      const haystack = [task.title, task.description, task.ownerNames, task.tags, task.partName, task.partNumber, task.vendor, task.campus, task.fundingAmountLabel, task.requirements].join(" ").toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (owner && !splitList(task.ownerNames).some(name => normalizeKey(name) === normalizeKey(owner))) return false;
      if (partsOnly && !isPartsTask(task)) return false;
      if (hideDone && task.status === "DONE") return false;
      return true;
    });
  }

  function renderCurrentBoard() {
    const board = currentBoard();
    const workspace = $("#plannerWorkspace");
    const empty = $("#boardEmptyState");
    if (!board) {
      workspace.classList.add("is-hidden");
      empty.classList.remove("is-hidden");
      return;
    }
    empty.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");

    const team = currentTeam();
    $("#boardTeamBadge").textContent = isAggregateBoard(board) ? "ALL · CLUB-WIDE" : `${team?.icon || "TEAM"} · ${team?.name || "Team"}`;
    $("#boardTitle").textContent = board.name;
    $("#boardDescription").textContent = board.description || "Shared team timeline.";
    $("#boardDateRange").textContent = formatBoardDateRange(board);
    $("#editBoardButton").classList.toggle("is-hidden", isAggregateBoard(board));
    $("#editBoardButton").disabled = false;
    $("#editBoardButton").title = "Edit this timeline";
    renderOwnerFilter();
    renderMetrics();
    renderKanban();
    renderGantt();
    renderTaskTable();
    renderCalendar();
    renderInsights();
  }

  function renderOwnerFilter() {
    const selected = $("#ownerFilter").value;
    const owners = Array.from(new Set(boardTasks().flatMap(task => splitList(task.ownerNames)))).sort((a, b) => a.localeCompare(b));
    $("#ownerFilter").innerHTML = '<option value="">All owners</option>' + owners.map(owner => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`).join("");
    if (owners.includes(selected)) $("#ownerFilter").value = selected;
  }

  function renderMetrics() {
    const tasks = boardTasks();
    const now = todayText();
    const done = tasks.filter(task => task.status === "DONE").length;
    const overdue = tasks.filter(task => task.status !== "DONE" && task.dueDate && task.dueDate < now).length;
    const blocked = tasks.filter(task => task.status === "BLOCKED").length;
    const dueSoon = tasks.filter(task => task.status !== "DONE" && task.dueDate && task.dueDate >= now && daysBetween(now, task.dueDate) <= 7).length;
    const awaitingOrder = tasks.filter(task => ["NEEDS_SPEC", "NEEDS_QUOTE", "READY_TO_ORDER"].includes(task.orderStatus)).length;
    const estimatedCost = tasks.reduce((sum, task) => sum + (Number(task.estimatedCost) || 0), 0);
    const funding = tasks.filter(task => task.taskType === "FUNDING");
    const knownFunding = funding.reduce((sum, task) => sum + (Number(task.fundingMax) || 0), 0);
    const variableFunding = funding.filter(task => !Number(task.fundingMax)).length;
    const completion = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / tasks.length) : 0;

    const fourth = funding.length
      ? { label: "Funding tracked", value: knownFunding ? formatCurrency(knownFunding) : funding.length, detail: `${funding.length} opportunities${variableFunding ? ` · ${variableFunding} variable` : ""}`, tone: "funding" }
      : { label: "Parts to source", value: awaitingOrder, detail: `${formatCurrency(estimatedCost)} estimated total`, tone: awaitingOrder ? "parts" : "neutral" };
    const metrics = [
      { label: "Overall progress", value: `${completion}%`, detail: `${done} of ${tasks.length} tasks done`, tone: "completion" },
      { label: "Needs attention", value: overdue + blocked, detail: `${overdue} overdue · ${blocked} blocked`, tone: overdue + blocked ? "danger" : "good" },
      { label: "Due in 7 days", value: dueSoon, detail: "Upcoming commitments", tone: dueSoon ? "warning" : "neutral" },
      fourth
    ];
    $("#plannerMetrics").innerHTML = metrics.map(metric => `
      <article class="planner-metric metric-${metric.tone}">
        <span>${escapeHtml(metric.label)}</span>
        <strong>${escapeHtml(String(metric.value))}</strong>
        <small>${escapeHtml(metric.detail)}</small>
        ${metric.tone === "completion" ? `<div class="planner-progress-track"><i style="width:${completion}%"></i></div>` : ""}
      </article>`).join("");
  }

  function renderKanban() {
    const tasks = filteredTasks();
    $("#kanbanBoard").innerHTML = STATUS.map(status => {
      const columnTasks = tasks.filter(task => task.status === status.id).sort(taskSort);
      return `<section class="kanban-column" data-drop-status="${status.id}">
        <header><div><span class="kanban-status-dot status-color-${status.id}"></span><strong>${status.label}</strong></div><span>${columnTasks.length}</span></header>
        <p>${status.help}</p>
        <div class="kanban-task-list">
          ${columnTasks.length ? columnTasks.map(renderTaskCard).join("") : `<div class="kanban-empty">Drop a task here</div>`}
        </div>
        <button class="kanban-add" type="button" data-quick-add-status="${status.id}">+ Add task</button>
      </section>`;
    }).join("");

    $$(".planner-task-card").forEach(card => {
      card.addEventListener("click", event => { if (!event.defaultPrevented) openTaskDialog(card.dataset.taskId); });
      card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTaskDialog(card.dataset.taskId); } });
      card.addEventListener("dragstart", event => {
        state.draggedTaskId = card.dataset.taskId;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", state.draggedTaskId);
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => { card.classList.remove("is-dragging"); state.draggedTaskId = ""; });
    });
    $$("[data-drop-status]").forEach(column => {
      column.addEventListener("dragover", event => { event.preventDefault(); column.classList.add("is-drag-over"); });
      column.addEventListener("dragleave", () => column.classList.remove("is-drag-over"));
      column.addEventListener("drop", async event => {
        event.preventDefault();
        column.classList.remove("is-drag-over");
        const taskId = event.dataTransfer.getData("text/plain") || state.draggedTaskId;
        await moveTask(taskId, column.dataset.dropStatus);
      });
    });
    $$("[data-quick-add-status]").forEach(button => button.addEventListener("click", () => openTaskDialog("", { status: button.dataset.quickAddStatus })));
  }

  function renderTaskCard(task) {
    const due = dueState(task);
    const owners = splitList(task.ownerNames);
    const depCount = splitList(task.dependencyIds).length;
    const part = isPartsTask(task);
    const funding = task.taskType === "FUNDING";
    return `<article class="planner-task-card priority-edge-${task.priority}${funding ? " is-funding-card" : ""}" role="button" tabindex="0" draggable="true" data-task-id="${escapeHtml(task.id)}">
      <div class="task-card-top">
        <span class="priority-pill priority-${task.priority}">${priorityLabel(task.priority)}</span>
        <span class="task-type-pill type-${task.taskType || "WORK"}">${taskTypeLabel(task.taskType)}</span>
        ${task.isMilestone ? '<span class="milestone-pill">◆ Milestone</span>' : ""}
        ${task.importantDate ? '<span class="milestone-pill important-date-pill">★ Important</span>' : ""}
        ${isAggregateBoard() ? `<span class="task-team-pill">${escapeHtml(teamForTask(task)?.name || "Team")}</span>` : ""}
      </div>
      <h3>${escapeHtml(task.title)}</h3>
      ${task.description ? `<p>${escapeHtml(truncate(task.description, 125))}</p>` : ""}
      <div class="task-card-tags">
        ${splitList(task.tags).slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
        ${part ? `<span class="part-tag">${escapeHtml(orderLabel(task.orderStatus))}</span>` : ""}
        ${funding && task.campus ? `<span class="funding-campus-tag">${escapeHtml(task.campus)}</span>` : ""}
      </div>
      ${funding ? `<div class="funding-value-line"><strong>${escapeHtml(fundingValueLabel(task))}</strong><span>${escapeHtml(sourceConfidenceShort(task.sourceConfidence))}</span></div>` : ""}
      <div class="task-card-progress"><i style="width:${clamp(Number(task.progress) || 0, 0, 100)}%"></i><span>${clamp(Number(task.progress) || 0, 0, 100)}%</span></div>
      <footer>
        <div class="task-owner-avatars" aria-label="Owners">${renderOwnerAvatars(owners)}</div>
        <div class="task-card-signals">
          ${depCount ? `<span title="Dependencies">↳ ${depCount}</span>` : ""}
          ${task.commentCount ? `<span title="Comments">◌ ${task.commentCount}</span>` : ""}
          ${due.text ? `<span class="due-${due.tone}">${escapeHtml(due.text)}</span>` : ""}
        </div>
      </footer>
    </article>`;
  }

  function renderGantt() {
    const host = $("#ganttHost");
    if (!currentBoard()) return;
    const tasks = filteredTasks().filter(task => task.startDate || task.dueDate).sort((a, b) => (a.startDate || a.dueDate || "").localeCompare(b.startDate || b.dueDate || "") || taskSort(a, b));
    if (!tasks.length) {
      host.innerHTML = `<div class="timeline-empty"><span>↔</span><h3>No dated tasks in this view</h3><p>Add a start date or due date to place work on the timeline.</p><button class="button button-secondary button-small" type="button" data-empty-add-task>Add a dated task</button></div>`;
      host.querySelector("[data-empty-add-task]")?.addEventListener("click", () => openTaskDialog());
      return;
    }

    const board = currentBoard();
    const range = timelineRange(tasks, board);
    const scale = $("#timelineScale").value;
    const dayWidth = scale === "compact" ? 18 : scale === "wide" ? 42 : 28;
    const totalDays = Math.max(1, daysBetween(range.start, range.end) + 1);
    const trackWidth = totalDays * dayWidth;
    const labelWidth = 270;
    const todayOffset = daysBetween(range.start, todayText()) * dayWidth;
    const axis = buildTimelineAxis(range.start, totalDays, dayWidth);

    const rows = tasks.map(task => {
      const start = task.startDate || task.dueDate;
      const end = task.dueDate || task.startDate;
      const left = daysBetween(range.start, start) * dayWidth;
      const durationDays = Math.max(1, daysBetween(start, end) + 1);
      const width = Math.max(task.isMilestone ? 16 : dayWidth * durationDays, 12);
      const owners = splitList(task.ownerNames).join(", ") || "Unassigned";
      const overdue = task.status !== "DONE" && task.dueDate && task.dueDate < todayText();
      const dependencyNames = splitList(task.dependencyIds).map(id => state.tasks.find(item => item.id === id)?.title).filter(Boolean);
      return `<div class="gantt-row" data-task-id="${escapeHtml(task.id)}">
        <button class="gantt-label" type="button" data-open-task="${escapeHtml(task.id)}">
          <span class="priority-dot priority-bg-${task.priority}"></span>
          <span><strong>${escapeHtml(task.title)}</strong><small>${isAggregateBoard() ? `${escapeHtml(teamForTask(task)?.name || "Team")} · ` : ""}${escapeHtml(owners)}${dependencyNames.length ? ` · waits on ${escapeHtml(truncate(dependencyNames.join(", "), 48))}` : ""}</small></span>
        </button>
        <div class="gantt-track" style="width:${trackWidth}px;background-size:${dayWidth * 7}px 100%">
          ${todayOffset >= 0 && todayOffset <= trackWidth ? `<i class="gantt-today-line" style="left:${todayOffset}px"></i>` : ""}
          ${task.isMilestone
            ? `<button class="gantt-milestone priority-bg-${task.priority}" type="button" style="left:${left}px" data-open-task="${escapeHtml(task.id)}" title="${escapeHtml(task.title)}"></button>`
            : `<button class="gantt-bar status-bar-${task.status}${overdue ? " is-overdue" : ""}" type="button" style="left:${left}px;width:${width}px" data-open-task="${escapeHtml(task.id)}"><i style="width:${clamp(Number(task.progress) || 0, 0, 100)}%"></i><span>${escapeHtml(truncate(task.title, Math.max(12, Math.floor(width / 8))))}</span></button>`}
        </div>
      </div>`;
    }).join("");

    host.innerHTML = `<div class="gantt-scroll"><div class="gantt-canvas" style="width:${labelWidth + trackWidth}px">
      <div class="gantt-axis"><div class="gantt-axis-label"><strong>${escapeHtml(formatShortDate(range.start))}</strong><span>to ${escapeHtml(formatShortDate(range.end))}</span></div><div class="gantt-axis-track" style="width:${trackWidth}px">${axis}</div></div>
      ${rows}
    </div></div>`;
    host.querySelectorAll("[data-open-task]").forEach(button => button.addEventListener("click", () => openTaskDialog(button.dataset.openTask)));
  }

  function buildTimelineAxis(startText, totalDays, dayWidth) {
    const segments = [];
    let index = 0;
    while (index < totalDays) {
      const date = addDaysText(startText, index);
      const day = parseDate(date);
      const remainingInMonth = daysInMonth(day.getFullYear(), day.getMonth()) - day.getDate() + 1;
      const span = Math.min(remainingInMonth, totalDays - index);
      segments.push(`<div class="gantt-month" style="left:${index * dayWidth}px;width:${span * dayWidth}px"><strong>${day.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</strong></div>`);
      index += span;
    }
    const weeks = [];
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 7) {
      const date = addDaysText(startText, dayIndex);
      weeks.push(`<div class="gantt-week" style="left:${dayIndex * dayWidth}px;width:${Math.min(7, totalDays - dayIndex) * dayWidth}px"><span>${formatAxisDate(date)}</span></div>`);
    }
    return segments.join("") + weeks.join("");
  }

  function renderTaskTable() {
    const tasks = filteredTasks().sort(taskSort);
    const tbody = $("#taskTableBody");
    if (!tasks.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty">No tasks match these filters.</div></td></tr>';
      return;
    }
    tbody.innerHTML = tasks.map(task => {
      const due = dueState(task);
      return `<tr data-table-task="${escapeHtml(task.id)}">
        <td><div class="table-task-title"><span class="priority-dot priority-bg-${task.priority}"></span><div><strong>${escapeHtml(task.title)}</strong><small>${isAggregateBoard() ? `${escapeHtml(teamForTask(task)?.name || "Team")} · ` : ""}${escapeHtml(splitList(task.tags).join(" · ") || task.description || "")}</small></div></div></td>
        <td><span class="status-badge task-status-${task.status}">${statusLabel(task.status)}</span></td>
        <td><span class="priority-pill priority-${task.priority}">${priorityLabel(task.priority)}</span></td>
        <td>${escapeHtml(task.ownerNames || "Unassigned")}</td>
        <td><strong>${escapeHtml(task.startDate ? formatShortDate(task.startDate) : "—")}</strong><small class="table-subline ${due.tone === "overdue" ? "text-danger" : ""}">${escapeHtml(task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : "No due date")}</small></td>
        <td>${task.taskType === "FUNDING" ? `<strong>${escapeHtml(fundingValueLabel(task))}</strong><small class="table-subline">${escapeHtml(task.campus || sourceConfidenceShort(task.sourceConfidence))}</small>` : isPartsTask(task) ? `<strong>${escapeHtml(task.partName || task.partNumber || "Part")}</strong><small class="table-subline">${escapeHtml(orderLabel(task.orderStatus))}</small>` : "—"}</td>
        <td><div class="table-progress"><i style="width:${clamp(Number(task.progress) || 0, 0, 100)}%"></i><span>${clamp(Number(task.progress) || 0, 0, 100)}%</span></div></td>
        <td>${escapeHtml(relativeTime(task.updatedAt))}<small class="table-subline">${escapeHtml(task.updatedBy || "")}</small></td>
      </tr>`;
    }).join("");
    tbody.querySelectorAll("[data-table-task]").forEach(row => row.addEventListener("click", () => openTaskDialog(row.dataset.tableTask)));
  }


  function moveCalendarMonth(offset) {
    const current = parseDate(state.calendarMonth || `${todayText().slice(0, 7)}-01`);
    current.setMonth(current.getMonth() + offset, 1);
    state.calendarMonth = dateText(current);
    localStorage.setItem("asmePlannerCalendarMonth", state.calendarMonth);
    renderCalendar();
  }

  function renderCalendar() {
    const grid = $("#plannerCalendarGrid");
    const agenda = $("#calendarAgenda");
    if (!grid || !agenda || !currentBoard()) return;

    const monthStart = parseDate(state.calendarMonth || `${todayText().slice(0, 7)}-01`);
    monthStart.setDate(1);
    state.calendarMonth = dateText(monthStart);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthStartText = dateText(monthStart);
    const monthEndText = dateText(monthEnd);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const tasks = filteredTasks().filter(task => task.startDate || task.dueDate).sort((a, b) => (a.startDate || a.dueDate || "").localeCompare(b.startDate || b.dueDate || "") || taskSort(a, b));

    $("#calendarMonthTitle").textContent = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const value = dateText(date);
      const dayTasks = tasks.filter(task => calendarTaskTouchesDate(task, value));
      const shown = dayTasks.slice(0, 3);
      const isOutside = date.getMonth() !== monthStart.getMonth();
      const isToday = value === todayText();
      cells.push(`<section class="calendar-day${isOutside ? " is-outside" : ""}${isToday ? " is-today" : ""}" data-calendar-date="${value}">
        <header><time datetime="${value}">${date.getDate()}</time><div>${isToday ? "<span>Today</span>" : ""}<button class="calendar-day-add" type="button" data-calendar-add="${value}" aria-label="Add event on ${value}">+</button></div></header>
        <div class="calendar-day-events">
          ${shown.map(task => renderCalendarEvent(task, value)).join("")}
          ${dayTasks.length > shown.length ? `<button class="calendar-more-button" type="button" data-calendar-date-focus="${value}">+${dayTasks.length - shown.length} more</button>` : ""}
        </div>
      </section>`);
    }
    grid.innerHTML = cells.join("");
    grid.querySelectorAll("[data-calendar-task]").forEach(button => button.addEventListener("click", () => {
      const task = state.tasks.find(item => item.id === button.dataset.calendarTask);
      if (task?.taskType === "MEETING") openEventDialog(task.id); else openTaskDialog(button.dataset.calendarTask);
    }));
    grid.querySelectorAll("[data-calendar-add]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      openEventDialog("", { startDate: button.dataset.calendarAdd, endDate: button.dataset.calendarAdd });
    }));
    grid.querySelectorAll("[data-calendar-date-focus]").forEach(button => button.addEventListener("click", () => focusCalendarAgendaDate(button.dataset.calendarDateFocus)));

    const monthTasks = tasks.filter(task => calendarTaskIntersectsRange(task, monthStartText, monthEndText));
    $("#calendarAgendaCount").textContent = String(monthTasks.length);
    agenda.innerHTML = monthTasks.length
      ? monthTasks.map(task => renderCalendarAgendaItem(task)).join("")
      : `<div class="calendar-empty"><span>◇</span><strong>No dated work this month</strong><p>Add dates to a task or move to another month.</p></div>`;
    agenda.querySelectorAll("[data-calendar-agenda-task]").forEach(button => button.addEventListener("click", () => {
      const task = state.tasks.find(item => item.id === button.dataset.calendarAgendaTask);
      if (task?.taskType === "MEETING") openEventDialog(task.id); else openTaskDialog(button.dataset.calendarAgendaTask);
    }));
    agenda.querySelectorAll("[data-calendar-agenda-download]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      const task = state.tasks.find(item => item.id === button.dataset.calendarAgendaDownload);
      if (task) downloadTasksCalendar([task], task.title);
    }));
  }

  function renderCalendarEvent(task, dateValue) {
    const label = calendarEventLabel(task, dateValue);
    const time = task.allDay === false && task.startTime ? formatClock(task.startTime) : "";
    return `<button class="calendar-event calendar-status-${task.status}" type="button" data-calendar-task="${escapeHtml(task.id)}" title="${escapeHtml(task.title)}">
      <span class="priority-dot priority-bg-${task.priority}"></span>
      <span>${time ? `<b>${escapeHtml(time)}</b> ` : ""}${escapeHtml(label)}</span>
      ${isAggregateBoard() ? `<small>${escapeHtml(teamForTask(task)?.icon || teamForTask(task)?.name || "TEAM")}</small>` : ""}
    </button>`;
  }

  function renderCalendarAgendaItem(task) {
    const start = task.startDate || task.dueDate;
    const end = task.dueDate || task.startDate;
    const dateLabel = start === end ? formatShortDate(start) : `${formatShortDate(start)} – ${formatShortDate(end)}`;
    return `<article class="calendar-agenda-item" data-agenda-date="${escapeHtml(start)}" data-agenda-task-id="${escapeHtml(task.id)}">
      <button class="calendar-agenda-main" type="button" data-calendar-agenda-task="${escapeHtml(task.id)}">
        <span class="calendar-agenda-date">${escapeHtml(dateLabel)}</span>
        <span class="calendar-agenda-copy">
          <strong>${escapeHtml(task.title)}</strong>
          <small>${isAggregateBoard() ? `${escapeHtml(teamForTask(task)?.name || "Team")} · ` : ""}${escapeHtml(statusLabel(task.status))} · ${escapeHtml(priorityLabel(task.priority))}${task.ownerNames ? ` · ${escapeHtml(task.ownerNames)}` : ""}</small>
        </span>
      </button>
      <button class="calendar-agenda-download" type="button" data-calendar-agenda-download="${escapeHtml(task.id)}" aria-label="Download ${escapeHtml(task.title)} as an iCalendar event">.ics</button>
    </article>`;
  }

  function focusCalendarAgendaDate(value) {
    const task = filteredTasks().find(item => (item.startDate || item.dueDate) && calendarTaskTouchesDate(item, value));
    const item = task ? $("#calendarAgenda")?.querySelector(`[data-agenda-task-id="${CSS.escape(task.id)}"]`) : null;
    if (!item) return;
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    item.classList.add("is-highlighted");
    window.setTimeout(() => item.classList.remove("is-highlighted"), 1500);
  }

  function calendarTaskBounds(task) {
    let start = task.startDate || task.dueDate || "";
    let end = task.dueDate || task.startDate || "";
    if (start && end && end < start) [start, end] = [end, start];
    return { start, end };
  }

  function calendarTaskTouchesDate(task, value) {
    const { start, end } = calendarTaskBounds(task);
    if (!start || !end) return false;
    const span = daysBetween(start, end);
    if (span <= 7) return value >= start && value <= end;
    return value === start || value === end;
  }

  function calendarTaskIntersectsRange(task, rangeStart, rangeEnd) {
    const { start, end } = calendarTaskBounds(task);
    return Boolean(start && end && start <= rangeEnd && end >= rangeStart);
  }

  function calendarEventLabel(task, value) {
    const { start, end } = calendarTaskBounds(task);
    if (start !== end && daysBetween(start, end) > 7) {
      if (value === start) return `Starts · ${task.title}`;
      if (value === end) return `Due · ${task.title}`;
    }
    return task.title;
  }

  function setPlannerView(view) {
    state.view = ["board", "timeline", "calendar", "table", "insights"].includes(view) ? view : "board";
    localStorage.setItem("asmePlannerView", state.view);
    $$("[data-planner-view]").forEach(button => button.classList.toggle("is-active", button.dataset.plannerView === state.view));
    $$("[data-planner-panel]").forEach(panel => panel.classList.toggle("is-hidden", panel.dataset.plannerPanel !== state.view));
    if (state.view === "timeline") renderGantt();
    if (state.view === "calendar") renderCalendar();
    if (state.view === "insights") renderInsights();
  }

  function clearFilters() {
    $("#taskSearch").value = "";
    $("#statusFilter").value = "";
    $("#priorityFilter").value = "";
    $("#ownerFilter").value = "";
    $("#partsOnlyFilter").checked = false;
    $("#hideDoneFilter").checked = false;
    renderCurrentBoard();
  }

  async function moveTask(taskId, status) {
    if (!taskId || !STATUS.some(item => item.id === status) || !requireActor()) return;
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || task.status === status) return;
    const previous = task.status;
    task.status = status;
    if (status === "DONE") task.progress = 100;
    renderCurrentBoard();
    try {
      const saved = await API.post("movePlannerTask", {
        taskId,
        status,
        actorName: state.actorName,
        expectedUpdatedAt: task.updatedAt || ""
      });
      replaceTask(saved);
      setPlannerMessage(`${task.title} moved to ${statusLabel(status)}.`, "success");
      renderCurrentBoard();
    } catch (error) {
      task.status = previous;
      setPlannerMessage(error.message, "error");
      await loadPlanner({ boardId: state.currentBoardId });
    }
  }

  function openWorkspaceDialog() {
    if (!requireActor()) return;
    resetTeamForm();
    resetBoardForm();
    renderWorkspaceDirectory();
    $("#workspaceDialogStatus").textContent = "";
    showPlannerDialog($("#workspaceDialog"));
  }

  function editCurrentBoard() {
    if (!requireActor()) return;
    const board = currentBoard();
    if (!board) return;
    if (isAggregateBoard(board)) {
      setPlannerMessage("The Club-wide Portfolio is generated automatically from every team timeline. Edit an individual team timeline instead.", "error");
      return;
    }
    openWorkspaceDialog();
    fillBoardForm(board);
  }

  function resetTeamForm() {
    $("#teamForm").reset();
    $("#teamId").value = "";
    $("#teamFormTitle").textContent = "Create a team";
  }

  function resetBoardForm() {
    $("#boardForm").reset();
    $("#boardId").value = "";
    $("#boardFormTitle").textContent = "Create a timeline";
    $("#boardTeamId").value = state.currentTeamId || state.teams[0]?.id || "";
  }

  function fillTeamForm(team) {
    $("#teamId").value = team.id;
    $("#teamName").value = team.name;
    $("#teamDescription").value = team.description || "";
    $("#teamIcon").value = team.icon || "";
    $("#teamFormTitle").textContent = "Edit team";
    $("#teamName").focus();
  }

  function fillBoardForm(board) {
    $("#boardId").value = board.id;
    $("#boardTeamId").value = board.teamId;
    $("#boardName").value = board.name;
    $("#boardFormDescription").value = board.description || "";
    $("#boardTargetStart").value = board.targetStart || "";
    $("#boardTargetEnd").value = board.targetEnd || "";
    $("#boardFormTitle").textContent = "Edit timeline";
    $("#boardName").focus();
  }

  async function saveTeam(event) {
    event.preventDefault();
    if (!requireActor()) return;
    setWorkspaceStatus("Saving team…");
    try {
      const saved = await API.post("savePlannerTeam", {
        id: $("#teamId").value,
        name: $("#teamName").value,
        description: $("#teamDescription").value,
        icon: $("#teamIcon").value,
        actorName: state.actorName
      });
      const index = state.teams.findIndex(item => item.id === saved.id);
      if (index >= 0) state.teams[index] = saved; else state.teams.push(saved);
      state.currentTeamId = saved.id;
      renderContextOptions();
      $("#teamFilter").value = saved.id;
      resetTeamForm();
      setWorkspaceStatus("Team saved.", "success");
    } catch (error) { setWorkspaceStatus(error.message, "error"); }
  }

  async function saveBoard(event) {
    event.preventDefault();
    if (!requireActor()) return;
    setWorkspaceStatus("Saving timeline…");
    try {
      const saved = await API.post("savePlannerBoard", {
        id: $("#boardId").value,
        teamId: $("#boardTeamId").value,
        name: $("#boardName").value,
        description: $("#boardFormDescription").value,
        targetStart: $("#boardTargetStart").value,
        targetEnd: $("#boardTargetEnd").value,
        actorName: state.actorName
      });
      const index = state.boards.findIndex(item => item.id === saved.id);
      if (index >= 0) state.boards[index] = saved; else state.boards.push(saved);
      state.currentBoardId = saved.id;
      state.currentTeamId = saved.teamId;
      renderContextOptions();
      $("#teamFilter").value = saved.teamId;
      renderBoardOptions();
      $("#boardSelect").value = saved.id;
      persistBoardSelection();
      renderCurrentBoard();
      resetBoardForm();
      setWorkspaceStatus("Timeline saved.", "success");
    } catch (error) { setWorkspaceStatus(error.message, "error"); }
  }

  function renderWorkspaceDirectory() {
    const host = $("#workspaceDirectoryList");
    if (!host) return;
    host.innerHTML = state.teams.map(team => {
      const boards = state.boards.filter(board => board.teamId === team.id);
      return `<section class="workspace-team-row">
        <button type="button" class="workspace-team-button" data-edit-team="${escapeHtml(team.id)}"><span>${escapeHtml(team.icon || initials(team.name))}</span><div><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.description || "No team description")}</small></div></button>
        <div class="workspace-board-list">${boards.length ? boards.map(board => `<button type="button" data-edit-board="${escapeHtml(board.id)}"><strong>${escapeHtml(board.name)}</strong><small>${escapeHtml(formatBoardDateRange(board) || "Dates set by tasks")}</small></button>`).join("") : '<span class="workspace-no-board">No timelines yet</span>'}</div>
      </section>`;
    }).join("") || '<div class="workspace-no-board">Create the first team.</div>';
  }

  function handleWorkspaceDirectoryClick(event) {
    const teamButton = event.target.closest("[data-edit-team]");
    const boardButton = event.target.closest("[data-edit-board]");
    if (teamButton) fillTeamForm(state.teams.find(item => item.id === teamButton.dataset.editTeam));
    if (boardButton) fillBoardForm(state.boards.find(item => item.id === boardButton.dataset.editBoard));
  }

  async function openTaskDialog(taskId = "", defaults = {}) {
    if (!requireActor()) return;
    if (!currentBoard()) { openWorkspaceDialog(); return; }
    state.suppressDirty = true;
    resetTaskForm();
    const dialog = $("#taskDialog");
    setTaskTab("overview");
    if (!taskId) {
      $("#taskDialogEyebrow").textContent = "New task";
      $("#taskDialogTitle").textContent = "Create a task";
      $("#taskType").value = defaults.taskType || "WORK";
      $("#taskStatus").value = defaults.status || "PLANNED";
      $("#taskPriority").value = defaults.priority || "MEDIUM";
      $("#taskProgress").value = "0";
      $("#taskOrderStatus").value = defaults.taskType === "PURCHASE" ? "NEEDS_SPEC" : "NOT_NEEDED";
      $("#taskSourceConfidence").value = "TEAM_ENTERED";
      $("#taskOwners").value = state.actorName;
      $("#taskAllDay").checked = true;
      const boardId = defaults.boardId || defaultTaskBoardId();
      populateTaskBoardOptions(boardId);
      $("#taskBoardId").disabled = false;
      $("#taskStartDate").value = defaults.startDate || "";
      $("#taskDueDate").value = defaults.dueDate || "";
      $("#taskImportantDate").checked = Boolean(defaults.importantDate);
      renderDependencyPicker("");
      updateFundingEditor();
      updateTaskTimeFields();
      updateTaskHealthPreview();
      updateTaskCalendarButton();
      $("#taskCollaborationEmpty").classList.remove("is-hidden");
      showPlannerDialog(dialog);
      state.suppressDirty = false;
      state.taskDirty = false;
      restoreTaskDraft();
      window.setTimeout(() => { updateTaskHealthPreview(); $("#taskTitle").focus(); }, 0);
      return;
    }

    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    fillTaskForm(task);
    showPlannerDialog(dialog);
    state.suppressDirty = false;
    state.taskDirty = false;
    restoreTaskDraft(task);
    setTaskStatus("Loading comments and activity…");
    try {
      const detail = await API.post("getPlannerTaskDetail", { taskId });
      state.taskDetail = detail;
      renderTaskConversation(detail);
      $("#taskCollaborationEmpty").classList.add("is-hidden");
      setTaskStatus("");
    } catch (error) {
      setTaskStatus(error.message, "error");
    }
    window.setTimeout(updateTaskHealthPreview, 0);
  }

  function resetTaskForm() {
    $("#taskForm").reset();
    state.taskDetail = null;
    state.taskDirty = false;
    $("#taskId").value = "";
    $("#taskExpectedUpdatedAt").value = "";
    $("#taskUpdatedMeta").textContent = "";
    $("#archiveTaskButton").classList.add("is-hidden");
    $("#downloadTaskCalendarButton").classList.add("is-hidden");
    $("#taskConversation").classList.add("is-hidden");
    $("#taskActivitySection").classList.add("is-hidden");
    $("#taskComments").innerHTML = "";
    $("#taskActivity").innerHTML = "";
    $("#taskFundingSection").classList.add("is-hidden");
    $("#taskBoardId").disabled = false;
    $("#taskImportantDate").checked = false;
    $("#taskAllDay").checked = true;
    $("#taskStartTime").value = "";
    $("#taskEndTime").value = "";
    $("#taskLocation").value = "";
    $("#taskCollaborationEmpty").classList.remove("is-hidden");
    setTaskStatus("");
  }

  function fillTaskForm(task) {
    state.suppressDirty = true;
    $("#taskDialogEyebrow").textContent = `${teamForTask(task)?.name || "Team"} · ${statusLabel(task.status)}`;
    $("#taskDialogTitle").textContent = "Edit task";
    populateTaskBoardOptions(task.boardId);
    $("#taskBoardId").value = task.boardId;
    $("#taskBoardId").disabled = true;
    $("#taskId").value = task.id;
    $("#taskExpectedUpdatedAt").value = task.updatedAt || "";
    $("#taskTitle").value = task.title || "";
    $("#taskDescription").value = task.description || "";
    $("#taskType").value = task.taskType || "WORK";
    $("#taskStatus").value = task.status || "PLANNED";
    $("#taskPriority").value = task.priority || "MEDIUM";
    $("#taskProgress").value = String(task.progress ?? 0);
    $("#taskOwners").value = task.ownerNames || "";
    $("#taskTags").value = task.tags || "";
    $("#taskCampus").value = task.campus || "";
    $("#taskFundingMin").value = task.fundingMin === "" || task.fundingMin == null ? "" : task.fundingMin;
    $("#taskFundingMax").value = task.fundingMax === "" || task.fundingMax == null ? "" : task.fundingMax;
    $("#taskFundingAmountLabel").value = task.fundingAmountLabel || "";
    $("#taskSourceUrl").value = task.sourceUrl || "";
    $("#taskSourceConfidence").value = task.sourceConfidence || "TEAM_ENTERED";
    $("#taskRequirements").value = task.requirements || "";
    $("#taskStartDate").value = normalizeDateInput(task.startDate);
    $("#taskDueDate").value = normalizeDateInput(task.dueDate);
    $("#taskAllDay").checked = task.allDay !== false;
    $("#taskStartTime").value = normalizeTimeInput(task.startTime);
    $("#taskEndTime").value = normalizeTimeInput(task.endTime);
    $("#taskLocation").value = task.location || "";
    $("#taskIsMilestone").checked = Boolean(task.isMilestone);
    $("#taskImportantDate").checked = Boolean(task.importantDate);
    $("#taskPartName").value = task.partName || "";
    $("#taskPartNumber").value = task.partNumber || "";
    $("#taskVendor").value = task.vendor || "";
    $("#taskQuantity").value = task.quantity || "";
    $("#taskEstimatedCost").value = task.estimatedCost || "";
    $("#taskOrderStatus").value = task.orderStatus || "NOT_NEEDED";
    $("#taskUpdatedMeta").textContent = `Last updated ${relativeTime(task.updatedAt)} by ${task.updatedBy || "unknown"}`;
    $("#archiveTaskButton").classList.remove("is-hidden");
    renderDependencyPicker(task.id, splitList(task.dependencyIds));
    updateFundingEditor();
    updateTaskTimeFields();
    updateTaskHealthPreview();
    updateTaskCalendarButton();
    state.suppressDirty = false;
    state.taskDirty = false;
  }

  function setTaskTab(tab) {
    const selected = ["overview", "schedule", "details", "collaboration"].includes(tab) ? tab : "overview";
    $$("[data-task-tab]").forEach(button => button.classList.toggle("is-active", button.dataset.taskTab === selected));
    $$("[data-task-panel]").forEach(panel => panel.classList.toggle("is-hidden", panel.dataset.taskPanel !== selected));
  }

  function updateTaskTimeFields() {
    const isEvent = $("#taskType").value === "MEETING";
    const allDay = $("#taskAllDay").checked;
    $("#taskTimeFields").classList.toggle("is-hidden", !isEvent);
    $("#taskTimeFields").classList.toggle("is-all-day", allDay);
    $("#taskStartTime").disabled = !isEvent || allDay;
    $("#taskEndTime").disabled = !isEvent || allDay;
    $("#taskLocation").disabled = !isEvent;
  }

  function renderDependencyPicker(currentTaskId, selectedIds = []) {
    const selectedBoardId = $("#taskBoardId").value || defaultTaskBoardId();
    const candidates = state.tasks.filter(task => !task.archived && task.boardId === selectedBoardId && task.id !== currentTaskId).sort(taskSort);
    const selected = new Set(selectedIds);
    $("#taskDependencyList").innerHTML = candidates.length ? candidates.map(task => `
      <label class="dependency-option">
        <input type="checkbox" value="${escapeHtml(task.id)}" ${selected.has(task.id) ? "checked" : ""}>
        <span><strong>${escapeHtml(task.title)}</strong><small>${statusLabel(task.status)} · ${priorityLabel(task.priority)}</small></span>
      </label>`).join("") : '<p class="dependency-empty">No other active tasks on this timeline.</p>';
  }

  function selectedDependencies() {
    return Array.from($("#taskDependencyList").querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!requireActor() || state.savingTask) return;
    const payload = buildTaskPayload();
    if (payload.title.length < 2) { setTaskStatus("Give the task a clear title.", "error"); setTaskTab("overview"); $("#taskTitle").focus(); return; }
    if (payload.startDate && payload.dueDate && payload.dueDate < payload.startDate) { setTaskStatus("The end date must be on or after the start date.", "error"); setTaskTab("schedule"); return; }
    if (payload.taskType === "MEETING" && !payload.allDay && payload.startDate === payload.dueDate && payload.startTime && payload.endTime && payload.endTime <= payload.startTime) {
      setTaskStatus("For a same-day event, the end time must be after the start time.", "error"); setTaskTab("schedule"); return;
    }
    state.savingTask = true;
    setButtonBusy($("#taskSaveButton"), true, "Saving…");
    setTaskStatus("Saving to the shared planner…");
    try {
      const saved = await API.post("savePlannerTask", payload);
      replaceTask(saved);
      clearTaskDraft(payload.id || "new", payload.boardId);
      const data = await API.post("plannerBootstrap");
      applyPlannerBootstrap(data, state.currentBoardId || saved.boardId);
      state.taskDirty = false;
      $("#taskDialog").close();
      renderCurrentBoard();
      setPlannerMessage(`${saved.title} saved and verified in the shared planner.`, "success");
    } catch (error) {
      setTaskStatus(error.message, "error");
      if (/someone else|refresh/i.test(error.message)) {
        setTaskStatus(`${error.message} Your unsaved draft is still stored in this browser.`, "error");
      }
    } finally {
      state.savingTask = false;
      setButtonBusy($("#taskSaveButton"), false, "Save task");
    }
  }

  function buildTaskPayload() {
    return {
      id: $("#taskId").value,
      expectedUpdatedAt: $("#taskExpectedUpdatedAt").value,
      boardId: $("#taskBoardId").value || defaultTaskBoardId(),
      title: $("#taskTitle").value.trim(),
      description: $("#taskDescription").value,
      taskType: $("#taskType").value,
      status: $("#taskStatus").value,
      priority: $("#taskPriority").value,
      ownerNames: $("#taskOwners").value,
      startDate: normalizeDateInput($("#taskStartDate").value),
      dueDate: normalizeDateInput($("#taskDueDate").value),
      allDay: $("#taskAllDay").checked,
      startTime: normalizeTimeInput($("#taskStartTime").value),
      endTime: normalizeTimeInput($("#taskEndTime").value),
      location: $("#taskLocation").value,
      progress: $("#taskProgress").value,
      isMilestone: $("#taskIsMilestone").checked,
      importantDate: $("#taskImportantDate").checked,
      tags: $("#taskTags").value,
      campus: $("#taskCampus").value,
      fundingMin: $("#taskFundingMin").value,
      fundingMax: $("#taskFundingMax").value,
      fundingAmountLabel: $("#taskFundingAmountLabel").value,
      sourceUrl: $("#taskSourceUrl").value,
      sourceConfidence: $("#taskSourceConfidence").value,
      requirements: $("#taskRequirements").value,
      partName: $("#taskPartName").value,
      partNumber: $("#taskPartNumber").value,
      vendor: $("#taskVendor").value,
      quantity: $("#taskQuantity").value,
      estimatedCost: $("#taskEstimatedCost").value,
      orderStatus: $("#taskOrderStatus").value,
      dependencyIds: JSON.stringify(selectedDependencies()),
      actorName: state.actorName
    };
  }

  async function archiveTask() {
    if (!requireActor()) return;
    const id = $("#taskId").value;
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    if (!window.confirm(`Archive “${task.title}”? It will leave active views but remain in the Google Sheet and activity history.`)) return;
    setTaskStatus("Archiving…");
    try {
      await API.post("archivePlannerTask", { taskId: id, actorName: state.actorName, expectedUpdatedAt: task.updatedAt || "" });
      state.tasks = state.tasks.filter(item => item.id !== id);
      $("#taskDialog").close();
      renderCurrentBoard();
      setPlannerMessage("Task archived.", "success");
    } catch (error) { setTaskStatus(error.message, "error"); }
  }

  async function addTaskComment() {
    if (!requireActor()) return;
    const taskId = $("#taskId").value;
    const body = $("#taskCommentBody").value.trim();
    if (!taskId || body.length < 2) { setTaskStatus("Write a comment before posting.", "error"); return; }
    $("#addTaskCommentButton").disabled = true;
    try {
      const result = await API.post("addPlannerComment", { taskId, body, actorName: state.actorName });
      $("#taskCommentBody").value = "";
      state.taskDetail = result;
      const task = state.tasks.find(item => item.id === taskId);
      if (task) task.commentCount = result.comments.length;
      renderTaskConversation(result);
      renderCurrentBoard();
      setTaskStatus("Comment posted.", "success");
    } catch (error) { setTaskStatus(error.message, "error"); }
    finally { $("#addTaskCommentButton").disabled = false; }
  }

  function renderTaskConversation(detail) {
    const comments = detail.comments || [];
    const activity = detail.activity || [];
    $("#taskConversation").classList.remove("is-hidden");
    $("#taskComments").innerHTML = comments.length ? comments.map(comment => `
      <article class="task-comment"><div class="comment-avatar">${escapeHtml(initials(comment.authorName))}</div><div><header><strong>${escapeHtml(comment.authorName)}</strong><time>${escapeHtml(relativeTime(comment.createdAt))}</time></header><p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p></div></article>`).join("") : '<p class="comment-empty">No comments yet. Use this space for decisions, blockers, and handoffs.</p>';
    $("#taskActivitySection").classList.toggle("is-hidden", !activity.length);
    $("#taskActivity").innerHTML = activity.slice(0, 20).map(item => `<li><span></span><div><strong>${escapeHtml(activityLabel(item.action))}</strong><p>${escapeHtml(item.details || "")}</p><small>${escapeHtml(item.actor || "Unknown")} · ${escapeHtml(relativeTime(item.createdAt))}</small></div></li>`).join("");
  }

  function updateTaskHealthPreview() {
    const host = $("#taskHealthCard");
    if (!host) return;
    const task = {
      taskType: $("#taskType").value,
      status: $("#taskStatus").value,
      priority: $("#taskPriority").value,
      progress: Number($("#taskProgress").value || 0),
      startDate: normalizeDateInput($("#taskStartDate").value),
      dueDate: normalizeDateInput($("#taskDueDate").value),
      allDay: $("#taskAllDay").checked,
      startTime: normalizeTimeInput($("#taskStartTime").value),
      endTime: normalizeTimeInput($("#taskEndTime").value),
      orderStatus: $("#taskOrderStatus").value,
      sourceConfidence: $("#taskSourceConfidence").value,
      fundingAmountLabel: $("#taskFundingAmountLabel").value,
      isMilestone: $("#taskIsMilestone").checked,
      importantDate: $("#taskImportantDate").checked,
      boardId: $("#taskBoardId").value || defaultTaskBoardId()
    };
    const health = taskHealth(task);
    host.className = `task-health-card health-${health.tone}`;
    host.innerHTML = `<span>${escapeHtml(health.label)}</span><strong>${escapeHtml(health.title)}</strong><p>${escapeHtml(health.detail)}</p>`;
  }

  function replaceTask(saved) {
    const index = state.tasks.findIndex(item => item.id === saved.id);
    if (index >= 0) state.tasks[index] = saved; else state.tasks.push(saved);
  }


  function openEventDialog(taskId = "", defaults = {}) {
    if (!requireActor()) return;
    if (!currentBoard()) { openWorkspaceDialog(); return; }
    state.suppressDirty = true;
    resetEventForm();
    populateEventBoardOptions(defaults.boardId || defaultTaskBoardId());
    const task = taskId ? state.tasks.find(item => item.id === taskId) : null;
    if (task) {
      $("#eventId").value = task.id;
      $("#eventExpectedUpdatedAt").value = task.updatedAt || "";
      $("#eventDialogTitle").textContent = "Edit event";
      $("#eventTitle").value = task.title || "";
      populateEventBoardOptions(task.boardId);
      $("#eventBoardId").value = task.boardId;
      $("#eventStartDate").value = normalizeDateInput(task.startDate || task.dueDate);
      $("#eventEndDate").value = normalizeDateInput(task.dueDate || task.startDate);
      $("#eventAllDay").checked = task.allDay !== false;
      $("#eventStartTime").value = normalizeTimeInput(task.startTime);
      $("#eventEndTime").value = normalizeTimeInput(task.endTime);
      $("#eventLocation").value = task.location || "";
      $("#eventOwners").value = task.ownerNames || "";
      $("#eventPriority").value = task.priority || "MEDIUM";
      $("#eventDescription").value = task.description || "";
      $("#eventImportantDate").checked = Boolean(task.importantDate);
      $("#eventUpdatedMeta").textContent = `Last updated ${relativeTime(task.updatedAt)} by ${task.updatedBy || "unknown"}`;
      $("#eventArchiveButton").classList.remove("is-hidden");
      $("#eventOpenFullTaskButton").classList.remove("is-hidden");
    } else {
      $("#eventDialogTitle").textContent = "Add calendar event";
      $("#eventStartDate").value = defaults.startDate || todayText();
      $("#eventEndDate").value = defaults.endDate || defaults.startDate || todayText();
      $("#eventOwners").value = state.actorName;
      $("#eventPriority").value = "MEDIUM";
    }
    updateEventTimeFields();
    showPlannerDialog($("#eventDialog"));
    state.suppressDirty = false;
    state.eventDirty = false;
    restoreEventDraft(task);
    window.setTimeout(() => $("#eventTitle").focus(), 0);
  }

  function resetEventForm() {
    $("#eventForm").reset();
    state.eventDirty = false;
    $("#eventId").value = "";
    $("#eventExpectedUpdatedAt").value = "";
    $("#eventUpdatedMeta").textContent = "";
    $("#eventAllDay").checked = true;
    $("#eventStartTime").value = "";
    $("#eventEndTime").value = "";
    $("#eventArchiveButton").classList.add("is-hidden");
    $("#eventOpenFullTaskButton").classList.add("is-hidden");
    setEventStatus("");
  }

  function updateEventTimeFields() {
    const allDay = $("#eventAllDay").checked;
    $("#eventTimeFields").classList.toggle("is-hidden", allDay);
    $("#eventStartTime").disabled = allDay;
    $("#eventEndTime").disabled = allDay;
  }

  async function saveCalendarEvent(event) {
    event.preventDefault();
    if (!requireActor() || state.savingEvent) return;
    const startDate = normalizeDateInput($("#eventStartDate").value);
    const endDate = normalizeDateInput($("#eventEndDate").value || startDate);
    const allDay = $("#eventAllDay").checked;
    const startTime = normalizeTimeInput($("#eventStartTime").value);
    const endTime = normalizeTimeInput($("#eventEndTime").value);
    const title = $("#eventTitle").value.trim();
    if (title.length < 2) { setEventStatus("Give the event a clear title.", "error"); return; }
    if (!startDate) { setEventStatus("Choose a date.", "error"); return; }
    if (endDate < startDate) { setEventStatus("The end date must be on or after the start date.", "error"); return; }
    if (!allDay && startDate === endDate && startTime && endTime && endTime <= startTime) { setEventStatus("The end time must be after the start time.", "error"); return; }
    const existing = state.tasks.find(item => item.id === $("#eventId").value);
    const payload = {
      id: $("#eventId").value,
      expectedUpdatedAt: $("#eventExpectedUpdatedAt").value,
      boardId: $("#eventBoardId").value || defaultTaskBoardId(),
      title,
      description: $("#eventDescription").value,
      taskType: "MEETING",
      status: existing?.status || "PLANNED",
      priority: $("#eventPriority").value || "MEDIUM",
      ownerNames: $("#eventOwners").value,
      startDate,
      dueDate: endDate,
      allDay,
      startTime,
      endTime,
      location: $("#eventLocation").value,
      progress: existing?.progress || 0,
      isMilestone: true,
      importantDate: $("#eventImportantDate").checked,
      tags: existing?.tags || "event",
      campus: existing?.campus || "",
      fundingMin: existing?.fundingMin ?? "",
      fundingMax: existing?.fundingMax ?? "",
      fundingAmountLabel: existing?.fundingAmountLabel || "",
      sourceUrl: existing?.sourceUrl || "",
      sourceConfidence: existing?.sourceConfidence || "TEAM_ENTERED",
      requirements: existing?.requirements || "",
      partName: existing?.partName || "",
      partNumber: existing?.partNumber || "",
      vendor: existing?.vendor || "",
      quantity: existing?.quantity ?? "",
      estimatedCost: existing?.estimatedCost ?? "",
      orderStatus: existing?.orderStatus || "NOT_NEEDED",
      dependencyIds: JSON.stringify(splitList(existing?.dependencyIds || [])),
      actorName: state.actorName
    };
    state.savingEvent = true;
    setButtonBusy($("#eventSaveButton"), true, "Saving…");
    setEventStatus("Saving to the shared calendar…");
    try {
      const saved = await API.post("savePlannerTask", payload);
      replaceTask(saved);
      clearEventDraft(payload.id || "new", payload.boardId);
      const data = await API.post("plannerBootstrap");
      applyPlannerBootstrap(data, state.currentBoardId || saved.boardId);
      state.eventDirty = false;
      $("#eventDialog").close();
      renderCurrentBoard();
      setPlannerView("calendar");
      state.calendarMonth = `${saved.startDate.slice(0, 7)}-01`;
      localStorage.setItem("asmePlannerCalendarMonth", state.calendarMonth);
      renderCalendar();
      setPlannerMessage(`${saved.title} saved to the shared calendar.`, "success");
    } catch (error) {
      setEventStatus(`${error.message} Your unsaved event is still stored in this browser.`, "error");
    } finally {
      state.savingEvent = false;
      setButtonBusy($("#eventSaveButton"), false, "Save event");
    }
  }

  async function archiveCalendarEvent() {
    const id = $("#eventId").value;
    const task = state.tasks.find(item => item.id === id);
    if (!task || !window.confirm(`Archive “${task.title}”?`)) return;
    setEventStatus("Archiving…");
    try {
      await API.post("archivePlannerTask", { taskId: id, actorName: state.actorName, expectedUpdatedAt: task.updatedAt || "" });
      state.tasks = state.tasks.filter(item => item.id !== id);
      clearEventDraft(id, task.boardId);
      state.eventDirty = false;
      $("#eventDialog").close();
      renderCurrentBoard();
      setPlannerMessage("Event archived.", "success");
    } catch (error) { setEventStatus(error.message, "error"); }
  }

  function openEventInFullEditor() {
    const id = $("#eventId").value;
    state.eventDirty = false;
    $("#eventDialog").close();
    if (id) openTaskDialog(id);
  }

  function setEventStatus(message, tone = "") {
    const host = $("#eventFormStatus");
    host.textContent = message || "";
    host.className = `form-status${tone ? ` is-${tone}` : ""}`;
  }

  function requestDialogClose(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (!dialog?.open) return;
    const dirty = dialogId === "taskDialog" ? state.taskDirty : dialogId === "eventDialog" ? state.eventDirty : false;
    if (dirty && !window.confirm("Discard unsaved changes? A local draft will remain available on this browser.")) return;
    dialog.close();
  }

  function markTaskDirty() {
    if (state.suppressDirty || !$("#taskDialog")?.open) return;
    state.taskDirty = true;
    window.clearTimeout(state.taskDraftTimer);
    state.taskDraftTimer = window.setTimeout(saveTaskDraft, 350);
  }

  function markEventDirty() {
    if (state.suppressDirty || !$("#eventDialog")?.open) return;
    state.eventDirty = true;
    window.clearTimeout(state.eventDraftTimer);
    state.eventDraftTimer = window.setTimeout(saveEventDraft, 350);
  }

  function taskDraftKey(id = $("#taskId").value || "new", boardId = $("#taskBoardId").value || defaultTaskBoardId()) {
    return `asmePlannerTaskDraft:${id}:${boardId}`;
  }

  function eventDraftKey(id = $("#eventId").value || "new", boardId = $("#eventBoardId").value || defaultTaskBoardId()) {
    return `asmePlannerEventDraft:${id}:${boardId}`;
  }

  function saveTaskDraft() {
    try { localStorage.setItem(taskDraftKey(), JSON.stringify({ savedAt: Date.now(), payload: buildTaskPayload() })); } catch (_) {}
  }

  function saveEventDraft() {
    try {
      localStorage.setItem(eventDraftKey(), JSON.stringify({ savedAt: Date.now(), payload: {
        title: $("#eventTitle").value, boardId: $("#eventBoardId").value, startDate: $("#eventStartDate").value,
        endDate: $("#eventEndDate").value, allDay: $("#eventAllDay").checked, startTime: $("#eventStartTime").value,
        endTime: $("#eventEndTime").value, location: $("#eventLocation").value, ownerNames: $("#eventOwners").value,
        priority: $("#eventPriority").value, description: $("#eventDescription").value, importantDate: $("#eventImportantDate").checked
      } }));
    } catch (_) {}
  }

  function restoreTaskDraft(task = null) {
    try {
      const raw = localStorage.getItem(taskDraftKey(task?.id || "new", task?.boardId || $("#taskBoardId").value));
      if (!raw) return;
      const draft = JSON.parse(raw);
      const serverTime = task?.updatedAt ? new Date(task.updatedAt).getTime() : 0;
      if (!draft?.payload || Number(draft.savedAt || 0) <= serverTime) return;
      if (!window.confirm("Restore your unsaved task draft from this browser?")) return;
      applyTaskDraft(draft.payload);
      state.taskDirty = true;
      setTaskStatus("Unsaved draft restored. Save to publish it to the shared planner.", "success");
    } catch (_) {}
  }

  function applyTaskDraft(draft) {
    state.suppressDirty = true;
    const map = { title:"taskTitle", description:"taskDescription", taskType:"taskType", status:"taskStatus", priority:"taskPriority", ownerNames:"taskOwners", startDate:"taskStartDate", dueDate:"taskDueDate", startTime:"taskStartTime", endTime:"taskEndTime", location:"taskLocation", progress:"taskProgress", tags:"taskTags", campus:"taskCampus", fundingMin:"taskFundingMin", fundingMax:"taskFundingMax", fundingAmountLabel:"taskFundingAmountLabel", sourceUrl:"taskSourceUrl", sourceConfidence:"taskSourceConfidence", requirements:"taskRequirements", partName:"taskPartName", partNumber:"taskPartNumber", vendor:"taskVendor", quantity:"taskQuantity", estimatedCost:"taskEstimatedCost", orderStatus:"taskOrderStatus" };
    Object.entries(map).forEach(([key,id]) => { if (draft[key] != null) $("#"+id).value = draft[key]; });
    if (draft.boardId) { populateTaskBoardOptions(draft.boardId); $("#taskBoardId").value = draft.boardId; }
    $("#taskAllDay").checked = draft.allDay !== false;
    $("#taskIsMilestone").checked = Boolean(draft.isMilestone);
    $("#taskImportantDate").checked = Boolean(draft.importantDate);
    updateFundingEditor(); updateTaskTimeFields(); updateTaskHealthPreview(); updateTaskCalendarButton();
    state.suppressDirty = false;
  }

  function restoreEventDraft(task = null) {
    try {
      const raw = localStorage.getItem(eventDraftKey(task?.id || "new", task?.boardId || $("#eventBoardId").value));
      if (!raw) return;
      const draft = JSON.parse(raw);
      const serverTime = task?.updatedAt ? new Date(task.updatedAt).getTime() : 0;
      if (!draft?.payload || Number(draft.savedAt || 0) <= serverTime) return;
      if (!window.confirm("Restore your unsaved calendar event draft?")) return;
      const d = draft.payload;
      state.suppressDirty = true;
      if (d.boardId) { populateEventBoardOptions(d.boardId); $("#eventBoardId").value = d.boardId; }
      $("#eventTitle").value=d.title||""; $("#eventStartDate").value=d.startDate||""; $("#eventEndDate").value=d.endDate||d.startDate||"";
      $("#eventAllDay").checked=d.allDay!==false; $("#eventStartTime").value=d.startTime||""; $("#eventEndTime").value=d.endTime||"";
      $("#eventLocation").value=d.location||""; $("#eventOwners").value=d.ownerNames||""; $("#eventPriority").value=d.priority||"MEDIUM";
      $("#eventDescription").value=d.description||""; $("#eventImportantDate").checked=Boolean(d.importantDate);
      updateEventTimeFields(); state.suppressDirty=false; state.eventDirty=true;
      setEventStatus("Unsaved event draft restored. Save to publish it.", "success");
    } catch (_) {}
  }

  function clearTaskDraft(id, boardId) { try { localStorage.removeItem(taskDraftKey(id, boardId)); } catch (_) {} }
  function clearEventDraft(id, boardId) { try { localStorage.removeItem(eventDraftKey(id, boardId)); } catch (_) {} }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    button.disabled = Boolean(busy);
    button.textContent = label;
  }

  function normalizeDateInput(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : dateText(parsed);
  }

  function normalizeTimeInput(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "";
    return `${String(Math.min(23, Number(match[1]))).padStart(2,"0")}:${match[2]}`;
  }

  function formatClock(value) {
    const clean = normalizeTimeInput(value);
    if (!clean) return "";
    const [hour, minute] = clean.split(":").map(Number);
    return new Date(2000,0,1,hour,minute).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function showPlannerDialog(dialog) {
    if (!dialog || dialog.open) return;
    document.body.classList.add("dialog-open");
    dialog.showModal();
    const card = dialog.querySelector(".modal-card");
    if (card) card.scrollTop = 0;
  }

  function updateTaskCalendarButton() {
    const button = $("#downloadTaskCalendarButton");
    if (!button) return;
    const hasTitle = $("#taskTitle").value.trim().length >= 2;
    const hasDate = Boolean($("#taskStartDate").value || $("#taskDueDate").value);
    button.classList.toggle("is-hidden", !(hasTitle && hasDate));
  }

  function taskFromFormForCalendar() {
    return {
      id: $("#taskId").value || `draft-${Date.now()}`,
      title: $("#taskTitle").value.trim() || "ASME task",
      description: $("#taskDescription").value,
      taskType: $("#taskType").value,
      status: $("#taskStatus").value,
      priority: $("#taskPriority").value,
      ownerNames: $("#taskOwners").value,
      startDate: normalizeDateInput($("#taskStartDate").value),
      dueDate: normalizeDateInput($("#taskDueDate").value),
      allDay: $("#taskAllDay").checked,
      startTime: normalizeTimeInput($("#taskStartTime").value),
      endTime: normalizeTimeInput($("#taskEndTime").value),
      location: $("#taskLocation").value,
      tags: $("#taskTags").value,
      campus: $("#taskCampus").value,
      fundingAmountLabel: $("#taskFundingAmountLabel").value,
      sourceUrl: $("#taskSourceUrl").value,
      requirements: $("#taskRequirements").value,
      partName: $("#taskPartName").value,
      vendor: $("#taskVendor").value,
      isMilestone: $("#taskIsMilestone").checked,
      importantDate: $("#taskImportantDate").checked,
      boardId: $("#taskBoardId").value || defaultTaskBoardId()
    };
  }

  function downloadTaskCalendarFromForm() {
    const task = taskFromFormForCalendar();
    if (!task.startDate && !task.dueDate) {
      setTaskStatus("Add a start date or due date before downloading a calendar event.", "error");
      return;
    }
    downloadTasksCalendar([task], task.title);
    setTaskStatus("Calendar event downloaded.", "success");
  }

  function downloadBoardCalendar() {
    const board = currentBoard();
    if (!board) return;
    const tasks = boardTasks().filter(task => task.startDate || task.dueDate);
    if (!tasks.length) {
      setPlannerMessage("This timeline has no dated tasks to add to a calendar.", "error");
      return;
    }
    downloadTasksCalendar(tasks, `${board.name} calendar`);
    setPlannerMessage(`${tasks.length} dated ${tasks.length === 1 ? "task" : "tasks"} exported as an .ics calendar.`, "success");
  }

  function downloadTasksCalendar(tasks, name) {
    const selectedBoard = currentBoard();
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const events = tasks.filter(task => task.startDate || task.dueDate).map(task => {
      const taskBoard = actualBoardForTask(task) || selectedBoard;
      const taskTeam = teamForTask(task) || currentTeam();
      const { start, end } = calendarTaskBounds(task);
      const exclusiveEnd = addDaysText(end, 1);
      const description = [
        task.description,
        `Team: ${taskTeam?.name || "ASME"}`,
        `Timeline: ${taskBoard?.name || "Project planner"}`,
        `Status: ${statusLabel(task.status)}`,
        `Priority: ${priorityLabel(task.priority)}`,
        task.ownerNames ? `Owners: ${task.ownerNames}` : "",
        task.fundingAmountLabel ? `Funding: ${task.fundingAmountLabel}` : "",
        task.campus ? `Campus / eligibility: ${task.campus}` : "",
        task.partName ? `Part / material: ${task.partName}` : "",
        task.vendor ? `Vendor: ${task.vendor}` : "",
        task.requirements ? `Requirements / next action: ${task.requirements}` : "",
        task.sourceUrl ? `Official source: ${task.sourceUrl}` : ""
      ].filter(Boolean).join("\n");
      const uidBase = String(task.id || `${task.title}-${start}`).replace(/[^a-zA-Z0-9._-]/g, "-");
      return [
        "BEGIN:VEVENT",
        `UID:${uidBase}@asmeindy.purdue.edu`,
        `DTSTAMP:${now}`,
        task.allDay === false && task.startTime
          ? `DTSTART;TZID=America/Indiana/Indianapolis:${icsDateTime(start, task.startTime)}`
          : `DTSTART;VALUE=DATE:${icsDate(start)}`,
        task.allDay === false && task.startTime
          ? `DTEND;TZID=America/Indiana/Indianapolis:${icsDateTime(end, task.endTime || addMinutesTime(task.startTime, 60))}`
          : `DTEND;VALUE=DATE:${icsDate(exclusiveEnd)}`,
        `SUMMARY:${icsEscape(task.title || "ASME task")}`,
        `DESCRIPTION:${icsEscape(description)}`,
        `CATEGORIES:${icsEscape([taskTeam?.name, taskBoard?.name, taskTypeLabel(task.taskType), priorityLabel(task.priority)].filter(Boolean).join(","))}`,
        task.location ? `LOCATION:${icsEscape(task.location)}` : "",
        task.sourceUrl ? `URL:${icsEscape(task.sourceUrl)}` : "",
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      ].filter(Boolean).join("\r\n");
    }).join("\r\n");

    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Purdue Indianapolis ASME//SponsorFlow Project Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${icsEscape(name || selectedBoard?.name || "ASME Project Planner")}`,
      events,
      "END:VCALENDAR",
      ""
    ].join("\r\n");
    downloadTextFile(`${slugify(name || selectedBoard?.name || "asme-project-calendar")}.ics`, calendar, "text/calendar;charset=utf-8");
  }

  function downloadTextFile(filename, contents, type) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function icsDateTime(dateValue, timeValue) {
    return `${icsDate(dateValue)}T${normalizeTimeInput(timeValue).replace(":", "")}00`;
  }

  function addMinutesTime(value, minutes) {
    const clean = normalizeTimeInput(value) || "09:00";
    const [hour, minute] = clean.split(":").map(Number);
    const total = (hour * 60 + minute + minutes) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function icsDate(value) {
    return String(value || "").replace(/-/g, "");
  }

  function icsEscape(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function openCalendarSubscriptions() {
    if (!state.calendarFeedBaseUrl) {
      setPlannerMessage("Redeploy the v8 Apps Script backend before creating live calendar subscriptions.", "error");
      return;
    }
    renderCalendarSubscriptions();
    setSubscriptionStatus("");
    showPlannerDialog($("#calendarSubscriptionsDialog"));
  }

  function renderCalendarSubscriptions() {
    const items = [
      {
        key: "club",
        scope: "club",
        id: "",
        name: "Club-wide",
        badge: "Recommended",
        description: "Every dated task across every team, including Finance & Sponsorship opportunities and deadlines."
      },
      {
        key: "important",
        scope: "important",
        id: "",
        name: "Important Dates",
        badge: "Recommended",
        description: "Milestones, critical priorities, funding deadlines, meetings, competitions, inspections, and events."
      },
      ...state.teams.filter(team => team.id !== CLUB_TEAM_ID).map(team => ({
        key: `team-${team.id}`,
        scope: "team",
        id: team.id,
        name: team.name,
        badge: "Team calendar",
        description: team.description || `All dated work owned by ${team.name}.`
      }))
    ];
    const board = currentBoard();
    if (board && !isAggregateBoard(board)) {
      items.push({
        key: `board-${board.id}`,
        scope: "board",
        id: board.id,
        name: board.name,
        badge: "Current timeline",
        description: board.description || "Only dates from the timeline currently open in SponsorFlow."
      });
    }

    $("#calendarSubscriptionList").innerHTML = items.map(item => {
      const url = calendarFeedUrl(item.scope, item.id);
      return `<article class="calendar-subscription-card">
        <div class="subscription-card-copy">
          <div><span class="subscription-type-badge">${escapeHtml(item.badge)}</span><h3>${escapeHtml(item.name)}</h3></div>
          <p>${escapeHtml(item.description)}</p>
          <label><span>Subscription URL</span><input type="text" readonly value="${escapeHtml(url)}" data-subscription-input="${escapeHtml(item.key)}"></label>
        </div>
        <div class="subscription-card-actions">
          <button class="button button-secondary button-small" type="button" data-copy-subscription="${escapeHtml(item.key)}">Copy URL</button>
          <button class="button button-primary button-small" type="button" data-open-subscription="${escapeHtml(item.key)}">Open subscription</button>
        </div>
      </article>`;
    }).join("");

    const host = $("#calendarSubscriptionList");
    host.querySelectorAll("[data-copy-subscription]").forEach(button => button.addEventListener("click", () => {
      const input = host.querySelector(`[data-subscription-input="${CSS.escape(button.dataset.copySubscription)}"]`);
      if (input) copySubscriptionUrl(input.value);
    }));
    host.querySelectorAll("[data-open-subscription]").forEach(button => button.addEventListener("click", () => {
      const input = host.querySelector(`[data-subscription-input="${CSS.escape(button.dataset.openSubscription)}"]`);
      if (!input) return;
      window.location.href = input.value.replace(/^https:/i, "webcal:");
      setSubscriptionStatus("Your calendar app should open. If it does not, use Copy URL and add it manually.", "success");
    }));
  }

  function calendarFeedUrl(scope, id = "") {
    const url = new URL(state.calendarFeedBaseUrl);
    url.searchParams.set("feed", "calendar");
    url.searchParams.set("scope", scope);
    if (id) url.searchParams.set("id", id);
    const app = new URL(window.location.href);
    app.search = "";
    app.hash = "";
    url.searchParams.set("app", app.toString());
    return url.toString();
  }

  function copySubscriptionUrl(value) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value)
        .then(() => setSubscriptionStatus("Subscription URL copied.", "success"))
        .catch(() => window.prompt("Copy this calendar subscription URL:", value));
    } else {
      window.prompt("Copy this calendar subscription URL:", value);
    }
  }

  function setSubscriptionStatus(message, tone = "") {
    const element = $("#calendarSubscriptionStatus");
    element.textContent = message || "";
    element.className = `form-status${tone ? ` is-${tone}` : ""}`;
  }

  function shareBoard() {
    const board = currentBoard();
    if (!board) return;
    const url = new URL(window.location.href);
    url.searchParams.set("board", board.id);
    const text = url.toString();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => setPlannerMessage("Board link copied.", "success")).catch(() => window.prompt("Copy this board link:", text));
    } else window.prompt("Copy this board link:", text);
  }

  function exportBoardCsv() {
    const board = currentBoard();
    if (!board) return;
    const headers = ["Team", "Timeline", "Task", "Task Type", "Status", "Priority", "Owners", "Start", "Due", "Progress", "Milestone", "Important Date", "Tags", "Campus", "Funding Minimum", "Funding Maximum", "Funding Amount Label", "Source URL", "Source Confidence", "Requirements", "Part", "Part Number", "Vendor", "Quantity", "Estimated Cost", "Order Status", "Dependencies", "Updated By", "Updated At"];
    const rows = boardTasks().map(task => {
      const taskBoard = actualBoardForTask(task);
      const taskTeam = teamForTask(task);
      return [taskTeam?.name || "", taskBoard?.name || "", task.title, taskTypeLabel(task.taskType), statusLabel(task.status), priorityLabel(task.priority), task.ownerNames, task.startDate, task.dueDate, task.progress, task.isMilestone ? "Yes" : "No", task.importantDate ? "Yes" : "No", task.tags, task.campus, task.fundingMin, task.fundingMax, task.fundingAmountLabel, task.sourceUrl, sourceConfidenceLabel(task.sourceConfidence), task.requirements, task.partName, task.partNumber, task.vendor, task.quantity, task.estimatedCost, orderLabel(task.orderStatus), splitList(task.dependencyIds).map(id => state.tasks.find(item => item.id === id)?.title || id).join("; "), task.updatedBy, task.updatedAt];
    });
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(board.name)}-tasks.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setPlannerMessage("Timeline exported as CSV.", "success");
  }

  function setLoading(loading) {
    state.loading = loading;
    $("#plannerLoading").classList.toggle("is-hidden", !loading);
  }

  function setPlannerMessage(message, tone = "") {
    const element = $("#plannerMessage");
    element.textContent = message || "";
    element.className = `form-status${tone ? ` is-${tone}` : ""}`;
    if (message) window.setTimeout(() => { if (element.textContent === message) element.textContent = ""; }, 5000);
  }
  function setTaskStatus(message, tone = "") { const element = $("#taskFormStatus"); element.textContent = message || ""; element.className = `form-status${tone ? ` is-${tone}` : ""}`; }
  function setWorkspaceStatus(message, tone = "") { const element = $("#workspaceDialogStatus"); element.textContent = message || ""; element.className = `form-status${tone ? ` is-${tone}` : ""}`; }
  function showConnectionError(message) { const banner = $("#plannerConnectionBanner"); banner.textContent = message; banner.classList.remove("is-hidden"); }
  function hideConnectionError() { $("#plannerConnectionBanner").classList.add("is-hidden"); }

  function updateFundingEditor() {
    const type = $("#taskType").value || "WORK";
    $("#taskFundingSection").classList.toggle("is-hidden", type !== "FUNDING");
    if (type === "PURCHASE" && $("#taskOrderStatus").value === "NOT_NEEDED") $("#taskOrderStatus").value = "NEEDS_SPEC";
  }

  function insightsTasks() {
    if (state.insightsScope === "all") return state.tasks.filter(task => !task.archived);
    return boardTasks();
  }

  function renderInsights() {
    const host = $("#plannerInsights");
    if (!host) return;
    const tasks = insightsTasks();
    if (!tasks.length) {
      host.innerHTML = '<div class="insights-empty"><span>◫</span><h3>No data to visualize yet</h3><p>Add tasks, owners, dates, funding opportunities, or parts to unlock planner insights.</p></div>';
      return;
    }
    const today = todayText();
    const active = tasks.filter(task => task.status !== "DONE");
    const overdue = active.filter(task => task.dueDate && task.dueDate < today);
    const blocked = active.filter(task => task.status === "BLOCKED");
    const funding = tasks.filter(task => task.taskType === "FUNDING");
    const knownFunding = funding.reduce((sum, task) => sum + (Number(task.fundingMax) || 0), 0);
    const variableFunding = funding.filter(task => !Number(task.fundingMax)).length;
    const parts = tasks.filter(isPartsTask);
    const owners = ownerWorkload(tasks);
    const statusCounts = STATUS.map(item => ({ ...item, count: tasks.filter(task => task.status === item.id).length }));
    const priorityCounts = PRIORITY.map(item => ({ ...item, count: tasks.filter(task => task.priority === item.id).length }));
    const weeks = dueWeekBuckets(tasks, 8);
    const partCounts = ORDER_STATUS.filter(item => item.id !== "NOT_NEEDED").map(item => ({ ...item, count: parts.filter(task => task.orderStatus === item.id).length }));

    host.innerHTML = `
      <div class="insight-summary-grid">
        <article><span>Tasks in scope</span><strong>${tasks.length}</strong><small>${active.length} active · ${tasks.length - active.length} done</small></article>
        <article><span>Schedule risk</span><strong>${overdue.length + blocked.length}</strong><small>${overdue.length} overdue · ${blocked.length} blocked</small></article>
        <article><span>Known funding ceiling</span><strong>${formatCurrency(knownFunding)}</strong><small>${funding.length} opportunities${variableFunding ? ` · ${variableFunding} variable` : ""}</small></article>
        <article><span>Parts pipeline</span><strong>${parts.length}</strong><small>${partCounts.filter(item => item.id !== "RECEIVED").reduce((sum, item) => sum + item.count, 0)} not received</small></article>
      </div>
      <div class="insight-grid">
        ${renderStatusInsight(statusCounts, tasks.length)}
        ${renderPriorityInsight(priorityCounts, tasks.length)}
        ${renderOwnerInsight(owners)}
        ${renderScheduleInsight(weeks)}
        ${renderFundingInsight(funding)}
        ${renderPartsInsight(partCounts)}
      </div>`;
  }

  function renderStatusInsight(items, total) {
    const colors = { BACKLOG: "#92928a", PLANNED: "#2f5d8a", IN_PROGRESS: "#cfb991", BLOCKED: "#a52a2a", REVIEW: "#7a5f9e", DONE: "#276749" };
    let cursor = 0;
    const segments = items.map(item => {
      const start = cursor;
      cursor += total ? item.count / total * 100 : 0;
      return `${colors[item.id]} ${start}% ${cursor}%`;
    }).join(", ");
    return `<article class="insight-panel insight-status"><header><div><span>Flow</span><h3>Status distribution</h3></div><small>${total} tasks</small></header><div class="donut-layout"><div class="insight-donut" style="--donut:${segments}"><strong>${Math.round((items.find(i => i.id === "DONE")?.count || 0) / Math.max(1,total) * 100)}%</strong><span>done</span></div><div class="chart-legend">${items.map(item => `<div><i style="background:${colors[item.id]}"></i><span>${item.label}</span><strong>${item.count}</strong></div>`).join("")}</div></div></article>`;
  }

  function renderPriorityInsight(items, total) {
    return `<article class="insight-panel"><header><div><span>Risk</span><h3>Priority mix</h3></div><small>${items.filter(i => i.count).length} active bands</small></header><div class="bar-list">${items.map(item => `<div class="bar-row"><div><span>${item.label}</span><strong>${item.count}</strong></div><div class="bar-track"><i class="priority-bg-${item.id}" style="width:${total ? item.count / total * 100 : 0}%"></i></div></div>`).join("")}</div></article>`;
  }

  function renderOwnerInsight(owners) {
    const max = Math.max(1, ...owners.map(owner => owner.total));
    return `<article class="insight-panel"><header><div><span>Capacity</span><h3>Workload by owner</h3></div><small>Top ${Math.min(8, owners.length)}</small></header><div class="owner-load-list">${owners.length ? owners.slice(0,8).map(owner => `<div><span class="owner-load-avatar">${escapeHtml(initials(owner.name))}</span><div><strong>${escapeHtml(owner.name)}</strong><small>${owner.active} active${owner.risk ? ` · ${owner.risk} at risk` : ""}</small><div class="bar-track"><i style="width:${owner.total / max * 100}%"></i></div></div><b>${owner.total}</b></div>`).join("") : '<p class="insight-no-data">Assign owners to see capacity.</p>'}</div></article>`;
  }

  function renderScheduleInsight(weeks) {
    const max = Math.max(1, ...weeks.map(week => week.count));
    return `<article class="insight-panel insight-wide"><header><div><span>Schedule</span><h3>Due-date load · next 8 weeks</h3></div><small>Tasks grouped by due week</small></header><div class="week-chart" role="img" aria-label="Tasks due over the next eight weeks">${weeks.map(week => `<div><div class="week-bar"><i style="height:${week.count / max * 100}%"></i><strong>${week.count || ""}</strong></div><span>${escapeHtml(week.label)}</span></div>`).join("")}</div></article>`;
  }

  function renderFundingInsight(tasks) {
    const statuses = STATUS.map(status => ({ ...status, tasks: tasks.filter(task => task.status === status.id) })).filter(group => group.tasks.length);
    const known = tasks.reduce((sum, task) => sum + (Number(task.fundingMax) || 0), 0);
    const max = Math.max(1, ...statuses.map(group => group.tasks.reduce((sum, task) => sum + (Number(task.fundingMax) || 0), 0) || group.tasks.length));
    return `<article class="insight-panel insight-wide funding-insight"><header><div><span>Finance</span><h3>Funding opportunity pipeline</h3></div><small>${known ? formatCurrency(known) + " known ceiling" : "Variable opportunity values"}</small></header>${tasks.length ? `<div class="funding-pipeline">${statuses.map(group => { const value = group.tasks.reduce((sum, task) => sum + (Number(task.fundingMax) || 0), 0); const scaleValue = value || group.tasks.length; return `<div><div class="funding-stage-heading"><span>${group.label}</span><strong>${group.tasks.length}</strong></div><div class="bar-track"><i class="status-bar-${group.id}" style="width:${scaleValue / max * 100}%"></i></div><small>${value ? formatCurrency(value) : group.tasks.map(fundingValueLabel).join(" · ")}</small></div>`; }).join("")}</div>` : '<p class="insight-no-data">Mark tasks as Funding opportunity to track Purdue grants and fundraising programs here.</p>'}</article>`;
  }

  function renderPartsInsight(items) {
    const total = items.reduce((sum, item) => sum + item.count, 0);
    return `<article class="insight-panel"><header><div><span>Supply chain</span><h3>Parts purchasing stages</h3></div><small>${total} tracked</small></header><div class="bar-list compact-bars">${items.map(item => `<div class="bar-row"><div><span>${item.label}</span><strong>${item.count}</strong></div><div class="bar-track"><i style="width:${total ? item.count / total * 100 : 0}%"></i></div></div>`).join("")}</div></article>`;
  }

  function ownerWorkload(tasks) {
    const map = new Map();
    tasks.forEach(task => {
      const names = splitList(task.ownerNames);
      (names.length ? names : ["Unassigned"]).forEach(name => {
        const item = map.get(normalizeKey(name)) || { name, total: 0, active: 0, risk: 0 };
        item.total += 1;
        if (task.status !== "DONE") item.active += 1;
        if (task.status === "BLOCKED" || (task.status !== "DONE" && task.dueDate && task.dueDate < todayText())) item.risk += 1;
        map.set(normalizeKey(name), item);
      });
    });
    return Array.from(map.values()).sort((a,b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name));
  }

  function dueWeekBuckets(tasks, count) {
    const start = startOfWeek(todayText());
    return Array.from({ length: count }, (_, index) => {
      const weekStart = addDaysText(start, index * 7);
      const weekEnd = addDaysText(weekStart, 6);
      return { label: formatAxisDate(weekStart), count: tasks.filter(task => task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd && task.status !== "DONE").length };
    });
  }

  function startOfWeek(value) {
    const date = parseDate(value);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    return dateText(date);
  }

  function taskSort(a, b) {
    const priorityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const aDue = a.dueDate || "9999-12-31";
    const bDue = b.dueDate || "9999-12-31";
    return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) || aDue.localeCompare(bDue) || a.title.localeCompare(b.title);
  }

  function taskHealth(task) {
    const today = todayText();
    if (task.status === "DONE") return { tone: "good", label: "Task health", title: "Complete", detail: "Finished work is reflected in timeline progress." };
    if (task.taskType === "FUNDING" && ["VERIFY_CURRENT", "CONTACT_REQUIRED"].includes(task.sourceConfidence)) return { tone: "warning", label: "Funding research", title: sourceConfidenceShort(task.sourceConfidence), detail: "Confirm the current cycle, eligibility, and deadline before treating this as an active application." };
    if (task.status === "BLOCKED") return { tone: "danger", label: "Task health", title: "Blocked", detail: "Name the blocker in a comment and assign the next action." };
    if (task.dueDate && task.dueDate < today) return { tone: "danger", label: "Task health", title: "Overdue", detail: `Due ${formatShortDate(task.dueDate)}. Update the date, status, or recovery plan.` };
    if (task.dueDate && daysBetween(today, task.dueDate) <= 3 && Number(task.progress || 0) < 75) return { tone: "warning", label: "Task health", title: "At risk", detail: "Due soon with substantial work remaining." };
    if (["NEEDS_SPEC", "NEEDS_QUOTE", "READY_TO_ORDER"].includes(task.orderStatus)) return { tone: "parts", label: "Parts readiness", title: orderLabel(task.orderStatus), detail: "Purchasing progress may control the engineering schedule." };
    if (!task.dueDate) return { tone: "neutral", label: "Task health", title: "No due date", detail: "Add dates to make the task visible in the timeline and deadline views." };
    return { tone: "good", label: "Task health", title: "On track", detail: `Scheduled through ${formatShortDate(task.dueDate)}.` };
  }

  function dueState(task) {
    if (!task.dueDate) return { text: "", tone: "none" };
    if (task.status === "DONE") return { text: `Done ${formatShortDate(task.dueDate)}`, tone: "done" };
    const delta = daysBetween(todayText(), task.dueDate);
    if (delta < 0) return { text: `${Math.abs(delta)}d overdue`, tone: "overdue" };
    if (delta === 0) return { text: "Due today", tone: "soon" };
    if (delta <= 7) return { text: `Due in ${delta}d`, tone: "soon" };
    return { text: formatShortDate(task.dueDate), tone: "normal" };
  }

  function timelineRange(tasks, board) {
    const dates = tasks.flatMap(task => [task.startDate, task.dueDate]).filter(Boolean);
    if (board.targetStart) dates.push(board.targetStart);
    if (board.targetEnd) dates.push(board.targetEnd);
    let start = dates.sort()[0] || todayText();
    let end = dates.sort().slice(-1)[0] || addDaysText(start, 30);
    start = addDaysText(start, -7);
    end = addDaysText(end, 10);
    if (daysBetween(start, end) < 28) end = addDaysText(start, 28);
    return { start, end };
  }

  function renderOwnerAvatars(owners) {
    if (!owners.length) return '<span class="owner-unassigned">?</span>';
    return owners.slice(0, 3).map(name => `<span title="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`).join("") + (owners.length > 3 ? `<span>+${owners.length - 3}</span>` : "");
  }

  function taskTypeLabel(value) { return TASK_TYPE.find(item => item.id === value)?.label || value || "Work item"; }
  function statusLabel(value) { return STATUS.find(item => item.id === value)?.label || value || "Planned"; }
  function priorityLabel(value) { return PRIORITY.find(item => item.id === value)?.label || value || "Medium"; }
  function orderLabel(value) { return ORDER_STATUS.find(item => item.id === value)?.label || value || "Not a purchase"; }
  function sourceConfidenceLabel(value) { return SOURCE_CONFIDENCE.find(item => item.id === value)?.label || value || "Team-entered information"; }
  function sourceConfidenceShort(value) { const labels = { OFFICIAL_CURRENT: "Official current", OFFICIAL_NO_CURRENT_DEADLINE: "Deadline not posted", VERIFY_CURRENT: "Verify current cycle", CONTACT_REQUIRED: "Contact required", TEAM_ENTERED: "Team entered" }; return labels[value] || "Team entered"; }
  function fundingValueLabel(task) { if (task.fundingAmountLabel) return task.fundingAmountLabel; const min = Number(task.fundingMin) || 0; const max = Number(task.fundingMax) || 0; if (min && max && min !== max) return `${formatCurrency(min)}–${formatCurrency(max)}`; if (max) return `Up to ${formatCurrency(max)}`; if (min) return `From ${formatCurrency(min)}`; return "Amount not published"; }
  function isPartsTask(task) { return Boolean(task.partName || task.partNumber || task.vendor || (task.orderStatus && task.orderStatus !== "NOT_NEEDED")); }
  function splitList(value) {
    if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
    const text = String(value || "").trim();
    if (!text) return [];
    if (text.startsWith("[")) { try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean); } catch (_) {} }
    return text.split(/[,;]+/).map(item => item.trim()).filter(Boolean);
  }
  function normalizeDisplayName(value) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80); }
  function normalizeKey(value) { return normalizeDisplayName(value).toLowerCase(); }
  function initials(value) { return String(value || "?").trim().split(/\s+/).slice(0, 2).map(word => word[0] || "").join("").toUpperCase() || "?"; }
  function truncate(value, length) { const text = String(value || "").replace(/\s+/g, " ").trim(); return text.length > length ? text.slice(0, length - 1).trim() + "…" : text; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function todayText() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
  function parseDate(value) { const [y, m, d] = String(value).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
  function dateText(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function addDaysText(value, count) { const date = parseDate(value); date.setDate(date.getDate() + count); return dateText(date); }
  function daysBetween(start, end) { return Math.round((parseDate(end) - parseDate(start)) / 86400000); }
  function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
  function formatShortDate(value) { if (!value) return ""; return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: parseDate(value).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }); }
  function formatAxisDate(value) { return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function formatBoardDateRange(board) { if (board.targetStart && board.targetEnd) return `${formatShortDate(board.targetStart)} – ${formatShortDate(board.targetEnd)}`; if (board.targetStart) return `Starts ${formatShortDate(board.targetStart)}`; if (board.targetEnd) return `Target ${formatShortDate(board.targetEnd)}`; return ""; }
  function formatCurrency(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function relativeTime(value) {
    if (!value) return "just now";
    const date = new Date(value); if (Number.isNaN(date.getTime())) return "recently";
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
    const ranges = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
    for (const [unitSeconds, unit] of ranges) if (Math.abs(seconds) >= unitSeconds) return formatter.format(Math.round(seconds / unitSeconds), unit);
    return formatter.format(seconds, "second");
  }
  function activityLabel(action) {
    const labels = { TASK_CREATED: "Task created", TASK_UPDATED: "Task updated", STATUS_CHANGED: "Status changed", COMMENT_ADDED: "Comment added", TASK_ARCHIVED: "Task archived" };
    return labels[action] || String(action || "Activity").replace(/_/g, " ").toLowerCase().replace(/^./, char => char.toUpperCase());
  }
  function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function slugify(value) { return String(value || "timeline").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
})();
