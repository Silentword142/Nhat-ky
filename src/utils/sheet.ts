/**
 * Tiny spreadsheet engine for the plan tables: A1 references, ranges (B2:B9), + - * / ^,
 * comparisons, and SUM / AVERAGE / MIN / MAX / COUNT / ROUND / ABS / IF.
 * Cells are plain strings; a cell starting with "=" is a formula.
 */

export type CellValue = number | string;

export const ERR_SYNTAX = '#LỖI';
export const ERR_CYCLE = '#VÒNG';
export const ERR_DIV0 = '#DIV/0!';
export const ERR_VALUE = '#GIÁ TRỊ';
export const ERR_REF = '#REF!';

export const isErrorValue = (v: CellValue | null | undefined): boolean => typeof v === 'string' && v.startsWith('#');

export const colName = (i: number): string => {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const colIndex = (letters: string): number => {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Accepts 1500000, 1.500.000, 1.500.000đ, 1,5, 2 500 000 — returns null for anything else. */
export const parseNumber = (raw: string): number | null => {
  let s = raw.trim().replace(/[đ₫]|vnd|vnđ/gi, '').replace(/\s/g, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
};

// Commas group thousands (1,500,000) and a dot marks decimals (1.5), matching money everywhere else.
export const formatNumber = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; c: number; r: number }
  | { t: 'range'; c1: number; r1: number; c2: number; r2: number }
  | { t: 'fn'; v: string }
  | { t: 'op'; v: string };

const tokenize = (src: string): Token[] | null => {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)/))) {
      out.push({ t: 'range', c1: colIndex(m[1].toUpperCase()), r1: Number(m[2]) - 1, c2: colIndex(m[3].toUpperCase()), r2: Number(m[4]) - 1 });
      i += m[0].length;
    } else if ((m = rest.match(/^([A-Za-z]+)(\d+)(?![\w(])/))) {
      out.push({ t: 'ref', c: colIndex(m[1].toUpperCase()), r: Number(m[2]) - 1 });
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Za-z_]+(?=\()/))) {
      out.push({ t: 'fn', v: m[0].toUpperCase() });
      i += m[0].length;
    } else if ((m = rest.match(/^\d+(\.\d+)?/))) {
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if ((m = rest.match(/^"([^"]*)"/))) {
      out.push({ t: 'str', v: m[1] });
      i += m[0].length;
    } else if ((m = rest.match(/^(<=|>=|<>|[+\-*/^()<>=,;%])/))) {
      out.push({ t: 'op', v: m[0] === ';' ? ',' : m[0] });
      i += m[0].length;
    } else {
      return null;
    }
  }
  return out;
};

class FormulaError extends Error {}

type Node = CellValue | CellValue[];

