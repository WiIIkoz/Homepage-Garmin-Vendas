(function () {
  "use strict";

  var MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  var state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth()
  };

  // Vendas agora vêm do Supabase (tabela "vendas"), carregadas de uma vez em
  // DB.getVendas() e agrupadas por dia, no mesmo formato que o restante deste
  // arquivo já esperava quando os dados viviam no localStorage.
  var data = {};

  function parseDateKey(key) {
    var parts = key.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function parseValor(str) {
    if (!str) return 0;
    var normalized = String(str)
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    var n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }

  function formatCurrency(n) {
    return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sumForRange(startDate, endDate) {
    var total = 0;
    Object.keys(data).forEach(function (key) {
      var d = parseDateKey(key);
      if (d >= startDate && d <= endDate) {
        (data[key] || []).forEach(function (item) {
          total += parseValor(item.valor);
        });
      }
    });
    return total;
  }

  function sumAll() {
    var total = 0;
    Object.keys(data).forEach(function (key) {
      (data[key] || []).forEach(function (item) {
        total += parseValor(item.valor);
      });
    });
    return total;
  }

  function startOfWeek(d) {
    var r = new Date(d);
    r.setHours(0, 0, 0, 0);
    r.setDate(r.getDate() - r.getDay());
    return r;
  }

  function endOfWeek(d) {
    var s = startOfWeek(d);
    var r = new Date(s);
    r.setDate(s.getDate() + 6);
    r.setHours(23, 59, 59, 999);
    return r;
  }

  function startOfDay(d) {
    var r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function endOfDay(d) {
    var r = new Date(d);
    r.setHours(23, 59, 59, 999);
    return r;
  }

  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function formatShortDate(d) {
    return d.toLocaleDateString("pt-BR");
  }

  // ---------- Elements ----------
  var monthTitleEl = document.getElementById("monthTitle");
  var totalMesEl = document.getElementById("totalMes");
  var totalMesCaptionEl = document.getElementById("totalMesCaption");
  var flexCardLabelEl = document.getElementById("flexCardLabel");
  var totalSemanaEl = document.getElementById("totalSemana");
  var totalSemanaCaptionEl = document.getElementById("totalSemanaCaption");
  var totalSemestreEl = document.getElementById("totalSemestre");
  var totalSemestreCaptionEl = document.getElementById("totalSemestreCaption");
  var totalGeralEl = document.getElementById("totalGeral");

  // ---------- Flexible filter (Hoje / Ontem / Essa semana / Escolher data) ----------
  var activeFilter = "semana"; // "hoje" | "ontem" | "semana" | "custom"
  var customRange = null; // { start: Date, end: Date }

  function getActiveFilterInfo() {
    var today = new Date();

    if (activeFilter === "hoje") {
      return {
        title: "Hoje",
        start: startOfDay(today),
        end: endOfDay(today),
        caption: formatShortDate(today)
      };
    }

    if (activeFilter === "ontem") {
      var yesterday = addDays(today, -1);
      return {
        title: "Ontem",
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
        caption: formatShortDate(yesterday)
      };
    }

    if (activeFilter === "custom" && customRange) {
      var caption = isSameDay(customRange.start, customRange.end)
        ? formatShortDate(customRange.start)
        : formatShortDate(customRange.start) + " a " + formatShortDate(customRange.end);
      return {
        title: "Período personalizado",
        start: startOfDay(customRange.start),
        end: endOfDay(customRange.end),
        caption: caption
      };
    }

    var weekStart = startOfWeek(today);
    var weekEnd = endOfWeek(today);
    return {
      title: "Essa semana",
      start: weekStart,
      end: weekEnd,
      caption: formatShortDate(weekStart) + " a " + formatShortDate(weekEnd)
    };
  }

  function render() {
    monthTitleEl.textContent = MONTH_NAMES[state.viewMonth] + " de " + state.viewYear;

    var monthStart = new Date(state.viewYear, state.viewMonth, 1, 0, 0, 0, 0);
    var monthEnd = new Date(state.viewYear, state.viewMonth + 1, 0, 23, 59, 59, 999);
    totalMesEl.textContent = formatCurrency(sumForRange(monthStart, monthEnd));
    totalMesCaptionEl.textContent = MONTH_NAMES[state.viewMonth] + " de " + state.viewYear;

    var filterInfo = getActiveFilterInfo();
    flexCardLabelEl.textContent = filterInfo.title;
    totalSemanaEl.textContent = formatCurrency(sumForRange(filterInfo.start, filterInfo.end));
    totalSemanaCaptionEl.textContent = filterInfo.caption;

    var isFirstSemester = state.viewMonth < 6;
    var semStartMonth = isFirstSemester ? 0 : 6;
    var semEndMonth = isFirstSemester ? 5 : 11;
    var semStart = new Date(state.viewYear, semStartMonth, 1, 0, 0, 0, 0);
    var semEnd = new Date(state.viewYear, semEndMonth + 1, 0, 23, 59, 59, 999);
    totalSemestreEl.textContent = formatCurrency(sumForRange(semStart, semEnd));
    totalSemestreCaptionEl.textContent = (isFirstSemester ? "1º" : "2º") + " semestre de " + state.viewYear;

    totalGeralEl.textContent = formatCurrency(sumAll());
  }

  document.getElementById("prevMonth").addEventListener("click", function () {
    state.viewMonth -= 1;
    if (state.viewMonth < 0) {
      state.viewMonth = 11;
      state.viewYear -= 1;
    }
    render();
  });

  document.getElementById("nextMonth").addEventListener("click", function () {
    state.viewMonth += 1;
    if (state.viewMonth > 11) {
      state.viewMonth = 0;
      state.viewYear += 1;
    }
    render();
  });

  // ---------- Filter popover (Hoje / Ontem / Essa semana / Escolher data) ----------
  var filterBtn = document.getElementById("filterBtn");
  var filterPopover = document.getElementById("filterPopover");

  function openFilterPopover() {
    filterPopover.classList.add("open");
    filterBtn.setAttribute("aria-expanded", "true");
  }

  function closeFilterPopover() {
    filterPopover.classList.remove("open");
    filterBtn.setAttribute("aria-expanded", "false");
  }

  filterBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (filterPopover.classList.contains("open")) {
      closeFilterPopover();
    } else {
      openFilterPopover();
    }
  });

  document.addEventListener("click", function (e) {
    if (!filterPopover.contains(e.target) && e.target !== filterBtn) {
      closeFilterPopover();
    }
  });

  document.getElementById("filterHoje").addEventListener("click", function () {
    activeFilter = "hoje";
    closeFilterPopover();
    render();
  });

  document.getElementById("filterOntem").addEventListener("click", function () {
    activeFilter = "ontem";
    closeFilterPopover();
    render();
  });

  document.getElementById("filterSemana").addEventListener("click", function () {
    activeFilter = "semana";
    closeFilterPopover();
    render();
  });

  document.getElementById("filterCustom").addEventListener("click", function () {
    closeFilterPopover();
    openRangeModal();
  });

  // ---------- Range picker (mini calendário) ----------
  var rangeModalOverlay = document.getElementById("rangeModalOverlay");
  var rangeModalClose = document.getElementById("rangeModalClose");
  var miniCalTitleEl = document.getElementById("miniCalTitle");
  var miniCalGridEl = document.getElementById("miniCalGrid");
  var rangeHintEl = document.getElementById("rangeHint");
  var rangeApplyBtn = document.getElementById("rangeApplyBtn");
  var miniPrevMonthBtn = document.getElementById("miniPrevMonth");
  var miniNextMonthBtn = document.getElementById("miniNextMonth");

  var miniViewYear = new Date().getFullYear();
  var miniViewMonth = new Date().getMonth();
  var rangeStart = null;
  var rangeEnd = null;

  function updateRangeHint() {
    if (rangeStart && rangeEnd) {
      rangeHintEl.textContent = isSameDay(rangeStart, rangeEnd)
        ? "Período selecionado: " + formatShortDate(rangeStart)
        : "Período selecionado: " + formatShortDate(rangeStart) + " a " + formatShortDate(rangeEnd);
    } else if (rangeStart) {
      rangeHintEl.textContent = "Selecione o último dia do período.";
    } else {
      rangeHintEl.textContent = "Selecione o primeiro dia do período.";
    }
    rangeApplyBtn.disabled = !(rangeStart && rangeEnd);
  }

  function renderMiniCalendar() {
    miniCalTitleEl.textContent = MONTH_NAMES[miniViewMonth] + " de " + miniViewYear;
    miniCalGridEl.innerHTML = "";

    var firstDayOfMonth = new Date(miniViewYear, miniViewMonth, 1);
    var startWeekday = firstDayOfMonth.getDay();
    var daysInMonth = new Date(miniViewYear, miniViewMonth + 1, 0).getDate();

    var fragment = document.createDocumentFragment();

    for (var i = 0; i < startWeekday; i++) {
      var emptyCell = document.createElement("div");
      emptyCell.className = "mini-day-cell empty";
      fragment.appendChild(emptyCell);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var cellDate = new Date(miniViewYear, miniViewMonth, day);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mini-day-cell";
      btn.textContent = String(day);

      if (rangeStart && isSameDay(cellDate, rangeStart)) btn.classList.add("range-start");
      if (rangeEnd && isSameDay(cellDate, rangeEnd)) btn.classList.add("range-end");
      if (rangeStart && rangeEnd && cellDate > rangeStart && cellDate < rangeEnd) btn.classList.add("range-between");

      btn.addEventListener("click", (function (clickedDate) {
        return function () {
          if (!rangeStart || (rangeStart && rangeEnd)) {
            rangeStart = clickedDate;
            rangeEnd = null;
          } else if (clickedDate < rangeStart) {
            rangeEnd = rangeStart;
            rangeStart = clickedDate;
          } else {
            rangeEnd = clickedDate;
          }
          updateRangeHint();
          renderMiniCalendar();
        };
      })(cellDate));

      fragment.appendChild(btn);
    }

    miniCalGridEl.appendChild(fragment);
  }

  miniPrevMonthBtn.addEventListener("click", function () {
    miniViewMonth -= 1;
    if (miniViewMonth < 0) {
      miniViewMonth = 11;
      miniViewYear -= 1;
    }
    renderMiniCalendar();
  });

  miniNextMonthBtn.addEventListener("click", function () {
    miniViewMonth += 1;
    if (miniViewMonth > 11) {
      miniViewMonth = 0;
      miniViewYear += 1;
    }
    renderMiniCalendar();
  });

  function openRangeModal() {
    var base = customRange ? customRange.start : new Date();
    miniViewYear = base.getFullYear();
    miniViewMonth = base.getMonth();
    rangeStart = customRange ? new Date(customRange.start) : null;
    rangeEnd = customRange ? new Date(customRange.end) : null;
    updateRangeHint();
    renderMiniCalendar();
    rangeModalOverlay.classList.add("open");
  }

  function closeRangeModal() {
    rangeModalOverlay.classList.remove("open");
  }

  rangeApplyBtn.addEventListener("click", function () {
    if (!rangeStart || !rangeEnd) return;
    customRange = { start: new Date(rangeStart), end: new Date(rangeEnd) };
    activeFilter = "custom";
    closeRangeModal();
    render();
  });

  rangeModalClose.addEventListener("click", closeRangeModal);
  rangeModalOverlay.addEventListener("click", function (e) {
    if (e.target === rangeModalOverlay) closeRangeModal();
  });

  // ---------- Config modal & dark mode ----------
  var THEME_STORAGE_KEY = "estoqueCalendarioTheme";
  var configBtn = document.getElementById("configBtn");
  var configModalOverlay = document.getElementById("configModalOverlay");
  var configModalClose = document.getElementById("configModalClose");
  var themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      themeToggle.setAttribute("aria-checked", "true");
    } else {
      document.documentElement.removeAttribute("data-theme");
      themeToggle.setAttribute("aria-checked", "false");
    }
  }

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || "light";
    } catch (e) {
      return "light";
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.error("Falha ao salvar tema:", e);
    }
  }

  applyTheme(loadTheme());

  themeToggle.addEventListener("click", function () {
    var isDark = themeToggle.getAttribute("aria-checked") === "true";
    var nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  });

  function openConfigModal() {
    configModalOverlay.classList.add("open");
  }

  function closeConfigModal() {
    configModalOverlay.classList.remove("open");
  }

  configBtn.addEventListener("click", openConfigModal);
  configModalClose.addEventListener("click", closeConfigModal);
  configModalOverlay.addEventListener("click", function (e) {
    if (e.target === configModalOverlay) closeConfigModal();
  });

  // ---------- Drawer ----------
  var hamburgerBtn = document.getElementById("hamburgerBtn");
  var drawer = document.getElementById("drawer");
  var drawerOverlay = document.getElementById("drawerOverlay");
  var drawerClose = document.getElementById("drawerClose");

  function openDrawer() {
    drawer.classList.add("open");
    drawerOverlay.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    hamburgerBtn.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    hamburgerBtn.setAttribute("aria-expanded", "false");
  }

  hamburgerBtn.addEventListener("click", function () {
    if (drawer.classList.contains("open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
  drawerClose.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (rangeModalOverlay.classList.contains("open")) {
        closeRangeModal();
      } else if (configModalOverlay.classList.contains("open")) {
        closeConfigModal();
      } else if (filterPopover.classList.contains("open")) {
        closeFilterPopover();
      } else if (drawer.classList.contains("open")) {
        closeDrawer();
      }
    }
  });

  // ---------- Footer year ----------
  document.getElementById("footerYear").textContent = String(new Date().getFullYear());

  // ---------- Init ----------
  (async function init() {
    var session = await AppAuth.requireSession();
    if (!session) return;
    data = await DB.getVendas();
    render();
  })();
})();
