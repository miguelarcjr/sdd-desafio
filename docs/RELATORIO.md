# Relatório — Desafio SDD

**Aluno:** Miguel Junior · **Repositório:** https://github.com/miguelarcjr/sdd-desafio · **Data:** `2026-11-24`

---

## Delegação

*O que eu fiz, o que o agente fez, e por que dividi assim.*

**A divisão:**

| Atividade | Quem | Por quê |
|---|---|---|
| Identificar ambiguidades | Agente + Eu | Pedi ao agente para cruzar a Política v3 (e depois a v4) item a item contra os JSONs de exemplo; revisei os 11 pontos iniciais (`AMB-001..011`) e os 7 da v4 (`AMB-012..018`) para garantir que nenhum caso dos dados ficasse sem cobertura. |
| Decidir as ambiguidades | Eu | As decisões de negócio precisam ser defendidas e não delegadas. Escolhi cada regra uma por uma (ver `docs/sessions/01-setup-e-especificacao.md` e `docs/sessions/05-absorcao-envelope-dia2.md`). |
| Escrever a spec | Agente (rascunho) + Eu (revisão e aprovação) | O agente estruturou `specs/001-motor-reembolso/spec.md` a partir das minhas decisões; eu conferi a tabela item a item, o contrato de saída e a ausência de termos técnicos. |
| Desenhar a arquitetura | Eu (stack e restrições) + Agente (detalhamento) | Defini Node.js/TypeScript, zero dependências externas de runtime e centavos inteiros; o agente detalhou a separação `src/domain/` vs. `src/io/` e `src/cli/` no `plan.md` (`0380a8e`). |
| Implementar | Agente (task a task) + Eu (revisão) | Execução guiada estritamente por `tasks.md` (`T-001` a `T-011`), com um commit atômico por task. |
| Escrever testes | Agente + Eu (auditoria de casos de fronteira) | O agente escreveu as suítes em Vitest (`tests/*.test.ts`); eu exigi casos explícitos de fronteira como `1.005` e `-10.555` na `T-002` (`18a5755`) e conferi todos os 14 itens do exemplo oficial (`f92f82a`, `5cf92d1`). |
| Absorver o envelope | Eu (decisões v4) + Agente (spec, tasks e código) | Eu decidi as 7 ambiguidades da v4 (`AMB-012..018`) e incluí o Item C opcional (`RN-013`); o agente atualizou `spec.md` (`ee32e04`), `DECISIONS.md`, `plan.md` (`85eb79d`), `tasks.md` (`543890b`) e executou `T-008` a `T-011`. |

**Onde deleguei e me arrependi:**
- Na **Sessão 01**, aceitei a soma manual do `valor_total_solicitado` (`1817.84`) que o agente calculou de cabeça ao montar a tabela de simulação da `spec.md` (`d45dde4`) sem conferir na calculadora. O erro de R$ 1,00 só apareceu quando o teste de contrato `T-006` rodou contra o motor (`f92f82a`), obrigando uma correção na spec (`D-002`, commit `80afe0d`).

**Onde não deleguei e deveria ter delegado:**
- Poderia ter usado o agente para gerar um script rápido de conferência aritmética dos JSONs de exemplo já durante a escrita da `spec.md` v1.0, evitando o erro manual de R$ 1,00 (`D-002`).

**Usei subagentes / skills / MCP / hooks?**
Sim. Utilizei as skills de processo configuradas no ambiente: `brainstorming` (para estruturar o levantamento de requisitos e fechar as decisões da `spec.md` antes de qualquer código) e `writing-plans` (para decompor o `plan.md` e as tasks atômicas `T-001..T-011` em `tasks.md`). O fluxo linear `spec → plan → tasks → commit por task` manteve o histórico Git limpo e auditável.

---

## Descrição

*Como transformei um requisito ambíguo em requisito verificável.*

Escolhi a **`RN-007` (Detecção de duplicatas)** e a nota da **Seção 8, item 5**, que evoluíram entre o commit inicial da spec (`d45dde4`) e o refinamento **`D-001`** (`42ad84e`):

