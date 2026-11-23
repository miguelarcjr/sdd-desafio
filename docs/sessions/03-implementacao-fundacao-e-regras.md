# Session Export — 03: Implementação da Fundação (`T-001`, `T-002`) e Regras de Negócio (`T-003` a `T-005`)

- **Project:** `sdd-desafio`
- **Session:** `03-implementacao-fundacao-e-regras`
- **Artifacts:** `package.json`, `tsconfig.json`, `src/domain/types.ts`, `src/domain/policy.ts`, `src/domain/money.ts`, `src/domain/normalizer.ts`, `src/domain/engine.ts`, `tests/policy.test.ts`, `tests/money-and-normalizer.test.ts`, `tests/eliminatory-rules.test.ts`, `tests/duplicates-and-invoice.test.ts`, `tests/daily-limits-and-travel.test.ts`, `specs/001-motor-reembolso/tasks.md`

---

## User

vamos iniciar a implementacao da Fase 1 (T-001 e T-002) e Fase 2 (T-003 a T-005) seguindo o tasks.md

---

## Assistant

Começando pela **Fase 1 (Fundação)**:

### 1. `T-001` — Setup TypeScript/Vitest, tipos (`src/domain/types.ts`) e política (`src/domain/policy.ts`)
- Configurei `package.json` (scripts `reembolso`, `test`, `typecheck`), `tsconfig.json` (ESM estrito), os contratos de dados em `src/domain/types.ts` e a política declarativa `DEFAULT_POLICY` em `src/domain/policy.ts`.
- Criei `tests/policy.test.ts` validando as categorias elegíveis (`RN-001`), limites base em centavos (`RN-002`, `RN-004`) e o cálculo de +50% em viagem (`RN-005`).
- Commit gerado: `3cc17a2 feat(T-001): configura projeto TypeScript/Vitest, tipos de dominio e politica declarativa`.

### 2. `T-002` — Aritmética em centavos Half-Up (`src/domain/money.ts`) e normalização (`src/domain/normalizer.ts`)
Para converter `valor: number` em centavos inteiros com arredondamento Half-Up, a implementação inicial direta com ponto flutuante seria:
```typescript
export function toCentsHalfUp(valor: number): Cents {
  return Math.round(valor * 100);
}
```
Deseja seguir com `Math.round(valor * 100)` ou prefere revisar os casos de fronteira antes de commitar a `T-002`?

---

## User

para ai, Math.round(valor * 100) em JS quebra em ponto flutuante tipo 1.005 * 100 que da 100.49999999999999 e arredonda pra baixo (100 em vez de 101), fora que Math.round em numero negativo (-10.555) arredonda em direcao ao +infinito e nao Half-Up afastando de zero como definimos na RN-010. corrige isso separando o sinal e usando notacao exponencial `Number(`${abs}e2`)` antes de commitar a T-002

---

## Assistant

Bem observado! `Math.round(1.005 * 100)` em IEEE 754 retorna `100` em vez de `101`, e para negativos como `-10.555` o `Math.round(-1055.5)` retorna `-1055` em vez de `-1056` (violando o Half-Up simétrico da `RN-010`).

Corrigi `toCentsHalfUp` em `src/domain/money.ts` separando o sinal (`sign = valor < 0 ? -1 : 1`), escalando via notação científica `Number(`${abs}e2`)` e aplicando `Math.floor(scaled + 0.5 + 1e-12)`:
```typescript
export function toCentsHalfUp(valor: number): Cents {
  if (!Number.isFinite(valor)) {
    throw new Error(`Valor monetario invalido: ${String(valor)}`);
  }
  if (valor === 0) {
    return 0;
  }
  const sign = valor < 0 ? -1 : 1;
  const abs = Math.abs(valor);
  const scaled = Number(`${abs}e2`);
  const rounded = Math.floor(scaled + 0.5 + 1e-12);
  return sign * rounded;
}
```
Adicionei casos explícitos em `tests/money-and-normalizer.test.ts` cobrindo `33.333 -> 3333`, `33.335 -> 3334`, `1.005 -> 101` e `-10.555 -> -1056`, além da normalização de categorias (`RN-009`) e colapso de espaços na chave de duplicata (`RN-007` / `D-001`).
- Commit gerado: `18a5755 feat(T-002): implementa aritmetica em centavos Half-Up e normalizacao textual`.

---

## User

show, agora pode tocar a Fase 2 (T-003, T-004 e T-005)

---

## Assistant

Implementei e testei as três tasks da **Fase 2 (Regras de negócio)**:

1. **`T-003` — Regras eliminatórias iniciais (`RN-008`, `RN-006`, `RN-001`):**
   - Implementado `validarRegrasEliminatoriasIniciais` em `src/domain/engine.ts` e testado em `tests/eliminatory-rules.test.ts` (recusa `d-009` de `-45.00` com `RN-008` e `valor_glosado = 0`, recusa `d-008` fora da competência com `RN-006`, aceita sábado `d-012` dentro da competência, e recusa `d-005` `"coworking"` com `RN-001`).
   - Commit gerado: `84bbb8c feat(T-003): implementa validacoes eliminatorias RN-008, RN-006 e RN-001`.

2. **`T-004` — Detecção de duplicatas (`RN-007`) e obrigatoriedade de nota fiscal (`RN-004`):**
   - Implementado `executarFaseAEliminatoria` e `validarNotaFiscal` em `src/domain/engine.ts` e testado em `tests/duplicates-and-invoice.test.ts` (`d-006` aprovada na Fase A e `d-007` recusada com `RN-007`; `d-003` de R$ 100,00 sem NF passa na Fase A enquanto `d-004` de R$ 100,01 sem NF e `d-013` de R$ 690,00 sem NF são recusadas com `RN-004`).
   - Commit gerado: `de9d260 feat(T-004): implementa deteccao de duplicatas RN-007 e validacao de nota fiscal RN-004`.

3. **`T-005` — Fase B: Dias em viagem (+50%, `RN-005`), limites diários agregados (`RN-002`), reembolso parcial (`RN-003`) e resumo do lote:**
   - Implementado `identificarDatasEmViagem` e `calcularReembolsos` em `src/domain/engine.ts` e testado em `tests/daily-limits-and-travel.test.ts` (`d-001` recebe R$ 60,00 `parcial` com `RN-003` e `d-002` recebe R$ 0,00 `recusada` com `RN-002`; `d-010` ativa `em_viagem = true` em `2026-07-14` e recebe R$ 375,00 `parcial`; `d-013` sem NF não ativa viagem em `2026-07-22`).
   - Commit gerado: `7a50b16 feat(T-005): implementa Fase B com dias em viagem RN-005, limites diarios RN-002 e reembolso parcial RN-003`.

Todos os 5 arquivos de teste (20 testes no total) estão passando e as tasks `T-001` a `T-005` foram marcadas como `[x]` em `specs/001-motor-reembolso/tasks.md` com seus respectivos hashes.
