import { describe, expect, it } from "vitest";
import { executarFaseAEliminatoria } from "../src/domain/engine.js";
import type { DespesaInput, Periodo } from "../src/domain/types.js";

const PERIODO_JULHO: Periodo = {
  competencia: "2026-07",
  inicio: "2026-07-01",
  fim: "2026-07-31",
};

describe("[T-004] Deteccao de duplicatas (RN-007 / AMB-006 / D-001) e Nota Fiscal (RN-004 / AMB-005)", () => {
  it("[RN-007][AMB-006] aprova 1a ocorrencia (d-006) na Fase A e recusa 2a ocorrencia identica (d-007) como duplicata", () => {
    const despesas: DespesaInput[] = [
      {
        id: "d-006",
        data: "2026-07-09",
        categoria: "alimentacao",
        descricao: "Almoco",
        fornecedor: "Bistro Central",
        valor: 54.9,
        tem_nota_fiscal: true,
      },
      {
        id: "d-007",
        data: "2026-07-09",
        categoria: "alimentacao",
        descricao: "Almoco",
        fornecedor: "Bistro Central",
        valor: 54.9,
        tem_nota_fiscal: true,
      },
    ];

    const resultado = executarFaseAEliminatoria(despesas, PERIODO_JULHO);
    expect(resultado[0].falha).toBeNull();
    expect(resultado[1].falha).not.toBeNull();
    expect(resultado[1].falha?.regra).toBe("RN-007");
    expect(resultado[1].falha?.justificativa).toContain("d-006");
  });

  it("[RN-004][AMB-005] aceita despesa de exatamente R$ 100,00 sem NF (d-003) e recusa R$ 100,01 sem NF (d-004)", () => {
    const despesas: DespesaInput[] = [
      {
        id: "d-003",
        data: "2026-07-06",
        categoria: "transporte_urbano",
        descricao: "Corrida aeroporto",
        fornecedor: "TaxiApp",
        valor: 100.0,
        tem_nota_fiscal: false,
      },
      {
        id: "d-004",
        data: "2026-07-06",
        categoria: "transporte_urbano",
        descricao: "Corrida hotel",
        fornecedor: "TaxiApp",
        valor: 100.01,
        tem_nota_fiscal: false,
      },
    ];

    const resultado = executarFaseAEliminatoria(despesas, PERIODO_JULHO);
    expect(resultado[0].falha).toBeNull();
    expect(resultado[1].falha).not.toBeNull();
    expect(resultado[1].falha?.regra).toBe("RN-004");
  });

  it("[RN-004][AMB-011] recusa hospedagem acima de R$ 100,00 sem NF (d-013: R$ 690,00) na Fase A antes do calculo de teto", () => {
    const despesas: DespesaInput[] = [
      {
        id: "d-013",
        data: "2026-07-22",
        categoria: "hospedagem",
        descricao: "Airbnb 3 noites",
        fornecedor: "Airbnb",
        valor: 690.0,
        tem_nota_fiscal: false,
      },
    ];

    const resultado = executarFaseAEliminatoria(despesas, PERIODO_JULHO);
    expect(resultado[0].falha?.regra).toBe("RN-004");
  });
});
