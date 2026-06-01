import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { CalculationResult } from '../../types';
import { useI18n } from '../../i18n';

interface QuickInfoPanelProps {
  result: CalculationResult | null;
  loading: boolean;
}

const QuickInfoPanel: React.FC<QuickInfoPanelProps> = ({ result, loading }) => {
  const config = useConfigStore();
  const { t } = useI18n();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          {t('results.summary')}
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"/>
            <p className="text-sm text-slate-500">{t('actions.calculating')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('results.running')}</p>
          </div>
        ) : result ? (
          <>
            <div className={`text-center py-4 px-3 rounded-lg ${result.compliant ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${result.compliant ? 'text-green-600' : 'text-red-600'}`}>
                {result.compliant ? t('status.pass') : t('status.fail')}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                EN 13201 {config.lighting_class}
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('results.luminaire')}</span>
                <span className="font-medium text-right text-slate-700">{result.luminaire.luminaire_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('results.family')}</span>
                <span className="font-medium text-slate-700">{result.luminaire.optic_family}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('luminaire.power')}</span>
                <span className="font-medium text-slate-700">{result.luminaire.power.toFixed(0)} W</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('results.flux')}</span>
                <span className="font-medium text-slate-700">{(result.luminaire.flux / 1000).toFixed(1)}k lm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CRI</span>
                <span className="font-medium text-slate-700">{result.luminaire.cri ?? 70}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('results.efficiency')}</span>
                <span className="font-medium text-slate-700">{result.luminaire.efficiency.toFixed(1)} lm/W</span>
              </div>
              <hr className="my-2 border-slate-100"/>
              {result.Lavg !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Lavg</span>
                  <span className="font-medium text-slate-700">{result.Lavg.toFixed(2)} cd/m²</span>
                </div>
              )}
              {result.Uo !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Uo</span>
                  <span className="font-medium text-slate-700">{result.Uo.toFixed(3)}</span>
                </div>
              )}
              {result.Ul !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ul</span>
                  <span className="font-medium text-slate-700">{result.Ul.toFixed(3)}</span>
                </div>
              )}
              {result.TI !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">TI</span>
                  <span className="font-medium text-slate-700">{result.TI.toFixed(1)}%</span>
                </div>
              )}
              {result.SR !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">SR</span>
                  <span className="font-medium text-slate-700">{result.SR.toFixed(3)}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <p className="text-sm">{t('results.noResults')}</p>
            <p className="text-xs mt-1">{t('results.noResultsHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickInfoPanel;
