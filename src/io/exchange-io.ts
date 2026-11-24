import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExchangeRates } from "../domain/exchange.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Carrega e valida arquivo externo de taxas de cambio (ex: cambio.json).
 */
export function lerTabelaCambio(caminhoArquivo: string): ExchangeRates {
  const caminhoAbsoluto = resolve(caminhoArquivo);
  const raw = JSON.parse(readFileSync(caminhoAbsoluto, "utf-8")) as unknown;
  if (!isRecord(raw)) {
    throw new Error("Arquivo de cambio deve conter um objeto JSON na raiz.");
  }

  const moedaBase =
    typeof raw.moeda_base === "string" && raw.moeda_base.trim().length > 0
      ? raw.moeda_base.trim().toUpperCase()
      : "BRL";

  if (!isRecord(raw.taxas)) {
    throw new Error("Campo obrigatorio 'taxas' no arquivo de cambio deve ser um objeto.");
  }

  const taxas: Record<string, Record<string, number>> = {};
  for (const [data, moedas] of Object.entries(raw.taxas)) {
    if (!isRecord(moedas)) {
      throw new Error(`Entrada 'taxas.${data}' no arquivo de cambio deve ser um objeto.`);
    }
    const mapaDia: Record<string, number> = {};
    for (const [codigo, valor] of Object.entries(moedas)) {
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
        throw new Error(
          `Cotacao 'taxas.${data}.${codigo}' deve ser um numero positivo.`
        );
      }
      mapaDia[codigo.trim().toUpperCase()] = valor;
    }
    taxas[data.trim()] = mapaDia;
  }

  return {
    moedaBase,
    taxas,
  };
}
