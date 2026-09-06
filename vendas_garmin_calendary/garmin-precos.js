(function () {
  "use strict";

  // Busca o preço oficial de cada produto no catálogo público da loja Garmin
  // Brasil (garminbrasil.com.br, uma loja Shopify). O endpoint /products.json
  // é público e libera CORS, então dá pra consultar direto do navegador sem
  // backend. O SKU retornado por variante bate com o padrão usado no nosso
  // catálogo (ex: "010-02935-03"), então o casamento é feito por SKU exato.
  var BASE_URL = "https://garminbrasil.com.br";
  var STORAGE_KEY = "estoqueCalendarioPrecosGarmin";
  var CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
  var PAGE_LIMIT = 250;
  var MAX_PAGES = 10;

  var cache = null; // { fetchedAt: number, bySku: { [sku]: { preco, titulo, handle } } }
  var fetchPromise = null;

  function normalizeSku(sku) {
    return String(sku || "").trim().toUpperCase();
  }

  function loadCacheFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCacheToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Falha ao salvar cache de preços da Garmin:", e);
    }
  }

  function isCacheFresh(data) {
    return !!data && !!data.bySku && (Date.now() - data.fetchedAt) < CACHE_TTL_MS;
  }

  async function fetchAllProducts() {
    var bySku = {};
    for (var page = 1; page <= MAX_PAGES; page++) {
      var res = await fetch(BASE_URL + "/products.json?limit=" + PAGE_LIMIT + "&page=" + page);
      if (!res.ok) break;
      var data = await res.json();
      var produtos = data.products || [];
      if (!produtos.length) break;

      produtos.forEach(function (produto) {
        (produto.variants || []).forEach(function (variant) {
          if (!variant.sku) return;
          bySku[normalizeSku(variant.sku)] = {
            preco: parseFloat(variant.price),
            titulo: produto.title,
            handle: produto.handle
          };
        });
      });

      if (produtos.length < PAGE_LIMIT) break;
    }
    return { fetchedAt: Date.now(), bySku: bySku };
  }

  function ensureLoaded(forceRefresh) {
    if (!forceRefresh && cache) return Promise.resolve(cache);

    if (!forceRefresh) {
      var stored = loadCacheFromStorage();
      if (isCacheFresh(stored)) {
        cache = stored;
        return Promise.resolve(cache);
      }
    }

    if (!fetchPromise) {
      fetchPromise = fetchAllProducts()
        .then(function (data) {
          cache = data;
          saveCacheToStorage(data);
          fetchPromise = null;
          return data;
        })
        .catch(function (e) {
          console.error("Falha ao buscar preços da Garmin Brasil:", e);
          fetchPromise = null;
          cache = cache || loadCacheFromStorage() || { fetchedAt: 0, bySku: {} };
          return cache;
        });
    }
    return fetchPromise;
  }

  function getPreco(sku) {
    if (!cache || !sku) return null;
    return cache.bySku[normalizeSku(sku)] || null;
  }

  function productUrl(handle) {
    return BASE_URL + "/products/" + handle;
  }

  window.GarminPrecos = {
    ensureLoaded: ensureLoaded,
    getPreco: getPreco,
    productUrl: productUrl
  };
})();
