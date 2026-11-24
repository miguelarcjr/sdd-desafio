# Spec — Motor de Cálculo de Reembolso

**Versão:** 2.0 · **Status:** aprovada · **Última alteração:** `2026-11-24`

> **Regra de ouro deste arquivo:** ele descreve o QUÊ e o PORQUÊ. Nenhuma linha
> aqui pode citar linguagem, biblioteca, classe, função ou estrutura de pasta.
> Se apareceu solução, o lugar dela é o `plan.md`.
>
> **Teste de aceitação da própria spec:** uma pessoa que nunca viu o projeto
> consegue, lendo só este arquivo, verificar se o sistema está correto?

---

## 1. Problema

Atualmente, a conferência de solicitações de reembolso de despesas corporativas é realizada manualmente pela equipe financeira em planilhas, verificando item a item contra uma política textual do RH repleta de lacunas interpretativas. Esse processo manual é lento, sujeito a interpretações divergentes entre analistas e gera erros financeiros em reembolsos parciais, limites diários agregados e glosas por falta de comprovante fiscal.

## 2. Objetivo

Dado um lote de despesas de um colaborador em um período de competência, calcular de forma determinística, auditável e reproduzível o valor reembolsável de cada item e do lote, justificando cada aprovação, reembolso parcial ou recusa com referência explícita à regra de negócio aplicada.

## 3. Fora de escopo

- Não realiza persistência em banco de dados, integração com sistemas financeiros/ERP ou chamadas de rede.
- Não realiza leitura óptica de comprovantes (OCR) nem validação criptográfica de notas fiscais (confia exclusivamente no indicador booleano `tem_nota_fiscal` da entrada).
- Não interpreta texto livre do campo `descricao` para extrair metadados ausentes no schema (como quantidade de diárias ou cidades visitadas).
- Não realiza conversão de moedas além das taxas explícitas fornecidas na tabela externa de câmbio (não consulta APIs externas de cotação em tempo real).
- Não processa múltiplos colaboradores ou múltiplos períodos de competência em um mesmo arquivo de entrada.
- Não altera a ordem original das despesas fornecidas na entrada.

## 4. Entrada e saída

**Entrada:** documento estruturado conforme `exemplos/despesas-exemplo.json`. Campos e significado:

| Campo | Tipo | Significado | Obrigatório |
|---|---|---|---|
| `colaborador.id` | Texto | Identificador único do colaborador | Sim |
| `colaborador.nome` | Texto | Nome completo do colaborador | Sim |
| `colaborador.centro_custo` | Texto | Código do centro de custo do colaborador | Sim |
| `periodo.competencia` | Texto (`AAAA-MM`) | Mês e ano de referência do lote | Sim |
| `periodo.inicio` | Data (`AAAA-MM-DD`) | Data inicial inclusiva do período de competência | Sim |
| `periodo.fim` | Data (`AAAA-MM-DD`) | Data final inclusiva do período de competência | Sim |
| `despesas` | Lista de objetos | Conjunto ordenado de despesas submetidas | Sim |
| `despesas[].id` | Texto | Identificador único do lançamento no lote | Sim |
| `despesas[].data` | Data (`AAAA-MM-DD`) | Data de ocorrência da despesa | Sim |
| `despesas[].categoria` | Texto | Categoria informada pelo colaborador | Sim |
| `despesas[].descricao` | Texto | Descrição livre do gasto | Sim |
| `despesas[].fornecedor` | Texto | Nome do estabelecimento ou prestador | Sim |
| `despesas[].valor` | Número decimal | Valor monetário submetido pelo colaborador na moeda informada | Sim |
| `despesas[].moeda` | Texto (ISO 4217) | Código da moeda da despesa (`BRL`, `USD`, `EUR`, etc.). Quando omitido, assume-se `"BRL"` | Não |
| `despesas[].tem_nota_fiscal` | Booleano | Indica se há nota fiscal anexada (`true` ou `false`) | Sim |

**Entradas externas opcionais (Política v4):**
- **Tabela de Política Externa (`politica-v4.json`):** define `padrao` (limites por categoria), `centros_custo` (sobrescritas e categorias específicas por `centro_custo`), `nota_fiscal_obrigatoria_acima_de` e `acrescimo_em_viagem_percentual`.
- **Tabela de Câmbio Externa (`cambio.json`):** define `moeda_base` (`BRL`) e mapa `taxas[AAAA-MM-DD][MOEDA]` com cotações de fechamento em dias úteis.

**Saída:** documento estruturado contendo os dados do colaborador e período, um resumo consolidado do lote e a lista de avaliações individuais na mesma ordem da entrada:

| Campo | Tipo | Significado |
|---|---|---|
| `colaborador` | Objeto | Espelho exato do objeto `colaborador` recebido na entrada |
| `periodo` | Objeto | Espelho exato do objeto `periodo` recebido na entrada |
| `resumo.total_despesas` | Inteiro | Quantidade total de itens recebidos na lista `despesas` |
| `resumo.quantidade_aprovadas` | Inteiro | Quantidade de itens com status `"aprovada"` (reembolso integral automático) |
| `resumo.quantidade_parciais` | Inteiro | Quantidade de itens com status `"parcial"` (reembolso parcial automático) |
| `resumo.quantidade_pendentes_aprovacao` | Inteiro | Quantidade de itens com status `"pendente_aprovacao"` (reembolsável > R$ 500,00 aguardando gestor) |
| `resumo.quantidade_recusadas` | Inteiro | Quantidade de itens com status `"recusada"` (reembolso igual a zero) |
| `resumo.valor_total_solicitado` | Número (2 casas) | Soma algébrica de `valor_considerado` (em BRL) de todas as despesas convertidas do lote |
| `resumo.valor_total_reembolsado` | Número (2 casas) | Soma de `valor_reembolsado` (em BRL) dos itens aprovados automaticamente (`"aprovada"` + `"parcial"`) |
| `resumo.valor_total_pendente_aprovacao` | Número (2 casas) | Soma de `valor_reembolsado` (em BRL) dos itens em `"pendente_aprovacao"` |
| `avaliacoes` | Lista de objetos | Resultado individual de cada despesa, na mesma ordem da entrada |
| `avaliacoes[].id` | Texto | Identificador original da despesa |
| `avaliacoes[].data` | Data (`AAAA-MM-DD`) | Data original da despesa |
| `avaliacoes[].categoria_original` | Texto | Categoria exatamente como informada na entrada |
| `avaliacoes[].categoria_normalizada` | Texto | Categoria após normalização (minúsculas e sem espaços extremos) |
| `avaliacoes[].moeda_original` | Texto | Código da moeda normalizado em maiúsculas (`"BRL"` quando ausente na entrada) |
| `avaliacoes[].taxa_cambio_aplicada` | Número ou `null` | Taxa de câmbio aplicada na conversão para BRL (`1` para `BRL`, cotação usada para moeda estrangeira, `null` se sem cotação) |
| `avaliacoes[].valor_original` | Número | Valor exatamente como informado na entrada na moeda original |
| `avaliacoes[].valor_considerado` | Número (2 casas) | Valor da despesa convertido em BRL e arredondado para 2 casas decimais (Half-Up) |
| `avaliacoes[].valor_reembolsado` | Número (2 casas) | Valor calculado para reembolso em BRL (`>= 0.00`) |
| `avaliacoes[].valor_glosado` | Número (2 casas) | Diferença não reembolsada em BRL (`max(0, valor_considerado - valor_reembolsado)`) |
| `avaliacoes[].status` | Texto | Um entre: `"aprovada"`, `"parcial"`, `"pendente_aprovacao"`, `"recusada"` |
| `avaliacoes[].em_viagem` | Booleano | Indica se a data da despesa foi classificada como dia em viagem |
| `avaliacoes[].regra_aplicada` | Texto | Código da regra determinante do resultado (`RN-001` a `RN-013`) |
| `avaliacoes[].justificativa` | Texto | Explicação clara em linguagem natural do motivo da decisão |

