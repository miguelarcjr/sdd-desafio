export type Cents = number;

export type CategoriaElegivel = string;

export type StatusAvaliacao =
  | "aprovada"
  | "parcial"
  | "pendente_aprovacao"
  | "recusada";

export type CodigoRegra =
  | "RN-001"
  | "RN-002"
  | "RN-003"
  | "RN-004"
  | "RN-005"
  | "RN-006"
  | "RN-007"
  | "RN-008"
  | "RN-009"
  | "RN-010"
  | "RN-011"
  | "RN-012"
  | "RN-013";

export interface Colaborador {
  id: string;
  nome: string;
  centro_custo: string;
}

export interface Periodo {
  competencia: string;
  inicio: string;
  fim: string;
}

export interface DespesaInput {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  moeda?: string;
  tem_nota_fiscal: boolean;
}

export interface LoteEntrada {
  colaborador: Colaborador;
  periodo: Periodo;
  despesas: DespesaInput[];
}

export interface AvaliacaoDespesa {
  id: string;
  data: string;
  categoria_original: string;
  categoria_normalizada: string;
  moeda_original: string;
  taxa_cambio_aplicada: number | null;
  valor_original: number;
  valor_considerado: number;
  valor_reembolsado: number;
  valor_glosado: number;
  status: StatusAvaliacao;
  em_viagem: boolean;
  regra_aplicada: CodigoRegra;
  justificativa: string;
}

export interface ResumoLote {
  total_despesas: number;
  quantidade_aprovadas: number;
  quantidade_parciais: number;
  quantidade_pendentes_aprovacao: number;
  quantidade_recusadas: number;
  valor_total_solicitado: number;
  valor_total_reembolsado: number;
  valor_total_pendente_aprovacao: number;
}

export interface ResultadoLote {
  colaborador: Colaborador;
  periodo: Periodo;
  resumo: ResumoLote;
  avaliacoes: AvaliacaoDespesa[];
}
