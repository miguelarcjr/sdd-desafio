# Log de Decisões e Mudanças de Spec

> Uma entrada **toda vez** que a spec mudar. Este arquivo é a prova de que a spec
> foi tratada como artefato vivo e não como cerimônia de abertura.
>
> Spec que não muda em dois dias é spec que ninguém consultou. Mudança não é
> demérito — mudança não registrada é.

Ordem cronológica inversa: a mais recente primeiro.

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
