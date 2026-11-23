# Log de Decisões e Mudanças de Spec

> Uma entrada **toda vez** que a spec mudar. Este arquivo é a prova de que a spec
> foi tratada como artefato vivo e não como cerimônia de abertura.
>
> Spec que não muda em dois dias é spec que ninguém consultou. Mudança não é
> demérito — mudança não registrada é.

Ordem cronológica inversa: a mais recente primeiro.

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
