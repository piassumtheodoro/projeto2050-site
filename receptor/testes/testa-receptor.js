// Testes do receptor de leads. Rodam os arquivos de verdade (Código.gs e Pdf.gs) num Apps Script simulado:
// nada sai daqui, nenhuma planilha é tocada e nenhum e-mail é enviado.
// Uso: node receptor/testes/testa-receptor.js [pasta para gravar um e-mail e um PDF de amostra]
const fs = require('fs'), path = require('path'), { criar } = require('./apps-script-simulado.js');
const pasta = path.join(__dirname, '..'), receptor = path.join(pasta, 'Código.gs'), pdf = path.join(pasta, 'Pdf.gs'), amostras = process.argv[2];

const AVISO = 'aviso.um@exemplo.com, aviso.dois@exemplo.com';
const CHAMADA = 'Quer conversar sobre o seu plano? A Fulana de Tal, especialista da nossa equipe, atende você.';
const PROPS = { AVISAR_EMAIL: AVISO, AGENDA_CHAMADA: CHAMADA };
const sim = { estado_brasil: 'Santa Catarina', custo_mensal_brl: 20000, destino: 'Portugal', destino_em: 'em Portugal', estado_eua: '', idade: 35, idade_renda: 60, anos: 25,
  investido_brl: 20000, aporte_brl: 4000, vida_global_usd: 960176, vida_global_brl: 5184952, ritmo_pct: 40, aporte_extra_brl: 6080, vida_global_brasil_usd: 925926, cambio: 5.4, retorno_real_pct: 4, retirada_mes_pct: 0.4, usd_mes: 3841 };
const rel = { estado_em: 'em Santa Catarina', usd_mes: 3840.7, cambio_mes: 3703.7, numero: 960176.3, inv: 3703.7, ap: 740.74, proj: 386798.2, ritmo: 0.40284, extra_brl: 6080,
  alav: [{ id: 'mais', r: 0.5021, extra: 1000 }, { id: 'anos', r: 0.4803 }, { id: 'regua', r: 0.4712, de: 'Portugal', para: 'Hungria' }],
  lugares: [{ nome: 'Portugal', usd: 3840.7, sel: true }, { nome: 'Espanha', usd: 4184 }, { nome: 'Itália', usd: 4463 }, { nome: 'Uruguai', usd: 4515 }, { nome: 'Flórida (EUA)', usd: 7028 }] };
const base = (id, nome, email) => ({ id, nome, email, whatsapp: '48999990000', consentimento: 'sim', consentimento_texto: 'Aceito…', utm_source: 'instagram', empresa: '', pagina: 'https://www.projeto2050.com/' });
const simulador = (id, extra) => Object.assign(base(id, 'Ana Souza', 'ana@exemplo.com'), sim, { modo: 'simulador', relatorio: rel }, extra);
const doPlano = a => a.correio.find(m => m.para === 'ana@exemplo.com'), doAviso = a => a.correio.filter(m => m.para === AVISO);

