import { PieChart } from 'lucide-react';
import utils from '../../utils/format.js';

const DonutChart = ({ data, total, centerLabel, onItemClick, isDark = false }) => {
  if (!data || data.length === 0 || total === 0) return <div className="flex flex-col items-center justify-center h-full opacity-20 py-6"><PieChart size={32} /><p className="text-[10px] font-bold uppercase mt-2">Dữ liệu trống</p></div>;
  const getCoords = (percent) => [Math.cos(2 * Math.PI * percent), Math.sin(2 * Math.PI * percent)];

  const arcSlices = data.reduce((acc, slice, i) => {
    const slicePercent = slice.value / total;
    if (slicePercent <= 0) return acc;
    const startP = acc.length > 0 ? acc[acc.length - 1].endP : 0;
    const endP = startP + slicePercent;
    acc.push({ slice, startP, endP, slicePercent, i });
    return acc;
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 h-full">
      <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex-shrink-0">
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="transform -rotate-90 w-full h-full drop-shadow-md">
          {arcSlices.map(({ slice, startP, endP, slicePercent, i }) => {
            const [sX, sY] = getCoords(startP); const [eX, eY] = getCoords(endP);
            const largeArc = slicePercent > 0.5 ? 1 : 0;
            return <path
               key={i}
               d={`M ${sX} ${sY} A 1 1 0 ${largeArc} 1 ${eX} ${eY} L 0 0`}
               fill={slice.color}
               stroke="var(--card)"
               strokeWidth="0.045"
               strokeLinejoin="round"
               className={`transition-all duration-300 hover:opacity-75 ${onItemClick ? 'cursor-pointer drop-shadow-sm hover:drop-shadow-md' : ''}`}
               onClick={() => onItemClick && onItemClick(slice.name)}
            />;
          })}
          <circle cx="0" cy="0" r="0.75" fill="var(--card)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
          <span className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-gray-300' : 'text-gray-400'}`}>{centerLabel}</span>
          <span className={`text-xs font-black truncate w-full px-3 ${isDark ? 'text-white' : 'text-[#1B2559]'}`}>{utils.formatVND(total)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full min-w-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
        {data.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 min-h-9 group ${onItemClick ? `cursor-pointer px-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-50'}` : ''}`}
            onClick={() => onItemClick && onItemClick(item.name)}
          >
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></div>
              <span className={`text-xs font-bold truncate capitalize transition-colors ${isDark ? 'text-gray-200 group-hover:text-white' : 'text-[#1B2559] group-hover:text-[#4318FF]'}`}>{item.name}</span>
            </div>
            <span className={`text-[11px] font-black tabular-nums shrink-0 ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{utils.formatVND(item.value)} · {Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
