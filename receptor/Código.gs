/**
 * Projeto 2050 · Receptor de leads do simulador "Descubra a sua vida global"
 * A fonte deste arquivo é a pasta receptor/ do repositório projeto2050-site: mude por PR, e o merge na main publica sozinho (veja receptor/LEIA-ME.md).
 * Cada pessoa vira uma linha na aba "Leads". Se ela voltar (lista de espera e depois simulação), a mesma linha é atualizada.
 */

// ===== CONFIGURAÇÃO =====
const ABA = 'Leads';
const ENVIAR_RESULTADO = true;   // envia ao lead o plano por e-mail. Deixe igual a ENVIA_EMAIL na página.
// Quem recebe um aviso a cada contato novo, a cada plano pedido e a cada aplicação para a Consultoria Global:
// os endereços ficam nas Propriedades do script (Configurações do projeto → Propriedades do script), na chave AVISAR_EMAIL,
// separados por vírgula. Sem a propriedade, o aviso fica desligado. O repositório é público: endereço de e-mail não entra no código.
const SITE_URL = 'https://www.projeto2050.com/';   // link do botão "Conheça o Projeto 2050" no e-mail do plano (vazio = sem botão)
// Contas Gmail gratuitas enviam até 100 e-mails por dia pelo Apps Script; Google Workspace, 1.500.
// Cada pessoa nova gasta 1 envio do plano e mais 1 para cada endereço da propriedade AVISAR_EMAIL.

// Botão "Agendar reunião com especialista" do e-mail do plano. O link fica na aba "Config" da planilha, na linha agenda_url:
// pode ser a página de agendamento (Google Agenda, Calendly) ou um link de WhatsApp (https://wa.me/55DDDNUMERO).
// Trocar o link é editar a célula, sem mexer aqui. O valor abaixo só vale se a célula estiver vazia. Sem link nenhum, o e-mail vai sem o botão.
const AGENDA_URL = '';
// O texto do bloco fica nas Propriedades do script, na chave AGENDA_CHAMADA, porque cita uma pessoa pelo nome.
// Sem a propriedade, vale o texto abaixo.
const AGENDA_CHAMADA_PADRAO = 'Quer conversar sobre o seu plano? Fale com uma especialista da nossa equipe.';
const AGENDA_BOTAO = 'Agendar reunião com especialista';

// Relatório completo em PDF, anexado ao e-mail do plano. O PDF é desenhado aqui, com os números que a página manda,
// pelo mesmo código da página: precisa do arquivo Pdf.gs no projeto (gerado por receptor/ferramentas/montar-pdf.js).
// false, ou projeto sem o Pdf.gs = o e-mail vai sem anexo.
const ANEXAR_PDF = true;
const PDF_CONTA_GLOBAL_URL = 'https://rivool.finance/app/link-advisor/tiago-piassum';   // botão "Abra sua conta global" do PDF: o mesmo CONTA_GLOBAL_URL da página
const PDF_SITE = 'projeto2050.com';                                                    // endereço do rodapé do PDF: o mesmo SITE_NOME da página
// ========================