### Exemplo de saída para entrada reduzida

Para um lote com `d-001` (Alimentação, `2026-07-03`, R$ 72,50, com NF) e `d-002` (Alimentação, `2026-07-03`, R$ 38,00, com NF):

```json
{
  "colaborador": {
    "id": "c-0417",
    "nome": "Marina Volpi",
    "centro_custo": "CC-ENG-PLATAFORMA"
  },
  "periodo": {
    "competencia": "2026-07",
    "inicio": "2026-07-01",
    "fim": "2026-07-31"
  },
  "resumo": {
    "total_despesas": 2,
    "quantidade_aprovadas": 0,
    "quantidade_parciais": 1,
    "quantidade_recusadas": 1,
    "valor_total_solicitado": 110.50,
    "valor_total_reembolsado": 60.00
  },
  "avaliacoes": [
    {
      "id": "d-001",
      "data": "2026-07-03",
      "categoria_original": "alimentacao",
      "categoria_normalizada": "alimentacao",
      "valor_original": 72.50,
      "valor_considerado": 72.50,
      "valor_reembolsado": 60.00,
      "valor_glosado": 12.50,
      "status": "parcial",
      "em_viagem": false,
      "regra_aplicada": "RN-003",
      "justificativa": "Despesa excede o limite diario de R$ 60.00 para alimentacao; reembolsado parcialmente ate o teto disponivel de R$ 60.00."
    },
    {
      "id": "d-002",
      "data": "2026-07-03",
      "categoria_original": "alimentacao",
      "categoria_normalizada": "alimentacao",
      "valor_original": 38.00,
      "valor_considerado": 38.00,
      "valor_reembolsado": 0.00,
      "valor_glosado": 38.00,
      "status": "recusada",
      "em_viagem": false,
      "regra_aplicada": "RN-002",
      "justificativa": "Limite diario de R$ 60.00 para alimentacao na data 2026-07-03 ja foi integralmente consumido por despesas anteriores."
    }
  ]
}
```

---

## 5. Regras de negócio

Cada regra recebe um ID (`RN-001` a `RN-010`). As tasks e testes referenciam esses IDs.

### RN-001 — Categorias elegíveis na política (por Centro de Custo)

**Regra:** A elegibilidade de uma categoria normalizada é determinada pela tabela efetiva do `centro_custo` do colaborador (`RN-011`). Uma categoria é elegível se e somente se existir na tabela efetiva do colaborador **e** possuir `limite > 0.00`. Qualquer categoria ausente na tabela efetiva ou configurada com `limite == 0.00` (como `hospedagem` para `CC-ENG-PLATAFORMA` na política v4) deve ser integralmente recusada (`status = "recusada"`, `valor_reembolsado = 0.00`, `regra_aplicada = "RN-001"`).
**Origem:** Política do RH v3 (item 9) atualizada pela Política v4 (Item A, `AMB-012`, `AMB-013`).
**Aceite:** `d-005` (`coworking`) é recusada (`RN-001`); `f-003` (`representacao` para `CC-SUPORTE-N2`) é recusada (`RN-001`); `hospedagem` para `CC-ENG-PLATAFORMA` com `politica-v4.json` é recusada (`RN-001`).

### RN-002 — Limites diários agregados por categoria e data

**Regra:** Os limites máximos de reembolso são agregados por `(data, categoria_normalizada)` ao longo das despesas válidas daquele dia, respeitando a ordem de entrada:
- `"alimentacao"`: R$ 60,00 por dia (ou R$ 90,00 em dia de viagem).
- `"transporte_urbano"`: R$ 80,00 por dia (ou R$ 120,00 em dia de viagem).
- `"hospedagem"`: R$ 250,00 por diária/lançamento no dia (ou R$ 375,00 em dia de viagem), considerando cada lançamento de hospedagem como 1 diária na ausência de campo específico no schema.
Se uma despesa válida couber integralmente no saldo diário disponível da sua categoria, recebe `status = "aprovada"` e `regra_aplicada = "RN-002"`. Se o saldo diário da categoria já estiver zerado (`0.00`) por despesas anteriores do mesmo dia, a despesa recebe `status = "recusada"`, `valor_reembolsado = 0.00` e `regra_aplicada = "RN-002"`.
**Origem:** Política do RH, itens 1, 2 e 3 (`AMB-001`, `AMB-003`).
**Aceite:** Em `2026-07-03`, após `d-001` (R$ 72,50) consumir todos os R$ 60,00 de alimentação do dia, `d-002` (R$ 38,00) recebe `status = "recusada"`, `valor_reembolsado = 0.00` e `regra_aplicada = "RN-002"`.

### RN-003 — Reembolso parcial por corte de excedente

**Regra:** Quando uma despesa válida possui `valor_considerado` maior que o saldo diário disponível para sua categoria naquela data, e o saldo disponível é estritamente maior que zero (`saldo_disponivel > 0.00`), o sistema aprova exatamente o `saldo_disponivel` (`valor_reembolsado = saldo_disponivel`), glosa o excedente (`valor_glosado = valor_considerado - saldo_disponivel`), zera o saldo da categoria naquele dia e classifica o item com `status = "parcial"` e `regra_aplicada = "RN-003"`.
**Origem:** Política do RH, item 4 (`AMB-002`).
**Aceite:** `d-001` (`alimentacao`, R$ 72,50 em dia sem viagem) recebe `status = "parcial"`, `valor_reembolsado = 60.00`, `valor_glosado = 12.50` e `regra_aplicada = "RN-003"`.

