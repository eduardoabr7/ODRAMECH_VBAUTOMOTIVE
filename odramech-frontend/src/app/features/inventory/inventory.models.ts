export const PART_UNITS = ['UN', 'PC', 'PAR', 'JG', 'KIT', 'L', 'ML', 'KG', 'G', 'M', 'CX'] as const;
export type PartUnit = (typeof PART_UNITS)[number];

export const UNIT_LABEL: Record<PartUnit, string> = {
  UN: 'Unidade', PC: 'Peça', PAR: 'Par', JG: 'Jogo', KIT: 'Kit', L: 'Litro', ML: 'Mililitro', KG: 'Quilo', G: 'Grama', M: 'Metro', CX: 'Caixa',
};

export type MovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'OS_BAIXA' | 'OS_ESTORNO';
export type ManualMovement = Extract<MovementType, 'ENTRADA' | 'SAIDA' | 'AJUSTE'>;

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  ENTRADA: 'Entrada', SAIDA: 'Saída', AJUSTE: 'Ajuste de inventário', OS_BAIXA: 'Baixa por OS', OS_ESTORNO: 'Devolução de OS',
};

export interface Part {
  id: number;
  code: string | null;
  name: string;
  brand: string | null;
  oemCode: string | null;
  unit: PartUnit;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  location: string | null;
  notes: string | null;
  active: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: number;
  type: MovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  note: string | null;
  workOrderId: number | null;
  numberOs: number | null;
  userName: string | null;
  createdAt: string;
  part: { id: number; name: string; code: string | null; unit: PartUnit };
}

export interface PartDetail extends Part {
  movements: StockMovement[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InventorySummary {
  totalParts: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
}

export interface PartInput {
  code?: string;
  name: string;
  brand?: string;
  oemCode?: string;
  unit?: PartUnit;
  costPrice?: number;
  salePrice?: number;
  minQuantity?: number;
  location?: string;
  notes?: string;
  initialQuantity?: number;
}

export interface MovementInput {
  type: ManualMovement;
  quantity: number;
  unitCost?: number;
  note?: string;
}
