/**
 * Historico e as metricas derivadas dele.
 *
 * O registro de um treino tem exatamente os campos que o payload `fitcam.serie/1`
 * do motor entrega — reps, duracao, indice de qualidade — agregados por sessao.
 * Quando a camera entrar no fluxo, `registrar()` passa a ser alimentado por ela
 * sem que nada aqui mude.
 */

import { ler, gravar } from "./armazenamento.js";
                                        

                           
                                         
                   
               
               
                     
               
     
                                                                                 
    
                                                                              
                                                                           
                                                                    
     
                                 
                                   
                                     
     
                                                 
    
                                                                               
                                                                           
                                                                         
     
                 
 

export function lerHistorico()             {
  return ler            ("historico", []);
}

export function gravarHistorico(hist            )       {
  gravar("historico", hist);
}

export function registrar(r          )             {
  const hist = [...lerHistorico().filter((x) => x.data !== r.data || x.sessaoId !== r.sessaoId), r];
  hist.sort((a, b) => a.data.localeCompare(b.data));
  gravarHistorico(hist);
  return hist;
}

// ---------------------------------------------------------------------------
// Datas — sempre locais. `toISOString()` converte para UTC e, a oeste de
// Greenwich, joga todo treino da noite para o dia seguinte.
// ---------------------------------------------------------------------------

export function dataISO(d      )         {
  const p = (n        ) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function somarDias(d      , n        )       {
  const saida = new Date(d);
  saida.setDate(saida.getDate() + n);
  return saida;
}

/** Segunda-feira da semana de `d`. A semana do app comeca na segunda. */
export function inicioDaSemana(d      )       {
  const dia = d.getDay();
  return somarDias(zerar(d), dia === 0 ? -6 : 1 - dia);
}

function zerar(d      )       {
  const saida = new Date(d);
  saida.setHours(0, 0, 0, 0);
  return saida;
}

// ---------------------------------------------------------------------------
// Metricas
// ---------------------------------------------------------------------------

                         
                                                                   
                         
                                                                
                            
                 
                    
 

export function semanaDe(hist            , plano       , hoje = new Date())         {
  const segunda = inicioDaSemana(hoje);
  const feitoPorDia            = [];
  const previstoPorDia            = [];

  for (let i = 0; i < 7; i++) {
    const d = somarDias(segunda, i);
    feitoPorDia.push(hist.some((r) => r.data === dataISO(d)));
    previstoPorDia.push(plano.sessoes.some((s) => s.diaSemana === d.getDay()));
  }

  return {
    feitoPorDia,
    previstoPorDia,
    feitos: feitoPorDia.filter(Boolean).length,
    previstos: plano.sessoes.length,
  };
}

/**
 * Dias seguidos CUMPRINDO O PLANO — nao dias seguidos treinando.
 *
 * A diferenca importa. Quem treina tres vezes por semana nunca chegaria a uma
 * sequencia de 12 pela definicao ingenua, e o numero morreria em 1 para sempre.
 * Aqui o dia de descanso previsto tambem conta: a sequencia mede fidelidade ao
 * plano, que e exatamente o comportamento que o app quer reforcar. Descansar
 * quando o plano manda descansar nao pode ser punido.
 */
export function sequencia(hist            , plano       , hoje = new Date())         {
  if (!hist.length) return 0;

  const datas = new Set(hist.map((r) => r.data));
  const dias = new Set(plano.sessoes.map((s) => s.diaSemana));
  const inicio = zerar(new Date(plano.criadoEm));
  let n = 0;

  for (let i = 0; i < 366; i++) {
    const d = somarDias(zerar(hoje), -i);
    if (d < inicio) break;

    if (dias.has(d.getDay()) && !datas.has(dataISO(d))) {
      // O dia de hoje ainda esta em aberto: nao treinou AINDA nao e furou.
      if (i === 0) continue;
      break;
    }
    n++;
  }
  return n;
}

/**
 * Compromissos: dos ultimos N dias em que o plano marcava treino, quantos foram
 * cumpridos.
 *
 * O contador NAO e por dias corridos, e por dia marcado — e a diferenca decide
 * se o app motiva ou acusa. Uma janela de sete dias corridos perde um treino
 * inteiro de uma vez quando o mais antigo sai por baixo, e a nota caia quinze
 * pontos numa terca de descanso, sem o usuario ter feito nada. Contando
 * compromissos, o dia de descanso simplesmente nao mexe no numero: ele so se
 * move quando o usuario treina (sobe) ou fura um dia marcado (desce), que sao
 * exatamente os dois eventos que a nota deveria refletir.
 *
 * Mesma regra de `sequencia()`: o dia de hoje so entra depois de cumprido —
 * ainda nao ter treinado hoje de manha nao e um furo.
 */
export function compromissos(
  hist            ,
  plano       ,
  hoje = new Date(),
)                                        {
  // Duas semanas de plano: recente o bastante para responder rapido, longo o
  // bastante para um tropeco nao virar despenhadeiro.
  const alvo = Math.max(4, plano.sessoes.length * 2);
  const datas = new Set(hist.map((r) => r.data));
  const dias = new Set(plano.sessoes.map((s) => s.diaSemana));
  const inicio = zerar(new Date(plano.criadoEm));

  let feitos = 0;
  let previstos = 0;

  for (let i = 0; i < 120 && previstos < alvo; i++) {
    const d = somarDias(zerar(hoje), -i);
    if (d < inicio) break;
    if (!dias.has(d.getDay())) continue;

    const cumprido = datas.has(dataISO(d));
    if (i === 0 && !cumprido) continue; // hoje ainda esta em aberto
    previstos++;
    if (cumprido) feitos++;
  }

  return { feitos, previstos };
}

                          
               
                     
                                                     
                 
                                                             
               
 

                       
                
                      
 

/** Pesos nominais. Ficam visiveis na tela: nota opaca nao motiva ninguem. */
export const PESOS = { aderencia: 45, qualidade: 35, consistencia: 20 };

/** Sequencia a partir da qual a consistencia esta cheia. Duas semanas de habito. */
const TETO_SEQUENCIA = 14;

/**
 * A nota de 0 a 100 do cartao "Seu progresso".
 *
 * Tres parcelas porque tres coisas diferentes fazem um treino dar certo:
 * aparecer (aderencia), executar direito (qualidade, que vem do motor) e nao
 * sumir (consistencia). Uma nota so de aderencia premiaria quem faz tudo
 * errado; uma so de qualidade premiaria quem faz um treino perfeito por mes.
 *
 * Quando NENHUM treino foi avaliado pela camera, a parcela de qualidade sai da
 * conta e as outras duas sao reescalonadas. Trata-la como zero seria punir o
 * usuario por uma medida que ele nao tinha como produzir — e a nota, que existe
 * para motivar, faria o contrario.
 */
export function nota(hist            , plano       , hoje = new Date())       {
  const ate = dataISO(hoje);
  const passado = hist.filter((r) => r.data <= ate);

  const { feitos, previstos } = compromissos(passado, plano, hoje);
  const aderencia = previstos ? feitos / previstos : 0;

  const avaliados = passado.filter((r) => r.indiceQualidade !== null).slice(-5);
  const qualidade = avaliados.length
    ? avaliados.reduce((s, r) => s + (r.indiceQualidade ?? 0), 0) / avaliados.length / 100
    : 0;

  const consistencia = Math.min(1, sequencia(passado, plano, hoje) / TETO_SEQUENCIA);

  const bruto            = [
    {
      nome: "Aderência",
      explicacao: `${feitos} dos últimos ${previstos} treinos marcados`,
      fracao: aderencia,
      peso: PESOS.aderencia,
    },
    {
      nome: "Execução",
      explicacao: avaliados.length
        ? `média dos últimos ${avaliados.length} treinos avaliados`
        : "nenhum treino avaliado pela câmera ainda",
      fracao: qualidade,
      peso: avaliados.length ? PESOS.qualidade : 0,
    },
    {
      nome: "Consistência",
      explicacao: `sequência de ${sequencia(passado, plano, hoje)} dias, cheia em ${TETO_SEQUENCIA}`,
      fracao: consistencia,
      peso: PESOS.consistencia,
    },
  ];

  const soma = bruto.reduce((s, p) => s + p.peso, 0) || 1;
  const parcelas = bruto.map((p) => ({ ...p, peso: (p.peso / soma) * 100 }));

  return {
    total: Math.round(parcelas.reduce((s, p) => s + p.fracao * p.peso, 0)),
    parcelas,
  };
}

/** Diferenca da nota de hoje para a de ontem — a manchete da tela inicial. */
export function deltaDeOntem(hist            , plano       , hoje = new Date())         {
  return nota(hist, plano, hoje).total - nota(hist, plano, somarDias(hoje, -1)).total;
}

// ---------------------------------------------------------------------------
// Series para os graficos
// ---------------------------------------------------------------------------

                              
                 
                  
                  
 

export function minutosPorSemana(hist            , semanas        , hoje = new Date())                {
  const saida                = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const segunda = somarDias(inicioDaSemana(hoje), -7 * i);
    const fim = somarDias(segunda, 6);
    const dentro = hist.filter((r) => r.data >= dataISO(segunda) && r.data <= dataISO(fim));
    saida.push({
      rotulo: `${segunda.getDate()}/${segunda.getMonth() + 1}`,
      minutos: dentro.reduce((s, r) => s + r.duracaoMin, 0),
      treinos: dentro.length,
    });
  }
  return saida;
}

