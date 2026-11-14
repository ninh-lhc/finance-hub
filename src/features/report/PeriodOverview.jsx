import { useState } from 'react';
import utils from '../../utils/format.js';
import { CHART_COLORS } from '../../constants/theme.js';
import { buildPeriodReport } from '../../logic/periodReport.js';

function formatShare(share) {
  return `${(share * 100).toFixed(1)}%`;
}

function formatAxis(amount) {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `${rounded} tr`;
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} n`;
  return `${Math.round(amount)}`;
}

function lastDay(year, monthIndex) {
  return String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, '0');
}

function ShareList({ title, rows }) {
  return (
    <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
      <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-4">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-[10px] font-bold text-gray-400">Chưa có khoản nào trong kỳ này.</p>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {rows.map((row, index) => {
            const scale = rows[0].amount || 1;
            return (
            <div key={row.name} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{row.name}</p>
                <p className="text-[10px] font-black text-[#1B2559] tabular-nums shrink-0">
                  {utils.formatVND(row.amount)}
                  <span className="text-gray-400 font-bold ml-2">{formatShare(row.share)}</span>
                </p>
              </div>
              <div className="h-2 rounded-full bg-[#F4F7FE] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max((row.amount / scale) * 100, row.amount > 0 ? 2 : 0)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthlyBars({ monthly, max }) {
  return (
    <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Thu chi theo tháng</h4>
        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#05CD99]" /> Thu</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EE5D50]" /> Chi</span>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between h-40 text-[8px] font-black text-gray-300 pb-4 shrink-0">
          <span>{formatAxis(max)}</span>
          <span>{formatAxis(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="flex-1 min-w-0 flex items-end gap-1 h-40">
          {monthly.map((month) => (
            <div key={month.key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end" title={`Thu ${utils.formatVND(month.income)} · Chi ${utils.formatVND(month.expense)}`}>
              <div className="flex items-end justify-center gap-0.5 w-full flex-1">
                <div className="w-1.5 sm:w-2.5 bg-[#05CD99] rounded-t-md" style={{ height: `${month.income > 0 ? Math.max(4, (month.income / max) * 100) : 0}%` }} />
                <div className="w-1.5 sm:w-2.5 bg-[#EE5D50] rounded-t-md" style={{ height: `${month.expense > 0 ? Math.max(4, (month.expense / max) * 100) : 0}%` }} />
              </div>
              <span className="text-[8px] font-black text-gray-400 mt-1">{month.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendChart({ trends, months, max }) {
  if (trends.length === 0) {
    return <p className="text-[10px] font-bold text-gray-400">Chưa có khoản chi để vẽ xu hướng.</p>;
  }
  const width = 640;
  const height = 220;
  const pad = { left: 44, right: 12, top: 16, bottom: 28 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const xAt = (index) => pad.left + (months.length <= 1 ? innerWidth / 2 : (index / (months.length - 1)) * innerWidth);
  const yAt = (value) => pad.top + innerHeight - (value / max) * innerHeight;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.5, 1].map((step) => {
        const y = yAt(max * step);
        return (
          <g key={step}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#F4F7FE" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" className="fill-gray-300" fontSize="9" fontWeight="700">{formatAxis(max * step)}</text>
          </g>
        );
      })}
      {trends.map((trend, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const points = trend.points.map((value, pointIndex) => `${xAt(pointIndex)},${yAt(value)}`).join(' ');
        return (
          <g key={trend.name}>
            <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
            {trend.points.map((value, pointIndex) => (
              <circle key={pointIndex} cx={xAt(pointIndex)} cy={yAt(value)} r="3" fill={color} />
            ))}
          </g>
        );
      })}
      {months.map((month, index) => (
        <text key={month.key} x={xAt(index)} y={height - 8} textAnchor="middle" className="fill-gray-400" fontSize="9" fontWeight="700">{month.label}</text>
      ))}
    </svg>
  );
}

export default function PeriodOverview({
  transactions,
  wallets = [],
  selectedYear,
  selectedMonth,
  ready,
  handleEditTransaction,
}) {
  const [filter, setFilter] = useState({
    preset: 'year',
    from: '',
    to: '',
    wallet: 'ALL',
  });

  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;
  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay(selectedYear, selectedMonth)}`;
  const customFrom = filter.from >= yearStart && filter.from <= yearEnd ? filter.from : yearStart;
  const customTo = filter.to >= yearStart && filter.to <= yearEnd ? filter.to : yearEnd;
  const range = filter.preset === 'month'
    ? { from: monthStart, to: monthEnd }
    : filter.preset === 'custom'
      ? { from: customFrom <= customTo ? customFrom : customTo, to: customFrom <= customTo ? customTo : customFrom }
      : { from: yearStart, to: yearEnd };

  const seenWallets = (transactions || []).map((transaction) => transaction.linkedWallet || transaction.wallet).filter(Boolean);
  const walletOptions = [...new Set([...(wallets || []), ...seenWallets])];
  const period = buildPeriodReport({
    transactions,
    from: range.from,
    to: range.to,
    wallet: filter.wallet,
  });

  const choosePreset = (preset) => {
    setFilter((current) => ({
      ...current,
      preset,
      from: preset === 'custom' ? range.from : current.from,
      to: preset === 'custom' ? range.to : current.to,
    }));
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[24px] p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => choosePreset('year')} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter.preset === 'year' ? 'bg-[#4318FF] text-white' : 'bg-[#F4F7FE] text-[#A3AED0]'}`}>Cả năm</button>
          <button type="button" onClick={() => choosePreset('month')} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter.preset === 'month' ? 'bg-[#4318FF] text-white' : 'bg-[#F4F7FE] text-[#A3AED0]'}`}>Tháng {selectedMonth + 1}</button>
        </div>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
          Từ ngày
          <input type="date" min={yearStart} max={yearEnd} value={filter.preset === 'custom' ? range.from : range.from} onChange={(event) => setFilter((current) => ({ ...current, preset: 'custom', from: event.target.value, to: current.to || range.to }))} className="bg-[#F4F7FE] rounded-xl px-3 py-2 text-xs font-black text-[#1B2559] outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
          Đến ngày
          <input type="date" min={yearStart} max={yearEnd} value={range.to} onChange={(event) => setFilter((current) => ({ ...current, preset: 'custom', from: current.from || range.from, to: event.target.value }))} className="bg-[#F4F7FE] rounded-xl px-3 py-2 text-xs font-black text-[#1B2559] outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-widest text-gray-400 min-w-[10rem]">
          Ví
          <select value={filter.wallet} onChange={(event) => setFilter((current) => ({ ...current, wallet: event.target.value }))} className="bg-[#F4F7FE] rounded-xl px-3 py-2 text-xs font-black text-[#1B2559] outline-none">
            <option value="ALL">Tất cả ví</option>
            {walletOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      {!ready ? (
        <div className="bg-white rounded-[24px] py-16 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Đang tổng hợp kỳ này...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng thu</p>
              <p className="text-xl sm:text-2xl font-black text-[#05CD99] mt-2 break-words">{utils.formatVND(period.income)}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-2">{period.count} giao dịch</p>
            </div>
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng chi</p>
              <p className="text-xl sm:text-2xl font-black text-[#EE5D50] mt-2 break-words">{utils.formatVND(period.expense)}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-2">Trung bình {utils.formatVND(period.averagePerDay)} / ngày</p>
            </div>
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chênh lệch</p>
              <p className="text-xl sm:text-2xl font-black text-[#4318FF] mt-2 break-words">{utils.formatVND(period.surplus)}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-2">Tỷ lệ tiết kiệm {(period.savingsRate * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chi trung bình / tháng</p>
              <p className="text-xl sm:text-2xl font-black text-[#1B2559] mt-2 break-words">{utils.formatVND(period.averageMonthlyExpense)}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-2">{utils.formatDisplayDate(period.from)} – {utils.formatDisplayDate(period.to)} ({period.dayCount} ngày)</p>
            </div>
          </div>

          <MonthlyBars monthly={period.monthly} max={period.maxMonthly} />

          <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
            <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-2">Xu hướng chi các danh mục lớn</h4>
            <TrendChart trends={period.trends} months={period.monthly} max={period.maxTrend} />
            {period.trends.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {period.trends.map((trend, index) => (
                  <span key={trend.name} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#1B2559]">
                    <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    {trend.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ShareList title="Chi theo danh mục" rows={period.expenseCategories} />
            <ShareList title="Thu theo danh mục" rows={period.incomeCategories} />
            <ShareList title="Chi theo ví" rows={period.walletExpenses} />
          </div>

          <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
            <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-4">10 khoản chi lớn nhất</h4>
            {period.topExpenses.length === 0 ? (
              <p className="text-[10px] font-bold text-gray-400">Chưa có khoản chi trong kỳ này.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {period.topExpenses.map((item) => (
                  <button key={item.id || `${item.date}-${item.amount}-${item.note}`} type="button" onClick={() => handleEditTransaction(item.transaction)} className="w-full flex items-center justify-between gap-3 py-3 text-left bg-transparent border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#1B2559] uppercase truncate">{item.category}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate">{utils.formatDisplayDate(item.date)} · {item.wallet}{item.note ? ` · ${item.note}` : ''}</p>
                    </div>
                    <span className="text-sm font-black text-[#EE5D50] tabular-nums shrink-0">-{utils.formatVND(item.amount)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
