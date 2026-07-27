/**
 * Os exercicios que o motor sabe avaliar.
 *
 * O `catalogo.json` (229 exercicios) e a `biblioteca/` do fitcam-engine (3
 * definicoes) sao taxonomias diferentes, de origens diferentes: o catalogo veio
 * das pastas do Drive e descreve o exercicio para MONTAR treino — musculo,
 * nivel, equipamento; a biblioteca descreve o exercicio para MEDIR execucao —
 * maquina de estados, thresholds, regras de erro. Elas nao se cruzam por nome:
 * nao existe "Agachamento livre" no catalogo.
 *
 * Este arquivo e a ponte, e ele e o "manifesto" que o proprio motor antecipa em
 * `app/web/main.ts`. O catalogo NAO e alterado: as entradas guiadas se somam a
 * ele na carga, e as chaves de metadado sao as mesmas para o gerador de plano
 * nao precisar saber que existem dois mundos.
 *
 * Cuidado ao crescer esta lista: um exercicio so entra aqui quando existe uma
 * definicao em `biblioteca/` FEITA PARA ELE. Reaproveitar a definicao do
 * agachamento livre para um agachamento com rotacao aplicaria thresholds de
 * outro movimento — o motor contaria e corrigiria com confianca, e estaria
 * errado. Errado com confianca e pior do que manual.
 */

import { daRaiz } from "../raiz.js";
                                               

/** Entrada do manifesto: um `Exercicio` que carrega o id da definicao do motor. */
                                                     

/**
 * Situacao de calibracao, direto do README do motor. Ela muda o que a tela
 * promete: um template estrutural conta repeticao com honestidade, mas seus
 * limiares ainda sao chute educado, e prometer "correcao de execucao" ali seria
 * vender o que nao existe.
 */
                                                 

export const CALIBRACAO                             = {
  agachamento_livre: "validado",
  agachamento_frontal: "template",
  flexao_solo: "template",
};

/** Como a pessoa apoia o celular. Restricao fisica, nao preferencia. */
export const ORIENTACAO                                        = {
  agachamento_livre: "lateral",
  agachamento_frontal: "frontal",
  flexao_solo: "lateral",
};

/**
 * Exercicios do catalogo que sao o MESMO MOVIMENTO de um exercicio guiado.
 *
 * Chaveado por `nome_padronizado`, e sem tocar em `catalogo.json`: o catalogo
 * continua sendo exatamente o arquivo da empresa.
 *
 * Repare no que isto NAO faz: nao atribui o `motorId` a entrada do catalogo. A
 * definicao do motor foi escrita para a flexao no solo, vista lateral, com os
 * limiares dela; herdar isso por semelhanca de nome seria medir um exercicio
 * com os numeros de outro. O que a chave faz e so impedir que os dois caiam na
 * mesma sessao — e ai o bonus do gerador escolhe o guiado, que e o que a camera
 * sabe contar.
 *
 * Sem isto, o Treino B prescrevia "Flexao de Bracos" 4x12 e "Flexao de braco no
 * solo" 4x12: 96 flexoes, o mesmo movimento, listado duas vezes.
 */
const MOVIMENTO_POR_NOME                         = {
  "Flexão de Braços": "flexao",
};

/** O movimento de uma entrada do catalogo, se ela colidir com um guiado. */
export function movimentoDoNome(nome        )                     {
  return MOVIMENTO_POR_NOME[nome];
}

export const GUIADOS           = [
  {
    motorId: "agachamento_livre",
    id: "motor-agachamento-livre",
    movimento: "agachamento",
    nome: "Agachamento livre",
    categoria: "forca",
    musculos: ["Quadríceps", "Glúteos", "Isquiotibiais", "Core/Abdômen"],
    nivelMinimo: "sedentario",
    impacto: "Baixo",
    composto: true,
    ambientes: ["Casa", "Academia", "Ar Livre"],
    equipamentos: ["Nenhum"],
    classes: ["Funcional", "Musculação", "Calistenia", "Resistência Muscular"],
  },
  {
    motorId: "agachamento_frontal",
    id: "motor-agachamento-frontal",
    movimento: "agachamento",
    nome: "Agachamento (vista frontal)",
    categoria: "forca",
    musculos: ["Quadríceps", "Glúteos", "Adutores", "Abdutores"],
    nivelMinimo: "iniciante",
    impacto: "Baixo",
    composto: true,
    ambientes: ["Casa", "Academia", "Ar Livre"],
    equipamentos: ["Nenhum"],
    classes: ["Funcional", "Musculação"],
  },
  {
    motorId: "flexao_solo",
    id: "motor-flexao-solo",
    movimento: "flexao",
    nome: "Flexão de braço no solo",
    categoria: "forca",
    musculos: ["Peitoral", "Tríceps", "Deltoide/Ombros", "Core/Abdômen"],
    nivelMinimo: "iniciante",
    impacto: "Baixo",
    composto: true,
    ambientes: ["Casa", "Academia", "Ar Livre"],
    equipamentos: ["Nenhum"],
    classes: ["Funcional", "Calistenia", "Musculação"],
  },
];

/**
 * Esta build traz os arquivos do motor?
 *
 * `publicar.mjs --sem-camera` monta um pacote de 400 KB, sem o modelo de pose
 * nem o wasm — util para mostrar o produto sem arriscar a camera no aparelho
 * dos outros. Nesse pacote a sessao guiada nao existe, e o app precisa dizer
 * isso em vez de navegar para um 404 no meio do treino.
 *
 * A marca esta no HTML, e nao num arquivo a parte, porque a resposta e
 * necessaria durante o desenho da tela — uma requisicao aqui obrigaria a tela
 * de sessao inteira a virar assincrona por causa de um booleano de build.
 */
export function cameraDisponivel()          {
  return document.querySelector('meta[name="formi-camera"]')?.getAttribute("content") !== "nao";
}

/**
 * A URL da sessao guiada.
 *
 * `retorno` traz a pagina inteira de volta com o hash certo, e e por ele que o
 * motor sabe que esta dentro de um plano: sem `retorno` ele se comporta como
 * app avulso, exatamente como antes.
 */
export function urlDaSessao(motorId        , reps        , retorno        )         {
  const p = new URLSearchParams({ exercicio: motorId, reps: String(reps), retorno });
  return `${daRaiz("motor/app/dist/web/index.html")}?${p}`;
}

// ---------------------------------------------------------------------------
// A entrega — o contrato de volta
// ---------------------------------------------------------------------------

/** O resumo de uma serie, como `ColetorSessao.resumo()` no motor o produz. */
                              
                                                          
               
                     
                             
                                         
                      
                                                                         
                                  
                             
 

                          
                             
                    
                 
          
                             
                        
                                                                                  
    
 

const CHAVE_ENTREGA = "fitcam.entrega/1";

/**
 * Retira a entrega deixada pelo motor, se houver.
 *
 * Consome e apaga na mesma chamada: uma entrega lida duas vezes viraria duas
 * series no historico, e o caminho para isso e trivial — basta o usuario
 * atualizar a pagina depois de voltar.
 */
export function colherEntrega()                 {
  try {
    const cru = localStorage.getItem(CHAVE_ENTREGA);
    if (!cru) return null;
    localStorage.removeItem(CHAVE_ENTREGA);
    const entrega = JSON.parse(cru)           ;
    return entrega?.schema === "fitcam.entrega/1" ? entrega : null;
  } catch {
    localStorage.removeItem(CHAVE_ENTREGA);
    return null;
  }
}
