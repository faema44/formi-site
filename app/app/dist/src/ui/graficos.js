/**
 * Graficos.
 *
 * Especificacoes fixas, nao gosto: coluna de no maximo 24px com topo arredondado
 * em 4 e base quadrada na linha zero; linha de 2px; marcador de 9px com anel de
 * 2px na cor da superficie (senao ele some quando cruza a propria linha); grade
 * de 1px continua e recuada; rotulo de valor so no extremo — numero em cima de
 * todo ponto ninguem le.
 *
 * As cores vivem em estilo.css (--serie-1..4) e passaram no validador de paleta
 * contra a superficie #14161d: banda de luminosidade, piso de croma, separacao
 * sob daltonismo e contraste. Nao troque um hex sem revalidar.
 *
 * A dica e HTML posicionado sobre o SVG, nao <title> nativo: o nativo demora um
 * segundo, some sozinho e simplesmente nao existe no toque.
 */

import { el, svg, preencher } from "./base.js";

// ---------------------------------------------------------------------------
// Anel — um medidor, nao um grafico. O trilho e um passo mais claro do mesmo
// azul (nao cinza): o estado se le ao longo do anel inteiro.
// ---------------------------------------------------------------------------

export function anel(valor        , max = 100, tamanho = 132)              {
  const traco = 13;
  const raio = (tamanho - traco) / 2;
  const volta = 2 * Math.PI * raio;
  const fracao = Math.max(0, Math.min(1, valor / max));

  const arco = svg("circle", {
    classe: "anel-arco",
    attr: {
      cx: tamanho / 2, cy: tamanho / 2, r: raio, fill: "none",
      "stroke-width": traco,
      "stroke-dasharray": `${volta * fracao} ${volta}`,
    },
  });

  return el("div", { classe: "anel", estilo: { width: `${tamanho}px`, height: `${tamanho}px` } }, [
    svg("svg", { attr: { width: tamanho, height: tamanho, "aria-hidden": "true" } }, [
      svg("circle", {
        classe: "anel-trilho",
        attr: {
          cx: tamanho / 2, cy: tamanho / 2, r: raio, fill: "none", "stroke-width": traco,
        },
      }),
      arco,
    ]),
    el("div", { classe: "anel-centro" }, [
      el("div", { classe: "anel-valor", texto: String(Math.round(valor)) }),
      el("div", { classe: "anel-de", texto: `de ${max}` }),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

                        
                 
                
                                                             
                   
 

                         
                 
                     
                 
                  
 

export function graficoColunas(o               )              {
  const L = 34, R = 6, T = 14, B = 24;
  const larg = 360, alt = 170;
  const areaL = larg - L - R;
  const areaA = alt - T - B;

  const max = escalaLimpa(Math.max(1, ...o.dados.map((d) => d.valor)));
  const banda = areaL / Math.max(1, o.dados.length);
  // 2px de folga entre vizinhas e o teto de 24: a coluna nunca preenche a banda,
  // e a sobra e o que separa uma da outra — sem contorno, sem borda.
  const largura = Math.min(24, banda - 2);

  const marcas               = [];
  const alvos               = [];
  const grade               = [];

  for (const f of [0, 0.5, 1]) {
    const y = T + areaA * (1 - f);
    grade.push(svg("line", { classe: "gr-grade", attr: { x1: L, x2: larg - R, y1: y, y2: y } }));
    grade.push(
      svg("text", {
        classe: "gr-eixo-texto",
        attr: { x: L - 7, y: y + 3.5, "text-anchor": "end" },
        texto: formatarNumero(max * f),
      }),
    );
  }

  const dica = criarDica();
  const indiceMax = o.dados.reduce((m, d, i) => (d.valor > o.dados[m].valor ? i : m), 0);

  o.dados.forEach((d, i) => {
    const x = L + banda * i + (banda - largura) / 2;
    const altura = max ? (d.valor / max) * areaA : 0;
    const y = T + areaA - altura;

    // `rx` num rect arredonda os quatro cantos; a base tem que ficar reta na
    // linha zero. O caminho desenha so os dois cantos de cima.
    const r = Math.min(4, altura / 2, largura / 2);
    if (altura > 0.5) {
      marcas.push(
        svg("path", {
          classe: "gr-marca",
          attr: {
            d: `M${x} ${T + areaA}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${largura - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${T + areaA}Z`,
            fill: "var(--serie-1)",
          },
        }),
      );
    }

    alvos.push(
      areaSensivel(banda, alt, L + banda * i, 0, dica, () => ({
        x: L + banda * i + banda / 2,
        y: altura > 0.5 ? y : T + areaA,
        titulo: `${formatarNumero(d.valor)} ${o.unidade}`,
        corpo: d.detalhe ?? d.rotulo,
        cor: "var(--serie-1)",
      })),
    );

    marcas.push(
      svg("text", {
        classe: "gr-eixo-texto",
        attr: { x: L + banda * i + banda / 2, y: alt - 7, "text-anchor": "middle" },
        texto: d.rotulo,
      }),
    );

    // Rotulo direto so no maior. Um numero em cada coluna vira ruido e o eixo ja
    // carrega o resto.
    if (i === indiceMax && d.valor > 0) {
      marcas.push(
        svg("text", {
          classe: "gr-valor",
          attr: { x: L + banda * i + banda / 2, y: y - 6, "text-anchor": "middle" },
          texto: formatarNumero(d.valor),
        }),
      );
    }
  });

  return moldura(
    o.titulo,
    o.subtitulo,
    svg("svg", { classe: "gr-svg", attr: { viewBox: `0 0 ${larg} ${alt}`, role: "img" } }, [
      ...grade,
      ...marcas,
      ...alvos,
    ]),
    dica,
    tabela(["Período", `${o.unidade[0].toUpperCase()}${o.unidade.slice(1)}`], o.dados.map((d) => [d.rotulo, formatarNumero(d.valor)])),
  );
}

// ---------------------------------------------------------------------------
// Linha
// ---------------------------------------------------------------------------

                       
                 
                     
                 
                  
                                                                           
                                                               
                  
 

export function graficoLinha(o             )              {
  const L = 34, R = 12, T = 16, B = 24;
  const larg = 360, alt = 170;
  const areaL = larg - L - R;
  const areaA = alt - T - B;

  const valores = o.dados.map((d) => d.valor);
  const piso = o.minimo ?? 0;
  const teto = escalaLimpa(Math.max(piso + 1, ...valores));
  const paraY = (v        ) => T + areaA * (1 - (v - piso) / (teto - piso));
  const paraX = (i        ) =>
    L + (o.dados.length === 1 ? areaL / 2 : (areaL * i) / (o.dados.length - 1));

  const grade               = [];
  for (const f of [0, 0.5, 1]) {
    const y = T + areaA * (1 - f);
    grade.push(svg("line", { classe: "gr-grade", attr: { x1: L, x2: larg - R, y1: y, y2: y } }));
    grade.push(
      svg("text", {
        classe: "gr-eixo-texto",
        attr: { x: L - 7, y: y + 3.5, "text-anchor": "end" },
        texto: formatarNumero(piso + (teto - piso) * f),
      }),
    );
  }

  const pontos = o.dados.map((d, i) => `${paraX(i)},${paraY(d.valor)}`).join(" ");
  const base = T + areaA;
  const area = `M${paraX(0)},${base} L${pontos.replace(/ /g, " L")} L${paraX(o.dados.length - 1)},${base} Z`;

  const dica = criarDica();
  const alvos = o.dados.map((d, i) =>
    areaSensivel(areaL / o.dados.length, alt, paraX(i) - areaL / o.dados.length / 2, 0, dica, () => ({
      x: paraX(i),
      y: paraY(d.valor),
      titulo: `${formatarNumero(d.valor)}${o.unidade}`,
      corpo: d.detalhe ?? d.rotulo,
      cor: "var(--serie-1)",
    })),
  );

  const ultimo = o.dados.length - 1;
  const marcador = [
    // Anel na cor da superficie primeiro, marcador por cima: e o que mantem o
    // ponto legivel onde ele cruza a propria linha.
    svg("circle", {
      attr: { cx: paraX(ultimo), cy: paraY(valores[ultimo]), r: 6.5, fill: "var(--superficie)" },
    }),
    svg("circle", {
      attr: { cx: paraX(ultimo), cy: paraY(valores[ultimo]), r: 4.5, fill: "var(--serie-1)" },
    }),
    svg("text", {
      classe: "gr-valor",
      attr: {
        x: paraX(ultimo), y: paraY(valores[ultimo]) - 13,
        "text-anchor": ultimo === 0 ? "middle" : "end",
      },
      texto: `${formatarNumero(valores[ultimo])}${o.unidade}`,
    }),
  ];

  const rotulos = o.dados
    .map((d, i) =>
      // So as pontas: doze rotulos de data em 360px colidem.
      i === 0 || i === ultimo
        ? svg("text", {
            classe: "gr-eixo-texto",
            attr: {
              x: paraX(i), y: alt - 7,
              "text-anchor": i === 0 ? "start" : "end",
            },
            texto: d.rotulo,
          })
        : null,
    )
    .filter((n)                  => n !== null);

  return moldura(
    o.titulo,
    o.subtitulo,
    svg("svg", { classe: "gr-svg", attr: { viewBox: `0 0 ${larg} ${alt}`, role: "img" } }, [
      ...grade,
      svg("path", { attr: { d: area, fill: "var(--serie-1)", "fill-opacity": 0.1 } }),
      svg("polyline", {
        attr: {
          points: pontos, fill: "none", stroke: "var(--serie-1)", "stroke-width": 2,
          "stroke-linejoin": "round", "stroke-linecap": "round",
        },
      }),
      ...marcador,
      ...rotulos,
      ...alvos,
    ]),
    dica,
    tabela(["Treino", o.titulo], o.dados.map((d) => [d.detalhe ?? d.rotulo, `${formatarNumero(d.valor)}${o.unidade}`])),
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais — HTML, nao SVG. O rotulo e um texto de verdade, quebra
// linha sozinho e nunca sai cortado pelo viewBox.
// ---------------------------------------------------------------------------

                        
                 
                     
                 
                  
 

/**
 * Uma cor so, de proposito. Pintar cada barra de um tom diferente parece mais
 * vivo e nao codifica nada: a ordenacao ja carrega o ranking e o rotulo ja
 * carrega a identidade. Cor que nao tem trabalho a fazer e ruido.
 */
export function graficoBarras(o              )              {
  const max = Math.max(1, ...o.dados.map((d) => d.valor));

  const linhas = o.dados.map((d) => {
    const cor = "var(--serie-1)";
    return el("div", { classe: "fatia" }, [
      el("div", { classe: "fatia-topo" }, [
        el("span", { classe: "fatia-nome", texto: d.rotulo }),
        el("span", { classe: "fatia-valor", texto: `${formatarNumero(d.valor)} ${o.unidade}` }),
      ]),
      el("div", { classe: "fatia-trilho" }, [
        el("div", {
          classe: "fatia-preenche",
          estilo: { width: `${(d.valor / max) * 100}%`, background: cor },
        }),
      ]),
    ]);
  });

  return el("div", { classe: "cartao" }, [
    el("div", {}, [
      el("div", { classe: "gr-titulo", texto: o.titulo }),
      o.subtitulo ? el("div", { classe: "gr-sub", texto: o.subtitulo }) : null,
    ]),
    el("div", { estilo: { marginTop: "16px" } }, linhas),
  ]);
}

// ---------------------------------------------------------------------------
// Pecas compartilhadas
// ---------------------------------------------------------------------------

/** Ladrilho de numero: rotulo, valor e um delta opcional contra periodo nomeado. */
export function ladrilho(
  rotulo        ,
  valor        ,
  sufixo         ,
  delta                                   ,
)              {
  return el("div", { classe: "ladrilho" }, [
    el("div", { classe: "ladrilho-rotulo", texto: rotulo }),
    el("div", { classe: "ladrilho-valor" }, [
      valor,
      sufixo ? el("small", { texto: ` ${sufixo}` }) : null,
    ]),
    delta
      ? el("div", { classe: `ladrilho-delta ${delta.sobe ? "sobe" : "desce"}` }, [
          delta.sobe ? "▲" : "•",
          " ",
          delta.texto,
        ])
      : null,
  ]);
}

function moldura(
  titulo        ,
  subtitulo                    ,
  desenho            ,
  dica             ,
  tab             ,
)              {
  const alternar = el("button", { classe: "tabela-alternar", texto: "ver os números" });
  alternar.addEventListener("click", () => {
    const aberta = tab.classList.toggle("oculto");
    alternar.textContent = aberta ? "ver os números" : "esconder os números";
  });

  return el("div", { classe: "cartao" }, [
    el("div", {}, [
      el("div", { classe: "gr-titulo", texto: titulo }),
      subtitulo ? el("div", { classe: "gr-sub", texto: subtitulo }) : null,
    ]),
    el("div", { classe: "gr-caixa" }, [desenho, dica]),
    alternar,
    tab,
  ]);
}

function criarDica()              {
  return el("div", { classe: "dica" });
}

                    
            
            
                 
                
              
 

/**
 * Alvo invisivel de largura cheia da banda. O alvo e SEMPRE maior que a marca:
 * acertar uma coluna de 4px de altura com o dedo e impossivel, e acertar a faixa
 * inteira e trivial.
 */
function areaSensivel(
  larg        ,
  alt        ,
  x        ,
  y        ,
  dica             ,
  conteudo                ,
)             {
  const alvo = svg("rect", {
    classe: "gr-alvo",
    attr: { x, y, width: larg, height: alt, tabindex: 0 },
  });

  const mostrar = () => {
    const c = conteudo();
    const caixa = alvo.ownerSVGElement ;
    const escala = caixa.getBoundingClientRect().width / caixa.viewBox.baseVal.width;
    preencher(
      dica,
      el("b", {}, [
        el("span", { classe: "dica-chave", estilo: { background: c.cor } }),
        c.titulo,
      ]),
      el("span", { texto: c.corpo, estilo: { color: "var(--tinta-2)" } }),
    );
    // Prender dentro da caixa. A dica e centrada no ponto (translate -50%), e
    // nos extremos da serie metade dela ficava para fora do cartao — cortada
    // pela borda, justamente no ultimo ponto, que e o que mais se olha.
    dica.classList.add("on");
    const caixaLarg = caixa.getBoundingClientRect().width;
    const metade = dica.getBoundingClientRect().width / 2;
    const x = Math.min(Math.max(c.x * escala, metade + 4), caixaLarg - metade - 4);

    dica.style.left = `${x}px`;
    dica.style.top = `${c.y * escala - 10}px`;
  };
  const esconder = () => dica.classList.remove("on");

  alvo.addEventListener("pointerenter", mostrar);
  alvo.addEventListener("pointerdown", mostrar);
  alvo.addEventListener("pointerleave", esconder);
  alvo.addEventListener("focus", mostrar);
  alvo.addEventListener("blur", esconder);
  return alvo;
}

function tabela(cabecalho          , linhas            )              {
  return el("table", { classe: "tabela-dados oculto" }, [
    el("thead", {}, [el("tr", {}, cabecalho.map((c) => el("th", { texto: c })))]),
    el(
      "tbody",
      {},
      linhas.map((l) => el("tr", {}, l.map((c) => el("td", { texto: c })))),
    ),
  ]);
}

/** Teto redondo para o eixo: 137 vira 150, nao 137. */
function escalaLimpa(max        )         {
  if (max <= 10) return Math.ceil(max);
  const ordem = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / (ordem / 2)) * (ordem / 2);
}

function formatarNumero(v        )         {
  return Math.round(v).toLocaleString("pt-BR");
}
