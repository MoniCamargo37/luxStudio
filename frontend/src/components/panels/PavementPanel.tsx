import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { PavementType, LightingClass } from '../../types';

const lightingClasses: { value: LightingClass; label: string }[] = [
  { value: 'M1', label: 'M1' }, { value: 'M2', label: 'M2' }, { value: 'M3', label: 'M3' },
  { value: 'M4', label: 'M4' }, { value: 'M5', label: 'M5' }, { value: 'M6', label: 'M6' },
];

const PavementPanel: React.FC = () => {
  const {
    lighting_class, setLightingClass,
    mf, setMf,
    pavement, setPavement,
    cct, setCct,
  } = useConfigStore();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 20h20"/><path d="M4 16V8a2 2 0 012-2h12a2 2 0 012 2v8"/>
          </svg>
          Pavement & Class
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Lighting class <span className="text-slate-400">({lighting_class})</span>
          </label>
          <div className="grid grid-cols-6 gap-1">
            {lightingClasses.map(c => (
              <button
                key={c.value}
                onClick={() => setLightingClass(c.value)}
                className={`py-1.5 rounded-md text-xs font-medium transition-all
                  ${lighting_class === c.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Pavement
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(['R1', 'R2', 'R3', 'R4'] as PavementType[]).map(r => (
                <button
                  key={r}
                  onClick={() => setPavement(r)}
                  className={`py-1.5 rounded-md text-xs font-medium transition-all
                    ${pavement === r
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              CCT <span className="text-slate-400">({cct}K)</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[3000, 4000, 5000].map(t => (
                <button
                  key={t}
                  onClick={() => setCct(t)}
                  className={`py-1.5 rounded-md text-xs font-medium transition-all
                    ${cct === t
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {t}K
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Maintenance factor <span className="text-slate-400">({mf.toFixed(2)})</span>
          </label>
          <input type="range" min="0.5" max="1" step="0.01" value={mf}
            onChange={e => setMf(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>0.50</span><span>1.00</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PavementPanel;