### RN-004 — Obrigatoriedade de nota fiscal acima de R$ 100,00

**Regra:** Toda despesa cujo `valor_considerado` seja **estritamente maior que R$ 100,00** (`valor_considerado > 100.00`) deve possuir `tem_nota_fiscal = true`. Caso contrário (`tem_nota_fiscal = false`), a despesa é integralmente recusada (`status = "recusada"`, `valor_reembolsado = 0.00`, `regra_aplicada = "RN-004"`) e não consome o limite diário da categoria. Despesas com `valor_considerado <= 100.00` estão dispensadas de nota fiscal.
**Origem:** Política do RH, item 5 (`AMB-005`).
**Aceite:** `d-003` (R$ 100,00, `tem_nota_fiscal = false`) passa pela validação de nota fiscal e é reembolsada parcialmente em R$ 80,00 pelo teto de transporte; já `d-004` (R$ 100,01, `tem_nota_fiscal = false`) e `d-013` (R$ 690,00, `tem_nota_fiscal = false`) são recusadas com `valor_reembolsado = 0.00` e `regra_aplicada = "RN-004"`.

### RN-005 — Ampliação de limites em 50% em dias de viagem

**Regra:** Uma data `D` é classificada como "dia em viagem" (`em_viagem = true`) se e somente se existir, na mesma data `D`, ao menos uma despesa sobrevivente a todas as validações eliminatórias (Fase A) que seja de categoria normalizada `"hospedagem"` **ou** lançada em moeda estrangeira (`moeda_original != "BRL"`). Em uma data com `em_viagem = true`, os limites diários de todas as categorias elegíveis naquela data são ampliados pelo percentual configurado na política (`+50%`).
**Origem:** Política do RH v3 (item 6) atualizada pela Política v4 (Item B, `AMB-004`, `AMB-017`).
**Aceite:** Em `2026-07-14` (`despesas-envelope.json`), `e-002` (`alimentacao`, `22.00 EUR` = R$ 130,46) ativa `em_viagem = true`, elevando o limite de `alimentacao` de `CC-COMERCIAL` de R$ 90,00 para R$ 135,00 (`status = "aprovada"`, `valor_reembolsado = 130.46`). Em `2026-07-20`, `e-005` (`40.00 USD` = R$ 220,00, sem NF) falha na Fase A (`RN-004`), portanto não ativa `em_viagem`.

### RN-006 — Validação do período de competência

**Regra:** A `data` da despesa deve pertencer ao intervalo fechado `[periodo.inicio, periodo.fim]` (`periodo.inicio <= despesa.data <= periodo.fim`), independentemente de cair em dia útil, fim de semana ou feriado. Despesas com data anterior a `periodo.inicio` ou posterior a `periodo.fim` são integralmente recusadas (`status = "recusada"`, `valor_reembolsado = 0.00`, `regra_aplicada = "RN-006"`).
**Origem:** Política do RH, item 7 (`AMB-010`).
**Aceite:** `d-008` (`2026-04-15` no período `2026-07-01` a `2026-07-31`) é recusada com `regra_aplicada = "RN-006"`. `d-012` (`2026-07-18`, sábado) é aceita normalmente.

### RN-007 — Detecção e recusa de despesas duplicadas

**Regra:** Duas ou mais despesas (que já tenham passado pelas validações de valor positivo, período de competência e categoria elegível) são consideradas duplicatas quando possuem simultaneamente a mesma chave composta por:
`(data, categoria_normalizada, fornecedor_normalizado, descricao_normalizada, valor_considerado)`, onde textos normalizados têm espaços extremos removidos, múltiplos espaços internos colapsados em um único espaço e letras convertidas para minúsculas. A primeira ocorrência válida na ordem da lista é registrada e segue para a validação de nota fiscal; todas as ocorrências subsequentes com a mesma chave são integralmente recusadas (`status = "recusada"`, `valor_reembolsado = 0.00`, `regra_aplicada = "RN-007"`) e não consomem saldo do limite diário.
**Origem:** Política do RH, item 8 (`AMB-006`).
**Aceite:** Entre `d-006` e `d-007` (ambas em `2026-07-09`, `alimentacao`, `Bistro Central`, `Almoco`, R$ 54,90), `d-006` é aprovada em R$ 54,90 e `d-007` é recusada com `valor_reembolsado = 0.00` e `regra_aplicada = "RN-007"`.

### RN-008 — Recusa de valores não positivos (estornos ou zero)

**Regra:** Apenas desembolsos efetivos com `valor_considerado > 0.00` são elegíveis para reembolso. Lançamentos com `valor_considerado <= 0.00` (como estornos ou valores zerados) são recusados (`status = "recusada"`, `valor_reembolsado = 0.00`, `valor_glosado = 0.00`, `regra_aplicada = "RN-008"`) e não aumentam nem reduzem o saldo diário da categoria nem são deduzidos do total reembolsado.
**Origem:** Política do RH, implícito no conceito de reembolso de despesa (`AMB-007`).
**Aceite:** `d-009` (`transporte_urbano`, valor `-45.00`, `"Estorno de corrida cancelada"`) recebe `status = "recusada"`, `valor_reembolsado = 0.00`, `valor_glosado = 0.00` e `regra_aplicada = "RN-008"`.

### RN-009 — Normalização de categoria

**Regra:** Antes de qualquer validação de elegibilidade, duplicidade ou agrupamento diário, o campo `categoria` deve ser normalizado removendo espaços em branco no início e no fim e convertendo todos os caracteres para letras minúsculas.
**Origem:** Cruzamento da Política do RH (itens 1–3 e 9) com os dados de entrada (`AMB-009`).
**Aceite:** `d-014` com `categoria = "ALIMENTACAO"` e valor R$ 61,00 tem `categoria_normalizada = "alimentacao"`, sendo reconhecida como categoria válida e reembolsada parcialmente em R$ 60,00 (`RN-003`).

### RN-010 — Arredondamento monetário na entrada (2 casas decimais, Half-Up)

**Regra:** Todo valor monetário (original em BRL ou após conversão cambial para BRL) com mais de 2 casas decimais é arredondado para 2 casas decimais utilizando o método *Half-Up* (meio para cima, afastando-se de zero: terceira casa decimal `>= 5` arredonda o centavo para cima; `< 5` mantém o centavo), gerando o `valor_considerado` em BRL que serve de base para todas as regras subsequentes.
**Origem:** Cruzamento da Política do RH com os dados de entrada (`AMB-008`).
**Aceite:** `d-011` com `valor = 33.333` tem `valor_considerado = 33.33` e `valor_reembolsado = 33.33`.

### RN-011 — Resolução de política externa por Centro de Custo

