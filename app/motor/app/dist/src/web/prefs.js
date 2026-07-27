/**
 * Preferencias do usuario.
 *
 * O principio, vindo do teste de campo: **todo andaime e opcional**. Ritmo,
 * demonstracao, PiP, fantasma, esqueleto — cada canal se desliga sozinho, sem
 * derrubar os outros.
 *
 * Isso dissolve o que parecia ser uma escolha de arquitetura. "Sem conducao"
 * nao e um terceiro modo a construir: e o que sobra quando o usuario desliga
 * ritmo e video. Um modo a menos para manter.
 *
 * Persistidas em localStorage: quem desligou o ritmo nao quer ligar de novo a
 * cada serie.
 */

                        
                                                                       
                                                         
                                                   
                                                               
                                                                      
                                                                    
                                                                       
                                                                              
                                                             
                                                                            
                    
                                                     
                                           
                                                   
                                                        
 

// Defaults vindos do uso real, nao de suposicao:
//   esqueleto ligado e fantasma desligado porque "os fantasmas atrapalham,
//   melhor so com o esqueleto";
//   ritmo em VOZ porque no teste real o tique nao foi ouvido e a contagem
//   falada foi "perfeita" — o canal que passa e a voz.
export const PADRAO        = {
  ritmo: "voz",
  contagem: true,
  correcoes: true,
  esqueleto: true,
  demo: "trecho",
  revisao: true,
  // Ligada: no teste em iPhone a serie comecava sem aviso e o usuario ja
  // estava descendo quando o app passou a contar. Quem nao quiser a voz
  // desliga, e o portao continua valendo em silencio.
  regressiva: true,
  instrucoes: "antes_e_durante",
  fantasma: "nenhum",
  ritmoMs: 2000,
  // Uma repeticao por serie enquanto o resumo esta sendo testado: esperar dez
  // agachamentos para ver a tela do fim torna cada teste caro. Botao proprio
  // nas configuracoes para voltar a 10.
  repsAlvo: 1,
};

const CHAVE = "fitcam.prefs/1";

export function carregarPrefs()        {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { ...PADRAO };
    // Mesclar com o padrao, e nao substituir: uma preferencia nova que ainda
    // nao existia no armazenamento antigo tem que nascer com o default, nao
    // como undefined.
    const p = { ...PADRAO, ...JSON.parse(bruto) };
    // `ritmo` era booleano antes de existir a marcacao por voz. Migrar em vez
    // de descartar: quem tinha desligado o ritmo nao quer ele de volta.
    if (typeof (p       ).ritmo === "boolean") {
      (p       ).ritmo = (p       ).ritmo ? "voz" : "nenhum";
    }
    // `demo` tambem era booleano antes de existir o modo "completo".
    if (typeof (p       ).demo === "boolean") {
      (p       ).demo = (p       ).demo ? "trecho" : "nao";
    }
    return p;
  } catch {
    return { ...PADRAO };
  }
}

export function salvarPrefs(p       )       {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch { /* modo privado, quota cheia: seguir sem persistir */ }
}
