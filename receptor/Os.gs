/**
 * Projeto 2050 · Aviso ao Rivool OS
 * A cada envio gravado, o receptor manda ao OS a linha que mudou e as que ainda não chegaram lá (avisarOS, chamada pelo doPost do Código.gs).
 * O endereço do OS e o segredo ficam nas Propriedades do script (OS_URL e OS_SEGREDO), nunca aqui: o repositório é público.
 * Sem uma das duas, nada é enviado e o registro diz "OS não configurado". Para mandar de uma vez as linhas que já estavam na planilha, rode mandarTudo no editor.
 * A chamada ao OS nunca acontece com a trava do script presa: a trava só vale para ler as linhas e para escrever as anotações.
 * Cada linha recebe duas colunas: os_enviado_em (o atualizado_em que o OS recebeu) e os_erro (o motivo, quando o OS recusou, ou "grande demais" e "id repetido", quando a linha nem foi).
 * Depois de uma falha, o aviso fica em pausa por OS_PAUSA_S segundos (CacheService); mandarTudo ignora a pausa.
 */

const OS_LOTE = 25;                  // linhas por chamada: o limite da rota do OS
const OS_BYTES_MAX = 200 * 1024;     // corpo por chamada: o OS recusa acima de 256 KB, aqui fica a folga
const OS_PAUSA_S = 120;              // depois de uma falha, o aviso espera isto (o OS lento ou fora do ar não segura o doPost)
const OS_TEMPO_MAX_MS = 4 * 60 * 1000;   // mandarTudo para de começar lote novo depois disso
const OS_TRAVA_MS = 3000;            // quanto o doPost espera pela trava antes de desistir
const OS_CAMPOS = [
  'id', 'nome', 'email', 'whatsapp', 'consentimento', 'consentimento_texto', 'interesse_jovem', 'interesse_consultoria', 'baixou_pdf',
  'estado_brasil', 'custo_mensal_brl', 'destino', 'estado_eua', 'idade', 'idade_renda', 'investido_brl', 'pct_dolar', 'aporte_brl',
  'vida_global_usd', 'vida_global_brl', 'ritmo_pct', 'aporte_extra_brl', 'vida_global_brasil_usd', 'patrimonio_faixa', 'consultoria_mensagem',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'indicado_por', 'referrer', 'dispositivo', 'instagram_app',
  'criado_em', 'atualizado_em', 'email_enviado'
];

function osConfig() {
  const url = propriedade('OS_URL', ''), segredo = propriedade('OS_SEGREDO', '');
  return url && segredo && /^https:\/\//.test(url) ? { url: url, segredo: segredo } : null;
}

function osData(v) { return !!v && typeof v.getTime === 'function'; }

// Data em ISO, todo o resto como texto, vazio como "".
function osTexto(v) {
  if (osData(v)) return isNaN(v.getTime()) ? '' : v.toISOString();
  return v === undefined || v === null ? '' : String(v);
}

function osDiferente(a, b) {
  return osData(a) && osData(b) ? a.getTime() !== b.getTime() : String(a) !== String(b);
}

function osMaisNova(a, b) { return osData(a) && osData(b) ? a.getTime() > b.getTime() : String(a) > String(b); }

// Tamanho em bytes (UTF-8) de um texto. Se encodeURIComponent lançar (caractere partido ao meio), vale o pior caso, três bytes por caractere.
function osBytes(s) { try { return encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, 'x').length; } catch (e) { return s.length * 3; } }

// As duas colunas do OS de uma linha da aba: de uma vez só quando são vizinhas (é o normal).
function osEscrever(aba, cab, linha, versao, erro) {
  const a = cab.indexOf('os_enviado_em') + 1, b = cab.indexOf('os_erro') + 1;
  if (b === a + 1) { aba.getRange(linha, a, 1, 2).setValues([[versao, erro]]); return; }
  aba.getRange(linha, a).setValue(versao);
  aba.getRange(linha, b).setValue(erro);
}

