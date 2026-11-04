import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import utils from '../../utils/format.js';
import { buildAmountDelta } from '../../logic/monthComparison.js';

function formatDeltaText(delta) {
  if (!delta || delta.percent == null) {
    return delta?.amount > 0 ? 'Mới' : '—';
  }
  const rounded = Math.round(delta.percent);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function deltaClass(delta, invert) {
  if (!delta || delta.direction === 'flat' || delta.percent == null) return 'text-gray-400';
  const rose = delta.direction === 'up';
  const positive = invert ? !rose : rose;
  return positive ? 'text-[#05CD99]' : 'text-[#EE5D50]';
}

function DeltaIcon({ delta }) {
  if (!delta || delta.direction === 'flat') return <Minus size={11} strokeWidth={3} />;
  if (delta.direction === 'down') return <ArrowDown size={11} strokeWidth={3} />;
  return <ArrowUp size={11} strokeWidth={3} />;
}

export function DeltaLabel({ delta, invert = false, prefix, onClick }) {
  const className = `inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide ${deltaClass(delta, invert)} ${onClick ? 'cursor-pointer hover:underline bg-transparent border-0 p-0' : ''}`;
  const content = (
    <>
      <DeltaIcon delta={delta} />
      <span>{prefix ? `${prefix} ` : ''}{formatDeltaText(delta)}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <span className={className}>{content}</span>;
}

function CompareBar({ current, previous, max }) {
  const scale = max > 0 ? max : 1;
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-[#F4F7FE] overflow-hidden">
        <div className="h-full rounded-full bg-[#4318FF]" style={{ width: `${Math.min(100, (current / scale) * 100)}%` }} />
      </div>
      <div className="h-1.5 rounded-full bg-[#F4F7FE] overflow-hidden">
        <div className="h-full rounded-full bg-[#A3AED0]" style={{ width: `${Math.min(100, (previous / scale) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function MonthComparisonPanel({
  comparison,
  selectedMonth,
  selectedYear,
  onSelectMonth,
  onSelectCategory,
}) {
  if (!comparison) return null;
  const prevLabel = `T${comparison.previousMonth + 1}${comparison.previousYear !== selectedYear ? `/${comparison.previousYear}` : ''}`;

  return (
    <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
        <div>
          <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Đối chiếu chi tiêu</h4>
          <p className="text-[10px] font-bold text-gray-400 mt-1">
            Tháng {selectedMonth + 1} so với {prevLabel} và trung bình các tháng có chi trong {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4318FF]" /> Tháng này</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#A3AED0]" /> {prevLabel}</span>
        </div>
      </div>

      {!comparison.ready ? (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Đang đối chiếu dữ liệu...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Chi tiêu 12 tháng</p>
            <div className="flex items-end gap-1.5 h-28">
              {comparison.monthlyExpenses.map((total, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectMonth?.(index)}
                  title={`Tháng ${index + 1}: ${utils.formatVND(total)}`}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0 bg-transparent border-0 p-0 cursor-pointer"
                >
                  <div className="w-full max-w-[22px] flex-1 flex items-end">
                    <div
                      className={`w-full rounded-full ${index === selectedMonth ? 'bg-[#4318FF]' : 'bg-[#E0E5F2] hover:bg-[#4318FF]/40'}`}
                      style={{ height: `${Math.max(total > 0 ? 8 : 0, (total / comparison.maxMonthlyExpense) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[8px] font-black mt-1 ${index === selectedMonth ? 'text-[#4318FF]' : 'text-gray-300'}`}>{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Theo danh mục</p>
            {comparison.categories.length === 0 ? (
              <p className="text-[10px] font-bold text-gray-400">Chưa có khoản chi để so sánh.</p>
            ) : comparison.categories.slice(0, 6).map((item) => {
              const max = Math.max(item.current, item.previous, item.yearAverage, 1);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onSelectCategory?.(item.name)}
                  className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center w-full text-left bg-transparent border-0 p-0 cursor-pointer rounded-xl hover:bg-[#F4F7FE]"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{item.name}</p>
                    <p className="text-[9px] font-bold text-gray-400">TB năm {utils.formatVND(item.yearAverage)}</p>
                    <DeltaLabel delta={buildAmountDelta(item.current, item.previous)} invert />
                  </div>
                  <div className="min-w-0">
                    <div className="flex justify-between text-[9px] font-black mb-1">
                      <span className="text-[#4318FF]">{utils.formatVND(item.current)}</span>
                      <span className="text-gray-400">{utils.formatVND(item.previous)}</span>
                    </div>
                    <CompareBar current={item.current} previous={item.previous} max={max} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
