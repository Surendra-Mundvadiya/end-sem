/*
 * Safe arithmetic for Memory Lab formulas (no eval). Grammar:
 *   expr   = term (("+" | "-") term)*
 *   term   = unary (("*" | "/") unary)*
 *   unary  = "-" unary | power           so -2^2 = -4
 *   power  = primary ("^" unary)?        right-associative, allows 2^-1
 *   primary = number | name | name "(" expr ("," expr)* ")" | "(" expr ")"
 * Functions: min, max, abs, round, sqrt, ln, exp. Variables are plain names (letters, digits, _).
 */

export type FormulaVars = Record<string, number>

type Token = { kind: 'num'; value: number } | { kind: 'name'; value: string } | { kind: 'op'; value: string }

type Node =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'neg'; arg: Node }
  | { type: 'bin'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] }

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  sqrt: Math.sqrt,
  ln: Math.log,
  exp: Math.exp,
}

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(src.slice(i))
      if (!m) throw new Error(`Bad number at ${i}`)
      out.push({ kind: 'num', value: Number(m[0]) })
      i += m[0].length
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!
      out.push({ kind: 'name', value: m[0] })
      i += m[0].length
    } else if ('+-*/^(),'.includes(c)) {
      out.push({ kind: 'op', value: c })
      i++
    } else {
      throw new Error(`Unexpected "${c}" at ${i}`)
    }
  }
  return out
}

function parse(src: string): Node {
  const toks = tokenize(src)
  let pos = 0
  const peek = () => toks[pos]
  const isOp = (v: string) => peek()?.kind === 'op' && peek()?.value === v
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected "${v}"`)
    pos++
  }
  function expr(): Node {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = (toks[pos++] as Token).value as string
      left = { type: 'bin', op, left, right: term() }
    }
    return left
  }
  function term(): Node {
    let left = unary()
    while (isOp('*') || isOp('/')) {
      const op = (toks[pos++] as Token).value as string
      left = { type: 'bin', op, left, right: unary() }
    }
    return left
  }
  function power(): Node {
    const base = primary()
    if (isOp('^')) {
      pos++
      return { type: 'bin', op: '^', left: base, right: unary() }
    }
    return base
  }
  function unary(): Node {
    if (isOp('-')) {
      pos++
      return { type: 'neg', arg: unary() }
    }
    if (isOp('+')) {
      pos++
      return unary()
    }
    return power()
  }
  function primary(): Node {
    const t = peek()
    if (!t) throw new Error('Unexpected end of formula')
    if (t.kind === 'num') {
      pos++
      return { type: 'num', value: t.value }
    }
    if (t.kind === 'name') {
      pos++
      if (isOp('(')) {
        pos++
        if (!(t.value in FUNCTIONS)) throw new Error(`Unknown function ${t.value}`)
        const args = [expr()]
        while (isOp(',')) {
          pos++
          args.push(expr())
        }
        expect(')')
        return { type: 'call', name: t.value, args }
      }
      return { type: 'var', name: t.value }
    }
    if (isOp('(')) {
      pos++
      const inner = expr()
      expect(')')
      return inner
    }
    throw new Error(`Unexpected "${t.value}"`)
  }
  const tree = expr()
  if (pos < toks.length) throw new Error(`Unexpected "${String(toks[pos].value)}"`)
  return tree
}

function run(node: Node, vars: FormulaVars): number {
  switch (node.type) {
    case 'num':
      return node.value
    case 'var': {
      const v = vars[node.name]
      if (typeof v !== 'number') throw new Error(`Missing value for ${node.name}`)
      return v
    }
    case 'neg':
      return -run(node.arg, vars)
    case 'call':
      return FUNCTIONS[node.name](...node.args.map((a) => run(a, vars)))
    case 'bin': {
      const a = run(node.left, vars)
      const b = run(node.right, vars)
      if (node.op === '+') return a + b
      if (node.op === '-') return a - b
      if (node.op === '*') return a * b
      if (node.op === '/') return a / b
      return a ** b
    }
  }
}

function collect(node: Node, acc: Set<string>) {
  if (node.type === 'var') acc.add(node.name)
  else if (node.type === 'neg') collect(node.arg, acc)
  else if (node.type === 'bin') {
    collect(node.left, acc)
    collect(node.right, acc)
  } else if (node.type === 'call') node.args.forEach((a) => collect(a, acc))
}

export interface CompiledFormula {
  variables: string[]
  evaluate: (vars: FormulaVars) => number
}

/** Parses once; throws a readable Error on a syntax problem. */
export function compileFormula(src: string): CompiledFormula {
  const tree = parse(src)
  const names = new Set<string>()
  collect(tree, names)
  return { variables: [...names], evaluate: (vars) => run(tree, vars) }
}

export function evaluateFormula(src: string, vars: FormulaVars): number {
  return compileFormula(src).evaluate(vars)
}
