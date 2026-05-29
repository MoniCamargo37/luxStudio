import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { ArrangementType, LightingClass, PavementType } from '../../types';

const lightingClasses: LightingClass[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
const arrangements: { value: ArrangementType; label: string; icon: string }[] = [
  { value: 'Lineal', label: 'Unilateral', icon: '▬' },
  { value: 'Bilateral', label: 'Staggered', icon: '▮' },
  { value: 'Central Doble', label: 'Central Twin', icon: '◈' },
  { value: 'En Isleta', label: 'Central Single', icon: '◆' },
];

const GeometryPanel: React.FC = () => {
  const {
    road_width, setRoadWidth,
    sidewalk_left, setSidewalkLeft,
    sidewalk_right, setSidewalkRight,
    lanes, setLanes,
    pole_offset, setPoleOffset,
    arrangement, setArrangement,
    spacing, setSpacing,
    lighting_class, setLightingClass,
    mf, setMf,
    pavement, setPavement,
  } = useConfigStore();

  const laneWidth = road_width / Math.max(lanes, 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          Road definition
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Carriageway width <span className="text-slate-400">({road_width.toFixed(1)} m)</span>
          </label>
          <input
            type="range" min="2.5" max="25" step="0.5" value={road_width}
            onChange={e => setRoadWidth(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>2.5</span><span>25</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Left sidewalk <span className="text-slate-400">({sidewalk_left.toFixed(1)} m)</span>
            </label>
            <input
              type="range" min="0" max="5" step="0.5" value={sidewalk_left}
              onChange={e => setSidewalkLeft(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Right sidewalk <span className="text-slate-400">({sidewalk_right.toFixed(1)} m)</span>
            </label>
            <input
              type="range" min="0" max="5" step="0.5" value={sidewalk_right}
              onChange={e => setSidewalkRight(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Number of lanes <span className="text-slate-400">({lanes})</span>
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setLanes(n)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all
                  ${lanes === n
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Lane width: {laneWidth.toFixed(2)} m
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Pole offset from road edge <span className="text-slate-400">({pole_offset.toFixed(2)} m)</span>
          </label>
          <input
            type="range" min="0" max="3" step="0.05" value={pole_offset}
            onChange={e => setPoleOffset(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>0.00</span><span>3.00</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Asphalt
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
              Maintenance <span className="text-slate-400">({mf.toFixed(2)})</span>
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

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Luminaire arrangement
          </label>
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

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Lighting class <span className="text-slate-400">({lighting_class})</span>
          </label>
          <div className="grid grid-cols-6 gap-1">
            {lightingClasses.map(c => (
              <button
                key={c}
                onClick={() => setLightingClass(c)}
                className={`py-1.5 rounded-md text-xs font-medium transition-all
                  ${lighting_class === c
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GeometryPanel;
