import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_ELEGIVEIS,
  DEFAULT_POLICY,
  isCategoriaElegivel,
  obterLimiteDiarioCents,
} from "../src/domain/policy.js";

describe("[T-001] Configuracao declarativa da politica de reembolso", () => {
  it("[RN-001] reconhece apenas alimentacao, transporte_urbano e hospedagem como elegiveis", () => {
    expect(CATEGORIAS_ELEGIVEIS).toEqual([
      "alimentacao",
      "transporte_urbano",
      "hospedagem",
    ]);
    expect(isCategoriaElegivel("alimentacao")).toBe(true);
    expect(isCategoriaElegivel("transporte_urbano")).toBe(true);
    expect(isCategoriaElegivel("hospedagem")).toBe(true);
    expect(isCategoriaElegivel("coworking")).toBe(false);
  });

  it("[RN-002][RN-004] define limites base em centavos e teto de isencao de NF em R$ 100,00", () => {
    expect(DEFAULT_POLICY.limitesDiariosBaseCents.alimentacao).toBe(6000);
    expect(DEFAULT_POLICY.limitesDiariosBaseCents.transporte_urbano).toBe(8000);
    expect(DEFAULT_POLICY.limitesDiariosBaseCents.hospedagem).toBe(25000);
    expect(DEFAULT_POLICY.limiteIsencaoNotaFiscalCents).toBe(10000);
  });

  it("[RN-005][AMB-004] amplia limites diarios em 50% quando em viagem", () => {
    expect(obterLimiteDiarioCents("alimentacao", false)).toBe(6000);
    expect(obterLimiteDiarioCents("alimentacao", true)).toBe(9000);

    expect(obterLimiteDiarioCents("transporte_urbano", false)).toBe(8000);
    expect(obterLimiteDiarioCents("transporte_urbano", true)).toBe(12000);

    expect(obterLimiteDiarioCents("hospedagem", false)).toBe(25000);
    expect(obterLimiteDiarioCents("hospedagem", true)).toBe(37500);
  });
});
