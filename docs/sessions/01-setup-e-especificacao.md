# Session Export — 01: Setup e Especificação (`spec.md` v1.0)

- **Project:** `sdd-desafio`
- **Session:** `01-setup-e-especificacao`
- **Artifacts:** `CLAUDE.md`, `specs/001-motor-reembolso/spec.md`

---

## User

analise o projeto atual e me diga do que se trata arquitetura, regra que precisa seguir

---

## Assistant

Analisei os arquivos do repositório (`README.md`, `DESAFIO.md`, `RUBRICA.md`, `FAQ.md`, `exemplos/despesas-exemplo.json` e os templates em `template/`).

### 1. O que é o projeto
É um motor de cálculo de reembolso de despesas corporativas via CLI:
```bash
<seu-comando> calcular --input despesas.json --output resultado.json
```
O programa recebe as despesas de um colaborador num período (`exemplos/despesas-exemplo.json`), aplica a Política de Reembolso v3 do RH e gera um JSON dizendo quanto é reembolsável e justificando a decisão de cada item.

### 2. Regras de processo e arquitetura (SDD)
1. **Ordem dos artefatos:** `spec.md` (o quê e porquê, zero menção a código/biblioteca) -> `plan.md` (stack, arquitetura Core vs I/O, aritmética monetária) -> `tasks.md` (tarefas atômicas) -> código e testes.
2. **Nenhum commit sem task:** Commits de código usam `feat(T-001): ...` ou `test(T-001): ...`. Documentação usa `docs(spec): ...`, `docs(plan): ...`, `docs(tasks): ...`.
3. **Zero regra fora da spec:** Toda decisão sobre as ambiguidades da política do RH precisa estar escrita na `spec.md`. Se a spec mudar depois, registra no `DECISIONS.md`.
4. **Sessões exportadas:** Salvar o histórico das sessões em `docs/sessions/`.

Qual stack você prefere usar para copiarmos a estrutura do `template/` e começarmos?

---

## User

Sim prefiro node/ts

---

## Assistant

Copiei os arquivos de `template/` (`CLAUDE.md`, `specs/`, `docs/`) para a raiz e fiz o commit inicial (`chore: estrutura inicial a partir do template`).

Vamos decidir cada ambiguidade da Política do RH cruzada com `exemplos/despesas-exemplo.json`, uma por uma.

**Pergunta 1 — AMB-001 e AMB-002 (Limites diários e Reembolso parcial - `d-001` e `d-002`):**
Em `2026-07-03`, há duas despesas de `alimentacao`: `d-001` (R$ 72,50) e `d-002` (R$ 38,00). O limite de Alimentação (R$ 60/dia) e Transporte (R$ 80/dia) aplica-se ao total somado do dia ou por item individual? E "reembolsado parcialmente" significa pagar até o teto e cortar o excedente?
- **(Recommended)** Limite agregado por data e categoria (R$ 60/dia total): processa na ordem da lista; `d-001` recebe R$ 60,00 (parcial) e `d-002` recebe R$ 0,00 (limite diário esgotado)
- Limite aplicado individualmente por despesa (cada lançamento de alimentação limitado a R$ 60,00)
- Limite agregado por data, mas rateado proporcionalmente entre as despesas do mesmo dia

---

## User

Limite agregado por data e categoria (R$ 60/dia total): processa na ordem da lista; d-001 recebe R$ 60,00 (parcial) e d-002 recebe R$ 0,00 (limite diário esgotado)

---

## Assistant

**Pergunta 2 — AMB-003 (Hospedagem "R$ 250 por diária" sem campo de quantidade de diárias no JSON - `d-010` e `d-013`):**
Como calcular o teto de hospedagem quando a descrição diz `"Hotel Rio - 2 diarias"` (`d-010`, R$ 480,00) ou `"Airbnb 3 noites"` (`d-013`, R$ 690,00), mas o JSON não tem campo de quantidade de diárias?
- **(Recommended)** Como o schema de entrada não possui campo estruturado de quantidade de diárias, cada lançamento de hospedagem é tratado como 1 diária (teto de R$ 250,00 base / R$ 375,00 em viagem), sem fazer parsing de texto livre na descrição
- Extrair o número de diárias/noites via regex da descrição (ex: "2 diarias" -> 2 x R$ 250 = R$ 500; se não encontrar número, assume 1 diária)

---

## User