**Versão 1 (`spec.md` v1.0 — commit `d45dde4`):**
> ```
> ### RN-007 — Detecção e recusa de despesas duplicadas
> Duas ou mais despesas são consideradas duplicatas quando possuem simultaneamente a mesma chave composta por:
> (data, categoria_normalizada, fornecedor_normalizado, descricao_normalizada, valor_considerado), onde textos normalizados têm espaços extremos removidos e letras convertidas para minúsculas.
>
> Seção 8, item 5:
> (Nota: o registro na tabela de duplicatas vistas ocorre antes da validação de NF ou após a validação de categoria, garantindo que duplicatas idênticas sejam barradas como RN-007).
> ```

**Versão final (`spec.md` v1.1 / v2.0 — commit `42ad84e`):**
> ```
> ### RN-007 — Detecção e recusa de despesas duplicadas
> Duas ou mais despesas (que já tenham passado pelas validações de valor positivo, período de competência e categoria elegível) são consideradas duplicatas quando possuem simultaneamente a mesma chave composta por:
> (data, categoria_normalizada, fornecedor_normalizado, descricao_normalizada, valor_considerado), onde textos normalizados têm espaços extremos removidos, múltiplos espaços internos colapsados em um único espaço e letras convertidas para minúsculas. A primeira ocorrência válida na ordem da lista é registrada e segue para a validação de nota fiscal; todas as ocorrências subsequentes com a mesma chave são integralmente recusadas (status = "recusada", valor_reembolsado = 0.00, regra_aplicada = "RN-007") e não consomem saldo do limite diário.
> ```

**O que estava ambíguo:**
1. A nota da Seção 8 dizia *"antes da validação de NF ou após a validação de categoria"*, deixando duas implementações possíveis para um par duplicado cujo primeiro item falhasse em NF (`RN-004`).
2. A normalização textual removia apenas espaços nas pontas, sem definir o que fazer com espaços duplicados no meio do nome do fornecedor ou da descrição (`"Bistro   Central"` vs `"Bistro Central"`).

**Como percebi:**
Ao desenhar o modelo de dados e a assinatura de `normalizer.ts` no `plan.md` (Sessão 02, `docs/sessions/02-plano-tecnico-e-tasks.md`), antes de escrever código. A correção entrou primeiro na `spec.md` e em `DECISIONS.md` (`D-001`), e só depois foi testada em `tests/money-and-normalizer.test.ts` e `tests/edge-cases-and-example.test.ts`.

**Commit da mudança:** `42ad84e`

---

## Discernimento

*Onde o agente errou e eu peguei.*

### Caso 1 — Bug de ponto flutuante e arredondamento Half-Up em `toCentsHalfUp` (`T-002`)

**O que ele propôs:**
Ao iniciar a `T-002` (`src/domain/money.ts`), o agente propôs implementar a conversão para centavos diretamente com:
```typescript
export function toCentsHalfUp(valor: number): Cents {
  return Math.round(valor * 100);
}
```

**Por que estava errado:**
Por dois motivos objetivos que violavam a `RN-010` (`AMB-008`) e a `DT-001`:
1. Em IEEE 754 (JavaScript `number`), `1.005 * 100` resulta em `100.49999999999999`, fazendo `Math.round(1.005 * 100)` retornar `100` (R$ 1,00) em vez de `101` (R$ 1,01).
2. Para números negativos, `Math.round` arredonda em direção ao `+∞` (`Math.round(-1055.5) === -1055`), e não no padrão Half-Up afastando-se de zero definido na `RN-010` (`-10.555` deve ir para `-1056`).

**Como eu detectei:**
Revisei a proposta da função `toCentsHalfUp` antes de autorizar o commit da `T-002`, lembrando do erro clássico de `1.005 * 100` em JS e conferindo o comportamento de `Math.round` para negativos.

**O que eu fiz:**
Interrompi antes do commit e pedi para separar o sinal (`sign = valor < 0 ? -1 : 1`), escalar via notação científica `Number(\`${abs}e2\`)` e usar `Math.floor(scaled + 0.5 + 1e-12)`, adicionando assertions explícitos para `1.005 -> 101` e `-10.555 -> -1056` em `tests/money-and-normalizer.test.ts` (commit `18a5755`).

**Onde está a evidência:** `docs/sessions/03-implementacao-fundacao-e-regras.md`, linhas 22–55, e commit `18a5755`.

