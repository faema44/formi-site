/**
 * Ponto de entrada.
 *
 * Le o armazenamento, monta o contexto e desenha a tela. Sem onboarding
 * concluido nao ha abas — a porta de entrada e uma so, e as quatro telas podem
 * assumir perfil e plano existentes sem checar nada.
 *
 * O roteador e o hash da URL. Nao e detalhe: sem ele o botao "voltar" do Android
 * fecha o app no meio da navegacao entre abas, que e o defeito que mais irrita
 * em app empacotado com WebView.
 */

import { el, preencher } from "../src/ui/base.js";
import { icone } from "../src/ui/icones.js";
import { carregarCatalogo } from "../src/dados/catalogo.js";
                                                          
import { lerPerfil } from "../src/dados/perfil.js";
import { lerPlano } from "../src/dados/plano.js";
import { colherEntrega } from "../src/dados/motor.js";
import { concluirSerie, gravarExecucao, lerExecucao } from "../src/dados/execucao.js";
import { lerHistorico } from "../src/dados/progresso.js";
import { ler, gravar } from "../src/dados/armazenamento.js";
                                                         
import { telaOnboarding } from "../src/telas/onboarding.js";
import { telaInicio } from "../src/telas/inicio.js";
import { telaTreinos } from "../src/telas/treinos.js";
import { telaEvolucao } from "../src/telas/evolucao.js";
import { telaPerfil } from "../src/telas/perfil.js";
import { telaSessao } from "../src/telas/sessao.js";
import { ONBOARDING, PERFIL_DEMO } from "../src/demonstracao.js";
import { instalarPerfil } from "../src/dados/instalacao.js";

const ABAS                                                                   = [
  { rota: "inicio", nome: "Início", icone: "inicio" },
  { rota: "treinos", nome: "Treinos", icone: "treinos" },
  { rota: "evolucao", nome: "Evolução", icone: "evolucao" },
  { rota: "perfil", nome: "Perfil", icone: "perfil" },
];

/** As abas. `sessao` fica de fora: durante o treino nao ha barra de abas. */
const TELAS                                                                  = {
  inicio: telaInicio,
  treinos: telaTreinos,
  evolucao: telaEvolucao,
  perfil: telaPerfil,
};

const raiz = document.getElementById("app") ;
const nav = document.getElementById("nav") ;

let catalogo              = [];
/** Ver o uso em `desenhar()`: trava contra recursao quando o perfil nao grava. */
let tentouDemo = false;

/**
 * Recolhe o resultado que o motor deixou e o costura no treino em andamento.
 *
 * Roda no boot porque voltar do motor E um boot: a navegacao para a camera
 * descarrega esta pagina inteira. Se nao houver treino em andamento — o usuario
 * abriu o motor por fora, ou desistiu do treino enquanto estava la — a entrega e
 * descartada, e nao inventa um treino que ninguem pediu.
 */
function aplicarEntrega()       {
  const entrega = colherEntrega();
  if (!entrega) return;

  const execucao = lerExecucao();
  const plano = lerPlano();
  if (!execucao || !plano) return;

  const sessao = plano.sessoes.find((s) => s.id === execucao.sessaoId);
  const item = sessao?.itens[execucao.indice];
  if (!sessao || !item) return;

  const r = entrega.serie.resumo;
  const erros                         = { ...r.erros_por_tipo };

  concluirSerie(execucao, sessao, {
    exercicioId: item.exercicioId,
    nome: item.nome,
    categoria: item.categoria,
    musculos: item.musculos,
    reps: r.reps,
    indiceQualidade: r.indice_qualidade,
    erros,
  });
}

async function iniciar()                {
  try {
    catalogo = await carregarCatalogo();
  } catch (erro) {
    preencher(
      raiz,
      el("div", { classe: "tela sem-nav" }, [
        el("div", { classe: "vazio" }, [
          el("div", { classe: "vazio-emoji", texto: "⚠️" }),
          el("h2", { classe: "cartao-titulo", texto: "Catálogo indisponível" }),
          el("p", { texto: String((erro         ).message) }),
          el("p", {
            classe: "aviso-legal",
            texto: "Rode `node build.mjs --servir` na raiz do projeto — a página precisa alcançar /dados/catalogo.json.",
          }),
        ]),
      ]),
    );
    return;
  }

  aplicarEntrega();
  window.addEventListener("hashchange", desenhar);
  desenhar();
}

function avisoDeFalha(titulo        , detalhe        )              {
  return el("div", { classe: "tela sem-nav" }, [
    el("div", { classe: "vazio" }, [
      el("div", { classe: "vazio-emoji", texto: "⚠️" }),
      el("h2", { classe: "cartao-titulo", texto: titulo }),
      el("p", { texto: detalhe }),
    ]),
  ]);
}

