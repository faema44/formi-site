/**
 * Evolucao — os relatorios.
 *
 * A ordem responde a perguntas cada vez mais especificas: como estou agora, de
 * que a nota e feita, quanto eu treinei, quao bem eu executei, e o que meu corpo
 * recebeu. Um painel que abre com sete graficos sem hierarquia nao e um
 * relatorio, e um deposito de graficos.
 */

import { el, duracao } from "../ui/base.js";
import { graficoBarras, graficoColunas, graficoLinha, ladrilho } from "../ui/graficos.js";
import { NOME_CATEGORIA } from "../dados/catalogo.js";
                                                      
import {
  conquistas, dataISO, deltaDeOntem, minutosPorSemana, nota, sequencia, somarDias, somarPor,
} from "../dados/progresso.js";
                                                      
                                               

export function telaEvolucao(ctx          )              {
  const { plano, historico } = ctx.exigirPlano();
  const hoje = new Date();

  if (!historico.length) return vazio();

  const n = nota(historico, plano, hoje);
  const delta = deltaDeOntem(historico, plano, hoje);
  const seq = sequencia(historico, plano, hoje);
  const minutos = historico.reduce((s, r) => s + r.duracaoMin, 0);
  const avaliados = historico.filter((r) => r.indiceQualidade !== null);

  return el("div", { classe: "tela", attr: { id: "tela-evolucao" } }, [
    el("h1", { classe: "manchete", texto: "Sua evolução" }),
    el("p", {
      classe: "legenda",
      texto: `${historico.length} treinos desde ${mesLegivel(historico[0].data)}.`,
    }),

    el("div", { classe: "ladrilhos", estilo: { marginTop: "22px" } }, [
      ladrilho(
        "Nota de hoje",
        String(n.total),
        "de 100",
        delta !== 0 ? { texto: `${delta > 0 ? "+" : ""}${delta} vs ontem`, sobe: delta > 0 } : undefined,
      ),
      ladrilho("Sequência", String(seq), seq === 1 ? "dia" : "dias"),
      ladrilho("Tempo total", duracao(minutos)),
      ladrilho(
        "Melhor execução",
        avaliados.length
          ? String(Math.max(...avaliados.map((r) => r.indiceQualidade ?? 0)))
          : "—",
        avaliados.length ? "%" : undefined,
      ),
    ]),

    composicaoDaNota(n),

    graficoColunas({
      titulo: "Volume por semana",
      subtitulo: "Minutos treinados nas últimas 8 semanas",
      unidade: "minutos",
      dados: minutosPorSemana(historico, 8, hoje).map((p) => ({
        rotulo: p.rotulo,
        valor: p.minutos,
        detalhe: `semana de ${p.rotulo} · ${p.treinos} ${p.treinos === 1 ? "treino" : "treinos"}`,
      })),
    }),

    qualidade(avaliados),

    graficoBarras({
      titulo: "O que você trabalhou",
      subtitulo: "Repetições por grupo muscular, últimos 30 dias",
      unidade: "reps",
      dados: somarPor(historico, "musculos", dataISO(somarDias(hoje, -30)))
        .slice(0, 8)
        .map((d) => ({ rotulo: d.chave, valor: d.valor })),
    }),

    graficoBarras({
      titulo: "Equilíbrio do treino",
      subtitulo: "Repetições por tipo de exercício, últimos 30 dias",
      unidade: "reps",
      dados: somarPor(historico, "categorias", dataISO(somarDias(hoje, -30))).map((d) => ({
        rotulo: NOME_CATEGORIA[d.chave             ] ?? d.chave,
        valor: d.valor,
      })),
    }),

    el("div", { classe: "titulo-secao", texto: "Conquistas" }),
    el(
      "div",
      { classe: "conquistas" },
      conquistas(historico, plano, hoje).map((c) =>
        el("div", { classe: `conquista ${c.conquistada ? "" : "travada"}` }, [
          el("div", { classe: "conquista-emoji", texto: c.emoji }),
          el("div", { classe: "conquista-nome", texto: c.nome }),
        ]),
      ),
    ),
  ]);
}

/**
 * A nota aberta em parcelas.
 *
 * Uma nota que o usuario nao consegue explicar e uma nota que ele nao consegue
 * melhorar — e, quando ela cai, e uma nota em que ele para de acreditar. Aqui
 * cada parcela diz de onde veio e quanto vale.
 */
function composicaoDaNota(n                         )              {
  return el("div", { classe: "cartao" }, [
    el("div", { classe: "gr-titulo", texto: "De onde vem a sua nota" }),
    el("div", { classe: "gr-sub", texto: "As três parcelas e o quanto cada uma rendeu hoje" }),
    el(
      "div",
      { estilo: { marginTop: "16px" } },
      n.parcelas
        .filter((p) => p.peso > 0)
        .map((p) =>
          el("div", { classe: "fatia" }, [
            el("div", { classe: "fatia-topo" }, [
              el("span", { classe: "fatia-nome", texto: `${p.nome} — ${p.explicacao}` }),
              el("span", {
                classe: "fatia-valor",
                texto: `${Math.round(p.fracao * p.peso)}/${Math.round(p.peso)}`,
              }),
            ]),
            el("div", { classe: "fatia-trilho" }, [
              el("div", { classe: "fatia-preenche", estilo: { width: `${p.fracao * 100}%` } }),
            ]),
          ]),
        ),
    ),
  ]);
}

function qualidade(avaliados            )              {
  if (avaliados.length < 2) {
    return el("div", { classe: "cartao" }, [
      el("div", { classe: "gr-titulo", texto: "Qualidade de execução" }),
      el("div", {
        classe: "gr-sub",
        estilo: { marginTop: "8px" },
        texto:
          "Este gráfico precisa de treinos avaliados pela câmera. É a única " +
          "métrica do app que mede técnica, e por isso ela não é estimada nem " +
          "preenchida por treino registrado à mão.",
      }),
    ]);
  }

  const ultimos = avaliados.slice(-12);
  return graficoLinha({
    titulo: "Qualidade de execução",
    subtitulo: "Repetições sem nenhuma correção, por treino",
    unidade: "%",
    minimo: 40,
    dados: ultimos.map((r) => ({
      rotulo: diaLegivel(r.data),
      valor: r.indiceQualidade ?? 0,
      detalhe: `${r.nome} · ${diaLegivel(r.data)}`,
    })),
  });
}

function vazio()              {
  return el("div", { classe: "tela", attr: { id: "tela-evolucao" } }, [
    el("div", { classe: "vazio" }, [
      el("div", { classe: "vazio-emoji", texto: "📈" }),
      el("h2", { classe: "cartao-titulo", texto: "Ainda não há o que mostrar" }),
      el("p", {
        texto:
          "Seus relatórios aparecem aqui depois do primeiro treino. " +
          "Volume, execução, grupos trabalhados e sequência.",
      }),
    ]),
  ]);
}

function diaLegivel(iso        )         {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function mesLegivel(iso        )         {
  const [a, m] = iso.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(m) - 1]}. de ${a}`;
}
