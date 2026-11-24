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

- [x] **T-003** — Implementar validações eliminatórias de valor positivo (`RN-008`), período de competência (`RN-006`) e categoria elegível (`RN-001`) no motor de domínio (`src/domain/engine.ts`)
  - **Atende:** RN-001, RN-006, RN-008, AMB-007, AMB-010
  - **Aceite:** Testes em `tests/eliminatory-rules.test.ts` passam (recusa `valor <= 0` com `RN-008` e `valor_glosado = 0`, recusa data fora de `[inicio, fim]` com `RN-006`, aceita sábado dentro da competência, e recusa categoria `"coworking"` com `RN-001`)
  - **Commit:** `84bbb8c`

- [x] **T-004** — Implementar detecção de duplicatas (`RN-007`) e validação de obrigatoriedade de nota fiscal acima de R$ 100,00 (`RN-004`) na Fase A do motor
  - **Atende:** RN-004, RN-007, AMB-005, AMB-006, AMB-011, D-001
  - **Aceite:** Testes em `tests/duplicates-and-invoice.test.ts` passam (aprova 1ª ocorrência `d-006` e recusa 2ª `d-007` com `RN-007`; aceita R$ 100,00 sem NF `d-003` e recusa R$ 100,01 sem NF `d-004` com `RN-004`)
  - **Commit:** `de9d260`

- [x] **T-005** — Implementar Fase B do motor: detecção de dias em viagem (+50% via hospedagem válida, `RN-005`), consumo de limites diários agregados (`RN-002`), reembolso parcial (`RN-003`) e consolidação do resumo do lote
  - **Atende:** RN-002, RN-003, RN-005, AMB-001, AMB-002, AMB-003, AMB-004
  - **Aceite:** Testes em `tests/daily-limits-and-travel.test.ts` passam (`d-001` recebe R$ 60,00 `parcial` com `RN-003` e `d-002` recebe R$ 0,00 `recusada` com `RN-002`; `d-010` ativa viagem em `2026-07-14` e recebe R$ 375,00 `parcial`; `d-013` sem NF é recusada por `RN-004` e não ativa viagem)
  - **Commit:** `7a50b16`

## Fase 3 — Casos de borda

- [x] **T-006** — Criar suíte completa de casos de borda, precedência entre regras e teste de contrato ponta a ponta contra `exemplos/despesas-exemplo.json`
  - **Atende:** AMB-001 a AMB-011, Seções 7, 8 e 9 da `spec.md`
  - **Aceite:** Testes em `tests/edge-cases-and-example.test.ts` passam, validando os 14 itens de `exemplos/despesas-exemplo.json` (3 aprovadas, 4 parciais, 7 recusadas, `valor_total_solicitado = 1816.84`, `valor_total_reembolsado = 710.43`) e invariância de ordem na detecção de viagem
  - **Commit:** `f92f82a` (atualizado com D-002)

## Fase 4 — Saída e CLI

- [x] **T-007** — Implementar validação de schema de entrada, leitura/escrita de arquivos JSON (`src/io/schema.ts`, `src/io/file-io.ts`), CLI (`src/cli/index.ts`) com comando `calcular --input <arq> --output <arq>` e atualizar `README.md`
  - **Atende:** Interface CLI fixa do `DESAFIO.md` e Seção 4 da `spec.md`
  - **Aceite:** Testes em `tests/cli-and-io.test.ts` passam e a execução real via linha de comando `npm run reembolso -- calcular --input exemplos/despesas-exemplo.json --output resultado.json` gera o JSON válido esperado
  - **Commit:** `67f2fd6`

---

## Fase 5 — Envelope (Dia 2 — Política v4 / `D-003`)

- [ ] **T-008** — Evoluir tipos de domínio e política declarativa (`src/domain/types.ts`, `src/domain/policy.ts`) para suportar categorias dinâmicas, política por centro de custo (`padrao` + `centrosCusto`, `limite == 0` inelegível) e limiar de aprovação manual (R$ 500,00)
  - **Atende:** RN-001, RN-011, RN-013, AMB-012, AMB-013, AMB-018, D-003
  - **Aceite:** Testes em `tests/policy.test.ts` passam cobrindo `CC-COMERCIAL` (`representacao`), `CC-ENG-PLATAFORMA` (`hospedagem: 0` inelegível), `CC-ADM` (herança de `padrao`) e `CC-SUPORTE-N2` (fallback para `padrao`)
  - **Commit:** `<pendente>`

