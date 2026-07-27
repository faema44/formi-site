/**
 * O gerador do pacote de treinos.
 *
 * Entra o perfil do onboarding, sai uma semana de sessoes montadas a partir do
 * catalogo. Regra de ouro: **filtro e restricao, pontuacao e preferencia**. O
 * filtro decide o que o usuario PODE fazer (nivel, ambiente, equipamento,
 * articulacao) e nunca cede; a pontuacao decide o que ele DEVERIA fazer primeiro
 * e cede o quanto for preciso. Misturar os dois produz plano com exercicio que a
 * pessoa nao consegue executar — o erro que faz desinstalar.
 *
 * O sorteio e semeado pelo perfil: dois usuarios iguais recebem o mesmo plano, e
 * o mesmo usuario nao ve o plano mudar sozinho a cada abertura do app.
 */

                                                                 
import { ORDEM_NIVEL } from "./catalogo.js";
                                                    
import { ler, gravar } from "./armazenamento.js";

                                                                

                       
     
                                                                              
                                                                              
                                                                             
     
                      
                                                                               
                   
               
                       
                     
               
                 
                                                            
               
                          
                    
 

                         
             
               
               
                                           
                    
                     
                
 

                        
                   
                     
               
                    
 

// ---------------------------------------------------------------------------
// Politica por objetivo
// ---------------------------------------------------------------------------

                   
                                                                
                         
                                                                              
                    
                                                                                  
                                     
 

const RECEITAS                            = {
  emagrecer: {
    principal: ["hiit", "forca"],
    classes: ["HIIT", "Cardiovascular", "Definição", "Fartlek"],
    quantidade: { 20: 4, 30: 6, 45: 8 },
  },
  condicionamento: {
    principal: ["hiit", "forca", "mobilidade"],
    classes: ["Cardiovascular", "HIIT", "Funcional", "Resistência Muscular"],
    quantidade: { 20: 4, 30: 5, 45: 7 },
  },
  mobilidade: {
    principal: ["mobilidade", "reprogramacao"],
    classes: ["Regenerativo", "Pilates", "Yoga", "Funcional"],
    quantidade: { 20: 5, 30: 7, 45: 9 },
  },
  forca: {
    principal: ["forca", "hiit"],
    classes: ["Musculação", "Calistenia", "Hipertrofia", "Preparação Esportiva"],
    quantidade: { 20: 4, 30: 5, 45: 7 },
  },
};

/** Grupos que definem o foco de uma sessao. */
const FOCOS                                         = [
  {
    nome: "Pernas e glúteos",
    musculos: ["Quadríceps", "Glúteos", "Isquiotibiais", "Panturrilha", "Adutores", "Abdutores"],
  },
  {
    nome: "Superiores",
    musculos: ["Peitoral", "Deltoide/Ombros", "Tríceps", "Bíceps", "Costas", "Trapézio", "Antebraço"],
  },
  {
    nome: "Core e estabilidade",
    musculos: ["Core/Abdômen", "Lombar", "Flexores/Estabilizadores de Quadril"],
  },
  { nome: "Corpo inteiro", musculos: [] },
];

/** Rodizio de foco por frequencia semanal. Indices em FOCOS. */
const RODIZIO                           = {
  2: [3, 3],
  3: [0, 1, 3],
  4: [0, 1, 2, 3],
  5: [0, 1, 2, 3, 0],
  6: [0, 1, 2, 3, 0, 1],
};

/**
 * Dose por categoria e nivel: [series, dose, unidade, descanso].
 *
 * O sedentario recebe menos serie e mais descanso; o intermediario, o oposto.
 * Mesma logica de `fitcam/perfil.py` no motor — exigencia e tempo sao eixos
 * separados, e quem esta comecando precisa dos dois a favor.
 */
const DOSES                                                                             = {
  hiit: {
    sedentario: [2, 25, "seg", 45],
    iniciante: [3, 35, "seg", 35],
    intermediario: [4, 45, "seg", 25],
  },
  forca: {
    sedentario: [2, 8, "reps", 60],
    iniciante: [3, 10, "reps", 50],
    intermediario: [4, 12, "reps", 40],
  },
  mobilidade: {
    sedentario: [2, 30, "seg", 25],
    iniciante: [2, 40, "seg", 20],
    intermediario: [3, 45, "seg", 15],
  },
  reprogramacao: {
    sedentario: [2, 25, "seg", 30],
    iniciante: [2, 35, "seg", 25],
    intermediario: [3, 40, "seg", 20],
  },
  liberacao: {
    sedentario: [1, 45, "seg", 15],
    iniciante: [1, 60, "seg", 15],
    intermediario: [2, 60, "seg", 10],
  },
};

// ---------------------------------------------------------------------------
// Geracao
// ---------------------------------------------------------------------------

/**
 * O filtro nao deixou exercicio nenhum de pe.
 *
 * Classe propria, e nao um Error generico, para a tela distinguir "combinacao
 * impossivel" (que o usuario resolve afrouxando uma resposta) de um defeito de
 * programa (que ele nao resolve de jeito nenhum).
 */
