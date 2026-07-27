/**
 * Calculo das medidas geometricas a partir dos 33 landmarks do BlazePose.
 *
 * Porte de fitcam/medidas.py, que e NORMATIVO.
 *
 * Convencao de coordenadas (identica a do MediaPipe):
 *     x, y  normalizados em [0, 1]; y CRESCE PARA BAIXO
 *     z     profundidade relativa ao quadril (usada com muita parcimonia)
 *     visibilidade em [0, 1]
 *
 * O ASPECTO DO QUADRO
 * -------------------
 * x e y sao normalizados por dimensoes DIFERENTES (largura e altura). Enquanto
 * o quadro nao for quadrado esse espaco e anisotropico, e nele um segmento de
 * 30 graus na vida real nao mede 30 graus.
 *
 * Por isso `calcular` e `escalaCorporal` recebem `aspecto` = largura/altura em
 * pixels. Informado, o resultado e o angulo FISICO: igual em retrato e em
 * paisagem, preservado sob rotacao da camera, e comparavel com amplitudes
 * anatomicas. O default 1.0 (quadro quadrado) mantem o comportamento
 * historico e e o que a fonte sintetica assume.
 */

                        
            
            
            
                       
 

export function ponto(x        , y        , z = 0, visibilidade = 1)        {
  return { x, y, z, visibilidade };
}

/** Indices BlazePose relevantes (nomes em PT para a biblioteca). */
export const LANDMARKS                         = {
  nariz: 0,
  ombro_e: 11, ombro_d: 12,
  cotovelo_e: 13, cotovelo_d: 14,
  punho_e: 15, punho_d: 16,
  quadril_e: 23, quadril_d: 24,
  joelho_e: 25, joelho_d: 26,
  tornozelo_e: 27, tornozelo_d: 28,
  calcanhar_e: 29, calcanhar_d: 30,
  pe_e: 31, pe_d: 32,
};

                                  

export function em(landmarks                  , ref     )        {
  const idx = typeof ref === "string" ? LANDMARKS[ref] : ref;
  return landmarks[idx];
}

export function medio(a       , b       )        {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibilidade: Math.min(a.visibilidade, b.visibilidade),
  };
}

/** Leva o ponto para um espaco de pixels quadrados. Identidade se aspecto = 1. */
export function isotropico(p       , aspecto = 1)        {
  if (aspecto === 1) return p;
  return { x: p.x * aspecto, y: p.y, z: p.z, visibilidade: p.visibilidade };
}

/**
 * Comprimento do tronco (centro dos ombros ao centro dos quadris).
 * Unidade para normalizar distancias. Nunca retorna zero.
 */
export function escalaCorporal(landmarks                  , aspecto = 1)         {
  const ombros = medio(em(landmarks, "ombro_e"), em(landmarks, "ombro_d"));
  const quadris = medio(em(landmarks, "quadril_e"), em(landmarks, "quadril_d"));
  const d = Math.hypot((ombros.x - quadris.x) * aspecto, ombros.y - quadris.y);
  return Math.max(d, 1e-6);
}

/** Angulo interno em B, formado por A-B-C, em graus [0, 180]. */
export function anguloInterno(a       , b       , c       )         {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  const graus = Math.abs((rad * 180) / Math.PI);
  return graus > 180 ? 360 - graus : graus;
}

