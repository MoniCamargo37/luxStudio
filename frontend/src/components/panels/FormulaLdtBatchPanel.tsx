import React from 'react';

interface FormulaLdtBatchPanelProps {
  loading: boolean;
  onRun: () => void;
}

const FormulaLdtBatchPanel: React.FC<FormulaLdtBatchPanelProps> = ({ loading, onRun }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19h16"/><path d="M5 16l4-8 4 5 3-7 3 10"/>
          </svg>
          LDT formula test
        </h3>
      </div>
      <div className="p-4">
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            loading
              ? 'bg-violet-200 text-white cursor-not-allowed'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {loading ? 'Testing formulas...' : 'Calculate from selected LDT'}
        </button>
      </div>
    </div>
  );
};

export default FormulaLdtBatchPanel;
