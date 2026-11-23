import { formatBRL, fromCents, toCentsHalfUp } from "./money.js";
import { construirChaveDuplicata, normalizarCategoria } from "./normalizer.js";
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

export interface ResultadoFaseA {
  item: ItemPreProcessado;
  falha: FalhaEliminatoria | null;
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

/**
 * Avalia obrigatoriedade de nota fiscal (RN-004 / AMB-005):
 * Exigida estritamente acima do limite de isencao (R$ 100,00 = 10000 centavos).
 */
export function validarNotaFiscal(
  item: ItemPreProcessado,
  policy: PolicyConfig = DEFAULT_POLICY
): FalhaEliminatoria | null {
  if (
    item.valorConsideradoCents > policy.limiteIsencaoNotaFiscalCents &&
    !item.despesa.tem_nota_fiscal
  ) {
    return {
      regra: "RN-004",
      justificativa: `Despesa de ${formatBRL(item.valorConsideradoCents)} acima de ${formatBRL(policy.limiteIsencaoNotaFiscalCents)} exige nota fiscal obrigatoria.`,
    };
  }
  return null;
}

/**
 * Executa toda a Fase A (T-003 + T-004) sobre o lote de despesas:
 * 1. Pre-processamento (RN-009, RN-010)
 * 2. Valor positivo (RN-008)
 * 3. Periodo de competencia (RN-006)
 * 4. Categoria elegivel (RN-001)
 * 5. Duplicidade (RN-007 / AMB-006 / D-001)
 * 6. Nota fiscal obrigatoria (RN-004 / AMB-005)
 */
export function executarFaseAEliminatoria(
  despesas: ReadonlyArray<DespesaInput>,
  periodo: Periodo,
  policy: PolicyConfig = DEFAULT_POLICY
): ResultadoFaseA[] {
  const chavesVistas = new Map<string, string>(); // chave -> id da 1a ocorrencia
  const resultados: ResultadoFaseA[] = [];

  for (const despesa of despesas) {
    const item = preProcessarDespesa(despesa);

    // Etapas 2, 3 e 4
    const falhaInicial = validarRegrasEliminatoriasIniciais(item, periodo);
    if (falhaInicial) {
      resultados.push({ item, falha: falhaInicial });
      continue;
    }

    // Etapa 5: Duplicidade (RN-007 / D-001)
    const chave = construirChaveDuplicata(despesa, item.valorConsideradoCents);
    const idOriginal = chavesVistas.get(chave);
    if (idOriginal !== undefined) {
      resultados.push({
        item,
        falha: {
          regra: "RN-007",
          justificativa: `Despesa duplicada em relacao ao lancamento '${idOriginal}' (${despesa.data}, ${item.categoriaNormalizada}, ${formatBRL(item.valorConsideradoCents)}).`,
        },
      });
      continue;
    }
    chavesVistas.set(chave, despesa.id);

    // Etapa 6: Nota fiscal (RN-004)
    const falhaNF = validarNotaFiscal(item, policy);
    if (falhaNF) {
      resultados.push({ item, falha: falhaNF });
      continue;
    }

    resultados.push({ item, falha: null });
  }

  return resultados;
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
