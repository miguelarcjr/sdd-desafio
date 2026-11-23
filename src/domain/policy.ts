import type { CategoriaElegivel, Cents } from "./types.js";

export interface PolicyConfig {
  limitesDiariosBaseCents: Record<CategoriaElegivel, Cents>;
  limiteIsencaoNotaFiscalCents: Cents;
  multiplicadorViagemPercentual: number;
  categoriasTriggerViagem: ReadonlyArray<CategoriaElegivel>;
}

export const CATEGORIAS_ELEGIVEIS: ReadonlyArray<CategoriaElegivel> = [
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
  limiteIsencaoNotaFiscalCents: 10000, // R$ 100,00
  multiplicadorViagemPercentual: 150,  // +50% (150% do base)
  categoriasTriggerViagem: ["hospedagem"],
};

export function isCategoriaElegivel(categoria: string): categoria is CategoriaElegivel {
  return (CATEGORIAS_ELEGIVEIS as ReadonlyArray<string>).includes(categoria);
}

export function obterLimiteDiarioCents(
  categoria: CategoriaElegivel,
  emViagem: boolean,
  policy: PolicyConfig = DEFAULT_POLICY
): Cents {
  const base = policy.limitesDiariosBaseCents[categoria];
  if (!emViagem) {
    return base;
  }
  return Math.round((base * policy.multiplicadorViagemPercentual) / 100);
}
