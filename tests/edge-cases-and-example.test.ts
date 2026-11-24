import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularReembolsos } from "../src/domain/engine.js";
import type { LoteEntrada } from "../src/domain/types.js";

function carregarExemploOficial(): LoteEntrada {
  const caminho = resolve(process.cwd(), "exemplos", "despesas-exemplo.json");
  return JSON.parse(readFileSync(caminho, "utf-8")) as LoteEntrada;
}

describe("[T-006] Casos de borda, precedencia e contrato com despesas-exemplo.json", () => {
  it("[Seção 9][AMB-001..011] processa exemplos/despesas-exemplo.json com exatidao item a item e totais esperados", () => {
    const lote = carregarExemploOficial();
    const resultado = calcularReembolsos(lote);

    expect(resultado.colaborador).toEqual(lote.colaborador);
    expect(resultado.periodo).toEqual(lote.periodo);

    expect(resultado.resumo).toEqual({
      total_despesas: 14,
      quantidade_aprovadas: 3,
      quantidade_parciais: 4,
      quantidade_pendentes_aprovacao: 0,
      quantidade_recusadas: 7,
      valor_total_solicitado: 1816.84,
      valor_total_reembolsado: 710.43,
      valor_total_pendente_aprovacao: 0,
    });

    const porId = new Map(resultado.avaliacoes.map((a) => [a.id, a]));

    // d-001 e d-002: agregacao diaria de alimentacao
    expect(porId.get("d-001")).toMatchObject({
      status: "parcial",
      valor_reembolsado: 60.0,
      valor_glosado: 12.5,
      regra_aplicada: "RN-003",
      em_viagem: false,
    });
    expect(porId.get("d-002")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      valor_glosado: 38.0,
      regra_aplicada: "RN-002",
    });

    // d-003 e d-004: fronteira de nota fiscal (> 100.00)
    expect(porId.get("d-003")).toMatchObject({
      status: "parcial",
      valor_reembolsado: 80.0,
      valor_glosado: 20.0,
      regra_aplicada: "RN-003",
    });
    expect(porId.get("d-004")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      valor_glosado: 100.01,
      regra_aplicada: "RN-004",
    });

    // d-005: categoria fora da politica
    expect(porId.get("d-005")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      regra_aplicada: "RN-001",
    });

    // d-006 e d-007: duplicidade
    expect(porId.get("d-006")).toMatchObject({
      status: "aprovada",
      valor_reembolsado: 54.9,
      regra_aplicada: "RN-002",
    });
    expect(porId.get("d-007")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      regra_aplicada: "RN-007",
    });

    // d-008: fora da competencia
    expect(porId.get("d-008")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      regra_aplicada: "RN-006",
    });

    // d-009: estorno negativo
    expect(porId.get("d-009")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      valor_glosado: 0,
      regra_aplicada: "RN-008",
    });

    // d-010: hospedagem valida ativa viagem (+50% -> R$ 375.00)
    expect(porId.get("d-010")).toMatchObject({
      status: "parcial",
      valor_reembolsado: 375.0,
      valor_glosado: 105.0,
      em_viagem: true,
      regra_aplicada: "RN-003",
    });

    // d-011: arredondamento Half-Up (33.333 -> 33.33)
    expect(porId.get("d-011")).toMatchObject({
      status: "aprovada",
      valor_original: 33.333,
      valor_considerado: 33.33,
      valor_reembolsado: 33.33,
      regra_aplicada: "RN-002",
    });

    // d-012: fim de semana (sabado) permitido
    expect(porId.get("d-012")).toMatchObject({
      status: "aprovada",
      valor_reembolsado: 47.2,
      regra_aplicada: "RN-002",
    });

    // d-013: hospedagem sem NF > 100 recusada e nao ativa viagem
    expect(porId.get("d-013")).toMatchObject({
      status: "recusada",
      valor_reembolsado: 0,
      em_viagem: false,
      regra_aplicada: "RN-004",
    });

    // d-014: categoria em maiusculas normalizada
    expect(porId.get("d-014")).toMatchObject({
      status: "parcial",
      categoria_original: "ALIMENTACAO",
      categoria_normalizada: "alimentacao",
      valor_reembolsado: 60.0,
      valor_glosado: 1.0,
      regra_aplicada: "RN-003",
    });
  });

  it("[RN-005][DT-002] alimentacao lancada antes da hospedagem na mesma data ainda recebe bonus de +50% em viagem", () => {
    const lote: LoteEntrada = {
      colaborador: { id: "c-1", nome: "Teste", centro_custo: "CC-1" },
      periodo: { competencia: "2026-07", inicio: "2026-07-01", fim: "2026-07-31" },
      despesas: [
        {
          id: "x-alim",
          data: "2026-07-14",
          categoria: "alimentacao",
          descricao: "Almoco",
          fornecedor: "Restaurante",
          valor: 85.0,
          tem_nota_fiscal: true,
        },
        {
          id: "x-hosp",
          data: "2026-07-14",
          categoria: "hospedagem",
          descricao: "Hotel",
          fornecedor: "Hotel X",
          valor: 300.0,
          tem_nota_fiscal: true,
        },
      ],
    };

    const resultado = calcularReembolsos(lote);
    expect(resultado.avaliacoes[0].em_viagem).toBe(true);
    expect(resultado.avaliacoes[0].status).toBe("aprovada");
    expect(resultado.avaliacoes[0].valor_reembolsado).toBe(85.0);
    expect(resultado.avaliacoes[1].em_viagem).toBe(true);
    expect(resultado.avaliacoes[1].valor_reembolsado).toBe(300.0);
  });

  it("[AMB-011][D-001] despesas recusadas na Fase A nao consomem limite diario e respeitam precedencia estrita", () => {
    const lote: LoteEntrada = {
      colaborador: { id: "c-1", nome: "Teste", centro_custo: "CC-1" },
      periodo: { competencia: "2026-07", inicio: "2026-07-01", fim: "2026-07-31" },
      despesas: [
        // Falha por RN-004 (sem NF > 100), nao deve consumir o saldo de R$ 80 de transporte
        {
          id: "t-1",
          data: "2026-07-06",
          categoria: "transporte_urbano",
          descricao: "Corrida longa",
          fornecedor: "TaxiApp",
          valor: 150.0,
          tem_nota_fiscal: false,
        },
        // Duplicata de t-1 sem NF -> deve falhar por RN-007 (etapa 5 antes da etapa 6 RN-004, conforme D-001)
        {
          id: "t-2",
          data: "2026-07-06",
          categoria: "transporte_urbano",
          descricao: "Corrida longa",
          fornecedor: "TaxiApp",
          valor: 150.0,
          tem_nota_fiscal: false,
        },
        // Despesa valida no mesmo dia deve ter os R$ 80,00 integrais disponiveis
        {
          id: "t-3",
          data: "2026-07-06",
          categoria: "transporte_urbano",
          descricao: "Corrida curta",
          fornecedor: "TaxiApp",
          valor: 75.0,
          tem_nota_fiscal: false,
        },
      ],
    };

    const resultado = calcularReembolsos(lote);
    expect(resultado.avaliacoes[0].regra_aplicada).toBe("RN-004");
    expect(resultado.avaliacoes[1].regra_aplicada).toBe("RN-007");
    expect(resultado.avaliacoes[2].status).toBe("aprovada");
    expect(resultado.avaliacoes[2].valor_reembolsado).toBe(75.0);
  });
});
