/**
 * O treino em andamento.
 *
 * Uma tela, um exercicio, uma serie. Ela e o unico lugar do app que sabe se a
 * proxima serie vai para a camera ou e marcada a mao — e essa diferenca nao e
 * um detalhe de implementacao: e a diferenca entre um app que corrige a sua
 * execucao e uma lista de tarefas.
 *
 * Ela e desenhada de novo do zero toda vez que o motor devolve uma serie,
 * porque voltar do motor e um carregamento de pagina inteiro. Nada aqui pode
 * depender de estado em memoria.
 */

import { el } from "../ui/base.js";
import { icone } from "../ui/icones.js";
import { NOME_CATEGORIA } from "../dados/catalogo.js";
import { CALIBRACAO, ORIENTACAO, cameraDisponivel, urlDaSessao } from "../dados/motor.js";
                                                      
import { registrar } from "../dados/progresso.js";
import {
  concluirSerie, gravarExecucao, pularItem, registroDaExecucao, repsDaSerie, terminou,
} from "../dados/execucao.js";
                                                     
                                               

/** Para onde o motor volta quando a serie acaba. */
export function urlDeRetorno()         {
  return `${location.origin}${location.pathname}#/sessao`;
}

export function telaSessao(ctx          , execucao          )              {
  const { plano } = ctx.exigirPlano();
  const sessao = plano.sessoes.find((s) => s.id === execucao.sessaoId);

  // O plano foi refeito enquanto havia treino em andamento. Nao ha o que
  // continuar, e insistir mostraria exercicios que nao existem mais.
  if (!sessao) {
    gravarExecucao(null);
    ctx.ir("treinos");
    return el("div", { classe: "tela" });
  }

  if (terminou(execucao, sessao)) return telaFim(ctx, sessao, execucao);

  const item = sessao.itens[execucao.indice];
  // Guiado E ter definicao no motor E esta build trazer os arquivos dele.
  const guiado = !!item.motorId && cameraDisponivel();
  const totalSeries = sessao.itens.reduce((n, i) => n + i.series, 0);

  return el("div", { classe: "tela sem-nav", attr: { id: "tela-sessao" } }, [
    el("div", { classe: "ob-topo" }, [
      el("button", {
        classe: "ob-voltar",
        attr: { "aria-label": "Sair do treino" },
        ao: { click: () => sair(ctx) },
      }, [icone("voltar", 22)]),
      el("div", { classe: "ob-trilha" }, [
        el("div", {
          classe: "ob-progresso",
          estilo: { width: `${(execucao.feitas.length / Math.max(1, totalSeries)) * 100}%` },
        }),
      ]),
      el("span", {
        classe: "ob-passo",
        texto: `${execucao.indice + 1}/${sessao.itens.length}`,
      }),
    ]),

    el("div", { classe: "saudacao", texto: `${sessao.nome} · ${sessao.foco}` }),
    el("h1", { classe: "ob-pergunta", texto: item.nome }),
    el("p", {
      classe: "ob-ajuda",
      texto: [NOME_CATEGORIA[item.categoria], ...item.musculos.slice(0, 3)].join(" · "),
    }),

    el("div", { classe: "cartao" }, [
      el("div", { classe: "progresso-corpo" }, [
        el("div", { classe: "pares", estilo: { flexDirection: "row", gap: "28px" } }, [
          numero("Série", `${execucao.serie + 1}`, `/${item.series}`),
          numero(
            item.unidade === "reps" ? "Repetições" : "Tempo",
            String(item.dose),
            item.unidade === "reps" ? "" : "s",
          ),
          numero("Descanso", String(item.descansoS), "s"),
        ]),
      ]),
    ]),

    guiado ? cartaoGuiado(item) : cartaoManual(!!item.motorId),

    el("div", { estilo: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "18px" } }, [
      guiado
        ? el("button", {
            classe: "botao",
            texto: "Abrir a câmera",
            ao: {
              click: () => {
                // Gravar ANTES de sair: a partir daqui esta pagina deixa de
                // existir, e o que nao estiver no armazenamento se perde.
                gravarExecucao(execucao);
                location.href = urlDaSessao(item.motorId , item.dose, urlDeRetorno());
              },
            },
          })
        : null,
      el("button", {
        classe: guiado ? "botao fantasma" : "botao",
        texto: guiado ? "Marcar série sem a câmera" : "Série concluída",
        ao: { click: () => marcarAMao(ctx, sessao, execucao, item) },
      }),
      el("button", {
        classe: "botao perigo",
        texto: "Pular este exercício",
        ao: { click: () => ctx.trocarExecucao(pularItem(execucao)) },
      }),
    ]),

    execucao.feitas.length ? feitas(execucao) : null,
  ]);
}

function numero(rotulo        , valor        , sufixo        )              {
  return el("div", {}, [
    el("div", { classe: "par-rotulo", texto: rotulo }),
    el("div", { classe: "par-valor" }, [
      valor,
      sufixo ? el("span", { classe: "par-unidade", texto: sufixo }) : null,
    ]),
  ]);
}

/**
 * O que a camera promete neste exercicio — e o que ela nao promete.
 *
 * A situacao de calibracao vem do README do motor e muda o texto de proposito.
 * `agachamento_livre` foi validado; os outros dois sao templates com limiares
 * que ainda sao chute educado. Prometer "correcao de execucao" num template
 * seria vender o que nao existe, e a primeira correcao errada custa a confianca
 * em todas as certas.
 */
