(function () {
  "use strict";

  var MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  var state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedDateKey: null
  };

  // Os itens vendidos agora vivem no Supabase (tabela "vendas"), carregados de uma
  // vez em DB.getVendas() e agrupados por dia. `data` continua no mesmo formato de
  // antes ({ "AAAA-MM-DD": [itens] }) para o resto do código mudar o mínimo possível.
  var data = {};

  function dateKey(year, month, day) {
    var m = String(month + 1).padStart(2, "0");
    var d = String(day).padStart(2, "0");
    return year + "-" + m + "-" + d;
  }

  // ---------- Calendar rendering ----------
  var monthTitleEl = document.getElementById("monthTitle");
  var calendarGridEl = document.getElementById("calendarGrid");

  function renderCalendar() {
    monthTitleEl.textContent = MONTH_NAMES[state.viewMonth] + " de " + state.viewYear;
    calendarGridEl.innerHTML = "";

    var firstDayOfMonth = new Date(state.viewYear, state.viewMonth, 1);
    var startWeekday = firstDayOfMonth.getDay();
    var daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();

    var today = new Date();
    var isCurrentMonth = today.getFullYear() === state.viewYear && today.getMonth() === state.viewMonth;

    var fragment = document.createDocumentFragment();

    for (var i = 0; i < startWeekday; i++) {
      var emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      fragment.appendChild(emptyCell);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var key = dateKey(state.viewYear, state.viewMonth, day);
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day-cell";
      if (isCurrentMonth && today.getDate() === day) {
        cell.classList.add("today");
      }

      var numberEl = document.createElement("span");
      numberEl.className = "day-number";
      numberEl.textContent = String(day);
      cell.appendChild(numberEl);

      var itemsForDay = data[key];
      if (itemsForDay && itemsForDay.length > 0) {
        var badge = document.createElement("span");
        badge.className = "item-badge";
        badge.textContent = itemsForDay.length + (itemsForDay.length === 1 ? " item" : " itens");
        cell.appendChild(badge);
      }

      cell.addEventListener("click", (function (dayKey) {
        return function () {
          openModal(dayKey);
        };
      })(key));

      fragment.appendChild(cell);
    }

    calendarGridEl.appendChild(fragment);
  }

  document.getElementById("prevMonth").addEventListener("click", function () {
    state.viewMonth -= 1;
    if (state.viewMonth < 0) {
      state.viewMonth = 11;
      state.viewYear -= 1;
    }
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", function () {
    state.viewMonth += 1;
    if (state.viewMonth > 11) {
      state.viewMonth = 0;
      state.viewYear += 1;
    }
    renderCalendar();
  });

  document.getElementById("todayBtn").addEventListener("click", function () {
    var today = new Date();
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();
    renderCalendar();
  });

  // ---------- Modal ----------
  var modalOverlay = document.getElementById("modalOverlay");
  var modalTitle = document.getElementById("modalTitle");
  var itemsListEl = document.getElementById("itemsList");
  var emptyStateEl = document.getElementById("emptyState");
  var itemForm = document.getElementById("itemForm");
  var saveItemBtn = document.getElementById("saveItemBtn");
  var formHint = document.getElementById("formHint");

  var fieldDescricao = document.getElementById("fieldDescricao");
  var fieldSku = document.getElementById("fieldSku");
  var fieldVendedor = document.getElementById("fieldVendedor");
  var fieldNfe = document.getElementById("fieldNfe");
  var fieldQuantidade = document.getElementById("fieldQuantidade");
  var fieldValor = document.getElementById("fieldValor");
  var skuMatchHint = document.getElementById("skuMatchHint");

  var DEFAULT_QUANTIDADE = "01";

  // ---------- Auto-preenchimento por SKU (catálogo de produtos + Garmin Brasil) ----------
  // Casa primeiro pelo catálogo próprio (tabela "produtos", com valor já cadastrado);
  // se o SKU não estiver lá, cai para a busca ao vivo no site da Garmin Brasil.
  var produtosPorSku = {};

  function normalizeSku(sku) {
    return String(sku || "").trim().toUpperCase();
  }

  function setProdutosCatalogo(produtos) {
    produtosPorSku = {};
    (produtos || []).forEach(function (produto) {
      if (!produto.sku) return;
      produtosPorSku[normalizeSku(produto.sku)] = produto;
    });
  }

  function buscarInfoPorSku(sku) {
    var key = normalizeSku(sku);
    if (!key) return null;

    var produtoCadastrado = produtosPorSku[key];
    if (produtoCadastrado && produtoCadastrado.valor) {
      return { descricao: produtoCadastrado.descricao, valor: Number(produtoCadastrado.valor) };
    }

    var garminInfo = window.GarminPrecos && GarminPrecos.getPreco(sku);
    if (garminInfo) {
      return { descricao: garminInfo.titulo, valor: garminInfo.preco };
    }

    return null;
  }

  // Dígitos realmente digitados pelo usuário para o campo Valor (representam reais inteiros).
  // Mantidos à parte do texto exibido no input para não reprocessar o "R$ ...,00" já formatado.
  var valorDigits = "";

  function formatCurrencyFromDigits(digits) {
    if (!digits) return "";
    var reais = parseInt(digits, 10);
    if (isNaN(reais)) return "";
    return "R$ " + reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderValorField() {
    fieldValor.value = formatCurrencyFromDigits(valorDigits);
    var pos = fieldValor.value.length;
    fieldValor.setSelectionRange(pos, pos);
  }

  // Backspace/Delete são tratados aqui (não via beforeinput) porque são mais confiáveis
  // entre navegadores e formas de entrada.
  fieldValor.addEventListener("keydown", function (e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      valorDigits = valorDigits.slice(0, -1);
      renderValorField();
      updateSaveButtonState();
    }
  });

  fieldValor.addEventListener("beforeinput", function (e) {
    if (e.inputType === "insertText" || e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") {
      e.preventDefault();
      var incoming = (e.data || "").replace(/\D/g, "");
      if (incoming) {
        valorDigits = (valorDigits + incoming).replace(/^0+(?=\d)/, "").slice(0, 15);
      }
      renderValorField();
      updateSaveButtonState();
    } else if (e.inputType && e.inputType.indexOf("delete") === 0) {
      // Já tratado pelo listener de keydown acima.
      e.preventDefault();
    }
  });

  fieldQuantidade.addEventListener("input", function () {
    fieldQuantidade.value = fieldQuantidade.value.replace(/\D/g, "");
    updateSaveButtonState();
  });

  // Ao digitar um SKU que já existe no catálogo (ou na Garmin Brasil), preenche
  // descrição e valor sozinho — o usuário ainda pode editar os dois depois.
  fieldSku.addEventListener("input", function () {
    var info = buscarInfoPorSku(fieldSku.value);
    if (info) {
      fieldDescricao.value = info.descricao;
      valorDigits = String(Math.round(info.valor));
      renderValorField();
      skuMatchHint.textContent = "Descrição e valor preenchidos automaticamente.";
      skuMatchHint.classList.add("field-hint-success");
    } else {
      skuMatchHint.textContent = "";
      skuMatchHint.classList.remove("field-hint-success");
    }
    updateSaveButtonState();
  });

  function formatDateForTitle(key) {
    var parts = key.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
    return "Itens de " + parts[2] + " de " + MONTH_NAMES[d.getMonth()] + " de " + parts[0] + " (" + weekday + ")";
  }

  function openModal(key) {
    state.selectedDateKey = key;
    modalTitle.textContent = formatDateForTitle(key);
    renderItemsList();
    clearForm();
    modalOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
    fieldDescricao.focus();
  }

  function closeModal() {
    modalOverlay.classList.remove("open");
    document.body.style.overflow = "";
    state.selectedDateKey = null;
  }

  document.getElementById("modalClose").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (confirmModalOverlay.classList.contains("open")) {
        closeConfirmModal();
      } else if (configModalOverlay.classList.contains("open")) {
        closeConfigModal();
      } else if (modalOverlay.classList.contains("open")) {
        closeModal();
      } else if (drawer.classList.contains("open")) {
        closeDrawer();
      }
    }
  });

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderItemsList() {
    var items = data[state.selectedDateKey] || [];
    itemsListEl.innerHTML = "";

    if (items.length === 0) {
      itemsListEl.appendChild(emptyStateEl);
      return;
    }

    items.forEach(function (item, index) {
      var card = document.createElement("div");
      card.className = "item-card";

      var header = document.createElement("div");
      header.className = "item-card-header";

      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "item-toggle-btn";
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-label", "Expandir detalhes do item");
      toggleBtn.innerHTML =
        "<svg class=\"item-toggle-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>";

      var summary = document.createElement("div");
      summary.className = "item-card-summary";
      summary.innerHTML =
        "<span class=\"item-summary-desc\">" + escapeHtml(item.descricao) + "</span>" +
        "<span class=\"item-summary-nfe\">NF-e: " + escapeHtml(item.nfe) + "</span>";

      var summaryValor = document.createElement("span");
      summaryValor.className = "item-summary-valor";
      summaryValor.textContent = item.valor || "—";

      var details = document.createElement("div");
      details.className = "item-card-details";

      var fieldsWrap = document.createElement("div");
      fieldsWrap.className = "item-card-fields";
      fieldsWrap.innerHTML =
        "<div><span class=\"label\">Descrição:</span>" + escapeHtml(item.descricao) + "</div>" +
        "<div><span class=\"label\">SKU:</span>" + escapeHtml(item.sku) + "</div>" +
        "<div><span class=\"label\">Vendedor:</span>" + escapeHtml(item.vendedor) + "</div>" +
        "<div><span class=\"label\">NF-e:</span>" + escapeHtml(item.nfe) + "</div>" +
        "<div><span class=\"label\">Quantidade:</span>" + escapeHtml(item.quantidade || "—") + "</div>" +
        "<div><span class=\"label\">Valor:</span>" + escapeHtml(item.valor || "—") + "</div>";
      details.appendChild(fieldsWrap);

      toggleBtn.addEventListener("click", function () {
        var isOpen = card.classList.toggle("open");
        toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        toggleBtn.setAttribute("aria-label", isOpen ? "Recolher detalhes do item" : "Expandir detalhes do item");
      });

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-item-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = "Remover item";
      removeBtn.addEventListener("click", function () {
        openConfirmModal(async function () {
          await DB.deleteVenda(item.id);
          items.splice(index, 1);
          if (items.length === 0) {
            delete data[state.selectedDateKey];
          }
          renderItemsList();
          renderCalendar();
        });
      });

      header.appendChild(toggleBtn);
      header.appendChild(summary);
      header.appendChild(summaryValor);
      header.appendChild(removeBtn);
      card.appendChild(header);
      card.appendChild(details);
      itemsListEl.appendChild(card);
    });
  }

  function clearForm() {
    [fieldDescricao, fieldSku, fieldVendedor, fieldNfe].forEach(function (f) { f.value = ""; });
    fieldQuantidade.value = DEFAULT_QUANTIDADE;
    valorDigits = "";
    fieldValor.value = "";
    skuMatchHint.textContent = "";
    skuMatchHint.classList.remove("field-hint-success");
    updateSaveButtonState();
  }

  function isQuantidadeValid() {
    var n = parseInt(fieldQuantidade.value, 10);
    return !isNaN(n) && n >= 1;
  }

  function updateSaveButtonState() {
    var textFieldsFilled = [fieldDescricao, fieldSku, fieldVendedor, fieldNfe].every(function (f) {
      return f.value.trim().length > 0;
    });
    var allFilled = textFieldsFilled && isQuantidadeValid() && fieldValor.value.trim().length > 0;
    saveItemBtn.disabled = !allFilled;
    formHint.textContent = allFilled
      ? "Todos os campos preenchidos. Pronto para salvar."
      : "Preencha todos os campos para poder salvar o item.";
  }

  [fieldDescricao, fieldSku, fieldVendedor, fieldNfe].forEach(function (f) {
    f.addEventListener("input", updateSaveButtonState);
  });

  itemForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    var newItem = {
      descricao: fieldDescricao.value.trim(),
      sku: fieldSku.value.trim(),
      vendedor: fieldVendedor.value.trim(),
      nfe: fieldNfe.value.trim(),
      quantidade: fieldQuantidade.value.trim(),
      valor: fieldValor.value.trim()
    };

    if (!newItem.descricao || !newItem.sku || !newItem.vendedor || !newItem.nfe || !isQuantidadeValid() || !newItem.valor) {
      return;
    }

    saveItemBtn.disabled = true;
    var inserted = await DB.addVenda(state.selectedDateKey, newItem);
    saveItemBtn.disabled = false;

    if (!inserted) {
      formHint.textContent = "Não foi possível salvar o item. Tente novamente.";
      return;
    }

    if (!data[state.selectedDateKey]) {
      data[state.selectedDateKey] = [];
    }
    data[state.selectedDateKey].push(inserted);

    clearForm();
    renderItemsList();
    renderCalendar();
    fieldDescricao.focus();
  });

  // ---------- Delete confirmation modal ----------
  var confirmModalOverlay = document.getElementById("confirmModalOverlay");
  var confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  var confirmCancelBtn = document.getElementById("confirmCancelBtn");
  var confirmModalClose = document.getElementById("confirmModalClose");
  var pendingDeleteAction = null;

  function openConfirmModal(onConfirm) {
    pendingDeleteAction = onConfirm;
    confirmModalOverlay.classList.add("open");
  }

  function closeConfirmModal() {
    confirmModalOverlay.classList.remove("open");
    pendingDeleteAction = null;
  }

  confirmDeleteBtn.addEventListener("click", function () {
    var action = pendingDeleteAction;
    closeConfirmModal();
    if (action) action();
  });
  confirmCancelBtn.addEventListener("click", closeConfirmModal);
  confirmModalClose.addEventListener("click", closeConfirmModal);
  confirmModalOverlay.addEventListener("click", function (e) {
    if (e.target === confirmModalOverlay) closeConfirmModal();
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

  // ---------- Footer year ----------
  document.getElementById("footerYear").textContent = String(new Date().getFullYear());

  // ---------- Init ----------
  (async function init() {
    var session = await AppAuth.requireSession();
    if (!session) return;
    var resultados = await Promise.all([DB.getVendas(), DB.getProdutos(), GarminPrecos.ensureLoaded()]);
    data = resultados[0];
    setProdutosCatalogo(resultados[1]);
    renderCalendar();
  })();
})();
