import React, { useEffect, useMemo, useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { AdvancedOptimizationObjective, AdvancedOptimizationVariables, LDTInfo } from '../../types';
import { useI18n } from '../../i18n';

interface AutoOptimizePanelProps {
  loading: boolean;
  onRunSimple: () => void;
  onRunAdvanced: (
    variables: AdvancedOptimizationVariables,
    objective: AdvancedOptimizationObjective,
    opticFamilies: string[],
  ) => void;
}

const AutoOptimizePanel: React.FC<AutoOptimizePanelProps> = ({ loading, onRunSimple, onRunAdvanced }) => {
  const { t } = useI18n();
  const { manufacturer, model_family, optic_family } = useConfigStore();
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [variables, setVariables] = useState<AdvancedOptimizationVariables>({
    power: true,
    spacing: false,
    height: false,
    arm_length: false,
    tilt: false,
    optic_family: false,
  });
  const [objective, setObjective] = useState<AdvancedOptimizationObjective>('technical_limits');
  const [catalog, setCatalog] = useState<LDTInfo[]>([]);
  const [selectedOptics, setSelectedOptics] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/ldt/catalog')
      .then(res => res.json())
      .then((data: LDTInfo[]) => setCatalog(data))
      .catch(() => setCatalog([]));
  }, []);

  const availableOptics = useMemo(() => {
    return Array.from(new Set(
      catalog
        .filter(item => item.manufacturer === manufacturer && item.model_family === model_family)
        .map(item => item.optic_family)
    )).sort();
  }, [catalog, manufacturer, model_family]);

  useEffect(() => {
    if (!variables.optic_family) {
      setSelectedOptics(optic_family ? [optic_family] : []);
      return;
    }
    setSelectedOptics(current => {
      const valid = current.filter(item => availableOptics.includes(item));
      return valid.length > 0 ? valid : availableOptics;
    });
  }, [availableOptics, optic_family, variables.optic_family]);

  const toggleVariable = (key: keyof AdvancedOptimizationVariables) => {
    if (key === 'power') return;
    setVariables(current => {
      const nextValue = !current[key];
      if (key === 'optic_family' && nextValue) {
        setSelectedOptics(availableOptics);
      }
      return { ...current, [key]: nextValue };
    });
  };

  const toggleOptic = (optic: string) => {
    setSelectedOptics(current => (
      current.includes(optic)
        ? current.filter(item => item !== optic)
        : [...current, optic].sort()
    ));
  };

  const handleRun = () => {
    if (mode === 'advanced') {
      onRunAdvanced(variables, objective, selectedOptics);
      return;
    }
    onRunSimple();
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t('optimize.title')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'simple' ? t('optimize.simpleSubtitle') : t('optimize.advancedSubtitle')}
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-1">
            {mode === 'simple' ? 'v1' : t('optimize.advanced')}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(['simple', 'advanced'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                mode === option
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option === 'simple' ? t('optimize.power') : t('optimize.advanced')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="text-slate-400 uppercase tracking-wide text-[10px]">{t('optimize.fixed')}</div>
            <div className="font-medium text-slate-700 mt-0.5">
              {mode === 'simple' ? t('optimize.geometryOptics') : t('optimize.roadOptics')}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="text-slate-400 uppercase tracking-wide text-[10px]">{t('optimize.variable')}</div>
            <div className="font-medium text-slate-700 mt-0.5">
              {mode === 'simple' ? t('optimize.powerOnly') : t('optimize.powerSelected')}
            </div>
          </div>
        </div>

        {mode === 'advanced' && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">{t('optimize.priority')}</span>
              <select
                value={objective}
                onChange={(event) => setObjective(event.target.value as AdvancedOptimizationObjective)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="technical_limits">{t('optimize.closestLimits')}</option>
                <option value="min_power">{t('optimize.lowestPower')}</option>
                <option value="max_spacing">{t('optimize.maxSpacing')}</option>
              </select>
            </label>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{t('optimize.allowChanges')}</div>
              {([
                ['power', t('luminaire.power')],
                ['spacing', t('geometry.spacing')],
                ['height', t('pole.height')],
                ['arm_length', t('pole.armLength')],
                ['tilt', t('pole.armTilt')],
                ['optic_family', t('luminaire.lensOptic')],
              ] as const).map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    variables[key]
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  } ${key === 'power' ? 'cursor-default' : ''}`}
                  title={key === 'power' ? t('optimize.powerAlwaysEnabled') : undefined}
                >
                  <input
                    type="checkbox"
                    checked={variables[key]}
                    disabled={key === 'power'}
                    onChange={() => toggleVariable(key)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-70"
                  />
                  {label}
                </label>
              ))}
            </div>

            {variables.optic_family && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">{t('optimize.lensSelection')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {availableOptics.map(optic => (
                    <label
                      key={optic}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        selectedOptics.includes(optic)
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOptics.includes(optic)}
                        onChange={() => toggleOptic(optic)}
                        className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {optic}
                    </label>
                  ))}
                  {availableOptics.length === 0 && (
                    <span className="text-xs text-slate-400">{t('optimize.noLenses')}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all ${
            loading
              ? 'bg-emerald-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-sm shadow-emerald-100'
          }`}
        >
          {loading ? t('optimize.optimizing') : mode === 'advanced' ? t('optimize.runAdvanced') : t('optimize.runSimple')}
        </button>
      </div>
    </section>
  );
};

export default AutoOptimizePanel;
