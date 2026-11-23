import type { DespesaInput, LoteEntrada } from "../domain/types.js";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(obj: Record<string, unknown>, campo: string, contexto: string): string {
  const val = obj[campo];
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new Error(`Campo obrigatorio '${contexto}.${campo}' deve ser uma string nao vazia.`);
  }
  return val;
}

function assertDateString(obj: Record<string, unknown>, campo: string, contexto: string): string {
  const val = assertString(obj, campo, contexto);
  if (!ISO_DATE_REGEX.test(val.trim())) {
    throw new Error(`Campo '${contexto}.${campo}' deve estar no formato AAAA-MM-DD (recebido: '${val}').`);
  }
  return val;
}

function validarDespesa(raw: unknown, index: number): DespesaInput {
  const contexto = `despesas[${index}]`;
  if (!isRecord(raw)) {
    throw new Error(`Item '${contexto}' deve ser um objeto JSON.`);
  }

  const id = assertString(raw, "id", contexto);
  const data = assertDateString(raw, "data", contexto);
  const categoria = assertString(raw, "categoria", contexto);
  const descricao = typeof raw.descricao === "string" ? raw.descricao : "";
  const fornecedor = typeof raw.fornecedor === "string" ? raw.fornecedor : "";

  if (typeof raw.valor !== "number" || !Number.isFinite(raw.valor)) {
    throw new Error(`Campo obrigatorio '${contexto}.valor' deve ser um numero finito.`);
  }

  if (typeof raw.tem_nota_fiscal !== "boolean") {
    throw new Error(`Campo obrigatorio '${contexto}.tem_nota_fiscal' deve ser booleano.`);
  }

  return {
    id,
    data,
    categoria,
    descricao,
    fornecedor,
    valor: raw.valor,
    tem_nota_fiscal: raw.tem_nota_fiscal,
  };
}

/**
 * Valida estruturalmente o JSON de entrada contra o contrato da Secao 4 da spec.md.
 */
export function validarLoteEntrada(raw: unknown): LoteEntrada {
  if (!isRecord(raw)) {
    throw new Error("O arquivo de entrada deve conter um objeto JSON na raiz.");
  }

  if (!isRecord(raw.colaborador)) {
    throw new Error("Campo obrigatorio 'colaborador' deve ser um objeto.");
  }
  const colaborador = {
    id: assertString(raw.colaborador, "id", "colaborador"),
    nome: assertString(raw.colaborador, "nome", "colaborador"),
    centro_custo: assertString(raw.colaborador, "centro_custo", "colaborador"),
  };

  if (!isRecord(raw.periodo)) {
    throw new Error("Campo obrigatorio 'periodo' deve ser um objeto.");
  }
  const periodo = {
    competencia: assertString(raw.periodo, "competencia", "periodo"),
    inicio: assertDateString(raw.periodo, "inicio", "periodo"),
    fim: assertDateString(raw.periodo, "fim", "periodo"),
  };

  if (!Array.isArray(raw.despesas)) {
    throw new Error("Campo obrigatorio 'despesas' deve ser um array.");
  }
  const despesas = raw.despesas.map((item, idx) => validarDespesa(item, idx));

  return {
    colaborador,
    periodo,
    despesas,
  };
}
