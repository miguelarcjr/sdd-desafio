import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { executarCli, parseCliArgs } from "../src/cli/index.js";
import { validarLoteEntrada } from "../src/io/schema.js";
import type { ResultadoLote } from "../src/domain/types.js";

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

  it("exige subcomando 'calcular' e flags --input e --output na CLI", () => {
    expect(() => parseCliArgs([])).toThrow(/calcular/);
    expect(() => parseCliArgs(["calcular", "--input", "a.json"])).toThrow(/obrigatorios/);
    expect(parseCliArgs(["calcular", "--input", "a.json", "--output", "b.json"])).toEqual({
      comando: "calcular",
      inputPath: "a.json",
      outputPath: "b.json",
    });
  });

  it("executa CLI ponta a ponta sobre exemplos/despesas-exemplo.json gerando JSON valido", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "reembolso-cli-"));
    try {
      const input = resolve(process.cwd(), "exemplos", "despesas-exemplo.json");
      const output = join(tempDir, "resultado.json");

      executarCli(["calcular", "--input", input, "--output", output]);

      const conteudo = JSON.parse(readFileSync(output, "utf-8")) as ResultadoLote;
      expect(conteudo.resumo.total_despesas).toBe(14);
      expect(conteudo.resumo.quantidade_aprovadas).toBe(3);
      expect(conteudo.resumo.quantidade_parciais).toBe(4);
      expect(conteudo.resumo.quantidade_recusadas).toBe(7);
      expect(conteudo.resumo.valor_total_solicitado).toBe(1816.84);
      expect(conteudo.resumo.valor_total_reembolsado).toBe(710.43);
      expect(conteudo.avaliacoes).toHaveLength(14);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