**Regra:** Os limites diários e categorias elegíveis são carregados a partir de uma política externa (ex.: `politica-v4.json`), resolvida para o `colaborador.centro_custo`:
- Se o `centro_custo` não existir em `centros_custo`, utiliza-se integralmente o mapa `padrao`.
- Se o `centro_custo` existir em `centros_custo`, a tabela efetiva mescla `padrao` com as entradas do `centro_custo` (sobrescrevendo categorias presentes no CC e adicionando novas categorias como `representacao`, enquanto categorias com `limite == 0.00` tornam-se explicitamente não reembolsáveis).
- Quando nenhuma política externa é fornecida na CLI, utiliza-se a política padrão embutida equivalente à v3 (`alimentacao: 60`, `transporte_urbano: 80`, `hospedagem: 250`).
**Origem:** Política do RH v4, Item A (`AMB-012`, `AMB-013`).
**Aceite:** `CC-COMERCIAL` reconhece `representacao` (limite R$ 300,00) e `alimentacao` (R$ 90,00); `CC-SUPORTE-N2` usa `padrao` (rejeitando `representacao` em `f-003`); `CC-ENG-PLATAFORMA` recusa `hospedagem` por ter `limite == 0.00`; `CC-ADM` herda `hospedagem: 250.00` de `padrao` mantendo `alimentacao: 45.00` e `transporte_urbano: 60.00`.

### RN-012 — Conversão cambial de despesas em moeda estrangeira

**Regra:** Quando o campo `moeda` está ausente na despesa, assume-se `"BRL"` (taxa `1`). Quando `moeda` (normalizada em maiúsculas) difere de `"BRL"`, o valor original é multiplicado pela taxa da data da despesa na tabela externa de câmbio (`cambio.json`) e arredondado via *Half-Up* (`RN-010`) antes da validação de nota fiscal (`RN-004`) e da aplicação dos limites diários (`RN-002`):
- Se a data exata da despesa não constar na tabela de câmbio (ex.: fim de semana ou feriado bancário), utiliza-se a cotação do **último dia útil anterior disponível** na tabela.
- Se não existir nenhuma data `<= despesa.data` na tabela, ou se a moeda solicitada não estiver cotada na data resolvida (ex.: `GBP`), ou se nenhuma tabela de câmbio tiver sido fornecida, a despesa é recusada (`status = "recusada"`, `valor_considerado = 0.00`, `valor_reembolsado = 0.00`, `taxa_cambio_aplicada = null`, `regra_aplicada = "RN-012"`).
**Origem:** Política do RH v4, Item B (`AMB-014`, `AMB-015`, `AMB-016`).
**Aceite:** `e-004` (`2026-07-18`, sábado, `30.00 EUR`) usa a taxa de `2026-07-17` (`5.96`), convertendo para `178.80 BRL`; `e-005` (`40.00 USD` × `5.50` = `220.00 BRL`, sem NF) falha em `RN-004`; `e-006` (`55.00 GBP`) falha em `RN-012` por ausência de cotação para `GBP`.

### RN-013 — Fila de aprovação manual acima de R$ 500,00 (Item C)

**Regra:** Após o cálculo do valor reembolsável na Fase B, se o `valor_reembolsado` de uma despesa for **estritamente maior que R$ 500,00** (`valor_reembolsado > 500.00`), a despesa não é aprovada automaticamente: ela recebe `status = "pendente_aprovacao"`, `regra_aplicada = "RN-013"`, mantém o `valor_reembolsado` e `valor_glosado` calculados e tem seu valor contabilizado em `resumo.valor_total_pendente_aprovacao` (e `resumo.quantidade_pendentes_aprovacao`), sem compor `resumo.valor_total_reembolsado` (que reflete apenas aprovações automáticas). O consumo do saldo diário da categoria na Fase B continua ocorrendo normalmente.
**Origem:** Política do RH v4, Item C (`AMB-018`).
**Aceite:** Em `despesas-envelope.json`, `e-007` (`hospedagem`, `CC-COMERCIAL`, R$ 1.200,00 com NF em dia de viagem -> teto R$ 600,00) resulta em `valor_reembolsado = 600.00`, `valor_glosado = 600.00`, `status = "pendente_aprovacao"` e `regra_aplicada = "RN-013"`.

---

## 6. Ambiguidades identificadas e decisões

### AMB-001 — Limite por dia agregado vs. limite por lançamento individual

**Texto original do RH:** "1. Alimentação tem limite de R$ 60 por dia. 2. Transporte urbano tem limite de R$ 80 por dia."
**O que não está claro:** Se o teto de R$ 60 (ou R$ 80) se aplica a cada despesa isoladamente ou à soma de todas as despesas daquela categoria na mesma data (`d-001` + `d-002` somam R$ 110,50 em `2026-07-03`).
**Decisão:** O limite é agregado por `(data, categoria_normalizada)`, compartilhado entre todas as despesas válidas daquele dia na ordem em que aparecem.
**Justificativa:** A redação diz explicitamente "por dia" (e não "por refeição" ou "por corrida"), evitando que o colaborador burle o teto fracionando gastos em várias notas no mesmo dia.
**Regra afetada:** RN-002

### AMB-002 — Comportamento do reembolso parcial e esgotamento do saldo diário

**Texto original do RH:** "4. Despesas acima do limite são reembolsadas parcialmente."
**O que não está claro:** Se "reembolsadas parcialmente" significa pagar o saldo disponível até o teto e glosar o excedente, qual proporção aplicar, e qual status atribuir a uma segunda despesa do mesmo dia quando a primeira já esgotou 100% do limite diário (`d-002` após `d-001`).
**Decisão:** Paga-se exatamente o saldo diário restante da categoria (`status = "parcial"`) e corta-se o excedente; quando o saldo disponível do dia já é R$ 0,00, qualquer nova despesa da mesma categoria naquela data recebe R$ 0,00 com `status = "recusada"`.
**Justificativa:** Reembolso de R$ 0,00 não é reembolso parcial, mas sim recusa integral por teto diário esgotado.
**Regra afetada:** RN-002, RN-003

### AMB-003 — Limite de hospedagem "por diária" sem campo de quantidade de diárias na entrada

**Texto original do RH:** "3. Hospedagem tem limite de R$ 250 por diária."
**O que não está claro:** Os itens `d-010` ("Hotel Rio - 2 diarias", R$ 480,00) e `d-013` ("Airbnb 3 noites", R$ 690,00) mencionam múltiplas diárias no texto livre de `descricao`, mas o schema JSON de entrada não possui campo estruturado para quantidade de diárias.
**Decisão:** Cada lançamento de categoria `hospedagem` é tratado como 1 diária (aplicando o limite diário da data: R$ 250,00 base ou R$ 375,00 com ampliação de viagem), sem realizar extração heurística de texto livre no campo `descricao`.
**Justificativa:** Regras financeiras auditáveis não podem depender de parsing frágil de texto livre não padronizado; na ausência do dado estruturado, aplica-se o teto de 1 diária por lançamento.
**Regra afetada:** RN-002, RN-005

