import { useState } from 'react';
import {
  Baby, Banknote, Briefcase, Car, Gift, GraduationCap, Heart, Home,
  MoreHorizontal, PiggyBank, Receipt, ShoppingBag, Utensils, Wallet, Zap,
} from 'lucide-react';
import utils from '../../utils/format.js';
import { CHART_COLORS } from '../../constants/theme.js';
import { buildPeriodReport } from '../../logic/periodReport.js';

const INCOME_COLOR = '#16A34A';
const EXPENSE_COLOR = '#DC2626';
const SURPLUS_COLOR = '#2563EB';
const AVERAGE_COLOR = '#7C3AED';

function MarkIcon({ name }) {
  if (/nhà/i.test(name)) return <Home size={18} />;
  if (/mua sắm/i.test(name)) return <ShoppingBag size={18} />;
  if (/ăn/i.test(name)) return <Utensils size={18} />;
  if (/đi lại|xe|grab/i.test(name)) return <Car size={18} />;
  if (/điện|nước/i.test(name)) return <Zap size={18} />;
  if (/hóa đơn|chi hộ/i.test(name)) return <Receipt size={18} />;
  if (/giải trí/i.test(name)) return <Gift size={18} />;
  if (/con/i.test(name)) return <Baby size={18} />;
  if (/lương/i.test(name)) return <Briefcase size={18} />;
  if (/kinh doanh|thu nợ/i.test(name)) return <PiggyBank size={18} />;
  if (/học|giáo dục/i.test(name)) return <GraduationCap size={18} />;
  if (/hiếu|cưới|quà/i.test(name)) return <Heart size={18} />;
  if (/ngân hàng|thẻ/i.test(name)) return <Banknote size={18} />;
  if (/tiền mặt|ví/i.test(name)) return <Wallet size={18} />;
  return <MoreHorizontal size={18} />;
}

function formatShare(share) {
  return `${(share * 100).toFixed(1)}%`;
}

function formatAxis(amount) {
  if (amount <= 0) return '0';
  const millions = amount / 1_000_000;
  const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
  return `${String(rounded).replace('.', ',')} tr`;
}

function chartMax(peak) {
  return niceMax(Math.max(peak, 4_000_000));
}

function niceMax(value) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
}

function lastDay(year, monthIndex) {
  return String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, '0');
}

