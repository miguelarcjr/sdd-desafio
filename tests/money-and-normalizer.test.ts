import { describe, expect, it } from "vitest";
import { formatBRL, fromCents, toCentsHalfUp } from "../src/domain/money.js";
import {
  construirChaveDuplicata,
  normalizarCategoria,
  normalizarTextoChave,
} from "../src/domain/normalizer.js";

describe("[T-002] Aritmetica monetaria em centavos (RN-010 / AMB-008)", () => {
  it("[RN-010][AMB-008] arredonda valores com 3+ casas decimais usando Half-Up (d-011: 33.333 -> 33.33)", () => {
    expect(toCentsHalfUp(33.333)).toBe(3333);
    expect(fromCents(toCentsHalfUp(33.333))).toBe(33.33);

    expect(toCentsHalfUp(33.335)).toBe(3334);
    expect(fromCents(toCentsHalfUp(33.335))).toBe(33.34);

    expect(toCentsHalfUp(1.005)).toBe(101);
    expect(fromCents(toCentsHalfUp(1.005))).toBe(1.01);
  });

  it("[RN-004][AMB-005] preserva precisao exata na fronteira de R$ 100,00 e R$ 100,01 (d-003 e d-004)", () => {
    expect(toCentsHalfUp(100.0)).toBe(10000);
    expect(toCentsHalfUp(100.01)).toBe(10001);
    expect(fromCents(10001)).toBe(100.01);
  });

  it("[RN-008][AMB-007] converte valores negativos e zero sem perder o sinal (d-009: -45.00)", () => {
    expect(toCentsHalfUp(-45.0)).toBe(-4500);
    expect(fromCents(-4500)).toBe(-45);
    expect(toCentsHalfUp(-10.555)).toBe(-1056); // Half-Up afastando-se de zero
    expect(toCentsHalfUp(0)).toBe(0);
  });

  it("formata valores em BRL com 2 casas decimais", () => {
    expect(formatBRL(6000)).toBe("R$ 60.00");
    expect(formatBRL(37500)).toBe("R$ 375.00");
  });
});

describe("[T-002] Normalizacao de categoria e chave de duplicata (RN-009 / RN-007 / D-001)", () => {
  it("[RN-009][AMB-009] normaliza categoria com trim e lowercase (d-014: ALIMENTACAO -> alimentacao)", () => {
    expect(normalizarCategoria("ALIMENTACAO")).toBe("alimentacao");
    expect(normalizarCategoria("  Transporte_Urbano  ")).toBe("transporte_urbano");
  });

  it("[RN-007][AMB-006][D-001] colapsa multiplos espacos internos e ignora caixa na chave de duplicata", () => {
    expect(normalizarTextoChave("  Bistro   Central ")).toBe("bistro central");

    const chave1 = construirChaveDuplicata(
      {
        data: "2026-07-09",
        categoria: "alimentacao",
        fornecedor: "Bistro Central",
        descricao: "Almoco",
      },
      5490
    );
    const chave2 = construirChaveDuplicata(
      {
        data: "2026-07-09",
        categoria: "ALIMENTACAO",
        fornecedor: "  bistro   central ",
        descricao: " almoco ",
      },
      5490
    );
    expect(chave1).toBe(chave2);
  });
});
