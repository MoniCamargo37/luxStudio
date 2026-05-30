import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import EditableSlider from '../ui/EditableSlider';

const ArrangementPanel: React.FC = () => {
  const {
    height, setHeight,
    arm_length, setArmLength,
    tilt, setTilt,
  } = useConfigStore();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          Pole
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <EditableSlider
          label="Pole height"
          value={height}
          min={4}
          max={16}
          step={0.01}
          unit="m"
          decimals={2}
          onChange={setHeight}
        />

        <div className="grid grid-cols-2 gap-3">
          <EditableSlider
            label="Bracket arm"
            value={arm_length}
            min={0}
            max={4}
            step={0.25}
            unit="m"
            decimals={2}
            onChange={setArmLength}
          />
          <EditableSlider
            label="Head tilt"
            value={tilt}
            min={-25}
            max={25}
            step={1}
            unit="deg"
            decimals={0}
            onChange={setTilt}
          />
        </div>
      </div>
    </div>
  );
};

export default ArrangementPanel;
