# Session Export — 02: Plano Técnico (`plan.md`), Tasks (`tasks.md`) e Decisão `D-001`

- **Project:** `sdd-desafio`
- **Session:** `02-plano-tecnico-e-tasks`
- **Artifacts:** `specs/001-motor-reembolso/DECISIONS.md`, `specs/001-motor-reembolso/spec.md` (v1.1), `specs/001-motor-reembolso/plan.md`, `specs/001-motor-reembolso/tasks.md`

---

## User

beleza, e o decisions.md? nao entra agora?

---

## Assistant

O `DECISIONS.md` registra qualquer mudança ou refinamento que a gente faça na `spec.md` depois da versão 1.0 inicial.

Inclusive, revisando a `spec.md` v1.0 para desenhar a arquitetura no `plan.md`, encontrei um detalhe na `RN-007` (Duplicatas) e no item 5 da Seção 8 que ficou com dupla interpretação:
- Na Seção 8 da v1.0 estava escrito: *"o registro na tabela de duplicatas vistas ocorre antes da validação de NF ou após a validação de categoria"*.
- Se uma despesa inválida (ex: fora do período de competência ou categoria fora da política) fosse registrada na tabela de duplicatas, ou se não definíssemos se múltiplos espaços internos em `fornecedor`/`descricao` são colapsados, duas implementações poderiam divergir.

Quer que eu atualize a `spec.md` para v1.1 fixando que só entram na verificação de duplicatas as despesas que passaram pelas etapas 2, 3 e 4 (registrando na etapa 5, antes da validação de NF na etapa 6, e colapsando espaços internos múltiplos), e já registre isso como **`D-001`** no `DECISIONS.md`?

---

## User

boa, pode ajustar isso na spec e registrar o D-001 no DECISIONS.md. depois ja monta o plan.md e o tasks.md com a arquitetura em node/ts

---

## Assistant

Atualizei a `spec.md` para a versão 1.1 e registrei a entrada `D-001` em `specs/001-motor-reembolso/DECISIONS.md`.

Em seguida, estruturei o `specs/001-motor-reembolso/plan.md` com as decisões técnicas:
1. **Stack:** TypeScript 5.x (Node.js >= 20, ESM) e Vitest para testes, sem dependências externas de runtime (`DT-004`).
2. **Aritmética monetária (`DT-001`):** Conversão na entrada para centavos inteiros (`Cents = number`) usando arredondamento Half-Up determinístico (`src/domain/money.ts`), evitando qualquer soma ou multiplicação em ponto flutuante binário.
3. **Arquitetura (`DT-002`):** Separação entre núcleo puro (`src/domain/`) e camada de I/O e CLI (`src/io/`, `src/cli/`). O motor roda em duas passagens (Fase A eliminatória -> identificação de todas as datas com hospedagem válida para `em_viagem = true` -> Fase B de limites diários), garantindo que a ordem entre uma despesa de alimentação e uma de hospedagem no mesmo dia não altere a detecção de viagem.
4. **Datas (`DT-003`):** Comparação lexicográfica direta em formato ISO-8601 (`AAAA-MM-DD`), sem instanciar `new Date()`, eliminando bugs de fuso horário.
5. **Política declarativa (`src/domain/policy.ts`):** Objeto `DEFAULT_POLICY` centralizando limites base, teto de isenção de NF (R$ 100,00) e multiplicador de viagem (+50%).

Também montei o `specs/001-motor-reembolso/tasks.md` dividido em 7 tasks atômicas (`T-001` a `T-007`) nas Fases 1 a 4, com a Matriz de Cobertura ligando `RN-001..RN-010` e `AMB-001..AMB-011` às tasks e arquivos de teste:
- **Fase 1 (Fundação):**
  - `T-001`: Configuração TypeScript/Vitest, tipos (`src/domain/types.ts`) e política (`src/domain/policy.ts`).
  - `T-002`: Aritmética em centavos Half-Up (`src/domain/money.ts`) e normalização (`src/domain/normalizer.ts`).
- **Fase 2 (Regras de negócio):**
  - `T-003`: Regras eliminatórias iniciais (`RN-008` valor positivo, `RN-006` competência, `RN-001` categoria elegível).
  - `T-004`: Detecção de duplicatas (`RN-007`) e nota fiscal > R$ 100,00 (`RN-004`).
  - `T-005`: Fase B — dias em viagem (+50%, `RN-005`), limites diários agregados (`RN-002`), reembolso parcial (`RN-003`) e resumo do lote.
- **Fase 3 (Casos de borda):**
  - `T-006`: Casos de borda, precedência (`AMB-001` a `AMB-011`) e teste ponta a ponta com `exemplos/despesas-exemplo.json`.
- **Fase 4 (Saída e CLI):**
  - `T-007`: Validação de schema, leitura/escrita de arquivo, CLI (`calcular --input ... --output ...`) e documentação no `README.md`.

Pode revisar `DECISIONS.md`, `plan.md` e `tasks.md` para confirmarmos os commits?

---

## User

tudo certo, pode commitar