let feitos = 0, falhas = 0;
const ok = (cond, msg) => { feitos++; if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ FALHOU: ') + msg); };
const secao = t => console.log('\n=== ' + t + ' ===');

for (const pdfPrimeiro of [true, false]) {
  secao('plano completo, com Pdf.gs carregado ' + (pdfPrimeiro ? 'antes' : 'depois') + ' do Código.gs');
  const a = criar({ receptor, pdf, pdfPrimeiro, propriedades: PROPS });
  a.definirConfig('agenda_url', 'https://wa.me/5500000000000');
  ok(a.post(simulador('S1')).ok === true, 'o envio é aceito');
  const plano = doPlano(a), aviso = doAviso(a)[0];
  ok(!!plano, 'o plano vai para a pessoa');
  ok(plano && plano.anexos.length === 1 && plano.anexos[0].tipo === 'application/pdf' && plano.anexos[0].buffer.slice(0, 5).toString('latin1') === '%PDF-' && plano.anexos[0].buffer.length > 30000, 'com 1 anexo PDF de verdade (' + (plano && plano.anexos[0] ? plano.anexos[0].buffer.length + ' bytes' : 'sem anexo') + ')');
  ok(plano && /O relatório completo vai em anexo, em PDF\./.test(plano.corpo) && /vai em anexo/.test(plano.html), 'o e-mail avisa do anexo, no texto e no HTML');
  ok(plano && plano.html.includes('href="https://wa.me/5500000000000"') && plano.html.includes('Agendar reunião com especialista') && plano.html.includes('A Fulana de Tal') && plano.corpo.includes(CHAMADA + ' Agendar reunião com especialista: https://wa.me/5500000000000'), 'bloco da agenda com o link da aba Config e a frase da propriedade AGENDA_CHAMADA');
  ok(plano && ['Tiago Piassum', 'Sua vida global', 'Seu ritmo de hoje', 'Se você ficar no Brasil'].every(t => plano.html.includes(t)), 'o HTML tem o cabeçalho e os rótulos do desenho novo');
  ok(plano && plano.html.split('Se você ficar no Brasil').length === 2 && /Só pelo câmbio, o valor é US\$(&nbsp;| )925\.926\./.test(plano.html) && /Se você ficar no Brasil, só pelo câmbio/.test(plano.corpo), 'a linha do Brasil não repete o rótulo no HTML; o texto puro segue com a frase inteira');
  ok(plano && /#2716E9/i.test(plano.html) && !plano.html.includes('#0541fe') && !plano.html.includes('#090909'), 'cores do site: o azul novo entra, o azul e o preto antigos saem');
  ok(plano && plano.html.includes('Georgia') && plano.html.includes('Arial'), 'as fontes têm Georgia e Arial como reserva');
  ok(plano && !/<script|display:\s*flex|display:\s*grid/i.test(plano.html), 'o HTML não tem script, flex nem grid');
  ok(plano && !plano.html.includes('Baixar meu relatório em PDF'), 'sem botão de PDF: o relatório vai anexado');
  ok(!!aviso && aviso.anexos.length === 0 && /^Novo Plano de Voo: Ana Souza/.test(aviso.assunto), 'aviso interno para os endereços da propriedade AVISAR_EMAIL, sem anexo');
  ok(a.dados[0].indexOf('relatorio') < 0 && a.dados[0].indexOf('pdf_base64') < 0, 'a planilha não ganha coluna com os números do PDF');
  ok(a.dados.length === 2 && a.dados[1][a.dados[0].indexOf('email')] === 'ana@exemplo.com' && !!a.dados[1][a.dados[0].indexOf('email_enviado')], 'uma linha na aba Leads, com o envio do e-mail marcado');
  ok(a.erros.length === 0, 'sem erro no registro' + (a.erros.length ? ': ' + a.erros.join(' | ').slice(0, 300) : ''));
  if (pdfPrimeiro && amostras) { fs.mkdirSync(amostras, { recursive: true }); fs.writeFileSync(path.join(amostras, 'email-plano.pdf'), plano.anexos[0].buffer); fs.writeFileSync(path.join(amostras, 'email-plano.html'), plano.html); fs.writeFileSync(path.join(amostras, 'email-plano.txt'), plano.corpo); }
}

secao('nome com HTML é escapado no e-mail');
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(simulador('S7', { nome: '<b>Ana</b> Souza' }));
  const h = doPlano(a) ? doPlano(a).html : '';
  ok(h.includes('&lt;b&gt;Ana&lt;/b&gt;') && !h.includes('<b>Ana</b>'), 'nome com tags aparece escapado, nunca como HTML'); }

secao('e-mail em casos de borda');
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(simulador('S80', { custo_mensal_brl: '' }));
  ok(doPlano(a) && doPlano(a).html.includes('Patrimônio em dólar que paga a sua vida em Portugal.'), 'sem custo mensal: o destino continua no HTML, na frase grande'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(simulador('S81'));
  const estiloDoNumero = (doPlano(a).html.match(/class="numero" style="([^"]+)"/) || [])[1] || '';
  ok(/font-size:40px/.test(estiloDoNumero) && doPlano(a).html.includes('src="https://www.projeto2050.com/img/'), 'o número cabe num celular sem o <style> (40px na própria tag) e a foto vem do endereço com www'); }

secao('propriedades do script');
{ const a = criar({ receptor, pdf });   // nenhuma propriedade definida
  a.definirConfig('agenda_url', 'https://wa.me/5500000000000');
  ok(a.post(simulador('S5')).ok === true && !!doPlano(a), 'sem propriedades: o envio é aceito e o plano sai');
  ok(a.correio.length === 1, 'sem AVISAR_EMAIL: nenhum aviso interno');
  ok(doPlano(a).html.includes('Fale com uma especialista da nossa equipe.'), 'sem AGENDA_CHAMADA: vale o texto padrão');
  ok(a.erros.length === 0, 'e nada disso gera erro'); }
{ const a = criar({ receptor, pdf, propriedades: { AVISAR_EMAIL: '   ' } });
  a.post(simulador('S6'));
  ok(a.correio.length === 1 && a.erros.length === 0, 'AVISAR_EMAIL em branco conta como não definida'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.ctx.conferirConfiguracao();
  const texto = a.registro.join('\n');
  ok(/AVISAR_EMAIL: definida, 2 endereço/.test(texto) && /AGENDA_CHAMADA: definida/.test(texto) && /Pdf\.gs: presente/.test(texto), 'conferirConfiguracao() diz o que está definido');
  ok(!texto.includes('exemplo.com') && !texto.includes('Fulana'), 'sem mostrar nenhum valor'); }

secao('entradas ruins: o e-mail sai, sem anexo');
const casos = {
  'sem o objeto relatorio (página antiga)': () => undefined,
  'nome de lugar com link': r => Object.assign({}, r, { lugares: [{ nome: 'visite http://golpe.example', usd: 1, sel: true }] }),
  'número fora da faixa': r => Object.assign({}, r, { numero: 'abc' }),
  'estado com texto livre': r => Object.assign({}, r, { estado_em: 'deposite 500 reais na conta 123' }),
  'alavancas vazias': r => Object.assign({}, r, { alav: [] })
};
let n = 10;
for (const [nome, muda] of Object.entries(casos)) {
  const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(simulador('S' + (++n), { relatorio: muda(rel) }));
  const plano = doPlano(a);
  ok(plano && plano.anexos.length === 0 && !/anexo/.test(plano.corpo), nome);
}
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(simulador('S30', { relatorio: Object.assign({}, rel, { alav: [{ id: 'regua', r: 0.4, de: 'Portugal', para: '<b>x</b> 99' }, { id: 'anos', r: 0.48 }] }) }));
  ok(doPlano(a) && doPlano(a).anexos.length === 1, 'alavanca com nome inválido é descartada; as outras ficam e o PDF sai'); }
{ const a = criar({ receptor, pdf: null, propriedades: PROPS });
  a.post(simulador('S40'));
  ok(doPlano(a) && doPlano(a).anexos.length === 0 && a.erros.length === 0, 'projeto sem o Pdf.gs: plano enviado sem anexo, sem erro'); }

secao('link da agenda (aba Config)');
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(simulador('S60'));
  ok(!!a.abas.Config && a.abas.Config.dados.length === 2 && a.abas.Config.dados[1][0] === 'agenda_url', 'a aba Config é criada sozinha, com a linha agenda_url vazia');
  ok(!doPlano(a).html.includes('Agendar reunião'), 'célula vazia: e-mail sem o bloco'); }
