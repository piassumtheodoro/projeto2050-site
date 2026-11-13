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
