/**
 * Projeto 2050 · Aviso ao Rivool OS
 * A cada envio gravado, o receptor manda ao OS a linha que mudou e as que ainda não chegaram lá (avisarOS, chamada pelo doPost do Código.gs).
 * O endereço do OS e o segredo ficam nas Propriedades do script (OS_URL e OS_SEGREDO), nunca aqui: o repositório é público.
 * Sem uma das duas, nada é enviado e o registro diz "OS não configurado". Para mandar de uma vez as linhas que já estavam na planilha, rode mandarTudo no editor.
 * A chamada ao OS nunca acontece com a trava do script presa: a trava só vale para ler as linhas e para escrever as anotações.
 * Cada linha recebe duas colunas: os_enviado_em (o atualizado_em que o OS recebeu) e os_erro (o motivo, quando o OS recusou).
 */

const OS_LOTE = 25;                  // linhas por chamada: o limite da rota do OS
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

// As linhas que o OS ainda não tem, na versão de agora: [{ id, versao, linha }]. A linha de idPrimeiro, se pendente, vai na frente.
function osPendentes(limite, idPrimeiro, esperaMs) {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(esperaMs)) return [];
  try {
    const aba = obterAba();
    const cab = garantirColunas(aba, ['os_enviado_em', 'os_erro']);
    const ultima = aba.getLastRow();
    // shortcut: lê a aba inteira a cada aviso; se passar de umas 20 mil linhas, guardar um índice das pendentes
    const linhas = ultima > 1 ? aba.getRange(2, 1, ultima - 1, cab.length).getValues() : [];
    const iId = cab.indexOf('id'), iCons = cab.indexOf('consentimento'), iEnv = cab.indexOf('os_enviado_em'), iAtu = cab.indexOf('atualizado_em');
    const pendentes = linhas
      .filter(function (r) { return r[iCons] === 'sim' && osDiferente(r[iEnv], r[iAtu]); })
      .map(function (r) {
        const linha = {};
        OS_CAMPOS.forEach(function (c) { const i = cab.indexOf(c); if (i >= 0) linha[c] = osTexto(r[i]); });
        return { id: String(r[iId]), versao: r[iAtu], linha: linha };
      });
    const primeiro = pendentes.findIndex(function (p) { return p.id === String(idPrimeiro); });
    if (primeiro > 0) pendentes.unshift(pendentes.splice(primeiro, 1)[0]);
    return pendentes.slice(0, limite);
  } finally {
    trava.releaseLock();
  }
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
    if (r && Array.isArray(r.gravadas) && Array.isArray(r.recusadas)) return r;
    console.log('OS respondeu ' + codigo + (codigo === 200 ? ' com corpo inesperado' : ''));
    return null;
  } catch (err) {
    console.log('OS fora do ar');
    return null;
  }
}

// Anota, achando cada linha pelo id, o que o OS recebeu. Sem a trava, não anota: as linhas vão de novo. Devolve { gravadas, recusadas } anotadas.
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
      const pos = ids.indexOf(it.id);
      if (pos < 0) return;
      // só estas duas células, para não atropelar o que um doPost gravou na linha
      aba.getRange(pos + 2, cab.indexOf('os_enviado_em') + 1).setValue(it.versao);
      aba.getRange(pos + 2, cab.indexOf('os_erro') + 1).setValue(gravada ? '' : motivos[it.id]);
      if (gravada) feito.gravadas++; else feito.recusadas++;
    });
    return feito;
  } finally {
    trava.releaseLock();
  }
}

// Um lote só. Nunca lança: o doPost responde como sempre, e a linha que não chegou vai no aviso seguinte.
function avisarOS(idPrimeiro) {
  try {
    const cfg = osConfig();
    if (!cfg) { console.log('OS não configurado'); return; }
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