/** Soma de um campo de dicionario ao longo do historico recente. */
export function somarPor(
  hist            ,
  campo                           ,
  desde         ,
)                                     {
  const conta = new Map                ();
  for (const r of hist) {
    if (desde && r.data < desde) continue;
    for (const [k, v] of Object.entries(r[campo])) conta.set(k, (conta.get(k) ?? 0) + v);
  }
  return [...conta.entries()]
    .map(([chave, valor]) => ({ chave, valor }))
    .sort((a, b) => b.valor - a.valor);
}

// ---------------------------------------------------------------------------
// Conquistas — reforco, nao gamificacao vazia. Cada uma marca um limiar que
// significa alguma coisa no treino de verdade.
// ---------------------------------------------------------------------------

                            
             
               
                
                       
 

export function conquistas(hist            , plano       , hoje = new Date())              {
  const total = hist.length;
  const seq = sequencia(hist, plano, hoje);
  const melhorQualidade = hist.reduce((m, r) => Math.max(m, r.indiceQualidade ?? 0), 0);
  const minutos = hist.reduce((s, r) => s + r.duracaoMin, 0);

  return [
    { id: "primeiro", nome: "Primeiro treino", emoji: "🌱", conquistada: total >= 1 },
    { id: "semana", nome: "7 dias no plano", emoji: "🔥", conquistada: seq >= 7 },
    { id: "dez", nome: "10 treinos", emoji: "🎯", conquistada: total >= 10 },
    { id: "tecnica", nome: "Execução 90%", emoji: "✨", conquistada: melhorQualidade >= 90 },
    { id: "duasSemanas", nome: "14 dias no plano", emoji: "🏆", conquistada: seq >= 14 },
    { id: "mil", nome: "500 minutos", emoji: "⏱️", conquistada: minutos >= 500 },
  ];
}
