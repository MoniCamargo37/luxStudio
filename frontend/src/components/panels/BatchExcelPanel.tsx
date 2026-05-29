import React, { useState } from 'react';
import type { BatchCalculationResponse } from '../../types';

interface BatchExcelPanelProps {
  onBatchResults: (batch: BatchCalculationResponse | null) => void;
}

const BatchExcelPanel: React.FC<BatchExcelPanelProps> = ({ onBatchResults }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    onBatchResults(null);

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

      onBatchResults(await response.json());
    } catch (err: any) {
      setError(err.message || 'Failed to read Excel file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          Excel batch
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <label className={`block border border-dashed rounded-lg p-4 text-center transition-colors
          ${uploading ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer'}`}>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={uploading}
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <div className="text-sm font-medium">{uploading ? 'Reading and calculating...' : 'Upload Excel'}</div>
          <div className="text-xs text-slate-400 mt-1">Reads all model rows and calculates the full study.</div>
        </label>
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchExcelPanel;
