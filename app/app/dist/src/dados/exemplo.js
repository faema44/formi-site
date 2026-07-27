/**
 * Historico de exemplo.
 *
 * Por que existe: um app de treino recem-instalado tem graficos vazios,
 * sequencia zero e nota zero — e a primeira impressao de "Evolucao" vira uma
 * tela em branco justamente na hora em que o usuario esta decidindo se fica. O
 * exemplo enche cinco semanas com dados plausiveis e MARCADOS como exemplo, e o
 * perfil traz um botao para apaga-lo assim que o primeiro treino de verdade
 * acontecer.
 *
 * A qualidade sobe ao longo das cinco semanas de proposito: e o que acontece de
 * verdade quando alguem repete um movimento com correcao, e e a historia que a
 * tela de evolucao precisa saber contar.
 */

                                                
                                               
import { dataISO, somarDias } from "./progresso.js";

const DIAS = 35;

export function historicoDeExemplo(plano       , hoje = new Date())   
               
                        
  {
  const sorteio = semear(0x50524f47);
  const historico             = [];

  for (let i = DIAS; i >= 1; i--) {
    const d = somarDias(hoje, -i);
    const sessao = plano.sessoes.find((s) => s.diaSemana === d.getDay());
    if (!sessao) continue;

    // As duas ultimas semanas sao limpas: e o que sustenta a sequencia que a
    // tela inicial mostra. Antes disso ha falhas, senao o grafico de aderencia
    // e uma linha reta e nao ensina nada.
    if (i > 13 && sorteio() > 0.78) continue;

    const progresso = (DIAS - i) / DIAS;
    const qualidade = Math.round(
      Math.min(98, Math.max(55, 66 + progresso * 22 + (sorteio() - 0.5) * 9)),
    );

    historico.push({
      data: dataISO(d),
      sessaoId: sessao.id,
      nome: sessao.nome,
      foco: sessao.foco,
      duracaoMin: Math.round(sessao.duracaoMin * (0.9 + sorteio() * 0.2)),
      reps: repsDaSessao(sessao),
      indiceQualidade: qualidade,
      musculos: distribuir(sessao, "musculos"),
      categorias: distribuir(sessao, "categorias"),
      exemplo: true,
    });
  }

  // O plano precisa ser tao antigo quanto o historico: `sequencia()` para de
  // contar na data de criacao, e um plano criado hoje zeraria tudo que acabamos
  // de gerar.
  return {
    plano: { ...plano, criadoEm: somarDias(hoje, -DIAS).toISOString() },
    historico,
  };
}

function repsDaSessao(sessao        )         {
  return sessao.itens.reduce((total, i) => {
    const porSerie = i.unidade === "reps" ? i.dose : Math.round(i.dose / 3);
    return total + i.series * porSerie;
  }, 0);
}

function distribuir(sessao        , campo                           )                         {
  const saida                         = {};
  for (const item of sessao.itens) {
    const porSerie = item.unidade === "reps" ? item.dose : Math.round(item.dose / 3);
    const reps = item.series * porSerie;
    const chaves = campo === "musculos" ? item.musculos : [item.categoria];
    if (!chaves.length) continue;
    // Uma repeticao de agachamento nao e uma repeticao de quadriceps MAIS uma de
    // gluteo: e uma so, dividida. Somar inteiro em cada grupo inflaria o total
    // em tres ou quatro vezes e o grafico de volume mentiria.
    const fatia = reps / chaves.length;
    for (const k of chaves) saida[k] = Math.round((saida[k] ?? 0) + fatia);
  }
  return saida;
}

function semear(semente        )               {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
