// Um Apps Script de mentira para os testes: planilha com várias abas, correio com anexos, propriedades do script e utilitários.
// Os arquivos do receptor rodam aqui como rodam no Google: no mesmo escopo global, sem window, document nem atob.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');

exports.criar = function ({ receptor, pdf, pdfPrimeiro = true, propriedades = {}, ajuste = s => s }) {
  const correio = [], registro = [], abas = {}, props = Object.assign({}, propriedades);
  const novaAba = () => {
    const dados = [];
    const faixa = (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (dados[r - 1 + i] || [])[c - 1 + j] ?? '')),
      setValues(v) { v.forEach((lin, i) => { dados[r - 1 + i] = dados[r - 1 + i] || []; lin.forEach((x, j) => { dados[r - 1 + i][c - 1 + j] = x; }); }); return this; },
      setValue(v) { dados[r - 1] = dados[r - 1] || []; dados[r - 1][c - 1] = v; return this; },
      setFontWeight() { return this; }
    });
    return { dados, getLastRow: () => dados.length, getLastColumn: () => (dados[0] || []).length, appendRow: l => dados.push(l.slice()), setFrozenRows() {}, getRange: faixa };
  };
  const planilha = { getSheetByName: n => abas[n] || null, insertSheet: n => (abas[n] = novaAba()) };
  const ctx = {
    console: { log: m => registro.push('log: ' + m), error: e => registro.push('erro: ' + (e && e.stack || e)), warn() {}, info() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null), setProperty(k, v) { props[k] = String(v); return this; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) },
    Utilities: {
      formatDate(d, tz, f) { if (f !== 'dd/MM/yyyy') throw new Error('formato não simulado: ' + f); return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d); },
      base64Decode: b64 => Array.from(new Int8Array(Buffer.from(b64, 'base64'))),   // como no Apps Script: bytes com sinal
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, texto, cs) => Array.from(crypto.createHash(alg).update(texto, cs).digest(), b => (b > 127 ? b - 256 : b)),   // bytes com sinal
      newBlob: (bytes, tipo, nome) => ({ getBytes: () => bytes, getContentType: () => tipo, getName: () => nome })
    },
    MailApp: { sendEmail(a, b, c) {
      correio.push(typeof a === 'object'
        ? { para: a.to, assunto: a.subject, corpo: a.body, html: a.htmlBody || '', anexos: (a.attachments || []).map(x => ({ nome: x.getName(), tipo: x.getContentType(), buffer: Buffer.from(Int8Array.from(x.getBytes()).buffer) })) }
        : { para: a, assunto: b, corpo: c, html: '', anexos: [] });
    } }
  };
  vm.createContext(ctx);
  const arquivos = [];
  if (pdf) arquivos.push(['Pdf.gs', fs.readFileSync(pdf, 'utf8')]);
  arquivos.push(['Código.gs', ajuste(fs.readFileSync(receptor, 'utf8'))]);
  if (!pdfPrimeiro) arquivos.reverse();
  arquivos.forEach(([nome, fonte]) => vm.runInContext(fonte, ctx, { filename: nome }));
  return {
    ctx, abas, correio, registro, props,
    get dados() { return (abas.Leads || { dados: [] }).dados; },
    get erros() { return registro.filter(l => l.startsWith('erro: ')); },
    definirConfig(chave, valor) {
      const aba = abas.Config || planilha.insertSheet('Config');
      if (!aba.dados.length) aba.dados.push(['chave', 'valor', 'para que serve']);
      const l = aba.dados.find(x => x[0] === chave); if (l) l[1] = valor; else aba.dados.push([chave, valor, '']);
    },
    post: d => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(d) } }).t)
  };
};
