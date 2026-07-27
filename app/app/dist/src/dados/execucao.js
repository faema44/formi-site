/**
 * O treino em andamento.
 *
 * Existe porque a sessao guiada e uma NAVEGACAO DE PAGINA INTEIRA: o app sai do
 * ar, o motor abre, a serie acontece, e o app volta do zero. Nenhum estado em
 * memoria atravessa isso. O progresso do treino precisa estar gravado antes de
 * cada saida, ou o usuario perde o treino inteiro ao fazer a terceira serie.
 *
 * Isso tambem resolve o caso feio de graca: bateria acabando no meio do treino,
 * ligacao chegando, app morto pelo sistema. Ao reabrir, o treino continua de
 * onde parou.
 *
 * Uma ida ao motor = UMA serie. O motor conta uma serie por vez — e o que o
 * `ColetorSessao` agrega e o que ele entrega. Mandar 3x12 como 36 repeticoes
 * seguidas seria outro exercicio.
 */

import { ler, gravar } from "./armazenamento.js";
                                         
                                               
import { dataISO } from "./progresso.js";

                             
                      
               
                    
                     
               
                                                           
                                 
                                                                        
                                
 

                           
                   
                     
                                  
                 
                                         
                
                       
 

export function lerExecucao()                  {
  return ler                 ("execucao", null);
}

export function gravarExecucao(e                 )       {
  gravar("execucao", e);
}

export function iniciarExecucao(sessaoId        )           {
  const nova           = {
    sessaoId,
    iniciadaEm: new Date().toISOString(),
    indice: 0,
    serie: 0,
    feitas: [],
  };
  gravarExecucao(nova);
  return nova;
}

/** Passou da ultima serie do ultimo item. */
export function terminou(execucao          , sessao        )          {
  return execucao.indice >= sessao.itens.length;
}

/**
 * Registra uma serie e move o ponteiro.
 *
 * Grava antes de devolver: quem chama isto esta prestes a navegar para o motor
 * de novo, e o que nao estiver no armazenamento nao existe.
 */
export function concluirSerie(
  execucao          ,
  sessao        ,
  feita            ,
)           {
  const item = sessao.itens[execucao.indice];
  const serie = execucao.serie + 1;
  const passouDoItem = !item || serie >= item.series;

  const proxima           = {
    ...execucao,
    indice: passouDoItem ? execucao.indice + 1 : execucao.indice,
    serie: passouDoItem ? 0 : serie,
    feitas: [...execucao.feitas, feita],
  };
  gravarExecucao(proxima);
  return proxima;
}

/** Pula o item inteiro — dor, falta de espaco, ou simplesmente nao quer. */
export function pularItem(execucao          )           {
  const proxima           = { ...execucao, indice: execucao.indice + 1, serie: 0 };
  gravarExecucao(proxima);
  return proxima;
}

/**
 * O registro que vai para o historico.
 *
 * `indiceQualidade` e a media SO das series avaliadas pela camera. Se nenhuma
 * foi, fica `null` — a mesma regra do registro manual, e o que impede um treino
 * feito no olho de virar nota de tecnica.
 */
export function registroDaExecucao(
  sessao        ,
  execucao          ,
  hoje = new Date(),
)           {
  const musculos                         = {};
  const categorias                         = {};
  let reps = 0;

  for (const f of execucao.feitas) {
    reps += f.reps;
    categorias[f.categoria] = (categorias[f.categoria] ?? 0) + f.reps;
    // Uma repeticao de agachamento nao e uma de quadriceps MAIS uma de gluteo:
    // e uma so, dividida. Mesma conta do registro manual.
    const fatia = f.musculos.length ? f.reps / f.musculos.length : 0;
    for (const m of f.musculos) musculos[m] = Math.round((musculos[m] ?? 0) + fatia);
  }

  const avaliadas = execucao.feitas.filter((f) => f.indiceQualidade !== null);
  const indiceQualidade = avaliadas.length
    ? Math.round(
        avaliadas.reduce((s, f) => s + (f.indiceQualidade ?? 0), 0) / avaliadas.length,
      )
    : null;

  return {
    data: dataISO(hoje),
    sessaoId: sessao.id,
    nome: sessao.nome,
    foco: sessao.foco,
    // Estimativa do plano, nao tempo medido: as series manuais nao tem relogio,
    // e somar so o tempo das guiadas contaria metade do treino.
    duracaoMin: sessao.duracaoMin,
    reps,
    indiceQualidade,
    musculos,
    categorias,
  };
}

/** Quantas repeticoes uma serie deste item vale, para o registro manual. */
export function repsDaSerie(dose        , unidade                )         {
  return unidade === "reps" ? dose : Math.round(dose / 3);
}
