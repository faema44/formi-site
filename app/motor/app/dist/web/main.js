/**
 * O app no navegador do celular.
 *
 * Junta as pecas que ja existiam: o motor portado (identico ao Python, provado
 * pela suite de conformidade), o pacer, o fantasma de referencia e o
 * PoseLandmarker do MediaPipe.
 *
 * O que ele responde, e nenhum video responde: **seguir o fantasma e agradavel
 * ou irritante?**
 *
 * A pagina e servida por build.mjs a partir da RAIZ do projeto, entao
 * biblioteca/, referencias/ e modelos/ sao os mesmos arquivos que o Python le.
 * Nada e duplicado.
 */

import {
  FilesetResolver, PoseLandmarker,
} from "../../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

import {
  carregarObjeto,                                
} from "../src/motor/definicoes.js";
import { Interpretador } from "../src/motor/interpretador.js";
import { ponto,            } from "../src/motor/medidas.js";
import { ColetorSessao } from "../src/motor/sessao.js";
import { deReferencia, MonitorEnvelope, situacao } from "../src/motor/envelope.js";
import { esticarTempo, Pacer } from "../src/sessao/pacer.js";
import {
  AMARELO, BRANCO, esqueleto, fantasma, faseDoUsuario,
} from "../src/web/desenho.js";
import { indiceDaFase, lerReferencia,                 } from "../src/web/referencia.js";
import { CanalAudio, Condutor } from "../src/web/audio.js";
import { Guia } from "../src/web/guia.js";
import { carregarPrefs, salvarPrefs,            } from "../src/web/prefs.js";
import {
  desenharPose, desenharSobreVideo, GravadorDaSerie,
} from "../src/web/revisao.js";
import { desenharGrafico } from "../src/web/graficos.js";
import { OSSOS } from "../src/web/desenho.js";

/**
 * A raiz do projeto, deduzida de onde este modulo foi servido.
 *
 * Era `/biblioteca/...` cravado na barra. Isso amarrava a pagina a estar na
 * raiz do dominio, e o app que sequencia os treinos (o Formi) monta este app
 * num prefixo — `/motor/`. Com a base derivada de `import.meta.url` os dois
 * casos funcionam sem configuracao: servido na raiz, RAIZ vira "/"; montado em
 * /motor/, vira "/motor/". Tres niveis acima de app/dist/web/main.js.
 */
const RAIZ = new URL("../../../", import.meta.url).href;

/**
 * A lista duplica o conteudo de `biblioteca/` porque o navegador nao lista
 * diretorio.
 *
 * `agachamento_frontal` nao tem referencia gravada: roda, conta e corrige pelas
 * regras, mas sem fantasma, sem video do professor e sem revisao. O app ja
 * avisa isso na tela.
 */
const EXERCICIOS = ["agachamento_livre", "agachamento_frontal", "flexao_solo"];
const CHAVE_EXERCICIO = "fitcam.exercicio/1";

/**
 * Quem manda no exercicio: a URL primeiro, o localStorage depois.
 *
 * Aberto sozinho, o app continua se lembrando do ultimo exercicio, como sempre
 * fez. Aberto pelo sequenciador de planos, quem escolhe e o plano — e ele passa
 * `?exercicio=`, `?reps=` e `?retorno=`. `retorno` e o que distingue os dois
 * modos: com ele, esta serie faz parte de um treino maior e o resumo termina
 * devolvendo o resultado, em vez de oferecer "proximo exercicio".
 */
const params = new URLSearchParams(location.search);
const RETORNO = params.get("retorno");
const guardado = params.get("exercicio") ?? localStorage.getItem(CHAVE_EXERCICIO);
const EXERCICIO = guardado && EXERCICIOS.includes(guardado)
  ? guardado : EXERCICIOS[0];
/** Chave de entrega do resultado. Contrato com o app que abriu esta serie. */
const CHAVE_ENTREGA = "fitcam.entrega/1";

/**
 * Resolve um caminho de recurso da definicao contra a RAIZ.
 *
 * As definicoes escrevem "/capturas/x.mp4" com barra na frente, o que ignora
 * qualquer prefixo de montagem. Tirar a barra e resolver contra RAIZ mantem o
 * JSON como esta e faz o video ser achado nos dois modos.
 */
