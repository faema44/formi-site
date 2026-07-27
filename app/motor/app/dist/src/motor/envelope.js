/**
 * Correcao por envelope: comparar o usuario com o professor, fase por fase.
 *
 * Porte de fitcam/envelope.py, que e NORMATIVO.
 *
 * Uma `regra_erro` e um limiar escalar escrito a mao: `tronco > 82`. Vale para
 * o movimento inteiro, e por isso tem que ser frouxa o bastante para nao
 * disparar no pior instante da execucao boa.
 *
 * O envelope resolve pela fase. Da gravacao do professor sai, para cada medida
 * e cada estado, a banda que ele ocupou:
 *
 *     em_pe      tronco   0 .. 28 graus
 *     descendo   tronco  22 .. 46
 *     agachado   tronco  38 .. 75
 *
 * Cobrar 72 graus no `agachado` e errado; cobrar 72 no `em_pe` e obvio. O
 * mesmo numero, duas leituras — e nenhum limiar unico distingue as duas.
 *
 * Por ESTADO e nao ponto a ponto: usar a banda de um ponto exigiria saber em
 * que ponto o usuario esta, e a unica forma de estimar isso e comparar as
 * medidas dele com as do professor — circular, porque quem desvia casa com o
 * ponto errado e o desvio se esconde. O estado vem da maquina de estados, que
 * e observacao direta.
 */

                                                                 

                        
                 
                 
 

                           
                      
                          
                                                                             
 

                                 
                 
                 
                              
                
               
                  
                   
     
                                            
    
                                                                              
                                                                           
                                       
     
                  
 

/** Quanto o valor passou da banda, ja com margem. 0 = dentro. */
export function desvioDaBanda(b       , valor        , margem        )         {
  if (valor > b.maximo + margem) return valor - (b.maximo + margem);
  if (valor < b.minimo - margem) return b.minimo - margem - valor;
  return 0;
}

/** Colapsa a grade da referencia em uma banda por estado. */
export function deReferencia(ref   
                      
                          
                       
                            
                  
                                                                  
 )           {
  const bandas                                        = {};
  for (const [medida, blocos] of Object.entries(ref.medidas)) {
    const porEstado                        = {};
    for (let i = 0; i < ref.tamanhoGrade; i++) {
      const estado = ref.ciclo[
        Math.min(Math.floor(i / ref.amostrasPorEstado), ref.ciclo.length - 1)
      ];
      const lo = blocos.minimo[i];
      const hi = blocos.maximo[i];
      const atual = porEstado[estado];
      porEstado[estado] = atual
        ? { minimo: Math.min(lo, atual.minimo), maximo: Math.max(hi, atual.maximo) }
        : { minimo: lo, maximo: hi };
    }
    bandas[medida] = porEstado;
  }
  return {
    exercicioId: ref.exercicioId,
    exercicioVersao: ref.exercicioVersao,
    bandas,
  };
}

                           
                                   
                        
                  
     
                                                         
    
                                                                               
                                                                          
                                                                   
     
                     
 

/**
 * Leitura instantanea do envelope, para o semaforo na tela.
 *
 * Tres niveis, e a margem ganha um segundo uso: ela ja era a folga que separa
 * "dentro" de "corrigir", e vira a faixa de ATENCAO. O usuario ve que esta
 * saindo da banda antes de o app falar — cor a 2 metros chega onde texto e
 * linha fina nao chegam.
 *
 * Sem debounce de proposito. `framesConsecutivos` existe para nao FALAR por
 * causa de um glitch; uma cor que pisca um frame nao interrompe ninguem.
 */
export function situacao(
  ex           , env          ,
  medidas                        , estado        ,
)           {
  let nivel                    = "ok";
  let medida                = null;
  let excesso = 0;

  for (const [m, valor] of Object.entries(medidas)) {
    if (!(m in ex.envelope.mensagens)) continue;
    const banda = env.bandas[m]?.[estado];
    if (!banda) continue;

    const fora = desvioDaBanda(banda, valor, ex.envelope.margem);
    const naMargem = desvioDaBanda(banda, valor, 0);
    if (fora > 0 && fora > excesso) {
      nivel = "fora"; medida = m; excesso = fora;
    } else if (naMargem > 0 && nivel !== "fora" && naMargem > excesso) {
      nivel = "atencao"; medida = m; excesso = naMargem;
    }
  }
  let severidade = 0;
  if (medida) {
    const banda = env.bandas[medida]?.[estado];
    if (banda && ex.envelope.margem > 0) {
      severidade = Math.max(0, Math.min(1,
        desvioDaBanda(banda, medidas[medida], 0) / ex.envelope.margem));
    }
  }
  return { nivel, medida, excesso, severidade };
}

                        
                             
                                 
                                                           
                                                       
 