// Ordem das colunas. Campos novos que a página mandar entram no fim, sozinhos.
const COLUNAS = [
  'id', 'criado_em', 'atualizado_em', 'modo', 'nome', 'email', 'whatsapp',
  'vida_global_usd', 'vida_global_brl', 'ritmo_pct', 'aporte_extra_brl',
  'destino', 'destino_em', 'estado_eua', 'nivel_preco', 'estado_brasil', 'custo_mensal_brl', 'usd_mes', 'idade', 'idade_renda', 'anos',
  'investido_brl', 'pct_dolar', 'aporte_brl', 'projecao_usd', 'vida_global_brasil_usd', 'chute_usd', 'acertou_chute',
  'cambio', 'retorno_real_pct', 'retirada_mes_pct',
  'consentimento', 'consentimento_texto', 'email_enviado',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'indicado_por',
  'referrer', 'pagina', 'dispositivo', 'instagram_app', 'chave'
];
const IGNORAR = ['empresa', 'relatorio', 'chave', 'os_enviado_em', 'os_erro'];   // "relatorio" são os números do PDF: servem ao anexo, não viram coluna; a chave só o doPost escreve, e as duas do OS só o Os.gs
// Origem do primeiro contato: um envio posterior sem esses campos não apaga o que já foi gravado.
const PRIMEIRO_TOQUE = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'indicado_por', 'referrer'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let saida, idGravado = '';
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.empresa) return resposta({ ok: true });                       // robô: campo escondido preenchido
    d.email = String(d.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(d.email)) return resposta({ ok: false, erro: 'email' });
    if (!d.id || String(d.id).length > 40) return resposta({ ok: false, erro: 'id' });

    const aba = obterAba();
    // O id aparece no link de compartilhar, então não basta para escrever numa linha: só o dono escreve, e dono é quem manda a chave
    // que o navegador dele guarda (linha sem chave gravada: quem manda o mesmo e-mail). Chave fora do formato vale como ausente.
    const chave = /^[A-Za-z0-9]{16,64}$/.test(String(d.chave || '')) ? String(d.chave) : '';
    // Nome de campo vira cabeçalho de coluna: só passa nome simples, para um envio não escrever fórmula no cabeçalho.
    const cab = garantirColunas(aba, Object.keys(d).filter(function (k) { return IGNORAR.indexOf(k) < 0 && /^[a-z][a-z0-9_]{0,39}$/.test(k); }).concat('chave'));
    const agora = new Date();
    const ultima = aba.getLastRow();
    const ids = ultima > 1 ? aba.getRange(2, 1, ultima - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    let pos = ids.indexOf(String(d.id));
    const col = function (nome) { return cab.indexOf(nome); };
    const ler = function (p) { return aba.getRange(p + 2, 1, 1, cab.length).getValues()[0]; };
    let linha, valores, novo = false;

    if (pos >= 0) {
      valores = ler(pos);
      if (!ehDono(valores, col, d.email, chave)) {   // não é dono: a linha achada não é tocada, o envio vale para um id derivado
        d.id = idDerivado(d.id, chave || d.email);
        pos = ids.indexOf(d.id);
        valores = pos >= 0 ? ler(pos) : null;
        // linha derivada já ocupada por outro: linha nova. A página não lê a resposta, então recusar perderia o envio em silêncio.
        if (valores && !ehDono(valores, col, d.email, chave)) { d.id = idDerivado(d.id, (chave || d.email) + '|' + agora.getTime()); pos = -1; }
      }
    }
    if (pos >= 0) {
      linha = pos + 2;
    } else {
      novo = true;
      valores = cab.map(function () { return ''; });
      valores[col('criado_em')] = agora;
    }
    const tinhaPlano = !novo && !!valores[col('vida_global_usd')];   // esta pessoa já tinha feito a simulação antes deste envio
    cab.forEach(function (c, i) {
      if (c === 'criado_em' || c === 'email_enviado' || c === 'chave' || c === 'os_enviado_em' || c === 'os_erro') return;
      if (c === 'atualizado_em') { valores[i] = agora; return; }
      if (!Object.prototype.hasOwnProperty.call(d, c)) return;   // campo ausente: mantém o que já estava
      const v = d[c];
      if (v === undefined || v === null) return;
      if (v === '' && PRIMEIRO_TOQUE.indexOf(c) >= 0) return;      // não apaga a origem do primeiro contato
      valores[i] = limpar(v);                                      // string vazia limpa (ex.: estado_eua, whatsapp)
    });

    if (chave && !valores[col('chave')]) valores[col('chave')] = chave;   // linha nova, ou antiga que adota a chave no primeiro uso

    const jaEnviado = valores[col('email_enviado')];
    if (ENVIAR_RESULTADO && d.vida_global_usd && d.consentimento === 'sim' && !jaEnviado) {
      if (enviarPlano(d)) valores[col('email_enviado')] = agora;
    }

    if (novo) aba.appendRow(valores);
    else aba.getRange(linha, 1, 1, cab.length).setValues([valores]);
    idGravado = String(d.id);
    // Avisa a cada contato novo, na primeira vez que a pessoa pede o plano (mesmo que já estivesse na lista de espera)
    // e a cada aplicação para a Consultoria Global. Refazer a simulação atualiza a linha, sem aviso novo.
    const pediuPlano = !!d.vida_global_usd && !tinhaPlano;
    const avisarEmail = propriedade('AVISAR_EMAIL', '');
    if (avisarEmail && (novo || pediuPlano || d.interesse_consultoria === 'sim')) avisarDono(d, pediuPlano, avisarEmail);
    saida = resposta({ ok: true });
  } catch (err) {
    console.error(err);
    saida = resposta({ ok: false, erro: 'interno' });
  } finally {
    lock.releaseLock();
  }
  // Com a trava já solta: avisa o OS (Os.gs). Projeto sem o Os.gs funciona igual, como com o Pdf.gs. Nunca lança.
  if (idGravado && typeof avisarOS === 'function') avisarOS(idGravado);
  return saida;
}

// Dono da linha: com chave gravada, quem manda a mesma chave (o e-mail pode ser outro: é a pessoa corrigindo o e-mail);
// sem chave gravada (linha antiga), quem manda o mesmo e-mail.
function ehDono(valores, col, email, chave) {
  const gravada = String(valores[col('chave')] || '');
  if (gravada) return chave === gravada;
  return String(valores[col('email')] || '').trim().toLowerCase() === email;
}

// Id de quem escreveu numa linha que não é dele: determinístico, para o mesmo envio cair sempre na mesma linha.
// "S" + 14 hexadecimais maiúsculos cabe em ^[\w-]{1,40}$, que um sistema a jusante exige.
function idDerivado(id, segredo) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(id) + '|' + segredo, Utilities.Charset.UTF_8);
  return 'S' + bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 14).toUpperCase();
}

