import type { Cents, DespesaInput } from "./types.js";

/**
 * Normaliza categoria conforme RN-009: remove espacos nas extremidades
 * e converte para letras minusculas.
 */
export function normalizarCategoria(categoria: string): string {
  return categoria.trim().toLowerCase();
}

/**
 * Normaliza texto livre (fornecedor, descricao) conforme RN-007 e D-001:
 * remove espacos extremos, colapsa multiplos espacos internos em um unico
 * espaco e converte para letras minusculas.
 */
export function normalizarTextoChave(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Constroi a chave deterministica de deteccao de duplicatas (RN-007 / AMB-006 / D-001):
 * (data, categoria_normalizada, fornecedor_normalizado, descricao_normalizada, valor_considerado_cents)
 */
export function construirChaveDuplicata(
  despesa: Pick<DespesaInput, "data" | "categoria" | "fornecedor" | "descricao">,
  valorConsideradoCents: Cents
): string {
  const data = despesa.data.trim();
  const categoria = normalizarCategoria(despesa.categoria);
  const fornecedor = normalizarTextoChave(despesa.fornecedor);
  const descricao = normalizarTextoChave(despesa.descricao);
  return `${data}|${categoria}|${fornecedor}|${descricao}|${valorConsideradoCents}`;
}
