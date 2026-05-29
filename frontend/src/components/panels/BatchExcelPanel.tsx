import React, { useId, useRef, useState } from 'react';

interface BatchExcelPanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const BatchExcelPanel: React.FC<BatchExcelPanelProps> = ({ file, onFileChange }) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (nextFile?: File) => {
    setError(null);

    if (!nextFile) {
      onFileChange(null);
      return;
    }

    const isExcel = /\.(xlsx|xls)$/i.test(nextFile.name);
    if (!isExcel) {
      setError('Please upload an Excel file (.xlsx or .xls).');
      onFileChange(null);
      return;
    }

    onFileChange(nextFile);
  };

  const clearFile = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileChange(null);
    setError(null);
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
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="sr-only"
          onChange={e => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <label className={`block border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${file ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          htmlFor={inputId}
        >
          <div className="text-sm font-medium">{file ? file.name : 'Upload Excel'}</div>
          <div className="text-xs text-slate-400 mt-1">
            {file ? 'Excel mode selected. Press Calculate to run the study.' : 'Optional: use Excel instead of the manual configuration.'}
          </div>
          <div className="mt-3 inline-flex rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            {file ? 'Replace Excel' : 'Choose file'}
          </div>
        </label>

        {file && (
          <button
            type="button"
            onClick={clearFile}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Use manual configuration
          </button>
        )}

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
