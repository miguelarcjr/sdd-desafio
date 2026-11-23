import { formatBRL, fromCents, toCentsHalfUp } from "./money.js";
import { construirChaveDuplicata, normalizarCategoria } from "./normalizer.js";
import {
  DEFAULT_POLICY,
  isCategoriaElegivel,
  obterLimiteDiarioCents,
  type PolicyConfig,
} from "./policy.js";
import type {
  AvaliacaoDespesa,
  CategoriaElegivel,
  Cents,
  CodigoRegra,
  DespesaInput,
  LoteEntrada,
  Periodo,
  ResultadoLote,
  ResumoLote,
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
  const chavesVistas = new Map<string, string>();
  const resultados: ResultadoFaseA[] = [];

  for (const despesa of despesas) {
    const item = preProcessarDespesa(despesa);

    const falhaInicial = validarRegrasEliminatoriasIniciais(item, periodo);
    if (falhaInicial) {
      resultados.push({ item, falha: falhaInicial });
      continue;
    }

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

    const falhaNF = validarNotaFiscal(item, policy);
    if (falhaNF) {
      resultados.push({ item, falha: falhaNF });
      continue;
    }

    resultados.push({ item, falha: null });
  }

  return resultados;
}

/**
 * Identifica todas as datas com pelo menos uma despesa de categoria trigger de viagem
 * (ex: "hospedagem") que tenha sobrevivido a Fase A eliminatoria (RN-005 / AMB-004).
 */
export function identificarDatasEmViagem(
  resultadosFaseA: ReadonlyArray<ResultadoFaseA>,
  policy: PolicyConfig = DEFAULT_POLICY
): Set<string> {
  const datasEmViagem = new Set<string>();
  const triggers = new Set<string>(policy.categoriasTriggerViagem);

  for (const { item, falha } of resultadosFaseA) {
    if (falha === null && triggers.has(item.categoriaNormalizada)) {
      datasEmViagem.add(item.despesa.data.trim());
    }
  }

  return datasEmViagem;
}

/**
 * Executa o motor completo de calculo de reembolso (Fase A + Fase B + Resumo) (T-005).
 */
export function calcularReembolsos(
  lote: LoteEntrada,
  policy: PolicyConfig = DEFAULT_POLICY
): ResultadoLote {
  const resultadosFaseA = executarFaseAEliminatoria(
    lote.despesas,
    lote.periodo,
    policy
  );
  const datasEmViagem = identificarDatasEmViagem(resultadosFaseA, policy);

  // Mapa de saldo restante em centavos por chave "AAAA-MM-DD|categoria"
  const saldosDiarios = new Map<string, Cents>();
  const avaliacoes: AvaliacaoDespesa[] = [];

  let quantidadeAprovadas = 0;
  let quantidadeParciais = 0;
  let quantidadeRecusadas = 0;
  let totalSolicitadoCents = 0;
  let totalReembolsadoCents = 0;

  for (const { item, falha } of resultadosFaseA) {
    const dataLimpa = item.despesa.data.trim();
    const emViagem = datasEmViagem.has(dataLimpa);
    totalSolicitadoCents += item.valorConsideradoCents;

    if (falha !== null) {
      quantidadeRecusadas += 1;
      avaliacoes.push(
        criarAvaliacaoRecusada(item, falha.regra, falha.justificativa, emViagem)
      );
      continue;
    }

    const categoria = item.categoriaNormalizada as CategoriaElegivel;
    const limiteDiarioCents = obterLimiteDiarioCents(categoria, emViagem, policy);
    const chaveDiaCategoria = `${dataLimpa}|${categoria}`;

    const saldoDisponivelCents =
      saldosDiarios.get(chaveDiaCategoria) ?? limiteDiarioCents;

    if (saldoDisponivelCents === 0) {
      quantidadeRecusadas += 1;
      avaliacoes.push(
        criarAvaliacaoRecusada(
          item,
          "RN-002",
          `Limite diario de ${formatBRL(limiteDiarioCents)} para '${categoria}' na data ${dataLimpa} ja foi integralmente consumido por despesas anteriores.`,
          emViagem
        )
      );
      continue;
    }

    if (item.valorConsideradoCents <= saldoDisponivelCents) {
      const novoSaldo = saldoDisponivelCents - item.valorConsideradoCents;
      saldosDiarios.set(chaveDiaCategoria, novoSaldo);
      quantidadeAprovadas += 1;
      totalReembolsadoCents += item.valorConsideradoCents;

      const valorConsiderado = fromCents(item.valorConsideradoCents);
      const sufixoViagem = emViagem ? " (limite ampliado em 50% por dia em viagem)" : "";

      avaliacoes.push({
        id: item.despesa.id,
        data: item.despesa.data,
        categoria_original: item.despesa.categoria,
        categoria_normalizada: item.categoriaNormalizada,
        valor_original: item.despesa.valor,
        valor_considerado: valorConsiderado,
        valor_reembolsado: valorConsiderado,
        valor_glosado: 0,
        status: "aprovada",
        em_viagem: emViagem,
        regra_aplicada: "RN-002",
        justificativa: `Despesa aprovada integralmente dentro do limite diario de ${formatBRL(limiteDiarioCents)} para '${categoria}'${sufixoViagem}.`,
      });
    } else {
      const reembolsadoCents = saldoDisponivelCents;
      const glosadoCents = item.valorConsideradoCents - reembolsadoCents;
      saldosDiarios.set(chaveDiaCategoria, 0);
      quantidadeParciais += 1;
      totalReembolsadoCents += reembolsadoCents;

      const sufixoViagem = emViagem ? " (limite ampliado em 50% por dia em viagem)" : "";

      avaliacoes.push({
        id: item.despesa.id,
        data: item.despesa.data,
        categoria_original: item.despesa.categoria,
        categoria_normalizada: item.categoriaNormalizada,
        valor_original: item.despesa.valor,
        valor_considerado: fromCents(item.valorConsideradoCents),
        valor_reembolsado: fromCents(reembolsadoCents),
        valor_glosado: fromCents(glosadoCents),
        status: "parcial",
        em_viagem: emViagem,
        regra_aplicada: "RN-003",
        justificativa: `Despesa excede o saldo diario disponivel de ${formatBRL(reembolsadoCents)} (teto de ${formatBRL(limiteDiarioCents)} para '${categoria}'${sufixoViagem}); reembolsado parcialmente ate o teto e glosado o excedente de ${formatBRL(glosadoCents)}.`,
      });
    }
  }

  const resumo: ResumoLote = {
    total_despesas: lote.despesas.length,
    quantidade_aprovadas: quantidadeAprovadas,
    quantidade_parciais: quantidadeParciais,
    quantidade_recusadas: quantidadeRecusadas,
    valor_total_solicitado: fromCents(totalSolicitadoCents),
    valor_total_reembolsado: fromCents(totalReembolsadoCents),
  };

  return {
    colaborador: { ...lote.colaborador },
    periodo: { ...lote.periodo },
    resumo,
    avaliacoes,
  };
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
