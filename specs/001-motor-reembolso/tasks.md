# Tasks — Motor de Cálculo de Reembolso

> Cada task é pequena o bastante para virar **um commit**. Se você não consegue
> descrever o critério de aceite como "o teste X passa", a task está grande demais.
>
> Marque `[x]` conforme conclui — ao longo do caminho, não tudo no fim. O histórico
> de quando cada task foi marcada é lido na correção.

**Formato do commit:** `feat(T-003): <descrição>` · `test(T-003): <descrição>`

---

## Fase 1 — Fundação

- [x] **T-001** — Configurar projeto Node.js/TypeScript, Vitest, tipos de domínio (`src/domain/types.ts`) e configuração declarativa da política (`src/domain/policy.ts`)
  - **Atende:** Estrutura base do `plan.md` (Seções 1, 3 e 4) e contratos da Seção 4 da `spec.md`
  - **Aceite:** `npm run typecheck` e `npm test` executam com sucesso validando `tests/policy.test.ts` (verifica limites base de R$ 60, R$ 80, R$ 250, isenção de NF em R$ 100 e multiplicador de viagem de 150%)
  - **Commit:** `3cc17a2`

- [x] **T-002** — Implementar módulo de aritmética monetária em centavos com arredondamento Half-Up (`src/domain/money.ts`) e normalização textual/categorias (`src/domain/normalizer.ts`)
  - **Atende:** RN-009, RN-010, AMB-008, AMB-009, D-001
  - **Aceite:** Testes em `tests/money-and-normalizer.test.ts` passam (`33.333` -> `3333` centavos / `33.33`, `100.01` -> `10001` centavos, `-45.00` -> `-4500` centavos, `"  ALIMENTACAO "` -> `"alimentacao"`)
  - **Commit:** `18a5755`

## Fase 2 — Regras de negócio

- [ ] **T-003** — Implementar validações eliminatórias de valor positivo (`RN-008`), período de competência (`RN-006`) e categoria elegível (`RN-001`) no motor de domínio (`src/domain/engine.ts`)
  - **Atende:** RN-001, RN-006, RN-008, AMB-007, AMB-010
  - **Aceite:** Testes em `tests/eliminatory-rules.test.ts` passam (recusa `valor <= 0` com `RN-008` e `valor_glosado = 0`, recusa data fora de `[inicio, fim]` com `RN-006`, aceita sábado dentro da competência, e recusa categoria `"coworking"` com `RN-001`)
  - **Commit:** `<pendente>`

- [ ] **T-004** — Implementar detecção de duplicatas (`RN-007`) e validação de obrigatoriedade de nota fiscal acima de R$ 100,00 (`RN-004`) na Fase A do motor
  - **Atende:** RN-004, RN-007, AMB-005, AMB-006, AMB-011, D-001
  - **Aceite:** Testes em `tests/duplicates-and-invoice.test.ts` passam (aprova 1ª ocorrência `d-006` e recusa 2ª `d-007` com `RN-007`; aceita R$ 100,00 sem NF `d-003` e recusa R$ 100,01 sem NF `d-004` com `RN-004`)
  - **Commit:** `<pendente>`

- [ ] **T-005** — Implementar Fase B do motor: detecção de dias em viagem (+50% via hospedagem válida, `RN-005`), consumo de limites diários agregados (`RN-002`), reembolso parcial (`RN-003`) e consolidação do resumo do lote
  - **Atende:** RN-002, RN-003, RN-005, AMB-001, AMB-002, AMB-003, AMB-004
  - **Aceite:** Testes em `tests/daily-limits-and-travel.test.ts` passam (`d-001` recebe R$ 60,00 `parcial` com `RN-003` e `d-002` recebe R$ 0,00 `recusada` com `RN-002`; `d-010` ativa viagem em `2026-07-14` e recebe R$ 375,00 `parcial`; `d-013` sem NF é recusada por `RN-004` e não ativa viagem)
  - **Commit:** `<pendente>`

## Fase 3 — Casos de borda

