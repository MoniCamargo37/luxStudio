export interface LDTInfo {
  id: string;
  filename: string;
  luminaire_name: string;
  manufacturer: string;
  model_family: string;
  cct: number;
  optic_family: string;
  power: number;
  flux: number;
  efficiency: number;
  LORL: number;
  isym: number;
}

export interface LDTFamily {
  code: string;
  description: string;
  ldts: LDTInfo[];
}

export interface CriterionResult {
  name: string;
  value: number;
  required: number;
  passed: boolean;
}

export interface CalculationResult {
  config: any;
  compliant: boolean;
  mode: string;
  luminaire: LDTInfo;
  criteria: CriterionResult[];
  Lavg?: number;
  Uo?: number;
  Ul?: number;
  TI?: number;
  SR?: number;
  Eavg?: number;
  Emin?: number;
}

export interface BatchCalculationItem {
  model_id: string;
  row: number;
  config?: any;
  result?: CalculationResult;
  error?: string;
}

export interface BatchCalculationResponse {
  filename: string;
  count: number;
  items: BatchCalculationItem[];
}

export interface OptimizationResponse {
  feasible: boolean;
  message: string;
  objective: string;
  fixed_parameters: string[];
  checked: number;
  config?: any;
  result?: CalculationResult;
}

export interface AdvancedOptimizationVariables {
  power: boolean;
  spacing: boolean;
  height: boolean;
  optic_family: boolean;
}

export type AdvancedOptimizationObjective = 'technical_limits' | 'min_power' | 'max_spacing';

export interface OptimizationChange {
  label: string;
  before: string;
  after: string;
  delta?: string;
}

export interface OptimizationReport {
  feasible: boolean;
  message: string;
  objective: string;
  checked: number;
  changes: OptimizationChange[];
}

export interface OptimizationLensResult {
  model_id: string;
  optic_family: string;
  feasible: boolean;
  message?: string;
  config?: any;
  result?: CalculationResult;
  changes: OptimizationChange[];
}

export type ArrangementType = 'Lineal' | 'Bilateral' | 'Central Doble' | 'En Isleta';

export type LightingClass = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export type PavementType = 'R1' | 'R2' | 'R3' | 'R4';
