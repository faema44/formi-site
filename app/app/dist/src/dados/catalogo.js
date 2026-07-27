/**
 * O catalogo de exercicios.
 *
 * Fonte: `dados/catalogo.json`, o mesmo arquivo que o fitcam-engine consome.
 * Nao e copiado para dentro do app — o servidor serve a raiz do projeto e o
 * catalogo tem UM dono. Duplicar significaria dois catalogos divergindo.
 *
 * Aqui so ha carga, normalizacao e filtro. A escolha de quais exercicios entram
 * num treino e do gerador de plano (plano.ts).
 */

import { daRaiz } from "../raiz.js";
import { GUIADOS, movimentoDoNome } from "./motor.js";

                            
             
     
                                                                      
    
                                                                             
                                                               
     
                   
     
                                                                       
    
                                                                               
                                                                            
                                                                        
                                                                                 
                                                                                
                                                
     
                     
               
                       
                     
                     
                                      
                    
                      
                         
                    
 

                                                                 

/** As cinco pastas da biblioteca, com o nome curto que o app mostra. */
                                                                                        

export const NOME_CATEGORIA                            = {
  reprogramacao: "Reprogramação",
  liberacao: "Liberação miofascial",
  mobilidade: "Mobilidade",
  hiit: "HIIT",
  forca: "Força e funcional",
};

const DE_PASTA                            = {
  "EXERCÍCIOS REPROGRAMAÇÃO": "reprogramacao",
  "EXERCÍCIOS LIBERAÇÃO MIOFASCIAL": "liberacao",
  "EXERCÍCIOS MOBILIDADE": "mobilidade",
  "EXERCÍCIOS HIIT": "hiit",
  "EXERCÍCIOS FORÇA E FUNCIONAL": "forca",
};

const DE_NIVEL                        = {
  "Sedentário": "sedentario",
  "Iniciante": "iniciante",
  "Intermediário": "intermediario",
};

/** Ordem crescente de exigencia. Um nivel aceita tudo que esta abaixo dele. */
export const ORDEM_NIVEL          = ["sedentario", "iniciante", "intermediario"];

export const NOME_NIVEL                        = {
  sedentario: "Sedentário",
  iniciante: "Iniciante",
  intermediario: "Intermediário",
};

                 
                    
                           
                                 
                       
                            
                         
                     
                         
                                
 

let cache                     = null;

export async function carregarCatalogo()                       {
  if (cache) return cache;
  const resposta = await fetch(daRaiz("dados/catalogo.json"));
  if (!resposta.ok) throw new Error(`catalogo indisponivel (HTTP ${resposta.status})`);
  const bruto = (await resposta.json())           ;

  // Cinco nomes se repetem no catalogo ("Burpee", "Mobilidade de Ombro"...).
  // Sem o desempate o segundo sobrescreveria o primeiro em qualquer indice por
  // id, e o plano passaria a referenciar um exercicio que nao e o escolhido.
  const usados = new Set        ();
  cache = bruto.map((b) => {
    let id = fatiar(b.nome_padronizado);
    let n = 2;
    while (usados.has(id)) id = `${fatiar(b.nome_padronizado)}-${n++}`;
    usados.add(id);

    return {
      id,
      nome: b.nome_padronizado,
      movimento: movimentoDoNome(b.nome_padronizado),
      categoria: DE_PASTA[b.categoria] ?? "forca",
      musculos: b.musculos_trabalhados ?? [],
      nivelMinimo: DE_NIVEL[b.nivel_minimo] ?? "sedentario",
      impacto: (b.impacto_articular                        ) ?? "Médio",
      composto: b.tipo_exercicio === "Composto",
      ambientes: b.ambiente ?? [],
      equipamentos: b.equipamentos ?? [],
      classes: b.classes_treinamento ?? [],
    };
  });

  // Os exercicios do motor entram por cima, sem tocar no arquivo. O catalogo
  // continua sendo exatamente o que veio da biblioteca da empresa; o manifesto
  // acrescenta o que o motor sabe medir. Ver `motor.ts`.
  cache = [...cache, ...GUIADOS];
  return cache;
}

/** Todos os equipamentos que aparecem no catalogo, do mais comum ao mais raro. */
export function equipamentosDisponiveis(catalogo             )           {
  const conta = new Map                ();
  for (const e of catalogo) {
    for (const q of e.equipamentos) {
      if (q === "Nenhum") continue;
      conta.set(q, (conta.get(q) ?? 0) + 1);
    }
  }
  return [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([q]) => q);
}

// Escapes em vez do intervalo literal: os combinantes U+0300..U+036F sao
// invisiveis no editor, e um deles apagado por acidente passa despercebido.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

function fatiar(texto        )         {
  return texto
    .normalize("NFD").replace(ACENTOS, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
