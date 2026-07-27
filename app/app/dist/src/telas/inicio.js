/**
 * Tela inicial.
 *
 * A tela responde tres perguntas, nesta ordem: como estou, o que fiz esta
 * semana, e qual e o proximo treino. O resto e distracao — qualquer coisa a
 * mais aqui empurra o botao do proximo treino para baixo da dobra, e ele e a
 * unica acao que importa.
 */

import { el } from "../ui/base.js";
import { icone } from "../ui/icones.js";
import { anel } from "../ui/graficos.js";
import { primeiroNome, iniciais } from "../dados/perfil.js";
import { proximaSessao, nomeDia } from "../dados/plano.js";
import {
  conquistas, deltaDeOntem, nota, semanaDe, sequencia,
} from "../dados/progresso.js";
                                               

const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function telaInicio(ctx          )              {
  const { perfil, plano, historico } = ctx.exigirPlano();
  const hoje = new Date();

  const n = nota(historico, plano, hoje);
  const semana = semanaDe(historico, plano, hoje);
  const seq = sequencia(historico, plano, hoje);
  const delta = deltaDeOntem(historico, plano, hoje);
  const feitoHoje = semana.feitoPorDia[(hoje.getDay() + 6) % 7];
  const sessao = proximaSessao(plano, hoje, feitoHoje);
  const ehHoje = sessao.diaSemana === hoje.getDay();

  return el("div", { classe: "tela", attr: { id: "tela-inicio" } }, [
    el("div", { classe: "topo" }, [
      el("div", {}, [
        el("div", { classe: "saudacao", texto: `Olá, ${primeiroNome(perfil)}` }),
        manchete(delta, seq, historico.length),
        el("p", { classe: "legenda", texto: subtitulo(delta, seq, historico.length) }),
      ]),
      el("button", {
        classe: "avatar",
        texto: iniciais(perfil),
        attr: { "aria-label": "Seu perfil" },
        ao: { click: () => ctx.ir("perfil") },
      }),
    ]),

    el("div", { classe: "cartao", estilo: { marginTop: "22px" } }, [
      el("div", { classe: "cartao-cabecalho" }, [
        el("div", { classe: "cartao-titulo", texto: "Seu progresso" }),
        el("button", {
          classe: "cartao-nota",
          texto: "Esta semana ›",
          ao: { click: () => ctx.ir("evolucao") },
        }),
      ]),
      el("div", { classe: "progresso-corpo" }, [
        anel(n.total),
        el("div", { classe: "pares" }, [
          par("Treinos", String(semana.feitos), `/${semana.previstos}`, "concluídos"),
          par("Sequência", String(seq), "", seq === 1 ? "dia" : "dias"),
        ]),
      ]),
      barrasDaSemana(semana.feitoPorDia, semana.previstoPorDia, hoje),
    ]),

    el(
      "button",
      { classe: "proximo", ao: { click: () => ctx.ir("treinos") } },
      [
        el("div", { classe: "proximo-texto" }, [
          el("div", {
            classe: "proximo-etiqueta",
            texto: feitoHoje ? "Hoje está feito. O próximo é" : ehHoje ? "Treino de hoje" : "Próximo treino",
          }),
          el("div", { classe: "proximo-nome", texto: `${sessao.nome} · ${sessao.foco}` }),
          el("div", {
            classe: "proximo-meta",
            texto: `${ehHoje ? "Hoje" : nomeDia(sessao.diaSemana)} · ${sessao.duracaoMin} min · ${sessao.itens.length} exercícios`,
          }),
        ]),
        el("span", { classe: "seta" }, [icone("seta", 22, "#fff")]),
      ],
    ),

    faixaDoDia(ctx, seq, n.total, historico.length),
  ]);
}

/**
 * A manchete.
 *
 * A SEQUENCIA manda, nao o delta do dia. O delta cai sozinho num dia de
 * descanso — a janela de sete dias vai deixando o treino mais antigo para tras —
 * e usar so ele fazia o app abrir com "um treino recoloca voce no ritmo" para
 * quem estava ha treze dias sem furar o plano. Acusar quem esta em dia e o jeito
 * mais rapido de perder a confianca do usuario no numero.
 */
