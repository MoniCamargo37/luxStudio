import { create } from 'zustand';

export interface ConfigState {
  // Road geometry
  road_width: number;
  sidewalk_left: number;
  sidewalk_right: number;
  lanes: number;

  // Luminaire arrangement
  arrangement: 'Lineal' | 'Bilateral' | 'Central Doble' | 'En Isleta';
  height: number; // meters
  spacing: number; // meters
  arm_length: number; // meters
  pole_offset: number; // meters from road edge to pole axis
  pole_side: 'left' | 'right'; // side where unilateral poles are installed
  tilt: number; // degrees

  // Luminaire selection
  optic_family: string;
  power: number; // watts
  ldt_id: string;
  manufacturer: string;
  model_family: string;

  // Other parameters
  lighting_class: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
  mf: number; // maintenance factor
  pavement: 'R1' | 'R2' | 'R3' | 'R4';
  cct: number; // Kelvin

  // Calculated results
  results: CalculationResult | null;
  loading: boolean;
  error: string | null;

  // Actions
  setRoadWidth: (w: number) => void;
  setSidewalkLeft: (w: number) => void;
  setSidewalkRight: (w: number) => void;
  setLanes: (n: number) => void;
  setArrangement: (a: ConfigState['arrangement']) => void;
  setHeight: (h: number) => void;
  setSpacing: (s: number) => void;
  setArmLength: (a: number) => void;
  setPoleOffset: (o: number) => void;
  setPoleSide: (s: ConfigState['pole_side']) => void;
  setTilt: (t: number) => void;
  setOpticFamily: (f: string) => void;
  setPower: (p: number) => void;
  setManufacturer: (m: string) => void;
  setModelFamily: (m: string) => void;
  setSelectedLdt: (ldt: { id: string; manufacturer: string; model_family: string; optic_family: string }) => void;
  setLightingClass: (c: ConfigState['lighting_class']) => void;
  setMf: (m: number) => void;
  setPavement: (p: ConfigState['pavement']) => void;
  setCct: (c: number) => void;
  setResults: (r: CalculationResult | null) => void;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
  calculate: () => Promise<void>;
}

interface CalculationResult {
  config: any; // We'll type this properly later
  compliant: boolean;
  mode: string;
  luminaire: {
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
  };
  criteria: Array<{
    name: string;
    value: number;
    required: number;
    passed: boolean;
  }>;
  Lavg?: number;
  Uo?: number;
  Ul?: number;
  TI?: number;
  SR?: number;
  Eavg?: number;
  Emin?: number;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial values
  road_width: 7.0,
  sidewalk_left: 1.5,
  sidewalk_right: 1.5,
  lanes: 2,

  arrangement: 'Lineal',
  height: 9.0,
  spacing: 30.0,
  arm_length: 1.5,
  pole_offset: 0.0,
  pole_side: 'left',
  tilt: 5,

  optic_family: 'F151',
  power: 100,
  ldt_id: '',
  manufacturer: '',
  model_family: '',

  lighting_class: 'M3',
  mf: 0.85,
  pavement: 'R3',
  cct: 4000,

  results: null,
  loading: false,
  error: null,

  // Setters
  setRoadWidth: (w: number) => set({ road_width: w }),
  setSidewalkLeft: (w: number) => set({ sidewalk_left: w }),
  setSidewalkRight: (w: number) => set({ sidewalk_right: w }),
  setLanes: (n: number) => set({ lanes: n }),
  setArrangement: (a: 'Lineal' | 'Bilateral' | 'Central Doble' | 'En Isleta') => set({ arrangement: a }),
  setHeight: (h: number) => set({ height: h }),
  setSpacing: (s: number) => set({ spacing: s }),
  setArmLength: (a: number) => set({ arm_length: a }),
  setPoleOffset: (o: number) => set({ pole_offset: o }),
  setPoleSide: (s: 'left' | 'right') => set({ pole_side: s }),
  setTilt: (t: number) => set({ tilt: t }),
  setOpticFamily: (f: string) => set({ optic_family: f }),
  setPower: (p: number) => set({ power: p }),
  setSelectedLdt: (ldt) => set({
    ldt_id: ldt.id,
    manufacturer: ldt.manufacturer,
    model_family: ldt.model_family,
    optic_family: ldt.optic_family,
  }),
  setManufacturer: (m: string) => set({ manufacturer: m }),
  setModelFamily: (m: string) => set({ model_family: m }),
  setLightingClass: (c: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6') => set({ lighting_class: c }),
  setMf: (m: number) => set({ mf: m }),
  setPavement: (p: 'R1' | 'R2' | 'R3' | 'R4') => set({ pavement: p }),
  setCct: (c: number) => set({ cct: c }),
  setResults: (r: CalculationResult | null) => set({ results: r }),
  setLoading: (l: boolean) => set({ loading: l }),
  setError: (e: string | null) => set({ error: e }),
  reset: () => set({
    road_width: 7.0,
    sidewalk_left: 1.5,
    sidewalk_right: 1.5,
    lanes: 2,
    arrangement: 'Lineal',
    height: 9.0,
    spacing: 30.0,
    arm_length: 1.5,
    pole_offset: 0.0,
    pole_side: 'left',
    tilt: 5,
    optic_family: 'F151',
    power: 100,
    ldt_id: '',
    manufacturer: '',
    model_family: '',
    lighting_class: 'M3',
    mf: 0.85,
    pavement: 'R3',
    cct: 4000,
    results: null,
    loading: false,
    error: null,
  }),

  // Calculate action
  calculate: async () => {
    set({ loading: true, error: null });
    try {
      const config = get();
      
      // Prepare request body
      const requestBody = {
        road_width: config.road_width,
        sidewalk_left: config.sidewalk_left,
        sidewalk_right: config.sidewalk_right,
        lanes: config.lanes,
        arrangement: config.arrangement,
        height: config.height,
        spacing: config.spacing,
        arm_length: config.arm_length,
        pole_offset: config.pole_offset,
        pole_side: config.pole_side,
        tilt: config.tilt,
        optic_family: config.optic_family,
        power: config.power,
        ldt_id: config.ldt_id,
        manufacturer: config.manufacturer,
        model_family: config.model_family,
        lighting_class: config.lighting_class,
        mf: config.mf,
        pavement: config.pavement,
        cct: config.cct,
      };

      // Call backend (via Vite proxy)
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Calculation failed');
      }

      const result = await response.json();
      set({ results: result });
    } catch (err: any) {
      set({ error: err.message || 'An unknown error occurred' });
    } finally {
      set({ loading: false });
    }
  },
}));
