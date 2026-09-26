/**
 * Money is written with a comma between every three digits everywhere in the app — 1,500,000đ —
 * in what is shown and in what is typed. Reading stays lenient (see parseNumber in ./sheet):
 * 1,500,000 · 1.500.000 · 1500000 · 50k · 1,5tr all still read correctly.
 */
export const groupThousands = (n: number): string => Math.round(n).toLocaleString('en-US');

export const formatVND = (n: number): string => `${groupThousands(n)}đ`;

/** Compact form for chart ticks and tight tiles: 350k, 1.2tr, 2.5 tỷ (a dot for the decimal, since commas group). */
export const formatVNDShort = (n: number): string => {
  const abs = Math.abs(n);
  const trim = (x: number) => x.toFixed(x < 10 ? 1 : 0).replace(/\.0$/, '');
  if (abs >= 1e9) return `${trim(n / 1e9)} tỷ`;
  if (abs >= 1e6) return `${trim(n / 1e6)}tr`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}k`;
  return `${Math.round(n)}đ`;
};

/** For an input that only takes digits: what the person typed, regrouped with commas as they type. */
export const digitsToGrouped = (typed: string): { value: number; text: string } => {
  const digits = typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const value = digits ? Number(digits) : 0;
  return { value, text: digits ? groupThousands(value) : '' };
};
