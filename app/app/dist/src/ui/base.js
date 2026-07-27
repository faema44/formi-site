/**
 * Construcao de DOM.
 *
 * Nao e um framework nem quer ser. Sao trinta linhas que evitam
 * `document.createElement` + seis atribuicoes a cada elemento, e mantem a
 * arvore visivel na indentacao do codigo — que e o unico ganho real de JSX que
 * este app precisa.
 */

                                                      

                 
                  
                 
                                                                      
                                         
                                        
                                                                       
 

export function el                                       (
  tag   ,
  props        = {},
  filhos          = [],
)                           {
  const no = document.createElement(tag);
  aplicar(no, props, filhos);
  return no;
}

const SVG = "http://www.w3.org/2000/svg";

export function svg(tag        , props        = {}, filhos          = [])             {
  const no = document.createElementNS(SVG, tag);
  aplicar(no                          , props, filhos);
  return no;
}

function aplicar(no             , props       , filhos         )       {
  if (props.classe) no.setAttribute("class", props.classe);
  if (props.texto !== undefined) no.textContent = props.texto;
  for (const [k, v] of Object.entries(props.attr ?? {})) no.setAttribute(k, String(v));
  Object.assign(no.style, props.estilo ?? {});
  for (const [evento, mao] of Object.entries(props.ao ?? {})) {
    no.addEventListener(evento, mao                 );
  }
  for (const f of filhos) {
    if (f === null || f === undefined || f === false) continue;
    no.append(typeof f === "string" ? document.createTextNode(f) : f);
  }
}

/** Troca o conteudo de um no de uma vez so. */
export function preencher(alvo         , ...filhos         )       {
  alvo.replaceChildren(...filhos.filter((f)                     => !!f));
}

export function plural(n        , um        , muitos        )         {
  return `${n} ${n === 1 ? um : muitos}`;
}

/** "45 min" · "1 h 15" — duracao legivel sem virar "75 minutos". */
export function duracao(min        )         {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}
