/**
 * Instalar um perfil: virar plano e historico gravados.
 *
 * Um caminho so, usado pelo onboarding e pela entrada de demonstracao. Quando
 * eram dois, a regra do historico de exemplo — semear apenas quando nao ha nada
 * de verdade — precisava ser lembrada em dois lugares, e o dia em que um deles
 * esquecesse, o usuario perderia semanas de treino real por um simulado.
 */

                                               
                                          
import { gravarPerfil } from "./perfil.js";
import { gerarPlano, gravarPlano } from "./plano.js";
import { historicoDeExemplo } from "./exemplo.js";
import { gravarHistorico, lerHistorico } from "./progresso.js";

/**
 * Grava perfil, plano e (se couber) o historico de exemplo.
 *
 * Propaga `SemExercicios` de proposito: sem plano nao ha o que instalar, e
 * engolir o erro aqui deixaria o app aberto num estado sem plano — que e
 * exatamente o que `gerarPlano` existe para impedir. Quem chama decide o que
 * mostrar.
 */
export function instalarPerfil(perfil        , catalogo             )       {
  const completo         = {
    ...perfil,
    nome: perfil.nome.trim(),
    equipamentos: perfil.equipamentos ?? [],
    criadoEm: new Date().toISOString(),
  };

  const plano = gerarPlano(completo, catalogo);
  gravarPerfil(completo);

  // Historico de exemplo so quando nao ha nada de verdade. Quem refaz as
  // respostas depois de treinar tres semanas nao pode ter o proprio historico
  // trocado por um simulado.
  if (lerHistorico().length === 0) {
    const semeado = historicoDeExemplo(plano);
    gravarPlano(semeado.plano);
    gravarHistorico(semeado.historico);
  } else {
    gravarPlano(plano);
  }
}
