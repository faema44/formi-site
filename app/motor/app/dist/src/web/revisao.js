/**
 * Revisao pos-serie: a sua execucao sobre a do professor.
 *
 * O fantasma sobreposto foi descartado como ferramenta AO VIVO — dois
 * esqueletos na mesma imagem competem em vez de informar, e o teste real deu
 * "os fantasmas atrapalham". Mas o defeito era o momento, nao a ideia: durante
 * o movimento voce precisa da atencao no corpo; depois, precisa exatamente de
 * comparar.
 *
 * Aqui os dois aparecem parados, lado a lado no mesmo referencial, e voce pode
 * olhar o quanto quiser. Nada disputa nada.
 *
 * COMO A TRAJETORIA E CAPTURADA
 * -----------------------------
 * Na mesma grade de FASE da referencia, e nao em tempo. Cada frame e colocado
 * no ponto da grade que mais se parece com a fase em que o usuario esta; no
 * fim, as duas trajetorias estao alinhadas por fase e sao comparaveis mesmo
 * que ele tenha executado num ritmo completamente diferente.
 */

import { LANDMARKS, em, escalaCorporal,            } from "../motor/medidas.js";

/**
 * O corpo aponta para +x?
 *
 * Porte de `olha_para_x_positivo` em gravacao.py. Decide o espelhamento que
 * poe qualquer execucao num unico sentido canonico — sem isso, filmar o mesmo
 * agachamento pelo outro lado produz uma trajetoria que parece oposta.
 */
export function olhaParaXPositivo(landmarks                  )          {
  const ombros = (em(landmarks, "ombro_e").x + em(landmarks, "ombro_d").x) / 2;
  return em(landmarks, "nariz").x >= ombros;
}

/**
 * Pose invariante a posicao no quadro e a distancia da camera.
 *
 * `espelhar` reproduz o `sx = -1` de gravacao.py. A referencia e gravada no
 * sentido canonico, entao a pose do usuario precisa ir para o MESMO espaco —
 * caso contrario a sobreposicao compara um corpo virado para a esquerda com
 * outro virado para a direita, e todo desvio vira ruido.
 */
export function normalizarPose(
  landmarks                  , aspecto = 1, espelhar = false,
)             {
  const q = {
    x: (em(landmarks, "quadril_e").x + em(landmarks, "quadril_d").x) / 2,
    y: (em(landmarks, "quadril_e").y + em(landmarks, "quadril_d").y) / 2,
  };
  const esc = escalaCorporal(landmarks, aspecto);
  const sx = espelhar ? -1 : 1;
  return landmarks.map((p) => [
    (sx * (p.x - q.x) * aspecto) / esc, (p.y - q.y) / esc,
  ]);
}

export class GravadorDaSerie {
           tamanhoGrade        ;
          grade                       ;
          visitas          ;
  // Decidido UMA vez, no primeiro quadro rastreado, e mantido pela serie
  // inteira — como faz o Gravador do Python. Reavaliar a cada quadro faria a
  // pose virar do avesso no meio do agachamento, quando o nariz cruza a linha
  // dos ombros.
          espelhar                 = null;

  // Valor medio de cada medida em cada ponto da grade. E o que permite mostrar
  // a curva do usuario contra a do professor no fim: a pose diz a forma, a
  // medida diz o numero, e e o numero que responde "meu joelho fechou menos".
          curvasDoUsuario = new Map                           ();

                   ciclo                   ;
                   amostrasPorEstado        ;
  // Quadros da fase em curso, esperando o fim dela. Ver `registrar`.
          pendentes                                                          = [];
          estadoPendente                = null;

  constructor(
    tamanhoGrade        ,
    ciclo                    = [],
    amostrasPorEstado = 0,
  ) {
    this.tamanhoGrade = tamanhoGrade;
    this.ciclo = ciclo;
    this.amostrasPorEstado = amostrasPorEstado;
    this.grade = new Array(tamanhoGrade).fill(null);
    this.visitas = new Array(tamanhoGrade).fill(0);
  }

  reiniciar()       {
    this.grade = new Array(this.tamanhoGrade).fill(null);
    this.visitas = new Array(this.tamanhoGrade).fill(0);
    this.curvasDoUsuario.clear();
    this.espelhar = null;
    this.pendentes = [];
    this.estadoPendente = null;
  }

