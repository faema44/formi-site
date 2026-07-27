/**
 * Carregamento e validacao das definicoes de exercicio.
 *
 * Porte de fitcam/definicoes.py, que e NORMATIVO.
 *
 * O ponto que justifica o porte inteiro: **a biblioteca nao e duplicada**. Os
 * mesmos arquivos de `biblioteca/*.json` sao lidos aqui e no Python. E ali que
 * moram os bugs de calibracao — se cada implementacao tivesse a sua copia, os
 * dois motores corrigiriam exercicios diferentes com o mesmo nome.
 *
 * A validacao e deliberadamente rigorosa. E melhor um erro em cima da mesa do
 * que uma definicao quebrada sincronizada para 10.000 dispositivos.
 */

import { ErroExpressao, compilar,         } from "./expressao.js";
import { LANDMARKS, TIPOS_MEDIDA,          } from "./medidas.js";

/** Medidas sinteticas que o interpretador injeta e que podem ser referenciadas. */
export const MEDIDAS_INTERNAS = new Set([
  "t_estado_ms", // tempo no estado atual
  "t_rep_ms",    // tempo desde o inicio da repeticao atual
  "reps",        // repeticoes ja contadas na serie
  "visibilidade" // visibilidade media dos landmarks requeridos
]);

/** Agregados disponiveis apenas em regras do tipo "por_repeticao". */
export const PREFIXOS_AGREGADO = ["min_rep_", "max_rep_", "amp_rep_", "med_rep_"];

export const SEVERIDADES = new Set(["info", "aviso", "critico"]);
export const ORIENTACOES = new Set(["lateral", "frontal", "qualquer"]);
export const ENQUADRAMENTOS = new Set(["retrato", "paisagem"]);
export const MODOS_FEEDBACK = new Set(["visual", "audio"]);

export class ErroDefinicao extends Error {
  constructor(mensagem        ) {
    super(mensagem);
    this.name = "ErroDefinicao";
  }
}

                         
             
               
                
                    
               
                    
 

                            
               
                 
           
 

                         
               
                          
                          
                     
                           
                           
 

                            
             
                   
                   
                                        
                          
                                                             
                     
                                                      
                                                     
                                                                           
                     
                               
           
 

                        
                
                   
                   
 

                                 
                 
                                                                      
                                                             
                     
                                                      
                                                     
                                                                           
                                                                           
                                                                 
 

                       
                       
                 
 

/**
 * O que o professor ensina, para o que o motor NAO mede.
 *
 * Tres textos, um por momento de atencao disponivel: `antes` (frase inteira),
 * `demo` (por cima do video do professor, quando o usuario esta olhando e nao
 * executando) e `durante` (tres palavras, tem que caber na fase).
 *
 * `regra` amarra o conceito a uma RegraErro quando o dado JA e coletado: ai o
 * canal durante a serie e da correcao medida. Ver docs/instrucoes.md.
 */
                            
             
                       
                      
                         
                                             
                                                                     
                       
 

const QUANDOS_INSTRUCAO = new Set(["no_topo", "descida", "qualquer"]);
// Tres palavras. A 2 s por repeticao a descida dura menos de um segundo, e
// frase que nao termina na fase e pior que silencio.
const MAX_PALAVRAS_DURANTE = 3;

                            
             
                 
               
                           
                        
                   
               
             
                           
                             
                             
                    
                    
                        
                          
                          
                                     
 

export function mapaEstados(ex           )                      {
  return new Map(ex.estados.map((e) => [e.nome, e]));
}

export function limitarTempo(t       , ms        )         {
  return Math.max(t.minRepMs, Math.min(t.maxRepMs, ms));
}

// ---------------------------------------------------------------------------

function exigir   (d                         , chave        , ctx        )    {
  if (!(chave in d)) {
    throw new ErroDefinicao(`${ctx}: campo obrigatorio ausente: '${chave}'`);
  }
  return d[chave]     ;
}

