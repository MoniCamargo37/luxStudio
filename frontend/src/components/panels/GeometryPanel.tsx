import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { ArrangementType, LightingClass, PavementType, PoleSide } from '../../types';
import EditableSlider from '../ui/EditableSlider';
import { useI18n } from '../../i18n';

const lightingClasses: LightingClass[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
const arrangements: { value: ArrangementType; label: string; icon: string }[] = [
  { value: 'Lineal', label: 'Unilateral', icon: '▬' },
  { value: 'Bilateral', label: 'Staggered', icon: '▮' },
  { value: 'Central Doble', label: 'Central Twin', icon: '◈' },
  { value: 'En Isleta', label: 'Central Single', icon: '◆' },
];

const GeometryPanel: React.FC = () => {
  const { t } = useI18n();
  const {
    road_width, setRoadWidth,
    sidewalk_left, setSidewalkLeft,
    sidewalk_right, setSidewalkRight,
    lanes, setLanes,
    pole_offset, setPoleOffset,
    pole_side, setPoleSide,
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
          {t('geometry.title')}
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <EditableSlider
          label={t('geometry.carriagewayWidth')}
          value={road_width}
          min={2.5}
          max={25}
          step={0.5}
          unit="m"
          decimals={1}
          onChange={setRoadWidth}
        />

        <div className="grid grid-cols-2 gap-3">
          <EditableSlider
            label={t('geometry.leftSidewalk')}
            value={sidewalk_left}
            min={0}
            max={5}
            step={0.5}
            unit="m"
            decimals={1}
            onChange={setSidewalkLeft}
          />
          <EditableSlider
            label={t('geometry.rightSidewalk')}
            value={sidewalk_right}
            min={0}
            max={5}
            step={0.5}
            unit="m"
            decimals={1}
            onChange={setSidewalkRight}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            {t('geometry.lanes')} <span className="text-slate-400">({lanes})</span>
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
            {t('geometry.laneWidth', { value: laneWidth.toFixed(2) })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            {t('geometry.arrangement')}
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
                {t(`arrangement.${a.value === 'Lineal' ? 'unilateral' : a.value === 'Bilateral' ? 'staggered' : a.value === 'Central Doble' ? 'centralTwin' : 'centralSingle'}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              {t('geometry.luminaireSidewalk')}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ['left', t('geometry.leftSidewalkOption')],
                ['right', t('geometry.rightSidewalkOption')],
              ] as [PoleSide, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setPoleSide(value)}
                  disabled={arrangement !== 'Lineal'}
                  className={`py-2 rounded-md text-xs font-semibold transition-all
                    ${pole_side === value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }
                    ${arrangement !== 'Lineal' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <EditableSlider
            label={t('geometry.poleOffset')}
            value={pole_offset}
            min={0}
            max={3}
            step={0.05}
            unit="m"
            decimals={2}
            onChange={setPoleOffset}
            marks={['0.00', '3.00']}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {t('geometry.asphalt')}
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
          <EditableSlider
            label={t('geometry.maintenance')}
            value={mf}
            min={0.5}
            max={1}
            step={0.01}
            decimals={2}
            onChange={setMf}
            marks={['0.50', '1.00']}
          />
        </div>

        <EditableSlider
          label={t('geometry.spacing')}
          value={spacing}
          min={10}
          max={60}
          step={1}
          unit="m"
          decimals={1}
          onChange={setSpacing}
        />

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            {t('geometry.lightingClass')} <span className="text-slate-400">({lighting_class})</span>
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
