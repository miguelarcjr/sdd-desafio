import {
  converterParaBrlCents,
  normalizarMoeda,
  resolverTaxaCambio,
  type ExchangeRates,
} from "./exchange.js";
import { formatBRL, fromCents } from "./money.js";
import { construirChaveDuplicata, normalizarCategoria } from "./normalizer.js";
import {
  DEFAULT_POLICY,
  isCategoriaElegivel,
  obterLimiteDiarioCents,
  resolverLimitesParaCentroCusto,
  type PolicyConfig,
  type TabelaLimitesCents,
} from "./policy.js";
import type {
  AvaliacaoDespesa,
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
  moedaOriginal: string;
  taxaCambioAplicada: number | null;
  dataCotacaoUsada: string | null;
  usouFallbackCambio: boolean;
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
 * Pre-processa a despesa (RN-009, RN-010, RN-012):
 * Normaliza categoria e moeda, resolve cambio (com fallback para ultimo dia util anterior)
 * e converte para centavos de BRL com arredondamento Half-Up.
 */
export function preProcessarDespesa(
  despesa: DespesaInput,
  exchange?: ExchangeRates
): ItemPreProcessado {
  const categoriaNormalizada = normalizarCategoria(despesa.categoria);
  const moedaOriginal = normalizarMoeda(despesa.moeda);
  const cambio = resolverTaxaCambio(despesa.data, moedaOriginal, exchange);

  if (cambio === null) {
    return {
      despesa,
      categoriaNormalizada,
      moedaOriginal,
      taxaCambioAplicada: null,
      dataCotacaoUsada: null,
      usouFallbackCambio: false,
      valorConsideradoCents: 0,
    };
  }

  return {
    despesa,
    categoriaNormalizada,
    moedaOriginal,
    taxaCambioAplicada: cambio.taxa,
    dataCotacaoUsada: cambio.dataCotacao,
    usouFallbackCambio: cambio.usouFallback,
    valorConsideradoCents: converterParaBrlCents(despesa.valor, cambio.taxa),
  };
}

/**
 * Avalia as regras eliminatorias iniciais (T-003 + T-010):
 * 0. RN-012: Taxa de cambio disponivel para moeda estrangeira
 * 1. RN-008: Valor estritamente positivo (> 0)
 * 2. RN-006: Data dentro do periodo de competencia [inicio, fim]
 * 3. RN-001 / RN-011: Categoria elegivel (limite > 0) na tabela efetiva do CC
 */
export function validarRegrasEliminatoriasIniciais(
  item: ItemPreProcessado,
  periodo: Periodo,
  limitesEfetivos?: TabelaLimitesCents
): FalhaEliminatoria | null {
  if (item.taxaCambioAplicada === null) {
    return {
      regra: "RN-012",
      justificativa: `Cotacao de cambio indisponivel para a moeda '${item.moedaOriginal}' na data ${item.despesa.data}.`,
    };
  }

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

  if (!isCategoriaElegivel(item.categoriaNormalizada, limitesEfetivos)) {
    return {
      regra: "RN-001",
      justificativa: `Categoria '${item.despesa.categoria}' fora da politica de reembolso ou nao reembolsavel para o centro de custo.`,
    };
  }

  return null;
}

/**
 * Avalia obrigatoriedade de nota fiscal (RN-004 / AMB-005 / AMB-016):
 * Exigida estritamente acima do limite de isencao em BRL (R$ 100,00 = 10000 centavos).
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
 * Executa toda a Fase A sobre o lote de despesas:
 * 1. Pre-processamento + Cambio (RN-009, RN-010, RN-012)
 * 2. Valor positivo (RN-008)
 * 3. Periodo de competencia (RN-006)
 * 4. Categoria elegivel no CC (RN-001, RN-011)
 * 5. Duplicidade (RN-007 / AMB-006 / D-001)
 * 6. Nota fiscal obrigatoria (RN-004 / AMB-005 / AMB-016)
 */
export function executarFaseAEliminatoria(
  despesas: ReadonlyArray<DespesaInput>,
  periodo: Periodo,
  policy: PolicyConfig = DEFAULT_POLICY,
  limitesEfetivos?: TabelaLimitesCents,
  exchange?: ExchangeRates
): ResultadoFaseA[] {
  const chavesVistas = new Map<string, string>();
  const resultados: ResultadoFaseA[] = [];

  for (const despesa of despesas) {
    const item = preProcessarDespesa(despesa, exchange);

    const falhaInicial = validarRegrasEliminatoriasIniciais(
      item,
      periodo,
      limitesEfetivos
    );
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
 * Identifica todas as datas com pelo menos uma despesa sobrevivente a Fase A
 * de categoria trigger de viagem ("hospedagem") OU em moeda estrangeira (RN-005 / AMB-004 / AMB-017).
 */
export function identificarDatasEmViagem(
  resultadosFaseA: ReadonlyArray<ResultadoFaseA>,
  policy: PolicyConfig = DEFAULT_POLICY
): Set<string> {
  const datasEmViagem = new Set<string>();
  const triggers = new Set<string>(policy.categoriasTriggerViagem);

  for (const { item, falha } of resultadosFaseA) {
    if (falha !== null) {
      continue;
    }
    const ehTriggerCategoria = triggers.has(item.categoriaNormalizada);
    const ehMoedaEstrangeira = item.moedaOriginal !== "BRL";
    if (ehTriggerCategoria || ehMoedaEstrangeira) {
      datasEmViagem.add(item.despesa.data.trim());
    }
  }

  return datasEmViagem;
}

/**
 * Executa o motor completo de calculo de reembolso (Fase A + Fase B + Fila > R$ 500 + Resumo).
 */
export function calcularReembolsos(
  lote: LoteEntrada,
  policy: PolicyConfig = DEFAULT_POLICY,
  exchange?: ExchangeRates
): ResultadoLote {
  const limitesEfetivos = resolverLimitesParaCentroCusto(
    lote.colaborador.centro_custo,
    policy
  );
  const resultadosFaseA = executarFaseAEliminatoria(
    lote.despesas,
    lote.periodo,
    policy,
    limitesEfetivos,
    exchange
  );
  const datasEmViagem = identificarDatasEmViagem(resultadosFaseA, policy);

  const saldosDiarios = new Map<string, Cents>();
  const avaliacoes: AvaliacaoDespesa[] = [];

  let quantidadeAprovadas = 0;
  let quantidadeParciais = 0;
  let quantidadePendentesAprovacao = 0;
  let quantidadeRecusadas = 0;
  let totalSolicitadoCents = 0;
  let totalReembolsadoCents = 0;
  let totalPendenteAprovacaoCents = 0;

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

    const categoria = item.categoriaNormalizada;
    const limiteDiarioCents = obterLimiteDiarioCents(
      categoria,
      emViagem,
      policy,
      limitesEfetivos
    );
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

    const ehIntegral = item.valorConsideradoCents <= saldoDisponivelCents;
    const reembolsadoCents = ehIntegral
      ? item.valorConsideradoCents
      : saldoDisponivelCents;
    const glosadoCents = item.valorConsideradoCents - reembolsadoCents;
    saldosDiarios.set(chaveDiaCategoria, saldoDisponivelCents - reembolsadoCents);

    const sufixoViagem = emViagem
      ? ` (limite ampliado em ${policy.multiplicadorViagemPercentual - 100}% por dia em viagem)`
      : "";
    const sufixoCambio =
      item.moedaOriginal !== "BRL" && item.taxaCambioAplicada !== null
        ? ` [convertido de ${item.despesa.valor.toFixed(2)} ${item.moedaOriginal} pela taxa ${item.taxaCambioAplicada}${item.usouFallbackCambio ? ` de ${item.dataCotacaoUsada}` : ""}]`
        : "";

    // Item C (RN-013): valor reembolsavel > R$ 500,00 entra em fila de aprovacao manual
    if (reembolsadoCents > policy.limiteAprovacaoAutomaticaCents) {
      quantidadePendentesAprovacao += 1;
      totalPendenteAprovacaoCents += reembolsadoCents;

      avaliacoes.push({
        id: item.despesa.id,
        data: item.despesa.data,
        categoria_original: item.despesa.categoria,
        categoria_normalizada: item.categoriaNormalizada,
        moeda_original: item.moedaOriginal,
        taxa_cambio_aplicada: item.taxaCambioAplicada,
        valor_original: item.despesa.valor,
        valor_considerado: fromCents(item.valorConsideradoCents),
        valor_reembolsado: fromCents(reembolsadoCents),
        valor_glosado: fromCents(glosadoCents),
        status: "pendente_aprovacao",
        em_viagem: emViagem,
        regra_aplicada: "RN-013",
        justificativa: `Valor reembolsavel de ${formatBRL(reembolsadoCents)} excede o limite de aprovacao automatica de ${formatBRL(policy.limiteAprovacaoAutomaticaCents)} (teto de ${formatBRL(limiteDiarioCents)} para '${categoria}'${sufixoViagem}); enviado para fila de aprovacao do gestor.${sufixoCambio}`,
      });
      continue;
    }

    if (ehIntegral) {
      quantidadeAprovadas += 1;
      totalReembolsadoCents += reembolsadoCents;

      avaliacoes.push({
        id: item.despesa.id,
        data: item.despesa.data,
        categoria_original: item.despesa.categoria,
        categoria_normalizada: item.categoriaNormalizada,
        moeda_original: item.moedaOriginal,
        taxa_cambio_aplicada: item.taxaCambioAplicada,
        valor_original: item.despesa.valor,
        valor_considerado: fromCents(item.valorConsideradoCents),
        valor_reembolsado: fromCents(reembolsadoCents),
        valor_glosado: 0,
        status: "aprovada",
        em_viagem: emViagem,
        regra_aplicada: "RN-002",
        justificativa: `Despesa aprovada integralmente dentro do limite diario de ${formatBRL(limiteDiarioCents)} para '${categoria}'${sufixoViagem}.${sufixoCambio}`,
      });
    } else {
      quantidadeParciais += 1;
      totalReembolsadoCents += reembolsadoCents;

      avaliacoes.push({
        id: item.despesa.id,
        data: item.despesa.data,
        categoria_original: item.despesa.categoria,
        categoria_normalizada: item.categoriaNormalizada,
        moeda_original: item.moedaOriginal,
        taxa_cambio_aplicada: item.taxaCambioAplicada,
        valor_original: item.despesa.valor,
        valor_considerado: fromCents(item.valorConsideradoCents),
        valor_reembolsado: fromCents(reembolsadoCents),
        valor_glosado: fromCents(glosadoCents),
        status: "parcial",
        em_viagem: emViagem,
        regra_aplicada: "RN-003",
        justificativa: `Despesa excede o saldo diario disponivel de ${formatBRL(reembolsadoCents)} (teto de ${formatBRL(limiteDiarioCents)} para '${categoria}'${sufixoViagem}); reembolsado parcialmente ate o teto e glosado o excedente de ${formatBRL(glosadoCents)}.${sufixoCambio}`,
      });
    }
  }

  const resumo: ResumoLote = {
    total_despesas: lote.despesas.length,
    quantidade_aprovadas: quantidadeAprovadas,
    quantidade_parciais: quantidadeParciais,
    quantidade_pendentes_aprovacao: quantidadePendentesAprovacao,
    quantidade_recusadas: quantidadeRecusadas,
    valor_total_solicitado: fromCents(totalSolicitadoCents),
    valor_total_reembolsado: fromCents(totalReembolsadoCents),
    valor_total_pendente_aprovacao: fromCents(totalPendenteAprovacaoCents),
  };

  return {
    colaborador: { ...lote.colaborador },
    periodo: { ...lote.periodo },
    resumo,
    avaliacoes,
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
    moeda_original: item.moedaOriginal,
    taxa_cambio_aplicada: item.taxaCambioAplicada,
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
