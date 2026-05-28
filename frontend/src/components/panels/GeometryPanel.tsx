import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';

const GeometryPanel: React.FC = () => {
  const {
    road_width, setRoadWidth,
    sidewalk_left, setSidewalkLeft,
    sidewalk_right, setSidewalkRight,
    lanes, setLanes,
  } = useConfigStore();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          Road Geometry
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Road width <span className="text-slate-400">({road_width.toFixed(1)} m)</span>
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
        </div>
      </div>
    </div>
  );
};

export default GeometryPanel;
