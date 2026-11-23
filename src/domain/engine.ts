import { formatBRL, fromCents, toCentsHalfUp } from "./money.js";
import { normalizarCategoria } from "./normalizer.js";
import { DEFAULT_POLICY, isCategoriaElegivel, type PolicyConfig } from "./policy.js";
import type {
  AvaliacaoDespesa,
  CategoriaElegivel,
  Cents,
  CodigoRegra,
  DespesaInput,
  LoteEntrada,
  Periodo,
  ResultadoLote,
} from "./types.js";

export interface ItemPreProcessado {
  despesa: DespesaInput;
  categoriaNormalizada: string;
  valorConsideradoCents: Cents;
}

export interface FalhaEliminatoria {
  regra: CodigoRegra;
  justificativa: string;
}

export function estaDentroDoPeriodo(data: string, periodo: Periodo): boolean {
  const dataLimpa = data.trim();
  return dataLimpa >= periodo.inicio.trim() && dataLimpa <= periodo.fim.trim();
}

/**
 * Avalia as regras eliminatorias iniciais (T-003):
 * 1. RN-008: Valor estritamente positivo (> 0)
 * 2. RN-006: Data dentro do periodo de competencia [inicio, fim]
 * 3. RN-001: Categoria pertencente a politica
 */
export function validarRegrasEliminatoriasIniciais(
  item: ItemPreProcessado,
  periodo: Periodo
): FalhaEliminatoria | null {
  if (item.valorConsideradoCents <= 0) {
    return {
      regra: "RN-008",
      justificativa: `Valor nao positivo (${formatBRL(item.valorConsideradoCents)}) nao e elegivel para reembolso.`,
    };
  }

  if (!estaDentroDoPeriodo(item.despesa.data, periodo)) {
    return {
      regra: "RN-006",
      justificativa: `Data da despesa (${item.despesa.data}) esta fora do periodo de competencia (${periodo.inicio} a ${periodo.fim}).`,
    };
  }

  if (!isCategoriaElegivel(item.categoriaNormalizada)) {
    return {
      regra: "RN-001",
      justificativa: `Categoria '${item.despesa.categoria}' fora da politica de reembolso.`,
    };
  }

  return null;
}

export function preProcessarDespesa(despesa: DespesaInput): ItemPreProcessado {
  return {
    despesa,
    categoriaNormalizada: normalizarCategoria(despesa.categoria),
    valorConsideradoCents: toCentsHalfUp(despesa.valor),
  };
}

export function criarAvaliacaoRecusada(
  item: ItemPreProcessado,
  regra: CodigoRegra,
  justificativa: string,
  emViagem: boolean
): AvaliacaoDespesa {
  const valorConsiderado = fromCents(item.valorConsideradoCents);
  const valorGlosado = item.valorConsideradoCents > 0 ? valorConsiderado : 0;

  return {
    id: item.despesa.id,
    data: item.despesa.data,
    categoria_original: item.despesa.categoria,
    categoria_normalizada: item.categoriaNormalizada,
    valor_original: item.despesa.valor,
    valor_considerado: valorConsiderado,
    valor_reembolsado: 0,
    valor_glosado: valorGlosado,
    status: "recusada",
    em_viagem: emViagem,
    regra_aplicada: regra,
    justificativa,
  };
}
