(function () {
  "use strict";

  AppAuth.requireSession();

  var USER_NAME = "William";

  // ---------- Greeting ----------
  var greetingEl = document.getElementById("homeGreeting");
  var hour = new Date().getHours();
  var greetingWord = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  greetingEl.textContent = greetingWord + ", " + USER_NAME + ".";

  // ---------- Tile navigation ----------
  document.getElementById("tileProdutos").addEventListener("click", function () {
    window.location.href = "produtos.html";
  });
  document.getElementById("tilePedidos").addEventListener("click", function () {
    window.location.href = "pedidos.html";
  });
  document.getElementById("tileRelatorio").addEventListener("click", function () {
    window.location.href = "relatorio.html";
  });
  // O botão trancado intencionalmente não tem ação ainda.

  // ---------- Config modal & dark mode ----------
  var THEME_STORAGE_KEY = "estoqueCalendarioTheme";
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

  configModalClose.addEventListener("click", closeConfigModal);
  configModalOverlay.addEventListener("click", function (e) {
    if (e.target === configModalOverlay) closeConfigModal();
  });

  document.getElementById("headerConfigBtn").addEventListener("click", openConfigModal);

  // ---------- Profile popover (Configurações / Sair) ----------
  var profileMenuBtn = document.getElementById("profileMenuBtn");
  var profilePopover = document.getElementById("profilePopover");
  var profileConfigBtn = document.getElementById("profileConfigBtn");
  var profileLogoutBtn = document.getElementById("profileLogoutBtn");

  function openProfilePopover() {
    profilePopover.classList.add("open");
    profileMenuBtn.setAttribute("aria-expanded", "true");
  }

  function closeProfilePopover() {
    profilePopover.classList.remove("open");
    profileMenuBtn.setAttribute("aria-expanded", "false");
  }

  profileMenuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (profilePopover.classList.contains("open")) {
      closeProfilePopover();
    } else {
      openProfilePopover();
    }
  });

  document.addEventListener("click", function (e) {
    if (!profilePopover.contains(e.target) && e.target !== profileMenuBtn) {
      closeProfilePopover();
    }
  });

  profileConfigBtn.addEventListener("click", function () {
    closeProfilePopover();
    openConfigModal();
  });

  profileLogoutBtn.addEventListener("click", async function () {
    closeProfilePopover();
    await AppAuth.client.auth.signOut();
    window.location.href = "index.html";
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
      if (configModalOverlay.classList.contains("open")) {
        closeConfigModal();
      } else if (profilePopover.classList.contains("open")) {
        closeProfilePopover();
      } else if (drawer.classList.contains("open")) {
        closeDrawer();
      }
    }
  });
})();