### AMB-004 — Caracterização de colaborador "em viagem" e escopo da ampliação de 50%

**Texto original do RH:** "6. Colaborador em viagem tem limites ampliados em 50%."
**O que não está claro:** O JSON de entrada não possui campo booleano `em_viagem` no colaborador, no período ou na despesa. Além disso, não está claro se o bônus de +50% vale para o período inteiro, apenas para a data da hospedagem, e se amplia também o próprio limite de hospedagem ou apenas alimentação e transporte.
**Decisão:** Considera-se "dia em viagem" toda data `D` que possua ao menos uma despesa de categoria `hospedagem` válida (aprovada nas regras eliminatórias), ampliando em +50% os limites de todas as categorias naquela data `D` (`alimentacao` = R$ 90,00; `transporte_urbano` = R$ 120,00; `hospedagem` = R$ 375,00).
**Justificativa:** A existência de uma hospedagem comprovada e válida na data é a evidência objetiva nos dados de que o colaborador estava em viagem naquele dia, e a política amplia "os limites" sem restringir categorias.
**Regra afetada:** RN-005

### AMB-005 — Fronteira exata de R$ 100,00 para obrigatoriedade de nota fiscal

**Texto original do RH:** "5. Nota fiscal é obrigatória acima de R$ 100."
**O que não está claro:** Se uma despesa de exatamente R$ 100,00 sem nota fiscal (`d-003`) exige ou não nota fiscal, e se a comparação de R$ 100,00 é feita sobre o valor original da despesa ou sobre o valor limitado pelo teto da categoria (já que o teto de transporte é R$ 80,00, abaixo de R$ 100,00).
**Decisão:** A condição é estritamente maior que R$ 100,00 (`valor_considerado > 100.00`) avaliada sobre o valor submetido da despesa antes da aplicação do teto da categoria. Assim, R$ 100,00 (`d-003`) dispensa NF, enquanto R$ 100,01 (`d-004`) exige NF.
**Justificativa:** Em português e em lógica matemática, "acima de 100" corresponde à desigualdade estrita (`> 100.00`), e a obrigação fiscal incide sobre o valor da transação comercial realizada.
**Regra afetada:** RN-004

### AMB-006 — Critério de identificação e política de recusa de duplicatas

**Texto original do RH:** "8. Duplicatas devem ser tratadas."
**O que não está claro:** Como definir duplicata quando cada item tem um `id` único (`d-006` e `d-007`), e se "tratar" significa recusar apenas as cópias mantendo a primeira ou recusar todas as ocorrências envolvidas.
**Decisão:** Duplicatas são identificadas pela igualdade simultânea de `(data, categoria_normalizada, fornecedor_normalizado, descricao_normalizada, valor_considerado)`. Mantém-se a 1ª ocorrência para avaliação normal e recusam-se a 2ª e demais ocorrências idênticas sem consumir limite diário.
**Justificativa:** O lançamento duplicado normalmente decorre de duplo clique ou reenvio acidental; aprovar uma ocorrência legítima e bloquear as cópias reembolsa o gasto real sem pagar em dobro.
**Regra afetada:** RN-007

### AMB-007 — Tratamento de valores negativos (estornos) e valores zerados

**Texto original do RH:** A política é silente sobre valores negativos ou estornos, mas a entrada contém `d-009` com `valor = -45.00` ("Estorno de corrida cancelada").
**O que não está claro:** Se um valor negativo deve abater o total a reembolsar do colaborador, recompor o limite diário da categoria ou ser recusado como item não reembolsável.
**Decisão:** Despesas com `valor_considerado <= 0.00` são recusadas (`status = "recusada"`, `valor_reembolsado = 0.00`, `valor_glosado = 0.00`) e não alteram saldos diários nem são subtraídas do total reembolsado.
**Justificativa:** Um estorno em cartão/aplicativo anula uma cobrança na origem (que nem deve ser submetida para reembolso); deduzi-lo de outras despesas legítimas confiscaria reembolsos devidos ao colaborador.
**Regra afetada:** RN-008

### AMB-008 — Tratamento de valores com mais de duas casas decimais

**Texto original do RH:** A política não define precisão decimal, mas a entrada contém `d-011` com `valor = 33.333`.
**O que não está claro:** Se valores com 3 ou mais casas decimais devem ser rejeitados, truncados, arredondados no final ou arredondados na entrada, e sob qual regra de arredondamento.
**Decisão:** Arredondar cada valor de entrada imediatamente para 2 casas decimais pelo critério *Half-Up* (`33.333` → `33.33`) antes de qualquer comparação ou soma, operando todo o motor com precisão exata de centavos.
**Justificativa:** A moeda corrente (BRL) possui subdivisão mínima em centavos (2 casas decimais), evitando discrepâncias entre a soma das parcelas exibidas e o total consolidado.
**Regra afetada:** RN-010

### AMB-009 — Sensibilidade a caixa alta/baixa nas categorias

**Texto original do RH:** "1. Alimentação... 2. Transporte urbano... 3. Hospedagem... 9. Categorias fora da política não são reembolsáveis." (e `d-014` traz `"ALIMENTACAO"` em maiúsculas).
**O que não está claro:** Se `"ALIMENTACAO"` deve ser rejeitada por diferença de capitalização em relação a `"alimentacao"` ou normalizada.
**Decisão:** Normalizar o campo `categoria` com remoção de espaços nas extremidades e conversão para minúsculas antes da validação.
**Justificativa:** Diferença de caixa (`"ALIMENTACAO"` vs `"alimentacao"`) é variação de formatação, não uma categoria de negócio diferente.
**Regra afetada:** RN-001, RN-009

### AMB-010 — Critério de período de competência e despesas em fins de semana

**Texto original do RH:** "7. Despesas devem ser lançadas dentro do período de competência." (e a entrada traz `d-008` em `2026-04-15` e `d-012` em `2026-07-18`, um sábado, com descrição "Almoco de sabado - plantao").
**O que não está claro:** Se "dentro do período de competência" exige apenas pertencer ao intervalo `[periodo.inicio, periodo.fim]` ou se restringe despesas ocorridas em sábados e domingos.
**Decisão:** Qualquer data dentro do intervalo fechado `[periodo.inicio, periodo.fim]` é válida, incluindo sábados, domingos e feriados.
**Justificativa:** A política não proíbe trabalho em regime de plantão ou viagem em fins de semana; a única restrição temporal expressa é pertencer ao período de competência.
**Regra afetada:** RN-006

### AMB-011 — Ordem de precedência entre regras e consumo de limite diário por itens inválidos

