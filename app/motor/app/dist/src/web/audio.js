/**
 * Canal de audio: marcacao de ritmo e voz.
 *
 * Duas fontes, nenhuma dependencia:
 *
 *   tique   WebAudio. Um oscilador com envelope curto — sem arquivo para
 *           baixar, sem latencia de decodificacao, e o timing e o do relogio
 *           de audio, nao o do requestAnimationFrame.
 *   voz     speechSynthesis quando existe; senao, a ponte nativa do APK.
 *
 * Sobre a ponte: o WebView do Android NAO implementa a Web Speech API —
 * `typeof speechSynthesis === "undefined"`, verificado no SM-A536E com Android
 * 16. O app ficava mudo por inteiro (contagem, correcao, instrucao, ritmo) e
 * nada avisava, porque o catch aqui embaixo engolia a falha. O WKWebView do iOS
 * implementa, e por isso o mesmo codigo falava no iPhone. A MainActivity expoe
 * `window.vozNativa` com o TextToSpeech do Android; no navegador ela nao existe
 * e o caminho normal continua valendo.
 *
 * A marcacao de compasso e o motivo deste modulo existir. Conduzir ritmo nao
 * exige um corpo na tela: o audio nao disputa espaco visual, e a 2 metros de
 * distancia ele chega melhor que um esqueleto de linhas finas.
 *
 * UMA VOZ POR VEZ. Duas frases sobrepostas nao sao duas informacoes, sao zero.
 * E correcao velha nao e falada: uma frase de tres segundos atras e sobre uma
 * repeticao que ja acabou, e corrigir a rep errada e pior que calar.
 */

                                                   

                             
                                                        
                                                        
                                                  
 

export class CanalAudio {
          ctx                      = null;
          falandoAte = 0;
  prefs            ;

  constructor(prefs            ) {
    this.prefs = prefs;
  }

