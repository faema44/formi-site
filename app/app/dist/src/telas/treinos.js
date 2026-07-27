/**
 * Tela de treinos: a semana inteira, sessao a sessao.
 *
 * Cada sessao abre no lugar em vez de navegar para outra tela. A lista de
 * exercicios e consulta, nao destino — quem abre quer conferir o que vem hoje e
 * fechar, e uma tela nova para isso custa duas navegacoes e perde o contexto da
 * semana.
 */

import { el } from "../ui/base.js";
import { icone } from "../ui/icones.js";
import { NOME_CATEGORIA, NOME_NIVEL } from "../dados/catalogo.js";
import { NOME_OBJETIVO } from "../dados/perfil.js";
import { nomeDia } from "../dados/plano.js";
                                                      
import { dataISO, registrar } from "../dados/progresso.js";
import { iniciarExecucao, lerExecucao } from "../dados/execucao.js";
                                               

const NOME_BLOCO = {
  aquecimento: "Aquecimento",
  principal: "Principal",
  finalizacao: "Finalização",
}         ;

export function telaTreinos(ctx          )              {
  const { perfil, plano, historico } = ctx.exigirPlano();
  const hoje = new Date();
  const feitosHoje = new Set(
    historico.filter((r) => r.data === dataISO(hoje)).map((r) => r.sessaoId),
  );

  const ordenadas = [...plano.sessoes].sort((a, b) => a.diaSemana - b.diaSemana);

  return el("div", { classe: "tela", attr: { id: "tela-treinos" } }, [
    el("h1", { classe: "manchete", texto: "Seu pacote" }),
    el("p", {
      classe: "legenda",
      texto:
        `${NOME_OBJETIVO[perfil.objetivo]} · ${NOME_NIVEL[perfil.nivel]} · ` +
        `${perfil.diasPorSemana}× por semana · ${perfil.ambiente}`,
    }),

    avisoDePlanoCurto(perfil.minutosPorSessao, plano.sessoes),

    el("div", { classe: "titulo-secao", texto: "Esta semana" }),
    ...ordenadas.map((s) => cartaoSessao(ctx, s, hoje, feitosHoje.has(s.id))),

    el("p", {
      classe: "aviso-legal",
      texto:
        "O pacote foi montado a partir do seu objetivo, nível, ambiente e " +
        "equipamentos. Mudou alguma coisa? Refaça as respostas no Perfil e o " +
        "plano é regerado.",
    }),
  ]);
}

/**
 * O plano saiu bem mais curto do que o pedido.
 *
 * Acontece quando o filtro corta demais: "ao ar livre" somado a baixo impacto e
 * nivel sedentario deixa cinco exercicios de pe no catalogo inteiro, e nao ha
 * como montar 20 minutos com cinco. Entregar 10 minutos calado faz o app parecer
 * quebrado; dizer por que, e o que afrouxar, transforma o mesmo plano numa
 * decisao informada. O limiar e 70% — abaixo disso a diferenca e sentida.
 */
function avisoDePlanoCurto(pedido        , sessoes          )                     {
  const media = sessoes.reduce((s, x) => s + x.duracaoMin, 0) / Math.max(1, sessoes.length);
  if (media >= pedido * 0.7) return null;

  return el("div", { classe: "faixa", estilo: { marginTop: "18px" } }, [
    el("span", { classe: "faixa-emoji", texto: "📏" }),
    el("div", {
      classe: "faixa-texto",
      texto:
        `Suas sessões ficaram em ${Math.round(media)} min, não nos ${pedido} que ` +
        "você pediu: com as restrições que você marcou, sobraram poucos " +
        "exercícios no catálogo. Liberar o impacto articular ou incluir " +
        "\"em casa\" como ambiente aumenta bastante a variedade.",
    }),
  ]);
}

