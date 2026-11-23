# Plano Técnico — Motor de Cálculo de Reembolso

**Versão:** 1.0 · **Baseado na spec:** 1.1

> Aqui mora o COMO. Este arquivo pode e deve falar de linguagem, biblioteca e
> arquitetura. O que ele **não** pode é introduzir regra de negócio nova — se
> apareceu uma, ela pertence à `spec.md`.

---

## 1. Stack

| Escolha | O quê | Por quê | O que descartei e por quê |
|---|---|---|---|
| Linguagem | TypeScript 5.x sobre Node.js >= 20 (ESM) | Tipagem estática forte para contratos de entrada/saída e regras (`RN-001..RN-010`), execução rápida via `tsx` e compilação limpa com `tsc`. | Python (tipagem apenas opcional via type hints) e Go (maior verbosidade para manipulação e evolução rápida de schemas JSON no Dia 2). |
| Testes | Vitest | Suporte nativo a TypeScript/ESM sem configuração complexa de Babel/ts-jest, execução instantânea e asserções expressivas. | Jest (exige configuração extra para ESM + TypeScript moderno) e `node:test` puro (menos recursos de diff estrutural em objetos JSON). |
| Parsing/validação | Type guards nativos em TypeScript (`src/io/schema.ts`) + `JSON.parse` | Zero dependências externas de runtime, mensagens de erro determinísticas e controle total sobre validação estrutural do contrato da Seção 4 da `spec.md`. | Zod / Ajv (adicionam dependências externas de runtime desnecessárias para um schema enxuto e bem delimitado). |
| Aritmética monetária | Centavos inteiros (`Cents = number` inteiro) com conversão Half-Up dedicada (`src/domain/money.ts`) | Elimina 100% dos erros de representação IEEE 754 em somas, subtrações e aplicação de percentuais (+50% de viagem), sem depender de bibliotecas externas. | `number` em ponto flutuante direto (`0.1 + 0.2 !== 0.3` quebraria somas e limites como `100.01`) e `decimal.js` (dependência externa dispensável quando se opera em centavos inteiros). |

---

## 2. Arquitetura

O sistema segue uma arquitetura em camadas com **núcleo funcional puro (Functional Core, Imperative Shell)**:

```
[CLI: src/cli/index.ts]
       │ lê args (--input, --output)
       ▼
[I/O: src/io/file-io.ts + src/io/schema.ts]
       │ lê arquivo, faz parse JSON e valida estrutura do contrato
       ▼
[Domain Core: src/domain/engine.ts]  ◄── [Policy Config: src/domain/policy.ts]
       │  ├─ Fase A: Pré-processamento (money.ts / normalizer.ts) + Regras Eliminatórias
       │  ├─ Detecção de Dias em Viagem (RN-005)
       │  └─ Fase B: Consumo de Limites Diários e Reembolso Parcial (RN-002, RN-003)
       ▼
[I/O: src/io/file-io.ts]
       │ formata centavos -> número com 2 casas e grava JSON de saída
```

**Fronteiras:**
- **Núcleo Puro (`src/domain/`):** `money.ts`, `normalizer.ts`, `policy.ts`, `types.ts` e `engine.ts`. Não importa `node:fs`, `node:path` nem `process`. Recebe um objeto tipado `LoteEntrada` em memória e devolve `ResultadoAvaliacaoLote` de forma pura e determinística.
- **Camada de I/O e CLI (`src/io/` e `src/cli/`):** Responsável apenas por ler argumentos de linha de comando, ler o arquivo do disco, validar se o JSON possui os campos obrigatórios e gravar o arquivo de saída.

---

## 3. Modelo de dados

Definido em `src/domain/types.ts`:

```typescript
export type Cents = number; // Inteiro representando centavos (ex: R$ 60,00 = 6000)

export type CategoriaElegivel = "alimentacao" | "transporte_urbano" | "hospedagem";

export type StatusAvaliacao = "aprovada" | "parcial" | "recusada";

export type CodigoRegra =
  | "RN-001"
  | "RN-002"
  | "RN-003"
  | "RN-004"
  | "RN-005"
  | "RN-006"
  | "RN-007"
  | "RN-008"
  | "RN-009"
  | "RN-010";

export interface Colaborador {
  id: string;
  nome: string;
  centro_custo: string;
}

export interface Periodo {
  competencia: string;
  inicio: string;
  fim: string;
}

export interface DespesaInput {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  tem_nota_fiscal: boolean;
}

export interface LoteEntrada {
  colaborador: Colaborador;
  periodo: Periodo;
  despesas: DespesaInput[];
}

export interface AvaliacaoDespesa {
  id: string;
  data: string;
  categoria_original: string;
  categoria_normalizada: string;
  valor_original: number;
  valor_considerado: number;
  valor_reembolsado: number;
  valor_glosado: number;
  status: StatusAvaliacao;
  em_viagem: boolean;
  regra_aplicada: CodigoRegra;
  justificativa: string;
}

export interface ResumoLote {
  total_despesas: number;
  quantidade_aprovadas: number;
  quantidade_parciais: number;
  quantidade_recusadas: number;
  valor_total_solicitado: number;
  valor_total_reembolsado: number;
}

export interface ResultadoLote {
  colaborador: Colaborador;
  periodo: Periodo;
  resumo: ResumoLote;
  avaliacoes: AvaliacaoDespesa[];
}
```