  /** Precisa ser chamado a partir de um gesto do usuario (regra do navegador). */
  destravar()       {
    if (!this.ctx) {
      const Ctor = (window       ).AudioContext ?? (window       ).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    this.ctx?.resume();
    // Alguns navegadores so liberam a sintese depois de uma fala disparada
    // dentro do gesto; um enunciado vazio serve de chave.
    try {
      if (!(window       ).vozNativa) {
        speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      }
    } catch { /* sem voz disponivel; segue sem ela */ }
  }

  /**
   * Tique curto e audivel em alto-falante de celular.
   *
   * A primeira versao usava seno em 440 Hz, 60 ms, ganho 0,22 — e sumiu no
   * teste. Alto-falante de celular tem pouco corpo abaixo de ~800 Hz, um blip
   * de 60 ms nao dá tempo do ouvido registrar, e 0,22 e baixo demais para uma
   * sala com alguem se movendo.
   *
   * Agora: onda triangular (mais harmonicos, atravessa melhor), o dobro da
   * duracao, e duas vozes em oitava para dar presenca sem virar estridencia.
   */
  tique(hz = 1200, ms = 130, ganho = 0.6)       {
    if (this.prefs.ritmo !== "tique" || !this.ctx) return;
    const t = this.ctx.currentTime;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(ganho, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    env.connect(this.ctx.destination);

    for (const [f, g] of [[hz, 1], [hz * 2, 0.35]]                      ) {
      const osc = this.ctx.createOscillator();
      const vg = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      vg.gain.value = g;
      osc.connect(vg).connect(env);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    }
  }

  /**
   * @param prioridade maior interrompe menor. Contagem = 1, correcao = 2.
   */
  falar(texto        , prioridade = 1, agoraMs = performance.now())       {
    if (!texto) return;
    if (prioridade < 2 && agoraMs < this.falandoAte) return; // nao atropela
    try {
      const nativa = (window       ).vozNativa;
      if (nativa) {
        nativa.falar(texto, prioridade >= 2);
      } else {
        if (prioridade >= 2) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = "pt-BR";
        u.rate = 1.15;
        speechSynthesis.speak(u);
      }
      // Estimativa grosseira de duracao, so para nao empilhar falas.
      this.falandoAte = agoraMs + Math.max(600, texto.length * 70);
    } catch { /* sem voz; a tela continua mostrando */ }
  }

  /**
   * Ha fala em curso?
   *
   * O portao de armar consulta isto: nao se comeca a contar enquanto a
   * instrucao do professor ainda esta sendo dita. Sem isso a contagem
   * regressiva atropela a explicacao — ou, pior, e engolida por ela, porque
   * prioridade 1 nao interrompe.
   */
  ocupado(agoraMs = performance.now())          {
    return agoraMs < this.falandoAte;
  }

  silenciar()       {
    try {
      const nativa = (window       ).vozNativa;
      if (nativa) nativa.calar();
      else speechSynthesis.cancel();
    } catch { /* nada a cancelar */ }
    this.falandoAte = 0;
  }
}

/**
 * Vocabulario do condutor.
 *
 * COM ACENTO, ao contrario do resto do codigo: isto vai para o sintetizador de
 * voz, e "comecar" sem cedilha perde a sibilante enquanto "rapido" sem agudo
 * muda de silaba tonica. O resultado e uma frase que o usuario ouve e nao
 * entende.
 *
 * Rotativo porque a mesma palavra repetida trinta vezes numa serie cansa e
 * deixa de ser ouvida. As alternativas dizem a MESMA coisa — nao e para o
 * usuario ter que interpretar variacao de significado no meio do esforco.
 */
const FRASES = {
  comecar: ["vamos lá", "vamos começar", "prepara"],
  descer: ["desce", "vai", "agora", "mais uma", "desce de novo", "bora"],
  rapido: ["mais rápido", "acelera um pouco", "um pouco mais rápido"],
  devagar: ["devagar", "controla a descida", "sem pressa", "mais devagar"],
  elogio: ["isso", "boa", "assim"],
  fim: ["série concluída", "acabou, muito bem", "terminou, parabéns"],
};

function sortear(lista          , ultimo               )         {
  const opcoes = lista.length > 1 ? lista.filter((f) => f !== ultimo) : lista;
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

/**
 * O condutor: puxa a repeticao, e nunca fala no meio dela.
 *
 * DESENHO
 * -------
 * Um sinal ("desce") sai APENAS com o usuario no topo. Ele executa a
 * repeticao no ritmo dele; o condutor espera voltar. So entao decide quando
 * chamar de novo:
 *
 *     rep mais rapida que o alvo  -> espera o que falta e chama
 *     rep no alvo                 -> chama
 *     rep mais lenta que o alvo   -> "mais rapido", e chama assim que voltar
 *     rep muito lenta             -> so espera a posicao em pe e chama
 *
 * POR QUE ASSIM
 * -------------
 * A versao anterior narrava as fases seguindo o relogio do pacer, e no teste
 * real deu "totalmente dessincronizado, nao sabia se eu estava em pe ou
 * abaixado". Depois passou a seguir o estado do usuario, e ficou em fase — mas
 * virou redundancia: dizer "desce" para quem ja esta descendo nao informa nada.
 *
 * Aqui o sinal volta a CONDUZIR, e mesmo assim nao pode dessincronizar, porque
 * so e emitido num estado conhecido do corpo. A cadencia e mantida no intervalo
 * ENTRE repeticoes, nao dentro delas — que e onde ela nao atrapalha o
 * movimento.
 */
export class Condutor {
          ultimoSinalMs = 0;
          noTopoDesde                = null;
          comecou = false;
          avisoPendente                = null;
          ultimaFrase                = null;
          concluida = false;
  /** Chamado quando o condutor manda comecar uma repeticao. */
  aoChamar                                     = null;

  /**
   * Fora desta razao em torno do alvo, a repeticao ganha comentario.
   * Simetrico: 1,3x mais lenta pede "mais rapido", 1,3x mais rapida pede
   * "devagar". Esperar sem dizer nada corrige a cadencia mas nao ensina —
   * quem acelerou nao sabe que acelerou.
   */
           tolerancia = 1.3;
  /** Silencio minimo no topo antes de chamar, para nao colar no fim da rep. */
           respiroMs = 350;

  /** Silencio minimo entre duas chamadas, se o usuario nao sair do lugar. */
           reconvitesMs = 2600;

  reiniciar()       {
    this.ultimoSinalMs = 0;
    this.noTopoDesde = null;
    this.comecou = false;
    this.avisoPendente = null;
    this.ultimaFrase = null;
    this.concluida = false;
  }

  /** Fecha a serie: para de chamar e comemora uma vez so. */
  concluir(agoraMs        , audio            )       {
    if (this.concluida) return;
    this.concluida = true;
    audio.falar(sortear(FRASES.fim, null), 2, agoraMs);
  }

          dizer(lista          , audio            , agoraMs        , prio = 1)       {
    const f = sortear(lista, this.ultimaFrase);
    this.ultimaFrase = f;
    audio.falar(f, prio, agoraMs);
  }

  /**
   * Quanto falta para a proxima chamada, em [0, 1].
   *
   * E o mesmo prazo que decide o "desce": um circulo enchendo mostra a cadencia
   * sem ocupar o corpo na tela. Antes de comecar fica vazio.
   */
  /**
   * Chamar quando uma repeticao fecha.
   *
   * @param formaOk a repeticao ficou dentro do envelope?
   *
   * Ritmo e forma sao EXCLUDENTES, e a forma vem primeiro: nao adianta pedir
   * velocidade a quem esta executando errado. Enquanto houver desvio, a
   * cadencia cala; quando a forma volta para dentro da banda, ela retoma.
   *
   * Sem isso o usuario ouviria "mais rapido" e "desca mais" na mesma pausa,
   * que sao instrucoes que se atrapalham — descer mais custa tempo.
   */
  aoFecharRep(duracaoMs        , alvoMs        , formaOk = true)       {
    if (!formaOk) {
      this.avisoPendente = null;
      return;
    }
    if (duracaoMs > alvoMs * this.tolerancia) this.avisoPendente = "mais rapido";
    else if (duracaoMs * this.tolerancia < alvoMs) this.avisoPendente = "devagar";
    else this.avisoPendente = null;
  }

  /**
   * Chamar a cada frame. `noTopo` = o usuario esta no estado que conta a rep.
   */
  passo(noTopo         , agoraMs        , alvoMs        , audio            )       {
    if (audio.prefs.ritmo === "nenhum" || this.concluida) return;

    if (!noTopo) {
      // Saiu do topo: esta executando. O condutor cala ate ele voltar.
      this.noTopoDesde = null;
      return;
    }
    if (this.noTopoDesde === null) this.noTopoDesde = agoraMs;

    if (!this.comecou) {
      // O primeiro sinal e um convite, nao uma ordem.
      if (agoraMs - this.noTopoDesde < 600) return;
      this.comecou = true;
      this.ultimoSinalMs = agoraMs;
      this.dizer(FRASES.comecar, audio, agoraMs);
      return;
    }

    // Em pe e o gatilho: quem esta parado no topo esta pronto para descer.
    //
    // Antes o proximo sinal so saia depois de decorrido o tempo alvo desde o
    // anterior, o que fazia o usuario esperar de pe sem motivo. A cadencia
    // agora mora DENTRO da repeticao, guiada pela barra; aqui so ha o respiro
    // para o sinal nao colar no fim da rep anterior.
    if (agoraMs - this.noTopoDesde < this.respiroMs) return;
    if (agoraMs - this.ultimoSinalMs < this.reconvitesMs) return;

    this.ultimoSinalMs = agoraMs;
    if (this.avisoPendente) {
      this.dizer(
        this.avisoPendente === "mais rapido" ? FRASES.rapido : FRASES.devagar,
        audio, agoraMs,
      );
      this.avisoPendente = null;
    }
    if (audio.prefs.ritmo === "tique") audio.tique(900, 130);
    else this.dizer(FRASES.descer, audio, agoraMs);
    this.aoChamar?.(agoraMs);
  }
}
