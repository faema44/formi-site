/**
 * Avaliador de expressoes das definicoes de exercicio.
 *
 * Porte de fitcam/expressao.py. A implementacao Python e NORMATIVA: qualquer
 * divergencia de comportamento aqui e bug daqui, e a suite de conformidade
 * existe para provar que nao ha nenhuma.
 *
 * NAO usa eval(). A gramatica e deliberadamente pequena para caber tambem no
 * firmware em C (~250 linhas).
 *
 *     expr    := ou
 *     ou      := e ( ("ou"|"or"|"||") e )*
 *     e       := nao ( ("e"|"and"|"&&") nao )*
 *     nao     := ("nao"|"not"|"!") nao | comparacao
 *     comp    := soma ( ("<"|"<="|">"|">="|"=="|"!=") soma )?
 *     soma    := termo ( ("+"|"-") termo )*
 *     termo   := unario ( ("*"|"/") unario )*
 *     unario  := "-" unario | primario
 *     prim    := NUMERO | IDENT | IDENT "(" args ")" | "(" expr ")"
 */

                                              

export class ErroExpressao extends Error {
  constructor(mensagem        ) {
    super(mensagem);
    this.name = "ErroExpressao";
  }
}

const PALAVRAS_OU = new Set(["ou", "or"]);
const PALAVRAS_E = new Set(["e", "and"]);
const PALAVRAS_NAO = new Set(["nao", "not"]);

                                                   

                 
                  
                                
              
 

// Ordem importa: os operadores de dois caracteres vem antes dos de um.
const PADRAO = /\s*(?:(\d+\.?\d*)|([A-Za-z_][A-Za-z_0-9]*)|(<=|>=|==|!=|&&|\|\||[<>+\-*/(),!]))/y;

