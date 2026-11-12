/**
 * Monta o receptor/Pdf.gs: o arquivo que deixa o receptor desenhar, no Apps Script, o mesmo relatório em PDF
 * que a página desenha no navegador. O Pdf.gs é gerado; não se edita à mão.
 *
 * Junta, nesta ordem:
 *   1. um ambiente mínimo para o jsPDF rodar fora do navegador (o objeto global e o base64);
 *   2. a biblioteca jsPDF, na versão que a página carrega (endereço e sha384 lidos do index.html);
 *   3. as fontes e o avatar (pdf-fontes.js);
 *   4. o desenho do relatório, copiado do index.html (entre PDF-INICIO e PDF-FIM).
 *
 * Uso:  node receptor/ferramentas/montar-pdf.js [caminho/para/jspdf.umd.min.js]
 * Sem o caminho, a biblioteca é baixada do endereço que está no index.html. Com ou sem ele, o sha384 é conferido.
 * Rode de novo sempre que o desenho do PDF, as fontes ou a versão do jsPDF mudarem na página, e mande o Pdf.gs no mesmo PR.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const repo = path.join(__dirname, '..', '..'), saida = path.join(__dirname, '..', 'Pdf.gs');

(async () => {
  const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
  const endereco = (html.match(/sc\.src = "(https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[^"]+)"/) || [])[1];
  const esperado = (html.match(/sc\.integrity = "sha384-([^"]+)"/) || [])[1];
  if (!endereco || !esperado) throw new Error('Não achei no index.html o endereço e o sha384 do jsPDF.');
  const lib = process.argv[2] ? fs.readFileSync(process.argv[2]) : Buffer.from(await (await fetch(endereco)).arrayBuffer());
  const obtido = crypto.createHash('sha384').update(lib).digest('base64');
  if (obtido !== esperado) throw new Error('O jsPDF obtido não é o que a página carrega (sha384 diferente).');
  const versao = (lib.toString('utf8').match(/Version ([\d.]+)/) || [])[1] || '?';

  const ini = html.indexOf('/* PDF-INICIO */'), fim = html.indexOf('/* PDF-FIM */');
  if (ini < 0 || fim < ini) throw new Error('Não achei PDF-INICIO e PDF-FIM no index.html.');
  const desenho = html.slice(ini, fim + '/* PDF-FIM */'.length).replace(/window\.PDF_AVATAR/g, 'PDF_AVATAR');

  let fontes = fs.readFileSync(path.join(repo, 'pdf-fontes.js'), 'utf8');
  if (fontes.indexOf('window.PDF_AVATAR =') < 0 || fontes.indexOf('window.registrarFontesPDF = function(doc){') < 0) throw new Error('O pdf-fontes.js mudou de forma; ajuste este montador.');
  fontes = fontes.replace('window.PDF_AVATAR =', 'var PDF_AVATAR =').replace('window.registrarFontesPDF = function(doc){', 'function registrarFontesPDF(doc){');

  const ambiente = `/* Ambiente mínimo para o jsPDF rodar no Apps Script, que não é um navegador: o objeto global e o base64. */
var global = this;
var B64_ALFABETO_ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var B64_MAPA_ = (function () { var m = {}; for (var i = 0; i < 64; i++) m[B64_ALFABETO_.charAt(i)] = i; return m; })();
function atob(texto) {
  var s = String(texto).replace(/[^A-Za-z0-9+/]/g, ''), n = s.length, partes = [], bloco = '';
  for (var i = 0; i < n; i += 4) {
    var a = B64_MAPA_[s.charAt(i)], b = B64_MAPA_[s.charAt(i + 1)] || 0, c = B64_MAPA_[s.charAt(i + 2)], d = B64_MAPA_[s.charAt(i + 3)];
    bloco += String.fromCharCode((a << 2) | (b >> 4));
    if (i + 2 < n) bloco += String.fromCharCode(((b & 15) << 4) | ((c || 0) >> 2));
    if (i + 3 < n) bloco += String.fromCharCode((((c || 0) & 3) << 6) | (d || 0));
    if (bloco.length > 8192) { partes.push(bloco); bloco = ''; }
  }
  partes.push(bloco);
  return partes.join('');
}
function btoa(texto) {
  var s = String(texto), n = s.length, partes = [], bloco = '';
  for (var i = 0; i < n; i += 3) {
    var a = s.charCodeAt(i) & 255, b = i + 1 < n ? s.charCodeAt(i + 1) & 255 : 0, c = i + 2 < n ? s.charCodeAt(i + 2) & 255 : 0;
    bloco += B64_ALFABETO_.charAt(a >> 2) + B64_ALFABETO_.charAt(((a & 3) << 4) | (b >> 4)) + (i + 1 < n ? B64_ALFABETO_.charAt(((b & 15) << 2) | (c >> 6)) : '=') + (i + 2 < n ? B64_ALFABETO_.charAt(c & 63) : '=');
    if (bloco.length > 8192) { partes.push(bloco); bloco = ''; }
  }
  partes.push(bloco);
  return partes.join('');
}
`;
  const cabecalho = `/**
 * Projeto 2050 · Relatório em PDF dentro do receptor de leads.
 * ARQUIVO GERADO por receptor/ferramentas/montar-pdf.js. Não edite à mão: mude a página e rode o montador de novo.
 * Conteúdo: ambiente mínimo, jsPDF ${versao} (sha384-${obtido}), fontes e avatar (pdf-fontes.js) e o desenho do relatório (index.html).
 * Quem usa: gerarPdfDoPlano(), no Código.gs.
 */
`;
  const texto = cabecalho + ambiente + '\n/* ===== jsPDF ' + versao + ' ===== */\n' + lib.toString('utf8') + '\n\n/* ===== fontes e avatar ===== */\n' + fontes + '\n\n/* ===== desenho do relatório (cópia do index.html) ===== */\n' + desenho + '\n';
  const antes = fs.existsSync(saida) ? fs.readFileSync(saida, 'utf8') : '';
  fs.writeFileSync(saida, texto);
  console.log('receptor/Pdf.gs ' + (antes === texto ? 'já estava em dia' : 'atualizado') + ': ' + texto.length + ' caracteres · jsPDF ' + versao + ' · desenho com ' + desenho.split('\n').length + ' linhas');
})().catch(e => { console.error(e.message); process.exit(1); });
