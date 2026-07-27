/**
 * Onboarding.
 *
 * Uma pergunta por tela, oito perguntas, nenhuma opcional. O criterio para uma
 * pergunta existir e duro: alguma decisao do gerador de plano tem que depender
 * dela. "Qual seu peso?" nao passa — o app nao faria nada diferente com a
 * resposta, e cada pergunta a mais e mais gente que desiste antes de ver o
 * plano.
 *
 * Escolha unica avanca sozinha. Pedir para tocar na opcao e depois em
 * "continuar" dobra os toques de um fluxo que deveria durar quarenta segundos.
 */

import { el, preencher } from "../ui/base.js";
import { icone } from "../ui/icones.js";
import { equipamentosDisponiveis, NOME_NIVEL } from "../dados/catalogo.js";
                                                             
import { OBJETIVOS, gravarPerfil } from "../dados/perfil.js";
                                                 
import { gerarPlano, gravarPlano } from "../dados/plano.js";
import { historicoDeExemplo } from "../dados/exemplo.js";
import { gravarHistorico, lerHistorico } from "../dados/progresso.js";

                                

                 
                                  
                                    
                 
                                                                                              
                                                                       
                                         
                                    
 

export function telaOnboarding(
  catalogo             ,
  aoConcluir            ,
)              {
  const rascunho           = { equipamentos: [] };
  const passos = montarPassos(catalogo);
  let atual = 0;

  const raiz = el("div", { classe: "tela sem-nav", attr: { id: "tela-onboarding" } });

  const desenhar = () => {
    const passo = passos[atual];
    const escolher = (valor         ) => {
      (rascunho                           )[passo.chave] = valor;
      desenhar();
    };
    // Guarda contra o toque duplo. A escolha unica agenda o avanco em 160 ms
    // para a marca aparecer; dois toques rapidos agendavam DOIS avancos, e o
    // segundo pulava a pergunta seguinte inteira — que ficava sem resposta e
    // derrubava o gerador de plano la na frente, longe da causa. O avanco so
    // vale se ainda estivermos no passo que o agendou.
    const meuPasso = atual;
    const avancar = () => {
      if (atual !== meuPasso) return;
      if (atual < passos.length - 1) {
        atual++;
        desenhar();
        raiz.scrollTo({ top: 0 });
      }
    };

    const rotuloBotao = passo.botao ? passo.botao(rascunho) : null;
    const habilitado = passo.pronto ? passo.pronto(rascunho) : true;

    preencher(
      raiz,
      el("div", { classe: "ob-topo" }, [
        atual > 0
          ? el("button", {
              classe: "ob-voltar",
              attr: { "aria-label": "Voltar" },
              ao: { click: () => { atual--; desenhar(); } },
            }, [icone("voltar", 22)])
          : null,
        el("div", { classe: "ob-trilha" }, [
          el("div", {
            classe: "ob-progresso",
            estilo: { width: `${((atual + 1) / passos.length) * 100}%` },
          }),
        ]),
        el("span", { classe: "ob-passo", texto: `${atual + 1}/${passos.length}` }),
      ]),
      el("h1", { classe: "ob-pergunta", texto: passo.pergunta(rascunho) }),
      passo.ajuda ? el("p", { classe: "ob-ajuda", texto: passo.ajuda }) : null,
      passo.desenhar(rascunho, escolher, avancar),
      rotuloBotao
        ? el("div", { classe: "ob-rodape" }, [
            el("button", {
              classe: "botao",
              texto: rotuloBotao,
              attr: habilitado ? {} : { disabled: "true" },
              ao: { click: avancar },
            }),
          ])
        : null,
    );

    if (passo.chave === "gerando") {
      // Cinto de seguranca. Se por qualquer motivo uma pergunta ficou sem
      // resposta, voltar para ela e infinitamente melhor do que gerar um plano
      // silenciosamente vazio — que foi exatamente o que aconteceu quando o
      // toque duplo pulava um passo.
      const pendentes = faltando(rascunho);
      if (pendentes.length) {
        atual = passos.findIndex((p) => p.chave === pendentes[0]);
        desenhar();
        return;
      }
      gerar(rascunho          , catalogo, raiz, aoConcluir);
    }
  };

  desenhar();
  return raiz;
}

