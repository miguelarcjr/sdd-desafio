import { pathToFileURL } from "node:url";
import { calcularReembolsos } from "../domain/engine.js";
import { DEFAULT_POLICY } from "../domain/policy.js";
import { lerTabelaCambio } from "../io/exchange-io.js";
import { gravarResultadoLote, lerLoteEntrada } from "../io/file-io.js";
import { lerPoliticaExterna } from "../io/policy-io.js";

export interface CliArgs {
  comando: string;
  inputPath: string;
  outputPath: string;
  policyPath?: string;
  cambioPath?: string;
}

export function parseCliArgs(argv: ReadonlyArray<string>): CliArgs {
  const [comando, ...rest] = argv;
  if (!comando || comando !== "calcular") {
    throw new Error(
      "Uso: reembolso calcular --input <despesas.json> --output <resultado.json> [--policy <politica.json>] [--cambio <cambio.json>]"
    );
  }

  let inputPath = "";
  let outputPath = "";
  let policyPath: string | undefined;
  let cambioPath: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--input" || token === "-i") {
      inputPath = rest[i + 1] ?? "";
      i += 1;
    } else if (token === "--output" || token === "-o") {
      outputPath = rest[i + 1] ?? "";
      i += 1;
    } else if (token === "--policy" || token === "-p") {
      policyPath = rest[i + 1] ?? "";
      i += 1;
    } else if (token === "--cambio" || token === "-c") {
      cambioPath = rest[i + 1] ?? "";
      i += 1;
    }
  }

  if (!inputPath || !outputPath) {
    throw new Error(
      "Parametros obrigatorios ausentes. Uso: reembolso calcular --input <despesas.json> --output <resultado.json> [--policy <politica.json>] [--cambio <cambio.json>]"
    );
  }

  return {
    comando,
    inputPath,
    outputPath,
    ...(policyPath ? { policyPath } : {}),
    ...(cambioPath ? { cambioPath } : {}),
  };
}

export function executarCli(argv: ReadonlyArray<string>): void {
  const { inputPath, outputPath, policyPath, cambioPath } = parseCliArgs(argv);
  const lote = lerLoteEntrada(inputPath);
  const policy = policyPath ? lerPoliticaExterna(policyPath) : DEFAULT_POLICY;
  const exchange = cambioPath ? lerTabelaCambio(cambioPath) : undefined;
  const resultado = calcularReembolsos(lote, policy, exchange);
  gravarResultadoLote(outputPath, resultado);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    executarCli(process.argv.slice(2));
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error(`Erro: ${mensagem}`);
    process.exit(1);
  }
}