- [ ] **T-009** — Implementar módulo puro de conversão cambial com fallback para último dia útil anterior (`src/domain/exchange.ts`)
  - **Atende:** RN-012, AMB-014, AMB-015, D-003
  - **Aceite:** Testes em `tests/exchange.test.ts` passam cobrindo `BRL` (taxa 1), `EUR`/`USD` em dia útil, sábado `2026-07-18` usando sexta `2026-07-17` (`5.96`), e moeda ausente `GBP` retornando `null`
  - **Commit:** `<pendente>`

- [ ] **T-010** — Integrar política por CC (`RN-011`), conversão cambial (`RN-012`), viagem internacional (`RN-005`/`AMB-017`) e fila de aprovação manual > R$ 500 (`RN-013`) no motor (`src/domain/engine.ts`)
  - **Atende:** RN-001, RN-004, RN-005, RN-011, RN-012, RN-013, AMB-012 a AMB-018, D-003
  - **Aceite:** Todos os testes anteriores (v3) continuam passando e os novos testes em `tests/envelope-v4.test.ts` validam 100% de `despesas-envelope.json` (`828.72` reembolsado + `600.00` pendente) e `despesas-envelope-cc-desconhecido.json` (`433.76` reembolsado)
  - **Commit:** `<pendente>`

- [ ] **T-011** — Implementar loaders externos de política e câmbio (`src/io/policy-io.ts`, `src/io/exchange-io.ts`), flags opcionais `--policy` e `--cambio` na CLI (`src/cli/index.ts`), suporte a `moeda` opcional no schema (`src/io/schema.ts`) e atualizar `README.md`
  - **Atende:** Política v4 (Itens A e B), retrocompatibilidade da CLI v3, `D-003`
  - **Aceite:** Testes em `tests/cli-and-io.test.ts` passam e execução real da CLI com `--policy exemplos/envelope/politica-v4.json --cambio exemplos/envelope/cambio.json` produz a saída exata esperada para ambos os arquivos do envelope
  - **Commit:** `<pendente>`

---

## Cobertura

Matriz de rastreabilidade `Regra / Ambiguidade da spec → Task → Teste`:

| Regra da spec | Task | Teste |
|---|---|---|
| RN-001 (Categorias elegíveis por CC) | T-003, T-006, T-008, T-010 | `tests/eliminatory-rules.test.ts`, `tests/policy.test.ts`, `tests/envelope-v4.test.ts` |
| RN-002 (Limites diários agregados) | T-005, T-006, T-010 | `tests/daily-limits-and-travel.test.ts`, `tests/envelope-v4.test.ts` |
| RN-003 (Reembolso parcial por corte) | T-005, T-006, T-010 | `tests/daily-limits-and-travel.test.ts`, `tests/envelope-v4.test.ts` |
| RN-004 (Nota fiscal > R$ 100,00 em BRL) | T-004, T-006, T-010 | `tests/duplicates-and-invoice.test.ts`, `tests/envelope-v4.test.ts` |
| RN-005 (Ampliação +50% em dia de viagem) | T-005, T-006, T-010 | `tests/daily-limits-and-travel.test.ts`, `tests/envelope-v4.test.ts` |
| RN-006 (Período de competência) | T-003, T-006 | `tests/eliminatory-rules.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-007 (Detecção de duplicatas) | T-004, T-006 | `tests/duplicates-and-invoice.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-008 (Recusa de valores <= 0 / estornos) | T-003, T-006 | `tests/eliminatory-rules.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-009 (Normalização de categoria) | T-002, T-006 | `tests/money-and-normalizer.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-010 (Arredondamento Half-Up 2 casas) | T-002, T-006 | `tests/money-and-normalizer.test.ts`, `tests/edge-cases-and-example.test.ts` |
| RN-011 (Política externa por centro de custo) | T-008, T-010, T-011 | `tests/policy.test.ts`, `tests/envelope-v4.test.ts`, `tests/cli-and-io.test.ts` |
| RN-012 (Conversão cambial com fallback dia útil) | T-009, T-010, T-011 | `tests/exchange.test.ts`, `tests/envelope-v4.test.ts`, `tests/cli-and-io.test.ts` |
| RN-013 (Fila de aprovação manual > R$ 500,00) | T-008, T-010 | `tests/envelope-v4.test.ts` |
| AMB-001 a AMB-011 (Ambiguidades v3) | T-002 a T-006 | `tests/money-and-normalizer.test.ts` .. `tests/edge-cases-and-example.test.ts` |
| AMB-012 a AMB-018 (Ambiguidades v4) | T-008 a T-011 | `tests/policy.test.ts`, `tests/exchange.test.ts`, `tests/envelope-v4.test.ts` |
