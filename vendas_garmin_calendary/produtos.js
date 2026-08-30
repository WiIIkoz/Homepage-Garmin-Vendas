(function () {
  "use strict";

  // O banco de produtos (catálogo da Garmin + itens adicionados manualmente) agora
  // vive no Supabase, na tabela "produtos". O catálogo inicial da Garmin foi
  // carregado direto no banco via SQL (fotos casadas pelo SKU exato de cada
  // produto), então esta página só precisa ler e escrever na tabela.
  var produtos = [];

  // ---------- Elements ----------
  var gridEl = document.getElementById("produtosGrid");
  var emptyStateEl = document.getElementById("produtosEmptyState");
  var statusHintEl = document.getElementById("produtosStatusHint");
  var searchInput = document.getElementById("barcodeSearch");

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function renderProdutos() {
    var query = searchInput.value.trim().toLowerCase();
    var filtered = produtos.filter(function (p) {
      if (!query) return true;
      return (p.barcode || "").toLowerCase().indexOf(query) !== -1;
    });

    gridEl.innerHTML = "";
    emptyStateEl.hidden = filtered.length > 0;

    filtered.forEach(function (produto) {
      var card = document.createElement("div");
      card.className = "produto-card";

      var thumbWrap = document.createElement("div");
      thumbWrap.className = "produto-thumb";
      if (produto.foto) {
        var img = document.createElement("img");
        img.src = produto.foto;
        img.alt = produto.descricao || "";
        img.onerror = function () {
          thumbWrap.innerHTML = "<span class=\"produto-thumb-fallback\">Sem foto</span>";
        };
        thumbWrap.appendChild(img);
      } else {
        thumbWrap.innerHTML = "<span class=\"produto-thumb-fallback\">Sem foto</span>";
      }

      var infoWrap = document.createElement("div");
      infoWrap.className = "produto-info";
      infoWrap.innerHTML =
        "<span class=\"produto-descricao\">" + escapeHtml(produto.descricao) + "</span>" +
        "<span class=\"produto-meta\">SKU: " + escapeHtml(produto.sku) + "</span>" +
        "<span class=\"produto-meta\">Cód. barras: " + escapeHtml(produto.barcode || "—") + "</span>";

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-item-btn produto-remove-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = "Remover produto";
      removeBtn.addEventListener("click", function () {
        openConfirmModal(async function () {
          await DB.deleteProduto(produto.id);
          produtos = produtos.filter(function (p) { return p.id !== produto.id; });
          renderProdutos();
        });
      });

      card.appendChild(thumbWrap);
      card.appendChild(infoWrap);
      card.appendChild(removeBtn);
      gridEl.appendChild(card);
    });
  }

  searchInput.addEventListener("input", renderProdutos);

  // ---------- Toast ----------
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

  // ---------- Add product modal ----------
  var produtoModalOverlay = document.getElementById("produtoModalOverlay");
  var produtoModalClose = document.getElementById("produtoModalClose");
  var addProdutoBtn = document.getElementById("addProdutoBtn");
  var produtoForm = document.getElementById("produtoForm");
  var saveProdutoBtn = document.getElementById("saveProdutoBtn");
  var produtoFormHint = document.getElementById("produtoFormHint");

  var fieldBarcode = document.getElementById("fieldBarcode");
  var fieldProdutoSku = document.getElementById("fieldProdutoSku");
  var fieldProdutoDescricao = document.getElementById("fieldProdutoDescricao");
  var fieldProdutoFoto = document.getElementById("fieldProdutoFoto");
  var photoPreviewEl = document.getElementById("photoPreview");

  var selectedPhotoDataUrl = null;

  function clearProdutoForm() {
    fieldBarcode.value = "";
    fieldProdutoSku.value = "";
    fieldProdutoDescricao.value = "";
    fieldProdutoFoto.value = "";
    selectedPhotoDataUrl = null;
    photoPreviewEl.innerHTML =
      "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><circle cx=\"9\" cy=\"11\" r=\"2\"/><path d=\"M21 16l-5-5-4 4-3-3-4 4\"/></svg>";
    updateProdutoSaveState();
  }

  function updateProdutoSaveState() {
    var allFilled = fieldBarcode.value.trim().length > 0 &&
      fieldProdutoSku.value.trim().length > 0 &&
      fieldProdutoDescricao.value.trim().length > 0 &&
      !!selectedPhotoDataUrl;
    saveProdutoBtn.disabled = !allFilled;
    produtoFormHint.textContent = allFilled
      ? "Todos os campos preenchidos. Pronto para salvar."
      : "Preencha todos os campos para poder salvar o item.";
  }

  [fieldBarcode, fieldProdutoSku, fieldProdutoDescricao].forEach(function (f) {
    f.addEventListener("input", updateProdutoSaveState);
  });

  fieldProdutoFoto.addEventListener("change", function () {
    var file = fieldProdutoFoto.files && fieldProdutoFoto.files[0];
    if (!file) {
      selectedPhotoDataUrl = null;
      updateProdutoSaveState();
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      selectedPhotoDataUrl = e.target.result;
      photoPreviewEl.innerHTML = "";
      var img = document.createElement("img");
      img.src = selectedPhotoDataUrl;
      photoPreviewEl.appendChild(img);
      updateProdutoSaveState();
    };
    reader.readAsDataURL(file);
  });

  function openProdutoModal() {
    clearProdutoForm();
    produtoModalOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
    fieldBarcode.focus();
  }

  function closeProdutoModal() {
    produtoModalOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  addProdutoBtn.addEventListener("click", openProdutoModal);
  produtoModalClose.addEventListener("click", closeProdutoModal);
  produtoModalOverlay.addEventListener("click", function (e) {
    if (e.target === produtoModalOverlay) closeProdutoModal();
  });

  produtoForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    var barcode = fieldBarcode.value.trim();
    var sku = fieldProdutoSku.value.trim();
    var descricao = fieldProdutoDescricao.value.trim();

    if (!barcode || !sku || !descricao || !selectedPhotoDataUrl) return;

    saveProdutoBtn.disabled = true;
    var inserted = await DB.addProduto({
      barcode: barcode,
      sku: sku,
      descricao: descricao,
      foto: selectedPhotoDataUrl,
      origem: "manual"
    });
    saveProdutoBtn.disabled = false;

    if (!inserted) {
      produtoFormHint.textContent = "Não foi possível salvar o produto. Tente novamente.";
      return;
    }

    produtos.push(inserted);
    renderProdutos();
    closeProdutoModal();
    showToast("Item Adicionado com sucesso");
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

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (confirmModalOverlay.classList.contains("open")) {
        closeConfirmModal();
      } else if (produtoModalOverlay.classList.contains("open")) {
        closeProdutoModal();
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
    statusHintEl.textContent = "Carregando produtos...";
    produtos = await DB.getProdutos();
    statusHintEl.textContent = produtos.length
      ? "Pesquise por código de barras ou adicione um novo produto."
      : "Nenhum produto no banco ainda. Adicione o primeiro pelo botão \"+\".";
    renderProdutos();
  })();
})();
