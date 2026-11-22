/**
 * Numeri come si scrivono in italiano: virgola decimale (7,47 · 39,6 °C · 0,18 mEq/kg/h).
 * `d` = cifre decimali fisse; senza `d` si mostrano quelle che servono.
 */
export function num(n: number, d?: number): string {
  return d === undefined
    ? n.toLocaleString('it-IT', { maximumFractionDigits: 3, useGrouping: false })
    : n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });
}