### Caso 2 — Sugestão de desativar a regra de viagem na `AMB-004` (`spec.md` v1.0)

**O que ele propôs:**
Na Sessão 01, como o JSON de entrada não tinha o campo `em_viagem`, o agente recomendou não inferir viagem por heurística e deixar o multiplicador de +50% (item 6 da política do RH) inativo por padrão.

**Por que estava errado:**
Essa escolha tornaria o item 6 da política completamente morto mesmo quando o próprio JSON trazia evidência estruturada de viagem (uma despesa válida de categoria `hospedagem`, como `d-010` em `2026-07-14`).

**Como eu detectei:**
Ao avaliar as opções da Pergunta 3 na Sessão 01, cruzei a regra 6 com `d-010` e `d-013` em `exemplos/despesas-exemplo.json`.

**O que eu fiz:**
Rejeitei a recomendação do agente e determinei que qualquer data com despesa válida de `hospedagem` ativa `em_viagem = true` (+50% nos limites do dia), enquanto uma hospedagem recusada na Fase A (`d-013` sem NF) não ativa viagem. Na v4 (`AMB-017`), estendemos o mesmo critério para despesas válidas em moeda estrangeira.

**Onde está a evidência:** `docs/sessions/01-setup-e-especificacao.md`, linhas 61–70, e commit `d45dde4`.

**Padrão que eu notei:**
O agente tende a escolher a saída tecnicamente mais "preguiçosa" em dois momentos: simplificando aritmética decimal (`Math.round(v * 100)`) e propondo desativar regras de negócio quando um campo não vem mastigado no JSON.

---

## Diligência

*O que eu verifiquei antes de aceitar.*

**Meu procedimento de verificação:**
1. Conferi a `spec.md` contra o `exemplos/despesas-exemplo.json` item a item antes de gerar o `plan.md`.
2. Para cada task (`T-001` a `T-011`), exigi `npm run typecheck` e `npm test` passando antes de aceitar o commit.
3. Ao fechar a v3 (`T-007`) e a v4 (`T-011`), executei o comando real da CLI (`npm run reembolso -- calcular ...`) gerando os JSONs de saída e conferindo o `resumo` contra a spec.

**Li o diff inteiro em que porcentagem das entregas?**
~75%. Li integralmente a `spec.md`, o `DECISIONS.md`, `src/domain/money.ts`, `src/domain/policy.ts`, `src/domain/exchange.ts`, `src/domain/engine.ts` e os testes de contrato (`edge-cases-and-example.test.ts` e `envelope-v4.test.ts`). Passei o olho mais rapidamente no boilerplate de validação de schema em `src/io/schema.ts` e `src/io/policy-io.ts`.

**O que aceitei sem verificar direito, e o que me custou:**
Aceitei a soma manual `valor_total_solicitado = 1817.84` na `spec.md` v1.0 (`d45dde4`) sem recalcular na calculadora. Isso causou a falha inicial do teste `T-006` (`f92f82a`), revelando que a soma real era `1816.84`, e me custou uma entrada extra no `DECISIONS.md` (`D-002`, commit `80afe0d`) e um ajuste no teste (`5cf92d1`).

**Testes: quem escreveu, e como você sabe que eles testam a coisa certa?**
O agente escreveu os arquivos de teste em `tests/`, mas os valores esperados dos 14 itens de `exemplos/despesas-exemplo.json`, dos 10 itens de `despesas-envelope.json` e dos 4 itens de `despesas-envelope-cc-desconhecido.json` foram fechados previamente na `spec.md` a partir das minhas decisões. Além disso, cada teste carrega no título o ID exato (`[RN-NNN][AMB-NNN]`) e verifica não apenas o valor final, mas `status`, `regra_aplicada`, `valor_glosado`, `em_viagem` e `taxa_cambio_aplicada`.

---

## O envelope

*A mudança de requisito do Dia 2 (`exemplos/envelope/00-ENVELOPE-LACRADO.md`).*