function recurso(caminho        )         {
  return new URL(caminho.replace(/^\//, ""), RAIZ).href;
}
const N_LANDMARKS = 33;
/** Opcoes de tamanho da serie. 1 existe para testar o resumo sem fazer dez. */
const REPS = [1, 3, 5, 10];

/**
 * Busca um elemento e FALHA com o nome dele se nao existir.
 *
 * `getElementById` devolvendo null produz "cannot read properties of null" —
 * uma mensagem que nao diz qual elemento nem onde. Ja custou uma sessao de
 * teste: uma referencia orfa a um elemento removido derrubou o encerramento da
 * serie, e o sintoma foi o contador travar em 9 e o resumo nunca aparecer.
 */
const $ =                        (id        )    => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento '${id}' nao existe no HTML`);
  return el     ;
};
const video = $                  ("video");
const professor = $                  ("professor");
const tela = $                   ("tela");
const ctx = tela.getContext("2d") ;

let ex           ;
let ref                    = null;
let landmarker                ;
let interp               ;
let coletor               ;
let monitor                         = null;
// A repeticao em curso teve desvio de forma? Silencia o ritmo enquanto sim.
let desvioNaRep = false;
// Serie encerrada: o motor PARA de medir. Antes eu so parava de conduzir, e o
// interpretador seguia rodando — sentado na frente da camera o usuario ganhava
// uma decima primeira repeticao e uma correcao.
let serieAtiva = true;
// Tally dos desvios do envelope na serie. O monitor para de FALAR depois do
// primeiro aviso, mas continua devolvendo — e aqui que o total sobrevive para
// o resumo.
let desviosDaSerie = new Map                ();
let gravadorSerie                         = null;
let animRevisao = 0;
/**
 * Contagem de quadros da serie, por estado do ciclo.
 *
 * A revisao so recebe quadros com `rastreando`. Se o rastreio cair justamente
 * na parte baixa do movimento, o gravador fica so com poses em pe e a grade de
 * fase quase nao e visitada — foi o que o celular relatou (cobertura 0.104).
 * Sem contar por estado, "cobertura baixa" nao diz ONDE o corpo se perdeu.
 */
const quadrosPorEstado = new Map                                               ();
/** Medidas que participam do casamento de fase. Ver `faseDoUsuario`. */
let medidasDeFase = new Set        ();
/**
 * Portao de armar: `posicionando -> armando -> executando`, como em
 * fitcam/sessao_ao_vivo.py.
 *
 * Sem ele o interpretador recebia quadros desde o primeiro frame e o caminho
 * ate a marca virava repeticao. Medido em iPhone: o app marcou 1 enquanto o
 * usuario afastava a cadeira e se levantava, e a serie de tres fechou com dois
 * agachamentos de verdade. Levantar-se E o fim de um agachamento — a maquina
 * de estados nao tem como saber que aquilo nao era a serie. Quem sabe e a
 * fase, e ela nao existia aqui.
 */
/**
 * Instrucao da serie corrente. Ver docs/instrucoes.md.
 *
 * Uma por serie, alternando: com tres instrucoes, a pessoa ouve uma por serie e
 * as tres em tres series. Em bloco seria pior — quem faz uma serie por sessao
 * levaria tres sessoes para ouvir a segunda dica, e pode se machucar por causa
 * dela nesse intervalo.
 */
let instrucaoDaSerie                   = null;
let serieN = 0;
let anteDita = false;
let duranteDita = false;
// Em que repeticao a dica entra. Um terco da serie: com 10 reps cai na 3ª
// ("1, 2, 3, coxas paralelas, 5..."), com 3 reps cai na 1ª. Cedo demais nao
// deixa a pessoa mostrar o que faz sozinha; tarde demais nao sobra serie para
// aplicar.
let repDoDurante = 1;

                                                      
let fase       = "posicionando";
let tEmPosicao                = null;
let tForaDePosicao                = null;
let tArmou = 0;
let contagemDita = 0;
const MS_ESTAVEL_PARA_ARMAR = 800;
// Histerese, igual a do Python: sair custa mais que entrar. Sem ela o jitter de
// um frame desarma a serie e a contagem regressiva recomeca do zero.
const MS_FORA_PARA_SOLTAR = 1200;
const CONTAGEM_REGRESSIVA_MS = 3000;
let pacer       ;
let aspecto = 1;
// Testado no celular: os dois juntos atrapalham, e o esqueleto e o que ajuda.
// O fantasma fica disponivel no botao, desligado por padrao.
let camera                         = "user";
const RITMOS = [1600, 2000, 2400, 3000];

const prefs        = carregarPrefs();
// O tamanho da serie vem do plano quando ha plano. Sobrescreve em memoria e NAO
// salva: a preferencia que o usuario escolheu no modo avulso continua sendo
// dele, e ele a reencontra intacta da proxima vez que abrir o app sozinho.
const repsDoPlano = Number(params.get("reps"));
if (Number.isFinite(repsDoPlano) && repsDoPlano > 0) prefs.repsAlvo = repsDoPlano;
const audio = new CanalAudio(prefs);
const condutor = new Condutor();
const guia = new Guia();
// O condutor manda comecar; o guia mostra o ritmo da repeticao.
condutor.aoChamar = (agoraMs) => guia.comecar(agoraMs, prefs.ritmoMs);
let tAnterior = 0;
let fpsMed = 0;
let alertaAte = 0;

// ---------------------------------------------------------------------------

async function carregarTudo()                {
  const diag = $("diag");

  diag.textContent = "carregando exercicio...";
  ex = carregarObjeto(await (await fetch(`${RAIZ}biblioteca/${EXERCICIO}.json`)).json());

  diag.textContent = "carregando referencia...";
  try {
    ref = lerReferencia(await (await fetch(`${RAIZ}referencias/${EXERCICIO}.json`)).json());
    if (ref.exercicioVersao !== ex.versao) {
      console.warn(
        `referencia e da versao ${ref.exercicioVersao}, exercicio esta na ` +
        `${ex.versao}. Regrave: python gravar.py -e biblioteca/${EXERCICIO}.json ...`,
      );
    }
    if (!ref.pose) ref = null;
  } catch (e) {
    console.warn("sem referencia; o fantasma nao sera desenhado", e);
    ref = null;
  }

  diag.textContent = "carregando o modelo de pose...";
  const fileset = await FilesetResolver.forVisionTasks(
    `${RAIZ}app/node_modules/@mediapipe/tasks-vision/wasm`,
  );
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${RAIZ}modelos/pose_landmarker_full.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
  diag.textContent = "";
}

async function ligarCamera()                {
  // Sem este aviso a tela fica identica a "nada aconteceu" enquanto o
  // navegador espera o toque em "permitir" — e quem nao viu o prompt fica
  // achando que o app travou.
  const diag = $("diag");
  diag.textContent = "aguardando a permissao da camera...";
  const lembrete = setTimeout(() => {
    diag.textContent =
      "ainda aguardando. Procure o pedido de permissao da camera " +
      "(costuma aparecer no alto da tela) e toque em Permitir.";
  }, 4000);

  // FRONTAL por padrao, e nao a traseira: a traseira aponta para o lado
  // oposto da tela. Com o celular apoiado de frente para o usuario, a camera
  // que o enxerga e a mesma que fica do lado da tela que ele consegue olhar.
  // Trocar isso quebra o produto inteiro — sem ver a tela nao ha fantasma.
  // Sem forcar dimensoes. Pedir 720x1280 para obter retrato fez o navegador
  // entregar um quadro deitado, e nao havia motivo para pedir: informado o
  // aspecto, os angulos saem em espaco isotropico e ficam iguais em qualquer
  // orientacao — o que a suite ja provava e eu deixei de checar antes de
  // "consertar".
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: camera },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  }).finally(() => clearTimeout(lembrete));
  diag.textContent = "";

  // Espelhar so a EXIBICAO, como espelho de academia. Os landmarks continuam
  // nas coordenadas originais; video e canvas viram juntos, entao o esqueleto
  // segue casando com o corpo. Espelhar os dados quebraria distancia_x, que
  // tem sinal.
  document.getElementById("palco") .classList.toggle("espelhado", camera === "user");
  video.srcObject = stream;
  await video.play();
  await new Promise      ((ok) => {
    if (video.videoWidth) return ok();
    video.onloadedmetadata = () => ok();
  });

  tela.width = video.videoWidth;
  tela.height = video.videoHeight;
  // O aspecto e o unico dado que o motor nao recupera depois: os landmarks ja
  // chegam normalizados. Ver a nota no topo de medidas.ts.
  aspecto = video.videoWidth / video.videoHeight;
}

/**
 * Mostra o professor executando, antes da serie. Opcional e interrompivel.
 *
 * Por padrao toca so a repeticao REPRESENTATIVA, duas vezes — o trecho exato
 * vem de `amostra_ms`, gravado junto com a referencia. Assistir 26 segundos de
 * video para aprender um movimento de 2 segundos cansa e ninguem faz duas
 * vezes.
 *
 * Dois cuidados que a primeira versao nao teve:
 *
 *   1. esperar os METADADOS antes de posicionar o video. Um `currentTime`
 *      definido antes disso e simplesmente descartado, e o video comeca do
 *      zero — foi o que aconteceu.
 *   2. checar a posicao num laco proprio. `ontimeupdate` dispara a cada ~250ms,
 *      o que num trecho de 2,4s deixa passar quase um decimo do ciclo.
 */
async function demonstrar()                {
  if (prefs.demo === "nao" || !ex.demo.video) return;

  // O texto longo do professor cabe AQUI: o usuario esta olhando, nao
  // executando, e a imagem correspondente esta na tela. É o unico momento em
  // que uma frase inteira instrui em vez de atrapalhar.
  const daVez = ex.instrucoes.filter((i) => i.durante || i.antes);
  if (prefs.instrucoes !== "nao" && daVez[serieN % (daVez.length || 1)]?.demo) {
    audio.falar(daVez[serieN % daVez.length].demo , 1);
  }

  const capa = $("demo-capa");
  professor.src = recurso(ex.demo.video);
  professor.classList.add("demo");
  professor.style.display = "block";
  capa.classList.remove("oculto");

  // Sem isto o seek abaixo nao tem efeito.
  if (professor.readyState < 1) {
    await new Promise      ((ok) => {
      professor.onloadedmetadata = () => ok();
      setTimeout(ok, 4000); // nao travar a serie se o video nao carregar
    });
  }

  const trecho = prefs.demo === "trecho" && ref?.amostraMs;
  const inicio = trecho ? ref .amostraMs [0] / 1000 : 0;
  const fim = trecho
    ? ref .amostraMs [ref .amostraMs .length - 1] / 1000
    : professor.duration || 0;

  const dur = Math.max(0.3, fim - inicio);
  const alvo = trecho ? ex.demo.ciclos : 1;

  await new Promise      ((pronto) => {
    let timer = 0;
    let prazo = 0;
    let ciclos = 0;
    const encerrar = () => {
      clearInterval(timer);
      clearTimeout(prazo);
      professor.pause();
      professor.style.display = "none";
      professor.classList.remove("demo");
      capa.classList.add("oculto");
      $("pular-demo").onclick = null;
      pronto();
    };
    $("pular-demo").onclick = encerrar;

    // Prazo duro. A versao anterior dependia so de detectar o fim do trecho, e
    // se essa deteccao falhasse a demonstracao ficava em laco esperando um
    // toque — foi o que aconteceu. Aqui ela termina de qualquer jeito.
    prazo = setTimeout(encerrar, (dur * alvo + 1.5) * 1000)                     ;

    timer = setInterval(() => {
      $("demo-conta").textContent = trecho
        ? `repeticao ${Math.min(ciclos + 1, alvo)} de ${alvo}`
        : "";
      if (professor.currentTime < fim - 0.02) return;
      ciclos += 1;
      if (ciclos >= alvo) return encerrar();
      professor.currentTime = inicio;
    }, 40)                     ;

    professor.currentTime = inicio;
    professor.play().catch(encerrar);
  });
}

/**
 * Manda um diagnostico para o console do SERVIDOR.
 *
 * Existe porque o Chrome do Android nao entrega console ao logcat em build de
 * release: um defeito que so aparece no celular fica sem nenhum canal de
 * observacao, e a alternativa e adivinhar. Silencioso por definicao — se o
 * relato falhar, a serie do usuario nao pode ser afetada.
 */
function relatar(assunto        , dados                         )       {
  try {
    fetch("/_log", {
      method: "POST",
      body: `${assunto} ${JSON.stringify(dados)}`,
      keepalive: true,
    }).catch(() => {});
  } catch { /* sem servidor de desenvolvimento: seguir sem relatar */ }
}

/** Ponto da grade mais proximo de um instante do video de origem. */
function indiceDoInstante(r            , ms        )         {
  const a = r.amostraMs ;
  let melhor = 0;
  let dist = Infinity;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - ms);
    if (d < dist) { dist = d; melhor = i; }
  }
  return melhor;
}

/** A comparacao com o professor esta disponivel para esta serie? */
function avaliarRevisao()                                    {
  // O portao pergunta se ha pose de CADA FASE do movimento, e nao que fracao da
  // grade foi visitada. Medido no celular: rastreio 100% em todos os estados e
  // ainda assim cobertura 0.25, porque descida e subida duram poucos quadros e
  // a grade reserva 12 pontos para cada uma. O portao antigo media a taxa de
  // quadros do aparelho disfarcada de qualidade da serie.
  const blocos = gravadorSerie && ref
    ? gravadorSerie.preenchidosPorBloco(ref.amostrasPorEstado)
    : [];
  const faseVazia = ref ? ref.ciclo.findIndex((_, k) => (blocos[k] ?? 0) === 0) : -1;
  const pode = Boolean(prefs.revisao && ref?.pose && gravadorSerie &&
    blocos.length > 0 && faseVazia < 0);

  const porEstado                         = {};
  for (const [estado, c] of quadrosPorEstado) {
    porEstado[estado] = `${c.rastreando}/${c.total}`;
  }
  relatar("revisao:portao", {
    mostrar: pode,
    pref_revisao: prefs.revisao,
    tem_ref: Boolean(ref),
    tem_pose: Boolean(ref?.pose),
    tem_gravador: Boolean(gravadorSerie),
    cobertura: gravadorSerie ? +gravadorSerie.cobertura.toFixed(3) : null,
    poses_por_fase: ref ? Object.fromEntries(
      ref.ciclo.map((e, k) => [e, blocos[k] ?? 0])) : null,
    // "rastreando/total" por estado do ciclo. E aqui que se ve se o corpo se
    // perde ao agachar: `agachado` com 2/90 diz tudo o que a cobertura sozinha
    // nao dizia.
    quadros_por_estado: porEstado,
    demo_video: ex.demo.video,
    tem_amostraMs: Boolean(ref?.amostraMs),
    tem_ancora: Boolean(ref?.ancoraVideo),
  });
  if (pode) return { pode: true, motivo: "" };

  // Silencio nao e resposta. A revisao sumia sem dizer nada, e "nao apareceu"
  // custou quatro rodadas de teste porque cobria cinco causas diferentes.
  const pior = [...quadrosPorEstado.entries()]
    .filter(([, c]) => c.total >= 10)
    .sort((a, b) => a[1].rastreando / a[1].total - b[1].rastreando / b[1].total)[0];
  if (!prefs.revisao) return { pode: false, motivo: "comparacao desligada nas configuracoes" };
  if (!ref?.pose) return { pode: false, motivo: "sem referencia gravada para comparar" };
  if (pior && pior[1].rastreando / pior[1].total < 0.6) {
    return {
      pode: false,
      motivo: `comparacao indisponivel: o corpo saiu de quadro em "${pior[0]}" ` +
        `(${pior[1].rastreando} de ${pior[1].total} quadros). Afaste o celular.`,
    };
  }
  if (faseVazia >= 0) {
    return {
      pode: false,
      motivo: `comparacao indisponivel: nenhuma pose captada na fase ` +
        `"${ref .ciclo[faseVazia]}".`,
    };
  }
  return { pode: false, motivo: "comparacao indisponivel para esta serie" };
}

/**
 * Curvas do exercicio no resumo: o professor e voce, medida por medida.
 *
 * O video responde "como ficou"; o grafico responde "quanto". Sao perguntas
 * diferentes, e a segunda e a que diz onde melhorar — da para ver que o
 * agachamento ficou raso sem saber por quantos graus, nem em que parte do
 * movimento, nem se o tronco compensou.
 */
function montarGraficos()       {
  const area = $("graficos");
  area.replaceChildren();
  if (!ref || !gravadorSerie) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const altura = 132;

  for (const [id, blocos] of Object.entries(ref.medidas)) {
    const minha = gravadorSerie.curvas.get(id);
    if (!minha || minha.every((v) => v === null)) continue;

    const cv = document.createElement("canvas");
    cv.style.height = `${altura}px`;
    area.appendChild(cv);
    // Medir DEPOIS de inserir: o canvas tem largura fluida (100% ate 420px), e
    // dimensionar o buffer por um palpite deixa o desenho esticado na
    // horizontal — visivel de imediato nos rotulos das fases.
    const largura = cv.clientWidth;
    cv.width = Math.round(largura * dpr);
    cv.height = Math.round(altura * dpr);

    const c = cv.getContext("2d") ;
    c.scale(dpr, dpr);
    const medida = ex.medidas.find((m) => m.id === id);
    const eAngulo = Boolean(medida?.tipo.startsWith("angulo"));
    desenharGrafico(
      c, largura, altura,
      { mediana: blocos.mediana, minimo: blocos.minimo, maximo: blocos.maximo, usuario: minha },
      ref.ciclo, ref.amostrasPorEstado,
      // A margem do envelope esta em GRAUS. Aplica-la a uma medida
      // adimensional como `altura_quadril`, que varia 0.18 na referencia
      // inteira, produz uma faixa de +-8 que engole o grafico e nao significa
      // nada. Margem so onde ela tem unidade.
      eAngulo ? ex.envelope.margem : 0,
      id.replace(/_/g, " "),
      eAngulo ? "°" : "",
    );
  }
}

/**
 * Abre o video do fim de serie. `comFantasma` decide se o seu esqueleto entra.
 *
 * O video TOCA; nao e arrastado quadro a quadro. A primeira versao pedia
 * `currentTime` a cada quadro de animacao e copiava o resultado para o canvas
 * com drawImage. No PC isso passa, mas e o pior uso possivel de um decodificador
 * de celular: buscar posicao e caro, tocar e o que o hardware faz bem. E se
 * nenhum quadro chega a ser decodificado, drawImage nao levanta erro — nao
 * pinta nada, e a revisao vira um retangulo vazio, que foi o relato.
 *
 * Tocando, a sincronia sai de graca e fica exata: o indice do fantasma vem do
 * `currentTime` do proprio video, entao os dois nao tem como se separar.
 *
 * O trecho repete CICLOS_REVISAO vezes e para. Antes repetia para sempre, e sem
 * o resumo por tras isso deixava o usuario preso num laco sem saida.
 */
const CICLOS_REVISAO = 3;

function abrirVideo(comFantasma         )       {
  const caixa = $("revisao-caixa");
  const tela2 = $                   ("revisao");
  const rev = $                  ("professor-rev");
  const leg = $("revisao-legenda");

  $("resumo-conteudo").classList.add("oculto");
  caixa.classList.remove("oculto");

  // O canvas so pode ser dimensionado com a caixa JA visivel: em display:none
  // clientWidth vale zero, e o canvas nasceria 0x0 — invisivel e sem erro.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  tela2.width = Math.round(caixa.clientWidth * dpr);
  tela2.height = Math.round(caixa.clientHeight * dpr);
  relatar("revisao:canvas", {
    caixa: [caixa.clientWidth, caixa.clientHeight],
    canvas: [tela2.width, tela2.height], dpr, comFantasma,
  });

  const c2 = tela2.getContext("2d") ;
  // Sem video do professor (exercicio ainda nao filmado) a comparacao nao
  // morre: cai para os dois esqueletos lado a lado, que era o modo original.
  const comVideo = Boolean(ex.demo.video && ref .amostraMs && ref .ancoraVideo);
  const legenda = (extra = "") => {
    leg.innerHTML = (!comVideo
      ? '<b style="color:#f5f5f5">professor</b> · <b style="color:#50dcff">voce</b>'
      : comFantasma
        ? '<b style="color:#50dcff">voce</b> sobre o professor'
        : "professor") + extra;
  };
  legenda();

  const rev0 = performance.now();
  if (!comVideo) {
    rev.style.display = "none";
    const passoSemVideo = () => {
      c2.clearRect(0, 0, tela2.width, tela2.height);
      const i = indiceDaFase(ref , ((performance.now() - rev0) / 2600) % 1);
      const escala = tela2.height * 0.4;
      const traco = Math.max(3, tela2.height / 90);
      desenharPose(c2, ref .pose [i], tela2.width, tela2.height,
                   "rgba(245,245,245,.55)", traco * 1.7, OSSOS, escala, [0.5, 0.86]);
      const minha = comFantasma ? gravadorSerie .em(i) : null;
      if (minha) {
        desenharPose(c2, minha, tela2.width, tela2.height,
                     "#50dcff", traco, OSSOS, escala, [0.5, 0.86]);
      }
      animRevisao = requestAnimationFrame(passoSemVideo);
    };
    ($("repetir-video")                     ).disabled = true;
    cancelAnimationFrame(animRevisao);
    passoSemVideo();
    return;
  }
  rev.style.display = "block";
  ($("repetir-video")                     ).disabled = false;

  // Trecho da repeticao representativa, o mesmo que a demonstracao usa.
  const iniMs = ref .amostraMs [0];
  const fimMs = ref .amostraMs [ref .amostraMs .length - 1];
  let ciclos = 0;

  if (rev.src !== recurso(ex.demo.video )) {
    rev.src = recurso(ex.demo.video );
  }
  // Um erro de carga aqui era invisivel: sem isto o usuario ve uma caixa preta
  // e nao tem como saber que o problema foi o video, nao a serie dele.
  rev.onerror = () => {
    relatar("revisao:erro-video", { codigo: rev.error?.code ?? null, src: rev.src });
    legenda(` <span style="opacity:.6">(video indisponivel: erro ${rev.error?.code ?? "?"})</span>`);
  };
  const tocar = () => {
    ciclos = 0;
    rev.currentTime = iniMs / 1000;
    rev.play().then(
      () => relatar("revisao:tocando", {
        vw: rev.videoWidth, vh: rev.videoHeight, duracao: rev.duration,
        trecho: [iniMs, fimMs],
      }),
      (e) => {
        relatar("revisao:play-recusado", { erro: e.name, msg: String(e.message) });
        legenda(` <span style="opacity:.6">(video nao pode tocar: ${e.name})</span>`);
      },
    );
  };
  ($("repetir-video")                     ).onclick = tocar;
  relatar("revisao:carga", { readyState: rev.readyState });
  if (rev.readyState >= 1) tocar();
  else rev.onloadedmetadata = tocar;

  const passo = () => {
    c2.clearRect(0, 0, tela2.width, tela2.height);
    if (rev.currentTime * 1000 >= fimMs) {
      ciclos += 1;
      if (ciclos >= CICLOS_REVISAO) rev.pause();
      else rev.currentTime = iniMs / 1000;
    }
    if (comFantasma && rev.videoWidth) {
      const i = indiceDoInstante(ref , rev.currentTime * 1000);
      const minha = gravadorSerie .em(i);
      if (minha) {
        // Onde o video de fato aparece na caixa: o elemento usa
        // object-fit: contain, entao sobra tarja e a ancora precisa do
        // retangulo real, nao da caixa toda.
        const esc = Math.min(tela2.width / rev.videoWidth, tela2.height / rev.videoHeight);
        const dw = rev.videoWidth * esc;
        const dh = rev.videoHeight * esc;
        desenharSobreVideo(c2, minha, ref .ancoraVideo [i],
                           (tela2.width - dw) / 2, (tela2.height - dh) / 2, dw, dh,
                           rev.videoWidth / rev.videoHeight, "#50dcff",
                           Math.max(3, dw / 70), OSSOS, ref .espelhado);
      }
    }
    animRevisao = requestAnimationFrame(passo);
  };
  cancelAnimationFrame(animRevisao);
  passo();
}

/** Fecha o modo video e devolve o resumo. */
function fecharVideo()       {
  cancelAnimationFrame(animRevisao);
  $                  ("professor-rev").pause();
  $("revisao-caixa").classList.add("oculto");
  $("resumo-conteudo").classList.remove("oculto");
}

/** Fecha a serie: para o motor, limpa a tela e mostra o resumo. */
function encerrarSerie()       {
  serieAtiva = false;
  // A ultima fase ainda esta no buffer do gravador; sem isto ela nao chega ao
  // grafico nem a revisao.
  gravadorSerie?.fechar();
  const r = coletor.resumo();

  // "qualidade 87%" nao diz nada a quem acabou de treinar, e pior: convivia na
  // mesma tela com a lista de desvios, que vinha de outra conta. A fracao diz o
  // que aconteceu, sem formula e sem contradicao.
  const limpas = r.reps - Math.min(r.reps, coletor.repsSujas);
  $("resumo-numeros").innerHTML =
    `<b>${r.reps}</b>repeticoes` +
    (r.reps > 0 ? `<br>${limpas} de ${r.reps} sem nenhum aviso` : "") +
    `<br>${(r.tempo_medio_rep_ms / 1000).toFixed(1)}s por repeticao`;

  // O resumo junta as duas fontes: as regras da definicao e o envelope.
  const tipos = [
    ...Object.entries(r.erros_por_tipo).map(([k, n]) => [k.replace(/_/g, " "), n]         ),
    ...[...desviosDaSerie.entries()],
  ];
  $("resumo-erros").innerHTML = tipos.length
    ? tipos.map(([k, n]) => `${k}: ${n}x`).join("<br>")
    : "nenhum desvio tecnico";

  // O resumo sai do `oculto` ANTES de desenhar. Enquanto o pai esta em
  // display:none, clientWidth/clientHeight valem zero, e os canvas nasceriam
  // 0x0 — invisiveis, sem erro nenhum para denunciar.
  $("resumo").classList.remove("oculto");
  $("resumo-conteudo").classList.remove("oculto");
  $("revisao-caixa").classList.add("oculto");

  montarGraficos();
  const { pode, motivo } = avaliarRevisao();
  $("revisao-aviso").textContent = motivo;
  ($("ver-comparacao")                     ).disabled = !pode;
  // Sem video do professor so existe o modo comparacao (dois esqueletos); nao
  // ha "video do professor" para mostrar.
  ($("ver-professor")                     ).disabled = !ex.demo.video;

  ctx.clearRect(0, 0, tela.width, tela.height);
  $("ritmo-barra").style.display = "none";
  $("alerta").classList.remove("on");

  // Modo plano: quem decide o proximo exercicio e o plano, nao este app. O
  // botao que sobra devolve o resultado e volta para ele.
  if (RETORNO) {
    $("proximo-exercicio").style.display = "none";
    $("ao-inicio").textContent = "concluir e voltar ao treino";
  }
}

/**
 * Entrega o resultado da serie ao app que a abriu, e volta para ele.
 *
 * O canal e o localStorage, e nao postMessage: entre o fim da serie e o retorno
 * ha uma navegacao de pagina inteira, e uma mensagem postada para uma pagina
 * que esta sendo descarregada se perde sem deixar rastro. A chave sobrevive a
 * navegacao, ao refresh, e ao app ser fechado no meio do treino.
 *
 * O que sai daqui e o payload `fitcam.serie/1` — texto estruturado, nenhuma
 * coordenada. A mesma garantia que o teste de conformidade sustenta.
 */
function entregar()       {
  try {
    localStorage.setItem(CHAVE_ENTREGA, JSON.stringify({
      schema: "fitcam.entrega/1",
      exercicio: EXERCICIO,
      quando: new Date().toISOString(),
      serie: coletor.payload(),
    }));
  } catch (e) {
    // Sem espaco ou sem permissao. Voltar sem o resultado e ruim, mas ficar
    // preso na tela de resumo e pior — e o plano trata a serie como nao feita.
    console.error("nao foi possivel entregar o resultado da serie", e);
  }
  location.href = RETORNO ;
}

let envAtual                                         = null;

/** Bandas da fase atual, para o diagnostico na tela. */
function bandasDoEstado(estado        ) {
  if (!envAtual) return null;
  const saida                                                     = {};
  for (const [medida, porEstado] of Object.entries(envAtual.bandas)) {
    const b = porEstado[estado];
    if (b) saida[medida] = b;
  }
  return saida;
}

function novaSerie()       {
  interp = new Interpretador(ex, aspecto);
  coletor = new ColetorSessao(ex.id, ex.versao, ex.nome);
  pacer = new Pacer(prefs.ritmoMs);
  // O envelope so existe se houver referencia gravada: ele E a gravacao do
  // professor, colapsada em bandas por fase.
  // Sem guarda de aspecto. Ela existiu por um diagnostico errado meu: informado
  // o aspecto, as medidas saem em angulo FISICO e nao dependem da orientacao
  // do quadro — verificado sobre o video real, 10 reps, medidas identicas em
  // 0,5625 e em 1,7778. A guarda so desligava a correcao sem motivo.
  envAtual = ref ? deReferencia(ref) : null;
  monitor = ref && ex.envelope.ativo ? new MonitorEnvelope(ex, envAtual ) : null;
  // O aviso continua existindo para o caso em que NAO ha referencia: ai o
  // envelope realmente nao tem como funcionar, e o silencio precisa ser
  // explicado.
  const avisoEnv = $("aviso-envelope");
  if (ex.envelope.ativo && !ref) {
    avisoEnv.textContent = "sem referencia gravada: correcao indisponivel";
    avisoEnv.style.display = "block";
  } else {
    avisoEnv.style.display = "none";
  }
  desvioNaRep = false;
  serieAtiva = true;
  // A instrucao com `regra` cede o canal durante a serie para a correcao
  // medida — ela nao tem `durante`, e so entra em `antes` e na demonstracao.
  const daVez = ex.instrucoes.filter((i) => i.durante || i.antes);
  instrucaoDaSerie = daVez.length ? daVez[serieN % daVez.length] : null;
  serieN += 1;
  anteDita = false;
  duranteDita = false;
  repDoDurante = Math.max(1, Math.round(prefs.repsAlvo / 3));
  fase = "posicionando";
  tEmPosicao = null;
  tForaDePosicao = null;
  contagemDita = 0;
  desviosDaSerie = new Map();
  quadrosPorEstado.clear();
  gravadorSerie = ref
    ? new GravadorDaSerie(ref.tamanhoGrade, ref.ciclo, ref.amostrasPorEstado)
    : null;
  // So angulos casam a fase entre corpos diferentes. Ver a nota em
  // faseDoUsuario: uma distancia normalizada de faixa estreita domina o
  // vizinho mais proximo e prende o indice.
  medidasDeFase = new Set(
    ex.medidas.filter((m) => m.tipo.startsWith("angulo")).map((m) => m.id),
  );
  cancelAnimationFrame(animRevisao);
  // O video da revisao fica tocando enquanto o resumo esta aberto; sem isto
  // ele continua rodando escondido durante a serie seguinte.
  $                  ("professor-rev").pause();
  $("resumo").classList.add("oculto");
  condutor.reiniciar();
  tAnterior = 0;
}

// ---------------------------------------------------------------------------

function converter(res     )          {
  if (!res.landmarks?.length) {
    return new Array(N_LANDMARKS).fill(null).map(() => ponto(0, 0, 0, 0));
  }
  return res.landmarks[0].map((lm     ) =>
    ponto(lm.x, lm.y, lm.z ?? 0, lm.visibility ?? 0),
  );
}

let errosNoLaco = 0;
// Severidade suavizada. O valor cru pula a cada frame e a tela fica nervosa;
// um professor leva um instante para se preocupar e outro para relaxar.
let sevSuave = 0;

const AZUL                           = [61, 125, 255];
const AMARELO_C                           = [255, 200, 60];
const VERMELHO_C                           = [235, 60, 60];

/** Degrade azul -> amarelo -> vermelho conforme a severidade [0, 1]. */
function corDaSeveridade(s        )                           {
  const [a, b, t] = s < 0.5
    ? [AZUL, AMARELO_C, s * 2]
    : [AMARELO_C, VERMELHO_C, (s - 0.5) * 2];
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))   
                            ;
}

/**
 * Um frame. Envolvido por `laco`, que captura excecao.
 *
 * Sem essa captura, um erro aqui mata o resto do frame em silencio: nao
 * desenha o esqueleto, nao atualiza a barra, nao chama o condutor — e a tela
 * fica parecendo "o app parou de detectar" em vez de "o app quebrou". Ja
 * aconteceu duas vezes nesta sessao, e as duas custaram uma rodada de teste
 * para descobrir que o sintoma nao era o problema.
 */
function laco(agora        )       {
  requestAnimationFrame(laco);
  try {
    quadro(agora);
  } catch (e     ) {
    if (errosNoLaco++ < 3) console.error("erro no laco:", e);
    mostrarFalha(`erro no processamento: ${e?.message ?? e}`);
  }
}

function mostrarFalha(texto        )       {
  const aviso = $("aviso-envelope");
  aviso.textContent = texto;
  aviso.style.display = "block";
}

/**
 * Qualquer excecao vira mensagem na tela, nao so as do laco.
 *
 * O laco ja tinha try/catch, mas um erro dentro de um handler de botao morria
 * calado: a acao simplesmente nao acontecia. Toda falha muda desta sessao
 * custou uma rodada de teste inteira para ser localizada, e o celular nao tem
 * console para consultar. Barato demais para nao ter.
 */
window.addEventListener("error", (ev) => {
  mostrarFalha(`erro: ${ev.message}`);
  relatar("erro:global", { msg: ev.message, arquivo: ev.filename, linha: ev.lineno });
});
window.addEventListener("unhandledrejection", (ev                       ) => {
  const m = (ev.reason       )?.message ?? String(ev.reason);
  mostrarFalha(`erro: ${m}`);
  relatar("erro:promessa", { msg: m });
});

/**
 * Decide quando a serie comeca de fato. Ver a nota em `fase`.
 *
 * "Em posicao" aqui e rastreio bom com o corpo no estado inicial do exercicio
 * — de pe, no agachamento. Nao e o `analisar` do Python, que mede enquadramento
 * de verdade; e o que o app web tem hoje, e ja cobre o caso que quebrou:
 * ninguem fica 800 ms parado em pe enquanto caminha para a marca.
 */
function portao(r                                        , agora        )       {
  // Duas condicoes diferentes, de proposito. ARMAR exige o corpo no topo: a
  // serie comeca de pe, e quem esta caminhando para a marca nao fica 800 ms
  // parado em pe. MANTER armado exige so estar visivel — analogo ao `enq.ok`
  // do Python, que mede enquadramento, nao pose. Usar "de pe" nos dois lados
  // desarmava a serie no instante em que o usuario comecava a descer, e a
  // contagem regressiva reiniciava em laco.
  const enquadrado = r.rastreando;
  const noTopo = enquadrado && r.estado === ex.estadoInicial;

  // A instrucao longa sai aqui, com a pessoa em pe e ainda parada: e o unico
  // momento da serie sem pressa. E a serie NAO arma enquanto ela fala — contar
  // por cima da explicacao do professor é o mesmo que nao explicar.
  if (fase === "posicionando" && noTopo && !anteDita && instrucaoDaSerie?.antes
      && prefs.instrucoes !== "nao") {
    anteDita = true;
    audio.falar(instrucaoDaSerie.antes, 1, agora);
  }

  if (fase === "posicionando") {
    // Um frame bom no meio de dez ruins e ruido, nao posicao correta.
    if (!noTopo) tEmPosicao = null;
    else if (tEmPosicao === null) tEmPosicao = agora;
    else if (agora - tEmPosicao >= MS_ESTAVEL_PARA_ARMAR && !audio.ocupado(agora)) {
      fase = "armando";
      tArmou = agora;
      tForaDePosicao = null;
      contagemDita = 0;
    }
  } else if (enquadrado) {
    tForaDePosicao = null;
  } else {
    if (tForaDePosicao === null) tForaDePosicao = agora;
    if (agora - tForaDePosicao >= MS_FORA_PARA_SOLTAR) {
      fase = "posicionando";
      tEmPosicao = null;
    }
  }

  let restante = 0;
  if (fase === "armando") {
    restante = (prefs.regressiva ? CONTAGEM_REGRESSIVA_MS : 0) - (agora - tArmou);
    const n = Math.floor(restante / 1000) + 1;
    if (prefs.regressiva && n >= 1 && n <= 3 && n !== contagemDita) {
      contagemDita = n;
      audio.falar(String(n), 1, agora);
    }
    if (restante <= 0) {
      // Zera o que passou pelo portao: o interpretador viu o caminho ate a
      // marca e pode ter fechado repeticoes que nao existiram.
      interp.reiniciar();
      condutor.reiniciar();
      fase = "executando";
      return;
    }
  }

  $("fase").textContent = !r.rastreando
    ? "SEM RASTREIO"
    : fase === "armando"
    ? `ARMANDO ${Math.ceil(restante / 1000)}`
    : "POSICIONE-SE";
  $("reps").innerHTML = `0<small>/${prefs.repsAlvo}</small>`;
  $("medidas").innerHTML = "";
  $("ritmo-barra").style.display = "none";
}

function quadro(agora        )       {
  if (video.readyState < 2) return;
  // Acabou: nada de detectar pose, contar ou corrigir. O trabalho de visao
  // tambem para, o que devolve bateria enquanto o resumo esta na tela.
  if (!serieAtiva) return;

  const ts = Math.trunc(agora);
  const dt = tAnterior ? ts - tAnterior : 0;
  tAnterior = ts;

  const landmarks = converter(landmarker.detectForVideo(video, ts));
  // O interpretador roda sempre: o portao precisa do ESTADO do corpo para
  // saber que o usuario esta de pe e parado. O que o portao segura e o
  // CONSUMO — eventos, correcao, gravacao e ritmo — e ao liberar ele zera o
  // contador, entao nada do que passou aqui vira repeticao da serie.
  const r = interp.processar(landmarks, ts);
  if (fase !== "executando") {
    portao(r, agora);
    ctx.clearRect(0, 0, tela.width, tela.height);
    if (r.rastreando && prefs.esqueleto) {
      esqueleto(ctx, landmarks, tela.width, tela.height);
    }
    return;
  }
  coletor.consumir(r);

  // Declarado AQUI, antes de qualquer consumidor. Estava depois do semaforo, e
  // `const` em zona morta temporal lanca ReferenceError — o laco morria todo
  // frame antes de desenhar o esqueleto, atualizar a barra ou chamar o
  // condutor, e a luz ficava congelada na cor do ultimo frame que rodou.
  //
  // A serie tem fim: sem isto o app manda descer para sempre depois da ultima
  // repeticao.
  const terminou = r.reps >= prefs.repsAlvo;

  for (const ev of r.eventos) {
    if (ev.tipo === "erro") {
      const a = $("alerta");
      a.textContent = ev.dados.rotulo_display ?? ev.dados.regra;
      a.classList.add("on");
      alertaAte = agora + 2000;
      // Correcao interrompe contagem: e a informacao mais util do momento.
      if (prefs.correcoes) audio.falar(ev.dados.mensagem, 2, agora);
    } else if (ev.tipo === "repeticao") {
      // A contagem cede a vez, nao o lugar: o numero DESTA repeticao cala para
      // a dica caber, e a numeracao segue de onde estava — "1, 2, 3, costas
      // retas, 5". O numero grande continua na tela o tempo todo, entao quem
      // cala e o canal que tem reserva.
      const dica = prefs.instrucoes === "antes_e_durante" && !duranteDita
        && instrucaoDaSerie?.quando === "no_topo" && instrucaoDaSerie.durante
        && ev.dados.numero >= repDoDurante
        ? instrucaoDaSerie.durante : null;
      if (dica) {
        duranteDita = true;
        audio.falar(dica, 1, agora);
      } else if (prefs.contagem) {
        audio.falar(String(ev.dados.numero), 1, agora);
      }
      // O condutor decide, a partir daqui, se a proxima chamada espera (rep
      // rapida) ou sai assim que o corpo voltar ao topo (rep lenta).
      // Forma antes de ritmo: a rep que teve desvio nao ganha comentario de
      // cadencia. A contagem continua — o esforco foi feito.
      condutor.aoFecharRep(ev.dados.duracao_ms, prefs.ritmoMs, !desvioNaRep);
      desvioNaRep = false;
      guia.parar();
      if (ev.dados.numero >= prefs.repsAlvo) {
        condutor.concluir(agora, audio);
        encerrarSerie();
      }
    }
  }
  // Dica ancorada no movimento, nao no topo: entra quando o corpo sai da
  // posicao inicial, a partir da repeticao alvo. "Descida" aqui e aproximado —
  // qualquer estado fora do inicial. O nome da fase de descida pertence ao
  // exercicio, nao ao app; se um dia precisar de precisao, vem da definicao.
  if (!duranteDita && prefs.instrucoes === "antes_e_durante"
      && instrucaoDaSerie?.durante && instrucaoDaSerie.quando !== "no_topo"
      && r.reps >= repDoDurante && !audio.ocupado(agora)
      && (instrucaoDaSerie.quando === "qualquer" || r.estado !== ex.estadoInicial)) {
    duranteDita = true;
    audio.falar(instrucaoDaSerie.durante, 1, agora);
  }

  // Correcao por envelope: compara cada medida com a banda que o professor
  // ocupou NAQUELA fase. Um limiar escalar nao consegue fazer isso — 70 graus
  // de tronco no fundo e normal, na descida e erro.
  if (monitor && r.rastreando) {
    // Um foco de correcao por vez: o pior desvio. Duas frases na mesma pausa
    // competem, e nao da para agir nas duas ao mesmo tempo.
    const desvios = monitor.avaliar(r.medidas, r.estado, ts, r.reps);
    // O indice de qualidade conta repeticao limpa, e "limpa" tem que incluir o
    // envelope: era ele que ficava de fora e fazia a tela mostrar 100% com
    // desvio listado logo abaixo.
    if (desvios.length) coletor.marcarDesvio();
    for (const d of desvios) {
      const chave = `${d.medida} ${d.direcao === "acima" ? "demais" : "de menos"}`;
      desviosDaSerie.set(chave, (desviosDaSerie.get(chave) ?? 0) + 1);
    }
    const [pior] = desvios;
    if (pior) {
      desvioNaRep = true;
      const a = $("alerta");
      a.textContent = pior.medida.toUpperCase();
      a.classList.add("on");
      alertaAte = agora + 2200;
      // Fala so o primeiro aviso da serie para esta medida. Repetir a cada
      // repeticao nao ensina nada novo e cansa; o total vai para o resumo.
      if (prefs.correcoes && pior.avisar) audio.falar(pior.mensagem, 2, agora);
    }
  }

  // Grava a propria execucao na grade de FASE da referencia, para a revisao.
  const conta = quadrosPorEstado.get(r.estado) ?? { total: 0, rastreando: 0 };
  conta.total += 1;
  if (r.rastreando) conta.rastreando += 1;
  quadrosPorEstado.set(r.estado, conta);
  if (gravadorSerie && ref && r.rastreando && Object.keys(r.medidas).length) {
    // O ESTADO, nao o indice: a posicao na grade e decidida quando a fase
    // termina, pela mesma regua de tempo com que a referencia foi gravada. O
    // casamento por semelhanca (`faseDoUsuario`) segue valendo para o fantasma,
    // onde a pergunta certa e "qual pose do professor corresponde a minha
    // AGORA" — ali o cronometro nao serve.
    gravadorSerie.registrar(r.estado, landmarks, aspecto, r.medidas);
  }

  // Semaforo no fundo do contador, com cor continua e suavizada no tempo.
  const alvoSev = envAtual && r.rastreando && !terminou
    ? situacao(ex, envAtual, r.medidas, r.estado).severidade
    : 0;
  // Constante de tempo ~350ms, independente da taxa de quadros.
  const k = dt > 0 ? 1 - Math.exp(-dt / 350) : 0;
  sevSuave += (alvoSev - sevSuave) * k;

  const [cr, cg, cb] = corDaSeveridade(sevSuave);
  const caixa = $("reps");
  // Alfa alto desde o repouso: com 0,22 a cor mal aparecia sobre o video, e o
  // usuario relatou nao ter visto o semaforo mudar. O canal continuo so serve
  // se for perceptivel de longe.
  const alfa = 0.55 + sevSuave * 0.4;
  caixa.style.background = `rgba(${cr}, ${cg}, ${cb}, ${alfa})`;
  // Contraste: em fundo claro (amarelo) o texto branco some. Luminancia
  // percebida decide, para o contador nunca desaparecer.
  const lum = (0.299 * cr + 0.587 * cg + 0.114 * cb) * alfa;
  caixa.style.color = lum > 120 ? "#101014" : "#f0f0f2";

  pacer.avancar(dt, r.reps);
  // O condutor so fala com o usuario no topo — o estado que conta a repeticao.
  // E o que torna impossivel dessincronizar: o sinal esta sempre ancorado numa
  // posicao conhecida do corpo, nao num relogio proprio.
  // O portao ja garante que a serie so comeca com o usuario parado em posicao;
  // o condutor nao precisa mais da propria espera de 1500 ms.
  if (r.rastreando && !terminou) {
    condutor.passo(r.estado === ex.estadoInicial, agora, prefs.ritmoMs, audio);
  }
  if (agora > alertaAte) $("alerta").classList.remove("on");

  // --- desenho ---
  ctx.clearRect(0, 0, tela.width, tela.height);
  if (r.rastreando) {
    if (prefs.esqueleto) esqueleto(ctx, landmarks, tela.width, tela.height);
    if (ref?.pose && prefs.fantasma !== "nenhum") {
      const idx = prefs.fantasma === "usuario"
        ? faseDoUsuario(ref, r.medidas, r.estado, medidasDeFase)
        : indiceDaFase(ref, pacer.fase);
      const cor = prefs.fantasma === "pacer" && pacer.esperando ? AMARELO : BRANCO;
      fantasma(ctx, ref.pose[idx], landmarks, tela.width, tela.height, aspecto,
               cor, 0.5, ref.espelhado);
    }
  }

  // --- HUD ---
    $("fase").textContent = terminou
    ? "SERIE CONCLUIDA"
    : r.rastreando ? r.estado.toUpperCase() : "SEM RASTREIO";
  $("reps").innerHTML = `${r.reps}<small>/${prefs.repsAlvo}</small>`;
  // Mostrar a banda ao lado da medida transforma "nao corrigiu" em dado
  // observavel: da para ver se o valor esta dentro e por quanto.
  const bandas = monitor ? bandasDoEstado(r.estado) : null;
  $("medidas").innerHTML = Object.entries(r.medidas)
    .map(([k, v]) => {
      const b = bandas?.[k];
      if (!b) return `<b>${k}</b>${v.toFixed(1)}`;
      const fora = v > b.maximo + ex.envelope.margem || v < b.minimo - ex.envelope.margem;
      const faixa = `<i>${b.minimo.toFixed(0)}-${b.maximo.toFixed(0)}</i>`;
      return `<b>${k}</b><em class="${fora ? "fora" : ""}">${v.toFixed(1)}</em> ${faixa}`;
    })
    .join("<br>");

  // Guia do movimento. Vertical para exercicio em pe, horizontal para deitado:
  // a barra anda na mesma direcao que o corpo.
  const barra = $("ritmo-barra");
  if (prefs.ritmo === "nenhum" || terminou) {
    barra.style.display = "none";
  } else {
    const vertical = ex.enquadramento === "retrato";
    barra.style.display = "block";
    barra.classList.toggle("vertical", vertical);
    barra.classList.toggle("horizontal", !vertical);
    barra.classList.toggle("parado", !guia.ativo);
    const pos = guia.posicao(agora) * 86; // 86 = 100 menos o tamanho do bloco
    const bloco = barra.firstElementChild               ;
    if (vertical) bloco.style.top = `${pos}%`;
    else bloco.style.left = `${pos}%`;
  }

  if (dt > 0) fpsMed = 0.9 * fpsMed + 0.1 * (1000 / dt);
  $("fps").textContent = `${fpsMed.toFixed(0)} fps`;
}

// ---------------------------------------------------------------------------

$("comecar").addEventListener("click", async () => {
  const botao = $                   ("comecar");
  botao.disabled = true;
  // Navegador so libera audio dentro de um gesto do usuario. Este toque e a
  // unica chance — depois dele nao ha mais interacao ate o fim da serie.
  audio.destravar();
  try {
    await carregarTudo();
    await ligarCamera();
    $("aviso").classList.add("oculto");
    await demonstrar();
    novaSerie();
    requestAnimationFrame(laco);
  } catch (e     ) {
    botao.disabled = false;
    // "could not start video source" quase sempre e outra aba ou outro app
    // segurando a camera — inclusive uma aba antiga DESTA pagina. A mensagem
    // crua nao diz isso, e a pessoa fica procurando defeito no lugar errado.
    const nome = e?.name ?? "";
    $("diag").textContent =
      nome === "NotReadableError" || /video source/i.test(e?.message ?? "")
        ? "A camera esta ocupada. Feche as outras abas do Chrome (e apps de " +
          "camera abertos) e toque de novo."
        : nome === "NotAllowedError"
        ? "Permissao de camera negada. Libere nas configuracoes do site e recarregue."
        : `falhou: ${e?.message ?? e}`;
    console.error(e);
  }
});

// ------------------------------------------------------------ ajustes

function pintarPainel()       {
  ($("p-contagem")                    ).checked = prefs.contagem;
  ($("p-correcoes")                    ).checked = prefs.correcoes;
  ($("p-esqueleto")                    ).checked = prefs.esqueleto;
  ($("p-regressiva")                    ).checked = prefs.regressiva;
  $("p-instrucoes").textContent = {
    antes_e_durante: "antes e durante", so_antes: "so antes", nao: "nao",
  }[prefs.instrucoes];
  $("p-revisao").textContent = prefs.revisao ? "mostrar" : "nao mostrar";
  $("p-demo").textContent = { trecho: "2 repeticoes", completo: "video todo", nao: "nao mostrar" }[prefs.demo];
  $("p-ritmo").textContent = prefs.ritmo;
  $("p-fantasma").textContent = prefs.fantasma;
  $("p-tempo").textContent = `${(prefs.ritmoMs / 1000).toFixed(1)}s`;
  $("p-reps").textContent = String(prefs.repsAlvo);
  $("p-camera").textContent = camera === "user" ? "frontal" : "traseira";
  // Com a troca de exercicio no resumo, a tela inicial precisa dizer qual esta
  // carregado — senao a pessoa toca em comecar sem saber o que vai fazer.
  $("aviso-exercicio").textContent = EXERCICIO.replace(/_/g, " ");
}

function ligarChave(
  id        ,
  chave                                                       ,
)       {
  $(id).addEventListener("change", (e) => {
    prefs[chave] = (e.target                    ).checked;
    salvarPrefs(prefs);
    if (chave === "contagem" || chave === "correcoes") audio.silenciar();
  });
}
ligarChave("p-contagem", "contagem");
ligarChave("p-correcoes", "correcoes");
ligarChave("p-esqueleto", "esqueleto");
ligarChave("p-regressiva", "regressiva");

$("p-instrucoes").addEventListener("click", () => {
  const modos = ["antes_e_durante", "so_antes", "nao"]         ;
  prefs.instrucoes = modos[(modos.indexOf(prefs.instrucoes) + 1) % modos.length];
  salvarPrefs(prefs);
  audio.silenciar();
  pintarPainel();
});

$("p-revisao").addEventListener("click", () => {
  prefs.revisao = !prefs.revisao;
  salvarPrefs(prefs);
  pintarPainel();
});

$("p-demo").addEventListener("click", () => {
  const modos = ["trecho", "completo", "nao"]         ;
  prefs.demo = modos[(modos.indexOf(prefs.demo) + 1) % modos.length];
  salvarPrefs(prefs);
  pintarPainel();
});

$("p-ritmo").addEventListener("click", () => {
  const modos = ["voz", "tique", "nenhum"]         ;
  prefs.ritmo = modos[(modos.indexOf(prefs.ritmo) + 1) % modos.length];
  salvarPrefs(prefs);
  audio.silenciar();
  pintarPainel();
});

$("p-fantasma").addEventListener("click", () => {
  const modos = ["nenhum", "pacer", "usuario"]         ;
  prefs.fantasma = modos[(modos.indexOf(prefs.fantasma) + 1) % modos.length];
  salvarPrefs(prefs);
  pintarPainel();
});

$("p-tempo").addEventListener("click", () => {
  const i = (RITMOS.indexOf(prefs.ritmoMs) + 1) % RITMOS.length;
  prefs.ritmoMs = RITMOS[i];
  salvarPrefs(prefs);
  if (pacer) pacer.tempoRepMs = prefs.ritmoMs;
  pintarPainel();
});

$("p-reps").addEventListener("click", () => {
  const i = (REPS.indexOf(prefs.repsAlvo) + 1) % REPS.length;
  prefs.repsAlvo = REPS[i];
  salvarPrefs(prefs);
  pintarPainel();
});

$("ver-professor").addEventListener("click", () => abrirVideo(false));
$("ver-comparacao").addEventListener("click", () => abrirVideo(true));
$("voltar-resumo").addEventListener("click", fecharVideo);

$("p-camera").addEventListener("click", async () => {
  camera = camera === "user" ? "environment" : "user";
  pintarPainel();
  (video.srcObject                      )?.getTracks().forEach((t) => t.stop());
  await ligarCamera();
  // O aspecto pode mudar entre as cameras, e ele entra no calculo das medidas.
  novaSerie();
});

// Pintar ja na carga: os checkboxes nascem desmarcados no HTML, e as prefs
// vem do localStorage. Sem isto o painel mentiria ate o primeiro toque.
pintarPainel();

/**
 * Saida do modo plano ANTES de comecar.
 *
 * A tela inicial so tem "ligar a camera": aberto sozinho isso esta certo, o app
 * e a propria tela. Vindo de um plano, nao — quem abriu a camera e mudou de
 * ideia (lugar errado, celular sem apoio, alguem entrou na sala) ficava sem
 * caminho de volta a nao ser o botao do sistema, que no WebView do Android nem
 * sempre existe. Volta sem entregar nada: a serie nao aconteceu.
 */
if (RETORNO) {
  const voltar = document.createElement("button");
  voltar.textContent = "voltar ao treino";
  voltar.style.cssText =
    "background:none;border:0;color:#f0f0f2;opacity:.6;font:inherit;" +
    "padding:10px;text-decoration:underline;text-underline-offset:3px";
  voltar.addEventListener("click", () => {
    audio.silenciar();
    location.href = RETORNO;
  });
  $("aviso").append(voltar);
}

$("ajustes-btn").addEventListener("click", () => {
  pintarPainel();
  $("painel").classList.remove("oculto");
});
$("fechar-painel").addEventListener("click", () => {
  $("painel").classList.add("oculto");
});

$("reiniciar").addEventListener("click", () => {
  audio.silenciar();
  novaSerie();
});

// Recarregar em vez de trocar em memoria: exercicio novo significa definicao,
// referencia, video e interpretador novos, e o caminho de boot ja faz tudo
// isso na ordem certa. Reaproveitar sai mais barato e mais seguro que um
// segundo caminho de troca que ninguem exercita.
$("proximo-exercicio").addEventListener("click", () => {
  audio.silenciar();
  const i = (EXERCICIOS.indexOf(EXERCICIO) + 1) % EXERCICIOS.length;
  localStorage.setItem(CHAVE_EXERCICIO, EXERCICIOS[i]);
  location.reload();
});

$("ao-inicio").addEventListener("click", () => {
  audio.silenciar();
  if (RETORNO) {
    entregar();
    return;
  }
  location.reload();
});

$("nova-serie").addEventListener("click", () => {
  cancelAnimationFrame(animRevisao);
  // Sem repetir a demonstracao: quem acabou de fazer dez repeticoes nao
  // precisa reassistir o movimento.
  audio.silenciar();
  novaSerie();
});
