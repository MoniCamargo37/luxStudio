import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useConfigStore } from './store/useConfigStore';
import MainLayout from './layouts/MainLayout';
import GeometryPanel from './components/panels/GeometryPanel';
import ArrangementPanel from './components/panels/ArrangementPanel';
import LuminairePanel from './components/panels/LuminairePanel';
import BatchExcelPanel from './components/panels/BatchExcelPanel';
import BatchResultsPanel from './components/panels/BatchResultsPanel';
import ResultsPanel from './components/panels/ResultsPanel';
import QuickInfoPanel from './components/panels/QuickInfoPanel';
import RoadPlanView from './components/canvas/RoadPlanView';
import RoadSectionView from './components/canvas/RoadSectionView';
import type { BatchCalculationResponse } from './types';
import './App.css';

const Home: React.FC = () => {
  const { results, loading, error, calculate, setResults, setLoading, setError } = useConfigStore();
  const [batchResults, setBatchResults] = useState<BatchCalculationResponse | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const handleExcelFileChange = (file: File | null) => {
    setExcelFile(file);
    setBatchResults(null);
    setResults(null);
    setError(null);
  };

  const calculateExcel = async (file: File) => {
    setLoading(true);
    setError(null);
    setBatchResults(null);
    setResults(null);

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

  const handleCalculate = async () => {
    if (excelFile) {
      await calculateExcel(excelFile);
      return;
    }

    setBatchResults(null);
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
            <BatchExcelPanel file={excelFile} onFileChange={handleExcelFileChange} />

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
          </section>

          {/* Center: Visualization */}
          <section className="lg:col-span-6 space-y-4">
            <RoadPlanView />
            <RoadSectionView />
            {batchResults ? <BatchResultsPanel batch={batchResults} /> : results && <ResultsPanel result={results} />}
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

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
