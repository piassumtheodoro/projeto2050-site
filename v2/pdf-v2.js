/* Relatório em PDF do Projeto 2050, versão 2 (a cara das peças do Tiago).
   COMO INTEGRAR NO index.html DA V2
   1. Troque tudo o que está entre os marcadores PDF-INICIO e PDF-FIM pelo conteúdo deste arquivo (a partir da função, sem este comentário).
      A assinatura e os dados são os mesmos: desenharRelatorio(doc, dadosRelatorio()). Nada de fora é usado.
   2. Em carregarJsPDF, depois de carregar o jsPDF, carregue também pdf-fontes.js (fontes e avatar em base64). Troque o onload por:
        sc.onload = () => { const f = document.createElement("script"); f.src = "pdf-fontes.js"; f.onload = f.onerror = ok; document.head.appendChild(f); };
      Se o arquivo não carregar, o PDF sai em Times (número) e Helvetica, sem quebrar.
   3. Texto do PDF igual ao da versão atual. O botão "Abra sua conta global" só aparece quando d.ctaUrl aponta para fora do próprio site (d.site). */
function desenharRelatorio(doc, d){
  const W = 210, M = 14, CW = W - 2 * M;
  const C = {
    tinta:[11,13,14], papel:[244,245,246], grade:[231,232,233], azul:[39,22,233], lilas:[179,173,248], fio:[139,130,245],
    apoio:[99,105,110], apoioT:[141,147,155], filete:[219,222,225], trilho:[213,216,220], dado:[185,190,196], base:[185,187,188],
    pilula:[27,30,33], pilulaBorda:[51,56,62]
  };
  const n0 = v => Math.round(v).toLocaleString("pt-BR");
  const usd = v => "US$ " + n0(v), brl = v => "R$ " + n0(v), pc = v => Math.round(v * 100) + "%";

  /* fontes: as embutidas (pdf-fontes.js) ou, se faltarem, Times no lugar da serifa e Helvetica no resto */
  let comFontes = false;
  try{
    if (typeof registrarFontesPDF === "function" && registrarFontesPDF(doc)){
      const l = doc.getFontList(); comFontes = !!(l["Figtree"] && l["Hedvig Letters Serif"]);
    }
  }catch(e){ comFontes = false; }
  const FONTE = comFontes
    ? { serifa:["Hedvig Letters Serif","normal"], texto:["Figtree","normal"], forte:["Figtree","bold"] }
    : { serifa:["times","normal"], texto:["helvetica","normal"], forte:["helvetica","bold"] };
  const usa = (f, s) => { const p = FONTE[f || "texto"]; doc.setFont(p[0], p[1]); doc.setFontSize(s); };
  const larg = (t, f, s) => { usa(f, s); return doc.getTextWidth(String(t)); };

  const fundo = c => doc.setFillColor(c[0], c[1], c[2]);
  const traco = c => doc.setDrawColor(c[0], c[1], c[2]);
  const txt = (t, x, y, o) => {
    o = o || {}; usa(o.f, o.s || 8);
    const c = o.c || C.tinta; doc.setTextColor(c[0], c[1], c[2]);
    doc.text(String(t), x, y, { align: o.a || "left" });
  };
  /* uma linha só: encolhe até o mínimo e, se ainda passar, corta com reticências */
  const caber = (t, x, y, o) => {
    t = String(t); let s = o.s;
    while (larg(t, o.f, s) > o.w && s > (o.min || s - 1.5)) s -= 0.1;
    if (larg(t, o.f, s) > o.w){ while (t.length > 1 && larg(t + "…", o.f, s) > o.w) t = t.slice(0, -1); t = t.trimEnd() + "…"; }
    txt(t, x, y, Object.assign({}, o, { s })); return s;
  };
  /* quebra em linhas pela largura (para frase que pode passar de uma linha) */
  const quebra = (t, f, s, w) => {
    const out = []; let linha = "";
    String(t).split(" ").forEach(p => { const tent = linha ? linha + " " + p : p; if (larg(tent, f, s) > w && linha){ out.push(linha); linha = p; } else linha = tent; });
    if (linha) out.push(linha); return out;
  };
  const filete = (x, y, w) => { fundo(C.filete); doc.rect(x, y, w, 0.3, "F"); };
  const barra = (x, y, w, h, c, r) => {
    if (!(w > 0)) return; w = Math.max(w, 0.5); fundo(c);
    if (r && w > 2 * r) doc.roundedRect(x, y, w, h, r, r, "F"); else doc.rect(x, y, w, h, "F");
  };
  /* o endereço do botão é o do próprio site? então o botão não aparece */
  const limpa = u => String(u || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  const temBotao = !!d.ctaUrl && limpa(d.ctaUrl) !== limpa(d.site);

  /* fundos: o miolo é papel; as faixas de cima e de baixo são tinta; a grade só no miolo */
  fundo(C.papel); doc.rect(0, 0, W, 297, "F");
  fundo(C.tinta); doc.rect(0, 0, W, 82, "F"); doc.rect(0, 275, W, 22, "F");
  traco(C.grade); doc.setLineWidth(0.1);
  for (let x = 15; x <= 195; x += 15) doc.line(x, 90, x, 270);
  for (let y = 90; y <= 270; y += 15) doc.line(15, y, 195, y);

  /* faixa de cima: a pílula, o título e o número */
  const nome = "Tiago Piassum", textoX = comFontes && window.PDF_AVATAR ? 24 : 18.5;
  const pW = textoX - M + larg(nome, "forte", 8) + 5;
  fundo(C.pilula); traco(C.pilulaBorda); doc.setLineWidth(0.3); doc.roundedRect(M, 11, pW, 9, 4.5, 4.5, "FD");
  if (comFontes && window.PDF_AVATAR){ try{ doc.addImage(window.PDF_AVATAR, "JPEG", 15, 12, 7, 7); }catch(e){} }
  txt(nome, textoX, 17, { f:"forte", s:8, c:C.papel });
  txt("Projeto 2050", W - M, 17, { s:8, c:C.apoioT, a:"right" });
  txt("Sua vida global", M, 31, { f:"serifa", s:16, c:C.papel });
  caber((d.nome ? "Relatório de " + d.nome + " · " : "Relatório · ") + d.data, M, 37, { s:8.5, c:C.apoioT, w:CW, min:7 });
  caber("Patrimônio em dólar que paga a sua vida " + d.lugarEm, M, 46, { s:9, c:C.apoioT, w:CW, min:7 });
  let tn = 58; const numTxt = usd(d.numero);
  while (larg(numTxt, "serifa", tn) > CW && tn > 30) tn -= 1;
  txt(numTxt, M, 66, { f:"serifa", s:tn, c:C.lilas });
  const wn = larg(numTxt, "serifa", tn);
  traco(C.fio); doc.setLineWidth(0.7); doc.setLineCap("round");
  doc.lines([[wn / 3, -0.9, 2 * wn / 3, -0.9, wn, 0]], M, 69.8, [1, 1], "S", false);
  doc.setLineCap("butt");
  caber("Para viver de renda aos " + d.ret + ", em " + d.anoRenda + ". Cerca de " + d.numeroBRL + " no câmbio de hoje.", M, 76, { s:9.5, c:C.papel, w:CW, min:7.5 });

  /* três indicadores */
  [["Seu custo de vida hoje", brl(d.custo), "por mês, " + d.estadoEm],
   ["O mesmo padrão lá", usd(d.usdMes), "por mês, " + d.lugarEm],
   ["Tempo de estrada", d.anos + " anos", "dos " + d.age + " aos " + d.ret]].forEach((k, i) => {
    const x = M + i * 62, w = 58;
    filete(x, 88, w);
    caber(k[0], x, 93.5, { s:7.5, c:C.apoio, w, min:6.5 });
    caber(k[1], x, 102, { f:"serifa", s:19, w, min:12 });
    const ls = quebra(k[2], "texto", 7.5, w).length > 1 ? 6.8 : 7.5;
    quebra(k[2], "texto", ls, w).slice(0, 2).forEach((l, j) => txt(l, x, 107 + j * 3.2, { s:ls, c:C.apoio }));
  });

  /* gráfico 1: câmbio x poder de compra */
  const cw2 = 87, x2 = 109;
  filete(M, 114, cw2); txt("Câmbio x poder de compra · US$ por mês", M, 119.5, { f:"forte", s:8 });
  const maxA = Math.max(d.usdMes, d.cambioMes);
  txt("Pelo câmbio", M, 128, { s:8 }); txt(usd(d.cambioMes), M + cw2, 128, { f:"serifa", s:12, a:"right" });
  barra(M, 130.5, cw2 * d.cambioMes / maxA, 3, C.dado, 0.8);
  txt("Pelo poder de compra", M, 141, { s:8 }); txt(usd(d.usdMes), M + cw2, 141, { f:"serifa", s:12, c:C.azul, a:"right" });
  barra(M, 143.5, cw2 * d.usdMes / maxA, 3, C.azul, 0.8);
  const razao = d.usdMes / d.cambioMes;
  const frase1 = razao >= 1.005
    ? "Viver " + d.lugarEm + " custa " + razao.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 }) + (razao >= 2 ? " vezes" : " vez") + " o que o câmbio sugere."
    : "Viver " + d.lugarEm + " custa " + pc(1 - razao) + " menos do que o câmbio sugere.";
  quebra(frase1, "texto", 8, cw2).slice(0, 2).forEach((l, i) => txt(l, M, 153 + i * 3.6, { s:8 }));

  /* gráfico 2: quanto do caminho o ritmo de hoje cobre, um número e uma barra */
  filete(x2, 114, cw2); txt("Quanto do caminho o ritmo de hoje cobre", x2, 119.5, { f:"forte", s:8 });
  txt(pc(d.ritmo), x2, 136, { f:"serifa", s:34, c:C.azul });
  const gap = 0.6, by = 141, bh = 4, tot = cw2;
  const total = d.chegou ? Math.max(d.proj, d.inv, 1) : d.numero;       // a barra inteira é a vida global (ou a projeção, se passou dela)
  const wInv = d.inv > 0 ? Math.max(0.5, tot * Math.min(1, d.inv / total)) : 0;
  const wAp = Math.max(0, Math.min(tot, tot * Math.max(0, d.proj - d.inv) / total, tot - wInv - (wInv ? gap : 0)));
  let bx2 = x2;
  if (wInv){ barra(bx2, by, wInv, bh, C.tinta); bx2 += wInv + gap; }
  if (wAp > 0){ barra(bx2, by, wAp, bh, C.azul); bx2 += wAp + gap; }
  if (!d.chegou && bx2 < x2 + tot - 0.4){
    traco(C.apoio); doc.setLineWidth(0.3); doc.setLineDashPattern([1, 1], 0);
    doc.rect(bx2 + 0.15, by + 0.15, x2 + tot - bx2 - 0.3, bh - 0.3, "S"); doc.setLineDashPattern([], 0);
  }
  const leg = [];
  if (d.inv > 0) leg.push(["inv", "Já investido hoje", usd(d.inv)]);
  leg.push(["azul", "Aportes e rendimento até os " + d.ret, usd(d.proj - d.inv)]);
  leg.push(d.falta > 0 ? ["falta", "Falta para a vida global", usd(d.falta)] : ["azul", "Acima da vida global", usd(d.proj - d.numero)]);
  leg.forEach((l, i) => {
    const ly = 149.5 + i * 5;
    if (l[0] === "falta"){ traco(C.apoio); doc.setLineWidth(0.3); doc.setLineDashPattern([0.6, 0.5], 0); doc.rect(x2 + 0.15, ly - 2.05, 1.9, 1.9, "S"); doc.setLineDashPattern([], 0); }
    else { fundo(l[0] === "inv" ? C.tinta : C.azul); doc.rect(x2, ly - 2.2, 2.2, 2.2, "F"); }
    const wv = larg(l[2], "serifa", 9.5);
    txt(l[2], x2 + cw2, ly, { f:"serifa", s:9.5, a:"right" });
    caber(l[1], x2 + 4.5, ly, { s:7.5, c:C.apoio, w:cw2 - 4.5 - wv - 2, min:6 });
  });

  /* gráfico 3: patrimônio ano a ano, colunas retas */
  filete(M, 166, CW); txt("Seu patrimônio ano a ano · US$", M, 171.5, { f:"forte", s:8 });
  let lx = M + CW;
  [["Rendimento", C.azul], ["Seus aportes", C.tinta], ["Já investido", C.apoioT]].forEach(l => {
    if (l[0] === "Já investido" && !(d.inv > 0)) return;
    const w = larg(l[0], "texto", 7);
    txt(l[0], lx, 171.5, { s:7, a:"right", c:C.apoio }); fundo(l[1]); doc.rect(lx - w - 3.6, 169.3, 2.4, 2.4, "F"); lx -= w + 8;
  });
  const gx0 = M, gx1 = M + CW, gTopo = 176, gBase = 210, gh = gBase - gTopo, n = d.serie.length;
  const teto = Math.max(d.numero, d.proj) * 1.06, sy = v => gBase - gh * v / teto;
  const passo = n ? (gx1 - gx0) / n : 0, bw = Math.max(0.3, passo - 0.8);
  const topoCol = [];
  d.serie.forEach((p, i) => {
    const x = gx0 + i * passo + (passo - bw) / 2; let base = gBase;
    [[p.investido, C.apoioT], [p.aportes, C.tinta], [p.rendimento, C.azul]].forEach(parte => {
      const h = gh * parte[0] / teto; if (h > 0.05){ fundo(parte[1]); doc.rect(x, base - h, bw, h, "F"); base -= h; }
    });
    topoCol.push(base);
  });
  traco(C.base); doc.setLineWidth(0.4); doc.line(gx0, gBase, gx1, gBase);
  const yv = sy(d.numero);
  traco(C.tinta); doc.setLineWidth(0.3); doc.setLineDashPattern([1.4, 1.1], 0); doc.line(gx0, yv, gx1, yv); doc.setLineDashPattern([], 0);
  /* o rótulo da linha vai para onde as colunas ficam abaixo dele: à esquerda, senão à direita, senão sobre papel */
  const rv = "Vida global · " + usd(d.numero), wr = larg(rv, "forte", 7.5);
  const livre = (xa, xb) => d.serie.every((p, i) => { const cx = gx0 + i * passo; return cx + passo < xa || cx > xb || topoCol[i] > yv - 1.2; });
  const rx = livre(gx0, gx0 + wr) || !livre(gx1 - wr, gx1) ? gx0 : gx1 - wr;
  if (!livre(rx, rx + wr)){ fundo(C.papel); doc.rect(rx - 0.6, yv - 4.8, wr + 1.2, 3.8, "F"); }
  txt(rv, rx, yv - 1.6, { f:"forte", s:7.5 });
  const cada = n <= 12 ? 2 : n <= 30 ? 5 : 10;
  d.serie.forEach((p, i) => { if (i === 0 || i === n - 1 || (p.idade % cada === 0 && i > 1 && i < n - 2)) txt(p.idade + (i === 0 || i === n - 1 ? " anos" : ""), gx0 + i * passo + passo / 2, 215, { s:7, c:C.apoio, a: i === 0 ? "left" : i === n - 1 ? "right" : "center" }); });

  /* gráfico 4: alavancas */
  filete(M, 224, cw2); txt(d.chegou ? "Alavancas que aceleram a conta" : "Alavancas que fecham a conta", M, 229.5, { f:"forte", s:8 });
  const aw = 66, tetoA = Math.max(1, ...d.alavancas.map(a => a.r), d.ritmo), xh = M + aw * Math.min(d.ritmo, tetoA) / tetoA;
  const lista = d.alavancas.slice(0, 3);
  lista.forEach((a, i) => {
    const ay = 236 + i * 10;
    caber(a.t, M, ay, { s:8, w:aw, min:6.8 });
    barra(M, ay + 1.8, aw, 3, C.trilho, 0.8); barra(M, ay + 1.8, aw * Math.min(a.r, tetoA) / tetoA, 3, C.azul, 0.8);
    fundo(C.tinta); doc.rect(xh - 0.25, ay + 0.8, 0.5, 5, "F");           // até onde o ritmo de hoje chega
    txt(pc(a.r), M + cw2, ay + 4.8, { f:"serifa", s:13, a:"right" });
  });
  const rh = "ritmo de hoje: " + pc(d.ritmo);
  txt(rh, Math.max(M, Math.min(xh - larg(rh, "texto", 6.5) / 2, M + aw - larg(rh, "texto", 6.5))), 265, { s:6.5, c:C.apoio });

  /* gráfico 5: a mesma vida em outros lugares */
  filete(x2, 224, cw2); txt("A mesma vida em outros lugares · US$ por mês", x2, 229.5, { f:"forte", s:8 });
  const lugares = d.lugares.slice(0, 5), maxL = Math.max(...lugares.map(l => l.usd));
  const colV = Math.max(...lugares.map(l => larg(usd(l.usd), "serifa", 9.5))), bx = x2 + 29, bwMax = Math.min(36, x2 + cw2 - colV - 2.5 - bx);
  lugares.forEach((l, i) => {
    const yl = 236 + i * 6.5, f = l.sel ? "forte" : "texto";
    let s = 8; while (larg(l.nome, f, s) > 27.5 && s > 6.2) s -= 0.1;
    const ls = larg(l.nome, f, s) > 27.5 ? quebra(l.nome, f, 6.2, 27.5).slice(0, 2) : [l.nome];
    ls.forEach((t, j) => txt(t, x2, yl + (ls.length > 1 ? -0.4 + j * 2.6 : 0), { f, s: ls.length > 1 ? 6.2 : s }));
    barra(bx, yl - 2.2, bwMax * l.usd / maxL, 3, l.sel ? C.azul : C.dado, 0.8);
    txt(usd(l.usd), x2 + cw2, yl, { f:"serifa", s:9.5, a:"right" });
  });

  /* premissas */
  quebra(d.legal, "texto", 5.6, CW).slice(0, 3).forEach((l, i) => txt(l, M, 270 + i * 2.2, { s:5.6, c:C.apoio }));

  /* faixa de baixo: a conclusão e, quando há endereço próprio, o botão com área clicável */
  const bL = 66, bX = W - M - bL, bY = 279.5, bA = 13, lf = temBotao ? bX - M - 6 : CW;
  const frase = d.chegou ? "No ritmo de hoje, você passa da sua vida global." : "Com " + brl(d.extraBRL) + " a mais por mês, você chega a 100% aos " + d.ret + ".";
  caber(frase, M, 284, { f:"forte", s:10.5, c:C.papel, w:lf, min:8 });
  const refaz = "Refaça a conta em " + d.site;
  caber(refaz, M, 290.5, { s:8, c:C.apoioT, w:lf, min:7 });
  if (temBotao){
    fundo(C.papel); doc.roundedRect(bX, bY, bL, bA, 1.2, 1.2, "F");
    txt(d.ctaTexto, bX + 8, bY + 8, { f:"forte", s:9.5, c:C.tinta });
    const sX = bX + bL - 13, sY = bY + bA / 2;
    traco(C.tinta); doc.setLineWidth(0.5); doc.setLineCap("round");
    doc.line(sX, sY, sX + 5.5, sY); doc.line(sX + 3.3, sY - 2.1, sX + 5.5, sY); doc.line(sX + 3.3, sY + 2.1, sX + 5.5, sY);
    doc.setLineCap("butt");
    doc.link(bX, bY, bL, bA, { url: d.ctaUrl });
  } else if (d.ctaUrl){
    doc.link(M, 286.6, Math.min(lf, larg(refaz, "texto", 8)), 5, { url: d.ctaUrl });   // sem botão, o próprio endereço leva ao site
  }
}
