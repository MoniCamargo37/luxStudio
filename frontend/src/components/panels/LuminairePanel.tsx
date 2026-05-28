import React, { useEffect, useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { LDTFamily, LDTInfo } from '../../types';

const LuminairePanel: React.FC = () => {
  const { optic_family, setOpticFamily, power, setPower } = useConfigStore();
  const [families, setFamilies] = useState<LDTFamily[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ldt/families')
      .then(res => res.json())
      .then(data => {
        setFamilies(data);
        if (data.length > 0 && !optic_family) {
          setOpticFamily(data[0].code);
        }
      })
      .catch(err => console.error('Failed to load LDT families:', err))
      .finally(() => setFamiliesLoading(false));
  }, []);

  const currentFamily = families.find(f => f.code === optic_family);
  const ldts = currentFamily?.ldts || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 008.91 14"/>
          </svg>
          Luminaire
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {familiesLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"/>
            <p className="text-xs text-slate-400 mt-2">Loading LDT catalog...</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Optic family
              </label>
              <div className="grid grid-cols-3 gap-1">
                {families.map(f => (
                  <button
                    key={f.code}
                    onClick={() => setOpticFamily(f.code)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all
                      ${optic_family === f.code
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {f.code}
                    <span className="block text-[10px] opacity-60">{f.ldts.length}W</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Power <span className="text-slate-400">({power.toFixed(0)} W)</span>
              </label>
              <div className="grid grid-cols-4 gap-1">
                {ldts.map(ldt => (
                  <button
                    key={ldt.power}
                    onClick={() => setPower(ldt.power)}
                    className={`py-2 px-1 rounded-lg text-xs font-medium transition-all
                      ${Math.abs(power - ldt.power) < 1
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {ldt.power.toFixed(0)}W
                    <span className="block text-[10px] opacity-60">{ldt.flux / 1000}k lm</span>
                  </button>
                ))}
              </div>
              {ldts.length === 0 && (
                <div className="text-center py-3 text-sm text-slate-400">
                  No LDTs for this family
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LuminairePanel;
