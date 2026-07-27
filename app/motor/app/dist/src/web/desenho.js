/**
 * Desenho sobre o canvas: esqueleto do usuario e fantasma de referencia.
 *
 * Equivalente de fitcam/desenho.py, em Canvas 2D.
 */

import { LANDMARKS, em, escalaCorporal,            } from "../motor/medidas.js";

/** Segmentos do corpo. Sem rosto: a 2 metros vira borrao e rouba atencao. */
export const OSSOS                     = [
  ["ombro_e", "ombro_d"], ["quadril_e", "quadril_d"],
  ["ombro_e", "quadril_e"], ["ombro_d", "quadril_d"],
  ["ombro_e", "cotovelo_e"], ["cotovelo_e", "punho_e"],
  ["ombro_d", "cotovelo_d"], ["cotovelo_d", "punho_d"],
  ["quadril_e", "joelho_e"], ["joelho_e", "tornozelo_e"],
  ["quadril_d", "joelho_d"], ["joelho_d", "tornozelo_d"],
  ["tornozelo_e", "pe_e"], ["tornozelo_d", "pe_d"],
];

export const CIANO = "#50dcff";
export const BRANCO = "#f5f5f5";
export const AMARELO = "#ffc83c";
export const VERDE = "#5adc78";
export const VERMELHO = "#eb3c3c";

export function esqueleto(
  ctx                          ,
  landmarks                  ,
  w        , h        ,
  cor = CIANO, espessura = 4, visMin = 0.5,
)       {
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = espessura;
  ctx.lineCap = "round";

  for (const [a, b] of OSSOS) {
    const pa = em(landmarks, a), pb = em(landmarks, b);
    if (Math.min(pa.visibilidade, pb.visibilidade) < visMin) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  for (const nome of Object.keys(LANDMARKS)) {
    const p = em(landmarks, nome);
    if (p.visibilidade < visMin) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, espessura, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Ancora a pose de referencia nos PES do usuario e escala pelo tronco dele.
 *
 * Ancorar no quadril parece natural e esta errado: num agachamento o quadril e
 * justamente o que mais se move. Se o fantasma esta em pe e o usuario esta no
 * fundo, casar os quadris enfia os pes do fantasma no chao.
 *
 * O pe e o ponto de contato — o que fica parado no agachamento, no afundo, na
 * flexao. Ancorado nele, os dois esqueletos ficam no mesmo chao e so divergem
 * onde a FORMA diverge, que e a informacao que se quer mostrar.
 *
 * `espelhado` desfaz a normalizacao de sentido da referencia. A pose gravada
 * vive no espaco canonico (gravacao.py espelha quando o professor nao olha
 * para +x) e os landmarks do usuario vem crus da camera: sem desespelhar, o
 * fantasma sai virado ao contrario sobre o corpo. Mesma armadilha que a
 * sobreposicao no video, e ela sobreviveu aqui porque este recurso vem
 * desligado por padrao.
 */
export function fantasma(
  ctx                          ,
  pose            ,
  landmarks                  ,
  w        , h        , aspecto        ,
  cor = BRANCO, alfa = 0.5, espelhado = false,
)       {
  const esc = escalaCorporal(landmarks, aspecto);
  const ue = em(landmarks, "tornozelo_e"), ud = em(landmarks, "tornozelo_d");
  const ancoraX = ((ue.x + ud.x) / 2) * aspecto;
  const ancoraY = (ue.y + ud.y) / 2;

  const ge = pose[LANDMARKS.tornozelo_e], gd = pose[LANDMARKS.tornozelo_d];
  const origemX = (ge[0] + gd[0]) / 2, origemY = (ge[1] + gd[1]) / 2;
  const sx = espelhado ? -1 : 1;

  const px = (j        )                   => {
    const [x, y] = pose[j];
    return [
      ((ancoraX + sx * (x - origemX) * esc) / aspecto) * w,
      (ancoraY + (y - origemY) * esc) * h,
    ];
  };

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.strokeStyle = cor;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  for (const [a, b] of OSSOS) {
    const [ax, ay] = px(LANDMARKS[a]);
    const [bx, by] = px(LANDMARKS[b]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Em que ponto da trajetoria do professor o usuario esta agora.
 *
 * Vizinho mais proximo sobre as medidas, cada uma normalizada pela propria
 * faixa para que graus e razoes pesem igual. E o modo diagnostico do fantasma:
 * em vez de conduzir, ele espelha o usuario e a sobreposicao mostra so o
 * desvio de forma.
 *
 * `usar` restringe quais medidas participam, e nao e detalhe. Normalizar pela
 * faixa DA REFERENCIA supoe que o usuario ocupa a mesma faixa; para uma medida
 * de faixa estreita isso e falso. Medido nas capturas reais: `altura_quadril`
 * varia 0.18 na referencia contra 73.6 do joelho, entao a diferenca natural
 * entre dois corpos vira um termo que domina a soma e prende o indice —
 * cobertura caiu de 0.94 para 0.65, e numa das series a fase `subindo` ficou
 * VAZIA. No video do professor contra ele mesmo o efeito e zero, que foi
 * exatamente por que o defeito sobreviveu a tantos testes.
 *
 * Angulos sao comparaveis entre corpos; distancias normalizadas carregam as
 * proporcoes da pessoa e a perspectiva da camera. Usar so os angulos resolve
 * essa parte.
 *
 * `estado` resolve a outra, e e a mais importante. DESCER E SUBIR PASSAM PELOS
 * MESMOS ANGULOS: joelho a 130 graus com o tronco inclinado e o mesmo par de
 * numeros na ida e na volta. Nenhum casamento por valores instantaneos separa
 * os dois — medido no celular, os 19 quadros de `subindo` foram todos para o
 * bloco `descendo`, que encheu 12 de 12 enquanto `subindo` ficou com ZERO.
 *
 * Sentido de movimento e historia, nao instante. Quem tem essa historia e a
 * maquina de estados, pelo mesmo argumento ja escrito em envelope.py: o estado
 * e observacao direta e nao depende da qualidade da execucao. Com ele, a busca
 * fica restrita ao bloco da fase certa e as medidas so escolhem o ponto dentro
 * dela.
 */
export function faseDoUsuario(
  ref   
                                                   
                         
                              
                               
   ,
  medidas                        ,
  estado         ,
  usar                      ,
)         {
  const comuns = Object.keys(medidas).filter(
    (m) => m in ref.medidas && (!usar || usar.has(m)),
  );
  if (comuns.length === 0) return 0;
  const faixas                         = {};
  for (const m of comuns) {
    const med = ref.medidas[m].mediana;
    faixas[m] = Math.max(1e-6, Math.max(...med) - Math.min(...med));
  }
  // Bloco da fase, quando o estado e conhecido; a grade inteira, quando nao e.
  let ini = 0;
  let fim = ref.tamanhoGrade;
  const k = estado && ref.ciclo ? ref.ciclo.indexOf(estado) : -1;
  if (k >= 0 && ref.amostrasPorEstado) {
    ini = k * ref.amostrasPorEstado;
    fim = Math.min(ini + ref.amostrasPorEstado, ref.tamanhoGrade);
  }
  let melhor = ini, melhorD = Infinity;
  for (let i = ini; i < fim; i++) {
    let d = 0;
    for (const m of comuns) {
      const dif = (ref.medidas[m].mediana[i] - medidas[m]) / faixas[m];
      d += dif * dif;
    }
    if (d < melhorD) { melhor = i; melhorD = d; }
  }
  return melhor;
}