function Mark({ name, color }) {
  return (
    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}16`, color }}>
      <MarkIcon name={name} />
    </span>
  );
}

function StatCard({ label, value, detail, accent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 min-w-0" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)', border: '1px solid #EEF2F7', borderTop: `3px solid ${accent}` }}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold mt-2 break-words tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-slate-400 mt-2">{detail}</p>
    </div>
  );
}

function ShareList({ title, rows }) {
  const scale = rows[0]?.amount || 1;
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 min-w-0">
      <h3 className="text-base font-semibold text-slate-800 mb-5">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có khoản nào trong kỳ này.</p>
      ) : (
        <div className="space-y-4 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
          {rows.map((row, index) => {
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return (
              <div key={row.name} className="flex gap-3 min-w-0">
                <Mark name={row.name} color={color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800 truncate">{row.name}</p>
                    <p className="text-sm font-semibold text-slate-700 tabular-nums shrink-0">
                      {utils.formatVND(row.amount)}
                      <span className="text-slate-400 font-medium ml-2">{formatShare(row.share)}</span>
                    </p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max((row.amount / scale) * 100, row.amount > 0 ? 2 : 0)}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MonthlyChart({ monthly }) {
  const max = chartMax(Math.max(...monthly.map((month) => Math.max(month.income, month.expense)), 0));
  const width = 760;
  const height = 320;
  const pad = { left: 56, right: 12, top: 12, bottom: 32 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const slot = innerWidth / Math.max(monthly.length, 1);
  const barWidth = Math.min(16, slot * 0.28);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Thu chi theo tháng">
      {ticks.map((tick) => {
        const y = pad.top + innerHeight - tick * innerHeight;
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E8EDF5" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="12">{formatAxis(max * tick)}</text>
          </g>
        );
      })}
      {monthly.map((month, index) => {
        const center = pad.left + slot * index + slot / 2;
        const base = pad.top + innerHeight;
        const incomeHeight = (month.income / max) * innerHeight;
        const expenseHeight = (month.expense / max) * innerHeight;
        return (
          <g key={month.key}>
            <rect x={center - barWidth - 2} y={base - incomeHeight} width={barWidth} height={incomeHeight} rx="3" fill={INCOME_COLOR}>
              <title>{`Thu ${utils.formatVND(month.income)}`}</title>
            </rect>
            <rect x={center + 2} y={base - expenseHeight} width={barWidth} height={expenseHeight} rx="3" fill={EXPENSE_COLOR}>
              <title>{`Chi ${utils.formatVND(month.expense)}`}</title>
            </rect>
            <text x={center} y={height - 10} textAnchor="middle" fill="#64748B" fontSize="11">{month.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TrendChart({ trends, months }) {
  if (trends.length === 0) {
    return <p className="text-sm text-slate-400">Chưa có khoản chi để vẽ xu hướng.</p>;
  }
  const max = chartMax(Math.max(...trends.flatMap((trend) => trend.points), 0));
  const width = 760;
  const height = 300;
  const pad = { left: 56, right: 16, top: 16, bottom: 32 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const xAt = (index) => pad.left + (months.length <= 1 ? innerWidth / 2 : (index / (months.length - 1)) * innerWidth);
  const yAt = (value) => pad.top + innerHeight - (value / max) * innerHeight;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Xu hướng chi theo danh mục">
      {ticks.map((tick) => {
        const y = yAt(max * tick);
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E8EDF5" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="12">{formatAxis(max * tick)}</text>
          </g>
        );
      })}
      {trends.map((trend, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const points = trend.points.map((value, pointIndex) => `${xAt(pointIndex)},${yAt(value)}`).join(' ');
        return (
          <g key={trend.name}>
            <polyline fill="none" stroke={color} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" points={points} />
            {trend.points.map((value, pointIndex) => (
              <circle key={`${trend.name}-${pointIndex}`} cx={xAt(pointIndex)} cy={yAt(value)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
            ))}
          </g>
        );
      })}
      {months.map((month, index) => (
        <text key={month.key} x={xAt(index)} y={height - 10} textAnchor="middle" fill="#64748B" fontSize="11">{month.label}</text>
      ))}
    </svg>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-2">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
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

  const fieldClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr_1fr] gap-3">
        <label className="text-xs text-slate-500 flex flex-col gap-1.5">
          Khoảng thời gian
          <select
            value={filter.preset}
            onChange={(event) => setFilter((current) => ({ ...current, preset: event.target.value, from: range.from, to: range.to }))}
            className={fieldClass}
          >
            <option value="year">Năm nay</option>
            <option value="month">Tháng {selectedMonth + 1}</option>
            <option value="custom">Tùy ngày</option>
          </select>
        </label>
        <label className="text-xs text-slate-500 flex flex-col gap-1.5">
          Từ ngày
          <input type="date" min={yearStart} max={yearEnd} value={range.from} onChange={(event) => setFilter((current) => ({ ...current, preset: 'custom', from: event.target.value, to: current.to || range.to }))} className={fieldClass} />
        </label>
        <label className="text-xs text-slate-500 flex flex-col gap-1.5">
          Đến ngày
          <input type="date" min={yearStart} max={yearEnd} value={range.to} onChange={(event) => setFilter((current) => ({ ...current, preset: 'custom', from: current.from || range.from, to: event.target.value }))} className={fieldClass} />
        </label>
        <label className="text-xs text-slate-500 flex flex-col gap-1.5">
          Ví
          <select value={filter.wallet} onChange={(event) => setFilter((current) => ({ ...current, wallet: event.target.value }))} className={fieldClass}>
            <option value="ALL">Tất cả ví</option>
            {walletOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      {!ready ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-sm text-slate-400">Đang tổng hợp kỳ này...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Tổng thu" value={utils.formatVND(period.income)} detail={`${period.count} giao dịch`} accent={INCOME_COLOR} />
            <StatCard label="Tổng chi" value={utils.formatVND(period.expense)} detail={`Trung bình ${utils.formatVND(period.averagePerDay)} / ngày`} accent={EXPENSE_COLOR} />
            <StatCard label="Chênh lệch" value={utils.formatVND(period.surplus)} detail={`Tỷ lệ tiết kiệm ${(period.savingsRate * 100).toFixed(1)}%`} accent={SURPLUS_COLOR} />
            <StatCard label="Chi trung bình / tháng" value={utils.formatVND(period.averageMonthlyExpense)} detail={`${utils.formatDisplayDate(period.from)} – ${utils.formatDisplayDate(period.to)} (${period.dayCount} ngày)`} accent={AVERAGE_COLOR} />
          </div>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Thu chi theo tháng</h3>
            <MonthlyChart monthly={period.monthly} />
            <Legend items={[{ label: 'Thu', color: INCOME_COLOR }, { label: 'Chi', color: EXPENSE_COLOR }]} />
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Xu hướng chi các danh mục lớn</h3>
            <TrendChart trends={period.trends} months={period.monthly} />
            <Legend items={period.trends.map((trend, index) => ({ label: trend.name, color: CHART_COLORS[index % CHART_COLORS.length] }))} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ShareList title="Chi theo danh mục" rows={period.expenseCategories} />
            <ShareList title="Thu theo danh mục" rows={period.incomeCategories} />
            <ShareList title="Chi theo ví" rows={period.walletExpenses} />
          </div>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">10 khoản chi lớn nhất</h3>
            {period.topExpenses.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có khoản chi trong kỳ này.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {period.topExpenses.map((item, index) => {
                  const color = CHART_COLORS[index % CHART_COLORS.length];
                  return (
                    <button key={item.id || `${item.date}-${item.amount}-${item.note}`} type="button" onClick={() => handleEditTransaction(item.transaction)} className="w-full flex items-center gap-3 py-3 text-left bg-transparent border-0">
                      <Mark name={item.category} color={color} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.category}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{utils.formatDisplayDate(item.date)} · {item.wallet}{item.note ? ` · ${item.note}` : ''}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: EXPENSE_COLOR }}>-{utils.formatVND(item.amount)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
