# Log de Decisões e Mudanças de Spec

> Uma entrada **toda vez** que a spec mudar. Este arquivo é a prova de que a spec
> foi tratada como artefato vivo e não como cerimônia de abertura.
>
> Spec que não muda em dois dias é spec que ninguém consultou. Mudança não é
> demérito — mudança não registrada é.

Ordem cronológica inversa: a mais recente primeiro.

---

## D-003 — Absorção do Envelope Lacrado (Política de Reembolso v4: política externa por CC, câmbio e fila > R$ 500) · `2026-11-24`

**Gatilho:** Envelope lacrado do Dia 2 (`exemplos/envelope/00-ENVELOPE-LACRADO.md`), introduzindo política externa por centro de custo (`politica-v4.json`), despesas em moeda estrangeira com tabela de câmbio (`cambio.json`) e fila de aprovação manual acima de R$ 500,00 (Item C).

**O que mudou na spec:**
- **De (`spec.md` v1.2):** Lista fechada de 3 categorias fixas (`RN-001`), apenas moeda `BRL` (Seção 3), `em_viagem` ativado apenas por `hospedagem` válida (`RN-005`), e 3 estados de avaliação (`aprovada`, `parcial`, `recusada`).
- **Para (`spec.md` v2.0):**
  - Adicionadas regras `RN-011` (política externa por `centro_custo` com herança de `padrao` e bloqueio de `limite == 0.00`), `RN-012` (conversão cambial por data com fallback para o último dia útil anterior e recusa de moeda sem cotação) e `RN-013` (status `pendente_aprovacao` para `valor_reembolsado > 500.00` contabilizado separadamente em `resumo.valor_total_pendente_aprovacao`).
  - Atualizadas `RN-001` (categorias dinâmicas por CC), `RN-005` (`em_viagem` também ativado por despesa válida em moeda estrangeira), Seção 3 (Fora de escopo) e Seção 4 (novos campos `moeda_original`, `taxa_cambio_aplicada`, `quantidade_pendentes_aprovacao`, `valor_total_pendente_aprovacao`).
  - Registradas 7 novas ambiguidades (`AMB-012` a `AMB-018`).

**Por quê:** A Política v4 revogou a tabela única da v3 e passou a exigir parametrização externa mantida pelo financeiro, suporte a despesas internacionais convertidas pela PTAX da data e alçada de aprovação manual acima de R$ 500,00.

**O que isso invalidou:**
- O tipo fechado `CategoriaElegivel = "alimentacao" | "transporte_urbano" | "hospedagem"` em `src/domain/types.ts` (agora categorias são strings dinâmicas definidas pela política externa, como `"representacao"`).
- O item da Seção 3 da `spec.md` que colocava conversão de moedas fora de escopo.
- Testes de contrato que comparavam o objeto `resumo` exato precisaram incluir os novos campos `quantidade_pendentes_aprovacao: 0` e `valor_total_pendente_aprovacao: 0` (mantendo 100% dos valores e comportamentos da v3 retrocompatíveis).

**Tasks afetadas:** Criadas novas tasks na Fase 5 de `tasks.md`: `T-008`, `T-009`, `T-010` e `T-011`.

**Custo:** ~10 minutos de execução end-to-end; 8 arquivos de código tocados/criados em `src/` (5 editados + 3 novos, preservando intocados `money.ts`, `normalizer.ts` e `file-io.ts`); diff total `git diff 0ca129b 26c5f13 --stat`: 23 arquivos, +1433/-138 linhas (incluindo os 5 arquivos de `exemplos/envelope/` e 2 novos arquivos de teste).

---

## D-002 — Correção do valor esperado de `valor_total_solicitado` na Seção 9 (`exemplos/despesas-exemplo.json`) · `2026-11-23`

**Gatilho:** Falha no teste de contrato `T-006` (`tests/edge-cases-and-example.test.ts`), que calculou `1816.84` contra `1817.84` documentado na Seção 9 da `spec.md`.

**O que mudou na spec:**
- **De (`spec.md` v1.1, Seção 9):** `valor_total_solicitado` exato de **1817.84**.
- **Para (`spec.md` v1.2, Seção 9):** `valor_total_solicitado` exato de **1816.84** (`72.50 + 38.00 + 100.00 + 100.01 + 89.00 + 54.90 + 54.90 + 41.00 - 45.00 + 480.00 + 33.33 + 47.20 + 690.00 + 61.00`).

**Por quê:** A soma manual feita durante a elaboração inicial da spec v1.0 tinha um erro aritmético de R$ 1,00 a mais. O cálculo do motor revelou a divergência antes da entrega.

**O que isso invalidou:** Apenas o número esperado no critério de aceite da Seção 9 e no teste de contrato `T-006`. Nenhuma regra de negócio mudou.

**Tasks afetadas:** `T-006`.

**Custo:** 2 arquivos editados (`spec.md` e `tests/edge-cases-and-example.test.ts`), ~2 minutos.

---

## D-001 — Refinamento da chave e momento de registro de duplicatas (`RN-007`) · `2026-11-23`

**Gatilho:** Ambiguidade que apareceu ao desenhar o modelo de dados e a assinatura de normalização no `plan.md` (a nota da Seção 8 da `spec.md` v1.0 deixava em aberto se o registro na tabela de duplicatas ocorria antes da validação de NF ou após a validação de categoria, e não especificava o tratamento de múltiplos espaços internos em `fornecedor` e `descricao`).

**O que mudou na spec:**
- **De (`spec.md` v1.0, `RN-007` e Seção 8, item 5):** Textos normalizados apenas com remoção de espaços extremos e minúsculas; nota na Seção 8 dizia *"o registro na tabela de duplicatas vistas ocorre antes da validação de NF ou após a validação de categoria"*.
- **Para (`spec.md` v1.1, `RN-007` e Seção 8, item 5):** Definido explicitamente que apenas despesas que sobreviveram às etapas 2 (`RN-008`), 3 (`RN-006`) e 4 (`RN-001`) são registradas e verificadas na tabela de duplicatas (imediatamente na etapa 5, antes da validação de NF na etapa 6), e que a normalização textual da chave também colapsa múltiplos espaços internos em um único espaço.

**Por quê:** A expressão "antes de X ou após Y" na Seção 8 da v1.0 ainda permitia duas implementações diferentes caso o primeiro item de um par duplicado não tivesse nota fiscal acima de R$ 100,00. Fixar o registro exatamente na etapa 5 torna o pipeline 100% determinístico.

**O que isso invalidou:** Nenhuma regra anterior foi invalidada; eliminou-se a dupla leitura da nota da Seção 8 na v1.0 antes do início da codificação.

**Tasks afetadas:** `T-002` (normalização textual) e `T-006` (validação de duplicidade `RN-007`).

**Custo:** 1 arquivo de especificação editado (`spec.md`), ~5 minutos durante o planejamento técnico (zero retrabalho de código por ter sido capturado na fase de plano).
