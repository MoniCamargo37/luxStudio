export interface LDTInfo {
  id: string;
  filename: string;
  luminaire_name: string;
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

export type ArrangementType = 'Lineal' | 'Bilateral' | 'Central Doble' | 'En Isleta';

export type LightingClass = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export type PavementType = 'R1' | 'R2' | 'R3' | 'R4';
