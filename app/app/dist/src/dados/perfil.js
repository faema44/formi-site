/**
 * O que o onboarding coleta.
 *
 * Cada campo existe porque ALGUMA decisao do gerador de plano depende dele. Um
 * campo a mais e uma pergunta a mais antes do usuario ver valor — e a desistencia
 * no onboarding e o maior vazamento de um app de treino.
 */

import { ler, gravar } from "./armazenamento.js";
                                           

                                                                                

                         
               
                     
               
                        
                           
                   
                         
                              
                   
 

export const OBJETIVOS                                                                = [
  { id: "emagrecer", nome: "Perder peso", desc: "Gasto calórico alto, sessões intensas", emoji: "🔥" },
  { id: "condicionamento", nome: "Ganhar condicionamento", desc: "Fôlego e resistência para o dia a dia", emoji: "🫁" },
  { id: "mobilidade", nome: "Mobilidade e postura", desc: "Soltar o corpo, tirar a dor das costas", emoji: "🧘" },
  { id: "forca", nome: "Força e definição", desc: "Músculo e potência, com o próprio peso", emoji: "💪" },
];

export const NOME_OBJETIVO                           = Object.fromEntries(
  OBJETIVOS.map((o) => [o.id, o.nome]),
)                            ;

export function lerPerfil()                {
  return ler               ("perfil", null);
}

export function gravarPerfil(perfil        )       {
  gravar("perfil", perfil);
}

/** Primeiro nome, capitalizado. O cabecalho da tela inicial usa so ele. */
export function primeiroNome(perfil        )         {
  const bruto = perfil.nome.trim().split(/\s+/)[0] ?? "";
  if (!bruto) return "atleta";
  return bruto[0].toUpperCase() + bruto.slice(1);
}

export function iniciais(perfil        )         {
  const partes = perfil.nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "•";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}
