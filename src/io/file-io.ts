import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LoteEntrada, ResultadoLote } from "../domain/types.js";
import { validarLoteEntrada } from "./schema.js";

export function lerLoteEntrada(caminhoArquivo: string): LoteEntrada {
  const caminhoAbsoluto = resolve(caminhoArquivo);
  const conteudo = readFileSync(caminhoAbsoluto, "utf-8");
  const json = JSON.parse(conteudo) as unknown;
  return validarLoteEntrada(json);
}

export function gravarResultadoLote(caminhoArquivo: string, resultado: ResultadoLote): void {
  const caminhoAbsoluto = resolve(caminhoArquivo);
  mkdirSync(dirname(caminhoAbsoluto), { recursive: true });
  writeFileSync(caminhoAbsoluto, `${JSON.stringify(resultado, null, 2)}\n`, "utf-8");
}