export class SemExercicios extends Error {
  constructor() {
    super("Nenhum exercício do catálogo atende a essa combinação de respostas.");
    this.name = "SemExercicios";
  }
}

export function gerarPlano(perfil        , catalogo             )        {
  const permitidos = filtrar(perfil, catalogo);
  // Falhar alto. Um plano com zero exercicios atravessa o app inteiro sem
  // quebrar nada — a tela inicial mostra "0 exercicios", a de treinos mostra um
  // cartao vazio, e nada indica onde o erro comecou. O usuario descobre que o
  // produto nao funciona; o log nao registra nada.
  if (!permitidos.length) throw new SemExercicios();

  const sorteio = semear(chaveDoPerfil(perfil));
  const receita = RECEITAS[perfil.objetivo];
  const dias = distribuirDias(perfil.diasPorSemana);
  const rodizio = RODIZIO[perfil.diasPorSemana] ?? RODIZIO[3];

  // Memoria de uso ao longo da SEMANA inteira, nao da sessao: sem isto o mesmo
  // agachamento aparece nas quatro sessoes, porque ele pontua bem em todas.
  const usados = new Set        ();
  const sessoes           = [];

  for (let i = 0; i < perfil.diasPorSemana; i++) {
    const foco = FOCOS[rodizio[i % rodizio.length]];
    const itens         = [];
    // Dentro de UMA sessao a exclusao e absoluta, nao penalidade. O mesmo
    // alongamento aparecendo no aquecimento e de novo no bloco principal e o
    // tipo de coisa que faz o usuario duvidar de que existe um plano ali. Se
    // isso encurtar a sessao, encurtou: `avisoDePlanoCurto` na tela de treinos
    // explica o porque, e cinco exercicios diferentes valem mais que sete com
    // dois repetidos.
    const naSessao = new Set        ();

    itens.push(
      ...escolher(permitidos, {
        categorias: ["mobilidade"],
        quantidade: perfil.minutosPorSessao >= 30 ? 3 : 2,
        foco,
        receita,
        bloco: "aquecimento",
        nivel: perfil.nivel,
        usados,
        naSessao,
        sorteio,
      }),
    );

    itens.push(
      ...escolher(permitidos, {
        categorias: receita.principal,
        quantidade: receita.quantidade[perfil.minutosPorSessao] ?? 5,
        foco,
        receita,
        bloco: "principal",
        nivel: perfil.nivel,
        usados,
        naSessao,
        sorteio,
      }),
    );

    itens.push(
      ...escolher(permitidos, {
        categorias: ["liberacao", "mobilidade"],
        quantidade: perfil.minutosPorSessao >= 45 ? 3 : 2,
        foco,
        receita,
        bloco: "finalizacao",
        nivel: perfil.nivel,
        usados,
        naSessao,
        sorteio,
      }),
    );

    sessoes.push({
      id: `s${i + 1}`,
      nome: `Treino ${String.fromCharCode(65 + i)}`,
      foco: foco.nome,
      diaSemana: dias[i],
      duracaoMin: estimarMinutos(itens),
      itens,
    });
  }

  return {
    criadoEm: new Date().toISOString(),
    objetivo: perfil.objetivo,
    nivel: perfil.nivel,
    sessoes,
  };
}

/**
 * O filtro duro. O que sai daqui o usuario consegue executar hoje, no lugar
 * onde ele treina, com o que ele tem.
 */
function filtrar(perfil        , catalogo             )              {
  const tetoNivel = ORDEM_NIVEL.indexOf(perfil.nivel);
  const tem = new Set([...perfil.equipamentos, "Nenhum"]);

  return catalogo.filter((e) => {
    if (ORDEM_NIVEL.indexOf(e.nivelMinimo) > tetoNivel) return false;
    if (!e.ambientes.includes(perfil.ambiente)) return false;
    if (!e.equipamentos.every((q) => tem.has(q))) return false;
    if (perfil.pouparArticulacoes && e.impacto !== "Baixo") return false;
    return true;
  });
}

                  
                          
                     
                                             
                   
               
               
                                          
                      
                                           
                        
                        
 

function escolher(permitidos             , p        )         {
  const candidatos = permitidos.filter((e) => p.categorias.includes(e.categoria));
  const escolhidos              = [];
  // Saturacao por musculo DENTRO da sessao: seis exercicios de gluteo seguidos
  // sao seis exercicios de gluteo, nao um treino.
  const carga = new Map                ();

  for (let i = 0; i < p.quantidade; i++) {
    let melhor                   = null;
    let melhorNota = -Infinity;

    for (const e of candidatos) {
      if (p.naSessao.has(chaveDeSessao(e))) continue;
      const nota = pontuar(e, p, carga) + p.sorteio() * 2;
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = e;
      }
    }

    // Catalogo pequeno demais para o filtro (equipamento raro + baixo impacto,
    // por exemplo). Entregar 3 exercicios e melhor que repetir para completar 8.
    if (!melhor) break;

    escolhidos.push(melhor);
    p.usados.add(melhor.id);
    p.naSessao.add(chaveDeSessao(melhor));
    for (const m of melhor.musculos) carga.set(m, (carga.get(m) ?? 0) + 1);
  }

  return escolhidos.map((e) => {
    const [series, dose, unidade, descansoS] = DOSES[e.categoria][p.nivel];
    return {
      exercicioId: e.id,
      motorId: e.motorId,
      nome: e.nome,
      categoria: e.categoria,
      musculos: e.musculos,
      bloco: p.bloco,
      series: p.bloco === "aquecimento" ? 1 : series,
      dose,
      unidade,
      descansoS,
    };
  });
}

