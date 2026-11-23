import { describe, expect, it } from "vitest";
import { calcularReembolsos } from "../src/domain/engine.js";
import type { LoteEntrada } from "../src/domain/types.js";

function criarLoteBase(despesas: LoteEntrada["despesas"]): LoteEntrada {
  return {
    colaborador: {
      id: "c-0417",
      nome: "Marina Volpi",
      centro_custo: "CC-ENG-PLATAFORMA",
    },
    periodo: {
      competencia: "2026-07",
      inicio: "2026-07-01",
      fim: "2026-07-31",
    },
    despesas,
  };
}

describe("[T-005] Limites diarios agregados (RN-002), reembolso parcial (RN-003) e dias em viagem (RN-005)", () => {
  it("[RN-002][RN-003][AMB-001][AMB-002] agrega limite diario de alimentacao (R$ 60): d-001 recebe R$ 60 parcial e d-002 recebe R$ 0 recusada", () => {
    const resultado = calcularReembolsos(
      criarLoteBase([
        {
          id: "d-001",
          data: "2026-07-03",
          categoria: "alimentacao",
          descricao: "Almoco com cliente",
          fornecedor: "Restaurante Tavola",
          valor: 72.5,
          tem_nota_fiscal: true,
        },
        {
          id: "d-002",
          data: "2026-07-03",
          categoria: "alimentacao",
          descricao: "Jantar apos reuniao",
          fornecedor: "Cantina do Porto",
          valor: 38.0,
          tem_nota_fiscal: true,
        },
      ])
    );

    expect(resultado.avaliacoes[0].status).toBe("parcial");
    expect(resultado.avaliacoes[0].valor_reembolsado).toBe(60.0);
    expect(resultado.avaliacoes[0].valor_glosado).toBe(12.5);
    expect(resultado.avaliacoes[0].regra_aplicada).toBe("RN-003");

    expect(resultado.avaliacoes[1].status).toBe("recusada");
    expect(resultado.avaliacoes[1].valor_reembolsado).toBe(0);
    expect(resultado.avaliacoes[1].valor_glosado).toBe(38.0);
    expect(resultado.avaliacoes[1].regra_aplicada).toBe("RN-002");

    expect(resultado.resumo.valor_total_solicitado).toBe(110.5);
    expect(resultado.resumo.valor_total_reembolsado).toBe(60.0);
  });

  it("[RN-005][AMB-003][AMB-004] hospedagem valida (d-010) ativa dia em viagem (+50%) elevando teto para R$ 375,00 (1 diaria por lancamento)", () => {
    const resultado = calcularReembolsos(
      criarLoteBase([
        {
          id: "d-010",
          data: "2026-07-14",
          categoria: "hospedagem",
          descricao: "Hotel Rio - 2 diarias",
          fornecedor: "Hotel Copa Sul",
          valor: 480.0,
          tem_nota_fiscal: true,
        },
      ])
    );

    expect(resultado.avaliacoes[0].em_viagem).toBe(true);
    expect(resultado.avaliacoes[0].status).toBe("parcial");
    expect(resultado.avaliacoes[0].valor_reembolsado).toBe(375.0);
    expect(resultado.avaliacoes[0].valor_glosado).toBe(105.0);
    expect(resultado.avaliacoes[0].regra_aplicada).toBe("RN-003");
  });

  it("[RN-004][RN-005][AMB-004][AMB-011] hospedagem sem nota fiscal acima de R$ 100 (d-013) e recusada na Fase A e nao ativa dia em viagem", () => {
    const resultado = calcularReembolsos(
      criarLoteBase([
        {
          id: "d-013",
          data: "2026-07-22",
          categoria: "hospedagem",
          descricao: "Airbnb 3 noites",
          fornecedor: "Airbnb",
          valor: 690.0,
          tem_nota_fiscal: false,
        },
        {
          id: "d-alim-mesmo-dia",
          data: "2026-07-22",
          categoria: "alimentacao",
          descricao: "Jantar",
          fornecedor: "Restaurante",
          valor: 80.0,
          tem_nota_fiscal: true,
        },
      ])
    );

    expect(resultado.avaliacoes[0].status).toBe("recusada");
    expect(resultado.avaliacoes[0].regra_aplicada).toBe("RN-004");
    expect(resultado.avaliacoes[0].em_viagem).toBe(false);

    // Como d-013 foi recusada, 2026-07-22 nao e dia em viagem: limite de alimentacao continua R$ 60,00
    expect(resultado.avaliacoes[1].em_viagem).toBe(false);
    expect(resultado.avaliacoes[1].valor_reembolsado).toBe(60.0);
  });
});
