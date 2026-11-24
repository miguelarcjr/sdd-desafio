import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toCentsHalfUp } from "../domain/money.js";
import { normalizarCategoria } from "../domain/normalizer.js";
import {
  DEFAULT_POLICY,
  type PolicyConfig,
  type TabelaLimitesCents,
} from "../domain/policy.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extrairTabelaLimites(raw: unknown, contexto: string): TabelaLimitesCents {
  if (!isRecord(raw)) {
    throw new Error(`Secao '${contexto}' na politica externa deve ser um objeto.`);
  }
  const tabela: TabelaLimitesCents = {};
  for (const [cat, cfg] of Object.entries(raw)) {
    if (!isRecord(cfg) || typeof cfg.limite !== "number" || !Number.isFinite(cfg.limite)) {
      throw new Error(
        `Categoria '${contexto}.${cat}' na politica externa deve possuir campo numerico 'limite'.`
      );
    }
    tabela[normalizarCategoria(cat)] = toCentsHalfUp(cfg.limite);
  }
  return tabela;
}

/**
 * Carrega e valida arquivo externo de politica v4 (ex: politica-v4.json) -> PolicyConfig.
 */
export function lerPoliticaExterna(caminhoArquivo: string): PolicyConfig {
  const caminhoAbsoluto = resolve(caminhoArquivo);
  const raw = JSON.parse(readFileSync(caminhoAbsoluto, "utf-8")) as unknown;
  if (!isRecord(raw)) {
    throw new Error("Arquivo de politica externa deve conter um objeto JSON na raiz.");
  }

  const limitesDiariosBaseCents = extrairTabelaLimites(raw.padrao, "padrao");

  const centrosCusto: Record<string, TabelaLimitesCents> = {};
  if (raw.centros_custo !== undefined) {
    if (!isRecord(raw.centros_custo)) {
      throw new Error("Campo 'centros_custo' na politica externa deve ser um objeto.");
    }
    for (const [cc, cats] of Object.entries(raw.centros_custo)) {
      centrosCusto[cc.trim()] = extrairTabelaLimites(cats, `centros_custo.${cc}`);
    }
  }

  const nfLimite =
    typeof raw.nota_fiscal_obrigatoria_acima_de === "number" &&
    Number.isFinite(raw.nota_fiscal_obrigatoria_acima_de)
      ? toCentsHalfUp(raw.nota_fiscal_obrigatoria_acima_de)
      : DEFAULT_POLICY.limiteIsencaoNotaFiscalCents;

  const acrescimoViagem =
    typeof raw.acrescimo_em_viagem_percentual === "number" &&
    Number.isFinite(raw.acrescimo_em_viagem_percentual)
      ? 100 + raw.acrescimo_em_viagem_percentual
      : DEFAULT_POLICY.multiplicadorViagemPercentual;

  const limiteAprovacaoAutomaticaCents =
    typeof raw.aprovacao_manual_acima_de === "number" &&
    Number.isFinite(raw.aprovacao_manual_acima_de)
      ? toCentsHalfUp(raw.aprovacao_manual_acima_de)
      : DEFAULT_POLICY.limiteAprovacaoAutomaticaCents;

  return {
    limitesDiariosBaseCents,
    centrosCusto,
    limiteIsencaoNotaFiscalCents: nfLimite,
    multiplicadorViagemPercentual: acrescimoViagem,
    categoriasTriggerViagem: DEFAULT_POLICY.categoriasTriggerViagem,
    limiteAprovacaoAutomaticaCents,
  };
}
