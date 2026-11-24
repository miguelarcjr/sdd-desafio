import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularReembolsos } from "../src/domain/engine.js";
import type { ExchangeRates } from "../src/domain/exchange.js";
import { toCentsHalfUp } from "../src/domain/money.js";
import type { PolicyConfig } from "../src/domain/policy.js";
import type { LoteEntrada } from "../src/domain/types.js";

function carregarJson<T>(...partes: string[]): T {
  const caminho = resolve(process.cwd(), ...partes);
  return JSON.parse(readFileSync(caminho, "utf-8")) as T;
}

function montarPoliticaV4DoArquivo(): PolicyConfig {
  const raw = carregarJson<{
    padrao: Record<string, { limite: number }>;
    centros_custo: Record<string, Record<string, { limite: number }>>;
    nota_fiscal_obrigatoria_acima_de: number;
    acrescimo_em_viagem_percentual: number;
  }>("exemplos", "envelope", "politica-v4.json");

  const padrao: Record<string, number> = {};
  for (const [cat, cfg] of Object.entries(raw.padrao)) {
    padrao[cat] = toCentsHalfUp(cfg.limite);
  }
  const centrosCusto: Record<string, Record<string, number>> = {};
  for (const [cc, cats] of Object.entries(raw.centros_custo)) {
    centrosCusto[cc] = {};
    for (const [cat, cfg] of Object.entries(cats)) {
      centrosCusto[cc][cat] = toCentsHalfUp(cfg.limite);
    }
  }

  return {
    limitesDiariosBaseCents: padrao,
    centrosCusto,
    limiteIsencaoNotaFiscalCents: toCentsHalfUp(raw.nota_fiscal_obrigatoria_acima_de),
    multiplicadorViagemPercentual: 100 + raw.acrescimo_em_viagem_percentual,
    categoriasTriggerViagem: ["hospedagem"],
    limiteAprovacaoAutomaticaCents: 50000,
  };
}

function montarCambioDoArquivo(): ExchangeRates {
  const raw = carregarJson<{
    moeda_base: string;
    taxas: Record<string, Record<string, number>>;
  }>("exemplos", "envelope", "cambio.json");
  return {
    moedaBase: raw.moeda_base,
    taxas: raw.taxas,
  };
}