for (const [rot, valor, espera] of [['link javascript:', 'javascript:alert(1)', false], ['link http sem s', 'http://exemplo.com/agenda', false], ['link com aspas', 'https://exemplo.com/"onmouseover="x', false], ['página de agendamento https', 'https://calendar.app.google/abcDEF123', true]]) {
  const a = criar({ receptor, pdf, propriedades: PROPS }); a.definirConfig('agenda_url', valor);
  a.post(simulador('S61'));
  ok(doPlano(a).html.includes('Agendar reunião') === espera, rot + ': ' + (espera ? 'bloco presente' : 'link recusado'));
}

secao('quem recebe o quê');
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(Object.assign(base('S50', 'Bruno Lima', 'bruno@exemplo.com'), { modo: 'lista de espera' }));
  ok(a.correio.length === 1 && /^Novo contato Projeto 2050: Bruno Lima/.test(a.correio[0].assunto) && /Ainda não fez a simulação\./.test(a.correio[0].corpo), 'lista de espera: só o aviso interno');
  a.post(Object.assign(base('S50', 'Bruno Lima', 'bruno@exemplo.com'), sim, { modo: 'lista + simulador', relatorio: rel }));
  a.post(Object.assign(base('S50', 'Bruno Lima', 'bruno@exemplo.com'), sim, { modo: 'lista + simulador', relatorio: rel, vida_global_usd: 999999 }));
  ok(a.correio.filter(m => m.para === 'bruno@exemplo.com').length === 1 && doAviso(a).length === 2 && a.dados.length === 2, 'depois faz o simulador: 1 plano e mais 1 aviso; refazer não repete nem cria linha nova');
  a.post(Object.assign(base('S50', 'Bruno Lima', 'bruno@exemplo.com'), sim, { interesse_consultoria: 'sim', patrimonio_faixa: 'De R$ 1 a 5 milhões', consultoria_mensagem: 'Quero organizar a mudança.' }));
  ok(doAviso(a).length === 3 && /^Aplicação Consultoria Global: Bruno Lima/.test(doAviso(a)[2].assunto) && /De R\$ 1 a 5 milhões/.test(doAviso(a)[2].corpo), 'aplicação da Consultoria: aviso com a faixa de patrimônio'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  ok(a.post(Object.assign(base('S70', 'Spam', 'spam@exemplo.com'), { empresa: 'ACME' })).ok === true && a.correio.length === 0 && a.dados.length === 0, 'robô (campo escondido preenchido): nada é gravado nem enviado');
  ok(a.post(Object.assign(base('S71', 'Sem Email', 'semarroba'), { modo: 'lista de espera' })).erro === 'email' && a.correio.length === 0, 'e-mail inválido é recusado');
  ok(a.post(simulador('S72', { consentimento: 'não' })).ok === true && !doPlano(a) && doAviso(a).length === 1, 'sem aceite: a linha entra e o aviso sai, mas o plano não é enviado'); }