function cartaoSessao(ctx          , sessao        , hoje      , feita         )              {
  const ehHoje = sessao.diaSemana === hoje.getDay();
  const guiados = sessao.itens.filter((i) => i.motorId).length;
  const emAndamento = lerExecucao()?.sessaoId === sessao.id;

  const itens = el("div", { classe: "sessao-itens" }, [
    ...blocos(sessao),
    el("div", { classe: "sessao-acao" }, [
      feita
        ? el("button", { classe: "botao fantasma", texto: "✓ Concluído hoje", attr: { disabled: "true" } })
        : el("button", {
            classe: "botao",
            texto: emAndamento ? "Continuar o treino" : "Iniciar treino",
            ao: {
              click: () => {
                // Retomar em vez de reiniciar. Quem voltou da camera e caiu aqui
                // por engano perderia as series ja feitas.
                if (!emAndamento) iniciarExecucao(sessao.id);
                ctx.ir("sessao");
              },
            },
          }),
      !feita
        ? el("button", {
            classe: "botao fantasma",
            estilo: { marginTop: "8px" },
            texto: "Registrar como concluído",
            ao: { click: () => concluir(ctx, sessao, hoje) },
          })
        : null,
      el("p", {
        classe: "aviso-legal",
        texto: guiados
          ? `${guiados} ${guiados === 1 ? "exercício deste treino é medido" : "exercícios deste treino são medidos"} ` +
            "pela câmera: contagem de repetições e correção de execução. O resto " +
            "você marca à mão, e conta para o volume e para a sequência."
          : "Nenhum exercício deste treino tem definição no motor ainda, então " +
            "todas as séries são marcadas à mão. Elas contam para o volume e para " +
            "a sequência, mas não geram nota de execução.",
      }),
    ]),
  ]);

  const cartao = el("div", { classe: "cartao sessao" }, [
    el(
      "button",
      {
        classe: "sessao-topo",
        attr: { "aria-expanded": "false" },
        ao: {
          click: () => {
            const aberta = cartao.classList.toggle("aberta");
            cartao.querySelector(".sessao-topo") .setAttribute("aria-expanded", String(aberta));
          },
        },
      },
      [
        el("div", { classe: `sessao-dia ${feita ? "feita" : ""}` }, [
          feita ? icone("marca", 20, "#fff") : el("b", { texto: nomeDia(sessao.diaSemana) }),
        ]),
        el("div", { classe: "sessao-info" }, [
          el("div", { classe: "sessao-nome", texto: `${sessao.nome} · ${sessao.foco}` }),
          el("div", {
            classe: "sessao-meta",
            texto:
              `${sessao.duracaoMin} min · ${sessao.itens.length} exercícios` +
              (ehHoje ? " · hoje" : ""),
          }),
        ]),
        el("span", { classe: "sessao-abrir" }, [icone("baixo", 20)]),
      ],
    ),
    itens,
  ]);

  if (ehHoje && !feita) cartao.classList.add("aberta");
  return cartao;
}

function blocos(sessao        )                {
  const ordem                              = ["aquecimento", "principal", "finalizacao"];
  const saida                = [];

  for (const bloco of ordem) {
    const doBloco = sessao.itens.filter((i) => i.bloco === bloco);
    if (!doBloco.length) continue;
    saida.push(el("div", { classe: "bloco-rotulo", texto: NOME_BLOCO[bloco] }));
    saida.push(...doBloco.map(linhaItem));
  }
  return saida;
}

function linhaItem(item      )              {
  const dose =
    item.unidade === "reps"
      ? `${item.series}×${item.dose}`
      : `${item.series}×${item.dose}s`;

  return el("div", { classe: "item" }, [
    el("div", { classe: "item-nome" }, [
      item.nome,
      // A camera e o que diferencia o produto: quando ela sabe medir o
      // exercicio, isso precisa se ver na lista, antes de o treino comecar.
      item.motorId ? el("span", { classe: "marca-camera", texto: "📷" }) : null,
      el("div", {
        classe: "item-musculos",
        // Tres grupos bastam. A lista inteira de sete ocupa duas linhas e para
        // de ser lida na terceira vez que aparece.
        texto: [NOME_CATEGORIA[item.categoria], ...item.musculos.slice(0, 3)].join(" · "),
      }),
    ]),
    el("div", { classe: "item-dose", texto: dose }),
  ]);
}

/**
 * Registro manual. `indiceQualidade` fica nulo de proposito: sem camera nao
 * houve execucao avaliada, e inventar 100 aqui contaminaria o unico numero do
 * app que mede tecnica.
 */
function concluir(ctx          , sessao        , hoje      )       {
  const musculos                         = {};
  const categorias                         = {};
  let reps = 0;

  for (const item of sessao.itens) {
    const porSerie = item.unidade === "reps" ? item.dose : Math.round(item.dose / 3);
    const total = item.series * porSerie;
    reps += total;
    categorias[item.categoria] = (categorias[item.categoria] ?? 0) + total;
    const fatia = item.musculos.length ? total / item.musculos.length : 0;
    for (const m of item.musculos) musculos[m] = Math.round((musculos[m] ?? 0) + fatia);
  }

  registrar({
    data: dataISO(hoje),
    sessaoId: sessao.id,
    nome: sessao.nome,
    foco: sessao.foco,
    duracaoMin: sessao.duracaoMin,
    reps,
    indiceQualidade: null,
    musculos,
    categorias,
  });
  ctx.recarregar();
}