**Quantos arquivos toquei na mão:** `0` arquivos editados manualmente no editor; todas as edições foram guiadas a partir da atualização da `spec.md` v2.0 (`ee32e04`) e executadas pelas tasks `T-008` a `T-011` (8 arquivos em `src/`: 5 modificados + 3 novos).
**Quanto tempo levou:** ~15 minutos da leitura do Gist até os 37 testes (v3 + v4) e a CLI real passarem.
**Diff de absorção:** `23 files changed, 1433 insertions(+), 138 deletions(-)` (`git diff 0ca129b 26c5f13 --stat`, incluindo os 5 arquivos do Gist baixados em `exemplos/envelope/` e 2 novos arquivos de teste). Somente em `src/`: `8 files changed, 519 insertions(+), 59 deletions(-)`.

**Absorveu de graça:**
- **Política isolada em `src/domain/policy.ts`:** como os limites nunca estiveram espalhados por `if/else` no motor, evoluir para `padrao` + `centrosCusto` e injetar `PolicyConfig` carregado de `politica-v4.json` foi direto.
- **Motor em duas passagens (`DT-002`):** incluir moeda estrangeira como gatilho de `em_viagem` (`AMB-017`) exigiu alterar apenas 3 linhas em `identificarDatasEmViagem`.
- **Datas ISO-8601 lexicográficas (`DT-003`):** o fallback para o último dia útil anterior em `src/domain/exchange.ts` (`AMB-014`) funcionou com comparação simples de strings (`d <= dataLimpa`), sem nenhum bug de fuso horário.
- **Módulos intactos:** `src/domain/money.ts`, `src/domain/normalizer.ts` e `src/io/file-io.ts` não tiveram uma única linha alterada.

**Resistiu:**
- O tipo união fechado `CategoriaElegivel = "alimentacao" | "transporte_urbano" | "hospedagem"` em `src/domain/types.ts` precisou ser aberto para `string` para comportar `representacao` (e quaisquer futuras categorias do financeiro).
- Os testes antigos que usavam `toEqual` estrito sobre `resultado.resumo` (`tests/edge-cases-and-example.test.ts`) precisaram adicionar os dois novos campos do Item C (`quantidade_pendentes_aprovacao: 0` e `valor_total_pendente_aprovacao: 0`).

**Ordem em que fiz:**
Estritamente `spec.md` + `DECISIONS.md` (`ee32e04`) → `plan.md` (`85eb79d`) → `tasks.md` (`543890b`) → código e testes (`5769ae5`, `9ae4b50`, `80a5b3f`, `26c5f13`).

**Se eu tivesse escrito a spec original sabendo desta mudança:**
Teria modelado desde a v1.0 as categorias como um dicionário dinâmico dirigido por configuração externa (em vez de união fechada de 3 strings) e já teria reservado um bloco de metadados cambiais na estrutura de avaliação.

**O que a spec me poupou, em concreto:**
Quando o envelope chegou com 7 novas ambiguidades (`AMB-012` a `AMB-018` — como `CC-ADM` sem `hospedagem`, `e-004` no sábado sem PTAX, `e-006` em `GBP` e `e-007` passando de R$ 500), não precisei improvisar no código nem quebrar nenhum dos 26 testes da v3. Todos os 4 commits de código (`T-008` a `T-011`) passaram de primeira (`37/37` testes verdes) porque o contrato já estava fechado na `spec.md` v2.0.

---

## Fechamento

**Para qual tamanho de projeto isto valeu a pena?**
Para qualquer módulo com regras de negócio sujeitas a auditoria, dinheiro ou mudança frequente de política (faturamento, reembolso, impostos, motores de precificação), mesmo quando o código final tem menos de 1.000 linhas.

**Para qual não valeria?**
Scripts descartáveis de migração única, protótipos visuais exploratórios ou spikes de viabilidade técnica onde o objetivo é apenas descobrir se uma API funciona.

**O que eu faria diferente:**
Validaria numericamente todos os exemplos da `spec.md` com um cálculo verificado (em vez de aceitar soma manual feita no chat) antes de fechar a v1.0, evitando a correção `D-002`.

**A coisa mais desconfortável que aprendi sobre como eu trabalho com IA:**
Quando o agente responde rápido e bem formatado (como na tabela de simulação da Sessão 01), dá uma falsa sensação de precisão matemática que me fez deixar passar um erro de R$ 1,00 (`1817.84` vs `1816.84`). Só os testes automatizados e a leitura crítica das funções críticas (`money.ts`) evitam confiar demais na fluência da resposta.