Como o schema de entrada não possui campo estruturado de quantidade de diárias, cada lançamento de hospedagem é tratado como 1 diária (teto de R$ 250,00 base / R$ 375,00 em viagem), sem fazer parsing de texto livre na descrição

---

## Assistant

**Pergunta 3 — AMB-004 (Colaborador "em viagem" tem limites ampliados em 50% - Regra 6):**
Não existe campo `em_viagem` no JSON de entrada. Qual regra devemos adotar na `spec.md` v1.0?
- **(Recommended)** Não inferir viagem por heurística: como não há campo `em_viagem` na entrada, o multiplicador de +50% não é ativado por padrão (aplicam-se os limites base), documentando o dado ausente na spec
- Inferir "em viagem" nas datas cobertas por uma despesa válida de categoria `hospedagem` (ex: no dia da hospedagem, limites sobem +50%)
- Inferir "em viagem" para todo o período se houver pelo menos uma despesa de `hospedagem` no lote

---

## User

Inferir "em viagem" nas datas cobertas por uma despesa válida de categoria `hospedagem` (ex: no dia da hospedagem, limites sobem +50%)

---

## Assistant

**Pergunta 4 — AMB-005 (Nota Fiscal "obrigatória acima de R$ 100" - `d-003` R$ 100,00 e `d-004` R$ 100,01):**
A comparação é estrita (`> 100.00`) sobre o valor original da despesa?
- **(Recommended)** Estritamente maior que R$ 100,00 (`valor original > 100.00` exige NF): `d-003` (R$ 100,00 sem NF) é aceita e reembolsa até o teto diário (R$ 80,00); `d-004` (R$ 100,01 sem NF) é recusada por falta de NF e não consome o teto diário
- Maior ou igual a R$ 100,00 (`valor >= 100.00` exige NF): tanto `d-003` quanto `d-004` são recusadas por falta de NF

---

## User

Estritamente maior que R$ 100,00 (valor original > 100.00 exige NF): d-003 (R$ 100,00 sem NF) é aceita e reembolsa até o teto diário (R$ 80,00); d-004 (R$ 100,01 sem NF) é recusada por falta de NF e não consome o teto diário

---

## Assistant

**Pergunta 5 — AMB-006 (Tratamento de Duplicatas - `d-006` e `d-007`):**
Qual o critério de duplicata e o que fazer quando encontrada?
- **(Recommended)** Duplicata = mesma data + categoria (normalizada) + fornecedor + valor + descrição: aprova a 1ª ocorrência (`d-006` = R$ 54,90) e recusa a 2ª (`d-007` = R$ 0,00) como duplicata, sem que a duplicata consuma o limite diário
- Duplicata = mesma data + categoria + fornecedor + valor + descrição: recusa AMBAS as ocorrências por suspeita de duplicidade

---

## User

Duplicata = mesma data + categoria (normalizada) + fornecedor + valor (ou também descrição): aprova a 1ª ocorrência (d-006 = R$ 54,90) e recusa a 2ª (d-007 = R$ 0,00) como duplicata, sem que a duplicata consuma o limite diário

---

## Assistant

**Pergunta 6 — AMB-007 e AMB-008 (Estorno/Valor negativo `d-009` = -45.00 e Precisão decimal `d-011` = 33.333):**
Como tratar valores `<= 0` e valores com mais de 2 casas decimais?
- **(Recommended)** Valores `<= 0` (como `d-009`: -45.00) são recusados/não reembolsáveis (reembolso = R$ 0,00) pois reembolso só se aplica a desembolsos positivos; e valores com mais de 2 casas decimais (`d-011`: 33.333) são arredondados para 2 casas (Half-Up -> 33.33) antes do cálculo
- Valores negativos (estornos) são deduzidos do total reembolsável do colaborador; e valores com >2 casas decimais são arredondados com Half-Up (33.33)

---

## User

Valores <= 0 (como d-009: -45.00) são recusados/não reembolsáveis (reembolso = R$ 0,00) pois reembolso só se aplica a desembolsos positivos; e valores com mais de 2 casas decimais (d-011: 33.333) são arredondados para 2 casas (Half-Up -> 33.33) antes do cálculo

---

## Assistant