// As linhas que o OS ainda não tem, na versão de agora, até fechar o lote por quantidade ou por bytes: [{ id, versao, linha, pos }].
// A linha de idPrimeiro, se pendente, vai na frente. Linha grande demais ou com id repetido é anotada aqui mesmo e não entra no lote.
function osPendentes(limite, idPrimeiro, esperaMs) {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(esperaMs)) return [];
  try {
    const aba = obterAba();
    const cab = garantirColunas(aba, ['os_enviado_em', 'os_erro']);
    const ultima = aba.getLastRow();
    if (ultima < 2) return [];
    // shortcut: quatro colunas inteiras lidas a cada aviso; se passar de umas 50 mil linhas, guardar um índice das pendentes
    const coluna = function (nome) { return aba.getRange(2, cab.indexOf(nome) + 1, ultima - 1, 1).getValues().map(function (x) { return x[0]; }); };
    const ids = coluna('id'), cons = coluna('consentimento'), atu = coluna('atualizado_em'), env = coluna('os_enviado_em');
    let cand = [];
    ids.forEach(function (_, i) { if (cons[i] === 'sim' && osDiferente(env[i], atu[i])) cand.push(i); });
    // id repetido: fica a linha mais nova, as outras são anotadas
    const melhor = {};
    cand.forEach(function (i) { const id = String(ids[i]); if (melhor[id] === undefined || osMaisNova(atu[i], atu[melhor[id]])) melhor[id] = i; });
    cand.forEach(function (i) { if (melhor[String(ids[i])] !== i) osEscrever(aba, cab, i + 2, atu[i], 'id repetido'); });
    cand = cand.filter(function (i) { return melhor[String(ids[i])] === i; });
    const primeiro = cand.findIndex(function (i) { return String(ids[i]) === String(idPrimeiro); });
    if (primeiro > 0) cand.unshift(cand.splice(primeiro, 1)[0]);

    const itens = [];
    let bytes = 0;
    for (let k = 0; k < cand.length && itens.length < limite; k++) {
      const i = cand[k], pos = i + 2;
      const r = aba.getRange(pos, 1, 1, cab.length).getValues()[0];
      // a edição à mão na planilha não respeita a trava: se a linha desta posição já é outra, ou perdeu o aceite, não vai
      if (String(r[cab.indexOf('id')]) !== String(ids[i]) || r[cab.indexOf('consentimento')] !== 'sim') continue;
      const linha = {};
      OS_CAMPOS.forEach(function (c) { const x = cab.indexOf(c); if (x >= 0) linha[c] = osTexto(r[x]); });
      const tam = osBytes(JSON.stringify(linha));
      if (tam > OS_BYTES_MAX) { osEscrever(aba, cab, pos, atu[i], 'grande demais'); continue; }
      if (bytes + tam > OS_BYTES_MAX) break;
      bytes += tam;
      itens.push({ id: String(ids[i]), versao: atu[i], linha: linha, pos: pos });
    }
    SpreadsheetApp.flush();
    return itens;
  } finally {
    trava.releaseLock();
  }
}

// Liga ou desliga a pausa do aviso. Nunca lança: sem o cache, o aviso só perde a pausa.
function osPausa(ligar) {
  try {
    const cache = CacheService.getScriptCache();
    if (ligar) cache.put('os_pausa', '1', OS_PAUSA_S); else cache.remove('os_pausa');
  } catch (err) {}
}

// Manda o lote. Devolve { gravadas, recusadas } ou null em qualquer falha. Nunca lança e nunca registra dado de ninguém.
function osEnviar(cfg, itens) {
  try {
    const resp = UrlFetchApp.fetch(cfg.url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + cfg.segredo },
      payload: JSON.stringify({ linhas: itens.map(function (i) { return i.linha; }) }),
      muteHttpExceptions: true
    });
    const codigo = resp.getResponseCode();
    let r = null;
    if (codigo === 200) {
      try { r = JSON.parse(resp.getContentText()); } catch (e) { r = null; }
    }
    if (r && Array.isArray(r.gravadas) && Array.isArray(r.recusadas)) { osPausa(false); return r; }
    console.log('OS respondeu ' + codigo + (codigo === 200 ? ' com corpo inesperado' : ''));
    osPausa(true);
    return null;
  } catch (err) {
    console.log('OS fora do ar');
    osPausa(true);
    return null;
  }
}

