import React, { useEffect, useState } from 'react';
import type { LDTInfo } from '../../types';

interface FormData {
  manufacturer: string;
  model_family: string;
  optic_family: string;
  luminaire_name: string;
  power: number;
  cct: number;
  flux: number;
  efficiency: number;
  LORL: number;
  isym: number;
}

const defaultForm = (): FormData => ({
  manufacturer: '',
  model_family: '',
  optic_family: '',
  luminaire_name: '',
  power: 0,
  cct: 4000,
  flux: 0,
  efficiency: 0,
  LORL: 100,
  isym: 0,
});

interface Props {
  editLum: LDTInfo | null;
  onSaved: () => void;
  onCancel: () => void;
}

const LuminaireForm: React.FC<Props> = ({ editLum, onSaved, onCancel }) => {
  const [form, setForm] = useState<FormData>(defaultForm());
  const [ldtFile, setLdtFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (editLum) {
      setForm({
        manufacturer: editLum.manufacturer,
        model_family: editLum.model_family,
        optic_family: editLum.optic_family,
        luminaire_name: editLum.luminaire_name,
        power: editLum.power,
        cct: editLum.cct,
        flux: editLum.flux,
        efficiency: editLum.efficiency,
        LORL: editLum.LORL,
        isym: editLum.isym,
      });
    } else {
      setForm(defaultForm());
    }
    setLdtFile(null);
    setMessage(null);
  }, [editLum]);

  const handleField = (field: keyof FormData, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLdtFile(file);
    setMessage(null);
    setParsing(true);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/admin/parse-ldt', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setForm(prev => ({
          ...prev,
          manufacturer: data.manufacturer || prev.manufacturer,
          model_family: data.model_family || prev.model_family,
          optic_family: data.optic_family || prev.optic_family,
          luminaire_name: data.luminaire_name || prev.luminaire_name,
          power: data.power ?? prev.power,
          cct: data.cct ?? prev.cct,
          flux: data.flux ?? prev.flux,
          efficiency: data.efficiency ?? prev.efficiency,
          LORL: data.LORL ?? prev.LORL,
          isym: data.isym ?? prev.isym,
        }));
        setMessage('LDT parsed. Review the fields before saving.');
      } else {
        setMessage(`Parse error: ${data.detail || 'Invalid LDT'}`);
      }
    } catch (err: any) {
      setMessage(`Parse error: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (editLum) {
        // Update existing
        const res = await fetch(`/api/admin/luminaires/${editLum.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Update failed');
        }
        setMessage('Luminaire updated.');
      } else {
        // Create new - requires LDT file
        if (!ldtFile) {
          setMessage('Select an LDT file to upload.');
          setSaving(false);
          return;
        }
        const fd = new FormData();
        fd.append('file', ldtFile);
        fd.append('manufacturer', form.manufacturer);
        fd.append('model_family', form.model_family);
        fd.append('optic_family', form.optic_family);
        fd.append('luminaire_name', form.luminaire_name);
        fd.append('power', String(form.power));
        fd.append('cct', String(form.cct));
        fd.append('flux', String(form.flux));
        fd.append('efficiency', String(form.efficiency));
        fd.append('LORL', String(form.LORL));
        fd.append('isym', String(form.isym));

        const res = await fetch('/api/admin/luminaires/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Upload failed');
        }
        setMessage('Luminaire created.');
      }
      onSaved();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-slate-700">
        {editLum ? 'Edit Luminaire' : 'New Luminaire'}
      </h3>

      {!editLum && (
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            LDT File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".ldt"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {parsing && <p className="text-xs text-slate-400 mt-1">Parsing LDT...</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm font-medium text-slate-600">
          Manufacturer
          <input
            value={form.manufacturer}
            onChange={e => handleField('manufacturer', e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Model Family / Type
          <input
            value={form.model_family}
            onChange={e => handleField('model_family', e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Optic Family
          <input
            value={form.optic_family}
            onChange={e => handleField('optic_family', e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Luminaire Name
          <input
            value={form.luminaire_name}
            onChange={e => handleField('luminaire_name', e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Power (W)
          <input
            type="number"
            step="0.1"
            value={form.power}
            onChange={e => handleField('power', parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          CCT (K)
          <input
            type="number"
            step="100"
            value={form.cct}
            onChange={e => handleField('cct', parseInt(e.target.value) || 4000)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Flux (lm)
          <input
            type="number"
            step="0.01"
            value={form.flux}
            onChange={e => handleField('flux', parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Efficiency (lm/W)
          <input
            type="number"
            step="0.1"
            value={form.efficiency}
            onChange={e => handleField('efficiency', parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          LORL (%)
          <input
            type="number"
            step="0.01"
            value={form.LORL}
            onChange={e => handleField('LORL', parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Isym <span className="text-xs text-slate-400 cursor-help" title="Photometric symmetry index from LDT. Auto-filled when you upload a file.">ⓘ</span>
          <select
            value={form.isym}
            onChange={e => handleField('isym', parseInt(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value={0}>0 - No symmetry (asymmetric)</option>
            <option value={1}>1 - Rotational symmetry</option>
            <option value={2}>2 - Symmetry C0-C180</option>
            <option value={3}>3 - Symmetry C90-C270</option>
            <option value={4}>4 - Quadrant symmetry</option>
          </select>
        </label>
      </div>

      {message && (
        <div className={`text-sm px-3 py-2 rounded-md ${
          message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {message}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || (!editLum && !ldtFile)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : editLum ? 'Update' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default LuminaireForm;
