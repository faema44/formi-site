/**
 * A raiz de onde o app foi servido.
 *
 * Existe para o app nao exigir a raiz do dominio. Com `/dados/catalogo.json`
 * cravado na barra, publicar em `formi.fit/app/` quebraria a carga do catalogo
 * sem nenhuma pista do motivo — a requisicao iria para `formi.fit/dados/...`,
 * que nao existe. Derivando de `import.meta.url`, o mesmo build funciona na
 * raiz, num subcaminho, e no `file://` do WebView do Capacitor.
 *
 * Tres niveis acima de `app/dist/src/raiz.js`.
 *
 * Mesma solucao do fitcam-engine, pelo mesmo motivo. Quando os dois forem
 * empacotados juntos, nenhum dos dois sabe em que prefixo caiu.
 */
export const RAIZ = new URL("../../../", import.meta.url).href;

/** Resolve um caminho do projeto contra a raiz. */
export function daRaiz(caminho        )         {
  return new URL(caminho.replace(/^\//, ""), RAIZ).href;
}