  /**
   * Guarda o quadro na fase em curso; a posicao na grade sai quando a fase
   * termina.
   *
   * Por que retrospectivo. A curva do professor foi gravada por TEMPO — cada
   * fase fatiada em 12 pedacos iguais, ver `indice_da_fase` em gravacao.py. A
   * do usuario era colocada por SEMELHANCA de pose, e as duas iam para o mesmo
   * grafico: o eixo x significava "quanto do movimento passou" numa linha e
   * "com o que voce se parece" na outra. Quem executava com amplitude diferente
   * da do professor — corpo diferente, agachamento mais raso — deixava colunas
   * inteiras vazias mesmo executando certo, porque nenhuma pose dele era a mais
   * parecida com aquelas. O grafico saia picotado e ninguem sabia por que.
   *
   * Distribuir no fim da fase e o que permite usar a mesma regua sem adivinhar
   * duracao: quando ela acaba, sabe-se quantos quadros teve.
   */
  registrar(
    estado        , landmarks                  , aspecto        ,
    medidas                         = {},
  )       {
    if (this.espelhar === null) this.espelhar = !olhaParaXPositivo(landmarks);
    if (estado !== this.estadoPendente) {
      this.descarregar();
      this.estadoPendente = estado;
    }
    this.pendentes.push({
      pose: normalizarPose(landmarks, aspecto, this.espelhar),
      medidas,
    });
  }

  /**
   * Fecha a fase em curso. Chamar ao encerrar a serie, senao a ultima fase
   * fica no buffer e some do grafico.
   */
  fechar()       {
    this.descarregar();
    this.estadoPendente = null;
  }

  /** Espalha os quadros da fase pelas colunas dela, em ordem de tempo. */
          descarregar()       {
    const n = this.pendentes.length;
    const k = this.estadoPendente ? this.ciclo.indexOf(this.estadoPendente) : -1;
    if (n === 0 || k < 0 || this.amostrasPorEstado <= 0) {
      this.pendentes = [];
      return;
    }
    const ini = k * this.amostrasPorEstado;
    for (let i = 0; i < n; i++) {
      const off = Math.min(
        this.amostrasPorEstado - 1,
        Math.floor((i / n) * this.amostrasPorEstado),
      );
      this.guardar(ini + off, this.pendentes[i].pose, this.pendentes[i].medidas);
    }
    this.pendentes = [];
  }

  /**
   * Media incremental entre as repeticoes: uma rep isolada carrega o jitter do
   * frame, e a media do que ele repetiu descreve melhor como ele executa.
   */
          guardar(
    indice        , pose            , medidas                        ,
  )       {
    const primeira = !this.grade[indice];
    const n = primeira ? 1 : this.visitas[indice] + 1;

    for (const [id, valor] of Object.entries(medidas)) {
      let curva = this.curvasDoUsuario.get(id);
      if (!curva) {
        curva = new Array(this.tamanhoGrade).fill(null);
        this.curvasDoUsuario.set(id, curva);
      }
      const anterior = curva[indice];
      curva[indice] = anterior === null ? valor : anterior + (valor - anterior) / n;
    }

    if (primeira) {
      this.grade[indice] = pose;
      this.visitas[indice] = 1;
      return;
    }
    this.visitas[indice] = n;
    const atual = this.grade[indice] ;
    for (let j = 0; j < pose.length; j++) {
      atual[j][0] += (pose[j][0] - atual[j][0]) / n;
      atual[j][1] += (pose[j][1] - atual[j][1]) / n;
    }
  }

  /** Curva media do usuario para cada medida, ponto a ponto da grade. */
  get curvas()                                 {
    return this.curvasDoUsuario;
  }

  /** Quantos pontos da grade o usuario chegou a percorrer. */
  get cobertura()         {
    return this.grade.filter(Boolean).length / this.tamanhoGrade;
  }