// ---------------------------------------------------------------------------

function montarPassos(catalogo             )          {
  return [
    {
      chave: "nome",
      pergunta: () => "Como podemos te chamar?",
      ajuda: "É só para o app falar com você. Fica neste aparelho.",
      desenhar: (r, escolher, avancar) => {
        const campo = el("input", {
          classe: "campo",
          attr: {
            type: "text", placeholder: "Seu nome", value: r.nome ?? "",
            autocomplete: "given-name", enterkeyhint: "next", maxlength: "40",
          },
        })                    ;
        // Sem redesenhar a cada tecla: o `desenhar()` de `escolher` recriaria o
        // campo e o cursor saltaria para o comeco a cada letra digitada. O preco
        // e ter que soltar o botao na mao — o estado dele foi calculado no
        // desenho, quando o campo ainda estava vazio.
        campo.addEventListener("input", () => {
          r.nome = campo.value;
          const botao = campo.closest(".tela")?.querySelector(".ob-rodape .botao");
          if (botao) (botao                     ).disabled = !campo.value.trim();
        });
        campo.addEventListener("keydown", (ev) => {
          if ((ev                 ).key === "Enter" && (r.nome ?? "").trim()) avancar();
        });
        queueMicrotask(() => campo.focus());
        return el("div", {}, [campo]);
      },
      botao: () => "Continuar",
      pronto: (r) => !!(r.nome ?? "").trim(),
    },

    {
      chave: "objetivo",
      pergunta: (r) => `${primeiro(r.nome)}, o que você quer alcançar?`,
      ajuda: "Isso define que tipo de exercício domina o seu plano.",
      desenhar: (r, escolher, avancar) =>
        opcoes(
          OBJETIVOS.map((o) => ({ valor: o.id, titulo: o.nome, desc: o.desc, emoji: o.emoji })),
          r.objetivo,
          escolher,
          avancar,
        ),
    },

    {
      chave: "nivel",
      pergunta: () => "Como está seu condicionamento hoje?",
      ajuda: "Define a exigência e o descanso. Dá para mudar depois.",
      desenhar: (r, escolher, avancar) =>
        opcoes(
          [
            {
              valor: "sedentario"         , emoji: "🌱", titulo: NOME_NIVEL.sedentario,
              desc: "Faz tempo que não treino, ou nunca treinei",
            },
            {
              valor: "iniciante"         , emoji: "🚶", titulo: NOME_NIVEL.iniciante,
              desc: "Me movimento, mas sem rotina firme",
            },
            {
              valor: "intermediario"         , emoji: "🏃", titulo: NOME_NIVEL.intermediario,
              desc: "Treino com regularidade há meses",
            },
          ],
          r.nivel,
          escolher,
          avancar,
        ),
    },

    {
      chave: "diasPorSemana",
      pergunta: () => "Quantos dias por semana?",
      ajuda: "Escolha o número que você sustenta numa semana ruim, não numa boa.",
      desenhar: (r, escolher, avancar) =>
        opcoes(
          [
            { valor: 2, emoji: "2️⃣", titulo: "2 dias", desc: "O mínimo que ainda gera resultado" },
            { valor: 3, emoji: "3️⃣", titulo: "3 dias", desc: "O equilíbrio mais comum" },
            { valor: 4, emoji: "4️⃣", titulo: "4 dias", desc: "Progresso mais rápido" },
            { valor: 5, emoji: "5️⃣", titulo: "5 dias", desc: "Rotina de quem já treina" },
          ],
          r.diasPorSemana,
          escolher,
          avancar,
        ),
    },

    {
      chave: "minutosPorSessao",
      pergunta: () => "Quanto tempo por treino?",
      ajuda: "Inclui aquecimento e finalização.",
      desenhar: (r, escolher, avancar) =>
        opcoes(
          [
            { valor: 20, emoji: "⚡", titulo: "20 minutos", desc: "Curto e direto" },
            { valor: 30, emoji: "⏱️", titulo: "30 minutos", desc: "Cabe em quase todo dia" },
            { valor: 45, emoji: "🕐", titulo: "45 minutos", desc: "Sessão completa" },
          ],
          r.minutosPorSessao,
          escolher,
          avancar,
        ),
    },

    {
      chave: "ambiente",
      pergunta: () => "Onde você vai treinar?",
      ajuda: "Só entram exercícios que funcionam nesse lugar.",
      desenhar: (r, escolher, avancar) =>
        opcoes(
          [
            { valor: "Casa", emoji: "🏠", titulo: "Em casa", desc: "Espaço pequeno, sem barulho" },
            { valor: "Academia", emoji: "🏋️", titulo: "Na academia", desc: "Com equipamentos" },
            { valor: "Ar Livre", emoji: "🌳", titulo: "Ao ar livre", desc: "Parque, praça, quintal" },
          ],
          r.ambiente,
          escolher,
          avancar,
        ),
    },

    {
      chave: "equipamentos",
      pergunta: () => "Tem algum equipamento?",
      ajuda: "Marque o que você tem à mão. Sem nada marcado, o plano usa só o peso do corpo.",
      desenhar: (r, escolher) => {
        const disponiveis = equipamentosDisponiveis(catalogo).slice(0, 8);
        const marcados = new Set(r.equipamentos ?? []);
        return el(
          "div",
          { classe: "opcoes" },
          disponiveis.map((q) =>
            el(
              "button",
              {
                classe: `opcao ${marcados.has(q) ? "marcada" : ""}`,
                attr: { "aria-pressed": String(marcados.has(q)) },
                ao: {
                  click: () => {
                    if (marcados.has(q)) marcados.delete(q);
                    else marcados.add(q);
                    escolher([...marcados]);
                  },
                },
              },
              [
                el("span", { classe: "opcao-texto" }, [
                  el("span", { classe: "opcao-titulo", texto: q }),
                ]),
                el("span", { classe: "opcao-marca" }, [icone("marca", 20)]),
              ],
            ),
          ),
        );
      },
      botao: (r) => ((r.equipamentos ?? []).length ? "Continuar" : "Não tenho nada"),
    },

    {
      chave: "pouparArticulacoes",
      pergunta: () => "Alguma articulação sensível?",
      ajuda: "Joelho, coluna, ombro. Se sim, o plano fica só com exercícios de baixo impacto.",
      desenhar: (r, escolher, avancar) =>
        opcoes(
          [
            {
              valor: false, emoji: "👍", titulo: "Não, pode vir tudo",
              desc: "Salto, corrida e impacto liberados",
            },
            {
              valor: true, emoji: "🦵", titulo: "Sim, quero poupar",
              desc: "Só exercícios de baixo impacto articular",
            },
          ],
          r.pouparArticulacoes,
          escolher,
          avancar,
        ),
    },

    {
      chave: "gerando",
      pergunta: (r) => `Montando o plano de ${primeiro(r.nome)}`,
      desenhar: () =>
        el("div", { classe: "gerando" }, [
          el("div", { classe: "gerando-anel" }),
          el("p", { classe: "gerando-passo", attr: { id: "gerando-passo" } }),
        ]),
    },
  ];
}

