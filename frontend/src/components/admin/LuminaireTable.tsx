import React, { useEffect, useState } from 'react';
import type { LDTInfo } from '../../types';
import { useI18n } from '../../i18n';

interface Props {
  onEdit: (lum: LDTInfo) => void;
  refreshKey: number;
}

const LuminaireTable: React.FC<Props> = ({ onEdit, refreshKey }) => {
  const { t } = useI18n();
  const [luminaires, setLuminaires] = useState<LDTInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/luminaires')
      .then(res => res.json())
      .then(setLuminaires)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [refreshKey]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.deleteConfirm'))) return;
    await fetch(`/api/admin/luminaires/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-400">{t('admin.loadingLuminaires')}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500 text-xs uppercase tracking-wider">
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">{t('luminaire.manufacturer')}</th>
            <th className="px-3 py-2">{t('luminaire.type')}</th>
            <th className="px-3 py-2">Optic</th>
            <th className="px-3 py-2">CCT</th>
            <th className="px-3 py-2">CRI</th>
            <th className="px-3 py-2">{t('luminaire.power')}</th>
            <th className="px-3 py-2">{t('results.flux')}</th>
            <th className="px-3 py-2">{t('admin.filename')}</th>
            <th className="px-3 py-2 text-right">{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {luminaires.map(lum => (
            <tr key={lum.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-400">{lum.id}</td>
              <td className="px-3 py-2 font-medium text-slate-700">{lum.manufacturer}</td>
              <td className="px-3 py-2">{lum.model_family}</td>
              <td className="px-3 py-2">
                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                  {lum.optic_family}
                </span>
              </td>
              <td className="px-3 py-2">{lum.cct}K</td>
              <td className="px-3 py-2">{lum.cri ?? 70}</td>
              <td className="px-3 py-2">{lum.power.toFixed(1)}W</td>
              <td className="px-3 py-2">{(lum.flux / 1000).toFixed(1)}k lm</td>
              <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">{lum.luminaire_name}</td>
              <td className="px-3 py-2 text-right space-x-1">
                <button
                  onClick={() => onEdit(lum)}
                  className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  {t('actions.edit')}
                </button>
                <button
                  onClick={() => handleDelete(lum.id)}
                  className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  {t('actions.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {luminaires.length === 0 && (
        <p className="text-center py-8 text-slate-400">{t('admin.noLuminaires')}</p>
      )}
    </div>
  );
};

export default LuminaireTable;