function cartaoGuiado(item      )              {
  const validado = CALIBRACAO[item.motorId ] === "validado";
  const lateral = ORIENTACAO[item.motorId ] === "lateral";

  return el("div", { classe: "faixa", estilo: { marginTop: "14px", alignItems: "flex-start" } }, [
    el("span", { classe: "faixa-emoji", texto: "📷" }),
    el("div", { classe: "faixa-texto" }, [
      el("b", { texto: "A câmera conta esta série." }),
      el("div", { estilo: { marginTop: "4px" } }, [
        `Apoie o celular de pé, fique ${lateral ? "de lado" : "de frente"} e ` +
        "afaste-se até o corpo inteiro caber no quadro. ",
        validado
          ? "O app conta as repetições e corrige a execução."
          : "O app conta as repetições; as correções deste exercício ainda não " +
            "foram calibradas com vídeo real e podem errar.",
      ]),
    ]),
  ]);
}

/** `temDefinicao` distingue "o motor nao sabe medir" de "esta build nao trouxe a camera". */
function cartaoManual(temDefinicao         )              {
  return el("div", { classe: "cartao", estilo: { marginTop: "14px" } }, [
    el("div", { classe: "cartao-nota" }, [
      temDefinicao
        ? "A câmera sabe medir este exercício, mas esta versão do app foi " +
          "publicada sem ela. Faça a série e marque como concluída."
        : "Este exercício ainda não tem definição no motor, então a câmera não " +
          "sabe medi-lo. Faça a série e marque como concluída — ela conta para o " +
          "volume e para a sequência, mas não gera nota de execução.",
    ]),
  ]);
}

function feitas(execucao          )              {
  return el("div", {}, [
    el("div", { classe: "titulo-secao", texto: "Já feito" }),
    el("div", { classe: "cartao" },
      execucao.feitas.map((f) =>
        el("div", { classe: "linha-dado" }, [
          el("span", { classe: "linha-rotulo", texto: f.nome }),
          el("span", {
            classe: "linha-valor",
            texto: f.indiceQualidade === null
              ? `${f.reps} reps`
              : `${f.reps} reps · ${f.indiceQualidade}%`,
          }),
        ]),
      ),
    ),
  ]);
}

function marcarAMao(ctx          , sessao        , execucao          , item      )       {
  ctx.trocarExecucao(
    concluirSerie(execucao, sessao, {
      exercicioId: item.exercicioId,
      nome: item.nome,
      categoria: item.categoria,
      musculos: item.musculos,
      reps: repsDaSerie(item.dose, item.unidade),
      indiceQualidade: null,
      erros: {},
    }),
  );
}

function sair(ctx          )       {
  // Sair NAO apaga a execucao: o treino continua onde parou quando o usuario
  // voltar. Abandonar de verdade e uma acao da tela de treinos.
  ctx.ir("treinos");
}

// ---------------------------------------------------------------------------

function telaFim(ctx          , sessao        , execucao          )              {
  const registro = registroDaExecucao(sessao, execucao);
  const avaliadas = execucao.feitas.filter((f) => f.indiceQualidade !== null);

  return el("div", { classe: "tela sem-nav", attr: { id: "tela-sessao-fim" } }, [
    el("div", { classe: "vazio", estilo: { paddingBottom: "8px" } }, [
      el("div", { classe: "vazio-emoji", texto: "✅" }),
      el("h1", { classe: "manchete", texto: "Treino concluído." }),
      el("p", { classe: "legenda", texto: `${sessao.nome} · ${sessao.foco}` }),
    ]),

    el("div", { classe: "ladrilhos" }, [
      ladrilhoSimples("Séries", String(execucao.feitas.length)),
      ladrilhoSimples("Repetições", String(registro.reps)),
      ladrilhoSimples("Duração", `${registro.duracaoMin} min`),
      ladrilhoSimples(
        "Execução",
        registro.indiceQualidade === null ? "—" : `${registro.indiceQualidade}%`,
      ),
    ]),

    el("p", {
      classe: "aviso-legal",
      texto: avaliadas.length
        ? `${avaliadas.length} de ${execucao.feitas.length} séries foram medidas ` +
          "pela câmera. A nota de execução é a média delas — as séries marcadas " +
          "à mão não entram nessa conta."
        : "Nenhuma série foi medida pela câmera, então este treino não gera nota " +
          "de execução. Ele conta para o volume e para a sequência.",
    }),

    el("button", {
      classe: "botao",
      estilo: { marginTop: "20px" },
      texto: "Salvar no histórico",
      ao: {
        click: () => {
          registrar(registro);
          gravarExecucao(null);
          ctx.ir("inicio");
        },
      },
    }),
    el("button", {
      classe: "botao perigo",
      estilo: { marginTop: "8px" },
      texto: "Descartar este treino",
      ao: {
        click: () => {
          gravarExecucao(null);
          ctx.ir("treinos");
        },
      },
    }),
  ]);
}

function ladrilhoSimples(rotulo        , valor        )              {
  return el("div", { classe: "ladrilho" }, [
    el("div", { classe: "ladrilho-rotulo", texto: rotulo }),
    el("div", { classe: "ladrilho-valor", texto: valor }),
  ]);
}