---

## 4. Como a política é representada

Todos os parâmetros da política vivem centralizados em um objeto declarativo imutável `DEFAULT_POLICY` em `src/domain/policy.ts`, injetável no motor `calcularReembolsos(lote, policy = DEFAULT_POLICY)`:

```typescript
export interface PolicyConfig {
  limitesDiariosBaseCents: Record<CategoriaElegivel, Cents>;
  limiteIsencaoNotaFiscalCents: Cents;
  multiplicadorViagemPercentual: number; // 150 = 150% (+50%)
  categoriasTriggerViagem: ReadonlyArray<CategoriaElegivel>;
}

export const DEFAULT_POLICY: PolicyConfig = {
  limitesDiariosBaseCents: {
    alimentacao: 6000,       // R$ 60,00
    transporte_urbano: 8000, // R$ 80,00
    hospedagem: 25000,       // R$ 250,00
  },
  limiteIsencaoNotaFiscalCents: 10000, // R$ 100,00
  multiplicadorViagemPercentual: 150,  // +50%
  categoriasTriggerViagem: ["hospedagem"],
};
```

Isolar a política nessa estrutura declarativa garante que qualquer alteração de limites, novas categorias ou mudança de multiplicadores no Dia 2 exija alterar apenas a configuração ou um ponto único do pipeline.

---

## 5. Decisões técnicas

### DT-001 — Aritmética monetária em centavos inteiros com arredondamento Half-Up baseado em string/escala

**Contexto:** O JSON de entrada traz valores como `33.333` (`d-011`), `100.01` (`d-004`) e `-45.00` (`d-009`). Multiplicar `float` binário por `100` diretamente em JavaScript sofre de imprecisões clássicas (ex.: `1.005 * 100 = 100.49999999999999`).
**Decisão:** Converter o número de entrada para centavos inteiros (`toCentsHalfUp`) tratando o sinal separadamente e utilizando `Number(Math.abs(valor) + "e2")` (ou decomposição decimal exata) antes de `Math.round`, operando 100% das regras em centavos inteiros e convertendo de volta (`fromCents(cents) = cents / 100`) somente na montagem do objeto de saída.
**Alternativa descartada:** Usar `number` float nativo com `.toFixed(2)` em cada etapa (descartado por acumular erros de arredondamento e espalhar conversões string/number pelo domínio).
**Consequência:** Somas, subtrações e cálculo de `+50%` (`(limiteCents * 150) / 100`) são operações inteiras exatas e livres de ruído de ponto flutuante.

### DT-002 — Motor em duas passagens (Fase A Eliminatória → Fase B Viagem e Limites Diários)

**Contexto:** A regra `RN-005` (`AMB-004`) define que uma data `D` está "em viagem" se houver uma despesa de `hospedagem` válida naquela data `D`. Se uma despesa de `alimentacao` aparecer no JSON *antes* da despesa de `hospedagem` da mesma data `D`, uma avaliação em passagem única não saberia ainda que a data `D` terá uma hospedagem válida mais abaixo na lista.
**Decisão:** Implementar o motor em duas passagens sobre a lista de despesas:
1. **Passagem 1 (Fase A):** Normaliza, arredonda e executa as regras eliminatórias (`RN-008`, `RN-006`, `RN-001`, `RN-007`, `RN-004`) para cada item na ordem da entrada.
2. **Interlúdio (`RN-005`):** Coleta o conjunto `datasEmViagem: Set<string>` contendo todas as datas com pelo menos um item de `hospedagem` que sobreviveu à Fase A.
3. **Passagem 2 (Fase B):** Para os itens sobreviventes à Fase A, aplica os limites diários (base ou ampliado em 50% se `datasEmViagem.has(data)`) e decide entre `"aprovada"` (`RN-002`), `"parcial"` (`RN-003`) ou `"recusada"` por saldo zerado (`RN-002`).
**Alternativa descartada:** Passagem única (descartada porque o resultado de uma despesa de alimentação num dia de viagem dependeria de a hospedagem estar posicionada antes ou depois dela na lista).
**Consequência:** Garante invariância de ordem entre categorias diferentes na mesma data para a detecção de viagem, preservando a ordem da lista para o consumo do saldo diário dentro da mesma categoria.

