import React, { useEffect, useState } from 'react';

interface EditableSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (value: number) => void;
  className?: string;
  marks?: Array<string | number>;
  disabled?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatValue = (value: number, decimals: number) => value.toFixed(decimals).replace('.', ',');
const parseValue = (value: string) => Number(value.replace(',', '.'));

const EditableSlider: React.FC<EditableSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  decimals = 1,
  onChange,
  className = '',
  marks,
  disabled = false,
}) => {
  const [draft, setDraft] = useState(formatValue(value, decimals));
  const [isFocused, setIsFocused] = useState(false);
  const percent = ((clamp(value, min, max) - min) / (max - min)) * 100;

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatValue(value, decimals));
    }
  }, [value, decimals, isFocused]);

  const commitValue = (rawValue: string) => {
    const next = parseValue(rawValue);
    if (!disabled && Number.isFinite(next)) {
      onChange(clamp(next, min, max));
    }
  };

  return (
    <div className={`rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 ${disabled ? 'opacity-70' : ''} ${className}`}>
      <label className="block truncate text-xs font-semibold text-slate-600">
        {label}
      </label>
      <div className="mt-1.5 rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <div className="flex items-center px-2.5 py-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onChange={e => {
              setDraft(e.target.value);
              if (e.target.value !== '') {
                commitValue(e.target.value);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              if (draft === '') {
                setDraft(formatValue(value, decimals));
                return;
              }
              const next = parseValue(draft);
              if (Number.isFinite(next)) {
                const clamped = clamp(next, min, max);
                onChange(clamped);
                setDraft(formatValue(clamped, decimals));
              } else {
                setDraft(formatValue(value, decimals));
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-center text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed"
          />
          {unit && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => commitValue(e.target.value)}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, #2563eb 0%, #2563eb ${percent}%, #e2e8f0 ${percent}%, #e2e8f0 100%)`,
        }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        {marks ? marks.map(mark => <span key={String(mark)}>{mark}</span>) : (
          <>
            <span>{min}</span>
            <span>{max}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default EditableSlider;