secao('aviso ao OS');
{
  const osGs = path.join(pasta, 'Os.gs'), URL_OS = 'https://os.exemplo.com/leads/projeto-2050', SEGREDO = 'segredo-de-mentira-123';
  const PROPS_OS = { OS_URL: URL_OS, OS_SEGREDO: SEGREDO };
  const CAMPOS = ['id', 'nome', 'email', 'whatsapp', 'consentimento', 'consentimento_texto', 'interesse_jovem', 'interesse_consultoria', 'baixou_pdf', 'estado_brasil', 'custo_mensal_brl', 'destino', 'estado_eua', 'idade', 'idade_renda', 'investido_brl', 'pct_dolar', 'aporte_brl', 'vida_global_usd', 'vida_global_brl', 'ritmo_pct', 'aporte_extra_brl', 'vida_global_brasil_usd', 'patrimonio_faixa', 'consultoria_mensagem', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'indicado_por', 'referrer', 'dispositivo', 'instagram_app', 'criado_em', 'atualizado_em', 'email_enviado'];
  const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
  const todos = [];
  const osOk = (url, op) => ({ codigo: 200, corpo: { gravadas: JSON.parse(op.payload).linhas.map(l => l.id), recusadas: [] } });
  const novo = (props, os, extra) => { const a = criar(Object.assign({ receptor, pdf: null, osGs, os, propriedades: props }, extra)); todos.push(a); return a; };
  const pessoa = (id, extra) => Object.assign(base(id, 'Pessoa ' + id, id.toLowerCase() + '@exemplo.com'), { modo: 'lista de espera' }, extra);
  const celula = (a, linha, nome) => a.dados[linha][a.dados[0].indexOf(nome)] ?? '';   // célula não escrita lê como vazia, como no Sheets
  const mesmoInstante = (x, y) => !!x && !!y && typeof x.getTime === 'function' && typeof y.getTime === 'function' && x.getTime() === y.getTime();
  const ids = c => c.corpo.linhas.map(l => l.id);
  const espera = ms => { const t = Date.now(); while (Date.now() - t < ms); };

  { const a = novo({}, osOk);
    ok(a.post(pessoa('N1')).ok === true && a.chamadas.length === 0 && a.registro.includes('log: OS não configurado') && a.erros.length === 0, 'sem as propriedades: o envio é aceito, nenhuma chamada, o registro diz "OS não configurado"'); }
  for (const url of ['http://os.exemplo.com/leads', 'os.exemplo.com/leads']) {
    const a = novo({ OS_URL: url, OS_SEGREDO: SEGREDO }, osOk);
    a.post(pessoa('N2'));
    ok(a.chamadas.length === 0 && a.erros.length === 0, 'OS_URL que não começa com https: nenhuma chamada (' + url + ')'); }
  { const a = novo({ OS_URL: URL_OS }, osOk);
    a.post(pessoa('N3'));
    ok(a.chamadas.length === 0, 'só OS_URL, sem o segredo: nenhuma chamada'); }

  { const a = novo(PROPS_OS, osOk);
    ok(a.post(simulador('A1', { utm_medium: 'bio' })).ok === true && a.chamadas.length === 1, 'com as duas propriedades: uma chamada ao OS');
    const c = a.chamadas[0] || { cabecalhos: {}, corpo: { linhas: [{}] } }, l = c.corpo.linhas[0];
    ok(c.url === URL_OS && c.cabecalhos.Authorization === 'Bearer ' + SEGREDO, 'a URL é a da propriedade e o cabeçalho é Bearer com o segredo');
    ok(c.corpo.linhas.length === 1 && l.id === 'A1', 'a linha enviada é a da pessoa');
    ok(Object.keys(l).every(k => CAMPOS.includes(k)) && !['relatorio', 'empresa', 'pagina', 'modo'].some(k => k in l), 'só campos da lista do contrato: sem relatorio, empresa, pagina nem modo');
    ok(Object.values(l).every(v => typeof v === 'string') && l.custo_mensal_brl === '20000' && l.consentimento === 'sim', 'todo valor é texto, número com ponto decimal como String() dá');
    ok(ISO.test(l.atualizado_em) && ISO.test(l.criado_em), 'atualizado_em e criado_em em ISO');
    ok(c.travaPresa === false, 'a chamada ao OS acontece sem a trava do script presa');
    ok(mesmoInstante(celula(a, 1, 'os_enviado_em'), celula(a, 1, 'atualizado_em')) && celula(a, 1, 'os_erro') === '', 'na planilha: os_enviado_em é o atualizado_em enviado e os_erro está vazio');
    ok(a.erros.length === 0, 'sem erro no registro'); }

  { const a = novo(PROPS_OS, osOk);
    ok(a.post(pessoa('Q1', { consentimento: 'não' })).ok === true && a.chamadas.length === 0, 'pessoa sem aceite: nenhuma chamada'); }

  { let estado = 500;
    const a = novo(PROPS_OS, (url, op) => { if (estado === 'cai') throw new Error('sem rede'); return estado === 500 ? { codigo: 500, corpo: 'erro' } : osOk(url, op); });
    ok(a.post(pessoa('F1')).ok === true && a.chamadas.length === 1 && celula(a, 1, 'os_enviado_em') === '' && a.erros.length === 0, 'OS responde 500: o envio é aceito, nada é anotado, sem erro no registro');
    estado = 'cai'; a.avancarCache(121);   // a falha anterior deixou o aviso em pausa
    ok(a.post(pessoa('F2')).ok === true && a.chamadas.length === 2 && celula(a, 2, 'os_enviado_em') === '' && a.erros.length === 0, 'OS fora do ar (a chamada lança): o envio é aceito, nada é anotado, sem erro no registro');
    estado = 200; a.avancarCache(121);
    a.post(pessoa('F3'));
    const c = a.chamadas[2];
    ok(a.chamadas.length === 3 && ids(c)[0] === 'F3' && ids(c).slice().sort().join() === 'F1,F2,F3', 'no envio seguinte vão as três linhas, com a da vez em primeiro');
    ok([1, 2, 3].every(i => mesmoInstante(celula(a, i, 'os_enviado_em'), celula(a, i, 'atualizado_em'))), 'e as três ficam anotadas'); }

  for (const [rot, corpo] of [['texto que não é JSON', 'não é json'], ['JSON sem as listas', { gravadas: 'F4' }]]) {
    const a = novo(PROPS_OS, () => ({ codigo: 200, corpo }));
    a.post(pessoa('F4')); a.avancarCache(121);
    ok(a.post(pessoa('F5')).ok === true && celula(a, 1, 'os_enviado_em') === '' && celula(a, 2, 'os_enviado_em') === '' && a.erros.length === 0 && a.chamadas.length === 2 && ids(a.chamadas[1]).length === 2, 'resposta 200 com ' + rot + ': é falha, nada anotado, as duas linhas vão de novo'); }

  { let recusar = true;
    const a = novo(PROPS_OS, (url, op) => { const g = JSON.parse(op.payload).linhas.map(l => l.id); return recusar && g.includes('R1') ? { codigo: 200, corpo: { gravadas: g.filter(i => i !== 'R1'), recusadas: [{ id: 'R1', motivo: 'email' }] } } : osOk(url, op); });
    a.post(pessoa('R1'));
    ok(celula(a, 1, 'os_erro') === 'email' && mesmoInstante(celula(a, 1, 'os_enviado_em'), celula(a, 1, 'atualizado_em')), 'linha recusada: o motivo vai para os_erro e o envio é anotado');
    a.post(pessoa('R2'));
    ok(a.chamadas.length === 2 && ids(a.chamadas[1]).join() === 'R2', 'o envio seguinte de outra pessoa não reenvia a recusada');
    recusar = false; espera(3);
    a.post(pessoa('R1', { nome: 'Pessoa R1 de novo' }));
    ok(ids(a.chamadas[2]).join() === 'R1' && celula(a, 1, 'os_erro') === '', 'quando a própria pessoa manda de novo, ela vai outra vez'); }

  { let mexer = true;
    const a = novo(PROPS_OS, (url, op) => { if (mexer) { mexer = false; espera(3); a.post(pessoa('M1', { consultoria_mensagem: 'campo novo' })); } return osOk(url, op); });
    a.post(pessoa('M1'));
    ok(a.chamadas.length === 2 && !mesmoInstante(celula(a, 1, 'os_enviado_em'), celula(a, 1, 'atualizado_em')), 'a linha muda durante o envio: a anotação fica diferente de atualizado_em');
    a.post(pessoa('M2'));
    const c = a.chamadas[2], m = c && c.corpo.linhas.find(l => l.id === 'M1');
    ok(!!m && m.consultoria_mensagem === 'campo novo' && ids(c)[0] === 'M2', 'o aviso seguinte manda essa linha de novo, já com a mudança');
    ok(a.erros.length === 0, 'sem erro no registro'); }

  { const a = novo(PROPS_OS, osOk);
    a.travaOcupada = true;
    ok(a.post(pessoa('T1')).ok === true && a.chamadas.length === 0 && a.erros.length === 0 && a.dados.length === 2, 'trava ocupada: o envio é gravado, nenhuma chamada, sem erro');
    a.travaOcupada = false;
    a.post(pessoa('T2'));
    ok(a.chamadas.length === 1 && ids(a.chamadas[0]).join() === 'T2,T1', 'solta a trava, a linha que ficou para trás vai no aviso seguinte'); }

  { const a = novo({}, osOk);
    for (let i = 1; i <= 60; i++) a.post(pessoa('P' + i));
    Object.assign(a.props, PROPS_OS);
    a.ctx.mandarTudo();
    ok(a.chamadas.map(c => c.corpo.linhas.length).join() === '25,25,10' && a.chamadas.every(c => !c.travaPresa), 'mandarTudo: três chamadas (25, 25 e 10), sem a trava presa');
    ok(a.dados.slice(1).every((_, i) => mesmoInstante(celula(a, i + 1, 'os_enviado_em'), celula(a, i + 1, 'atualizado_em'))) && a.registro.includes('log: OS: 60 linhas enviadas, 0 recusadas'), 'as 60 ficam anotadas e o registro conta 60 enviadas');
    a.ctx.mandarTudo();
    ok(a.chamadas.length === 3 && a.erros.length === 0, 'um segundo mandarTudo não faz nenhuma chamada'); }

  { const a = novo(Object.assign({}, PROPS, PROPS_OS), osOk);
    a.post(simulador('PD1'));
    const avisos = a.correio.length, antes = a.dados[1].slice(), cab = a.dados[0].slice();
    espera(3);
    ok(a.post({ id: 'PD1', email: 'ana@exemplo.com', baixou_pdf: 'sim' }).ok === true, 'o aviso do PDF é aceito');
    ok(a.correio.length === avisos, 'o aviso do PDF não manda outro plano nem aviso interno');
    ok(celula(a, 1, 'consentimento_texto') === antes[cab.indexOf('consentimento_texto')] && celula(a, 1, 'modo') === 'simulador' && celula(a, 1, 'baixou_pdf') === 'sim', 'cria a coluna baixou_pdf e não muda o texto do aceite nem o modo');
    const primeira = a.chamadas[0].corpo.linhas[0], c = a.chamadas[a.chamadas.length - 1];
    ok(!('baixou_pdf' in primeira) && a.chamadas.length === 2 && c.corpo.linhas[0].id === 'PD1' && c.corpo.linhas[0].baixou_pdf === 'sim' && c.corpo.linhas[0].vida_global_usd === '960176', 'a linha que vai ao OS leva baixou_pdf "sim" e mantém a simulação'); }

  // OS de mentira com o teto real: 413 acima de 256 KB ou de 25 linhas. maior guarda o maior corpo que chegou.
  const osComTeto = (estado) => { const o = (url, op) => {
    const n = Buffer.byteLength(op.payload), qtd = JSON.parse(op.payload).linhas.length;
    o.maior = Math.max(o.maior, n);
    if (estado.fora) return { codigo: 500, corpo: 'erro' };
    return n > 256 * 1024 || qtd > 25 ? { codigo: 413, corpo: 'grande' } : osOk(url, op);
  }; o.maior = 0; return o; };
  const anotada = (a, i) => mesmoInstante(celula(a, i, 'os_enviado_em'), celula(a, i, 'atualizado_em'));
  const TEXTOS = ['nome', 'whatsapp', 'consentimento_texto', 'estado_brasil', 'destino', 'estado_eua', 'patrimonio_faixa', 'consultoria_mensagem', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'indicado_por', 'referrer', 'dispositivo', 'instagram_app', 'interesse_jovem', 'interesse_consultoria'];

  // lote por tamanho
  { const estado = { fora: true }, os = osComTeto(estado), a = novo(PROPS_OS, os);
    const cheio = '"\u0001'.repeat(250);   // 500 caracteres, 2000 bytes no JSON
    for (let i = 1; i <= 10; i++) a.post(pessoa('B' + i, Object.assign({}, ...TEXTOS.map(t => ({ [t]: cheio })))));
    estado.fora = false; a.avancarCache(121);
    ok(a.post(pessoa('BN')).ok === true && ids(a.chamadas[a.chamadas.length - 1])[0] === 'BN' && anotada(a, 11), 'dez linhas pesadas pendentes: a pessoa normal é anotada como enviada naquele mesmo aviso');
    ok(os.maior < 256 * 1024 && os.maior > 0, 'nenhuma chamada passa de 256 KB (maior: ' + os.maior + ' bytes)');
    a.ctx.mandarTudo();
    ok(a.dados.slice(1).every((_, i) => anotada(a, i + 1)) && os.maior < 256 * 1024 && a.erros.length === 0, 'depois de mandarTudo, todas as linhas estão anotadas, sem chamada acima do teto'); }
  { const a = novo({}, osOk);
    a.post(pessoa('G1')); a.post(pessoa('G2'));
    a.dados[1][a.dados[0].indexOf('nome')] = '\u0001'.repeat(60000);   // 360 KB no JSON: sozinha passa do teto
    Object.assign(a.props, PROPS_OS);
    a.post(pessoa('G3'));
    ok(a.chamadas.length === 1 && ids(a.chamadas[0]).join() === 'G3,G2', 'linha que sozinha passa do teto fica fora do lote e não trava as outras');
    ok(celula(a, 1, 'os_erro') === 'grande demais' && anotada(a, 1) && anotada(a, 2) && anotada(a, 3), 'a grande demais é anotada com o motivo; as outras, como enviadas');
    a.ctx.mandarTudo();
    ok(a.chamadas.length === 1, 'e nenhuma chamada nova depois'); }

  // pausa depois de falha
  { let estado = 'falha';
    const a = novo(PROPS_OS, (url, op) => estado === 'falha' ? { codigo: 500, corpo: 'erro' } : osOk(url, op));
    a.post(pessoa('Z1'));
    estado = 'ok';
    ok(a.post(pessoa('Z2')).ok === true && a.post(pessoa('Z3')).ok === true && a.chamadas.length === 1, 'depois de uma falha, os dois envios seguintes não chamam o OS e respondem ok');
    a.avancarCache(119);
    a.post(pessoa('Z3b'));
    ok(a.chamadas.length === 1, 'antes dos 120 segundos, a pausa segue');
    a.avancarCache(2);
    a.post(pessoa('Z4'));
    ok(a.chamadas.length === 2 && ids(a.chamadas[1]).slice().sort().join() === 'Z1,Z2,Z3,Z3b,Z4' && a.dados.slice(1).every((_, i) => anotada(a, i + 1)), 'passada a pausa, o envio seguinte chama o OS e manda todas as pendentes'); }
  { let estado = 'falha';
    const a = novo(PROPS_OS, (url, op) => estado === 'falha' ? { codigo: 500, corpo: 'erro' } : osOk(url, op));
    a.post(pessoa('Y1')); a.post(pessoa('Y2'));
    estado = 'ok';
    a.ctx.mandarTudo();
    ok(a.chamadas.length === 2 && anotada(a, 1) && anotada(a, 2), 'mandarTudo ignora a pausa');
    a.post(pessoa('Y3'));
    ok(a.chamadas.length === 3 && anotada(a, 3), 'e um envio que dá certo apaga a pausa'); }

  // leitura enxuta
  { const a = novo({}, osOk);
    for (let i = 1; i <= 60; i++) a.post(pessoa('L' + i));
    Object.assign(a.props, PROPS_OS);
    a.ctx.mandarTudo();
    Object.keys(a.props).forEach(k => delete a.props[k]);
    a.post(pessoa('L61'));
    Object.assign(a.props, PROPS_OS);
    a.leituras.length = 0;
    const r = a.ctx.osPendentes(25, null, 0);
    ok(r.length === 1 && r[0].id === 'L61', 'com 60 enviadas e uma pendente, osPendentes devolve só a pendente');
    ok(a.leituras.every(l => l.nr === 1 || l.nc === 1) && a.leituras.filter(l => l.nc > 1).length <= 2, 'osPendentes não lê a aba inteira: colunas soltas, o cabeçalho e uma linha (' + a.leituras.length + ' leituras)'); }

  // id repetido
  { const a = novo({}, osOk);
    a.post(pessoa('D1')); a.post(pessoa('D3'));
    const cab = a.dados[0], velha = a.dados[1].slice();
    const nova = velha.slice(); nova[cab.indexOf('atualizado_em')] = new Date(velha[cab.indexOf('atualizado_em')].getTime() + 5000);
    a.dados.push(nova);
    Object.assign(a.props, PROPS_OS);
    a.post(pessoa('D2'));
    a.ctx.mandarTudo();
    const vezes = a.chamadas.flatMap(c => ids(c)).filter(i => i === 'D1').length;
    ok(vezes === 1 && [1, 2, 3, 4].every(i => anotada(a, i)), 'duas linhas com o mesmo id: as duas ficam anotadas e o OS recebe o id uma vez só');
    ok(celula(a, 1, 'os_erro') === 'id repetido' && celula(a, 3, 'os_erro') === '', 'a mais antiga leva "id repetido"; a mais nova segue como enviada');
    const antes = a.chamadas.length;
    a.ctx.mandarTudo();
    ok(a.chamadas.length === antes, 'um segundo mandarTudo não faz nenhuma chamada'); }
  { // a linha mudou de lugar durante o envio (outra foi apagada): a anotação segue o id
    let apagou = false;
    const a = novo(PROPS_OS, (url, op) => { if (!apagou) { apagou = true; a.dados.splice(1, 1); } return osOk(url, op); });
    a.travaOcupada = true; a.post(pessoa('E1')); a.post(pessoa('E2')); a.travaOcupada = false;
    a.post(pessoa('E3'));
    ok(a.dados.length === 3 && anotada(a, 1) && anotada(a, 2), 'linha apagada durante o envio: as outras são anotadas pelo id, na posição nova'); }

  // POST não escreve as colunas do OS
  { let estado = 'ok';
    const a = novo(PROPS_OS, (url, op) => estado === 'ok' ? osOk(url, op) : { codigo: 500, corpo: 'erro' });
    a.post(pessoa('X1'));
    const env = celula(a, 1, 'os_enviado_em');
    estado = 'fora'; espera(3);
    a.post(pessoa('X1', { os_enviado_em: 'x', os_erro: 'y' }));
    ok(a.dados.length === 2 && celula(a, 1, 'os_enviado_em') === env && celula(a, 1, 'os_erro') === '', 'um POST mandando os_enviado_em e os_erro não muda as duas células'); }
  { const a = novo({}, osOk);
    a.post(pessoa('X2', { os_enviado_em: 'x', os_erro: 'y' }));
    ok(!a.dados[0].includes('os_enviado_em') && !a.dados[0].includes('os_erro'), 'sem as colunas, um POST com esses campos não as cria'); }

  // casos que não chamam o OS
  { const a = novo(PROPS_OS, osOk);
    ok(a.post(pessoa('V1', { empresa: 'ACME' })).ok === true && a.post(pessoa('V2', { email: 'semarroba' })).erro === 'email' && a.post(Object.assign(pessoa('V3'), { id: '' })).erro === 'id' && a.chamadas.length === 0, 'robô, e-mail inválido e id inválido: nenhuma chamada ao OS'); }

  // exceção dentro do Os.gs
  { const a = novo(PROPS_OS, osOk), original = a.ctx.garantirColunas;
    let n = 0;
    a.ctx.garantirColunas = (...x) => { if (++n === 2) throw new Error('quebrou'); return original(...x); };   // a 2ª chamada é a do Os.gs, com a trava presa
    ok(a.post(pessoa('W1')).ok === true && a.erros.length === 1, 'exceção dentro do Os.gs: o doPost responde ok e a exceção vai para o registro');
    ok(a.post(pessoa('W2')).ok === true && a.chamadas.length === 1 && a.erros.length === 1, 'e a trava não ficou presa: o envio seguinte funciona'); }

  { const codigo = fs.readFileSync(osGs, 'utf8'), ignore = fs.readFileSync(path.join(pasta, '..', '.claspignore'), 'utf8');
    ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(codigo) && !/https:\/\//.test(codigo), 'Os.gs não tem endereço de e-mail nem endereço https (o repositório é público)');
    ok(/^!Os\.gs$/m.test(ignore), 'o .claspignore libera o Os.gs'); }

  const vazou = todos.flatMap(a => a.registro).filter(l => /@|Pessoa |Ana|segredo-de-mentira/.test(l));
  ok(vazou.length === 0, 'o registro de todos esses casos não tem e-mail, nome nem segredo' + (vazou.length ? ': ' + vazou[0].slice(0, 120) : ''));
}