function contexto()           {
  const perfil = lerPerfil();
  const plano = lerPlano();
  const historico = lerHistorico();

  return {
    perfil,
    plano,
    historico,
    ir(rota) {
      location.hash = `#/${rota}`;
    },
    recarregar() {
      desenhar();
    },
    reiniciar() {
      // Perfil e plano saem; o historico fica. Quem refaz as respostas depois de
      // um mes de treino continua sendo dono do que treinou. A execucao em
      // andamento tambem sai: ela aponta para sessoes do plano que vai embora.
      gravar("perfil", null);
      gravar("plano", null);
      gravarExecucao(null);
      location.hash = "";
      desenhar();
    },
    trocarExecucao(execucao) {
      gravarExecucao(execucao);
      desenhar();
    },
    exigirPlano() {
      if (!perfil || !plano) throw new Error("tela de aba desenhada sem perfil ou plano");
      return { perfil, plano, historico };
    },
  };
}

                                   

function abaAtual()      {
  const bruta = location.hash.replace(/^#\/?/, "")       ;
  return bruta in TELAS ? bruta : "inicio";
}

function desenhar()       {
  const ctx = contexto();

  if (!ctx.perfil || !ctx.plano) {
    // Onboarding desligado: instala o perfil de demonstracao e segue direto
    // para a tela inicial. Ver `demonstracao.ts` — e uma chave, nao uma
    // remocao, e o fluxo de perguntas continua inteiro.
    if (!ONBOARDING) {
      // Uma tentativa, nunca duas. `gravar()` engole falha de armazenamento —
      // e a navegacao privada do Safari faz `setItem` falhar —, entao sem esta
      // trava o perfil nunca apareceria, `desenhar()` se chamaria de novo, e o
      // app morreria em estouro de pilha em vez de dizer o que houve.
      if (tentouDemo) {
        preencher(raiz, avisoDeFalha(
          "Não foi possível preparar a demonstração",
          "O navegador não conseguiu gravar os dados do app. Costuma ser aba " +
          "anônima (o Safari bloqueia o armazenamento nela) ou espaço esgotado. " +
          "Abra numa aba comum, ou limpe os dados do site.",
        ));
        return;
      }
      tentouDemo = true;
      try {
        instalarPerfil(PERFIL_DEMO, catalogo);
      } catch (erro) {
        preencher(raiz, avisoDeFalha("Não foi possível montar o plano", String((erro         ).message)));
        return;
      }
      if (!location.hash) location.hash = "#/inicio";
      desenhar();
      return;
    }
    nav.classList.add("oculto");
    preencher(
      raiz,
      telaOnboarding(catalogo, () => {
        location.hash = "#/inicio";
        desenhar();
      }),
    );
    raiz.append(nav);
    return;
  }

  // O treino em andamento tem prioridade sobre a rota. Quem volta da camera cai
  // aqui pelo hash; quem fechou o app no meio do treino e reabriu cai aqui pela
  // execucao gravada, sem precisar reencontrar o caminho.
  const execucao = lerExecucao();
  if (location.hash === "#/sessao" && execucao) {
    nav.classList.add("oculto");
    preencher(raiz, telaSessao(ctx, execucao));
    raiz.append(nav);
    return;
  }

  const rota = abaAtual();
  nav.classList.remove("oculto");
  preencher(raiz, TELAS[rota](ctx));
  raiz.append(nav);
  desenharNav(rota, ctx);
  lembrarUltimaAba(rota);
}

function desenharNav(rota     , ctx          )       {
  preencher(
    nav,
    ...ABAS.map((aba) =>
      el(
        "button",
        {
          classe: `aba ${aba.rota === rota ? "ativa" : ""}`,
          attr: { "aria-current": aba.rota === rota ? "page" : "false" },
          ao: { click: () => ctx.ir(aba.rota) },
        },
        [icone(aba.icone, 22), el("span", { texto: aba.nome })],
      ),
    ),
  );
}

/**
 * Reabrir o app cai na aba onde o usuario parou, e nao sempre no inicio. Vale
 * so para abertura: navegar por hash dentro da sessao ja e resolvido pela URL.
 */
function lembrarUltimaAba(rota     )       {
  gravar("ultimaAba", rota);
}

if (!location.hash) {
  const lembrada = ler     ("ultimaAba", "inicio");
  if (lembrada in TELAS) location.hash = `#/${lembrada}`;
}

void iniciar();