// ---------------------------------------------------------------------------

                 
                 
                 
                
                 
 

function opcoes(
  lista         ,
  atual         ,
  escolher                      ,
  avancar            ,
)              {
  return el(
    "div",
    { classe: "opcoes" },
    lista.map((o) =>
      el(
        "button",
        {
          classe: `opcao ${o.valor === atual ? "marcada" : ""}`,
          ao: {
            click: () => {
              escolher(o.valor);
              // A marca precisa aparecer antes da troca de tela, senao o toque
              // nao tem retorno nenhum e o usuario nao sabe no que clicou.
              setTimeout(avancar, 160);
            },
          },
        },
        [
          o.emoji ? el("span", { classe: "opcao-emoji", texto: o.emoji }) : null,
          el("span", { classe: "opcao-texto" }, [
            el("span", { classe: "opcao-titulo", texto: o.titulo }),
            o.desc ? el("span", { classe: "opcao-desc", texto: o.desc }) : null,
          ]),
          el("span", { classe: "opcao-marca" }, [icone("marca", 20)]),
        ],
      ),
    ),
  );
}

function primeiro(nome                    )         {
  const bruto = (nome ?? "").trim().split(/\s+/)[0];
  return bruto ? bruto[0].toUpperCase() + bruto.slice(1) : "você";
}