function tokenizar(texto        )          {
  const tokens          = [];
  let pos = 0;
  while (pos < texto.length) {
    PADRAO.lastIndex = pos;
    const m = PADRAO.exec(texto);
    if (!m || PADRAO.lastIndex === pos) {
      if (texto.slice(pos).trim() === "") break;
      throw new ErroExpressao(
        `caractere inesperado em ${pos}: ${JSON.stringify(texto.slice(pos, pos + 12))}`,
      );
    }
    const inicio = pos + (m[0].length - m[0].trimStart().length);
    pos = PADRAO.lastIndex;
    if (m[1] !== undefined) tokens.push({ tipo: "numero", valor: parseFloat(m[1]), pos: inicio });
    else if (m[2] !== undefined) tokens.push({ tipo: "ident", valor: m[2], pos: inicio });
    else tokens.push({ tipo: "op", valor: m[3], pos: inicio });
  }
  tokens.push({ tipo: "fim", valor: null, pos: texto.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

                     
                                 
                                 
 

class Literal               {
                   valor        ;
  constructor(valor        ) {
    this.valor = valor;
  }
  avaliar()         {
    return this.valor;
  }
  identificadores()              {
    return new Set();
  }
}

class Referencia               {
           nome        ;
  constructor(nome        ) {
    this.nome = nome;
  }
  avaliar(ctx          )         {
    const v = ctx[this.nome];
    if (v === undefined) throw new ErroExpressao(`medida desconhecida: '${this.nome}'`);
    if (v === null || Number.isNaN(v)) {
      throw new ErroExpressao(`medida sem valor: '${this.nome}'`);
    }
    return v;
  }
  identificadores()              {
    return new Set([this.nome]);
  }
}

class Unario               {
                   op        ;
                   filho    ;
  constructor(op        , filho    ) {
    this.op = op;
    this.filho = filho;
  }
  avaliar(ctx          )         {
    const v = this.filho.avaliar(ctx);
    if (this.op === "-") return -v;
    return v ? 0 : 1; // negacao logica
  }
  identificadores()              {
    return this.filho.identificadores();
  }
}

class Binario               {
                   op        ;
                   esq    ;
                   dir    ;

  constructor(op        , esq    , dir    ) {
    this.op = op;
    this.esq = esq;
    this.dir = dir;
  }

  avaliar(ctx          )         {
    // Curto-circuito, igual ao Python.
    if (this.op === "e") {
      return this.esq.avaliar(ctx) && this.dir.avaliar(ctx) ? 1 : 0;
    }
    if (this.op === "ou") {
      return this.esq.avaliar(ctx) || this.dir.avaliar(ctx) ? 1 : 0;
    }
    const a = this.esq.avaliar(ctx);
    const b = this.dir.avaliar(ctx);
    switch (this.op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/":
        if (b === 0) throw new ErroExpressao("divisao por zero");
        return a / b;
      case "<": return a < b ? 1 : 0;
      case "<=": return a <= b ? 1 : 0;
      case ">": return a > b ? 1 : 0;
      case ">=": return a >= b ? 1 : 0;
      // Igualdade com tolerancia: comparar float exato em threshold de
      // exercicio e pedir para o jitter decidir.
      case "==": return Math.abs(a - b) < 1e-9 ? 1 : 0;
      case "!=": return Math.abs(a - b) >= 1e-9 ? 1 : 0;
      default: throw new ErroExpressao(`operador desconhecido: ${this.op}`);
    }
  }

  identificadores()              {
    return new Set([...this.esq.identificadores(), ...this.dir.identificadores()]);
  }
}

const FUNCOES                                                                      = {
  abs: { aridade: 1, fn: (a) => Math.abs(a) },
  min: { aridade: 2, fn: (a, b) => Math.min(a, b) },
  max: { aridade: 2, fn: (a, b) => Math.max(a, b) },
};

class Chamada               {
                   nome        ;
                   args      ;
  constructor(nome        , args      ) {
    this.nome = nome;
    this.args = args;
  }
  avaliar(ctx          )         {
    const f = FUNCOES[this.nome];
    if (this.args.length !== f.aridade) {
      throw new ErroExpressao(
        `funcao ${this.nome} espera ${f.aridade} argumento(s), recebeu ${this.args.length}`,
      );
    }
    return f.fn(...this.args.map((a) => a.avaliar(ctx)));
  }
  identificadores()              {
    const ids = new Set        ();
    for (const a of this.args) for (const i of a.identificadores()) ids.add(i);
    return ids;
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
          i = 0;
                   tokens         ;
  constructor(tokens         ) {
    this.tokens = tokens;
  }

          get atual()        {
    return this.tokens[this.i];
  }

          consumir()        {
    return this.tokens[this.i++];
  }

          eOp(...valores          )          {
    const t = this.atual;
    return t.tipo === "op" && valores.includes(t.valor          );
  }

          ePalavra(palavras             )          {
    const t = this.atual;
    return t.tipo === "ident" && palavras.has((t.valor          ).toLowerCase());
  }

  analisar()     {
    const no = this.ou();
    if (this.atual.tipo !== "fim") {
      throw new ErroExpressao(
        `token inesperado em ${this.atual.pos}: '${this.atual.valor}'`,
      );
    }
    return no;
  }

          ou()     {
    let no = this.e();
    while (this.ePalavra(PALAVRAS_OU) || this.eOp("||")) {
      this.consumir();
      no = new Binario("ou", no, this.e());
    }
    return no;
  }

          e()     {
    let no = this.nao();
    while (this.ePalavra(PALAVRAS_E) || this.eOp("&&")) {
      this.consumir();
      no = new Binario("e", no, this.nao());
    }
    return no;
  }

          nao()     {
    if (this.ePalavra(PALAVRAS_NAO) || this.eOp("!")) {
      this.consumir();
      return new Unario("!", this.nao());
    }
    return this.comparacao();
  }

          comparacao()     {
    let no = this.soma();
    if (this.eOp("<", "<=", ">", ">=", "==", "!=")) {
      const op = this.consumir().valor          ;
      no = new Binario(op, no, this.soma());
    }
    return no;
  }

          soma()     {
    let no = this.termo();
    while (this.eOp("+", "-")) {
      const op = this.consumir().valor          ;
      no = new Binario(op, no, this.termo());
    }
    return no;
  }

          termo()     {
    let no = this.unario();
    while (this.eOp("*", "/")) {
      const op = this.consumir().valor          ;
      no = new Binario(op, no, this.unario());
    }
    return no;
  }

          unario()     {
    if (this.eOp("-")) {
      this.consumir();
      return new Unario("-", this.unario());
    }
    return this.primario();
  }

          primario()     {
    const t = this.atual;
    if (t.tipo === "numero") {
      this.consumir();
      return new Literal(t.valor          );
    }
    if (t.tipo === "ident") {
      const nome = t.valor          ;
      const baixo = nome.toLowerCase();
      if (PALAVRAS_OU.has(baixo) || PALAVRAS_E.has(baixo) || PALAVRAS_NAO.has(baixo)) {
        throw new ErroExpressao(`palavra reservada em posicao invalida: '${nome}'`);
      }
      this.consumir();
      if (this.eOp("(")) {
        this.consumir();
        const args       = [];
        if (!this.eOp(")")) {
          args.push(this.ou());
          while (this.eOp(",")) {
            this.consumir();
            args.push(this.ou());
          }
        }
        if (!this.eOp(")")) throw new ErroExpressao("faltou ')' na chamada de funcao");
        this.consumir();
        if (!(nome in FUNCOES)) throw new ErroExpressao(`funcao desconhecida: '${nome}'`);
        return new Chamada(nome, args);
      }
      return new Referencia(nome);
    }
    if (this.eOp("(")) {
      this.consumir();
      const no = this.ou();
      if (!this.eOp(")")) throw new ErroExpressao("faltou ')'");
      this.consumir();
      return no;
    }
    throw new ErroExpressao(`expressao invalida em ${t.pos}: '${t.valor}'`);
  }
}

/** Compila uma expressao textual numa arvore avaliavel. */
export function compilar(texto        )     {
  if (typeof texto !== "string" || texto.trim() === "") {
    throw new ErroExpressao("expressao vazia");
  }
  return new Parser(tokenizar(texto)).analisar();
}

/** Atalho: compila e avalia como booleano. Use compilar() no laco quente. */
export function avaliar(texto        , ctx          )          {
  return Boolean(compilar(texto).avaliar(ctx));
}
