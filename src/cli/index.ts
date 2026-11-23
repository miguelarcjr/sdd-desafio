import { pathToFileURL } from "node:url";
import { calcularReembolsos } from "../domain/engine.js";
import { gravarResultadoLote, lerLoteEntrada } from "../io/file-io.js";

export interface CliArgs {
  comando: string;
  inputPath: string;
  outputPath: string;
}

export function parseCliArgs(argv: ReadonlyArray<string>): CliArgs {
  const [comando, ...rest] = argv;
  if (!comando || comando !== "calcular") {
    throw new Error(
      "Uso: reembolso calcular --input <despesas.json> --output <resultado.json>"
    );
  }

  let inputPath = "";
  let outputPath = "";

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--input" || token === "-i") {
      inputPath = rest[i + 1] ?? "";
      i += 1;
    } else if (token === "--output" || token === "-o") {
      outputPath = rest[i + 1] ?? "";
      i += 1;
    }
  }

  if (!inputPath || !outputPath) {
    throw new Error(
      "Parametros obrigatorios ausentes. Uso: reembolso calcular --input <despesas.json> --output <resultado.json>"
    );
  }

  return { comando, inputPath, outputPath };
}

export function executarCli(argv: ReadonlyArray<string>): void {
  const { inputPath, outputPath } = parseCliArgs(argv);
  const lote = lerLoteEntrada(inputPath);
  const resultado = calcularReembolsos(lote);
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