// Anota o que o OS recebeu, na posição do item se o id ainda estiver lá, senão procurando pelo id. Sem a trava, não anota: as linhas vão de novo. Devolve { gravadas, recusadas } anotadas.
function osAnotar(itens, r, esperaMs) {
  const feito = { gravadas: 0, recusadas: 0 };
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(esperaMs)) return feito;
  try {
    const aba = obterAba();
    const cab = garantirColunas(aba, ['os_enviado_em', 'os_erro']);
    const ultima = aba.getLastRow();
    const ids = ultima > 1 ? aba.getRange(2, cab.indexOf('id') + 1, ultima - 1, 1).getValues().map(function (x) { return String(x[0]); }) : [];
    const motivos = {};
    r.recusadas.forEach(function (x) { if (x && x.id !== undefined) motivos[String(x.id)] = String(limpar(String((x && x.motivo) || 'recusada')).slice(0, 60)); });
    const gravadas = r.gravadas.map(String);
    itens.forEach(function (it) {
      const gravada = gravadas.indexOf(it.id) >= 0;
      if (!gravada && !Object.prototype.hasOwnProperty.call(motivos, it.id)) return;
      const pos = ids[it.pos - 2] === it.id ? it.pos - 2 : ids.indexOf(it.id);
      if (pos < 0) return;
      // só estas duas células, para não atropelar o que um doPost gravou na linha
      osEscrever(aba, cab, pos + 2, it.versao, gravada ? '' : motivos[it.id]);
      if (gravada) feito.gravadas++; else feito.recusadas++;
    });
    SpreadsheetApp.flush();
    return feito;
  } finally {
    trava.releaseLock();
  }
}

// Um lote só (ou nenhum, em pausa). Nunca lança: o doPost responde como sempre, e a linha que não chegou vai no aviso seguinte.
function avisarOS(idPrimeiro) {
  try {
    const cfg = osConfig();
    if (!cfg) { console.log('OS não configurado'); return; }
    if (CacheService.getScriptCache().get('os_pausa')) return;   // falhou há pouco: as linhas vão no aviso seguinte
    const itens = osPendentes(OS_LOTE, idPrimeiro, OS_TRAVA_MS);
    if (!itens.length) return;
    const r = osEnviar(cfg, itens);
    if (r) osAnotar(itens, r, OS_TRAVA_MS);
  } catch (err) {
    console.error(err);
  }
}

// Para rodar à mão no editor: manda lote atrás de lote até acabar, falhar ou passar de 4 minutos. Se sobrar, rode de novo.
function mandarTudo() {
  const cfg = osConfig();
  if (!cfg) { console.log('OS não configurado'); return; }
  const inicio = Date.now();
  let enviadas = 0, recusadas = 0, sobrou = false;
  for (;;) {
    const itens = osPendentes(OS_LOTE, null, 15000);
    if (!itens.length) break;
    if (Date.now() - inicio > OS_TEMPO_MAX_MS) { sobrou = true; break; }
    const r = osEnviar(cfg, itens);
    const feito = r ? osAnotar(itens, r, 15000) : null;
    if (!feito || feito.gravadas + feito.recusadas === 0) { sobrou = true; break; }   // falha de envio, ou lote que não anotou nada: não girar em falso
    enviadas += feito.gravadas;
    recusadas += feito.recusadas;
  }
  console.log('OS: ' + enviadas + ' linhas enviadas, ' + recusadas + ' recusadas' + (sobrou ? ', ainda há pendentes: rode de novo' : ''));
}