secao('aviso ao OS: linha trocada de lugar no meio da leitura');
{ const chamadas = [], osGs = path.join(pasta, 'Os.gs');
  const a = criar({ receptor, pdf, osGs, propriedades: Object.assign({}, PROPS, { OS_URL: 'https://os.exemplo.com/leads/projeto-2050', OS_SEGREDO: 'segredo-de-teste' }),
    os: (url, o) => { chamadas.push(JSON.parse(o.payload)); return { codigo: 200, corpo: JSON.stringify({ gravadas: JSON.parse(o.payload).linhas.map(l => l.id), recusadas: [] }) }; } });
  a.props.OS_URL = '';                                   // grava duas pessoas sem avisar o OS
  a.post(simulador('T1')); a.post(simulador('T2', { consentimento: 'não', email: 'outra@exemplo.com' }));
  a.props.OS_URL = 'https://os.exemplo.com/leads/projeto-2050';
  // alguém apaga à mão a linha de T1 depois de as quatro colunas terem sido lidas: a posição passa a ser a de T2, que não tem aceite
  const aba = a.abas.Leads, original = aba.getRange.bind(aba); let leiturasDeLinha = 0;
  aba.getRange = (r, c, nr, nc) => { if (nr === 1 && nc > 4 && r > 1 && ++leiturasDeLinha === 1) aba.dados.splice(1, 1); return original(r, c, nr, nc); };
  a.ctx.avisarOS('T1');
  ok(chamadas.every(c => c.linhas.every(l => l.id !== 'T2' && l.consentimento === 'sim')), 'a linha de outra pessoa, sem aceite, não vai ao OS quando a planilha muda de lugar no meio da leitura'); }