// Abrir a URL /exec no navegador mostra "ok": serve para testar a implantação.
function doGet() {
  return ContentService.createTextOutput('ok');
}

function obterAba() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(ABA);
  if (!aba) aba = planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
  }
  return aba;
}

function garantirColunas(aba, chaves) {
  let cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
  const faltam = chaves.filter(function (k) { return cab.indexOf(k) < 0; });
  if (faltam.length) {
    aba.getRange(1, cab.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
    cab = cab.concat(faltam);
  }
  return cab;
}

// Evita que um texto enviado vire fórmula na planilha e corta excessos.
function limpar(v) {
  if (typeof v === 'number') return isFinite(v) ? v : '';
  let s = String(v).slice(0, 500);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fmt(v) { return Math.round(Number(v) || 0).toLocaleString('pt-BR'); }

// Tudo o que vem do formulário é texto não confiável: escapa antes de entrar no HTML do e-mail.
function esc(v, max) {
  return String(v === undefined || v === null ? '' : v).slice(0, max || 120).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Número inteiro dentro de uma faixa; fora dela, null.
function inteiro(v, min, max) {
  const n = Math.round(Number(v));
  return isFinite(n) && n >= min && n <= max ? n : null;
}

// Número (com casas decimais) dentro de uma faixa; fora dela ou vazio, null.
function numero(v, min, max) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) && n >= min && n <= max ? n : null;
}

// "4" ou "0,4": até duas casas, sem zeros à direita, com vírgula.
function decimal(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

// E-mail do plano, no visual da página e do PDF: fundo de papel, pílula do Tiago no alto, o número grande em azul na serifa, filetes e botão em tinta.
// Tabelas e estilos escritos na própria tag, como os programas de e-mail pedem; o <style> só traz as fontes da marca e a regra de celular.
function enviarPlano(d) {
  try {
    const vida = inteiro(d.vida_global_usd, 1, 1e10);
    const idadeRenda = inteiro(d.idade_renda, 18, 100);
    const ritmo = inteiro(d.ritmo_pct, 0, 100000);
    if (vida === null || idadeRenda === null || ritmo === null) return false;   // dados fora do esperado: não envia
    const nome = esc(String(d.nome || '').trim().split(/\s+/)[0], 40);
    const lugar = esc(d.estado_eua ? d.estado_eua + ', Estados Unidos' : (d.destino || ''), 80);
    // A página manda o destino já com a preposição ("na Flórida", "em Portugal", "no Canadá").
    // Só entra no e-mail se tiver exatamente essa forma; qualquer outra coisa é ignorada.
    const emBruto = String(d.destino_em || '').trim();
    const lugarEm = /^(em|no|na|nos|nas) [A-Za-zÀ-ÿ .,-]{2,40}$/.test(emBruto) ? emBruto : '';
    const anos = inteiro(d.anos, 1, 70);
    const quando = 'aos ' + idadeRenda + (anos === null ? '' : ', em ' + (new Date().getFullYear() + anos));
    const brl = inteiro(d.vida_global_brl, 1, 1e12);
    const custo = inteiro(d.custo_mensal_brl, 1, 1e9);
    const extra = inteiro(d.aporte_extra_brl, 1, 1e9);
    const brasil = inteiro(d.vida_global_brasil_usd, 1, 1e10);
    const chegou = ritmo >= 100;
    // Premissas: as mesmas que a página usou na conta. Sem elas (envio de uma versão antiga da página), o texto não cita números.
    const retorno = numero(d.retorno_real_pct, 0.1, 20), retirada = numero(d.retirada_mes_pct, 0.01, 2), cambio = numero(d.cambio, 1, 20);
    const premissas = retorno !== null && retirada !== null && cambio !== null
      ? 'Simulação educativa: retorno real de ' + decimal(retorno) + '% ao ano em dólar, retirada de ' + decimal(retirada) + '% ao mês e câmbio de R$ ' + cambio.toFixed(2).replace('.', ',') + '.'
      : 'Simulação educativa, com as hipóteses de retorno, de retirada e de câmbio informadas no relatório.';

    // Os textos, uma vez só: servem ao e-mail em HTML e à versão em texto puro.
    const tAbertura = (nome ? 'Oi, ' + nome + '.' : 'Oi.') + ' Aqui está o seu plano.';
    const tRotulo = 'Patrimônio em dólar que paga a sua vida' + (lugarEm ? ' ' + esc(lugarEm, 60) : '');
    const tNumero = 'US$ ' + fmt(vida);
    const tQuando = 'Para viver de renda ' + quando + '.' + (brl === null ? '' : ' Cerca de R$ ' + fmt(brl) + ' no câmbio de hoje.');
    const tVida = custo === null ? ''
      : lugarEm ? 'É o patrimônio em dólar que paga, ' + esc(lugarEm, 60) + ', a vida que você leva hoje com R$ ' + fmt(custo) + ' por mês.'
      : 'É o patrimônio em dólar que paga a vida que você leva hoje com R$ ' + fmt(custo) + ' por mês.' + (lugar ? ' Destino escolhido: ' + lugar + '.' : '');
    const tRitmoA = chegou ? 'No ritmo de hoje você passa da sua vida global.' : 'No ritmo de hoje você chega a ';
    const tRitmoB = chegou ? ' Daqui para frente, o trabalho é manter o ritmo.' : ' da sua vida global.';
    const tExtraA = chegou || extra === null ? '' : 'Com ';
    const tExtraB = chegou || extra === null ? '' : ', chega a 100% aos ' + idadeRenda + '.';
    const tBrasil = brasil === null ? '' : 'Se você ficar no Brasil, só pelo câmbio, o valor é US$ ' + fmt(brasil) + '.';
    const agendaUrl = urlSegura(config('agenda_url', AGENDA_URL));
    const agendaChamada = propriedade('AGENDA_CHAMADA', AGENDA_CHAMADA_PADRAO);
    const pdf = ANEXAR_PDF ? gerarPdfDoPlano(d) : null;
    const tAnexo = pdf ? 'O relatório completo vai em anexo, em PDF.' : '';
    const tLista = 'Você está na lista de espera do Projeto 2050. Quando abrir, seu plano já vai estar na sua conta.';
    const tRodape = premissas + ' Não é recomendação de investimento. Para sair da lista, responda este e-mail.';

    // Cores e fontes do site e do PDF. As fontes da marca entram pelo <style>; sem ele (o Gmail o descarta), valem Arial e Georgia.
    const PAPEL = '#F4F5F6', TINTA = '#0B0D0E', APOIO = '#63696E', FILETE = '#DBDEE1', AZUL = '#2716E9';
    const SANS = 'font-family:Figtree,Arial,Helvetica,sans-serif;';
    const SERIF = "font-family:'Hedvig Letters Serif',Georgia,'Times New Roman',serif;";
    const linhaTd = function (css, conteudo, classe) { return '<tr><td' + (classe ? ' class="' + classe + '"' : '') + ' style="' + css + '">' + conteudo + '</td></tr>'; };
    const bloco = function (rot, texto) {   // rótulo pequeno em cima, texto embaixo, filete acima
      return '<tr><td style="padding:14px 0;border-top:1px solid ' + FILETE + '">' +
        '<div style="' + SANS + 'font-size:15px;line-height:18px;font-weight:600;color:' + APOIO + ';padding-bottom:4px">' + rot + '</div>' +
        '<div style="' + SANS + 'font-size:16px;line-height:24px;font-weight:400;color:' + TINTA + '">' + texto + '</div></td></tr>';
    };
    const tabela = function (conteudo, css) { return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;' + (css || '') + '">' + conteudo + '</table>'; };
    const tRitmo = chegou ? tRitmoA + tRitmoB
      : tRitmoA + '<b style="font-weight:700">' + ritmo + '%</b>' + tRitmoB + (tExtraA ? ' ' + tExtraA + '<b style="font-weight:700">R$ ' + fmt(extra) + ' a mais por mês</b>' + tExtraB : '');
    const corpo =
      '<style>@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Hedvig+Letters+Serif&display=swap");' +
      '@media (max-width:480px){.lado{padding-left:20px !important;padding-right:20px !important}.frase{font-size:24px !important}}' +
      '@media (min-width:481px){.numero{font-size:60px !important;line-height:64px !important}}</style>' +
      '<div style="margin:0;padding:0;background-color:' + PAPEL + '">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + PAPEL + '" style="width:100%;background-color:' + PAPEL + '"><tr><td align="center" style="padding:0">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="' + PAPEL + '" style="width:100%;max-width:600px;background-color:' + PAPEL + '">' +
      // cabeçalho: pílula com a foto à esquerda, "Projeto 2050" à direita
      '<tr><td class="lado" style="padding:32px 32px 0 32px">' + tabela('<tr>' +
        '<td align="left" valign="middle" style="font-size:0;line-height:0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>' +
          '<td bgcolor="#1B1E21" style="background-color:#1B1E21;border:1px solid #33383E;border-radius:999px;padding:4px 14px 4px 4px">' +
          '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
            '<td valign="middle" style="padding:0 8px 0 0;font-size:0;line-height:0"><img src="https://www.projeto2050.com/img/tiago-avatar-pdf.jpg" alt="Tiago Piassum" width="28" height="28" style="display:block;width:28px;height:28px;border:0;border-radius:14px;background-color:#33383E;font-size:0;line-height:0;color:#33383E"></td>' +
            '<td valign="middle" style="' + SANS + 'font-size:14px;line-height:20px;font-weight:700;color:' + PAPEL + ';white-space:nowrap">Tiago Piassum</td>' +
          '</tr></table></td></tr></table></td>' +
        '<td align="right" valign="middle" style="' + SANS + 'font-size:14px;line-height:20px;font-weight:600;color:' + APOIO + ';white-space:nowrap">Projeto&nbsp;2050</td>' +
      '</tr>') + '</td></tr>' +
      // número, com o sublinhado, e o "quando" embaixo
      linhaTd('padding:40px 32px 0 32px;' + SANS + 'font-size:15px;line-height:18px;font-weight:600;color:' + APOIO, 'Sua vida global', 'lado') +
      linhaTd('padding:12px 32px 0 32px', '<span class="numero" style="display:inline-block;' + SERIF + 'font-size:40px;line-height:46px;font-weight:400;letter-spacing:-1px;color:' + AZUL + ';white-space:nowrap;border-bottom:4px solid #3D2EEB;padding-bottom:2px">' + tNumero + '</span>', 'lado') +
      linhaTd('padding:16px 32px 0 32px;' + SANS + 'font-size:17px;line-height:25px;font-weight:400;color:' + APOIO, tQuando, 'lado') +
      linhaTd('padding:24px 32px 0 32px;' + SERIF + 'font-size:28px;line-height:32px;font-weight:400;letter-spacing:-0.4px;color:' + TINTA, tVida || tRotulo + '.', 'lado frase') +
      linhaTd('padding:24px 32px 0 32px;' + SANS + 'font-size:17px;line-height:25px;font-weight:600;color:' + TINTA, tAbertura, 'lado') +
      // ritmo e Brasil, cada um com rótulo e filete
      linhaTd('padding:24px 32px 0 32px', tabela(bloco('Seu ritmo de hoje', tRitmo) + (tBrasil ? bloco('Se você ficar no Brasil', 'Só pelo câmbio, o valor é US$ ' + fmt(brasil) + '.') : ''), 'border-bottom:1px solid ' + FILETE), 'lado') +
      // o PDF vai anexado: só o aviso
      (tAnexo ? linhaTd('padding:32px 32px 0 32px;' + SANS + 'font-size:16px;line-height:24px;font-weight:700;color:' + TINTA, tAnexo, 'lado') : '') +
      // agenda: a chamada e o botão em tinta, de largura inteira
      (agendaUrl ? linhaTd('padding:32px 32px 0 32px', tabela(
        '<tr><td style="' + SANS + 'font-size:16px;line-height:24px;color:' + TINTA + ';padding-bottom:16px">' + esc(agendaChamada, 300) + '</td></tr>' +
        '<tr><td align="center" bgcolor="' + TINTA + '" style="background-color:' + TINTA + ';border-radius:6px"><a href="' + esc(agendaUrl, 500) + '" style="display:block;padding:18px 24px;' + SANS + 'font-size:17px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;text-align:center">' + esc(AGENDA_BOTAO, 80) + '</a></td></tr>'), 'lado') : '') +
      // lista de espera
      linhaTd('padding:32px 32px 0 32px', tabela('<tr><td style="padding:20px 0 0 0;border-top:1px solid ' + FILETE + ';' + SANS + 'font-size:16px;line-height:24px;font-weight:400;color:' + TINTA + '">' + tLista +
        (SITE_URL ? '<br><a href="' + esc(SITE_URL, 300) + '" style="display:inline-block;padding-top:10px;' + SANS + 'font-size:16px;line-height:24px;font-weight:700;color:' + AZUL + ';text-decoration:underline">Conheça o Projeto 2050</a>' : '') + '</td></tr>'), 'lado') +
      // rodapé
      linhaTd('padding:28px 32px 40px 32px', tabela('<tr><td style="padding:16px 0 0 0;border-top:1px solid ' + FILETE + ';' + SANS + 'font-size:13px;line-height:19px;font-weight:400;color:' + APOIO + '">' + tRodape + '</td></tr>'), 'lado') +
      '</table></td></tr></table></div>';
    // "R$ 20.000" e "US$ 925.926" não se partem em duas linhas
    const html = corpo.replace(/(R\$|US\$) (?=\d)/g, function (m, moeda) { return moeda + '&nbsp;'; });

    // Versão em texto puro, para programas que não mostram HTML. Os textos já vêm escapados; aqui voltam ao normal.
    const puro = function (t) { return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); };
    const texto = [
      tAbertura, '',
      tRotulo + ': ' + tNumero, tQuando, '',
      tVida,
      chegou ? tRitmoA + tRitmoB : tRitmoA + ritmo + '%' + tRitmoB + (tExtraA ? ' ' + tExtraA + 'R$ ' + fmt(extra) + ' a mais por mês' + tExtraB : ''),
      tBrasil, tAnexo, '',
      agendaUrl ? esc(agendaChamada, 300) + ' ' + AGENDA_BOTAO + ': ' + agendaUrl : '', agendaUrl ? '' : null,
      tLista + (SITE_URL ? ' ' + SITE_URL : ''), '',
      tRodape
    ].filter(function (l) { return l !== null; }).filter(function (l, i, a) { return l !== '' || (i > 0 && a[i - 1] !== ''); }).map(puro).join('\n');

    const mensagem = { to: d.email, subject: 'Sua vida global: US$ ' + fmt(vida), body: texto, htmlBody: html, name: 'Projeto 2050' };
    if (pdf) mensagem.attachments = [pdf];
    MailApp.sendEmail(mensagem);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// ===== Propriedades do script: o que não pode ficar num repositório público =====
// Ficam em Configurações do projeto → Propriedades do script, no editor do Apps Script. Não vão pelo repositório.
//   AVISAR_EMAIL    endereços que recebem o aviso interno, separados por vírgula. Sem ela, não há aviso.
//   AGENDA_CHAMADA  frase do bloco "Agendar reunião com especialista" do e-mail do plano. Sem ela, vale AGENDA_CHAMADA_PADRAO.
function propriedade(chave, padrao) {
  try {
    const v = PropertiesService.getScriptProperties().getProperty(chave);
    return v === null || v === undefined || String(v).trim() === '' ? padrao : String(v).trim();
  } catch (err) {
    console.error(err);
    return padrao;
  }
}

// Para conferir no editor do Apps Script, sem mostrar nenhum valor: rode esta função e leia o registro de execução.
function conferirConfiguracao() {
  const aviso = propriedade('AVISAR_EMAIL', '');
  console.log('AVISAR_EMAIL: ' + (aviso ? 'definida, ' + aviso.split(',').filter(function (e) { return e.trim(); }).length + ' endereço(s)' : 'não definida (aviso interno desligado)'));
  console.log('AGENDA_CHAMADA: ' + (propriedade('AGENDA_CHAMADA', '') ? 'definida' : 'não definida (vale o texto padrão)'));
  console.log('Link da agenda (aba Config): ' + (urlSegura(config('agenda_url', AGENDA_URL)) ? 'definido' : 'não definido (e-mail sem o botão)'));
  console.log('Arquivo Pdf.gs: ' + (typeof jspdf !== 'undefined' && typeof desenharRelatorio === 'function' ? 'presente' : 'ausente (e-mail sem anexo)'));
  console.log('Aviso ao OS: ' + (typeof osConfig !== 'function' ? 'arquivo Os.gs ausente' : osConfig() ? 'configurado' : 'não configurado (faltam OS_URL e OS_SEGREDO, ou o endereço não começa com https)'));
}

// ===== Aba "Config": o que muda sem mexer no código =====
const ABA_CONFIG = 'Config';
const CONFIG_INICIAL = [
  ['chave', 'valor', 'para que serve'],
  ['agenda_url', '', 'Link do botão "Agendar reunião com especialista" do e-mail do plano: página de agendamento ou WhatsApp (https://wa.me/55DDDNUMERO). Vazio = e-mail sem o botão.']
];

// Lê uma chave da aba Config (coluna A = chave, coluna B = valor). Cria a aba na primeira vez. Sem valor, devolve o padrão.
function config(chave, padrao) {
  try {
    const planilha = SpreadsheetApp.getActiveSpreadsheet();
    let aba = planilha.getSheetByName(ABA_CONFIG);
    if (!aba) {
      aba = planilha.insertSheet(ABA_CONFIG);
      aba.getRange(1, 1, CONFIG_INICIAL.length, 3).setValues(CONFIG_INICIAL);
      aba.getRange(1, 1, 1, 3).setFontWeight('bold');
      aba.setFrozenRows(1);
    }
    const ultima = aba.getLastRow();
    if (ultima < 2) return padrao;
    const linhas = aba.getRange(2, 1, ultima - 1, 2).getValues();
    for (let i = 0; i < linhas.length; i++) {
      if (String(linhas[i][0]).trim() === chave) { const v = String(linhas[i][1]).trim(); return v || padrao; }
    }
  } catch (err) { console.error(err); }
  return padrao;
}

// Só aceita endereço https, sem espaço nem aspas: é o que entra no href do botão.
function urlSegura(v) {
  const t = String(v === undefined || v === null ? '' : v).trim();
  return /^https:\/\/[^\s"'<>]{4,500}$/.test(t) ? t : '';
}

// ===== Relatório em PDF (anexo do e-mail do plano) =====
// O arquivo anexado nunca vem do navegador: é desenhado aqui. Da página chegam só números, conferidos por faixa,
// e nomes de lugar, conferidos letra a letra. Qualquer coisa fora do esperado e o e-mail vai sem anexo.

// "em Portugal", "na Flórida", "em Santa Catarina": a mesma regra que o e-mail usa para o destino.
function comPreposicao(v) {
  const t = String(v === undefined || v === null ? '' : v).trim();
  return /^(em|no|na|nos|nas) [A-Za-zÀ-ÿ .,-]{2,40}$/.test(t) ? t : '';
}

// Nome de país ou de estado: só letras, espaço e pontuação de nome ("Washington, D.C.", "Flórida (EUA)").
function nomeDeLugar(v) {
  const t = String(v === undefined || v === null ? '' : v).trim();
  return /^[A-Za-zÀ-ÿ .,()'’-]{2,40}$/.test(t) ? t : '';
}

// O mesmo "R$ 1,2 milhão" / "R$ 300 mil" da página.
function brlCurto(v) {
  if (v >= 1e6) { const m = Math.round(v / 1e5) / 10; return 'R$ ' + m.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (m < 2 ? ' milhão' : ' milhões'); }
  if (v >= 1e3) return 'R$ ' + fmt(v / 1e3) + ' mil';
  return 'R$ ' + fmt(v);
}

// Monta, a partir do envio da página, o objeto que o desenho do relatório espera (o mesmo de dadosRelatorio() na página).
// Devolve null se faltar ou sobrar alguma coisa.
function dadosDoRelatorio(d) {
  const r = d.relatorio;
  if (!r || typeof r !== 'object') return null;
  const vida = numero(r.numero, 1, 1e10), usdMes = numero(r.usd_mes, 1, 1e8), cambioMes = numero(r.cambio_mes, 1, 1e8);
  const inv = numero(r.inv, 0, 1e11), ap = numero(r.ap, 0, 1e9), proj = numero(r.proj, 0, 1e13), ritmo = numero(r.ritmo, 0, 1000), extra = numero(r.extra_brl, 0, 1e9);
  const custo = inteiro(d.custo_mensal_brl, 1, 1e9), age = inteiro(d.idade, 10, 100), ret = inteiro(d.idade_renda, 11, 120);
  const cambio = numero(d.cambio, 1, 20), retorno = numero(d.retorno_real_pct, 0.1, 20), retirada = numero(d.retirada_mes_pct, 0.01, 2);
  const lugarEm = comPreposicao(d.destino_em), estadoEm = comPreposicao(r.estado_em);
  if ([vida, usdMes, cambioMes, inv, ap, proj, ritmo, extra, custo, age, ret, cambio, retorno, retirada].indexOf(null) >= 0 || !lugarEm || !estadoEm) return null;
  const anos = ret - age;
  if (anos < 1 || anos > 90) return null;

  // patrimônio ano a ano: a mesma conta da página
  const iMes = Math.pow(1 + retorno / 100, 1 / 12) - 1;
  const fCap = function (y) { return Math.pow(1 + iMes, 12 * y); };
  const fAp = function (y) { return (Math.pow(1 + iMes, 12 * y) - 1) / iMes; };
  const serie = [];
  for (let y = 1; y <= anos; y++) serie.push({ idade: age + y, investido: inv, aportes: ap * 12 * y, rendimento: inv * (fCap(y) - 1) + ap * fAp(y) - ap * 12 * y });

  // alavancas: os títulos são escritos aqui; da página vêm o tipo, a porcentagem e, na troca de lugar, os dois nomes
  const alavancas = [];
  (Array.isArray(r.alav) ? r.alav : []).slice(0, 3).forEach(function (a) {
    const pr = numero(a && a.r, 0, 1000);
    if (pr === null) return;
    if (a.id === 'mais') { const mais = inteiro(a.extra, 1, 1e8); if (mais !== null) alavancas.push({ t: 'Guardar ' + brlCurto(mais) + ' a mais por mês', r: pr }); }
    else if (a.id === 'anos') alavancas.push({ t: 'Dar três anos a mais à estrada', r: pr });
    else if (a.id === 'regua') { const de = nomeDeLugar(a.de), para = nomeDeLugar(a.para); if (de && para) alavancas.push({ t: 'Trocar ' + de + ' por ' + para, r: pr }); }
  });
  const lugares = [];
  (Array.isArray(r.lugares) ? r.lugares : []).slice(0, 5).forEach(function (l) {
    const nome = nomeDeLugar(l && l.nome), usd = numero(l && l.usd, 1, 1e8);
    if (nome && usd !== null) lugares.push({ nome: nome, usd: usd, sel: l.sel === true });
  });
  if (!alavancas.length || lugares.length < 2) return null;

  const primeiro = String(d.nome || '').trim().split(/\s+/)[0] || '';
  return {
    nome: /^[A-Za-zÀ-ÿ'’-]{1,40}$/.test(primeiro) ? primeiro : '',
    data: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy'),
    lugarEm: lugarEm, estadoEm: estadoEm,
    custo: custo, usdMes: usdMes, cambioMes: cambioMes, numero: vida, numeroBRL: brlCurto(vida * cambio),
    age: age, ret: ret, anos: anos, anoRenda: new Date().getFullYear() + anos,
    inv: inv, proj: proj, falta: Math.max(0, vida - proj), ritmo: ritmo, chegou: ritmo >= 0.995, extraBRL: extra,
    serie: serie, alavancas: alavancas, lugares: lugares,
    site: PDF_SITE, ctaTexto: 'Abra sua conta global', ctaUrl: PDF_CONTA_GLOBAL_URL || 'https://' + PDF_SITE,
    legal: 'Simulação educativa, com hipóteses de retorno real de ' + decimal(retorno) + '% ao ano em dólar, retirada de ' + decimal(retirada) + '% ao mês e câmbio de R$ ' + cambio.toFixed(2).replace('.', ',') +
      '. Rendimento variável, não garantido. Não é recomendação de investimento. Nível de preços e poder de compra: Banco Mundial, Programa de Comparação Internacional (2024); médias nacionais.'
  };
}

// O PDF do plano, pronto para anexar. null se o projeto está sem o Pdf.gs, se os números não fecham ou se o desenho falhar.
function gerarPdfDoPlano(d) {
  try {
    if (typeof jspdf === 'undefined' || typeof desenharRelatorio !== 'function') return null;
    const dados = dadosDoRelatorio(d);
    if (!dados) return null;
    const doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    desenharRelatorio(doc, dados);
    doc.setProperties({ title: 'Sua vida global · Projeto 2050', author: 'Projeto 2050' });
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return Utilities.newBlob(Utilities.base64Decode(btoa(bin)), 'application/pdf', 'vida-global-projeto-2050.pdf');
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Só para conferir no editor do Apps Script que o PDF sai: rode esta função e veja o tamanho no registro de execução. Não envia nada.
function testarPdf() {
  const pdf = gerarPdfDoPlano({
    nome: 'Teste', destino_em: 'em Portugal', custo_mensal_brl: 20000, idade: 35, idade_renda: 60, cambio: 5.4, retorno_real_pct: 4, retirada_mes_pct: 0.4,
    relatorio: { estado_em: 'em Santa Catarina', usd_mes: 3841, cambio_mes: 3703.7, numero: 960176, inv: 3703.7, ap: 740.74, proj: 386798, ritmo: 0.4028, extra_brl: 6080,
      alav: [{ id: 'mais', r: 0.5, extra: 1000 }, { id: 'anos', r: 0.48 }, { id: 'regua', r: 0.47, de: 'Portugal', para: 'Hungria' }],
      lugares: [{ nome: 'Portugal', usd: 3841, sel: true }, { nome: 'Espanha', usd: 4184 }, { nome: 'Flórida (EUA)', usd: 7028 }] }
  });
  console.log(pdf ? 'PDF gerado: ' + pdf.getBytes().length + ' bytes' : 'PDF não gerado');
}

// Aviso interno. pediuPlano = é a primeira vez que esta pessoa pede o plano. destinatarios = o valor da propriedade AVISAR_EMAIL.
function avisarDono(d, pediuPlano, destinatarios) {
  try {
    const origem = [d.utm_source, d.utm_medium, d.ref ? 'ref ' + d.ref : ''].filter(String).join(' · ') || 'direto';
    const consultoria = d.interesse_consultoria === 'sim';
    const quem = d.nome || d.email;
    const assunto = consultoria ? 'Aplicação Consultoria Global: ' + quem
      : pediuPlano ? 'Novo Plano de Voo: ' + quem + ' · US$ ' + fmt(d.vida_global_usd)
      : 'Novo contato Projeto 2050: ' + quem;
    const zap = String(d.whatsapp || '').replace(/\D/g, '');
    MailApp.sendEmail(destinatarios, assunto,
      'Nome: ' + (d.nome || '') + '\nE-mail: ' + d.email + '\nWhatsApp: ' + (zap ? zap + ' · https://wa.me/55' + zap : 'não informado') +
      '\nEntrada: ' + (d.modo || (consultoria ? 'consultoria global' : '')) + '\nOrigem: ' + origem +
      (d.vida_global_usd
        ? '\n\nVida global: US$ ' + fmt(d.vida_global_usd) + ' · ritmo de hoje ' + d.ritmo_pct + '%' +
          '\nDe ' + (d.estado_brasil || '') + ' para ' + (d.estado_eua ? d.estado_eua + ', Estados Unidos' : (d.destino || '')) +
          '\nCusto de vida: R$ ' + fmt(d.custo_mensal_brl) + ' por mês · investido hoje: R$ ' + fmt(d.investido_brl) + ' · guarda R$ ' + fmt(d.aporte_brl) + ' por mês' +
          '\nIdade: ' + (d.idade || '') + ' · quer viver de renda aos ' + (d.idade_renda || '')
        : '\n\nAinda não fez a simulação.') +
      (d.interesse_jovem === 'sim' ? '\nPediu aviso do Jovem 2050.' : '') +
      (consultoria ? '\n\nConsultoria Global · patrimônio: ' + (d.patrimonio_faixa || 'não informado') + (d.consultoria_mensagem ? '\nO que quer resolver: ' + d.consultoria_mensagem : '') : '') +
      '\n\nA linha completa está na aba Leads da planilha.');
  } catch (err) { console.error(err); }
}
