import type { Cents } from "./types.js";

/**
 * Converte um valor monetario decimal para centavos inteiros utilizando
 * arredondamento Half-Up (meio para cima, afastando-se de zero).
 * Exemplo: 33.333 -> 3333, 33.335 -> 3334, -45.005 -> -4501
 */
export function toCentsHalfUp(valor: number): Cents {
  if (!Number.isFinite(valor)) {
    throw new Error(`Valor monetario invalido: ${String(valor)}`);
  }
  if (valor === 0) {
    return 0;
  }
  const sign = valor < 0 ? -1 : 1;
  const abs = Math.abs(valor);
  // Notacao exponencial evita erro de representacao binaria em casos como 1.005 * 100
  const scaled = Number(`${abs}e2`);
  const rounded = Math.floor(scaled + 0.5 + 1e-12);
  return sign * rounded;
}

/**
 * Converte centavos inteiros de volta para valor decimal com 2 casas.
 */
export function fromCents(cents: Cents): number {
  if (cents === 0) {
    return 0;
  }
  return Number((cents / 100).toFixed(2));
}

/**
 * Formata centavos inteiros como string "R$ XX.XX" para mensagens de justificativa.
 */
export function formatBRL(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}R$ ${(abs / 100).toFixed(2)}`;
}
