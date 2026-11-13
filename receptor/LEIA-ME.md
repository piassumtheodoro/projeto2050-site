# Receptor de leads do Projeto 2050

Esta pasta é o código do receptor: o Apps Script ligado à planilha "Projeto 2050 · Leads". Ele recebe cada cadastro da página, grava na aba Leads, manda o plano por e-mail com o relatório em PDF e avisa a equipe.

O endereço do receptor é o `ENDPOINT` do `index.html`. Ele não muda quando o código muda: toda publicação atualiza a mesma implantação.

## O que tem aqui

| Arquivo | O que é |
| --- | --- |
| `Código.gs` | O receptor: recebe o envio, grava a linha, manda os e-mails. |
| `Os.gs` | O aviso ao Rivool OS: depois de gravar, manda a linha que mudou e as que o OS ainda não tem. Tem também `mandarTudo`, para rodar à mão. |
| `Pdf.gs` | Gerado. O jsPDF, as fontes e o desenho do relatório, para o receptor montar o mesmo PDF da página. |
| `appsscript.json` | O manifesto do projeto: fuso, permissões e a configuração do App da Web. |
| `testes/` | Os testes, com planilha, correio e propriedades simulados. Não vão para o Apps Script. |
| `ferramentas/montar-pdf.js` | Gera o `Pdf.gs` a partir do `index.html` e do `pdf-fontes.js`. Não vai para o Apps Script. |

O `.clasp.json` e o `.claspignore`, na raiz do repositório, dizem ao clasp qual é o projeto e quais arquivos enviar (`Código.gs`, `Os.gs`, `Pdf.gs` e `appsscript.json`).

## Rodar os testes

```
node receptor/testes/testa-receptor.js
```

Precisa só do Node 22 ou mais novo. Os testes rodam o `Código.gs` e o `Pdf.gs` de verdade num Apps Script simulado: nenhuma planilha é tocada e nenhum e-mail sai. Para ver um e-mail e um PDF de amostra, passe uma pasta: `node receptor/testes/testa-receptor.js /tmp/amostras`.

## Mudar o receptor

1. Mude o código por PR, como a página, e rode os testes.
2. Se o desenho do PDF, as fontes ou a versão do jsPDF mudaram no `index.html`, rode `node receptor/ferramentas/montar-pdf.js` e mande o `Pdf.gs` novo no mesmo PR. Um teste acusa quando o `Pdf.gs` ficou para trás.
3. O merge na `main` publica sozinho.

## Como a publicação funciona

O fluxo `.github/workflows/publicar-receptor.yml` roda quando um push na `main` toca `receptor/**`, o `.clasp.json`, o `.claspignore` ou o próprio fluxo. Também dá para rodar à mão, pela aba Actions. Ele nunca roda em pull request.

Na ordem, ele:

1. roda os testes e para se algum falhar;
2. envia o código ao Apps Script com o clasp (`clasp push`);
3. cria uma versão nova e aponta para ela a implantação que já existe (`clasp update-deployment`), sem criar implantação nova;
4. faz um GET no endereço `/exec` e confere que a resposta é `ok`.

Duas publicações não rodam ao mesmo tempo: a segunda espera a primeira.

Se uma publicação sair errada, dá para voltar a implantação para uma versão anterior sem esperar um PR. Na máquina de quem tem o login do clasp, na raiz do repositório:

```
npx --yes @google/clasp@3.4.1 list-versions
npx --yes @google/clasp@3.4.1 update-deployment <id da implantação> --versionNumber <número da versão boa>
```

Depois, corrija o código por PR: o próximo merge publica de novo a partir da `main`.

O fluxo depende de duas coisas guardadas no GitHub, em Settings → Secrets and variables → Actions:

| Nome | Tipo | O que é |
| --- | --- | --- |
| `CLASPRC_JSON` | segredo | A credencial do clasp: o conteúdo do `~/.clasprc.json` de quem fez o login. |
| `RECEPTOR_IMPLANTACAO_ID` | variável | O id da implantação em uso: o trecho entre `/s/` e `/exec` do `ENDPOINT`. |

