import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { LDTInfo } from '../../types';
import EditableSlider from '../ui/EditableSlider';
import { useI18n } from '../../i18n';

const unique = <T,>(values: T[]) => Array.from(new Set(values)).sort();

const LuminairePanel: React.FC = () => {
  const { t } = useI18n();
  const {
    optic_family, setOpticFamily, power, setPower, cct, setCct,
    cri, setCri,
    manufacturer, setManufacturer, model_family, setModelFamily,
    ldt_id, setSelectedLdt,
  } = useConfigStore();

  const [catalog, setCatalog] = useState<LDTInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [externalLdt, setExternalLdt] = useState<LDTInfo | null>(null);
  const [uploadingExternal, setUploadingExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadCatalog = () => {
    setLoading(true);
    fetch('/api/ldt/catalog')
      .then(res => res.json())
      .then((data: LDTInfo[]) => setCatalog(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCatalog(); }, []);

  const manufacturers = useMemo(() => unique(catalog.map(item => item.manufacturer)), [catalog]);
  const types = useMemo(
    () => unique(catalog.filter(item => item.manufacturer === manufacturer).map(item => item.model_family)),
    [catalog, manufacturer]
  );
  const lenses = useMemo(
    () => unique(catalog.filter(
      item => item.manufacturer === manufacturer && item.model_family === model_family
    ).map(item => item.optic_family)),
    [catalog, manufacturer, model_family]
  );

  const referenceLdt = useMemo(
    () => catalog.find(
      item => item.manufacturer === manufacturer
        && item.model_family === model_family
        && item.optic_family === optic_family
    ) || null,
    [catalog, manufacturer, model_family, optic_family]
  );

  useEffect(() => {
    if (ldt_id.startsWith('temp-')) return;
    if (referenceLdt && referenceLdt.id !== ldt_id) {
      setSelectedLdt(referenceLdt);
    }
  }, [referenceLdt?.id, ldt_id, setSelectedLdt]);

  useEffect(() => {
    if (catalog.length === 0 || manufacturer) return;
    const first = catalog[0];
    setManufacturer(first.manufacturer);
    setModelFamily(first.model_family);
    setOpticFamily(first.optic_family);
  }, [catalog, manufacturer, setManufacturer, setModelFamily, setOpticFamily]);

  useEffect(() => {
    if (manufacturer && !types.includes(model_family)) {
      setModelFamily(types[0] || '');
    }
  }, [manufacturer, types, model_family, setModelFamily]);

  useEffect(() => {
    if (model_family && !lenses.includes(optic_family)) {
      setOpticFamily(lenses[0] || '');
    }
  }, [model_family, lenses, optic_family, setOpticFamily]);

  const clearExternalLdt = () => {
    setExternalLdt(null);
    setExternalError(null);
    if (referenceLdt) {
      setSelectedLdt(referenceLdt);
    }
  };

  const uploadExternalLdt = async (file?: File) => {
    if (!file) return;
    if (!/\.ldt$/i.test(file.name)) {
      setExternalError(t('luminaire.selectLdt'));
      return;
    }

    setUploadingExternal(true);
    setExternalError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('persist', 'false');

    try {
      const response = await fetch('/api/ldt/upload', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || t('luminaire.invalidLdt'));
      }
      const ldt = data as LDTInfo;
      setExternalLdt(ldt);
      setSelectedLdt(ldt);
      setPower(ldt.power);
      setCct(ldt.cct);
      setCri((ldt.cri === 80 || ldt.cri === 90 ? ldt.cri : 70) as 70 | 80 | 90);
    } catch (err: any) {
      setExternalError(err.message || t('luminaire.invalidLdt'));
    } finally {
      setUploadingExternal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const activeReference = externalLdt || referenceLdt;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 008.91 14"/>
          </svg>
          {t('luminaire.title')}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"/>
            <p className="text-xs text-slate-400 mt-2">{t('luminaire.loadingCatalog')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-600">
                {t('luminaire.manufacturer')}
                <select
                  value={manufacturer}
                  onChange={e => {
                    clearExternalLdt();
                    setManufacturer(e.target.value);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {manufacturers.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600">
                {t('luminaire.type')}
                <select
                  value={model_family}
                  onChange={e => {
                    clearExternalLdt();
                    setModelFamily(e.target.value);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {types.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                {t('luminaire.lensOptic')}
              </label>
              <div className="flex flex-wrap gap-1">
                {lenses.map(item => (
                  <button
                    key={item}
                    onClick={() => {
                      clearExternalLdt();
                      setOpticFamily(item);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
                      ${optic_family === item
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <EditableSlider
              label={t('luminaire.power')}
              value={power}
              min={0}
              max={500}
              step={1}
              unit="W"
              decimals={0}
              onChange={setPower}
              disabled={Boolean(externalLdt)}
            />

            <EditableSlider
              label={t('luminaire.temperature')}
              value={cct}
              min={2700}
              max={6500}
              step={100}
              unit="K"
              decimals={0}
              onChange={setCct}
              marks={['2700K', '4000K', '6500K']}
              disabled={Boolean(externalLdt)}
            />

            <label className="block text-sm font-medium text-slate-600">
              CRI
              <select
                value={cri}
                onChange={e => setCri(Number(e.target.value) as 70 | 80 | 90)}
                disabled={Boolean(externalLdt)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value={70}>70</option>
                <option value={80}>80</option>
                <option value={90}>90</option>
              </select>
            </label>

            <div
              onDragOver={e => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => {
                e.preventDefault();
                setDragActive(false);
                uploadExternalLdt(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-lg border p-3 text-xs transition-colors ${
                dragActive
                  ? 'border-blue-400 bg-blue-100'
                  : externalLdt
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-blue-100 bg-blue-50'
              } text-slate-600`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-700">
                  {externalLdt ? t('luminaire.externalLdt') : t('luminaire.referenceLdt')}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingExternal}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingExternal ? t('actions.loading') : t('luminaire.loadLdt')}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ldt"
                className="sr-only"
                onChange={e => uploadExternalLdt(e.target.files?.[0])}
              />

              {activeReference ? (
                <>
                  <div className="mt-2 truncate">{activeReference.luminaire_name}</div>
                  <div className={externalLdt ? 'text-emerald-700' : 'text-blue-600'}>
                    {activeReference.power.toFixed(0)} W - {(activeReference.flux / 1000).toFixed(1)}k lm - {activeReference.efficiency.toFixed(1)} lm/W - CRI {activeReference.cri ?? 70}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-slate-400">{t('luminaire.noReference')}</div>
              )}

              {externalError && (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                  {externalError}
                </div>
              )}

              {externalLdt && (
                <button
                  type="button"
                  onClick={clearExternalLdt}
                  className="mt-2 rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  {t('luminaire.useCatalogReference')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LuminairePanel;
