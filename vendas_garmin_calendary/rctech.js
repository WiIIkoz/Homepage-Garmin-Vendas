(function () {
  "use strict";

  var DIAS_LIMITE_RETIRADA = 120;

  // Chamados carregados do Supabase (tabela "chamados_assistencia"). Cada item:
  // { id, numero, status: "aberto"|"enviado"|"disponivel", data_abertura,
  //   data_envio, data_retorno }
  var chamados = [];

  // ---------- Helpers ----------
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function diasDesde(iso) {
    if (!iso) return 0;
    var ms = Date.now() - new Date(iso).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  function porStatus(status) {
    return chamados.filter(function (c) { return c.status === status; });
  }

  // ---------- Elements ----------
  var chamadoForm = document.getElementById("chamadoForm");
  var fieldNumeroChamado = document.getElementById("fieldNumeroChamado");
  var addChamadoBtn = document.getElementById("addChamadoBtn");

  var chamadosListEl = document.getElementById("chamadosList");
  var chamadosEmptyState = document.getElementById("chamadosEmptyState");

  var enviadosListEl = document.getElementById("enviadosList");
  var enviadosEmptyState = document.getElementById("enviadosEmptyState");
  var enviadosSearch = document.getElementById("enviadosSearch");

  var disponiveisListEl = document.getElementById("disponiveisList");
  var disponiveisEmptyState = document.getElementById("disponiveisEmptyState");
  var overdueWarningBanner = document.getElementById("overdueWarningBanner");

  var tabCountChamados = document.getElementById("tabCountChamados");
  var tabCountEnviados = document.getElementById("tabCountEnviados");
  var tabCountDisponiveis = document.getElementById("tabCountDisponiveis");

  // ---------- Abas (Chamados / Enviados / Disponíveis) ----------
  var tabButtons = document.querySelectorAll(".rctech-tab-btn");
  var tabPanels = {
    chamados: document.getElementById("tabPanelChamados"),
    enviados: document.getElementById("tabPanelEnviados"),
    disponiveis: document.getElementById("tabPanelDisponiveis")
  };

  function setActiveTab(tab) {
    tabButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    Object.keys(tabPanels).forEach(function (key) {
      tabPanels[key].hidden = key !== tab;
    });
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () { setActiveTab(btn.dataset.tab); });
  });

  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2600);
  }

  // ---------- Renderização ----------
  function criarItemRow(chamado, opcoes) {
    var row = document.createElement("div");
    row.className = "rctech-item" + (opcoes.overdue ? " rctech-item-overdue" : "");

    var info = document.createElement("div");
    info.className = "rctech-item-info";
    info.innerHTML =
      "<span class=\"rctech-item-numero\">#" + escapeHtml(chamado.numero) + "</span>" +
      "<span class=\"rctech-item-data\">" + escapeHtml(opcoes.dataLabel) + "</span>";

    if (opcoes.overdue) {
      var badge = document.createElement("span");
      badge.className = "rctech-overdue-badge";
      badge.textContent = "⚠ Mais de " + DIAS_LIMITE_RETIRADA + " dias parado — envie de volta à assistência";
      info.appendChild(badge);
    }

    var actions = document.createElement("div");
    actions.className = "rctech-item-actions";
    opcoes.actions.forEach(function (actionEl) { actions.appendChild(actionEl); });

    row.appendChild(info);
    row.appendChild(actions);
    return row;
  }

  function criarBotao(texto, classe, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = classe;
    btn.textContent = texto;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function criarRemoverBtn(chamado) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-item-btn";
    btn.innerHTML = "&times;";
    btn.title = "Remover chamado";
    btn.addEventListener("click", function () {
      openConfirmModal(
        "Tem certeza que deseja remover o chamado #" + chamado.numero + "? Essa ação não pode ser desfeita.",
        async function () {
          await DB.deleteChamado(chamado.id);
          chamados = chamados.filter(function (c) { return c.id !== chamado.id; });
          renderAll();
        }
      );
    });
    return btn;
  }

  function renderChamados() {
    var abertos = porStatus("aberto");
    tabCountChamados.textContent = String(abertos.length);
    chamadosListEl.innerHTML = "";
    chamadosEmptyState.hidden = abertos.length > 0;

    abertos.forEach(function (chamado) {
      var enviarBtn = criarBotao("Enviar p/ assistência", "btn btn-outline", async function () {
        var atualizado = await DB.updateChamado(chamado.id, {
          status: "enviado",
          data_envio: new Date().toISOString()
        });
        if (!atualizado) {
          showToast("Não foi possível enviar o chamado. Tente novamente.");
          return;
        }
        Object.assign(chamado, atualizado);
        renderAll();
        showToast("Chamado #" + chamado.numero + " enviado para assistência.");
      });

      var row = criarItemRow(chamado, {
        dataLabel: "Aberto em " + formatDateTime(chamado.data_abertura),
        actions: [enviarBtn, criarRemoverBtn(chamado)]
      });
      chamadosListEl.appendChild(row);
    });
  }

  function renderEnviados() {
    var todosEnviados = porStatus("enviado");
    tabCountEnviados.textContent = String(todosEnviados.length);

    var query = enviadosSearch.value.trim().toLowerCase();
    var enviados = todosEnviados.filter(function (c) {
      return !query || c.numero.toLowerCase().indexOf(query) !== -1;
    });

    enviadosListEl.innerHTML = "";
    enviadosEmptyState.hidden = enviados.length > 0;
    enviadosEmptyState.textContent = query
      ? "Nenhum chamado enviado encontrado com esse número."
      : "Nenhum item enviado para assistência no momento.";

    enviados.forEach(function (chamado) {
      var chegouBtn = criarBotao("Chegou", "btn btn-primary", async function () {
        var atualizado = await DB.updateChamado(chamado.id, {
          status: "disponivel",
          data_retorno: new Date().toISOString()
        });
        if (!atualizado) {
          showToast("Não foi possível registrar a chegada. Tente novamente.");
          return;
        }
        Object.assign(chamado, atualizado);
        renderAll();
        showToast("Chamado #" + chamado.numero + " disponível para retirada.");
      });

      var row = criarItemRow(chamado, {
        dataLabel: "Enviado em " + formatDateTime(chamado.data_envio),
        actions: [chegouBtn, criarRemoverBtn(chamado)]
      });
      enviadosListEl.appendChild(row);
    });
  }

  function renderDisponiveis() {
    var disponiveis = porStatus("disponivel");
    tabCountDisponiveis.textContent = String(disponiveis.length);
    disponiveisListEl.innerHTML = "";
    disponiveisEmptyState.hidden = disponiveis.length > 0;

    var vencidos = 0;

    disponiveis.forEach(function (chamado) {
      var dias = diasDesde(chamado.data_retorno);
      var overdue = dias > DIAS_LIMITE_RETIRADA;
      if (overdue) vencidos++;

      var retiradoBtn = criarBotao("Cliente retirou", "btn btn-outline", function () {
        openConfirmModal(
          "Confirma que o cliente já retirou o item do chamado #" + chamado.numero + "?",
          async function () {
            await DB.deleteChamado(chamado.id);
            chamados = chamados.filter(function (c) { return c.id !== chamado.id; });
            renderAll();
            showToast("Chamado #" + chamado.numero + " encerrado.");
          }
        );
      });

      var row = criarItemRow(chamado, {
        dataLabel: "Retornou em " + formatDateTime(chamado.data_retorno) + " — há " + dias + (dias === 1 ? " dia" : " dias"),
        overdue: overdue,
        actions: [retiradoBtn]
      });
      disponiveisListEl.appendChild(row);
    });

    tabCountDisponiveis.classList.toggle("rctech-tab-count-danger", vencidos > 0);

    if (vencidos > 0) {
      overdueWarningBanner.hidden = false;
      overdueWarningBanner.textContent = "⚠ " + vencidos + (vencidos === 1
        ? " item está parado há mais de " + DIAS_LIMITE_RETIRADA + " dias"
        : " itens estão parados há mais de " + DIAS_LIMITE_RETIRADA + " dias") +
        " sem retirada. Envie de volta à assistência para que entrem em contato direto com o cliente.";
    } else {
      overdueWarningBanner.hidden = true;
    }
  }

  function renderAll() {
    renderChamados();
    renderEnviados();
    renderDisponiveis();
  }

  enviadosSearch.addEventListener("input", renderEnviados);

  // ---------- Adicionar chamado ----------
  fieldNumeroChamado.addEventListener("input", function () {
    addChamadoBtn.disabled = fieldNumeroChamado.value.trim().length === 0;
  });

  chamadoForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var numero = fieldNumeroChamado.value.trim();
    if (!numero) return;

    addChamadoBtn.disabled = true;
    var inserted = await DB.addChamado(numero);
    addChamadoBtn.disabled = false;

    if (!inserted) {
      showToast("Não foi possível adicionar o chamado. Tente novamente.");
      return;
    }

    chamados.push(inserted);
    fieldNumeroChamado.value = "";
    addChamadoBtn.disabled = true;
    renderAll();
    showToast("Chamado #" + inserted.numero + " adicionado.");
    fieldNumeroChamado.focus();
  });

  // ---------- Motoboy: importar vários chamados de uma planilha ----------
  var motoboyBtn = document.getElementById("motoboyBtn");
  var motoboyFileInput = document.getElementById("motoboyFileInput");

  // Lê o arquivo (xlsx/xls/csv), pega a primeira planilha e devolve o valor
  // da coluna A de cada linha (um número de chamado por linha), sem pular
  // nenhuma linha — se a planilha tiver um cabeçalho de texto na primeira
  // linha, ele entra como chamado também e o usuário remove manualmente.
  function lerNumerosDaPlanilha(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var dados = new Uint8Array(e.target.result);
          var workbook = XLSX.read(dados, { type: "array" });
          var primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
          var linhas = XLSX.utils.sheet_to_json(primeiraAba, { header: 1, defval: "" });
          var numeros = linhas
            .map(function (linha) { return linha[0]; })
            .map(function (valor) { return String(valor == null ? "" : valor).trim(); })
            .filter(function (valor) { return valor.length > 0; });
          resolve(numeros);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  motoboyBtn.addEventListener("click", function () {
    motoboyFileInput.click();
  });

  motoboyFileInput.addEventListener("change", async function () {
    var file = motoboyFileInput.files && motoboyFileInput.files[0];
    motoboyFileInput.value = "";
    if (!file) return;

    motoboyBtn.disabled = true;
    motoboyBtn.textContent = "Importando...";

    try {
      var numeros = await lerNumerosDaPlanilha(file);
      if (numeros.length === 0) {
        showToast("Nenhum chamado encontrado na planilha.");
        return;
      }

      var adicionados = 0;
      for (var i = 0; i < numeros.length; i++) {
        var inserted = await DB.addChamado(numeros[i]);
        if (inserted) {
          chamados.push(inserted);
          adicionados++;
        }
      }

      renderAll();
      showToast(adicionados === numeros.length
        ? adicionados + (adicionados === 1 ? " chamado importado." : " chamados importados.")
        : adicionados + " de " + numeros.length + " chamados importados.");
    } catch (err) {
      console.error("Falha ao importar planilha:", err);
      showToast("Não foi possível ler a planilha. Verifique o formato do arquivo.");
    } finally {
      motoboyBtn.disabled = false;
      motoboyBtn.textContent = "Motoboy";
    }
  });

  // ---------- Confirmação de remoção ----------
  var confirmModalOverlay = document.getElementById("confirmModalOverlay");
  var confirmModalText = document.getElementById("confirmModalText");
  var confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  var confirmCancelBtn = document.getElementById("confirmCancelBtn");
  var confirmModalClose = document.getElementById("confirmModalClose");
  var pendingConfirmAction = null;

  function openConfirmModal(mensagem, onConfirm) {
    confirmModalText.textContent = mensagem;
    pendingConfirmAction = onConfirm;
    confirmModalOverlay.classList.add("open");
  }

  function closeConfirmModal() {
    confirmModalOverlay.classList.remove("open");
    pendingConfirmAction = null;
  }

  confirmDeleteBtn.addEventListener("click", function () {
    var action = pendingConfirmAction;
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

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (confirmModalOverlay.classList.contains("open")) {
        closeConfirmModal();
      } else if (configModalOverlay.classList.contains("open")) {
        closeConfigModal();
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
    chamados = await DB.getChamados();
    renderAll();
  })();
})();
