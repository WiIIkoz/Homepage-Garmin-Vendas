// Funções de acesso ao banco de dados no Supabase, usadas por app.js (Pedidos),
// produtos.js e relatorio.js. Mantém a mesma "forma" de dados que o restante do
// código já esperava quando tudo vivia no localStorage, para que o resto da
// aplicação mudasse o mínimo possível.
(function () {
  "use strict";

  function client() {
    return window.AppAuth && window.AppAuth.client;
  }

  // ---------- Vendas (itens vendidos em cada dia do calendário) ----------

  // Retorna um objeto no formato { "2026-08-24": [ {id, descricao, sku, ...}, ... ], ... }
  async function getVendas() {
    var db = client();
    if (!db) return {};

    var result = await db.from("vendas").select("*").order("created_at", { ascending: true });
    if (result.error) {
      console.error("Falha ao carregar vendas:", result.error);
      return {};
    }

    var grouped = {};
    (result.data || []).forEach(function (row) {
      if (!grouped[row.data]) grouped[row.data] = [];
      grouped[row.data].push({
        id: row.id,
        descricao: row.descricao,
        sku: row.sku,
        vendedor: row.vendedor,
        nfe: row.nfe,
        quantidade: row.quantidade,
        valor: row.valor
      });
    });
    return grouped;
  }

  // Insere uma venda no dia informado (dateKey no formato "AAAA-MM-DD").
  // Retorna o item já com o "id" gerado pelo banco, ou null se falhar.
  async function addVenda(dateKey, item) {
    var db = client();
    if (!db) return null;

    var result = await db.from("vendas").insert({
      data: dateKey,
      descricao: item.descricao,
      sku: item.sku,
      vendedor: item.vendedor,
      nfe: item.nfe,
      quantidade: item.quantidade,
      valor: item.valor
    }).select().single();

    if (result.error) {
      console.error("Falha ao salvar venda:", result.error);
      return null;
    }

    return {
      id: result.data.id,
      descricao: result.data.descricao,
      sku: result.data.sku,
      vendedor: result.data.vendedor,
      nfe: result.data.nfe,
      quantidade: result.data.quantidade,
      valor: result.data.valor
    };
  }

  // Atualiza uma venda já existente (edição de um item já lançado no dia).
  // Retorna o item atualizado, ou null se falhar.
  async function updateVenda(id, item) {
    var db = client();
    if (!db) return null;

    var result = await db.from("vendas").update({
      descricao: item.descricao,
      sku: item.sku,
      vendedor: item.vendedor,
      nfe: item.nfe,
      quantidade: item.quantidade,
      valor: item.valor
    }).eq("id", id).select().single();

    if (result.error) {
      console.error("Falha ao atualizar venda:", result.error);
      return null;
    }

    return {
      id: result.data.id,
      descricao: result.data.descricao,
      sku: result.data.sku,
      vendedor: result.data.vendedor,
      nfe: result.data.nfe,
      quantidade: result.data.quantidade,
      valor: result.data.valor
    };
  }

  async function deleteVenda(id) {
    var db = client();
    if (!db) return false;

    var result = await db.from("vendas").delete().eq("id", id);
    if (result.error) {
      console.error("Falha ao excluir venda:", result.error);
      return false;
    }
    return true;
  }

  // ---------- Produtos (banco de produtos: catálogo Garmin + itens adicionados) ----------

  async function getProdutos() {
    var db = client();
    if (!db) return [];

    var result = await db.from("produtos").select("*").order("created_at", { ascending: true });
    if (result.error) {
      console.error("Falha ao carregar produtos:", result.error);
      return [];
    }
    return result.data || [];
  }

  async function addProduto(produto) {
    var db = client();
    if (!db) return null;

    var result = await db.from("produtos").insert({
      barcode: produto.barcode,
      sku: produto.sku,
      descricao: produto.descricao,
      valor: produto.valor,
      foto: produto.foto,
      origem: produto.origem || "manual"
    }).select().single();

    if (result.error) {
      console.error("Falha ao salvar produto:", result.error);
      return null;
    }
    return result.data;
  }

  async function deleteProduto(id) {
    var db = client();
    if (!db) return false;

    var result = await db.from("produtos").delete().eq("id", id);
    if (result.error) {
      console.error("Falha ao excluir produto:", result.error);
      return false;
    }
    return true;
  }

  // ---------- Chamados de assistência técnica (página Rc Tech) ----------
  // status vai passando por: "aberto" -> "enviado" -> "disponivel", conforme
  // o chamado avança pelas 3 seções da página.

  async function getChamados() {
    var db = client();
    if (!db) return [];

    var result = await db.from("chamados_assistencia").select("*").order("created_at", { ascending: true });
    if (result.error) {
      console.error("Falha ao carregar chamados:", result.error);
      return [];
    }
    return result.data || [];
  }

  async function addChamado(numero) {
    var db = client();
    if (!db) return null;

    var result = await db.from("chamados_assistencia").insert({
      numero: numero,
      status: "aberto"
    }).select().single();

    if (result.error) {
      console.error("Falha ao salvar chamado:", result.error);
      return null;
    }
    return result.data;
  }

  // "fields" é um objeto parcial (ex: { status: "enviado", data_envio: "..." })
  // com só os campos que mudaram nessa transição do chamado.
  async function updateChamado(id, fields) {
    var db = client();
    if (!db) return null;

    var result = await db.from("chamados_assistencia").update(fields).eq("id", id).select().single();
    if (result.error) {
      console.error("Falha ao atualizar chamado:", result.error);
      return null;
    }
    return result.data;
  }

  async function deleteChamado(id) {
    var db = client();
    if (!db) return false;

    var result = await db.from("chamados_assistencia").delete().eq("id", id);
    if (result.error) {
      console.error("Falha ao excluir chamado:", result.error);
      return false;
    }
    return true;
  }

  window.DB = {
    getVendas: getVendas,
    addVenda: addVenda,
    updateVenda: updateVenda,
    deleteVenda: deleteVenda,
    getProdutos: getProdutos,
    addProduto: addProduto,
    deleteProduto: deleteProduto,
    getChamados: getChamados,
    addChamado: addChamado,
    updateChamado: updateChamado,
    deleteChamado: deleteChamado
  };
})();