/**
 * A espera encenada.
 *
 * O plano fica pronto em poucos milissegundos. As tres mensagens existem porque
 * um plano que aparece instantaneamente parece uma lista pronta de prateleira —
 * e ele nao e: sao 229 exercicios filtrados pelo que a pessoa acabou de
 * responder. Mostrar o trabalho e o que faz o resultado valer.
 */
/** Toda pergunta obrigatoria, na ordem em que aparece. */
const OBRIGATORIAS                   = [
  "nome", "objetivo", "nivel", "diasPorSemana", "minutosPorSessao", "ambiente",
  "pouparArticulacoes",
];

export function faltando(rascunho          )                   {
  return OBRIGATORIAS.filter((c) => rascunho[c] === undefined || rascunho[c] === "");
}

function gerar(perfil        , catalogo             , raiz             , aoConcluir            )       {
  const completo         = {
    ...perfil,
    nome: perfil.nome.trim(),
    equipamentos: perfil.equipamentos ?? [],
    criadoEm: new Date().toISOString(),
  };

  const mensagens = [
    `Filtrando ${catalogo.length} exercícios pelo seu nível e ambiente…`,
    `Montando ${completo.diasPorSemana} sessões de ${completo.minutosPorSessao} minutos…`,
    "Ajustando séries e descanso ao seu condicionamento…",
  ];

  let i = 0;
  const alvo = raiz.querySelector("#gerando-passo");
  const passar = () => {
    if (alvo) alvo.textContent = mensagens[i] ?? "";
    i++;
    if (i <= mensagens.length) {
      setTimeout(passar, 620);
      return;
    }

    let plano;
    try {
      plano = gerarPlano(completo, catalogo);
    } catch (erro) {
      mostrarSemExercicios(raiz, erro         );
      return;
    }
    gravarPerfil(completo);

    // Historico de exemplo so quando nao ha nada de verdade. Quem refaz as
    // respostas depois de treinar tres semanas nao pode ter o proprio historico
    // trocado por um simulado.
    if (lerHistorico().length === 0) {
      const semeado = historicoDeExemplo(plano);
      gravarPlano(semeado.plano);
      gravarHistorico(semeado.historico);
    } else {
      gravarPlano(plano);
    }

    aoConcluir();
  };
  passar();
}

/**
 * O beco sem saida do filtro: por exemplo ar livre + baixo impacto + um
 * equipamento raro. Nao ha plano possivel, e a saida honesta e dizer o que
 * restringiu e deixar voltar — nao um plano vazio nem uma tela branca.
 */
function mostrarSemExercicios(raiz             , erro       )       {
  preencher(
    raiz,
    el("div", { classe: "vazio" }, [
      el("div", { classe: "vazio-emoji", texto: "🤔" }),
      el("h2", { classe: "cartao-titulo", texto: "Combinação apertada demais" }),
      el("p", { texto: erro.message }),
      el("p", {
        classe: "aviso-legal",
        texto:
          "Costuma ser o ambiente somado à restrição de impacto. Volte uma " +
          "pergunta e afrouxe uma das duas.",
      }),
      el("button", {
        classe: "botao",
        texto: "Voltar e ajustar",
        estilo: { marginTop: "20px" },
        ao: { click: () => location.reload() },
      }),
    ]),
  );
}
