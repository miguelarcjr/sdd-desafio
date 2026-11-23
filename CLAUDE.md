# CLAUDE.md

## O projeto

Motor de cálculo de reembolso de despesas corporativas. CLI que lê um JSON de
despesas e emite um JSON com o valor reembolsável e a justificativa de cada item.

## Fonte da verdade

`specs/001-motor-reembolso/spec.md` define **o que** o sistema faz.
`specs/001-motor-reembolso/plan.md` define **como**.
`specs/001-motor-reembolso/tasks.md` define **em que ordem**.

Quando o código e a spec discordarem, a spec está certa e o código é o bug —
a menos que a spec esteja errada, e nesse caso corrigimos a spec primeiro e
registramos em `DECISIONS.md`.

**Antes de implementar qualquer coisa, leia a task correspondente em `tasks.md`.**
Se o que eu pedi não está coberto por nenhuma task, me avise em vez de implementar.

## Regras de trabalho

- Toda regra de negócio vive na spec, não no chat e não em comentário de código.
- Se eu te explicar uma regra que não está na spec, **pare e me diga isso** antes
  de escrever código. Isso é um bug de spec.
- Todo commit referencia uma task: `feat(T-003): <descrição>`.
  Mudanças de documentação: `docs(spec):`, `docs(plan):`, `docs(tasks):`.
- Nenhuma regra de negócio entra sem teste.

## Stack e comandos

- Linguagem: TypeScript (Node.js >= 20, ESM)
- Rodar: `npm run reembolso -- calcular --input exemplos/despesas-exemplo.json --output resultado.json`
- Testes: `npm test` (Vitest)
- Lint/format: `npm run typecheck` (`tsc --noEmit`)

## Convenções de código

- Estrutura de pastas:
  - `src/domain/`: núcleo puro de regras de negócio, modelos, política e aritmética monetária (zero I/O).
  - `src/io/`: leitura/escrita de arquivos JSON e validação de schema de entrada.
  - `src/cli/`: ponto de entrada da linha de comando (`calcular --input ... --output ...`).
  - `tests/`: testes automatizados mapeados diretamente para `RN-NNN` e `AMB-NNN`.
- Valores monetários: representados internamente em **centavos inteiros** (`number` inteiro após arredondamento Half-Up da entrada para 2 casas decimais), convertidos de volta para número com 2 casas decimais apenas na serialização de saída. Nunca usar ponto flutuante binário (`float`) em somas ou subtrações de limites.

## Fora de escopo

- Persistência em banco de dados, chamadas de rede/APIs externas ou interface gráfica/web.
- Conversão de moedas estrangeiras ou cálculo de impostos.
- Inferência de quantidade de diárias via interpretação de texto livre (NLP/regex) no campo `descricao`.
- Autenticação, controle de acesso ou envio de notificações.
