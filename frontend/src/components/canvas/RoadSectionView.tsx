import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';

const RoadSectionView: React.FC = () => {
  const { road_width, sidewalk_left, sidewalk_right, height, arm_length, pole_offset, tilt, lanes } = useConfigStore();

  const totalW = road_width + sidewalk_left + sidewalk_right;
  const roadThick = 14;

  const W = 500;
  const H = 280;
  const margin = { top: 12, right: 42, bottom: 16, left: 42 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const maxConfiguredTotalW = 25 + 5 + 5;
  const maxConfiguredHeight = 16;
  const roadScale = (plotW - 10) / maxConfiguredTotalW;
  const poleScale = (plotH * 0.82) / (maxConfiguredHeight + 2);

  const roadY = H - margin.bottom - roadThick;
  const roadBase = roadY + roadThick;

  const roadEdgeX = margin.left + sidewalk_left * roadScale;
  const poleX = roadEdgeX - pole_offset * roadScale;
  const poleTop = roadY - height * poleScale;
  const armEndX = poleX + arm_length * roadScale;

  const roadPx = road_width * roadScale;
  const swlPx = sidewalk_left * roadScale;
  const swrPx = sidewalk_right * roadScale;
  const tiltRadians = Math.abs(tilt) * Math.PI / 180;
  const tiltArcEndX = 22 * Math.cos(tiltRadians);
  const tiltArcEndY = tilt < 0 ? 22 * Math.sin(tiltRadians) : -22 * Math.sin(tiltRadians);
  const tiltArcSweep = tilt < 0 ? 1 : 0;

  const Wtext = `W = ${totalW.toFixed(1)} m`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          Cross-section
        </h3>
        <span className="text-xs text-slate-400">h = {height.toFixed(1)} m &middot; W = {totalW.toFixed(1)} m</span>
      </div>
      <div className="p-3 flex justify-center">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <line x1={margin.left - 5} y1={roadBase} x2={margin.left + totalW * roadScale + 5} y2={roadBase}
                stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2"/>

          {sidewalk_left > 0 && (
            <rect x={margin.left} y={roadY} width={swlPx} height={roadThick}
                  fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" rx="1"/>
          )}

          <rect x={margin.left + swlPx} y={roadY} width={roadPx} height={roadThick}
                fill="#475569" stroke="#334155" strokeWidth="0.5" rx="1"/>

          {Array.from({ length: lanes - 1 }).map((_, i) => {
            const lx = margin.left + swlPx + ((i + 1) / lanes) * roadPx;
            return (
              <line key={`lm-${i}`}
                x1={lx} y1={roadY + 2} x2={lx} y2={roadBase - 2}
                stroke="white" strokeWidth="1" strokeDasharray="3,3"/>
            );
          })}

          {sidewalk_right > 0 && (
            <rect x={margin.left + swlPx + roadPx} y={roadY} width={swrPx} height={roadThick}
                  fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" rx="1"/>
          )}

          <line x1={poleX} y1={roadBase} x2={poleX} y2={poleTop}
                stroke="#334155" strokeWidth="4" strokeLinecap="round"/>

          {pole_offset > 0 && (
            <>
              <line x1={poleX} y1={roadBase - 20} x2={roadEdgeX} y2={roadBase - 20}
                    stroke="#64748b" strokeWidth="1"/>
              <polygon points={`${poleX},${roadBase - 20} ${poleX + 5},${roadBase - 24} ${poleX + 5},${roadBase - 16}`} fill="#64748b"/>
              <polygon points={`${roadEdgeX},${roadBase - 20} ${roadEdgeX - 5},${roadBase - 24} ${roadEdgeX - 5},${roadBase - 16}`} fill="#64748b"/>
              <rect x={(poleX + roadEdgeX) / 2 - 22} y={roadBase - 41} width="44" height="16" rx="3" fill="white" opacity="0.9"/>
              <text x={(poleX + roadEdgeX) / 2} y={roadBase - 29}
                    textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="600">
                {pole_offset.toFixed(2)}m
              </text>
            </>
          )}

          {arm_length > 0 && (
            <line x1={poleX} y1={poleTop} x2={armEndX} y2={poleTop}
                  stroke="#334155" strokeWidth="3" strokeLinecap="round"/>
          )}

          {/* Luminaire head — with tilt indicator */}
          <g transform={`translate(${armEndX}, ${poleTop})`}>
            {/* Horizontal reference line (always shown) */}
            <line x1="0" y1="0" x2="32" y2="0" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3"/>
            {/* Tilted luminaire */}
            <g transform={`rotate(${-tilt})`}>
              {/* Luminaire body */}
              <rect x="-4" y="-14" width="24" height="10" fill="#2563eb" rx="1.5"/>
              <rect x="-4" y="-14" width="5" height="10" fill="#1d4ed8" rx="1.5"/>
              {/* Light direction arrow */}
              <line x1="20" y1="-9" x2="32" y2="-9" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
              <polygon points="32,-9 27,-12 27,-6" fill="#3b82f6"/>
            </g>
            {/* Angle arc */}
            {tilt !== 0 && (
              <path d={`M 22,0 A 22,22 0 0,${tiltArcSweep} ${tiltArcEndX},${tiltArcEndY}`}
                    fill="none" stroke="#ef4444" strokeWidth="1.2"/>
            )}
            {/* Angle label (always shown) */}
            <rect x="20" y="4" width="32" height="18" rx="3" fill="white" opacity="0.9"/>
            <text x="36" y="16" textAnchor="middle" fontSize="11" fill="#ef4444" fontWeight="700">
              {tilt.toFixed(0)}°
            </text>
          </g>

          <polygon
            points={`${armEndX},${poleTop}
                    ${margin.left + swlPx},${roadBase}
                    ${margin.left + swlPx + roadPx},${roadBase}`}
            fill="rgba(37, 99, 235, 0.06)" stroke="rgba(37, 99, 235, 0.15)" strokeWidth="0.5"
          />

          {/* DIM: Total width (road + sidewalks) — matches plan view W */}
          <line x1={margin.left} y1={roadBase + 10}
                x2={margin.left + totalW * roadScale} y2={roadBase + 10}
                stroke="#64748b" strokeWidth="1"/>
          <polygon points={`${margin.left},${roadBase + 10} ${margin.left + 5},${roadBase + 6} ${margin.left + 5},${roadBase + 14}`} fill="#64748b"/>
          <polygon points={`${margin.left + totalW * roadScale},${roadBase + 10} ${margin.left + totalW * roadScale - 5},${roadBase + 6} ${margin.left + totalW * roadScale - 5},${roadBase + 14}`} fill="#64748b"/>
          <rect x={margin.left + (totalW * roadScale) / 2 - 55} y={roadBase + 16} width="110" height="18" rx="3" fill="white" opacity="0.85"/>
          <text x={margin.left + (totalW * roadScale) / 2} y={roadBase + 29}
                textAnchor="middle" fontSize="12" fill="#1e293b" fontWeight="600">
            {Wtext}
          </text>

          {/* DIM: Pole height */}
          <line x1={poleX + 8} y1={poleTop} x2={poleX + 8} y2={roadBase}
                stroke="#64748b" strokeWidth="1"/>
          <polygon points={`${poleX + 8},${poleTop} ${poleX + 4},${poleTop + 5} ${poleX + 12},${poleTop + 5}`} fill="#64748b"/>
          <polygon points={`${poleX + 8},${roadBase} ${poleX + 4},${roadBase - 5} ${poleX + 12},${roadBase - 5}`} fill="#64748b"/>
          <rect x={poleX + 12} y={(poleTop + roadBase) / 2 - 8} width="70" height="18" rx="3" fill="white" opacity="0.85"/>
          <text x={poleX + 16} y={(poleTop + roadBase) / 2 + 5}
                textAnchor="start" fontSize="12" fill="#1e293b" fontWeight="600">
            h = {height.toFixed(1)} m
          </text>

          {arm_length > 0 && (
            <>
              <line x1={armEndX} y1={poleTop - 10} x2={poleX} y2={poleTop - 10}
                    stroke="#64748b" strokeWidth="1"/>
              <polygon points={`${armEndX},${poleTop - 10} ${armEndX + 5},${poleTop - 14} ${armEndX + 5},${poleTop - 6}`} fill="#64748b"/>
              <polygon points={`${poleX},${poleTop - 10} ${poleX - 5},${poleTop - 14} ${poleX - 5},${poleTop - 6}`} fill="#64748b"/>
              <text x={(armEndX + poleX) / 2} y={poleTop - 18}
                    textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="600">
                {arm_length.toFixed(1)}m
              </text>
            </>
          )}


        </svg>
      </div>
    </div>
  );
};

export default RoadSectionView;
