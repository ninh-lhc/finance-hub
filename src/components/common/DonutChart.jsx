import { PieChart } from 'lucide-react';
import utils from '../../utils/format.js';

const DonutChart = ({ data, total, centerLabel, onItemClick, isDark = false }) => {
  if (!data || data.length === 0 || total === 0) return <div className="flex flex-col items-center justify-center h-full opacity-20 py-6"><PieChart size={32} /><p className="text-[10px] font-bold uppercase mt-2">Dữ liệu trống</p></div>;
  let cumulativePercent = 0;
  const getCoords = (percent) => [Math.cos(2 * Math.PI * percent), Math.sin(2 * Math.PI * percent)];

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full">
      <div className="relative w-36 h-36 flex-shrink-0">
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="transform -rotate-90 w-full h-full drop-shadow-md">
          {data.map((slice, i) => {
            const slicePercent = slice.value / total;
            if (slicePercent <= 0) return null;
            const startP = cumulativePercent; cumulativePercent += slicePercent; const endP = cumulativePercent;
            const [sX, sY] = getCoords(startP); const [eX, eY] = getCoords(endP);
            const largeArc = slicePercent > 0.5 ? 1 : 0;
            return <path
               key={i}
               d={`M ${sX} ${sY} A 1 1 0 ${largeArc} 1 ${eX} ${eY} L 0 0`}
               fill={slice.color}
               stroke={isDark ? '#1C244B' : '#FFFFFF'}
               strokeWidth="0.045"
               strokeLinejoin="round"
               className={`transition-all duration-300 hover:opacity-75 ${onItemClick ? 'cursor-pointer drop-shadow-sm hover:drop-shadow-md' : ''}`}
               onClick={() => onItemClick && onItemClick(slice.name)}
            />;
          })}
          <circle cx="0" cy="0" r="0.75" fill="white" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
          <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-gray-300' : 'text-gray-400'}`}>{centerLabel}</span>
          <span className={`text-[10px] font-black truncate w-full ${isDark ? 'text-white' : 'text-[#1B2559]'}`}>{utils.formatVND(total)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
        {data.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between group ${onItemClick ? `cursor-pointer p-1.5 -m-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-50'}` : ''}`}
            onClick={() => onItemClick && onItemClick(item.name)}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></div>
              <span className={`text-[10px] font-bold truncate capitalize transition-colors ${isDark ? 'text-gray-200 group-hover:text-white' : 'text-[#1B2559] group-hover:text-[#4318FF]'}`}>{item.name}</span>
            </div>
            <span className={`text-[10px] font-black ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>{Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
