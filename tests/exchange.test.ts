import { describe, expect, it } from "vitest";
import {
  converterParaBrlCents,
  normalizarMoeda,
  resolverTaxaCambio,
  type ExchangeRates,
} from "../src/domain/exchange.js";

const CAMBIO_JULHO: ExchangeRates = {
  moedaBase: "BRL",
  taxas: {
    "2026-07-14": { USD: 5.44, EUR: 5.93 },
    "2026-07-15": { USD: 5.39, EUR: 5.88 },
    "2026-07-17": { USD: 5.47, EUR: 5.96 },
    "2026-07-20": { USD: 5.5, EUR: 6.01 },
    "2026-07-21": { USD: 5.48, EUR: 5.99 },
  },
};

describe("[T-009] Modulo de conversao cambial (RN-012 / AMB-014 / AMB-015)", () => {
  it("[RN-012] assume BRL (taxa 1) quando moeda e ausente ou BRL mesmo sem tabela externa", () => {
    expect(normalizarMoeda(undefined)).toBe("BRL");
    expect(normalizarMoeda(" eur ")).toBe("EUR");

    expect(resolverTaxaCambio("2026-07-14", undefined)).toEqual({
      moeda: "BRL",
      taxa: 1,
      dataCotacao: "2026-07-14",
      usouFallback: false,
    });
  });

  it("[RN-012] converte EUR e USD na data exata de dia util (e-002 e e-003)", () => {
    const resEur = resolverTaxaCambio("2026-07-14", "EUR", CAMBIO_JULHO);
    expect(resEur).toEqual({
      moeda: "EUR",
      taxa: 5.93,
      dataCotacao: "2026-07-14",
      usouFallback: false,
    });
    expect(converterParaBrlCents(22.0, resEur!.taxa)).toBe(13046); // R$ 130,46

    const resEur2 = resolverTaxaCambio("2026-07-15", "EUR", CAMBIO_JULHO);
    expect(converterParaBrlCents(14.5, resEur2!.taxa)).toBe(8526); // R$ 85,26
  });

  it("[RN-012][AMB-014] faz fallback para o ultimo dia util anterior em fim de semana (e-004: sabado 2026-07-18 -> sexta 2026-07-17)", () => {
    const res = resolverTaxaCambio("2026-07-18", "EUR", CAMBIO_JULHO);
    expect(res).toEqual({
      moeda: "EUR",
      taxa: 5.96,
      dataCotacao: "2026-07-17",
      usouFallback: true,
    });
    expect(converterParaBrlCents(30.0, res!.taxa)).toBe(17880); // R$ 178,80
  });

  it("[RN-012][AMB-015] retorna null para moeda sem cotacao (e-006: GBP) ou data anterior a tabela", () => {
    expect(resolverTaxaCambio("2026-07-21", "GBP", CAMBIO_JULHO)).toBeNull();
    expect(resolverTaxaCambio("2026-07-01", "USD", CAMBIO_JULHO)).toBeNull();
    expect(resolverTaxaCambio("2026-07-14", "EUR", undefined)).toBeNull();
  });
});
