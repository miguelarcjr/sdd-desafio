import type { Cents } from "./types.js";

export type TabelaLimitesCents = Record<string, Cents>;

export interface PolicyConfig {
  limitesDiariosBaseCents: TabelaLimitesCents;
  centrosCusto: Record<string, TabelaLimitesCents>;
  limiteIsencaoNotaFiscalCents: Cents;
  multiplicadorViagemPercentual: number;
  categoriasTriggerViagem: ReadonlyArray<string>;
  limiteAprovacaoAutomaticaCents: Cents;
}

export const CATEGORIAS_ELEGIVEIS: ReadonlyArray<string> = [
  "alimentacao",
  "transporte_urbano",
  "hospedagem",
];

export const DEFAULT_POLICY: PolicyConfig = {
  limitesDiariosBaseCents: {
    alimentacao: 6000,       // R$ 60,00
    transporte_urbano: 8000, // R$ 80,00
    hospedagem: 25000,       // R$ 250,00
  },
  centrosCusto: {},
  limiteIsencaoNotaFiscalCents: 10000,  // R$ 100,00
  multiplicadorViagemPercentual: 150,   // +50% (150% do base)
  categoriasTriggerViagem: ["hospedagem"],
  limiteAprovacaoAutomaticaCents: 50000, // R$ 500,00 (Item C / RN-013)
};

/**
 * Resolve a tabela efetiva de limites em centavos para um centro de custo (RN-011 / AMB-012):
 * - CC ausente: retorna uma copia de limitesDiariosBaseCents (padrao).
 * - CC presente: mescla padrao com sobrescritas e novas categorias do CC.
 */
export function resolverLimitesParaCentroCusto(
  centroCusto: string,
  policy: PolicyConfig = DEFAULT_POLICY
): TabelaLimitesCents {
  const ccKey = centroCusto.trim();
  const override = policy.centrosCusto[ccKey];
  if (!override) {
    return { ...policy.limitesDiariosBaseCents };
  }
  return {
    ...policy.limitesDiariosBaseCents,
    ...override,
  };
}

/**
 * Verifica se uma categoria normalizada e elegivel na tabela efetiva (RN-001 / AMB-013):
 * precisa existir e ter limite estritamente positivo (> 0).
 */
export function isCategoriaElegivel(
  categoria: string,
  limitesEfetivos?: TabelaLimitesCents
): boolean {
  const tabela = limitesEfetivos ?? DEFAULT_POLICY.limitesDiariosBaseCents;
  const limite = tabela[categoria];
  return typeof limite === "number" && limite > 0;
}

export function obterLimiteDiarioCents(
  categoria: string,
  emViagem: boolean,
  policy: PolicyConfig = DEFAULT_POLICY,
  limitesEfetivos?: TabelaLimitesCents
): Cents {
  const tabela = limitesEfetivos ?? policy.limitesDiariosBaseCents;
  const base = tabela[categoria] ?? 0;
  if (!emViagem) {
    return base;
  }
  return Math.round((base * policy.multiplicadorViagemPercentual) / 100);
}