/**
 * Avalia as medidas do frame contra o envelope, com os mesmos freios das
 * regras: glitch de um frame nao e erro, alerta em laco afasta, e insistir
 * depois de tres avisos so faz desinstalar.
 */
export class MonitorEnvelope {
                   cfg                ;
                   env          ;
          estado = new Map                      ();
          repUltimoAviso                = null;

  constructor(ex           , envelope          ) {
    if (envelope.exercicioId !== ex.id) {
      throw new Error(
        `envelope e de '${envelope.exercicioId}', exercicio e '${ex.id}'`,
      );
    }
    this.cfg = ex.envelope;
    this.env = envelope;
  }

  reiniciar()       {
    this.estado.clear();
    this.repUltimoAviso = null;
  }

  avaliar(
    medidas                        ,
    estado        ,
    timestampMs        ,
    reps = 0,
  )                   {
    if (!this.cfg.ativo) return [];
    const saida                   = [];

    for (const [medida, valor] of Object.entries(medidas)) {
      const frases = this.cfg.mensagens[medida];
      if (!frases) continue; // sem frase e diagnostico, nao correcao
      const banda = this.env.bandas[medida]?.[estado];
      if (!banda) continue;

      let st = this.estado.get(medida);
      if (!st) {
        st = { foraDesdeMs: null, ultimoDisparoMs: null, disparosNaSerie: 0, avisosDados: 0 };
        this.estado.set(medida, st);
      }

      const excesso = desvioDaBanda(banda, valor, this.cfg.margem);
      if (excesso <= 0) {
        st.foraDesdeMs = null;
        continue;
      }

      const direcao = valor > banda.maximo ? "acima" : "abaixo";
      const frase = frases[direcao];
      if (!frase) {
        st.foraDesdeMs = null;
        continue;
      }

      // Sustentacao em tempo: a fase `descendo` dura ~190ms, e exigir 8 frames
      // a 25 fps significava 320ms — o desvio nunca era falado durante o
      // movimento, so quando a repeticao fechava.
      if (st.foraDesdeMs === null) st.foraDesdeMs = timestampMs;
      if (timestampMs - st.foraDesdeMs < this.cfg.msSustentado) continue;
      if (st.disparosNaSerie >= this.cfg.maxPorSerie) continue;
      if (st.ultimoDisparoMs !== null &&
          timestampMs - st.ultimoDisparoMs < this.cfg.cooldownMs) continue;

      st.ultimoDisparoMs = timestampMs;
      st.disparosNaSerie += 1;
      st.foraDesdeMs = null;
      saida.push({
        medida, estado, direcao, valor, banda, excesso, mensagem: frase,
        avisar: false,
      });
    }
    // Pior desvio primeiro. Quem consome fala UM — duas correcoes na mesma
    // pausa competem, e o usuario nao tem como agir nas duas ao mesmo tempo.
    saida.sort((a, b) => b.excesso - a.excesso);

    // No maximo UM aviso por chamada, e e o pior desvio. Decidir por medida
    // deixava os dois saindo juntos na mesma repeticao, que e exatamente o que
    // o espacamento existe para evitar: o usuario precisa de tentativas
    // aplicando uma instrucao antes de receber outra.
    const espacado = this.repUltimoAviso === null ||
      reps - this.repUltimoAviso >= this.cfg.repsEntreAvisos;
    if (espacado) {
      // O candidato e o pior desvio ENTRE OS QUE AINDA TEM AVISO.
      //
      // Dois contadores separados de proposito: `disparosNaSerie` conta
      // EMISSOES e alimenta o resumo; `avisosDados` conta FALAS. Com um so,
      // uma medida que emitia sem ser falada gastava a propria cota e nunca
      // chegava a ser dita.
      const candidato = saida.find(
        (d) => this.estado.get(d.medida) .avisosDados < this.cfg.avisosPorSerie,
      );
      if (candidato) {
        candidato.avisar = true;
        this.estado.get(candidato.medida) .avisosDados += 1;
        this.repUltimoAviso = reps;
      }
    }
    return saida;
  }
}