### DT-003 — Comparação lexicográfica de datas ISO-8601 (`AAAA-MM-DD`)

**Contexto:** `RN-006` valida se `despesa.data` está dentro de `[periodo.inicio, periodo.fim]`. Em JavaScript, `new Date("2026-07-01")` interpreta a string em UTC, o que frequentemente causa bugs de fuso horário (`off-by-one day`) dependendo do timezone local da máquina.
**Decisão:** Validar o formato `^\d{4}-\d{2}-\d{2}$` e comparar as datas diretamente como strings ISO-8601 (`data >= periodo.inicio && data <= periodo.fim`), pois o formato `AAAA-MM-DD` é lexicograficamente ordenável e imune a fuso horário.
**Alternativa descartada:** Instanciar objetos `Date` nativos do JavaScript (descartado pelo risco de deslocamento de fuso horário entre UTC e horário local).
**Consequência:** Comportamento 100% idêntico em qualquer sistema operacional ou fuso horário.

### DT-004 — Zero dependências externas de runtime

**Contexto:** O avaliador executará o projeto em sua máquina a partir das instruções do `README.md` (critério 5 da Rubrica).
**Decisão:** Manter `dependencies` vazio no `package.json` (usando apenas `devDependencies`: `typescript`, `vitest`, `tsx`, `@types/node`). O parser de CLI (`calcular --input <path> --output <path>`) e a validação de schema usam apenas módulos nativos do Node.js (`node:fs`, `node:path`, `node:util`).
**Alternativa descartada:** Commander/Yargs + Zod + Decimal.js (descartados por aumentarem a superfície de dependências para problemas simples que se resolvem em ~40 linhas de código tipado e testado).
**Consequência:** Instalação rápida, sem risco de conflito de pacotes e código 100% transparente para auditoria.

---

## 6. Estratégia de testes

- **Nível:**
  - **Unitários (~80%):** Testam isoladamente `money.ts` (`RN-010`), `normalizer.ts` (`RN-009`) e cada regra de negócio no motor puro `engine.ts` (`RN-001` a `RN-010` e `AMB-001` a `AMB-011`) sem tocar no disco.
  - **Integração / Ponta a Ponta (~20%):** Testam a execução completa sobre `exemplos/despesas-exemplo.json` e a execução da CLI lendo e escrevendo arquivos reais em diretório temporário.
- **Garantia de cobertura por requisito:** Cada `RN-001..RN-010` e cada `AMB-001..AMB-011` possui testes dedicados em `tests/`, verificados pela Matriz de Cobertura em `tasks.md`.
- **Casos de borda da Seção 7 da spec:** Todos os 12 casos da tabela da Seção 7 da `spec.md` são testados individualmente e também validados em conjunto no teste de contrato contra `exemplos/despesas-exemplo.json`.
- **Nomenclatura:** Todo `describe` / `it` inclui explicitamente o ID da regra e da ambiguidade que exercita, no formato:
  `it("[RN-004][AMB-005] aceita despesa de exatamente R$ 100,00 sem nota fiscal e recusa R$ 100,01 sem nota fiscal", ...)`

---

## 7. Riscos

| Risco | Probabilidade | O que faço se acontecer |
|---|---|---|
| Mudança de requisito do Dia 2 (Envelope Lacrado) alterar limites, adicionar nova categoria ou mudar regra de viagem/duplicata | Alta (100% — faz parte do desafio) | Atualizar primeiro a `spec.md`, registrar impacto no `DECISIONS.md`, criar tasks na Fase 5 do `tasks.md` e ajustar `DEFAULT_POLICY` ou a etapa correspondente no pipeline modular de `src/domain/engine.ts`. |
| Despesa de hospedagem aparecer depois de despesa de alimentação da mesma data no conjunto de testes oculto do avaliador | Média | Já mitigado pela `DT-002` (motor em 2 passagens: detecta todas as hospedagens válidas do lote antes de calcular os limites diários da Fase B). |
| Diferença de quebra de linha (CRLF vs LF) ou encoding UTF-8 ao ler/escrever JSON no Windows vs Linux/macOS | Baixa | Ler e escrever arquivos explicitamente com `encoding: "utf-8"` e formatar saída com `JSON.stringify(resultado, null, 2) + "\n"`. |
