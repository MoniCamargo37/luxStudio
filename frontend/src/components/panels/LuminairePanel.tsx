import React, { useEffect, useMemo, useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { LDTInfo } from '../../types';

const unique = <T,>(values: T[]) => Array.from(new Set(values)).sort();

const uniqueLdts = (items: LDTInfo[]) => {
  const seen = new Map<string, LDTInfo>();
  items.forEach(item => {
    const key = [
      item.id,
      item.manufacturer,
      item.model_family,
      item.cct,
      item.optic_family,
      item.power,
    ].join('|');
    if (!seen.has(key)) seen.set(key, item);
  });
  return Array.from(seen.values());
};

const LuminairePanel: React.FC = () => {
  const { optic_family, setOpticFamily, power, setPower, cct, setCct, setSelectedLdt } = useConfigStore();
  const [catalog, setCatalog] = useState<LDTInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [manufacturer, setManufacturer] = useState('');
  const [modelFamily, setModelFamily] = useState('');
  const [selectedCct, setSelectedCct] = useState<number>(cct);
  const [selectedPower, setSelectedPower] = useState<number>(power);
  const [selectedLens, setSelectedLens] = useState<string>(optic_family);
  const [selectedId, setSelectedId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPersist, setUploadPersist] = useState(false);
  const [uploadManufacturer, setUploadManufacturer] = useState('Custom');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const loadCatalog = () => {
    setLoading(true);
    fetch('/api/ldt/catalog')
      .then(res => res.json())
      .then((data: LDTInfo[]) => setCatalog(uniqueLdts(data)))
      .catch(err => console.error('Failed to load LDT catalog:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const manufacturers = useMemo(() => unique(catalog.map(item => item.manufacturer)), [catalog]);
  const models = useMemo(
    () => unique(catalog.filter(item => item.manufacturer === manufacturer).map(item => item.model_family)),
    [catalog, manufacturer]
  );
  const ccts = useMemo(
    () => unique(catalog
      .filter(item => item.manufacturer === manufacturer && item.model_family === modelFamily)
      .map(item => item.cct)),
    [catalog, manufacturer, modelFamily]
  );
  const baseOptions = useMemo(
    () => catalog.filter(item =>
      item.manufacturer === manufacturer &&
      item.model_family === modelFamily &&
      item.cct === selectedCct
    ).sort((a, b) => a.power - b.power || a.optic_family.localeCompare(b.optic_family)),
    [catalog, manufacturer, modelFamily, selectedCct]
  );
  const powers = useMemo(() => unique(baseOptions.map(item => item.power)), [baseOptions]);
  const lenses = useMemo(
    () => unique(baseOptions.filter(item => item.power === selectedPower).map(item => item.optic_family)),
    [baseOptions, selectedPower]
  );
  const options = useMemo(
    () => uniqueLdts(baseOptions.filter(item => item.power === selectedPower && item.optic_family === selectedLens)),
    [baseOptions, selectedPower, selectedLens]
  );

  useEffect(() => {
    if (catalog.length === 0) return;
    const matching = catalog.find(item =>
      item.optic_family === optic_family &&
      Math.abs(item.power - power) < 1 &&
      item.cct === cct
    ) || catalog.find(item =>
      item.optic_family === optic_family &&
      Math.abs(item.power - power) < 1
    ) || catalog[0];
    setManufacturer(matching.manufacturer);
    setModelFamily(matching.model_family);
    setSelectedCct(matching.cct);
    setSelectedPower(matching.power);
    setSelectedLens(matching.optic_family);
    setSelectedId(matching.id);
    setSelectedLdt(matching);
  }, [catalog]);

  useEffect(() => {
    if (!manufacturer && manufacturers.length > 0) setManufacturer(manufacturers[0]);
  }, [manufacturers, manufacturer]);

  useEffect(() => {
    if (!models.includes(modelFamily)) setModelFamily(models[0] || '');
  }, [models, modelFamily]);

  useEffect(() => {
    if (!ccts.includes(selectedCct)) setSelectedCct(ccts[0] || 4000);
  }, [ccts, selectedCct]);

  useEffect(() => {
    if (!powers.includes(selectedPower)) setSelectedPower(powers[0] || 0);
  }, [powers, selectedPower]);

  useEffect(() => {
    if (!lenses.includes(selectedLens)) setSelectedLens(lenses[0] || '');
  }, [lenses, selectedLens]);

  useEffect(() => {
    const selected = options.find(item => item.id === selectedId) || options[0];
    if (!selected) return;
    setSelectedId(selected.id);
    setSelectedLdt(selected);
  }, [options, selectedId]);

  const selected = options.find(item => item.id === selectedId) || catalog.find(item => item.id === selectedId);

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setUploadMessage(null);
    const form = new FormData();
    form.append('file', file);
    form.append('persist', String(uploadPersist));
    form.append('manufacturer', uploadManufacturer);
    const response = await fetch('/api/ldt/upload', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) {
      setUploadMessage(data.detail || 'Invalid LDT file');
      return;
    }
    setUploadMessage(uploadPersist ? 'LDT saved to catalog.' : `Valid LDT: ${data.luminaire_name}`);
    if (uploadPersist) loadCatalog();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 008.91 14"/>
          </svg>
          Luminaire
        </h3>
        <button
          type="button"
          onClick={() => setUploadOpen(open => !open)}
          className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
        >
          Upload LDT
        </button>
      </div>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"/>
            <p className="text-xs text-slate-400 mt-2">Loading LDT catalog...</p>
          </div>
        ) : (
          <>
            {uploadOpen && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-slate-600">
                    Manufacturer
                    <input
                      value={uploadManufacturer}
                      onChange={e => setUploadManufacturer(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex items-end gap-2 text-xs text-slate-600 pb-1">
                    <input
                      type="checkbox"
                      checked={uploadPersist}
                      onChange={e => setUploadPersist(e.target.checked)}
                    />
                    Save to catalog
                  </label>
                </div>
                <input
                  type="file"
                  accept=".ldt"
                  onChange={e => handleUpload(e.target.files?.[0])}
                  className="block w-full text-xs text-slate-600"
                />
                {uploadMessage && <div className="text-xs text-slate-600">{uploadMessage}</div>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-600">
                Manufacturer
                <select value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm">
                  {manufacturers.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600">
                Type
                <select value={modelFamily} onChange={e => setModelFamily(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm">
                  {models.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Temperature
              </label>
              <div className="grid grid-cols-3 gap-1">
                {ccts.map(item => (
                  <button
                    key={item}
                    onClick={() => setSelectedCct(item)}
                    className={`py-1.5 rounded-md text-xs font-medium transition-all
                      ${selectedCct === item ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {item}K
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Power
              </label>
              <div className="grid grid-cols-4 gap-1">
                {powers.map(item => (
                  <button
                    key={item}
                    onClick={() => setSelectedPower(item)}
                    className={`py-1.5 rounded-md text-xs font-medium transition-all
                      ${selectedPower === item ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {item.toFixed(0)}W
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Lens / optic
              </label>
              <div className="grid grid-cols-3 gap-1">
                {lenses.map(item => (
                  <button
                    key={item}
                    onClick={() => setSelectedLens(item)}
                    className={`py-1.5 rounded-md text-xs font-medium transition-all
                      ${selectedLens === item ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                LDT file
              </label>
              <div className="rounded-lg px-3 py-2 text-xs border bg-blue-600 text-white border-blue-600">
                {selected ? (
                  <>
                    <span className="font-semibold">{selected.filename}</span>
                    <span className="block opacity-80">
                      {(selected.flux / 1000).toFixed(1)}k lm - {selected.efficiency.toFixed(1)} lm/W
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">No LDT selected</span>
                )}
              </div>
            </div>

            {selected && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700">{selected.luminaire_name}</div>
                <div>{selected.power.toFixed(0)} W - {(selected.flux / 1000).toFixed(1)}k lm - {selected.efficiency.toFixed(1)} lm/W</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LuminairePanel;
