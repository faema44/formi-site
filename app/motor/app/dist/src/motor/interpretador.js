/**
 * O interpretador de exercicios.
 *
 * Porte de fitcam/interpretador.py, que e a implementacao NORMATIVA. Este
 * arquivo deve reproduzi-la exatamente; `tests/conformidade.test.ts` e a suite
 * que as duas precisam passar com os mesmos numeros.
 *
 * Motor generico que NAO conhece nenhum exercicio: recebe landmarks + uma
 * definicao JSON e produz repeticoes, erros e eventos.
 *
 * Ordem de processamento por frame (importa para a paridade):
 *     1. porta de visibilidade
 *     2. calculo das medidas cruas
 *     3. suavizacao One Euro
 *     4. atualizacao dos agregados da repeticao
 *     5. maquina de estados (uma transicao no maximo por frame)
 *     6. regras instantaneas
 *     7. regras por repeticao (apenas no frame em que a rep fecha)
 */

                                               
import {
  mapaEstados,
              
                 
                 
} from "./definicoes.js";
import { FiltroOneEuro } from "./filtros.js";
import { calcular, visibilidadeMinimaDe,            } from "./medidas.js";

                         
                                                         
                      
                             
 

                                 
                      
                 
               
                                  
                      
                    
 

                       
                         
                                 
                          
 

export class Interpretador {
           ex           ;
           aspecto        ;
  estado         ;
  reps         ;
  errosRegistrados           ;

                   mapa                     ;
          filtros                             ;
          regras                           ;
          tEntradaEstado                ;
          tInicioRep                ;
          agregados                        ;
          rastreando                 ;

  /**
   * @param aspecto largura/altura do quadro em pixels. Informado, as medidas
   * saem em angulos fisicos; ver a nota no topo de medidas.ts. O default 1.0
   * preserva o comportamento historico e e o que a fonte sintetica assume.
   */
  constructor(exercicio           , aspecto = 1) {
    this.ex = exercicio;
    this.aspecto = aspecto;
    this.mapa = mapaEstados(exercicio);
    this.reiniciar();
  }

  reiniciar()       {
    this.estado = this.ex.estadoInicial;
    this.reps = 0;
    this.filtros = new Map(
      this.ex.medidas.map((m) => [m.id, new FiltroOneEuro(m.minCutoff, m.beta)]),
    );
    this.regras = new Map(
      this.ex.regrasErro.map((r) => [
        r.id,
        { framesSeguidos: 0, ultimoDisparoMs: null, disparosNaSerie: 0 },
      ]),
    );
    this.tEntradaEstado = null;
    this.tInicioRep = null;
    this.agregados = new Map(this.ex.medidas.map((m) => [m.id, []]));
    this.rastreando = null; // null = ainda nao sabemos
    this.errosRegistrados = [];
  }