secao('linha só do dono (o id aparece no link de compartilhar)');
const linhas = a => a.dados.slice(1).map(l => Object.fromEntries(a.dados[0].map((c, i) => [c, l[i]])));
const CHAVE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90', OUTRA = '00112233445566778899aabbccddeeff';
const vitima = (id, extra) => simulador(id, Object.assign({ nome: 'Vitória Dona', whatsapp: '48911112222' }, extra));
const ataque = (id, extra) => Object.assign(base(id, '', 'ana@exemplo.com'), { modo: 'lista de espera' }, extra);
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(vitima('D1', { chave: CHAVE }));
  ok(linhas(a)[0].chave === CHAVE, 'linha nova com chave grava a chave');
  a.post(vitima('D1', { chave: CHAVE, email: 'ana.nova@exemplo.com' }));
  ok(linhas(a).length === 1 && linhas(a)[0].email === 'ana.nova@exemplo.com' && linhas(a)[0].id === 'D1', 'mesmo id e mesma chave, outro e-mail: atualiza a mesma linha'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(vitima('D2', { chave: CHAVE }));
  const antes = JSON.stringify(a.dados.slice(1));
  ok(a.post(ataque('D2', { chave: OUTRA })).ok === true, 'chave errada com o e-mail da vítima: o envio é aceito');
  const [v, outra] = linhas(a);
  ok(JSON.stringify(a.dados.slice(1, 2)) === antes, 'a linha da vítima fica idêntica');
  ok(linhas(a).length === 2 && outra.id !== 'D2' && outra.nome !== 'Vitória Dona' && outra.whatsapp !== '48911112222' && outra.chave === OUTRA, 'nasce uma segunda linha, com outro id e sem o nome nem o WhatsApp da vítima');
  a.post(ataque('D2', { chave: OUTRA }));
  ok(linhas(a).length === 2, 'repetir o envio cai na mesma segunda linha');
  a.post(ataque('D2'));
  ok(linhas(a).length === 3 && JSON.stringify(a.dados.slice(1, 2)) === antes, 'sem chave, numa linha que tem chave: também não é dono'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(vitima('D4'));   // linha antiga, sem chave
  ok(linhas(a)[0].chave === '', 'envio sem chave: a linha fica sem chave');
  a.post(vitima('D4', { chave: CHAVE }));
  ok(linhas(a).length === 1 && linhas(a)[0].chave === CHAVE, 'linha antiga, mesmo e-mail, com chave: atualiza e adota a chave');
  a.post(ataque('D4'));
  ok(linhas(a).length === 2 && linhas(a)[0].nome === 'Vitória Dona', 'depois da adoção, o mesmo e-mail sem chave não atualiza mais a linha'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(vitima('D5'));
  const antes = JSON.stringify(a.dados.slice(1));
  a.post(ataque('D5', { email: 'intruso@exemplo.com', interesse_consultoria: 'sim' }));
  const [v, outra] = linhas(a);
  ok(JSON.stringify(a.dados.slice(1, 2)) === antes && linhas(a).length === 2, 'linha antiga, outro e-mail: a linha da vítima fica intacta');
  ok(outra.email === 'intruso@exemplo.com' && outra.nome === '' && outra.whatsapp !== '48911112222' && outra.id !== 'D5' && outra.interesse_consultoria === 'sim', 'a linha derivada não herda nome nem WhatsApp da vítima');
  ok(/^S[0-9A-F]{14}$/.test(outra.id), 'o id derivado é S + 14 hexadecimais maiúsculos (' + outra.id + ')');
  ok(doAviso(a).some(m => m.corpo.includes('intruso@exemplo.com') && m.corpo.includes('Consultoria')), 'o aviso da aplicação sai com o que o envio trouxe'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(vitima('D6', { chave: '=CMD()' }));
  a.post(vitima('D7', { chave: 'abc12' }));
  ok(linhas(a).length === 2 && linhas(a).every(l => l.chave === '') && !JSON.stringify(a.dados).includes('CMD') && !JSON.stringify(a.dados).includes('abc12'), 'chave fora do formato vale como ausente e não aparece em célula nenhuma');
  ok(a.erros.length === 0, 'sem erro no registro'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });   // alguém ocupa de antemão a linha derivada de uma página antiga do dono
  a.post(vitima('D8', { chave: CHAVE }));
  const derivado = 'S' + require('crypto').createHash('sha256').update('D8|ana@exemplo.com').digest('hex').slice(0, 14).toUpperCase();
  a.post(ataque(derivado, { chave: OUTRA, email: 'intruso@exemplo.com' }));
  const antes = JSON.stringify(a.dados.slice(1, 3));
  ok(a.post(vitima('D8', { nome: 'Vitória Página Antiga' })).ok === true, 'linha derivada já ocupada por outro: o envio é aceito');
  ok(linhas(a).length === 3 && JSON.stringify(a.dados.slice(1, 3)) === antes && linhas(a)[2].nome === 'Vitória Página Antiga' && /^S[0-9A-F]{14}$/.test(linhas(a)[2].id), 'e vira uma linha nova, sem tocar nas outras duas: o lead não se perde'); }
{ const a = criar({ receptor, pdf, propriedades: PROPS });
  a.post(Object.assign(vitima('D9'), { '=IMAGE("x")': 'a', 'Nome Com Espaço': 'b', campo_novo: 'c' }));
  ok(a.dados[0].indexOf('campo_novo') >= 0 && linhas(a)[0].campo_novo === 'c', 'campo novo com nome simples vira coluna');
  ok(a.dados[0].every(c => /^[a-z][a-z0-9_]*$/.test(c)), 'nome de campo fora do padrão não vira coluna (nada de fórmula no cabeçalho)'); }
{ const chamadas = [], osGs = path.join(pasta, 'Os.gs');   // o ataque do link compartilhado, com o OS ligado
  const a = criar({ receptor, pdf, osGs, propriedades: Object.assign({}, PROPS, { OS_URL: 'https://os.exemplo.com/leads/projeto-2050', OS_SEGREDO: 'segredo-de-teste' }),
    os: (url, o) => { chamadas.push(JSON.parse(o.payload)); return { codigo: 200, corpo: JSON.stringify({ gravadas: JSON.parse(o.payload).linhas.map(l => l.id), recusadas: [] }) }; } });
  a.post(vitima('D10', { chave: CHAVE }));
  a.post(ataque('D10', { email: 'intruso@exemplo.com', interesse_consultoria: 'sim', whatsapp: '' }));
  const idas = chamadas.flatMap(c => c.linhas), doIntruso = idas.filter(l => l.email === 'intruso@exemplo.com');
  ok(doIntruso.length === 1 && doIntruso[0].id !== 'D10' && doIntruso[0].interesse_consultoria === 'sim', 'com o OS ligado, o envio de quem não é dono chega como outra pessoa, com outro id');
  ok(!JSON.stringify(doIntruso).includes('Vitória') && !JSON.stringify(doIntruso).includes('48911112222'), 'e sem o nome nem o WhatsApp da vítima');
  ok(idas.filter(l => l.id === 'D10').every(l => l.email === 'ana@exemplo.com' && l.interesse_consultoria !== 'sim'), 'a pessoa da vítima segue no OS com o e-mail dela e sem a marca da Consultoria');
  ok(!JSON.stringify(chamadas).includes(CHAVE) && idas.every(l => !('chave' in l)), 'a chave nunca vai ao OS'); }

secao('o que está no repositório');
{ const codigo = fs.readFileSync(receptor, 'utf8'), pacote = fs.readFileSync(pdf, 'utf8');
  ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(codigo), 'Código.gs não tem endereço de e-mail (o repositório é público)');
  const html = fs.readFileSync(path.join(pasta, '..', 'index.html'), 'utf8'), i = html.indexOf('/* PDF-INICIO */'), f = html.indexOf('/* PDF-FIM */');
  const desenho = i >= 0 && f > i ? html.slice(i, f + '/* PDF-FIM */'.length).replace(/window\.PDF_AVATAR/g, 'PDF_AVATAR') : null;
  ok(!!desenho && pacote.includes(desenho), 'o desenho do PDF no Pdf.gs é o mesmo do index.html (se falhar: node receptor/ferramentas/montar-pdf.js)');
  const sri = (html.match(/sc\.integrity = "sha384-([^"]+)"/) || [])[1];
  ok(!!sri && pacote.includes('sha384-' + sri), 'o jsPDF do Pdf.gs é a versão que a página carrega'); }

console.log('\n' + feitos + ' verificações, ' + (falhas ? falhas + ' FALHA(S)' : 'todas certas'));
process.exit(falhas ? 1 : 0);
