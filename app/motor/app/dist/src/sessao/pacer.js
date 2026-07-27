/**
 * O pacer: o metronomo do movimento, acoplado a repeticao do usuario.
 *
 * Porte de fitcam/sessao_ao_vivo.py::Pacer. NAO faz parte do motor normativo —
 * o firmware nao conduz ninguem, ele so mede. Isto e politica de produto.
 *
 * QUEM SEGUE QUEM
 * ---------------
 * Dentro da repeticao, o pacer conduz. Entre repeticoes, o usuario libera.
 *
 * Ele executa a rep no tempo prescrito e, ao voltar ao topo, ESPERA ate a
 * maquina de estados do usuario fechar a rep dele. Tres consequencias, e as
 * tres sao o motivo do desenho:
 *
 *   - o usuario segue o pacer, que e o que da ritmo e motiva;
 *   - a contagem continua vindo do corpo do usuario, entao ninguem ganha
 *     repeticao de graca;
 *   - o loop de velocidade nao tem como disparar, porque o pacer nunca fica
 *     mais de uma repeticao a frente. A trava e estrutural, nao e um limite
 *     ajustado.
 *
 * `fase` percorre [0, 1) ao longo de um ciclo e e o que anima o fantasma. So
 * existe UM relogio na tela: tudo que se mexe deriva daqui.
 */

export class Pacer {
  tempoRepMs        ;
  fase = 0;
  ciclos = 0;
  esperando = false;

  constructor(tempoRepMs        ) {
    this.tempoRepMs = tempoRepMs;
  }

  avancar(dtMs        , repsUsuario        )       {
    if (this.esperando) {
      if (repsUsuario < this.ciclos) return; // travado no topo
      this.esperando = false;
      this.fase = 0;
    }

    this.fase += dtMs / Math.max(1, this.tempoRepMs);
    if (this.fase >= 1) {
      this.ciclos += 1;
      this.fase = 0;
      if (repsUsuario < this.ciclos) this.esperando = true;
    }
  }

  /** Quantas repeticoes o pacer esta a frente. Por construcao, no maximo 1. */
  defasagem(repsUsuario        )         {
    return this.ciclos - repsUsuario;
  }
}

/**
 * Ajuste do ritmo DENTRO da serie. Alonga, nunca encurta.
 *
 * Se o usuario esta levando mais tempo que o prescrito, o pacer cede na
 * direcao dele. Se esta indo mais rapido, o pacer NAO acelera: acelerar porque
 * o usuario acelerou realimenta o proprio sinal, e os dois entram numa
 * corrida. O acoplamento no topo ja limita a defasagem a uma repeticao; isto
 * evita que ele chegue nesse limite toda hora.
 */
export function esticarTempo(
  tempoAtualMs        ,
  duracaoObservadaMs        ,
  limites                                        ,
  elasticidade = 0.35,
)         {
  if (duracaoObservadaMs <= tempoAtualMs) return tempoAtualMs;
  const alvo = tempoAtualMs + elasticidade * (duracaoObservadaMs - tempoAtualMs);
  return Math.max(limites.minRepMs, Math.min(limites.maxRepMs, alvo));
}
