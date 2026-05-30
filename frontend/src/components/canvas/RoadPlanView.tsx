import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';

const RoadPlanView: React.FC = () => {
  const { road_width, sidewalk_left, sidewalk_right, lanes, spacing, arrangement, height, pole_offset, pole_side } = useConfigStore();

  const W = 500;
  const H = 230;
  const margin = { top: 14, right: 30, bottom: 34, left: 24 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const nSpans = 3;
  const totalW = road_width + sidewalk_left + sidewalk_right;

  const scaleY = (plotH - 12) / 40;
  const scaleX = Math.min(8, (plotW - 12) / Math.max(nSpans * spacing, 1));

  const spanPx = spacing * scaleX;
  const roadH = road_width * scaleY;
  const swlH = sidewalk_left * scaleY;
  const swrH = sidewalk_right * scaleY;
  const totalPxH = totalW * scaleY;

  const roadLeft = margin.left;
  const roadLen = nSpans * spanPx;
  const startY = margin.top + (plotH - totalPxH) / 2;

  const swlY = startY;
  const roadY = startY + swlH;
  const swrY = startY + swlH + roadH;
  const centerY = roadY + roadH / 2;

  const Wtext = `W = ${totalW.toFixed(1)} m`;

  const lumY = (side: 'top' | 'bottom' | 'center') => {
    if (side === 'center') return centerY;
    if (side === 'top') return Math.max(1, roadY - pole_offset * scaleY);
    return Math.min(H - 1, roadY + roadH + pole_offset * scaleY);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
          Plan View
        </h3>
        <span className="text-xs text-slate-400">h = {height.toFixed(2)} m &middot; {arrangement}</span>
      </div>
      <div className="p-3 flex justify-center">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {sidewalk_left > 0 && (
            <rect x={roadLeft} y={swlY} width={roadLen} height={swlH}
                  fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1"/>
          )}

          <rect x={roadLeft} y={roadY} width={roadLen} height={roadH}
                fill="#64748b" stroke="#475569" strokeWidth="0.8" rx="1"/>

          {Array.from({ length: lanes - 1 }).map((_, i) => {
            const y = roadY + ((i + 1) / lanes) * roadH;
            return (
              <line key={`lane-${i}`}
                x1={roadLeft + 4} y1={y}
                x2={roadLeft + roadLen - 4} y2={y}
                stroke="white" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.6"/>
            );
          })}

          {sidewalk_right > 0 && (
            <rect x={roadLeft} y={swrY} width={roadLen} height={swrH}
                  fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1"/>
          )}

          <line x1={roadLeft} y1={roadY} x2={roadLeft + roadLen} y2={roadY}
                stroke="white" strokeWidth="1.5" opacity="0.8"/>
          <line x1={roadLeft} y1={roadY + roadH} x2={roadLeft + roadLen} y2={roadY + roadH}
                stroke="white" strokeWidth="1.5" opacity="0.8"/>

          {Array.from({ length: nSpans + 1 }).map((_, i) => {
            const x = roadLeft + i * spanPx;
            const offset = Math.max(3, roadH * 0.12);

            if (arrangement === 'Central Doble') {
              return (
                <g key={`twin-${i}`}>
                  <circle cx={x} cy={centerY - offset} r="4" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5"/>
                  <line x1={x - 4} y1={centerY - offset} x2={x + 4} y2={centerY - offset} stroke="#1d4ed8" strokeWidth="1.5"/>
                  <circle cx={x} cy={centerY + offset} r="4" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5"/>
                  <line x1={x - 4} y1={centerY + offset} x2={x + 4} y2={centerY + offset} stroke="#1d4ed8" strokeWidth="1.5"/>
                  <circle cx={x} cy={centerY} r="1.5" fill="#64748b"/>
                </g>
              );
            }

            if (arrangement === 'Bilateral') {
              const firstSide = pole_side === 'right' ? 'bottom' : 'top';
              const secondSide = pole_side === 'right' ? 'top' : 'bottom';
              const cy = i % 2 === 0 ? lumY(firstSide) : lumY(secondSide);
              return (
                <g key={`lum-${i}`}>
                  <circle cx={x} cy={cy} r="5" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5"/>
                  <line x1={x} y1={cy - 5} x2={x} y2={cy + 5} stroke="#1d4ed8" strokeWidth="1.5"/>
                  <line x1={x - 5} y1={cy} x2={x + 5} y2={cy} stroke="#1d4ed8" strokeWidth="1.5"/>
                </g>
              );
            }

            if (arrangement === 'En Isleta') {
              return (
                <g key={`lum-${i}`}>
                  <circle cx={x} cy={centerY} r="5" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5"/>
                  <line x1={x} y1={centerY - 5} x2={x} y2={centerY + 5} stroke="#1d4ed8" strokeWidth="1.5"/>
                  <line x1={x - 5} y1={centerY} x2={x + 5} y2={centerY} stroke="#1d4ed8" strokeWidth="1.5"/>
                </g>
              );
            }

            const cy = lumY(pole_side === 'right' ? 'bottom' : 'top');
            return (
              <g key={`lum-${i}`}>
                <circle cx={x} cy={cy} r="5" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5"/>
                <line x1={x} y1={cy - 5} x2={x} y2={cy + 5} stroke="#1d4ed8" strokeWidth="1.5"/>
                <line x1={x - 5} y1={cy} x2={x + 5} y2={cy} stroke="#1d4ed8" strokeWidth="1.5"/>
              </g>
            );
          })}

          <line x1={roadLeft} y1={swrY + swrH + 12}
                x2={roadLeft + spanPx} y2={swrY + swrH + 12}
                stroke="#64748b" strokeWidth="1"/>
          <polygon points={`${roadLeft},${swrY + swrH + 12} ${roadLeft + 5},${swrY + swrH + 8} ${roadLeft + 5},${swrY + swrH + 16}`} fill="#64748b"/>
          <polygon points={`${roadLeft + spanPx},${swrY + swrH + 12} ${roadLeft + spanPx - 5},${swrY + swrH + 8} ${roadLeft + spanPx - 5},${swrY + swrH + 16}`} fill="#64748b"/>
          <text x={roadLeft + spanPx / 2} y={swrY + swrH + 28}
                textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600">
            S = {spacing.toFixed(0)} m
          </text>

          {/* W dimension: vertical line at right side, text with white background */}
          <line x1={roadLeft + roadLen + 10} y1={swlY}
                x2={roadLeft + roadLen + 10} y2={swrY + swrH}
                stroke="#64748b" strokeWidth="1"/>
          <polygon points={`${roadLeft + roadLen + 10},${swlY} ${roadLeft + roadLen + 6},${swlY + 5} ${roadLeft + roadLen + 14},${swlY + 5}`} fill="#64748b"/>
          <polygon points={`${roadLeft + roadLen + 10},${swrY + swrH} ${roadLeft + roadLen + 6},${swrY + swrH - 5} ${roadLeft + roadLen + 14},${swrY + swrH - 5}`} fill="#64748b"/>
          <rect x={roadLeft + roadLen - 90} y={(swlY + swrY + swrH) / 2 - 8} width="82" height="18" rx="3" fill="white" opacity="0.85"/>
          <text x={roadLeft + roadLen - 10} y={(swlY + swrY + swrH) / 2 + 5}
                textAnchor="end" fontSize="12" fill="#1e293b" fontWeight="600">
            {Wtext}
          </text>

          <g transform={`translate(${roadLeft + roadLen - 22}, ${swlY + 5})`}>
            <polygon points="0,0 14,6 0,12" fill="#94a3b8" opacity="0.5"/>
            <text x="18" y="9" fontSize="9" fill="#94a3b8">flow</text>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default RoadPlanView;