- [ ] **T-006** — Criar suíte completa de casos de borda, precedência entre regras e teste de contrato ponta a ponta contra `exemplos/despesas-exemplo.json`
  - **Atende:** AMB-001 a AMB-011, Seções 7, 8 e 9 da `spec.md`
  - **Aceite:** Testes em `tests/edge-cases-and-example.test.ts` passam, validando os 14 itens de `exemplos/despesas-exemplo.json` (3 aprovadas, 4 parciais, 7 recusadas, `valor_total_solicitado = 1817.84`, `valor_total_reembolsado = 710.43`) e invariância de ordem na detecção de viagem
  - **Commit:** `<pendente>`

## Fase 4 — Saída e CLI

- [ ] **T-007** — Implementar validação de schema de entrada, leitura/escrita de arquivos JSON (`src/io/schema.ts`, `src/io/file-io.ts`), CLI (`src/cli/index.ts`) com comando `calcular --input <arq> --output <arq>` e atualizar `README.md`
  - **Atende:** Interface CLI fixa do `DESAFIO.md` e Seção 4 da `spec.md`
  - **Aceite:** Testes em `tests/cli-and-io.test.ts` passam e a execução real via linha de comando `npm run reembolso -- calcular --input exemplos/despesas-exemplo.json --output resultado.json` gera o JSON válido esperado
  - **Commit:** `<pendente>`

---

## Fase 5 — Envelope (criar no Dia 2)

<Novas tasks a partir da mudança de requisito. Numeração continua de onde parou (`T-008`...) —
não reinicie e não renumere as antigas: a numeração é o eixo da rastreabilidade.>

---

## Cobertura

Matriz de rastreabilidade `Regra / Ambiguidade da spec → Task → Teste`:

| Regra da spec | Task | Teste |
|---|---|---|
| RN-001 (Categorias elegíveis) | T-003, T-006 | `tests/eliminatory-rules.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-002 (Limites diários agregados) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-003 (Reembolso parcial por corte) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-004 (Nota fiscal > R$ 100,00) | T-004, T-006 | `tests/duplicates-and-invoice.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-005 (Ampliação +50% em dia de viagem) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-006 (Período de competência) | T-003, T-006 | `tests/eliminatory-rules.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-007 (Detecção de duplicatas) | T-004, T-006 | `tests/duplicates-and-invoice.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-008 (Recusa de valores <= 0 / estornos) | T-003, T-006 | `tests/eliminatory-rules.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-009 (Normalização de categoria) | T-002, T-006 | `tests/money-and-normalizer.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-010 (Arredondamento Half-Up 2 casas) | T-002, T-006 | `tests/money-and-normalizer.test.ts`, `tests/edge-cases-and-example.test.ts` |
| AMB-001 (Agregação diária vs por item) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts` |
| AMB-002 (Corte parcial vs saldo zerado) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts` |
| AMB-003 (1 diária por lançamento de hospedagem) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts` |
| AMB-004 (Inferência de dia em viagem +50%) | T-005, T-006 | `tests/daily-limits-and-travel.test.ts` |
| AMB-005 (Fronteira estrita > R$ 100,00 para NF) | T-004, T-006 | `tests/duplicates-and-invoice.test.ts` |
| AMB-006 (Chave e tratamento de duplicata) | T-004, T-006 | `tests/duplicates-and-invoice.test.ts` |
| AMB-007 (Tratamento de estorno/valor negativo) | T-003, T-006 | `tests/eliminatory-rules.test.ts` |
| AMB-008 (Arredondamento Half-Up de 3+ casas) | T-002, T-006 | `tests/money-and-normalizer.test.ts` |
| AMB-009 (Case-insensitivity em categoria) | T-002, T-006 | `tests/money-and-normalizer.test.ts` |
| AMB-010 (Datas de competência e fins de semana) | T-003, T-006 | `tests/eliminatory-rules.test.ts` |
| AMB-011 (Ordem de precedência e não consumo de teto) | T-004, T-005, T-006 | `tests/edge-cases-and-example.test.ts` |