export const evaluateSheet = (rows: string[][]): CellValue[][] => {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();

  const getCell = (r: number, c: number): CellValue => {
    if (r < 0 || c < 0 || r >= rows.length || c >= (rows[r]?.length ?? 0)) return ERR_REF;
    const key = `${r},${c}`;
    if (cache.has(key)) return cache.get(key)!;
    if (visiting.has(key)) return ERR_CYCLE;
    visiting.add(key);
    const raw = rows[r][c] ?? '';
    let value: CellValue;
    if (raw.trim().startsWith('=')) value = evalFormula(raw.trim().slice(1));
    else {
      const n = parseNumber(raw);
      value = n !== null ? n : raw;
    }
    visiting.delete(key);
    cache.set(key, value);
    return value;
  };

  const evalFormula = (src: string): CellValue => {
    const tokens = tokenize(src);
    if (!tokens || tokens.length === 0) return ERR_SYNTAX;
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;

    const toNum = (n: Node): number => {
      if (Array.isArray(n)) throw new FormulaError(ERR_VALUE);
      if (typeof n === 'number') return n;
      if (n.startsWith('#')) throw new FormulaError(n);
      if (n.trim() === '') return 0;
      const p = parseNumber(n);
      if (p === null) throw new FormulaError(ERR_VALUE);
      return p;
    };
    const flatten = (args: Node[]): CellValue[] => args.flatMap((a) => (Array.isArray(a) ? a : [a]));
    const numbersOf = (args: Node[]): number[] => {
      const nums: number[] = [];
      for (const v of flatten(args)) {
        if (typeof v === 'string' && v.startsWith('#')) throw new FormulaError(v);
        if (typeof v === 'number') nums.push(v);
      }
      return nums;
    };

    const callFn = (name: string, args: Node[]): CellValue => {
      switch (name) {
        case 'SUM':
        case 'TONG':
          return numbersOf(args).reduce((a, b) => a + b, 0);
        case 'AVERAGE':
        case 'TRUNGBINH': {
          const n = numbersOf(args);
          if (!n.length) throw new FormulaError(ERR_DIV0);
          return n.reduce((a, b) => a + b, 0) / n.length;
        }
        case 'MIN':
          return numbersOf(args).length ? Math.min(...numbersOf(args)) : 0;
        case 'MAX':
          return numbersOf(args).length ? Math.max(...numbersOf(args)) : 0;
        case 'COUNT':
          return numbersOf(args).length;
        case 'PRODUCT':
          return numbersOf(args).reduce((a, b) => a * b, 1);
        case 'ABS':
          return Math.abs(toNum(args[0]));
        case 'ROUND': {
          const f = Math.pow(10, args[1] !== undefined ? toNum(args[1]) : 0);
          return Math.round(toNum(args[0]) * f) / f;
        }
        case 'IF': {
          const cond = args[0];
          const truthy = typeof cond === 'number' ? cond !== 0 : Array.isArray(cond) ? false : cond !== '';
          return (truthy ? args[1] : args[2]) as CellValue ?? '';
        }
        default:
          throw new FormulaError(ERR_SYNTAX);
      }
    };

    const parseComparison = (): Node => {
      let left = parseAdditive();
      while (peek()?.t === 'op' && ['<', '>', '<=', '>=', '=', '<>'].includes((peek() as { v: string }).v)) {
        const op = (tokens[pos++] as { v: string }).v;
        const right = parseAdditive();
        const a = Array.isArray(left) ? 0 : left;
        const b = Array.isArray(right) ? 0 : right;
        const bothNum = typeof a === 'number' && typeof b === 'number';
        const x = bothNum ? (a as number) : String(a);
        const y = bothNum ? (b as number) : String(b);
        const res = op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : op === '>=' ? x >= y : op === '=' ? x === y : x !== y;
        left = res ? 1 : 0;
      }
      return left;
    };
    const parseAdditive = (): Node => {
      let left = parseTerm();
      while (isOp('+') || isOp('-')) {
        const op = (tokens[pos++] as { v: string }).v;
        const right = parseTerm();
        left = op === '+' ? toNum(left) + toNum(right) : toNum(left) - toNum(right);
      }
      return left;
    };
    const parseTerm = (): Node => {
      let left = parsePower();
      while (isOp('*') || isOp('/')) {
        const op = (tokens[pos++] as { v: string }).v;
        const right = parsePower();
        if (op === '*') left = toNum(left) * toNum(right);
        else {
          const d = toNum(right);
          if (d === 0) throw new FormulaError(ERR_DIV0);
          left = toNum(left) / d;
        }
      }
      return left;
    };
    const parsePower = (): Node => {
      const base = parseUnary();
      if (isOp('^')) {
        pos++;
        return Math.pow(toNum(base), toNum(parsePower()));
      }
      return base;
    };
    const parseUnary = (): Node => {
      if (isOp('-')) {
        pos++;
        return -toNum(parseUnary());
      }
      if (isOp('+')) {
        pos++;
        return parseUnary();
      }
      let v = parsePrimary();
      while (isOp('%')) {
        pos++;
        v = toNum(v) / 100;
      }
      return v;
    };
    const parsePrimary = (): Node => {
      const tok = tokens[pos++];
      if (!tok) throw new FormulaError(ERR_SYNTAX);
      switch (tok.t) {
        case 'num':
          return tok.v;
        case 'str':
          return tok.v;
        case 'ref':
          return getCell(tok.r, tok.c);
        case 'range': {
          const vals: CellValue[] = [];
          for (let r = Math.min(tok.r1, tok.r2); r <= Math.max(tok.r1, tok.r2); r++)
            for (let c = Math.min(tok.c1, tok.c2); c <= Math.max(tok.c1, tok.c2); c++) vals.push(getCell(r, c));
          return vals;
        }
        case 'fn': {
          if (!isOp('(')) throw new FormulaError(ERR_SYNTAX);
          pos++;
          const args: Node[] = [];
          if (!isOp(')')) {
            args.push(parseComparison());
            while (isOp(',')) {
              pos++;
              args.push(parseComparison());
            }
          }
          if (!isOp(')')) throw new FormulaError(ERR_SYNTAX);
          pos++;
          return callFn(tok.v, args);
        }
        case 'op':
          if (tok.v === '(') {
            const v = parseComparison();
            if (!isOp(')')) throw new FormulaError(ERR_SYNTAX);
            pos++;
            return v;
          }
          throw new FormulaError(ERR_SYNTAX);
      }
    };

    try {
      const result = parseComparison();
      if (pos < tokens.length) return ERR_SYNTAX;
      if (Array.isArray(result)) return ERR_VALUE;
      return result;
    } catch (e) {
      return e instanceof FormulaError ? e.message : ERR_SYNTAX;
    }
  };

  return rows.map((row, r) => row.map((_, c) => getCell(r, c)));
};

export const displayValue = (v: CellValue): string => (typeof v === 'number' ? formatNumber(v) : v);
