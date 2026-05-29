import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { ArrangementType } from '../../types';

const arrangements: { value: ArrangementType; label: string; icon: string }[] = [
  { value: 'Lineal', label: 'Unilateral', icon: '▬' },
  { value: 'Bilateral', label: 'Staggered', icon: '▮' },
  { value: 'Central Doble', label: 'Central Twin', icon: '◈' },
  { value: 'En Isleta', label: 'Central Single', icon: '◆' },
];

const ArrangementPanel: React.FC = () => {
  const {
    arrangement, setArrangement,
    height, setHeight,
    spacing, setSpacing,
    arm_length, setArmLength,
    tilt, setTilt,
  } = useConfigStore();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          Arrangement
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-1.5">
          {arrangements.map(a => (
            <button
              key={a.value}
              onClick={() => setArrangement(a.value)}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-center
                ${arrangement === a.value
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              <div className="text-base mb-0.5">{a.icon}</div>
              {a.label}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Pole height <span className="text-slate-400">({height.toFixed(1)} m)</span>
          </label>
          <input type="range" min="4" max="16" step="0.5" value={height}
            onChange={e => setHeight(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>4</span><span>16</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Spacing <span className="text-slate-400">({spacing.toFixed(1)} m)</span>
          </label>
          <input type="range" min="10" max="60" step="1" value={spacing}
            onChange={e => setSpacing(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>10</span><span>60</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Arm <span className="text-slate-400">({arm_length.toFixed(1)} m)</span>
            </label>
            <input type="range" min="0" max="4" step="0.25" value={arm_length}
              onChange={e => setArmLength(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Tilt <span className="text-slate-400">({tilt.toFixed(0)}°)</span>
            </label>
            <input type="range" min="-25" max="25" step="1" value={tilt}
              onChange={e => setTilt(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>-25</span><span>25</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArrangementPanel;