function validarIdentificadores(
  expr    ,
  disponiveis             ,
  ctx        ,
  permitirAgregados         ,
)       {
  for (const ident of expr.identificadores()) {
    if (disponiveis.has(ident) || MEDIDAS_INTERNAS.has(ident)) continue;
    const prefixo = permitirAgregados
      ? PREFIXOS_AGREGADO.find((p) => ident.startsWith(p))
      : undefined;
    if (prefixo) {
      const base = ident.split("_rep_")[1];
      if (disponiveis.has(base)) continue;
      throw new ErroDefinicao(
        `${ctx}: agregado '${ident}' referencia medida inexistente '${base}'`,
      );
    }
    throw new ErroDefinicao(`${ctx}: identificador desconhecido '${ident}'`);
  }
}

export function carregarObjeto(dados                     )            {
  const ctx = `exercicio '${dados.id ?? "<sem id>"}'`;

  const orientacao = dados.orientacao_camera ?? "qualquer";
  if (!ORIENTACOES.has(orientacao)) {
    throw new ErroDefinicao(`${ctx}: orientacao_camera invalida: '${orientacao}'`);
  }
  const enquadramento = dados.enquadramento ?? "retrato";
  if (!ENQUADRAMENTOS.has(enquadramento)) {
    throw new ErroDefinicao(`${ctx}: enquadramento invalido: '${enquadramento}'`);
  }
  const feedback = dados.feedback ?? "visual";
  if (!MODOS_FEEDBACK.has(feedback)) {
    throw new ErroDefinicao(`${ctx}: feedback invalido: '${feedback}'`);
  }

  const bt = dados.tempo ?? {};
  const tempo        = {
    repMs: Math.trunc(bt.rep_ms ?? 2400),
    minRepMs: Math.trunc(bt.min_rep_ms ?? 1300),
    maxRepMs: Math.trunc(bt.max_rep_ms ?? 5000),
  };
  if (!(tempo.minRepMs <= tempo.repMs && tempo.repMs <= tempo.maxRepMs)) {
    throw new ErroDefinicao(
      `${ctx}: tempo incoerente — exige min_rep_ms <= rep_ms <= max_rep_ms, ` +
        `veio ${tempo.minRepMs}/${tempo.repMs}/${tempo.maxRepMs}`,
    );
  }

  const be = dados.envelope ?? {};
  const envelope                 = {
    ativo: Boolean(be.ativo ?? false),
    margem: Number(be.margem ?? 8),
    msSustentado: Math.trunc(be.ms_sustentado ?? 150),
    cooldownMs: Math.trunc(be.cooldown_ms ?? 5000),
    maxPorSerie: Math.trunc(be.max_por_serie ?? 10),
    avisosPorSerie: Math.trunc(be.avisos_por_serie ?? 1),
    repsEntreAvisos: Math.trunc(be.reps_entre_avisos ?? 2),
    mensagens: be.mensagens ?? {},
  };
  const idsDeclaradas = new Set((dados.medidas ?? []).map((m     ) => m.id));
  for (const [medida, frases] of Object.entries(envelope.mensagens)) {
    if (!idsDeclaradas.has(medida)) {
      throw new ErroDefinicao(`${ctx}: envelope referencia medida inexistente '${medida}'`);
    }
    for (const direcao of Object.keys(frases          )) {
      if (direcao !== "acima" && direcao !== "abaixo") {
        throw new ErroDefinicao(`${ctx}: envelope '${medida}': direcao invalida '${direcao}'`);
      }
    }
  }

  const bd = dados.demo ?? {};
  const demo       = { video: bd.video ?? null, ciclos: Math.trunc(bd.ciclos ?? 2) };

  const medidas           = [];
  for (const m of exigir       (dados, "medidas", ctx)) {
    const tipo = exigir        (m, "tipo", ctx);
    if (!(tipo in TIPOS_MEDIDA)) {
      throw new ErroDefinicao(`${ctx}: tipo de medida invalido: '${tipo}'`);
    }
    const pontos = exigir       (m, "pontos", ctx);
    const aridade = TIPOS_MEDIDA[tipo];
    if (aridade > 0 && pontos.length !== aridade) {
      throw new ErroDefinicao(
        `${ctx}: medida '${m.id}' tipo ${tipo} espera ${aridade} pontos`,
      );
    }
    if (tipo === "angulo_visivel") {
      // Aqui os pontos sao BASES, sem sufixo: o motor resolve o lado em tempo
      // de execucao, escolhendo o que a camera enxerga melhor.
      for (const p of pontos            ) {
        for (const lado of ["e", "d"]) {
          if (!(`${p}_${lado}` in LANDMARKS)) {
            throw new ErroDefinicao(
              `${ctx}: medida '${m.id}' tipo angulo_visivel exige pontos sem ` +
                `sufixo de lado; nao existe '${p}_${lado}'`,
            );
          }
        }
      }
    } else {
      for (const p of pontos) {
        if (typeof p === "string" && !(p in LANDMARKS)) {
          throw new ErroDefinicao(`${ctx}: landmark desconhecido: '${p}'`);
        }
      }
    }
    const suav = m.suavizacao ?? {};
    medidas.push({
      id: exigir        (m, "id", ctx),
      tipo,
      pontos: [...pontos],
      minCutoff: Number(suav.min_cutoff ?? 1.0),
      beta: Number(suav.beta ?? 0.01),
      suavizar: Boolean(suav.ativo ?? true),
    });
  }

  const idsMedidas = new Set(medidas.map((m) => m.id));
  if (idsMedidas.size !== medidas.length) {
    throw new ErroDefinicao(`${ctx}: ids de medida duplicados`);
  }

  const bloco = exigir     (dados, "maquina_estados", ctx);
  const estadoInicial = exigir        (bloco, "inicial", ctx);

  const estados           = [];
  for (const e of exigir       (bloco, "estados", ctx)) {
    const nome = exigir        (e, "nome", ctx);
    const transicoes              = [];
    for (const t of e.transicoes ?? []) {
      const quando = exigir        (t, "quando", ctx);
      let expr    ;
      try {
        expr = compilar(quando);
      } catch (exc) {
        if (exc instanceof ErroExpressao) {
          throw new ErroDefinicao(`${ctx}: estado '${nome}': ${exc.message}`);
        }
        throw exc;
      }
      validarIdentificadores(expr, idsMedidas, `${ctx}: estado '${nome}'`, false);
      transicoes.push({ para: exigir        (t, "para", ctx), quando, expr });
    }
    const aoCompletar = e.ao_completar ?? {};
    estados.push({
      nome,
      transicoes,
      contaRepeticao: Boolean(aoCompletar.contar_rep ?? false),
      som: aoCompletar.som ?? null,
      timeoutMs: e.timeout_ms ?? null,
      aoTimeout: e.ao_timeout ?? null,
    });
  }

  const nomes = new Set(estados.map((e) => e.nome));
  if (!nomes.has(estadoInicial)) {
    throw new ErroDefinicao(`${ctx}: estado inicial '${estadoInicial}' nao existe`);
  }
  for (const e of estados) {
    for (const t of e.transicoes) {
      if (!nomes.has(t.para)) {
        throw new ErroDefinicao(`${ctx}: transicao para estado inexistente '${t.para}'`);
      }
    }
    if (e.aoTimeout && !nomes.has(e.aoTimeout)) {
      throw new ErroDefinicao(`${ctx}: ao_timeout aponta para estado inexistente`);
    }
  }
  if (!estados.some((e) => e.contaRepeticao)) {
    throw new ErroDefinicao(`${ctx}: nenhum estado conta repeticao; o ciclo nunca fecha`);
  }

  const regras              = [];
  for (const r of dados.regras_erro ?? []) {
    const rid = exigir        (r, "id", ctx);
    const tipo = r.tipo ?? "instantaneo";
    if (tipo !== "instantaneo" && tipo !== "por_repeticao") {
      throw new ErroDefinicao(`${ctx}: regra '${rid}': tipo invalido '${tipo}'`);
    }
    const condicao = exigir        (r, "condicao", ctx);
    let expr    ;
    try {
      expr = compilar(condicao);
    } catch (exc) {
      if (exc instanceof ErroExpressao) {
        throw new ErroDefinicao(`${ctx}: regra '${rid}': ${exc.message}`);
      }
      throw exc;
    }
    validarIdentificadores(
      expr, idsMedidas, `${ctx}: regra '${rid}'`, tipo === "por_repeticao",
    );
    const sev = r.severidade ?? "aviso";
    if (!SEVERIDADES.has(sev)) {
      throw new ErroDefinicao(`${ctx}: regra '${rid}': severidade invalida '${sev}'`);
    }
    for (const est of r.estados_ativos ?? []) {
      if (!nomes.has(est)) {
        throw new ErroDefinicao(`${ctx}: regra '${rid}': estado '${est}' nao existe`);
      }
    }
    regras.push({
      id: rid,
      condicao,
      mensagem: exigir        (r, "mensagem", ctx),
      tipo,
      estadosAtivos: [...(r.estados_ativos ?? [])],
      framesConsecutivos: Math.trunc(r.frames_consecutivos ?? 5),
      cooldownMs: Math.trunc(r.cooldown_ms ?? 4000),
      maxPorSerie: Math.trunc(r.max_por_serie ?? 3),
      severidade: sev,
      rotuloDisplay: r.rotulo_display ?? null,
      expr,
    });
  }

  if (new Set(regras.map((r) => r.id)).size !== regras.length) {
    throw new ErroDefinicao(`${ctx}: ids de regra duplicados`);
  }

  const instrucoes              = [];
  const idsRegras = new Set(regras.map((r) => r.id));
  for (const i of (dados.instrucoes ?? [])         ) {
    const iid = exigir        (i, "id", ctx);
    const quando = i.quando ?? "no_topo";
    if (!QUANDOS_INSTRUCAO.has(quando)) {
      throw new ErroDefinicao(`${ctx}: instrucao '${iid}': quando invalido '${quando}'`);
    }
    const durante                = i.durante ?? null;
    if (durante !== null && durante.split(/\s+/).length > MAX_PALAVRAS_DURANTE) {
      throw new ErroDefinicao(
        `${ctx}: instrucao '${iid}': 'durante' tem ` +
        `${durante.split(/\s+/).length} palavras, maximo ${MAX_PALAVRAS_DURANTE}`,
      );
    }
    const regra                = i.regra ?? null;
    if (regra !== null && !idsRegras.has(regra)) {
      throw new ErroDefinicao(`${ctx}: instrucao '${iid}': regra '${regra}' nao existe`);
    }
    // Lembrete e correcao sobre a mesma coisa na mesma serie e o defeito que o
    // vinculo existe para impedir.
    if (regra !== null && durante !== null) {
      throw new ErroDefinicao(
        `${ctx}: instrucao '${iid}': tem 'regra' e 'durante'. Quando o dado e ` +
        `medido, o canal durante a serie e da regra`,
      );
    }
    if (!i.antes && !i.demo && !durante) {
      throw new ErroDefinicao(`${ctx}: instrucao '${iid}': nenhum texto`);
    }
    instrucoes.push({
      id: iid,
      antes: i.antes ?? null,
      demo: i.demo ?? null,
      durante,
      quando,
      repeticoes: Math.trunc(i.repeticoes ?? 3),
      regra,
    });
  }

  if (new Set(instrucoes.map((i) => i.id)).size !== instrucoes.length) {
    throw new ErroDefinicao(`${ctx}: ids de instrucao duplicados`);
  }

  const landmarksReq = exigir       (dados, "landmarks_requeridos", ctx);
  for (const p of landmarksReq) {
    if (typeof p !== "string" || p in LANDMARKS) continue;
    // Base sem lado: a porta passa a exigir o lado mais visivel.
    if (["e", "d"].every((lado) => `${p}_${lado}` in LANDMARKS)) continue;
    throw new ErroDefinicao(`${ctx}: landmark requerido desconhecido: '${p}'`);
  }

  return {
    id: exigir        (dados, "id", ctx),
    versao: Math.trunc(exigir        (dados, "versao", ctx)),
    nome: exigir        (dados, "nome", ctx),
    orientacaoCamera: orientacao,
    enquadramento,
    feedback,
    tempo,
    demo,
    envelope,
    landmarksRequeridos: [...landmarksReq],
    visibilidadeMinima: Number(dados.visibilidade_minima ?? 0.6),
    medidas,
    estados,
    estadoInicial,
    regrasErro: regras,
    instrucoes,
    metadados: dados.metadados ?? {},
  };
}
