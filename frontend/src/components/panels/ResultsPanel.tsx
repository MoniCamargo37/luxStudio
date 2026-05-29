import React, { useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { CalculationResult } from '../../types';

interface ResultsPanelProps {
  result: CalculationResult;
  configOverride?: any;
  title?: string;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, configOverride, title }) => {
  const config = useConfigStore();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const buildRequestBody = () => ({
    road_width: configOverride?.road_width ?? config.road_width,
    sidewalk_left: configOverride?.sidewalk_left ?? config.sidewalk_left,
    sidewalk_right: configOverride?.sidewalk_right ?? config.sidewalk_right,
    lanes: configOverride?.lanes ?? config.lanes,
    arrangement: configOverride?.arrangement ?? config.arrangement,
    height: configOverride?.height ?? config.height,
    spacing: configOverride?.spacing ?? config.spacing,
    arm_length: configOverride?.arm_length ?? config.arm_length,
    tilt: configOverride?.tilt ?? config.tilt,
    optic_family: configOverride?.optic_family ?? config.optic_family,
    power: configOverride?.power ?? config.power,
    lighting_class: configOverride?.lighting_class ?? config.lighting_class,
    mf: configOverride?.mf ?? config.mf,
    pavement: configOverride?.pavement ?? config.pavement,
    cct: configOverride?.cct ?? config.cct,
  });

  const handleDownloadOutput = async (format: 'pdf' | 'excel') => {
    const isPdf = format === 'pdf';
    isPdf ? setPdfLoading(true) : setExcelLoading(true);
    setPdfError(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(isPdf ? '/api/report/generate' : '/api/report/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isPdf ? 'LUX_Report' : 'LUX_Results'}_${result.luminaire.luminaire_name.replace(/\s+/g, '_')}.${isPdf ? 'pdf' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setPdfError(`${isPdf ? 'PDF' : 'Excel'} generation timed out. Try again or reduce complexity.`);
      } else {
        setPdfError(err.message || `Failed to generate ${isPdf ? 'PDF' : 'Excel'}`);
      }
    } finally {
      isPdf ? setPdfLoading(false) : setExcelLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden
      ${result.compliant ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between
        ${result.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${result.compliant ? 'bg-green-500' : 'bg-red-500'}`}/>
          <h3 className="font-semibold text-slate-700 text-sm">
            {title ? `${title} - ` : ''}{result.compliant ? 'Compliant' : 'Non-Compliant'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => handleDownloadOutput('pdf')}
          disabled={pdfLoading || excelLoading}
          className={`text-xs border rounded-lg px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5
            ${pdfLoading || excelLoading
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          {pdfLoading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              PDF
            </>
          )}
        </button>
        <button
          onClick={() => handleDownloadOutput('excel')}
          disabled={pdfLoading || excelLoading}
          className={`text-xs border rounded-lg px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5
            ${pdfLoading || excelLoading
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          {excelLoading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h8M8 9h2"/>
              </svg>
              Excel
            </>
          )}
        </button>
        </div>
      </div>

      {pdfError && (
        <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {pdfError}
        </div>
      )}

      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {result.criteria.map(c => (
            <div key={c.name} className={`rounded-lg p-3 border
              ${c.passed ? 'bg-white border-green-200' : 'bg-white border-red-200'}`}>
              <div className="text-xs text-slate-500 mb-0.5">{c.name}</div>
              <div className="text-lg font-bold tracking-tight">{c.value.toFixed(3)}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400">req: {c.required.toFixed(3)}</span>
                <span className={`text-xs font-bold ${c.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {c.passed ? '✓' : '✗'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 pt-3">
          <span>Luminaire: <strong className="text-slate-700">{result.luminaire.luminaire_name}</strong></span>
          <span>{result.luminaire.power.toFixed(0)}W / {(result.luminaire.flux / 1000).toFixed(1)}k lm</span>
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;
