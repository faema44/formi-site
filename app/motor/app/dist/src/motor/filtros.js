/**
 * Filtro One Euro (Casiez, Roussel & Vogel, 2012).
 *
 * Porte de fitcam/filtros.py, que e NORMATIVO.
 *
 * Suaviza o jitter das medidas sem introduzir a latencia de uma media movel.
 * Quando o sinal esta parado ele filtra forte; quando o sinal se move rapido
 * ele solta, preservando a resposta.
 *
 * Aplicamos o filtro sobre as MEDIDAS (angulos, distancias) e nao sobre os
 * landmarks crus: sao poucos sinais, o custo cai, e e exatamente a curva que a
 * maquina de estados consome.
 *
 * Parametros que importam na calibracao:
 *     minCutoff  menor = mais suave e mais lento. Comece em 1.0.
 *     beta       maior = responde mais rapido a movimento veloz. Comece em 0.01.
 */

function alfa(taxaHz        , cutoff        )         {
  const tau = 1 / (2 * Math.PI * cutoff);
  const te = 1 / taxaHz;
  return 1 / (1 + tau / te);
}

class PassaBaixa {
  valor                = null;

  filtrar(x        , a        )         {
    this.valor = this.valor === null ? x : a * x + (1 - a) * this.valor;
    return this.valor;
  }
}

export class FiltroOneEuro {
          x = new PassaBaixa();
          dx = new PassaBaixa();
          tAnterior                = null;
          xAnterior                = null;

           minCutoff        ;
           beta        ;
           dCutoff        ;

  constructor(minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  reiniciar()       {
    this.x = new PassaBaixa();
    this.dx = new PassaBaixa();
    this.tAnterior = null;
    this.xAnterior = null;
  }

  filtrar(valor        , timestampS        )         {
    if (this.tAnterior === null) {
      this.tAnterior = timestampS;
      this.xAnterior = valor;
      this.x.filtrar(valor, 1.0);
      return valor;
    }

    let dt = timestampS - this.tAnterior;
    if (dt <= 0) dt = 1 / 30;
    const taxa = 1 / dt;
    this.tAnterior = timestampS;

    const derivada = (valor - (this.xAnterior ?? valor)) / dt;
    this.xAnterior = valor;
    const derivadaSuave = this.dx.filtrar(derivada, alfa(taxa, this.dCutoff));

    const cutoff = this.minCutoff + this.beta * Math.abs(derivadaSuave);
    return this.x.filtrar(valor, alfa(taxa, cutoff));
  }
}
