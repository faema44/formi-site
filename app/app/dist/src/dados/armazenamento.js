/**
 * Persistencia local.
 *
 * Tudo do usuario mora no aparelho. Nao ha conta, nao ha servidor, nao ha
 * sincronizacao — a mesma promessa que a pagina do produto faz sobre o video.
 *
 * `versao` existe para o dia em que o formato do plano mudar: dado antigo com
 * chave nova quebraria a tela em vez de recomecar limpo.
 */

const VERSAO = 1;
const PREFIXO = `formi.v${VERSAO}.`;

export function ler   (chave        , padrao   )    {
  try {
    const cru = localStorage.getItem(PREFIXO + chave);
    return cru === null ? padrao : (JSON.parse(cru)     );
  } catch {
    // Modo anonimo do Safari lanca em getItem; JSON corrompido lanca no parse.
    // Nos dois casos o app deve abrir vazio, nunca em tela branca.
    return padrao;
  }
}

export function gravar(chave        , valor         )       {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    /* Sem espaco ou sem permissao: a sessao segue em memoria. */
  }
}

export function limparTudo()       {
  try {
    for (const chave of Object.keys(localStorage)) {
      if (chave.startsWith(PREFIXO)) localStorage.removeItem(chave);
    }
  } catch {
    /* idem */
  }
}
