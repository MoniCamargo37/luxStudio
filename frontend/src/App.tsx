import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useConfigStore } from './store/useConfigStore';
import MainLayout from './layouts/MainLayout';
import GeometryPanel from './components/panels/GeometryPanel';
import ArrangementPanel from './components/panels/ArrangementPanel';
import LuminairePanel from './components/panels/LuminairePanel';
import AutoOptimizePanel from './components/panels/AutoOptimizePanel';
import BatchExcelPanel from './components/panels/BatchExcelPanel';
import BatchResultsPanel from './components/panels/BatchResultsPanel';
import ResultsPanel from './components/panels/ResultsPanel';
import QuickInfoPanel from './components/panels/QuickInfoPanel';
import RoadPlanView from './components/canvas/RoadPlanView';
import RoadSectionView from './components/canvas/RoadSectionView';
import LuminaireTable from './components/admin/LuminaireTable';
import LuminaireForm from './components/admin/LuminaireForm';
import type {
  AdvancedOptimizationObjective,
  AdvancedOptimizationVariables,
  BatchCalculationResponse,
  LDTInfo,
  OptimizationLensResult,
  OptimizationReport,
  OptimizationResponse,
} from './types';
import './App.css';

const buildCalculationRequest = () => {
  const config = useConfigStore.getState();
  return {
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
};

const formatWatts = (value: number) => `${value.toFixed(1)} W`;
const formatMeters = (value: number) => `${value.toFixed(1)} m`;

const buildOptimizationChanges = (
  beforeConfig: ReturnType<typeof buildCalculationRequest>,
  afterConfig: any,
) => {
  const beforePower = Number(beforeConfig.power);
  const afterPower = Number(afterConfig.power ?? beforePower);
  const beforeSpacing = Number(beforeConfig.spacing);
  const afterSpacing = Number(afterConfig.spacing ?? beforeSpacing);
  const beforeHeight = Number(beforeConfig.height);
  const afterHeight = Number(afterConfig.height ?? beforeHeight);
  const changes = [];

  if (Number.isFinite(beforePower) && Number.isFinite(afterPower) && Math.abs(beforePower - afterPower) >= 0.05) {
    changes.push({
      label: 'Power',
      before: formatWatts(beforePower),
      after: formatWatts(afterPower),
    });
  }

  if (Number.isFinite(beforeSpacing) && Number.isFinite(afterSpacing) && Math.abs(beforeSpacing - afterSpacing) >= 0.05) {
    changes.push({
      label: 'Spacing',
      before: formatMeters(beforeSpacing),
      after: formatMeters(afterSpacing),
    });
  }

  if (Number.isFinite(beforeHeight) && Number.isFinite(afterHeight) && Math.abs(beforeHeight - afterHeight) >= 0.05) {
    changes.push({
      label: 'Height',
      before: formatMeters(beforeHeight),
      after: formatMeters(afterHeight),
    });
  }

  return changes;
};

const buildOptimizationReport = (
  beforeConfig: ReturnType<typeof buildCalculationRequest>,
  data: OptimizationResponse,
): OptimizationReport => {
  const afterConfig = data.config ?? data.result?.config ?? beforeConfig;

  return {
    feasible: data.feasible,
    message: data.message,
    objective: data.objective,
    checked: data.checked,
    changes: buildOptimizationChanges(beforeConfig, afterConfig),
  };
};

const Home: React.FC = () => {
  const {
    results,
    loading,
    error,
    calculate,
    setResults,
    setLoading,
    setError,
    setPower,
    setSpacing,
    setHeight,
  } = useConfigStore();
  const [batchResults, setBatchResults] = useState<BatchCalculationResponse | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [optimizationReport, setOptimizationReport] = useState<OptimizationReport | null>(null);
  const [optimizationLensResults, setOptimizationLensResults] = useState<OptimizationLensResult[] | null>(null);

  const handleExcelFileChange = (file: File | null) => {
    setExcelFile(file);
    setBatchResults(null);
    setResults(null);
    setError(null);
    setOptimizationReport(null);
    setOptimizationLensResults(null);
  };

  const calculateExcel = async (file: File) => {
    setLoading(true);
    setError(null);
    setBatchResults(null);
    setResults(null);
    setOptimizationReport(null);
    setOptimizationLensResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/batch-excel', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${response.status})`);
      }

      setBatchResults(await response.json());
    } catch (err: any) {
      setError(err.message || 'Failed to calculate Excel file');
    } finally {
      setLoading(false);
    }
  };

  const optimizeSimple = async () => {
    setLoading(true);
    setError(null);
    setBatchResults(null);
    setExcelFile(null);
    setOptimizationReport(null);
    setOptimizationLensResults(null);
    const beforeConfig = buildCalculationRequest();

    try {
      const response = await fetch('/api/optimize/simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(beforeConfig),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${response.status})`);
      }

      const data = await response.json() as OptimizationResponse;
      if (data.result) {
        setResults(data.result);
      }
      setOptimizationReport(buildOptimizationReport(beforeConfig, data));

      if (!data.feasible) {
        return;
      }

      if (typeof data.config?.power === 'number') {
        setPower(data.config.power);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to optimize calculation');
    } finally {
      setLoading(false);
    }
  };

  const optimizeAdvanced = async (
    variables: AdvancedOptimizationVariables,
    objective: AdvancedOptimizationObjective,
    opticFamilies: string[],
  ) => {
    setLoading(true);
    setError(null);
    setBatchResults(null);
    setExcelFile(null);
    setOptimizationReport(null);
    setOptimizationLensResults(null);
    const beforeConfig = buildCalculationRequest();

    try {
      const isLensBatch = variables.optic_family;
      const response = await fetch(isLensBatch ? '/api/optimize/advanced-batch' : '/api/optimize/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: beforeConfig, variables, objective, optic_families: opticFamilies }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${response.status})`);
      }

      if (isLensBatch) {
        const batch = await response.json() as BatchCalculationResponse;
        const lensRows: OptimizationLensResult[] = batch.items.map(item => ({
          model_id: item.model_id,
          optic_family: item.config?.optic_family ?? item.result?.luminaire.optic_family ?? item.model_id.split(' ').pop() ?? item.model_id,
          feasible: Boolean(item.config && item.result && !item.error),
          message: item.error,
          config: item.config,
          result: item.result,
          changes: item.config ? buildOptimizationChanges(beforeConfig, item.config) : [],
        }));
        const firstFeasible = lensRows.find(item => item.feasible && item.result);
        setOptimizationLensResults(lensRows);
        setOptimizationReport({
          feasible: Boolean(firstFeasible),
          message: firstFeasible ? 'Optimized by lens.' : 'No selected lens found a compliant solution.',
          objective,
          checked: 0,
          changes: [],
        });
        setResults(firstFeasible?.result ?? null);
        return;
      }

      const data = await response.json() as OptimizationResponse;
      if (data.result) {
        setResults(data.result);
      }
      setOptimizationReport(buildOptimizationReport(beforeConfig, data));

      if (!data.feasible) {
        return;
      }

      if (typeof data.config?.power === 'number') {
        setPower(data.config.power);
      }
      if (typeof data.config?.spacing === 'number') {
        setSpacing(data.config.spacing);
      }
      if (typeof data.config?.height === 'number') {
        setHeight(data.config.height);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to optimize setup');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (excelFile) {
      setOptimizationReport(null);
      setOptimizationLensResults(null);
      await calculateExcel(excelFile);
      return;
    }

    setBatchResults(null);
    setOptimizationReport(null);
    setOptimizationLensResults(null);
    await calculate();
  };

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-slate-800">New Lighting Study</h2>
          <p className="text-slate-500 mt-1">Configure your road and luminaire, then calculate</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Controls */}
          <section className="lg:col-span-3 space-y-4">
            <GeometryPanel />
            <ArrangementPanel />
            <LuminairePanel />
            <button
              onClick={handleCalculate}
              disabled={loading}
              className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-all
                ${loading
                  ? 'bg-blue-400 cursor-not-allowed animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-200 hover:shadow-xl'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                {loading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {loading ? 'Calculating...' : excelFile ? 'Calculate Excel' : 'Calculate'}
              </div>
            </button>
            <AutoOptimizePanel loading={loading} onRunSimple={optimizeSimple} onRunAdvanced={optimizeAdvanced} />
            <BatchExcelPanel file={excelFile} onFileChange={handleExcelFileChange} />
          </section>

          {/* Center: Visualization */}
          <section className="lg:col-span-6 space-y-4">
            <RoadPlanView />
            <RoadSectionView />
            {batchResults ? <BatchResultsPanel batch={batchResults} /> : results && (
              <ResultsPanel
                result={results}
                optimizationReport={optimizationReport}
                optimizationLensResults={optimizationLensResults}
              />
            )}
          </section>

          {/* Right: Results Info */}
          <section className="lg:col-span-3">
            <QuickInfoPanel result={results} loading={loading} />
          </section>
        </div>
      </div>
    </main>
  );
};

const Admin: React.FC = () => {
  const [editLum, setEditLum] = useState<LDTInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (lum: LDTInfo) => {
    setEditLum(lum);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditLum(null);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditLum(null);
    setRefreshKey(k => k + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditLum(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Luminaire Catalog</h2>
          <p className="text-slate-500 text-sm mt-1">Manage luminaires in the database</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Back to Studio
          </Link>
          {!showForm && (
            <button
              onClick={handleNew}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              + New Luminaire
            </button>
          )}
        </div>
      </div>

      {showForm ? (
        <LuminaireForm editLum={editLum} onSaved={handleSaved} onCancel={handleCancel} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <LuminaireTable onEdit={handleEdit} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
