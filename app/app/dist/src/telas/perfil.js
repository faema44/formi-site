/**
 * Perfil.
 *
 * As respostas do onboarding em forma de tela, mais as duas acoes destrutivas.
 * O texto de privacidade nao e enfeite juridico: e a promessa que a pagina do
 * produto faz, e ela precisa aparecer onde o usuario procura por ela.
 */

import { el, plural } from "../ui/base.js";
import { NOME_NIVEL } from "../dados/catalogo.js";
import { NOME_OBJETIVO, iniciais } from "../dados/perfil.js";
import { totalExercicios } from "../dados/plano.js";
import { gravarHistorico, lerHistorico } from "../dados/progresso.js";
                                                      
import { limparTudo } from "../dados/armazenamento.js";
import { ONBOARDING } from "../demonstracao.js";
                                               

/** Ha registro semeado pelo app no historico. Derivado, nunca guardado a parte. */
function temExemplo(historico            )          {
  return historico.some((r) => r.exemplo);
}

export function telaPerfil(ctx          )              {
  const { perfil, plano, historico } = ctx.exigirPlano();

  return el("div", { classe: "tela", attr: { id: "tela-perfil" } }, [
    el("div", { classe: "topo" }, [
      el("div", {}, [
        el("h1", { classe: "manchete", texto: perfil.nome }),
        el("p", {
          classe: "legenda",
          texto: `${NOME_OBJETIVO[perfil.objetivo]} · ${NOME_NIVEL[perfil.nivel]}`,
        }),
      ]),
      el("div", { classe: "avatar", texto: iniciais(perfil) }),
    ]),

    el("div", { classe: "titulo-secao", texto: "Suas respostas" }),
    el("div", { classe: "cartao" }, [
      linha("Objetivo", NOME_OBJETIVO[perfil.objetivo]),
      linha("Nível", NOME_NIVEL[perfil.nivel]),
      linha("Frequência", `${perfil.diasPorSemana}× por semana`),
      linha("Duração", `${perfil.minutosPorSessao} min por sessão`),
      linha("Onde treina", perfil.ambiente),
      linha(
        "Equipamentos",
        perfil.equipamentos.length ? perfil.equipamentos.join(", ") : "Nenhum",
      ),
      linha("Poupar articulações", perfil.pouparArticulacoes ? "Sim" : "Não"),
    ]),

    el("div", { classe: "titulo-secao", texto: "Seu plano" }),
    el("div", { classe: "cartao" }, [
      linha("Sessões", plural(plano.sessoes.length, "sessão", "sessões")),
      linha("Exercícios", String(totalExercicios(plano))),
      linha("Treinos registrados", String(historico.length)),
    ]),

    el("div", { estilo: { marginTop: "22px", display: "flex", flexDirection: "column", gap: "10px" } }, [
      // Com o onboarding desligado nao ha respostas para refazer: o botao
      // limparia o perfil e o app reinstalaria o mesmo perfil de demonstracao,
      // dando a impressao de que o toque nao fez nada.
      ONBOARDING
        ? el("button", {
            classe: "botao fantasma",
            texto: "Refazer minhas respostas",
            ao: { click: () => ctx.reiniciar() },
          })
        : null,
      temExemplo(historico)
        ? el("button", {
            classe: "botao fantasma",
            texto: "Apagar o histórico de exemplo",
            ao: {
              click: () => {
                gravarHistorico(lerHistorico().filter((r) => !r.exemplo));
                ctx.recarregar();
              },
            },
          })
        : null,
      el("button", {
        classe: "botao perigo",
        texto: "Apagar todos os meus dados",
        ao: {
          click: () => {
            if (!confirm("Isso apaga perfil, plano e histórico deste aparelho. Não dá para desfazer.")) return;
            limparTudo();
            location.reload();
          },
        },
      }),
    ]),

    temExemplo(historico)
      ? el("div", { classe: "faixa", estilo: { marginTop: "18px" } }, [
          el("span", { classe: "faixa-emoji", texto: "🧪" }),
          el("div", {
            classe: "faixa-texto",
            texto:
              `${historico.filter((r) => r.exemplo).length} dos ${historico.length} treinos ` +
              "são de exemplo, para as telas não abrirem vazias. Apagá-los não " +
              "toca nos treinos que você registrou.",
          }),
        ])
      : null,

    el("p", {
      classe: "aviso-legal",
      texto:
        "Perfil, plano e histórico ficam só neste aparelho. Não há conta, não há " +
        "servidor e nada é enviado para lugar nenhum. Quando a sessão guiada pela " +
        "câmera entrar, o vídeo também é analisado no próprio aparelho e os quadros " +
        "são descartados — o que sai da câmera é texto: repetições, tempos e desvios.",
    }),
    el("p", {
      classe: "aviso-legal",
      texto:
        "O Formi não é um dispositivo médico, não faz diagnóstico e não substitui " +
        "a avaliação de um profissional.",
    }),
  ]);
}

function linha(rotulo        , valor        )              {
  return el("div", { classe: "linha-dado" }, [
    el("span", { classe: "linha-rotulo", texto: rotulo }),
    el("span", { classe: "linha-valor", texto: valor }),
  ]);
}
