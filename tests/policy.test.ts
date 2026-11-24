import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_ELEGIVEIS,
  DEFAULT_POLICY,
  isCategoriaElegivel,
  obterLimiteDiarioCents,
  resolverLimitesParaCentroCusto,
  type PolicyConfig,
} from "../src/domain/policy.js";

const POLITICA_V4_TESTE: PolicyConfig = {
  limitesDiariosBaseCents: {
    alimentacao: 6000,
    transporte_urbano: 8000,
    hospedagem: 25000,
  },
  centrosCusto: {
    "CC-ENG-PLATAFORMA": {
      alimentacao: 7500,
      transporte_urbano: 8000,
      hospedagem: 0,
    },
    "CC-COMERCIAL": {
      alimentacao: 9000,
      transporte_urbano: 15000,
      hospedagem: 40000,
      representacao: 30000,
    },
    "CC-ADM": {
      alimentacao: 4500,
      transporte_urbano: 6000,
    },
  },
  limiteIsencaoNotaFiscalCents: 10000,
  multiplicadorViagemPercentual: 150,
  categoriasTriggerViagem: ["hospedagem"],
  limiteAprovacaoAutomaticaCents: 50000,
};

describe("[T-001] Configuracao declarativa da politica de reembolso", () => {
  it("[RN-001] reconhece apenas alimentacao, transporte_urbano e hospedagem como elegiveis na politica padrao", () => {
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

  it("[RN-002][RN-004][RN-013] define limites base em centavos, teto de NF em R$ 100 e aprovacao manual acima de R$ 500", () => {
    expect(DEFAULT_POLICY.limitesDiariosBaseCents.alimentacao).toBe(6000);
    expect(DEFAULT_POLICY.limitesDiariosBaseCents.transporte_urbano).toBe(8000);
    expect(DEFAULT_POLICY.limitesDiariosBaseCents.hospedagem).toBe(25000);
    expect(DEFAULT_POLICY.limiteIsencaoNotaFiscalCents).toBe(10000);
    expect(DEFAULT_POLICY.limiteAprovacaoAutomaticaCents).toBe(50000);
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

describe("[T-008] Politica externa por centro de custo (RN-011 / AMB-012 / AMB-013)", () => {
  it("[RN-011] CC-COMERCIAL inclui representacao (R$ 300) e limites proprios", () => {
    const limites = resolverLimitesParaCentroCusto("CC-COMERCIAL", POLITICA_V4_TESTE);
    expect(isCategoriaElegivel("representacao", limites)).toBe(true);
    expect(obterLimiteDiarioCents("representacao", false, POLITICA_V4_TESTE, limites)).toBe(30000);
    expect(obterLimiteDiarioCents("hospedagem", true, POLITICA_V4_TESTE, limites)).toBe(60000);
  });

  it("[RN-011][AMB-013] CC-ENG-PLATAFORMA com hospedagem = 0.00 torna hospedagem inelegivel", () => {
    const limites = resolverLimitesParaCentroCusto("CC-ENG-PLATAFORMA", POLITICA_V4_TESTE);
    expect(isCategoriaElegivel("hospedagem", limites)).toBe(false);
    expect(isCategoriaElegivel("alimentacao", limites)).toBe(true);
    expect(obterLimiteDiarioCents("alimentacao", false, POLITICA_V4_TESTE, limites)).toBe(7500);
  });

  it("[RN-011][AMB-012] CC-ADM herda hospedagem de padrao e CC-SUPORTE-N2 usa padrao integralmente", () => {
    const limitesAdm = resolverLimitesParaCentroCusto("CC-ADM", POLITICA_V4_TESTE);
    expect(limitesAdm.alimentacao).toBe(4500);
    expect(limitesAdm.hospedagem).toBe(25000);

    const limitesDesconhecido = resolverLimitesParaCentroCusto("CC-SUPORTE-N2", POLITICA_V4_TESTE);
    expect(limitesDesconhecido).toEqual(POLITICA_V4_TESTE.limitesDiariosBaseCents);
    expect(isCategoriaElegivel("representacao", limitesDesconhecido)).toBe(false);
  });
});