/** Inclinacao do segmento A->B em relacao a vertical, em graus. 0 = vertical. */
export function anguloVertical(a       , b       )         {
  return Math.abs((Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI);
}

/** Inclinacao do segmento A->B em relacao a horizontal, em graus [0, 90]. */
export function anguloHorizontal(a       , b       )         {
  const ang = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  return ang > 90 ? 180 - ang : ang;
}

const LADOS = ["e", "d"]         ;

/**
 * Angulo interno do lado do corpo que a camera REALMENTE enxerga.
 *
 * Numa vista lateral um dos membros fica escondido atras do outro. O BlazePose
 * ainda devolve uma posicao para o lado oculto, mas junto devolve a
 * visibilidade — e num agachamento de perfil ela cai para ~0,36 no joelho de
 * tras contra ~0,98 no da frente. A posicao "medida" ali e chute, e erra por
 * volta de 15 graus.
 *
 * `bases` sao nomes SEM sufixo de lado: ["quadril", "joelho", "tornozelo"].
 * Empate fica com o esquerdo, para o resultado ser deterministico.
 */
export function anguloVisivel(
  landmarks                  ,
  bases                   ,
  aspecto = 1,
)         {
  let escolhido                  = null;
  let melhor = -1;
  for (const lado of LADOS) {
    const refs = bases.map((b) => `${b}_${lado}`);
    const vis = Math.min(...refs.map((r) => em(landmarks, r).visibilidade));
    if (vis > melhor) {
      escolhido = refs;
      melhor = vis;
    }
  }
  const pts = escolhido .map((r) => isotropico(em(landmarks, r), aspecto));
  return anguloInterno(pts[0], pts[1], pts[2]);
}

export function distancia(a       , b       , escala        )         {
  return Math.hypot(b.x - a.x, b.y - a.y) / escala;
}

/** Distancia horizontal COM SINAL (b - a), em unidades de tronco. */
export function distanciaX(a       , b       , escala        )         {
  return (b.x - a.x) / escala;
}

/** Distancia vertical COM SINAL, positiva quando B esta ACIMA de A. */
export function distanciaY(a       , b       , escala        )         {
  return (a.y - b.y) / escala;
}

export function visibilidadeMedia(landmarks                  , refs                )         {
  if (refs.length === 0) return 1;
  return refs.reduce((s, r) => s + em(landmarks, r).visibilidade, 0) / refs.length;
}

/**
 * Menor visibilidade entre os landmarks informados.
 *
 * A PORTA DE RASTREIO usa o minimo, nao a media. Se o tornozelo esta fora do
 * quadro, o angulo do joelho e lixo — nao importa que o ombro esteja com 0,98.
 * A media mascara justamente a oclusao que interessa.
 */
export function visibilidadeMinimaDe(
  landmarks                  ,
  refs                ,
)         {
  if (refs.length === 0) return 1;
  return Math.min(...refs.map((r) => visibilidadeDe(landmarks, r)));
}

/**
 * Visibilidade de um landmark, ou do MELHOR lado se `ref` for uma base.
 *
 * Nome com sufixo ("joelho_e") e literal. Nome sem sufixo ("joelho") e o par:
 * vale o lado que a camera enxerga melhor, o mesmo que `anguloVisivel` vai
 * medir. Sem isso a porta exigiria um lado fixo e fecharia quando o usuario
 * ficasse com o outro flanco para a camera — justamente no fundo do movimento,
 * onde a oclusao e pior.
 */
export function pontoVisivel(landmarks                  , ref     )        {
  if (typeof ref === "string" && !(ref in LANDMARKS)) {
    return LADOS
      .map((l) => em(landmarks, `${ref}_${l}`))
      .reduce((a, b) => (b.visibilidade > a.visibilidade ? b : a));
  }
  return em(landmarks, ref);
}

export function visibilidadeDe(landmarks                  , ref     )         {
  if (typeof ref === "string" && !(ref in LANDMARKS)) {
    return Math.max(...LADOS.map((l) => em(landmarks, `${ref}_${l}`).visibilidade));
  }
  return em(landmarks, ref).visibilidade;
}

/** Aridade por tipo declarado no JSON. -1 = livre. */
export const TIPOS_MEDIDA                         = {
  angulo: 3,
  angulo_visivel: 3, // pontos SEM sufixo de lado
  angulo_vertical: 2,
  angulo_horizontal: 2,
  distancia: 2,
  distancia_x: 2,
  distancia_y: 2,
  visibilidade: -1,
};

export function calcular(
  tipo        ,
  refs                ,
  landmarks                  ,
  aspecto = 1,
)         {
  if (tipo === "visibilidade") return visibilidadeMedia(landmarks, refs);
  if (tipo === "angulo_visivel") {
    return anguloVisivel(landmarks, refs            , aspecto);
  }

  const pts = refs.map((r) => isotropico(em(landmarks, r), aspecto));
  if (tipo === "angulo") return anguloInterno(pts[0], pts[1], pts[2]);
  if (tipo === "angulo_vertical") return anguloVertical(pts[0], pts[1]);
  if (tipo === "angulo_horizontal") return anguloHorizontal(pts[0], pts[1]);

  const escala = escalaCorporal(landmarks, aspecto);
  if (tipo === "distancia") return distancia(pts[0], pts[1], escala);
  if (tipo === "distancia_x") return distanciaX(pts[0], pts[1], escala);
  if (tipo === "distancia_y") return distanciaY(pts[0], pts[1], escala);

  throw new Error(`tipo de medida desconhecido: ${tipo}`);
}