function pontuar(e           , p        , carga                     )         {
  let nota = 0;

  // Foco da sessao.
  if (p.foco.musculos.length) {
    const acertos = e.musculos.filter((m) => p.foco.musculos.includes(m)).length;
    nota += acertos * 3;
  } else {
    // Corpo inteiro premia quem cobre muito de uma vez.
    nota += Math.min(e.musculos.length, 5);
  }

  // Objetivo.
  nota += e.classes.filter((c) => p.receita.classes.includes(c)).length * 2;
  // Preferencia pela categoria mais alinhada: a primeira da lista vale mais.
  const posicao = p.categorias.indexOf(e.categoria);
  if (posicao >= 0) nota += (p.categorias.length - posicao) * 1.5;
  if (p.bloco === "principal" && e.composto) nota += 1.5;

  // Preferencia forte pelo que a camera sabe medir — e preferencia, nao regra:
  // sao tres definicoes contra 229 exercicios, e um plano montado so com o que
  // o motor mede seria o mesmo agachamento a semana inteira. O bonus garante
  // que o bloco principal quase sempre tenha ao menos uma serie guiada, que e
  // o que faz o produto ser o que ele e.
  if (e.motorId && p.bloco === "principal") nota += 5;

  // Repeticao na semana: penalidade, nao proibicao. Com equipamento escasso o
  // conjunto permitido encolhe, e proibir deixaria a sessao pela metade.
  if (p.usados.has(e.id)) nota -= 6;

  for (const m of e.musculos) nota -= (carga.get(m) ?? 0) * 1.2;

  return nota;
}

/**
 * Sob que chave o exercicio ocupa uma vaga na sessao.
 *
 * Normalmente e o proprio id. Quando ha `movimento`, e ele que conta: as duas
 * definicoes do agachamento existem por causa do angulo da camera, e prescrever
 * as duas na mesma sessao seria mandar agachar 4x12 duas vezes.
 */
function chaveDeSessao(e           )         {
  return e.movimento ?? e.id;
}

/** Estimativa de duracao. Repeticao vale 3 s; o descanso da ultima serie nao conta. */
function estimarMinutos(itens        )         {
  let s = 0;
  for (const i of itens) {
    const trabalho = i.unidade === "seg" ? i.dose : i.dose * 3;
    s += i.series * trabalho + (i.series - 1) * i.descansoS;
    s += 20; // transicao entre exercicios: posicionar o celular e enquadrar
  }
  return Math.max(5, Math.round(s / 60));
}

/**
 * Em que dias a semana cai. Tabela, nao formula: o espacamento bom nao e o
 * matematicamente uniforme — ninguem treina domingo por causa de uma divisao, e
 * quatro dias sao seg/ter/qui/sex, nao um dia sim outro nao ate acabar.
 */
const DIAS_POR_FREQUENCIA                           = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

function distribuirDias(n        )           {
  return DIAS_POR_FREQUENCIA[n] ?? DIAS_POR_FREQUENCIA[3];
}

// ---------------------------------------------------------------------------

/** mulberry32 — gerador semeado, curto e suficiente para sortear desempate. */
function semear(semente        )               {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chaveDoPerfil(p        )         {
  const texto = [
    p.nome, p.objetivo, p.nivel, p.diasPorSemana, p.minutosPorSessao,
    p.ambiente, p.equipamentos.join(","), p.pouparArticulacoes,
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------

export function lerPlano()               {
  return ler              ("plano", null);
}

export function gravarPlano(plano       )       {
  gravar("plano", plano);
}

export function totalExercicios(plano       )         {
  return plano.sessoes.reduce((n, s) => n + s.itens.length, 0);
}

/**
 * A sessao de hoje, ou a proxima da semana. Sempre devolve uma.
 *
 * `pularHoje` para quando o treino de hoje ja foi feito: sem isso o cartao da
 * tela inicial continuava anunciando como "proximo" o treino que o usuario
 * acabou de concluir.
 */
export function proximaSessao(plano       , hoje = new Date(), pularHoje = false)         {
  const limite = hoje.getDay() + (pularHoje ? 1 : 0);
  const ordenadas = [...plano.sessoes].sort((a, b) => a.diaSemana - b.diaSemana);
  // Sem candidato adiante, a semana virou: volta para a primeira sessao.
  return ordenadas.find((s) => s.diaSemana >= limite) ?? ordenadas[0];
}

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function nomeDia(diaSemana        )         {
  return DIAS_CURTOS[diaSemana] ?? "";
}
