/**
 * O guia de movimento: a barra que desce e sobe junto com a repeticao.
 *
 * MUDANCA DE CONCEITO
 * -------------------
 * A primeira versao era um contador de intervalo: enchia continuamente ate a
 * proxima chamada. No teste real deu "fica rodando igual um metronomo e
 * dessincroniza" — porque ela media o RELOGIO enquanto o usuario media o
 * PROPRIO CORPO, e as duas coisas nao tem por que coincidir.
 *
 * Aqui ela guia o movimento: dispara quando a repeticao comeca, leva metade do
 * tempo alvo descendo e metade subindo, e para. Fora da repeticao fica parada
 * no topo, que e onde o corpo esta.
 *
 * `posicao` vai de 0 (em pe) a 1 (no fundo) — a mesma direcao do corpo, para
 * que a barra vertical de um agachamento desca quando voce desce.
 */
export class Guia {
          inicioMs                = null;
          duracaoMs = 2000;

  /** Dispara o ciclo. Chamado junto com o sinal de "desce". */
  comecar(agoraMs        , alvoMs        )       {
    this.inicioMs = agoraMs;
    this.duracaoMs = Math.max(200, alvoMs);
  }

  /** Encerra o ciclo — o corpo voltou ao topo antes ou depois do previsto. */
  parar()       {
    this.inicioMs = null;
  }

  get ativo()          {
    return this.inicioMs !== null;
  }

  /**
   * 0 = em pe, 1 = no fundo. Metade do tempo para cada sentido.
   *
   * Passado o ciclo, fica em 0 em vez de reiniciar: repetir sozinha viraria o
   * metronomo que acabou de ser descartado.
   */
  posicao(agoraMs        )         {
    if (this.inicioMs === null) return 0;
    const t = (agoraMs - this.inicioMs) / this.duracaoMs;
    if (t >= 1) return 0;
    return t < 0.5 ? t * 2 : (1 - t) * 2;
  }

  /** Em qual metade do ciclo: descendo, subindo, ou parado. */
  sentido(agoraMs        )                                    {
    if (this.inicioMs === null) return "parado";
    const t = (agoraMs - this.inicioMs) / this.duracaoMs;
    if (t >= 1) return "parado";
    return t < 0.5 ? "descendo" : "subindo";
  }
}