describe("[T-010] Absorcao do Envelope v4 (RN-011, RN-012, RN-013, AMB-012..018)", () => {
  const policyV4 = montarPoliticaV4DoArquivo();
  const cambio = montarCambioDoArquivo();

  it("[RN-011..013] processa despesas-envelope.json (CC-COMERCIAL) com exatidao item a item", () => {
    const lote = carregarJson<LoteEntrada>("exemplos", "envelope", "despesas-envelope.json");
    const res = calcularReembolsos(lote, policyV4, cambio);

    expect(res.resumo).toEqual({
      total_despesas: 10,
      quantidade_aprovadas: 3,
      quantidade_parciais: 3,
      quantidade_pendentes_aprovacao: 1,
      quantidade_recusadas: 3,
      valor_total_solicitado: 2457.52,
      valor_total_reembolsado: 828.72,
      valor_total_pendente_aprovacao: 600.0,
    });

    const porId = new Map(res.avaliacoes.map((a) => [a.id, a]));

    // e-001: representacao (340 > 300) -> parcial 300.00
    expect(porId.get("e-001")).toMatchObject({
      status: "parcial",
      valor_reembolsado: 300.0,
      valor_glosado: 40.0,
      em_viagem: false,
      regra_aplicada: "RN-003",
    });

    // e-002: 22 EUR * 5.93 = 130.46 (em_viagem -> teto 135.00) -> aprovada
    expect(porId.get("e-002")).toMatchObject({
      status: "aprovada",
      moeda_original: "EUR",
      taxa_cambio_aplicada: 5.93,
      valor_considerado: 130.46,
      valor_reembolsado: 130.46,
      em_viagem: true,
      regra_aplicada: "RN-002",
    });

    // e-003: 14.50 EUR * 5.88 = 85.26 <= 100 dispensa NF -> aprovada
    expect(porId.get("e-003")).toMatchObject({
      status: "aprovada",
      valor_considerado: 85.26,
      valor_reembolsado: 85.26,
      em_viagem: true,
      regra_aplicada: "RN-002",
    });

    // e-004: sabado 2026-07-18 usa sexta 2026-07-17 (5.96) -> 178.80 > 135.00 -> parcial 135.00
    expect(porId.get("e-004")).toMatchObject({
      status: "parcial",
      taxa_cambio_aplicada: 5.96,
      valor_considerado: 178.8,
      valor_reembolsado: 135.0,
      valor_glosado: 43.8,
      em_viagem: true,
      regra_aplicada: "RN-003",
    });

    // e-005: 40 USD * 5.50 = 220.00 sem NF -> recusada RN-004, sem ativar viagem
    expect(porId.get("e-005")).toMatchObject({
      status: "recusada",
      valor_considerado: 220.0,
      valor_reembolsado: 0,
      em_viagem: false,
      regra_aplicada: "RN-004",
    });

    // e-006: GBP ausente em cambio.json -> recusada RN-012
    expect(porId.get("e-006")).toMatchObject({
      status: "recusada",
      moeda_original: "GBP",
      taxa_cambio_aplicada: null,
      valor_considerado: 0,
      valor_reembolsado: 0,
      regra_aplicada: "RN-012",
    });

    // e-007: hospedagem 1200 BRL em CC-COMERCIAL (teto viagem 600 > 500) -> pendente_aprovacao RN-013
    expect(porId.get("e-007")).toMatchObject({
      status: "pendente_aprovacao",
      valor_reembolsado: 600.0,
      valor_glosado: 600.0,
      em_viagem: true,
      regra_aplicada: "RN-013",
    });

    // e-008: alimentacao 95 > 90 (sem viagem) -> parcial 90.00
    expect(porId.get("e-008")).toMatchObject({
      status: "parcial",
      valor_reembolsado: 90.0,
      valor_glosado: 5.0,
      regra_aplicada: "RN-003",
    });

    // e-009: coworking -> recusada RN-001
    expect(porId.get("e-009")).toMatchObject({
      status: "recusada",
      regra_aplicada: "RN-001",
    });

    // e-010: sem campo moeda -> assume BRL, 88 <= 90 -> aprovada
    expect(porId.get("e-010")).toMatchObject({
      status: "aprovada",
      moeda_original: "BRL",
      taxa_cambio_aplicada: 1,
      valor_reembolsado: 88.0,
      regra_aplicada: "RN-002",
    });
  });

  it("[RN-011][AMB-012] processa despesas-envelope-cc-desconhecido.json (CC-SUPORTE-N2 -> politica padrao)", () => {
    const lote = carregarJson<LoteEntrada>(
      "exemplos",
      "envelope",
      "despesas-envelope-cc-desconhecido.json"
    );
    const res = calcularReembolsos(lote, policyV4, cambio);

    expect(res.resumo).toEqual({
      total_despesas: 4,
      quantidade_aprovadas: 3,
      quantidade_parciais: 0,
      quantidade_pendentes_aprovacao: 0,
      quantidade_recusadas: 1,
      valor_total_solicitado: 623.76,
      valor_total_reembolsado: 433.76,
      valor_total_pendente_aprovacao: 0,
    });

    const porId = new Map(res.avaliacoes.map((a) => [a.id, a]));
    expect(porId.get("f-001")).toMatchObject({ status: "aprovada", valor_reembolsado: 58.0 });
    expect(porId.get("f-002")).toMatchObject({
      status: "aprovada",
      em_viagem: true,
      valor_reembolsado: 310.0,
    });
    expect(porId.get("f-003")).toMatchObject({
      status: "recusada",
      regra_aplicada: "RN-001",
    });
    expect(porId.get("f-004")).toMatchObject({
      status: "aprovada",
      moeda_original: "USD",
      taxa_cambio_aplicada: 5.48,
      valor_considerado: 65.76,
      valor_reembolsado: 65.76,
      em_viagem: true,
    });
  });

  it("[RN-011][AMB-013] CC-ENG-PLATAFORMA com politica-v4 recusa hospedagem (limite 0) sem ativar viagem", () => {
    const lote: LoteEntrada = {
      colaborador: { id: "c-0417", nome: "Marina Volpi", centro_custo: "CC-ENG-PLATAFORMA" },
      periodo: { competencia: "2026-07", inicio: "2026-07-01", fim: "2026-07-31" },
      despesas: [
        {
          id: "h-1",
          data: "2026-07-14",
          categoria: "hospedagem",
          descricao: "Hotel",
          fornecedor: "Hotel X",
          valor: 200.0,
          tem_nota_fiscal: true,
        },
        {
          id: "a-1",
          data: "2026-07-14",
          categoria: "alimentacao",
          descricao: "Almoco",
          fornecedor: "Restaurante",
          valor: 80.0,
          tem_nota_fiscal: true,
        },
      ],
    };

    const res = calcularReembolsos(lote, policyV4, cambio);
    expect(res.avaliacoes[0]).toMatchObject({
      status: "recusada",
      regra_aplicada: "RN-001",
      em_viagem: false,
    });
    // Sem viagem, alimentacao em CC-ENG-PLATAFORMA tem limite de R$ 75,00
    expect(res.avaliacoes[1]).toMatchObject({
      status: "parcial",
      valor_reembolsado: 75.0,
      em_viagem: false,
      regra_aplicada: "RN-003",
    });
  });
});