  processar(landmarks                  , timestampMs        )                 {
    const eventos           = [];

    // 1. porta de visibilidade ---------------------------------------------
    const vis = visibilidadeMinimaDe(landmarks, this.ex.landmarksRequeridos);
    if (vis < this.ex.visibilidadeMinima) {
      if (this.rastreando !== false) {
        this.rastreando = false;
        eventos.push({
          tipo: "visibilidade",
          timestampMs,
          dados: {
            rastreando: false,
            visibilidade: arred(vis, 3),
            mensagem: "Afaste-se para eu ver seu corpo inteiro",
          },
        });
      }
      this.zerarContadoresRegras();
      return {
        timestampMs, estado: this.estado, reps: this.reps,
        medidas: {}, rastreando: false, eventos,
      };
    }

    if (!this.rastreando) {
      this.rastreando = true;
      eventos.push({
        tipo: "visibilidade",
        timestampMs,
        dados: { rastreando: true, visibilidade: arred(vis, 3) },
      });
    }

    // 2 e 3. medidas + suavizacao ------------------------------------------
    const ctx           = {};
    const tS = timestampMs / 1000;
    for (const m of this.ex.medidas) {
      const bruto = calcular(m.tipo, m.pontos, landmarks, this.aspecto);
      ctx[m.id] = m.suavizar ? this.filtros.get(m.id) .filtrar(bruto, tS) : bruto;
    }

    if (this.tEntradaEstado === null) this.tEntradaEstado = timestampMs;
    if (this.tInicioRep === null) this.tInicioRep = timestampMs;

    ctx.visibilidade = vis;
    ctx.reps = this.reps;
    ctx.t_estado_ms = timestampMs - this.tEntradaEstado;
    ctx.t_rep_ms = timestampMs - this.tInicioRep;

    // 4. agregados da repeticao --------------------------------------------
    for (const m of this.ex.medidas) this.agregados.get(m.id) .push(ctx[m.id]);

    // 5. maquina de estados ------------------------------------------------
    let fechouRep = false;
    const definicao = this.mapa.get(this.estado) ;

    let destino                = null;
    let porTimeout = false;
    for (const t of definicao.transicoes) {
      if (t.expr.avaliar(ctx)) {
        destino = t.para;
        break;
      }
    }

    if (destino === null && definicao.timeoutMs !== null) {
      if (ctx.t_estado_ms >= definicao.timeoutMs) {
        destino = definicao.aoTimeout ?? this.ex.estadoInicial;
        porTimeout = true;
      }
    }

    if (destino !== null) {
      const anterior = this.estado;
      this.estado = destino;
      this.tEntradaEstado = timestampMs;
      const novo = this.mapa.get(destino) ;
      eventos.push({
        tipo: "estado",
        timestampMs,
        dados: porTimeout
          ? { de: anterior, para: destino, motivo: "timeout" }
          : { de: anterior, para: destino },
      });
      // Um timeout e sempre um ABORTO: descarta a repeticao em andamento em
      // vez de conta-la. Nunca conte uma rep que o usuario nao fechou.
      if (porTimeout) {
        this.zerarAgregados();
        this.tInicioRep = timestampMs;
      } else if (novo.contaRepeticao) {
        this.reps += 1;
        fechouRep = true;
        eventos.push({
          tipo: "repeticao",
          timestampMs,
          dados: {
            numero: this.reps,
            duracao_ms: Math.trunc(ctx.t_rep_ms),
            som: novo.som,
          },
        });
      }
    }

    // 6. regras instantaneas -----------------------------------------------
    for (const regra of this.ex.regrasErro) {
      if (regra.tipo !== "instantaneo") continue;
      const ev = this.avaliarRegra(regra, ctx, timestampMs, false);
      if (ev) eventos.push(ev);
    }

    // 7. regras por repeticao ----------------------------------------------
    if (fechouRep) {
      const ctxRep           = { ...ctx, ...this.calcularAgregados() };
      for (const regra of this.ex.regrasErro) {
        if (regra.tipo !== "por_repeticao") continue;
        const ev = this.avaliarRegra(regra, ctxRep, timestampMs, true);
        if (ev) eventos.push(ev);
      }
      this.zerarAgregados();
      this.tInicioRep = timestampMs;
    }

    for (const e of eventos) if (e.tipo === "erro") this.errosRegistrados.push(e);

    const medidasSaida                         = {};
    for (const m of this.ex.medidas) medidasSaida[m.id] = arred(ctx[m.id], 2);

    return {
      timestampMs, estado: this.estado, reps: this.reps,
      medidas: medidasSaida, rastreando: true, eventos,
    };
  }

  // ------------------------------------------------------------------
          avaliarRegra(
    regra           ,
    ctx          ,
    timestampMs        ,
    ignorarFrames         ,
  )                {
    const st = this.regras.get(regra.id) ;

    if (regra.estadosAtivos.length && !regra.estadosAtivos.includes(this.estado)) {
      st.framesSeguidos = 0;
      return null;
    }

    let ativa         ;
    try {
      ativa = Boolean(regra.expr.avaliar(ctx));
    } catch {
      st.framesSeguidos = 0;
      return null;
    }

    if (!ativa) {
      st.framesSeguidos = 0;
      return null;
    }

    st.framesSeguidos += 1;
    if (!ignorarFrames && st.framesSeguidos < regra.framesConsecutivos) return null;
    if (st.disparosNaSerie >= regra.maxPorSerie) return null;
    if (st.ultimoDisparoMs !== null && timestampMs - st.ultimoDisparoMs < regra.cooldownMs) {
      return null;
    }

    st.ultimoDisparoMs = timestampMs;
    st.disparosNaSerie += 1;
    st.framesSeguidos = 0;
    return {
      tipo: "erro",
      timestampMs,
      dados: {
        regra: regra.id,
        mensagem: regra.mensagem,
        severidade: regra.severidade,
        rotulo_display: regra.rotuloDisplay,
        rep: this.reps,
      },
    };
  }

          calcularAgregados()           {
    const agg           = {};
    for (const [mid, valores] of this.agregados) {
      if (valores.length === 0) continue;
      const min = Math.min(...valores);
      const max = Math.max(...valores);
      agg[`min_rep_${mid}`] = min;
      agg[`max_rep_${mid}`] = max;
      agg[`amp_rep_${mid}`] = max - min;
      agg[`med_rep_${mid}`] = valores.reduce((a, b) => a + b, 0) / valores.length;
    }
    return agg;
  }

          zerarAgregados()       {
    for (const k of this.agregados.keys()) this.agregados.set(k, []);
  }

          zerarContadoresRegras()       {
    for (const st of this.regras.values()) st.framesSeguidos = 0;
  }
}

/** round() do Python é banker's rounding; aqui basta o comportamento comum. */
function arred(v        , casas        )         {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}
