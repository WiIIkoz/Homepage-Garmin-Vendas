(function () {
  "use strict";

  AppAuth.redirectIfLoggedIn("home.html");

  var form = document.getElementById("loginForm");
  var emailField = document.getElementById("fieldEmail");
  var passwordField = document.getElementById("fieldPassword");
  var rememberField = document.getElementById("fieldRemember");
  var errorEl = document.getElementById("loginError");
  var submitBtn = document.getElementById("loginSubmitBtn");

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorEl.hidden = true;

    if (!AppAuth.configured) {
      showError("O sistema ainda não foi conectado ao banco de dados (Supabase). Configure supabase-config.js.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Entrando...";

    AppAuth.setRemember(rememberField.checked);

    var result = await AppAuth.client.auth.signInWithPassword({
      email: emailField.value.trim(),
      password: passwordField.value
    });

    if (result.error) {
      showError("E-mail ou senha inválidos.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Entrar";
      return;
    }

    window.location.href = "home.html";
  });
})();