**Pergunta 7 — AMB-009, AMB-010, AMB-011 e detalhe da AMB-004 (Normalização de categoria `d-014` `"ALIMENTACAO"`, Fim de semana `d-012` sábado, precedência e escopo do +50% de viagem no dia da hospedagem):**
Confirma o comportamento abaixo?
- **(Recommended)** Sim para todos: normalizar categoria (`trim` + `lowercase` -> `"ALIMENTACAO"` vira `"alimentacao"`), aceitar fins de semana dentro da competência (`d-012` aprovado), rodar regras eliminatórias antes de consumir limite diário, e na AMB-004 (viagem) aplicar +50% na data da hospedagem válida para todas as categorias daquele dia (incluindo a própria hospedagem: R$ 250 -> R$ 375)
- Normalizar categoria e aceitar fins de semana, mas na AMB-004 (viagem) o bônus de +50% na data da hospedagem só amplia alimentação (R$ 90) e transporte (R$ 120), mantendo hospedagem em R$ 250

---

## User

Sim para todos: normalizar categoria (trim + lowercase -> "ALIMENTACAO" vira "alimentacao"), aceitar fins de semana dentro da competência (d-012 aprovado), e na AMB-004 (viagem) aplicar +50% na data da hospedagem válida para todas as categorias daquele dia (incluindo a própria hospedagem: R$ 250 -> R$ 375)

---

## Assistant

Todas as 11 ambiguidades estão decididas! Aqui está a simulação completa em `exemplos/despesas-exemplo.json` com essas regras:

| ID | Data | Categoria | Valor Orig. | NF | Status | Reembolsado | Regra |
|---|---|---|---:|:---:|---|---:|---|
| `d-001` | 2026-07-03 | `alimentacao` | 72.50 | Sim | `parcial` | **60.00** | `RN-003` (teto diário R$ 60,00) |
| `d-002` | 2026-07-03 | `alimentacao` | 38.00 | Sim | `recusada` | **0.00** | `RN-002` (saldo diário esgotado por `d-001`) |
| `d-003` | 2026-07-06 | `transporte_urbano` | 100.00 | Não | `parcial` | **80.00** | `RN-004` (<= 100 dispensa NF) + `RN-003` (teto R$ 80,00) |
| `d-004` | 2026-07-06 | `transporte_urbano` | 100.01 | Não | `recusada` | **0.00** | `RN-004` (> 100 sem NF) |
| `d-005` | 2026-07-07 | `coworking` | 89.00 | Sim | `recusada` | **0.00** | `RN-001` (categoria fora da política) |
| `d-006` | 2026-07-09 | `alimentacao` | 54.90 | Sim | `aprovada` | **54.90** | `RN-002` (dentro do teto de R$ 60,00) |
| `d-007` | 2026-07-09 | `alimentacao` | 54.90 | Sim | `recusada` | **0.00** | `RN-007` (duplicata de `d-006`) |
| `d-008` | 2026-04-15 | `alimentacao` | 41.00 | Sim | `recusada` | **0.00** | `RN-006` (fora da competência 2026-07) |
| `d-009` | 2026-07-11 | `transporte_urbano` | -45.00 | Não | `recusada` | **0.00** | `RN-008` (valor não positivo) |
| `d-010` | 2026-07-14 | `hospedagem` | 480.00 | Sim | `parcial` | **375.00** | `RN-005` + `RN-003` (dia em viagem +50% -> teto R$ 375,00) |
| `d-011` | 2026-07-15 | `alimentacao` | 33.333 | Sim | `aprovada` | **33.33** | `RN-010` (arredondado 33.33) + `RN-002` |
| `d-012` | 2026-07-18 | `alimentacao` | 47.20 | Sim | `aprovada` | **47.20** | `RN-006` + `RN-002` (sábado permitido) |
| `d-013` | 2026-07-22 | `hospedagem` | 690.00 | Não | `recusada` | **0.00** | `RN-004` (> 100 sem NF, não ativa viagem) |
| `d-014` | 2026-07-31 | `ALIMENTACAO` | 61.00 | Sim | `parcial` | **60.00** | `RN-009` (normalizada) + `RN-003` (teto R$ 60,00) |

- **Resumo:** 3 aprovadas, 4 parciais, 7 recusadas | `valor_total_solicitado`: **1817.84** | `valor_total_reembolsado`: **710.43**.

Você aprova esse design da `spec.md` e o `CLAUDE.md` preenchido com Node/TypeScript para eu escrevê-los e commitá-los agora?

---

## User

aprovado
