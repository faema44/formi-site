/**
 * Leitura da referencia gravada (fitcam.referencia/1).
 *
 * O arquivo vem de `gravar.py`, que extrai a trajetoria do professor de um
 * video. Aqui so se le — gravar continua sendo trabalho de mesa, com o Python.
 */

                             
                      
                          
                  
                            
                                                                                     
                                          
                                                                  
                            
                                                                 
                             
                                                                 
                                 
     
                                                          
    
                                                                             
                                                                        
     
                     
                  
                       
 

export function lerReferencia(d     )             {
  if (d?.schema !== "fitcam.referencia/1") {
    throw new Error(`schema desconhecido: ${d?.schema}`);
  }
  return {
    exercicioId: d.exercicio.id,
    exercicioVersao: d.exercicio.versao,
    ciclo: d.ciclo,
    amostrasPorEstado: d.amostras_por_estado,
    medidas: d.medidas,
    fracaoPorEstado: d.fracao_por_estado,
    tempoRepMs: d.tempo_rep_ms,
    pose: d.pose ?? null,
    amostraMs: d.amostra_ms ?? null,
    ancoraVideo: d.ancora_video ?? null,
    espelhado: Boolean(d.espelhado),
    aspecto: d.aspecto ?? 1,
    tamanhoGrade: d.ciclo.length * d.amostras_por_estado,
  };
}

/**
 * Redistribui o tempo do estado de contagem (o topo do movimento).
 *
 * A fracao gravada inclui a PAUSA do professor entre uma repeticao e outra —
 * no agachamento medido, 37% do ciclo. Reproduzir isso num fantasma que
 * CONDUZ faz ele passar um terco do tempo parado, e a leitura e "esta lento".
 *
 * A pausa certa vem do acoplamento (o pacer espera no topo ate voce fechar a
 * rep), nao da animacao. Aqui o estado parado e limitado a `tetoParado` e a
 * sobra vai para as fases que se movem, proporcionalmente.
 */
export function fracoesDeConducao(
  ref            , tetoParado = 0.12,
)                         {
  const parado = ref.ciclo[0]; // o ciclo canonico comeca no estado que conta
  const fr = { ...ref.fracaoPorEstado };
  const atual = fr[parado] ?? 0;
  if (atual <= tetoParado) return fr;

  const sobra = atual - tetoParado;
  const moveis = ref.ciclo.slice(1);
  const somaMoveis = moveis.reduce((s, e) => s + (fr[e] ?? 0), 0) || 1;
  fr[parado] = tetoParado;
  for (const e of moveis) fr[e] = (fr[e] ?? 0) + sobra * ((fr[e] ?? 0) / somaMoveis);
  return fr;
}

/**
 * Mapeia a fase do pacer [0, 1) para um ponto da grade.
 *
 * Usa as FRACOES DE TEMPO medidas, nao uma divisao igual: se o professor gasta
 * 40% da rep descendo e 25% subindo, o fantasma tambem gasta.
 */
export function indiceDaFase(
  ref            , fase        , tetoParado = 0.12,
)         {
  const f = Math.max(0, Math.min(0.999999, fase));
  const fracoes = fracoesDeConducao(ref, tetoParado);
  let acumulado = 0;
  for (let k = 0; k < ref.ciclo.length; k++) {
    const estado = ref.ciclo[k];
    const fr = fracoes[estado] ?? 1 / ref.ciclo.length;
    if (f < acumulado + fr) {
      const dentro = (f - acumulado) / Math.max(1e-9, fr);
      const offset = Math.trunc(dentro * ref.amostrasPorEstado);
      return k * ref.amostrasPorEstado + Math.min(offset, ref.amostrasPorEstado - 1);
    }
    acumulado += fr;
  }
  return ref.tamanhoGrade - 1;
}