function manchete(delta        , seq        , treinos        )              {
  if (treinos === 0) {
    return el("h1", { classe: "manchete" }, [
      "Seu plano está pronto. ",
      el("span", { classe: "destaque", texto: "Comece hoje." }),
    ]);
  }
  if (delta > 0) {
    return el("h1", { classe: "manchete" }, [
      "Hoje você está ",
      el("span", { classe: "destaque", texto: `${delta}% melhor` }),
      " que ontem.",
    ]);
  }
  if (seq >= 2) {
    return el("h1", { classe: "manchete" }, [
      "Você está há ",
      el("span", { classe: "destaque", texto: `${seq} dias` }),
      " no plano.",
    ]);
  }
  // Aqui a sequencia realmente quebrou. Nao esconder e nao dramatizar: o numero
  // volta com um treino, e dizer isso e mais util do que um numero vermelho.
  return el("h1", { classe: "manchete" }, [
    "Um treino ",
    el("span", { classe: "destaque", texto: "recoloca você" }),
    " no ritmo.",
  ]);
}

function subtitulo(delta        , seq        , treinos        )         {
  if (treinos === 0) return "O primeiro treino é o mais difícil. Depois vira hábito.";
  if (seq === 0) return "Todo mundo falha um dia. O plano continua de pé.";
  if (delta <= 0 && seq >= 7) return "Cumprir o plano é o que sustenta o número.";
  return "Todo dia treinando direito vira resultado.";
}

function par(rotulo        , valor        , sufixo        , unidade        )              {
  return el("div", {}, [
    el("div", { classe: "par-rotulo", texto: rotulo }),
    el("div", { classe: "par-valor" }, [
      valor,
      sufixo ? el("span", { classe: "par-unidade", texto: sufixo }) : null,
    ]),
    el("div", { classe: "par-rotulo", texto: unidade }),
  ]);
}

/**
 * A semana em sete colunas.
 *
 * Tres alturas, tres significados: treino feito, treino previsto e nao feito,
 * dia de descanso. Sem a terceira altura o descanso pareceria falha — e o plano
 * de quem treina tres vezes por semana teria quatro "buracos" todo dia visiveis
 * na tela inicial.
 */
function barrasDaSemana(feito           , previsto           , hoje      )              {
  const indiceHoje = (hoje.getDay() + 6) % 7;

  return el(
    "div",
    { classe: "semana" },
    LETRAS.map((letra, i) => {
      const classe = [
        "semana-dia",
        feito[i] ? "feito" : "",
        i === indiceHoje ? "hoje" : "",
      ].filter(Boolean).join(" ");

      const altura = feito[i] ? 44 : previsto[i] ? 26 : 12;
      const titulo = feito[i]
        ? "Treino concluído"
        : previsto[i]
          ? "Treino previsto"
          : "Descanso";

      return el("div", { classe, attr: { title: titulo } }, [
        el("div", { classe: "semana-coluna", estilo: { height: `${altura}px` } }),
        el("div", { classe: "semana-letra", texto: letra }),
      ]);
    }),
  );
}

/** Uma faixa por vez, e so quando ha algo de verdade para dizer. */
function faixaDoDia(ctx          , seq        , total        , treinos        )                     {
  const { plano, historico } = ctx.exigirPlano();
  const recente = conquistas(historico, plano).filter((c) => c.conquistada).pop();

  if (treinos === 0) return null;
  if (seq >= 7) {
    return faixa("🔥", `<b>${seq} dias</b> sem furar o plano. Não quebre agora.`);
  }
  if (total >= 80) {
    return faixa("✨", `Nota <b>${total} de 100</b> — sua execução está entre as melhores que você já teve.`);
  }
  if (recente) {
    return faixa(recente.emoji, `Conquista desbloqueada: <b>${recente.nome}</b>.`);
  }
  return null;
}

function faixa(emoji        , html        )              {
  const texto = el("div", { classe: "faixa-texto" });
  texto.innerHTML = html; // conteudo proprio, sem entrada do usuario
  return el("div", { classe: "faixa" }, [
    el("span", { classe: "faixa-emoji", texto: emoji }),
    texto,
  ]);
}
