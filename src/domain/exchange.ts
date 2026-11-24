import { toCentsHalfUp } from "./money.js";
import type { Cents } from "./types.js";

export interface ExchangeRates {
  moedaBase: string;
  taxas: Record<string, Record<string, number>>;
}

export interface ResultadoTaxaCambio {
  moeda: string;
  taxa: number;
  dataCotacao: string;
  usouFallback: boolean;
}

export function normalizarMoeda(moeda?: string): string {
  if (!moeda || moeda.trim().length === 0) {
    return "BRL";
  }
  return moeda.trim().toUpperCase();
}

/**
 * Resolve a taxa de cambio para (data, moeda) conforme RN-012 / AMB-014 / AMB-015:
 * - Moeda base ("BRL"): retorna taxa 1 sem precisar de tabela externa.
 * - Moeda estrangeira: busca cotacao na data exata; se nao existir (ex: fim de semana),
 *   usa a maior data ISO-8601 <= data disponivel na tabela (ultimo dia util anterior).
 * - Retorna null se nao houver tabela, data anterior ou cotacao para a moeda solicitada.
 */
export function resolverTaxaCambio(
  data: string,
  moedaRaw: string | undefined,
  exchange?: ExchangeRates
): ResultadoTaxaCambio | null {
  const moeda = normalizarMoeda(moedaRaw);
  const dataLimpa = data.trim();

  if (moeda === "BRL") {
    return {
      moeda: "BRL",
      taxa: 1,
      dataCotacao: dataLimpa,
      usouFallback: false,
    };
  }

  if (!exchange) {
    return null;
  }

  const base = normalizarMoeda(exchange.moedaBase);
  if (moeda === base) {
    return {
      moeda,
      taxa: 1,
      dataCotacao: dataLimpa,
      usouFallback: false,
    };
  }

  // Encontra data exata ou maior data <= dataLimpa (lexicografica ISO-8601)
  const datasDisponiveis = Object.keys(exchange.taxas).sort();
  let dataSelecionada: string | null = null;
  for (const d of datasDisponiveis) {
    if (d <= dataLimpa) {
      dataSelecionada = d;
    } else {
      break;
    }
  }

  if (dataSelecionada === null) {
    return null;
  }

  const cotacoesDoDia = exchange.taxas[dataSelecionada];
  const taxa = cotacoesDoDia?.[moeda];
  if (typeof taxa !== "number" || !Number.isFinite(taxa) || taxa <= 0) {
    return null;
  }

  return {
    moeda,
    taxa,
    dataCotacao: dataSelecionada,
    usouFallback: dataSelecionada !== dataLimpa,
  };
}

/**
 * Converte valor na moeda original para centavos de BRL com arredondamento Half-Up (RN-010 / RN-012).
 */
export function converterParaBrlCents(valorOriginal: number, taxa: number): Cents {
  if (taxa === 1) {
    return toCentsHalfUp(valorOriginal);
  }
  return toCentsHalfUp(valorOriginal * taxa);
}
