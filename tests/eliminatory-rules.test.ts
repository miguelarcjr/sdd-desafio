import { describe, expect, it } from "vitest";
import {
  criarAvaliacaoRecusada,
  preProcessarDespesa,
  validarRegrasEliminatoriasIniciais,
} from "../src/domain/engine.js";
import type { Periodo } from "../src/domain/types.js";

const PERIODO_JULHO: Periodo = {
  competencia: "2026-07",
  inicio: "2026-07-01",
  fim: "2026-07-31",
};

describe("[T-003] Regras eliminatorias iniciais (RN-008, RN-006, RN-001)", () => {
  it("[RN-008][AMB-007] recusa despesa com valor negativo (estorno d-009: -45.00) com valor_glosado = 0.00", () => {
    const item = preProcessarDespesa({
      id: "d-009",
      data: "2026-07-11",
      categoria: "transporte_urbano",
      descricao: "Estorno de corrida cancelada",
      fornecedor: "TaxiApp",
      valor: -45.0,
      tem_nota_fiscal: false,
    });

    const falha = validarRegrasEliminatoriasIniciais(item, PERIODO_JULHO);
    expect(falha).not.toBeNull();
    expect(falha?.regra).toBe("RN-008");

    const avaliacao = criarAvaliacaoRecusada(
      item,
      falha!.regra,
      falha!.justificativa,
      false
    );
    expect(avaliacao.status).toBe("recusada");
    expect(avaliacao.valor_reembolsado).toBe(0);
    expect(avaliacao.valor_glosado).toBe(0);
    expect(avaliacao.regra_aplicada).toBe("RN-008");
  });

  it("[RN-008][AMB-007] recusa despesa com valor zero (0.00)", () => {
    const item = preProcessarDespesa({
      id: "d-zero",
      data: "2026-07-10",
      categoria: "alimentacao",
      descricao: "Cortesia",
      fornecedor: "Restaurante",
      valor: 0,
      tem_nota_fiscal: true,
    });

    const falha = validarRegrasEliminatoriasIniciais(item, PERIODO_JULHO);
    expect(falha?.regra).toBe("RN-008");
  });

  it("[RN-006][AMB-010] recusa despesa fora do periodo de competencia (d-008: 2026-04-15)", () => {
    const item = preProcessarDespesa({
      id: "d-008",
      data: "2026-04-15",
      categoria: "alimentacao",
      descricao: "Almoco de abril lancado com atraso",
      fornecedor: "Restaurante Tavola",
      valor: 41.0,
      tem_nota_fiscal: true,
    });

    const falha = validarRegrasEliminatoriasIniciais(item, PERIODO_JULHO);
    expect(falha).not.toBeNull();
    expect(falha?.regra).toBe("RN-006");
  });

  it("[RN-006][AMB-010] aceita despesa em sabado/fim de semana dentro do periodo de competencia (d-012: 2026-07-18)", () => {
    const item = preProcessarDespesa({
      id: "d-012",
      data: "2026-07-18",
      categoria: "alimentacao",
      descricao: "Almoco de sabado - plantao",
      fornecedor: "Padaria Uniao",
      valor: 47.2,
      tem_nota_fiscal: true,
    });

    const falha = validarRegrasEliminatoriasIniciais(item, PERIODO_JULHO);
    expect(falha).toBeNull();
  });

  it("[RN-001] recusa categoria fora da politica (d-005: coworking)", () => {
    const item = preProcessarDespesa({
      id: "d-005",
      data: "2026-07-07",
      categoria: "coworking",
      descricao: "Diaria em espaco compartilhado",
      fornecedor: "HubOffice",
      valor: 89.0,
      tem_nota_fiscal: true,
    });

    const falha = validarRegrasEliminatoriasIniciais(item, PERIODO_JULHO);
    expect(falha).not.toBeNull();
    expect(falha?.regra).toBe("RN-001");
  });
});
