/**
 * O interruptor do onboarding.
 *
 * DESLIGADO durante a demonstracao para os socios: quem abre o link cai direto
 * no produto, e nao em nove perguntas. As perguntas continuam inteiras em
 * `telas/onboarding.ts` — isto e uma chave, nao uma remocao.
 *
 * Para religar: `ONBOARDING = true`, recompilar, republicar. Nada mais.
 *
 * Enquanto esta desligado, a primeira abertura instala o perfil abaixo e o
 * historico de exemplo, e o app abre na tela inicial ja com plano e numeros.
 */
export const ONBOARDING = false;

                                                

/**
 * O perfil da demonstracao.
 *
 * Escolhido para MOSTRAR O PRODUTO, nao por ser o mais comum. Forca +
 * intermediario + em casa e a combinacao que puxa o bloco principal para a
 * categoria de forca, que e onde vivem os tres exercicios que a camera sabe
 * medir — assim toda sessao tem pelo menos uma serie guiada para demonstrar.
 * Um perfil de mobilidade geraria um plano igualmente valido e sem nenhuma
 * camera nele, e a demonstracao perderia justamente o que diferencia o produto.
 *
 * O nome e "Atleta" e nao uma pessoa inventada: a tela inicial cumprimenta pelo
 * nome, e um "Ola, Gabriel" faz o avaliador procurar quem e Gabriel.
 */
export const PERFIL_DEMO         = {
  nome: "Atleta",
  objetivo: "forca",
  nivel: "intermediario",
  diasPorSemana: 3,
  minutosPorSessao: 30,
  ambiente: "Casa",
  equipamentos: [],
  pouparArticulacoes: false,
  criadoEm: new Date().toISOString(),
};
