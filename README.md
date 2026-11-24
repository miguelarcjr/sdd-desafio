# Motor de Cálculo de Reembolso

CLI em TypeScript/Node.js que processa lotes de despesas corporativas contra a Política de Reembolso, calculando o valor reembolsável e justificando cada decisão de aprovação, reembolso parcial ou recusa.

Projeto desenvolvido seguindo **Spec Driven Development (SDD)** — toda regra de negócio e resolução de ambiguidade está documentada em [`specs/001-motor-reembolso/spec.md`](specs/001-motor-reembolso/spec.md).

---

## Pré-requisitos

- **Node.js >= 20** (testado com v24.22.2)
- **npm**

## Instalação

```bash
npm install
```

## Como rodar

### Modo padrão (Política v3 embutida — retrocompatível)

```bash
npm run reembolso -- calcular --input exemplos/despesas-exemplo.json --output resultado.json
```

### Modo Política v4 (política externa por centro de custo + tabela de câmbio)

```bash
npm run reembolso -- calcular \
  --input exemplos/envelope/despesas-envelope.json \
  --output resultado-envelope.json \
  --policy exemplos/envelope/politica-v4.json \
  --cambio exemplos/envelope/cambio.json
```

*(O script `reembolso` executa `tsx src/cli/index.ts`.)*

## Como testar e verificar tipos

```bash
# Executar toda a suíte de testes automatizados (Vitest)
npm test

# Verificar tipagem estática (TypeScript)
npm run typecheck
```

## Estrutura do projeto

```text
├── CLAUDE.md                                # Convenções e regras do projeto
├── specs/001-motor-reembolso/
│   ├── spec.md                              # Regras de negócio (RN-001..RN-010) e ambiguidades (AMB-001..AMB-011)
│   ├── plan.md                              # Arquitetura, modelo de dados e decisões técnicas (DT-001..DT-004)
│   ├── tasks.md                             # Tarefas executáveis e matriz de rastreabilidade
│   └── DECISIONS.md                         # Histórico de alterações da especificação
├── src/
│   ├── domain/                              # Núcleo puro de regras de negócio (zero I/O)
│   │   ├── types.ts
│   │   ├── policy.ts
│   │   ├── money.ts
│   │   ├── normalizer.ts
│   │   └── engine.ts
│   ├── io/                                  # Validação de schema e leitura/escrita JSON
│   │   ├── schema.ts
│   │   └── file-io.ts
│   └── cli/                                 # Ponto de entrada da linha de comando
│       └── index.ts
├── tests/                                   # Testes unitários e de contrato mapeados para RN/AMB
├── exemplos/despesas-exemplo.json           # Lote de referência
└── docs/
    ├── sessions/                            # Sessões de trabalho registradas
    └── RELATORIO.md                         # Relatório final (4 Ds + Envelope)
```