## Trocar a credencial

A credencial é um login da conta Google dona do projeto. Quem tem permissão de escrita no repositório consegue rodar fluxos que a usam, então vale manter essa lista curta.

Para trocar, na máquina de quem é dono do projeto:

```
npx --yes @google/clasp@3.4.1 login
gh secret set CLASPRC_JSON --repo piassumtheodoro/projeto2050-site < ~/.clasprc.json
```

O login abre o navegador: escolha a conta dona da planilha. O segundo comando grava o segredo direto do arquivo, sem mostrar o conteúdo. Não copie esse arquivo para o repositório, para um PR nem para uma conversa.

Para revogar uma credencial antiga: myaccount.google.com → Segurança → Conexões com apps de terceiros → clasp.

## O que a automação não faz

- **Permissão nova do Google.** Se o código passar a usar algo que pede autorização nova (chamar um endereço externo, ler o Drive, mexer em agenda), a publicação vai ao ar, mas o receptor só volta a funcionar depois que o dono da conta autorizar uma vez no editor do Apps Script: abrir o projeto, rodar qualquer função e aceitar a tela do Google.
- **A permissão do `Os.gs`.** Chamar o OS é chamar um endereço externo, o que pede autorização nova do Google. Vale a regra do item acima: publicado sem a autorização, o receptor pode parar de gravar até o dono da conta autorizar. Por isso a autorização vem **antes** do merge que traz o `Os.gs`:
  1. no editor do Apps Script, criar um arquivo qualquer com `function autorizar() { UrlFetchApp.fetch('https://www.google.com/generate_204'); }`, rodar `autorizar` e aceitar a tela do Google. Isso não muda o que está no ar: o endereço `/exec` continua na versão publicada;
  2. fazer o merge em seguida. A publicação troca os arquivos do editor pelos do repositório (o arquivo do passo 1 some) e a versão nova já encontra a permissão dada;
  3. abrir o endereço `/exec` e conferir o `ok`, e fazer um cadastro de teste na página.

  Se algo sair errado, volte a implantação para a versão anterior (acima, em "Como a publicação funciona").
- **Mandar as linhas antigas ao OS.** Com as duas propriedades preenchidas e a permissão aceita, rode `mandarTudo` uma vez no editor. Ela manda lote atrás de lote as linhas com aceite que o OS ainda não tem; se o registro disser que ainda há pendentes, rode de novo.
- **Propriedades do script.** O que não pode ficar num repositório público mora em Configurações do projeto → Propriedades do script, no editor do Apps Script, e não vai pelo repositório:
  - `AVISAR_EMAIL`: endereços que recebem o aviso interno, separados por vírgula. Sem ela, não há aviso.
  - `AGENDA_CHAMADA`: frase do bloco "Agendar reunião com especialista" do e-mail do plano. Sem ela, vale um texto padrão sem nome.
  - `OS_URL`: o endereço da rota do OS que recebe os leads (`/leads/projeto-2050`), começando com `https://`.
  - `OS_SEGREDO`: o segredo que o OS espera no cabeçalho `Authorization`. É o mesmo valor da variável `PROJETO2050_SYNC_SECRET` do OS.

  Sem uma das duas, o `Os.gs` não chama o OS e o receptor funciona como antes (o registro diz "OS não configurado").

  Para conferir sem mostrar valores, rode `conferirConfiguracao` no editor e leia o registro de execução.
- **A planilha.** O link do botão de agenda fica na aba Config da planilha (linha `agenda_url`), e as colunas da aba Leads se ajustam sozinhas. Nada disso passa pelo repositório.
- **Credencial vencida.** Se a publicação falhar no envio com erro de autenticação, refaça o login do clasp e regrave o segredo (acima). Depois rode o fluxo de novo pela aba Actions.
- **Teste de ponta a ponta.** O fluxo não manda cadastro de teste: um POST no receptor grava na planilha e dispara e-mail de verdade.
