/**
 * Icones.
 *
 * Traco de 1.7px, cantos redondos, caixa de 24 — o mesmo desenho do mock. Sao
 * poucos e nao mudam; uma biblioteca de icones aqui seria um pacote inteiro por
 * oito caminhos SVG.
 */

import { svg } from "./base.js";

const CAMINHOS                           = {
  inicio: ["M3 10.5 12 3l9 7.5", "M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"],
  treinos: ["M7 4v16", "M17 20V4", "M4 7l3-3 3 3", "M20 17l-3 3-3-3"],
  evolucao: ["M4 20V9", "M10 20V4", "M16 20v-7", "M22 20H2"],
  perfil: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 3v18"],
  seta: ["M5 12h13", "M12.5 6.5 19 12l-6.5 5.5"],
  voltar: ["M19 12H6", "M11.5 6.5 5 12l6.5 5.5"],
  baixo: ["M6 9.5 12 15l6-5.5"],
  marca: ["M4.5 12.5 9.5 17.5 19.5 7"],
};

export function icone(nome                                , tamanho = 24, cor = "currentColor")             {
  const caminhos = CAMINHOS[nome] ?? [];
  return svg(
    "svg",
    {
      attr: {
        width: tamanho, height: tamanho, viewBox: "0 0 24 24", fill: "none",
        stroke: cor, "stroke-width": 1.7, "stroke-linecap": "round",
        "stroke-linejoin": "round", "aria-hidden": "true",
      },
    },
    caminhos.map((d) => svg("path", { attr: { d } })),
  );
}

/** A marca: as tres barras do logotipo do site, em proporcao. */
export function logotipo(altura = 22)             {
  const c = "currentColor";
  return svg(
    "svg",
    { attr: { height: altura, viewBox: "0 0 34 24", fill: "none", "aria-label": "Formi" } },
    [
      svg("rect", { attr: { x: 6, y: 2, width: 26, height: 3.6, rx: 1.8, fill: c } }),
      svg("rect", { attr: { x: 6, y: 10.2, width: 17, height: 3.6, rx: 1.8, fill: c } }),
      svg("circle", { attr: { cx: 3.2, cy: 20.4, r: 2.6, fill: "#3d63ff" } }),
    ],
  );
}
