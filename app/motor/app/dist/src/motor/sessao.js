/**
 * Agregacao de uma serie.
 *
 * Porte de fitcam/sessao.py, que e NORMATIVO.
 *
 * Este e o UNICO dado que sai do dispositivo. Nenhum frame, nenhuma
 * coordenada: apenas texto estruturado. E tambem exatamente o payload que
 * alimenta o relatorio pos-treino gerado pelo LLM.
 */

                                                                 

                              
                                                          
                 
               
                     
                             
                                         
                      
                                  
                             
 

                               
                           
                      
                                                                             
          
                                                        
                                      
      
 

export class ColetorSessao {
           exercicioId        ;
           exercicioVersao        ;
           exercicioNome        ;
           inicioIso        ;

  reps = 0;
  duracaoMs = 0;
  repeticoes                             = [];
  erros                        = [];
  framesSemRastreio = 0;
  framesTotais = 0;
  // Repeticoes em que houve ALGUM aviso — de regra ou de envelope. Base do
  // indice de qualidade; ver resumo().
  repsSujas = 0;
          repSuja = false;

  constructor(exercicioId        , versao        , nome        ) {
    this.exercicioId = exercicioId;
    this.exercicioVersao = versao;
    this.exercicioNome = nome;
    this.inicioIso = new Date().toISOString().replace(/\.\d+Z$/, "+00:00");
  }

  consumir(resultado                )       {
    this.framesTotais += 1;
    if (!resultado.rastreando) this.framesSemRastreio += 1;
    this.duracaoMs = Math.max(this.duracaoMs, resultado.timestampMs);
    for (const ev of resultado.eventos) this.registrar(ev);

    // Sujeira e por QUADRO, nao por indice de repeticao. No quadro em que a rep
    // fecha o interpretador emite repeticao, depois as regras instantaneas,
    // depois as por_repeticao — e as instantaneas de dentro da rep ja passaram
    // com `rep` uma unidade menor, porque `reps` so incrementa no fechamento.
    // Contar pelo campo `rep` faria a mesma repeticao fisica valer por duas.
    if (resultado.eventos.some((e) => e.tipo === "erro")) this.repSuja = true;
    if (resultado.eventos.some((e) => e.tipo === "repeticao")) {
      if (this.repSuja) this.repsSujas += 1;
      this.repSuja = false;
    }
  }

  /**
   * Desvio de envelope na repeticao em curso.
   *
   * O envelope vive fora do interpretador — compara cada medida com a banda que
   * o professor ocupou naquela fase —, entao os desvios dele nao chegam por
   * evento. Sem esta porta o indice voltaria a ignorar metade do que a tela
   * mostra.
   */
  marcarDesvio()       {
    this.repSuja = true;
  }

          registrar(ev        )       {
    if (ev.tipo === "repeticao") {
      this.reps = ev.dados.numero;
      this.repeticoes.push({
        numero: ev.dados.numero,
        timestamp_ms: ev.timestampMs,
        duracao_ms: ev.dados.duracao_ms ?? 0,
      });
    } else if (ev.tipo === "erro") {
      this.erros.push({
        regra: ev.dados.regra,
        mensagem: ev.dados.mensagem,
        severidade: ev.dados.severidade,
        timestamp_ms: ev.timestampMs,
        rep: ev.dados.rep,
      });
    }
  }

  resumo()              {
    const contagem                         = {};
    for (const e of this.erros) contagem[e.regra] = (contagem[e.regra] ?? 0) + 1;
    const duracoes = this.repeticoes.map((r) => r.duracao_ms).filter((d) => d > 0);

    // Sem repeticoes nao existe qualidade de execucao: reportar 0 seria tao
    // enganoso quanto reportar 100. O app deve tratar null como "serie nao
    // realizada".
    //
    // A base e REPETICAO LIMPA, nao contagem de avisos. A formula antiga —
    // 1 - erros/reps — tinha dois defeitos que o usuario via na tela:
    // ignorava os desvios de envelope (resumo com "qualidade 100%" e, uma linha
    // abaixo, "joelho demais: 1x"), e ficava presa ao teto de `max_por_serie`,
    // entao dez repeticoes erradas do inicio ao fim davam os mesmos 70% de tres
    // erros em dez. Media quanto o app RECLAMOU, nao quanto a pessoa errou.
    const qualidade =
      this.reps === 0
        ? null
        : arred(100 * (this.reps - Math.min(this.reps, this.repsSujas)) / this.reps, 1);

    return {
      exercicio: {
        id: this.exercicioId,
        nome: this.exercicioNome,
        versao: this.exercicioVersao,
      },
      inicio: this.inicioIso,
      reps: this.reps,
      duracao_ms: this.duracaoMs,
      tempo_medio_rep_ms: duracoes.length
        ? Math.trunc(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
        : 0,
      erros_por_tipo: contagem,
      total_erros: this.erros.length,
      indice_qualidade: qualidade,
      cobertura_rastreio: arred(
        100 * (1 - this.framesSemRastreio / Math.max(1, this.framesTotais)), 1,
      ),
    };
  }

  payload()               {
    return {
      schema: "fitcam.serie/1",
      resumo: this.resumo(),
      repeticoes: this.repeticoes,
      erros: this.erros,
    };
  }

  /** Bloco pronto para o prompt do relatorio pos-treino. */
  promptLLM()         {
    const r = this.resumo();
    const linhas = [
      `Exercicio: ${r.exercicio.nome}`,
      `Repeticoes concluidas: ${r.reps}`,
      `Tempo medio por repeticao: ${r.tempo_medio_rep_ms} ms`,
      `Repeticoes sem nenhum aviso: ${r.indice_qualidade}%`,
    ];
    const tipos = Object.entries(r.erros_por_tipo);
    if (tipos.length) {
      linhas.push("Desvios tecnicos observados:");
      for (const [regra, n] of tipos) {
        const msg = this.erros.find((e) => e.regra === regra) .mensagem;
        linhas.push(`  - ${regra} (${n}x): ${msg}`);
      }
    } else {
      linhas.push("Nenhum desvio tecnico detectado.");
    }
    return linhas.join("\n");
  }
}

function arred(v        , casas        )         {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}
