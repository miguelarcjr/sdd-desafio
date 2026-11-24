import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { executarCli, parseCliArgs } from "../src/cli/index.js";
import type { ResultadoLote } from "../src/domain/types.js";
import { validarLoteEntrada } from "../src/io/schema.js";

describe("[T-007] Validacao de schema, leitura/escrita JSON e CLI", () => {
  it("rejeita entrada sem colaborador, periodo ou despesas validas", () => {
    expect(() => validarLoteEntrada(null)).toThrow();
    expect(() => validarLoteEntrada({})).toThrow(/colaborador/);
    expect(() =>
      validarLoteEntrada({
        colaborador: { id: "c1", nome: "Ana", centro_custo: "CC1" },
        periodo: { competencia: "2026-07", inicio: "data-invalida", fim: "2026-07-31" },
        despesas: [],
      })
    ).toThrow(/AAAA-MM-DD/);
  });

  it("exige subcomando 'calcular' e flags --input e --output na CLI, aceitando --policy e --cambio opcionais", () => {
    expect(() => parseCliArgs([])).toThrow(/calcular/);
    expect(() => parseCliArgs(["calcular", "--input", "a.json"])).toThrow(/obrigatorios/);
    expect(parseCliArgs(["calcular", "--input", "a.json", "--output", "b.json"])).toEqual({
      comando: "calcular",
      inputPath: "a.json",
      outputPath: "b.json",
    });
    expect(
      parseCliArgs([
        "calcular",
        "--input",
        "a.json",
        "--output",
        "b.json",
        "--policy",
        "p.json",
        "--cambio",
        "c.json",
      ])
    ).toEqual({
      comando: "calcular",
      inputPath: "a.json",
      outputPath: "b.json",
      policyPath: "p.json",
      cambioPath: "c.json",
    });
  });

  it("executa CLI ponta a ponta sobre exemplos/despesas-exemplo.json (retrocompativel v3)", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "reembolso-cli-"));
    try {
      const input = resolve(process.cwd(), "exemplos", "despesas-exemplo.json");
      const output = join(tempDir, "resultado.json");

      executarCli(["calcular", "--input", input, "--output", output]);

      const conteudo = JSON.parse(readFileSync(output, "utf-8")) as ResultadoLote;
      expect(conteudo.resumo.total_despesas).toBe(14);
      expect(conteudo.resumo.quantidade_aprovadas).toBe(3);
      expect(conteudo.resumo.quantidade_parciais).toBe(4);
      expect(conteudo.resumo.quantidade_pendentes_aprovacao).toBe(0);
      expect(conteudo.resumo.quantidade_recusadas).toBe(7);
      expect(conteudo.resumo.valor_total_solicitado).toBe(1816.84);
      expect(conteudo.resumo.valor_total_reembolsado).toBe(710.43);
      expect(conteudo.avaliacoes).toHaveLength(14);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("[T-011] CLI com politica externa (--policy) e tabela de cambio (--cambio)", () => {
  it("executa CLI ponta a ponta com politica-v4.json e cambio.json sobre despesas-envelope.json e cc-desconhecido", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "reembolso-cli-v4-"));
    try {
      const policy = resolve(process.cwd(), "exemplos", "envelope", "politica-v4.json");
      const cambio = resolve(process.cwd(), "exemplos", "envelope", "cambio.json");

      const input1 = resolve(process.cwd(), "exemplos", "envelope", "despesas-envelope.json");
      const output1 = join(tempDir, "resultado-envelope.json");
      executarCli([
        "calcular",
        "--input",
        input1,
        "--output",
        output1,
        "--policy",
        policy,
        "--cambio",
        cambio,
      ]);
      const res1 = JSON.parse(readFileSync(output1, "utf-8")) as ResultadoLote;
      expect(res1.resumo).toEqual({
        total_despesas: 10,
        quantidade_aprovadas: 3,
        quantidade_parciais: 3,
        quantidade_pendentes_aprovacao: 1,
        quantidade_recusadas: 3,
        valor_total_solicitado: 2457.52,
        valor_total_reembolsado: 828.72,
        valor_total_pendente_aprovacao: 600.0,
      });

      const input2 = resolve(
        process.cwd(),
        "exemplos",
        "envelope",
        "despesas-envelope-cc-desconhecido.json"
      );
      const output2 = join(tempDir, "resultado-cc-desconhecido.json");
      executarCli([
        "calcular",
        "--input",
        input2,
        "--output",
        output2,
        "--policy",
        policy,
        "--cambio",
        cambio,
      ]);
      const res2 = JSON.parse(readFileSync(output2, "utf-8")) as ResultadoLote;
      expect(res2.resumo.valor_total_reembolsado).toBe(433.76);
      expect(res2.resumo.quantidade_recusadas).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