**Texto original do RH:** A política lista 9 itens sem definir qual regra é verificada primeiro quando uma despesa infringe mais de uma condição (por exemplo, `d-004` custa R$ 100,01 em transporte: viola simultaneamente a falta de nota fiscal acima de R$ 100 e o teto diário de R$ 80).
**O que não está claro:** Se `d-004` deve ser recusada por falta de nota fiscal (`RN-004`) ou reembolsada parcialmente até R$ 80 por exceder o limite (`RN-003`), e se itens recusados por falta de NF, duplicidade ou fora de competência consomem o limite diário da categoria.
**Decisão:** As regras eliminatórias de validade (conversão cambial → valor positivo → competência → categoria → duplicidade → nota fiscal) são executadas antes do cálculo de limite diário, e despesas recusadas em qualquer etapa eliminatória nunca consomem o limite diário nem ativam status de viagem.
**Justificativa:** Uma despesa inválida (sem cotação cambial, sem comprovante fiscal exigido, duplicada ou fora de competência) não existe juridicamente para fins de reembolso, não podendo receber reembolso parcial nem consumir o limite de despesas válidas.
**Regra afetada:** RN-001 a RN-013 (Seção 8)

### AMB-012 — Herança de política `padrao` em centro de custo parcialmente especificado (`CC-ADM`) vs. CC desconhecido (`CC-SUPORTE-N2`)

**Texto original do RH (v4):** "Alguns centros de custo não têm entrada na tabela. Nesse caso, aplica-se a política padrão." (E `politica-v4.json` lista `CC-ADM` com `alimentacao` e `transporte_urbano`, omitindo `hospedagem`, enquanto `CC-ENG-PLATAFORMA` coloca `hospedagem` explicitamente com `limite: 0.00`).
**O que não está claro:** Se um CC listado na tabela que omite uma categoria padrão (`CC-ADM` sem `hospedagem`) herda o limite de `padrao` ou passa a proibir a categoria omitida.
**Decisão:** A política efetiva de um CC listado é a fusão de `padrao` com as sobrescritas daquele CC (`{ ...padrao, ...centros_custo[cc] }`). Para desabilitar uma categoria padrão, o CC deve declarar `limite: 0.00` (como faz `CC-ENG-PLATAFORMA`). Para CCs ausentes (`CC-SUPORTE-N2`), aplica-se integralmente `padrao`.
**Justificativa:** O próprio arquivo `politica-v4.json` demonstra a convenção do financeiro de usar `limite: 0.00` para proibir explicitamente uma categoria, logo omissão em um CC significa manter o padrão corporativo.
**Regra afetada:** RN-001, RN-011

### AMB-013 — Categoria configurada com `limite: 0.00` (`CC-ENG-PLATAFORMA` + `hospedagem`)

**Texto original do RH (v4):** "`CC-ENG-PLATAFORMA` não reembolsa `hospedagem` de forma alguma." (`"hospedagem": { "limite": 0.00, "observacao": "nao reembolsavel" }`).
**O que não está claro:** Se uma despesa em categoria com `limite == 0.00` deve ser barrada já na Fase A como não elegível (`RN-001`) ou chegar à Fase B (onde uma hospedagem poderia ativar indevidamente `em_viagem = true`).
**Decisão:** Categorias com `limite <= 0.00` na política efetiva do CC são tratadas como inelegíveis já na etapa 4 da Fase A (`RN-001`), recebendo `status = "recusada"` e nunca ativando `em_viagem`.
**Justificativa:** Se o CC não reembolsa hospedagem "de forma alguma", ela não pode ser aceita na Fase A nem servir de gatilho para ampliar outros limites.
**Regra afetada:** RN-001, RN-005, RN-011

### AMB-014 — Cotação de câmbio em fins de semana ou datas sem publicação (`e-004`, sábado `2026-07-18`)

**Texto original do RH (v4):** "A conversão usa a taxa da data da despesa, não a taxa de hoje. As taxas estão em `cambio.json`." (`cambio.json`: "Cotacoes publicadas apenas em dias uteis bancarios.")
**O que não está claro:** Como converter uma despesa em moeda estrangeira ocorrida no sábado (`2026-07-18`, `e-004`), data inexistente no mapa `taxas` de `cambio.json`.
**Decisão:** Quando a data exata não existe em `cambio.json`, aplica-se a cotação do último dia útil anterior disponível (`<= despesa.data`, isto é, sexta-feira `2026-07-17` para o sábado `2026-07-18`).
**Justificativa:** É a convenção contábil e bancária oficial do Banco Central (PTAX) para operações em dias não úteis.
**Regra afetada:** RN-012

### AMB-015 — Moeda estrangeira ausente na tabela de câmbio (`e-006`, `GBP`)

**Texto original do RH (v4):** "As taxas estão em `cambio.json`." (Mas `despesas-envelope.json` traz `e-006` em `GBP`, moeda inexistente em `cambio.json`).
**O que não está claro:** Se o motor deve abortar o lote inteiro com erro ou recusar apenas a despesa sem cotação disponível.
**Decisão:** Recusar apenas a despesa cuja moeda não possui cotação disponível (`status = "recusada"`, `regra_aplicada = "RN-012"`, `taxa_cambio_aplicada = null`, `valor_considerado = 0.00`), preservando o processamento determinístico das demais despesas do lote.
**Justificativa:** Um único item sem taxa cadastrada não deve bloquear o reembolso das demais despesas legítimas do colaborador.
**Regra afetada:** RN-012

### AMB-016 — Momento da validação de Nota Fiscal (> R$ 100,00) para despesas em moeda estrangeira (`e-003`, `e-005`)

**Texto original do RH (v4):** "Os limites da política são sempre em BRL. Uma despesa em EUR é convertida antes de ser comparada ao limite."
**O que não está claro:** Se o teto de isenção de Nota Fiscal (R$ 100,00) também compara o valor já convertido para BRL (fazendo `e-003` de 14,50 EUR = R$ 85,26 dispensar NF e `e-005` de 40,00 USD = R$ 220,00 exigir NF).
**Decisão:** A conversão cambial ocorre no pré-processamento (antes das regras eliminatórias), portanto `RN-004` sempre compara o `valor_considerado` já convertido em BRL contra `nota_fiscal_obrigatoria_acima_de` (R$ 100,00).
**Justificativa:** Todos os limiares monetários da política são expressos em BRL; comparar o valor nominal em moeda estrangeira violaria a equivalência financeira.
**Regra afetada:** RN-004, RN-012

### AMB-017 — Despesas internacionais e caracterização de "dia em viagem" (+50%)