  /**
   * Quantas poses caíram em cada bloco de `tamanhoBloco` pontos.
   *
   * Os blocos sao os ESTADOS do ciclo, e e essa a pergunta que decide se a
   * revisao vale: "tem pose de cada fase do movimento?". A fracao de pontos da
   * grade inteira nao serve — medido no celular, a descida real dura ~3 quadros
   * por repeticao a 15 fps, contra 12 pontos que a grade reserva para ela.
   * Exigir cobertura alta seria exigir uma taxa de quadros que o telefone nao
   * tem, e a revisao ficaria escondida para sempre.
   */
  preenchidosPorBloco(tamanhoBloco        )           {
    const blocos           = [];
    for (let i = 0; i < this.tamanhoGrade; i += tamanhoBloco) {
      let n = 0;
      for (let j = i; j < Math.min(i + tamanhoBloco, this.tamanhoGrade); j++) {
        if (this.grade[j]) n += 1;
      }
      blocos.push(n);
    }
    return blocos;
  }

  /** A pose gravada no ponto, ou a mais proxima ja preenchida. */
  em(indice        )                    {
    if (this.grade[indice]) return this.grade[indice];
    for (let d = 1; d < this.tamanhoGrade; d++) {
      const a = this.grade[(indice - d + this.tamanhoGrade) % this.tamanhoGrade];
      if (a) return a;
      const b = this.grade[(indice + d) % this.tamanhoGrade];
      if (b) return b;
    }
    return null;
  }
}

/**
 * Desenha uma pose normalizada num canvas, ancorada nos pes.
 *
 * Mesma ancoragem do fantasma ao vivo, e pelo mesmo motivo: o quadril e o que
 * mais se move num agachamento, entao casar quadris afunda os pes de um dos
 * dois no chao.
 */
/**
 * Desenha a pose sobre o QUADRO DO VIDEO, usando a ancora do professor.
 *
 * A pose normalizada e relativa ao quadril e nao sabe onde o corpo estava na
 * tela. `ancora` = [x, y, escala] diz onde o tornozelo do professor estava
 * naquele instante do video e quanto media o tronco dele — com isso o
 * esqueleto do usuario cai exatamente em cima do corpo no video.
 *
 * O retangulo (dx, dy, dw, dh) e onde o video REALMENTE aparece dentro da
 * caixa. Um video vertical numa caixa 6:5 fica com tarja preta dos dois lados,
 * e a ancora, que e normalizada ao quadro do video, precisa desse retangulo —
 * usar a caixa inteira deslocaria o esqueleto para fora do corpo.
 *
 * `espelhado` desfaz a normalizacao de sentido. As poses vivem no espaco
 * CANONICO (gravacao.py espelha quando o professor nao olha para +x), mas a
 * ancora foi tomada no quadro CRU do video. Desenhar uma no referencial da
 * outra produz o esqueleto invertido sobre o corpo — visivel na hora, porque a
 * pose do proprio professor deixa de casar com ele mesmo.
 */
export function desenharSobreVideo(
  ctx                          ,
  pose            ,
  ancora          ,
  dx        , dy        , dw        , dh        , aspecto        ,
  cor        , espessura        ,
  ossos                    ,
  espelhado = false,
)       {
  const [ax, ay, esc] = ancora;
  const ge = pose[LANDMARKS.tornozelo_e], gd = pose[LANDMARKS.tornozelo_d];
  const ox = (ge[0] + gd[0]) / 2;
  const oy = (ge[1] + gd[1]) / 2;
  const sx = espelhado ? -1 : 1;

  const px = (j        )                   => [
    dx + (ax + (sx * (pose[j][0] - ox) * esc) / aspecto) * dw,
    dy + (ay + (pose[j][1] - oy) * esc) * dh,
  ];

  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [a, b] of ossos) {
    const [x1, y1] = px(LANDMARKS[a]);
    const [x2, y2] = px(LANDMARKS[b]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

export function desenharPose(
  ctx                          ,
  pose            ,
  w        , h        ,
  cor        , espessura        ,
  ossos                    ,
  escala        ,
  centro                  ,
)       {
  const ge = pose[LANDMARKS.tornozelo_e], gd = pose[LANDMARKS.tornozelo_d];
  const ox = (ge[0] + gd[0]) / 2;
  const oy = (ge[1] + gd[1]) / 2;

  const px = (j        )                   => [
    centro[0] * w + (pose[j][0] - ox) * escala,
    centro[1] * h + (pose[j][1] - oy) * escala,
  ];

  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [a, b] of ossos) {
    const [ax, ay] = px(LANDMARKS[a]);
    const [bx, by] = px(LANDMARKS[b]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}
