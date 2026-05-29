import React, { useMemo, useState } from 'react';
import type { BatchCalculationItem, BatchCalculationResponse } from '../../types';

interface BatchResultsPanelProps {
  batch: BatchCalculationResponse;
}

const metricText = (item: BatchCalculationItem) => {
  const result = item.result;
  if (!result) return '-';
  if (result.mode === 'P') {
    return `Eavg ${result.Eavg?.toFixed(2) ?? '-'} / Emin ${result.Emin?.toFixed(2) ?? '-'}`;
  }
  return `Lavg ${result.Lavg?.toFixed(2) ?? '-'} / Uo ${result.Uo?.toFixed(3) ?? '-'}`;
};

const BatchResultsPanel: React.FC<BatchResultsPanelProps> = ({ batch }) => {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [luminaireFilter, setLuminaireFilter] = useState('all');
  const successful = batch.items.filter(item => item.result && item.config);
  const failed = batch.items.filter(item => item.error);
  const passCount = successful.filter(item => item.result?.compliant).length;
  const failCount = successful.length - passCount;

  const luminaires = useMemo(() => {
    return Array.from(new Set(
      successful
        .map(item => item.result?.luminaire.luminaire_name)
        .filter((name): name is string => Boolean(name))
    )).sort((a, b) => a.localeCompare(b));
  }, [successful]);

  const filteredItems = useMemo(() => {
    return successful.filter(item => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pass' && item.result?.compliant) ||
        (statusFilter === 'fail' && !item.result?.compliant);
      const matchesLuminaire =
        luminaireFilter === 'all' ||
        item.result?.luminaire.luminaire_name === luminaireFilter;

      return matchesStatus && matchesLuminaire;
    });
  }, [successful, statusFilter, luminaireFilter]);

  const downloadOutput = async (item: BatchCalculationItem, format: 'pdf' | 'excel') => {
    if (!item.config || !item.result) return;
    const key = `${item.row}-${format}`;
    setLoadingKey(key);
    try {
      const response = await fetch(format === 'pdf' ? '/api/report/generate' : '/api/report/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.config),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${format === 'pdf' ? 'LUX_Report' : 'LUX_Results'}_${item.model_id.replace(/\s+/g, '_')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-700 text-sm">Excel results</h3>
          <p className="text-xs text-slate-400 mt-0.5">{batch.filename}</p>
        </div>
        <span className="text-xs text-slate-500">{successful.length} ok / {failed.length} errors</span>
      </div>

      {failed.length > 0 && (
        <div className="p-3 border-b border-slate-200 space-y-2">
          {failed.slice(0, 5).map(item => (
            <div key={`${item.row}-${item.model_id}`} className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              Row {item.row} - {item.model_id}: {item.error}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | 'pass' | 'fail')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All ({successful.length})</option>
              <option value="pass">PASS ({passCount})</option>
              <option value="fail">FAIL ({failCount})</option>
            </select>
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Luminaire</span>
            <select
              value={luminaireFilter}
              onChange={e => setLuminaireFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All luminaires</option>
              {luminaires.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Showing {filteredItems.length} of {successful.length} calculated models
        </div>
      </div>

      <div className="max-h-[620px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-600 z-10">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Model</th>
              <th className="text-left font-semibold px-3 py-2">Setup</th>
              <th className="text-left font-semibold px-3 py-2">Luminaire</th>
              <th className="text-left font-semibold px-3 py-2">Result</th>
              <th className="text-left font-semibold px-3 py-2">Status</th>
              <th className="text-right font-semibold px-3 py-2">Outputs</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={`${item.row}-${item.model_id}`} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">{item.model_id}</td>
                <td className="px-3 py-2 text-slate-500">
                  {item.config?.arrangement} - h {item.config?.height} - S {item.config?.spacing}
                </td>
                <td className="px-3 py-2 text-slate-500">{item.result?.luminaire.luminaire_name}</td>
                <td className="px-3 py-2 text-slate-500">{metricText(item)}</td>
                <td className="px-3 py-2">
                  <span className={`font-bold ${item.result?.compliant ? 'text-green-600' : 'text-red-600'}`}>
                    {item.result?.compliant ? 'PASS' : 'FAIL'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => downloadOutput(item, 'pdf')}
                      disabled={loadingKey !== null}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                    >
                      {loadingKey === `${item.row}-pdf` ? '...' : 'PDF'}
                    </button>
                    <button
                      onClick={() => downloadOutput(item, 'excel')}
                      disabled={loadingKey !== null}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                    >
                      {loadingKey === `${item.row}-excel` ? '...' : 'Excel'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  No results match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchResultsPanel;
