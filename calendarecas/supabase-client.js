// Cliente Supabase compartilhado por todas as páginas + lógica de "Lembrar de mim".
//
// Como funciona o "Lembrar de mim": o Supabase por padrão sempre guarda a sessão no
// localStorage (o que já "lembraria" o usuário para sempre). Para permitir que o
// usuário ESCOLHA isso na tela de login, usamos um "storage" customizado: se a opção
// estiver marcada, a sessão vai para o localStorage (sobrevive a fechar o navegador);
// se não estiver marcada, vai para o sessionStorage (é apagada quando a aba/janela
// fecha, exigindo login novamente).
(function () {
  "use strict";

  var REMEMBER_KEY = "estoqueCalendarioRemember";

  function getActiveStorage() {
    var remember = true;
    try {
      remember = localStorage.getItem(REMEMBER_KEY) !== "0";
    } catch (e) {
      remember = true;
    }
    return remember ? window.localStorage : window.sessionStorage;
  }

  var customStorage = {
    getItem: function (key) {
      try {
        return getActiveStorage().getItem(key);
      } catch (e) {
        return null;
      }
    },
    setItem: function (key, value) {
      try {
        getActiveStorage().setItem(key, value);
      } catch (e) {
        /* localStorage/sessionStorage indisponível — ignora */
      }
    },
    removeItem: function (key) {
      try {
        getActiveStorage().removeItem(key);
      } catch (e) {
        /* ignora */
      }
    }
  };

  function setRemember(value) {
    try {
      localStorage.setItem(REMEMBER_KEY, value ? "1" : "0");
    } catch (e) {
      /* ignora */
    }
  }

  var configured = window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY &&
    window.SUPABASE_URL.indexOf("COLOQUE_AQUI") !== 0;

  var client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: {
        storage: customStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  } else {
    console.error(
      "Supabase não configurado. Edite supabase-config.js com a URL e a anon key do seu projeto."
    );
  }

  async function getSession() {
    if (!client) return null;
    var result = await client.auth.getSession();
    return (result && result.data && result.data.session) || null;
  }

  // Usado nas páginas protegidas (home, pedidos, relatório, produtos): redireciona
  // para o login se não houver sessão válida, e só então revela a página (o
  // <html> começa com visibility:hidden para não "piscar" conteúdo protegido).
  async function requireSession() {
    var session = await getSession();
    if (!session) {
      window.location.href = "index.html";
      return null;
    }
    document.documentElement.style.visibility = "visible";
    return session;
  }

  // Usado na página de login: se o usuário já estiver logado, pula direto pro painel.
  async function redirectIfLoggedIn(targetUrl) {
    var session = await getSession();
    if (session) {
      window.location.href = targetUrl;
    } else {
      document.documentElement.style.visibility = "visible";
    }
  }

  window.AppAuth = {
    client: client,
    configured: configured,
    setRemember: setRemember,
    getSession: getSession,
    requireSession: requireSession,
    redirectIfLoggedIn: redirectIfLoggedIn
  };
})();