**Texto original do RH (v4):** "Colaboradores em viagem internacional lançam despesas em moeda estrangeira."
**O que não está claro:** Se uma despesa válida em moeda estrangeira (`moeda != "BRL"`) na data `D` também caracteriza que o colaborador está em viagem naquele dia (`em_viagem = true`), mesmo sem lançamento de hospedagem na mesma data (`e-002`, `e-003`, `e-004`, `f-004`).
**Decisão:** Sim. Na v2.0, uma data `D` recebe `em_viagem = true` se houver ao menos uma despesa sobrevivente à Fase A de categoria `"hospedagem"` **ou** com `moeda_original != "BRL"`.
**Justificativa:** Uma despesa válida em moeda estrangeira é evidência objetiva de viagem internacional naquela data, harmonizando o item 6 da v3 com o item B da v4.
**Regra afetada:** RN-005

### AMB-018 — Contabilização e fronteira da fila de aprovação manual (Item C, > R$ 500,00)

**Texto original do RH (v4):** "Itens cujo valor reembolsável passe de R$ 500 não são mais aprovados automaticamente. Eles entram em estado de pendência aguardando aprovação do gestor."
**O que não está claro:** Se o limite de R$ 500,00 é estrito (`> 500.00`), se compara o `valor_original` ou o `valor_reembolsado` final, e se valores pendentes entram no `valor_total_reembolsado` do resumo.
**Decisão:** A condição é estritamente `valor_reembolsado > 500.00` (sobre o valor reembolsável calculado após teto diário). Itens nessa condição recebem `status = "pendente_aprovacao"` e `regra_aplicada = "RN-013"`, e são somados separadamente em `resumo.valor_total_pendente_aprovacao` (sem inflar `resumo.valor_total_reembolsado`, que representa o total já liberado automaticamente).
**Justificativa:** O financeiro precisa distinguir com clareza o montante liberado para pagamento imediato daquele retido aguardando alçada do gestor.
**Regra afetada:** RN-013

---

## 7. Casos de borda

| Caso | Entrada | Comportamento esperado | Regra |
|---|---|---|---|
| Múltiplas despesas no mesmo dia excedendo o teto na 1ª | `d-001` (R$ 72,50) e `d-002` (R$ 38,00) em `2026-07-03` (`alimentacao`) | `d-001` recebe R$ 60,00 (`parcial`, `RN-003`); `d-002` recebe R$ 0,00 (`recusada`, `RN-002`) | RN-002, RN-003 |
| Valor exatamente no limite de isenção de NF (R$ 100,00) sem NF | `d-003` (`transporte_urbano`, R$ 100,00, `tem_nota_fiscal: false`) | Passa na regra de NF (`100.00 <= 100.00`) e recebe R$ 80,00 (`parcial`, `RN-003`) | RN-004, RN-003 |
| Valor 1 centavo acima da isenção de NF (R$ 100,01) sem NF | `d-004` (`transporte_urbano`, R$ 100,01, `tem_nota_fiscal: false`) | Recusada integralmente (R$ 0,00, `recusada`, `RN-004`) sem consumir limite diário | RN-004 |
| Categoria não listada na política | `d-005` (`coworking`, R$ 89,00, `tem_nota_fiscal: true`) | Recusada integralmente (R$ 0,00, `recusada`, `RN-001`) | RN-001 |
| Lançamento idêntico no mesmo dia com ID diferente | `d-006` e `d-007` (`2026-07-09`, `alimentacao`, R$ 54,90) | `d-006` aprovada (R$ 54,90, `RN-002`); `d-007` recusada por duplicidade (R$ 0,00, `RN-007`) | RN-007 |
| Despesa fora do mês de competência | `d-008` (`2026-04-15` em lote de `2026-07`) | Recusada integralmente (R$ 0,00, `recusada`, `RN-006`) | RN-006 |
| Valor negativo (estorno) | `d-009` (`transporte_urbano`, R$ -45,00) | Recusada (R$ 0,00, `valor_glosado: 0.00`, `recusada`, `RN-008`), sem abater do total reembolsado | RN-008 |
| Hospedagem válida ativando dia em viagem | `d-010` (`2026-07-14`, `hospedagem`, R$ 480,00, `tem_nota_fiscal: true`) | Ativa `em_viagem = true` em `2026-07-14`; teto sobe para R$ 375,00; reembolsa R$ 375,00 (`parcial`, `RN-003`) | RN-005, RN-003 |
| Hospedagem inválida (sem NF > R$ 100) não ativa viagem | `d-013` (`2026-07-22`, `hospedagem`, R$ 690,00, `tem_nota_fiscal: false`) | Recusada por `RN-004`; `em_viagem` permanece `false` em `2026-07-22` | RN-004, RN-005 |
| Valor com 3 casas decimais | `d-011` (`alimentacao`, R$ 33,333) | Arredondado Half-Up para `33.33`; aprovado em R$ 33,33 (`RN-010`, `RN-002`) | RN-010, RN-002 |
| Despesa em sábado dentro do período | `d-012` (`2026-07-18`, sábado, R$ 47,20) | Aprovada integralmente em R$ 47,20 (`RN-006`, `RN-002`) | RN-006, RN-002 |
| Categoria em letras maiúsculas | `d-014` (`"ALIMENTACAO"`, R$ 61,00) | Normalizada para `"alimentacao"`; reembolsada parcialmente em R$ 60,00 (`RN-009`, `RN-003`) | RN-009, RN-003 |
| Categoria específica de CC (`representacao` em `CC-COMERCIAL`) | `e-001` (`CC-COMERCIAL`, R$ 340,00) | Limite de R$ 300,00; reembolsada parcialmente em R$ 300,00 (`RN-011`, `RN-003`) | RN-011, RN-003 |
| Categoria exclusiva de outro CC em CC desconhecido | `f-003` (`CC-SUPORTE-N2`, `representacao`, R$ 190,00) | Usa política `padrao` (sem `representacao`); recusada por `RN-001` | RN-011, RN-001 |
| Categoria com `limite: 0.00` no CC | `hospedagem` em `CC-ENG-PLATAFORMA` (com `politica-v4.json`) | Recusada por `RN-001` na Fase A; não ativa `em_viagem` | RN-011, RN-001 |
| Despesa internacional em sábado (sem cotação na data) | `e-004` (`2026-07-18`, `30.00 EUR`, NF=true) | Fallback para sexta `2026-07-17` (`5.96`) → `178.80 BRL`; ativa viagem (`135.00` teto); parcial `135.00` | RN-012, RN-005, RN-003 |
| Despesa internacional em moeda sem cotação | `e-006` (`2026-07-21`, `55.00 GBP`) | Recusada por ausência de cotação (`RN-012`, `taxa_cambio_aplicada = null`) | RN-012 |
| Despesa internacional sem NF abaixo vs. acima de R$ 100 após conversão | `e-003` (`14.50 EUR` = R$ 85,26) e `e-005` (`40.00 USD` = R$ 220,00) | `e-003` dispensa NF e é aprovada (`85.26`); `e-005` exige NF e é recusada (`RN-004`) | RN-012, RN-004 |
| Item com valor reembolsável > R$ 500,00 (Item C) | `e-007` (`CC-COMERCIAL`, `hospedagem`, R$ 1.200,00, NF=true) | Dia em viagem (+50% → teto R$ 600,00); como `600.00 > 500.00`, `status = "pendente_aprovacao"` (`RN-013`) | RN-005, RN-013 |

