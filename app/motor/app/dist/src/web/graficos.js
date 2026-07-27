/**
 * Curvas do exercicio: o professor e voce, medida por medida.
 *
 * O video mostra a FORMA; o grafico mostra o NUMERO. Sao perguntas diferentes:
 * olhando o fantasma da para ver que o agachamento ficou raso, mas nao quanto,
 * nem em que parte do movimento, nem se o tronco compensou. A curva responde
 * as tres de uma vez.
 *
 * O eixo x nao e tempo, e FASE — os mesmos pontos da grade da referencia. Por
 * isso as duas curvas sao comparaveis mesmo que voce tenha executado num ritmo
 * completamente diferente do professor: cada ponto e "o mesmo instante do
 * movimento", nao "o mesmo segundo".
 *
 * A faixa cinza e o envelope: onde o professor esteve, com a margem que aceita
 * variacao entre corpos. Sair dela e o que gera correcao — ver envelope.ts.
 */

                                 
                                                     
                    
                                                       
                   
                   
                                                   
                             
 

const COR_VOCE = "#50dcff";
const COR_PROF = "rgba(245,245,245,.85)";
const COR_BANDA = "rgba(245,245,245,.16)";
const COR_EIXO = "rgba(245,245,245,.30)";
const COR_TEXTO = "rgba(245,245,245,.75)";

/**
 * Desenha um grafico de uma medida.
 *
 * `margem` alarga a banda do professor exatamente como faz a correcao, para o
 * que voce ve na tela ser o mesmo criterio que gerou (ou nao) um aviso durante
 * a serie. Um grafico que discordasse do audio seria pior que nenhum.
 */
export function desenharGrafico(
  ctx                          ,
  largura        , altura        ,
  serie                ,
  ciclo                   ,
  amostrasPorEstado        ,
  margem        ,
  titulo        ,
  unidade        ,
)       {
  const padE = 34;   // espaco do rotulo do eixo y
  const padD = 6;
  const padT = 20;   // titulo
  const padB = 16;   // nomes das fases
  const larg = largura - padE - padD;
  const alt = altura - padT - padB;
  const n = serie.mediana.length;

  // Escala vertical cobrindo tudo o que sera desenhado, com uma folga.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, serie.minimo[i] - margem);
    hi = Math.max(hi, serie.maximo[i] + margem);
    const v = serie.usuario[i];
    if (v !== null && v !== undefined) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const folga = (hi - lo) * 0.08;
  lo -= folga;
  hi += folga;

  const px = (i        ) => padE + (n === 1 ? 0 : (i / (n - 1)) * larg);
  const py = (v        ) => padT + alt - ((v - lo) / (hi - lo)) * alt;

  ctx.clearRect(0, 0, largura, altura);

  // Faixa do professor, ja com a margem: e o "certo" com tolerancia.
  ctx.fillStyle = COR_BANDA;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = px(i);
    const y = py(serie.maximo[i] + margem);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(px(i), py(serie.minimo[i] - margem));
  ctx.closePath();
  ctx.fill();

  // Divisorias das fases. Sem elas o eixo x nao significa nada para quem olha.
  ctx.strokeStyle = COR_EIXO;
  ctx.lineWidth = 1;
  ctx.font = "9px system-ui, sans-serif";
  ctx.fillStyle = COR_TEXTO;
  ctx.textAlign = "center";
  for (let k = 0; k < ciclo.length; k++) {
    const ini = k * amostrasPorEstado;
    if (k > 0) {
      const x = Math.round(px(ini)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + alt);
      ctx.stroke();
    }
    const meio = Math.min(ini + amostrasPorEstado / 2, n - 1);
    ctx.fillText(ciclo[k].replace(/_/g, " "), px(meio), altura - 4);
  }

  // Curva do professor.
  ctx.strokeStyle = COR_PROF;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = px(i);
    const y = py(serie.mediana[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Sua curva, ligando amostra a amostra.
  //
  // A versao anterior cortava a linha em cada coluna sem amostra, para nao
  // "afirmar o que nao se sabe". O efeito na tela foi o contrario do
  // pretendido: o grafico saia picotado e o usuario concluia que tinha
  // executado errado. E a coluna vazia nao significa trecho nao medido — a
  // descida real dura ~3 quadros a 15 fps contra 12 colunas reservadas para
  // ela, entao o vazio e resolucao da grade, nao ausencia de movimento. Entre
  // duas amostras consecutivas houve movimento continuo, e liga-las e o que
  // qualquer grafico de linha faz.
  ctx.strokeStyle = COR_VOCE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let desenhando = false;
  for (let i = 0; i < n; i++) {
    const v = serie.usuario[i];
    if (v === null || v === undefined) continue;
    const x = px(i);
    const y = py(v);
    if (!desenhando) { ctx.moveTo(x, y); desenhando = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Titulo e extremos do eixo y.
  ctx.fillStyle = COR_TEXTO;
  ctx.textAlign = "left";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText(titulo, padE, 12);
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(hi)}${unidade}`, padE - 5, padT + 7);
  ctx.fillText(`${Math.round(lo)}${unidade}`, padE - 5, padT + alt);
}