---

## 8. Ordem de aplicação das regras

A ordem de avaliação é estrita e determinística, dividida em duas fases sobre o lote:

### Fase A — Pré-processamento, Câmbio e Validações Eliminatórias (por item, na ordem da entrada)
Para cada despesa:
1. **Normalização, Câmbio e Arredondamento (`RN-009`, `RN-010`, `RN-012`):** normaliza `categoria` (`trim` + minúsculas) e `moeda` (ausente → `"BRL"`, senão `trim` + maiúsculas). Se `moeda != "BRL"`, resolve a taxa da data (ou último dia útil anterior) na tabela externa de câmbio; se indisponível → **RECUSA** (`RN-012`). Converte `valor * taxa` e calcula `valor_considerado` em BRL arredondado para 2 casas decimais (*Half-Up*).
2. **Valor Positivo (`RN-008`):** se `valor_considerado <= 0.00` → **RECUSA** (`RN-008`). Para aqui.
3. **Período de Competência (`RN-006`):** se `data < periodo.inicio` ou `data > periodo.fim` → **RECUSA** (`RN-006`). Para aqui.
4. **Categoria Elegível no Centro de Custo (`RN-001`, `RN-011`):** consulta a política efetiva do `colaborador.centro_custo`. Se `categoria_normalizada` não existir ou tiver `limite <= 0.00` → **RECUSA** (`RN-001`). Para aqui.
5. **Duplicidade (`RN-007`):** para despesas que passaram pelas etapas 1 a 4, constrói-se a chave `(data, categoria_normalizada, fornecedor_normalizado, descricao_normalizada, valor_considerado)` (com colapso de espaços internos múltiplos e minúsculas). Se a chave já tiver sido registrada anteriormente no lote → **RECUSA** (`RN-007`). Para aqui. Caso contrário, registra a chave na tabela de duplicatas vistas e avança para a etapa 6.
6. **Nota Fiscal Obrigatória (`RN-004`):** se `valor_considerado > nota_fiscal_obrigatoria_acima_de` (R$ 100,00) e `tem_nota_fiscal == false` → **RECUSA** (`RN-004`). Para aqui.

### Fase B — Determinação de Dias em Viagem, Limites Diários e Fila de Aprovação
7. **Identificação de Dias em Viagem (`RN-005`):** todas as datas `D` que possuem ao menos uma despesa sobrevivente à Fase A de `categoria_normalizada == "hospedagem"` **ou** com `moeda_original != "BRL"` são marcadas com `em_viagem = true`. As demais datas do período têm `em_viagem = false`.
8. **Consumo de Limite Diário, Reembolso Parcial e Pendência Manual (`RN-002`, `RN-003`, `RN-013`):** para cada despesa sobrevivente à Fase A (na ordem original), consulta-se o saldo restante de `(data, categoria_normalizada)` (inicializado com o limite da política efetiva do CC, ampliado em `+acrescimo_em_viagem_percentual` se `em_viagem == true`):
   - Se `saldo_restante == 0.00` → **RECUSA** (`RN-002`, `valor_reembolsado = 0.00`).
   - Caso contrário, calcula `valor_reembolsado = min(valor_considerado, saldo_restante)` e atualiza `saldo_restante`.
   - Se `valor_reembolsado > 500.00` → **PENDENTE DE APROVAÇÃO** (`status = "pendente_aprovacao"`, `regra_aplicada = "RN-013"`).
   - Senão, se `valor_considerado <= saldo_restante_anterior` → **APROVAÇÃO INTEGRAL** (`status = "aprovada"`, `regra_aplicada = "RN-002"`).
   - Senão → **APROVAÇÃO PARCIAL** (`status = "parcial"`, `regra_aplicada = "RN-003"`).

---

## 9. Critérios de aceite

O sistema está pronto quando:

- [ ] Processa `exemplos/despesas-exemplo.json` (sem `--policy` externo, retrocompatível com v3) gerando 3 `"aprovada"`, 4 `"parcial"`, 0 `"pendente_aprovacao"`, 7 `"recusada"`, `valor_total_solicitado = 1816.84` e `valor_total_reembolsado = 710.43`.
- [ ] Processa `exemplos/envelope/despesas-envelope.json` com `--policy exemplos/envelope/politica-v4.json --cambio exemplos/envelope/cambio.json` gerando exatamente: 3 `"aprovada"` (`e-002`, `e-003`, `e-010`), 3 `"parcial"` (`e-001`, `e-004`, `e-008`), 1 `"pendente_aprovacao"` (`e-007` = `600.00`), 3 `"recusada"` (`e-005`, `e-006`, `e-009`), `valor_total_reembolsado = 828.72` e `valor_total_pendente_aprovacao = 600.00`.
- [ ] Processa `exemplos/envelope/despesas-envelope-cc-desconhecido.json` com `politica-v4.json` e `cambio.json` gerando exatamente: 3 `"aprovada"` (`f-001` = `58.00`, `f-002` = `310.00`, `f-004` = `65.76`), 1 `"recusada"` (`f-003` `representacao` fora da política `padrao`), `valor_total_reembolsado = 433.76`.
- [ ] Cada uma das 13 regras de negócio (`RN-001` a `RN-013`) e cada uma das 18 ambiguidades (`AMB-001` a `AMB-018`) possui testes automatizados dedicados passando.
- [ ] Nenhum cálculo monetário ou conversão cambial apresenta erro de precisão de ponto flutuante.

## 10. O que fica em aberto

- **Múltiplas diárias em lançamento único de hospedagem (`AMB-003`):** caso o RH passe a exigir que um único lançamento contemple várias diárias, será necessário evoluir o contrato de entrada para incluir um campo explícito (ex.: `quantidade_diarias`) ou datas de check-in/check-out. Na versão 1.0, cada lançamento equivale a 1 diária.
- **Viagem sem pernoite / deslocamento aéreo ou rodoviário (`AMB-004`):** caso o colaborador realize viagem bate-volta sem despesa de hospedagem (ex.: corrida ao aeroporto em `d-003`), o schema atual não permite distinguir corrida a aeroporto para viagem própria vs. recepção de cliente. Na versão 1.0, apenas datas com hospedagem válida caracterizam viagem.
