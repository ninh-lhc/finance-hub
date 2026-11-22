import { useState } from 'react';
import {
  Baby, Banknote, Briefcase, Car, Gift, GraduationCap, Heart, Home,
  MoreHorizontal, PiggyBank, Receipt, ShoppingBag, Utensils, Wallet, Zap,
} from 'lucide-react';
import utils from '../../utils/format.js';
import { CHART_COLORS } from '../../constants/theme.js';
import SalaryNotes from '../dashboard/SalaryNotes.jsx';
import FlowDetails from './FlowDetails.jsx';
import { buildPeriodReport } from '../../logic/periodReport.js';

const INCOME_COLOR = '#16A34A';
const EXPENSE_COLOR = '#DC2626';
const SURPLUS_COLOR = '#2563EB';

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
  const rounded = Math.abs(millions - Math.round(millions)) < 0.05
    ? Math.round(millions)
    : Math.round(millions * 10) / 10;
  return `${String(rounded).replace('.', ',')} tr`;
}

function buildScale(peak) {
  const millions = Math.max(peak, 1_000_000) / 1_000_000;
  const rawStep = millions / 5;
  const power = 10 ** Math.floor(Math.log10(Math.max(rawStep, 0.01)));
  const normalized = rawStep / power;
  const stepTr = Math.max(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power);
  const steps = Math.max(1, Math.ceil((millions * 1.05) / stepTr));
  const max = steps * stepTr * 1_000_000;
  return { max, ticks: Array.from({ length: steps + 1 }, (_, index) => index * stepTr * 1_000_000) };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothLine(points, minY, maxY) {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(index - 1, 0)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(index + 2, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clamp(p1.y + (p2.y - p0.y) / 6, minY, maxY);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clamp(p2.y - (p3.y - p1.y) / 6, minY, maxY);
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
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

function StatCard({ label, value, detail, toneClass }) {
  return (
    <div className={`rounded-2xl shadow-sm p-5 min-w-0 text-white ${toneClass}`}>
      <p className="text-sm text-white">{label}</p>
      <p className="text-2xl font-semibold mt-2 break-words tabular-nums">{value}</p>
      <p className="text-xs text-white mt-2">{detail}</p>
    </div>
  );
}

function ShareRows({ rows }) {
  const scale = rows[0]?.amount || 1;
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Chưa có khoản nào trong kỳ này.</p>;
  }
  return (
    <div className="space-y-4">
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
  );
}

function ShareList({ title, rows }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 min-w-0 h-full">
      <h3 className="text-base font-semibold text-slate-800 mb-5">{title}</h3>
      <ShareRows rows={rows} />
    </section>
  );
}

function ChartTooltip({ title, rows, x, y }) {
  const placeLeft = x > 62;
  return (
    <div
      className="absolute z-20 pointer-events-none rounded-lg bg-[#1B2559] text-white shadow-xl px-3 py-2.5 min-w-[190px] max-w-[260px]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: placeLeft ? 'translate(calc(-100% - 14px), -40%)' : 'translate(14px, -40%)',
      }}
    >
      <p className="text-xs font-semibold mb-1.5">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <p key={row.label} className="flex items-center gap-2 text-[11px] leading-4">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: row.color }} />
            <span className="text-white/90">{row.label}: {utils.formatVND(row.amount)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function MonthlyChart({ monthly }) {
  const [active, setActive] = useState(null);
  const scale = buildScale(Math.max(...monthly.map((month) => Math.max(month.income, month.expense)), 0));
  const width = 760;
  const height = 340;
  const pad = { left: 52, right: 16, top: 18, bottom: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const slot = innerWidth / Math.max(monthly.length, 1);
  const barWidth = Math.min(22, slot * 0.32);
  const base = pad.top + innerHeight;
  const activeMonth = active == null ? null : monthly[active];
  const activeCenter = active == null ? 0 : pad.left + slot * active + slot / 2;
  const activeTop = activeMonth
    ? base - (Math.max(activeMonth.income, activeMonth.expense) / scale.max) * innerHeight
    : base;

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Thu chi theo tháng">
        <defs>
          <linearGradient id="income-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor={INCOME_COLOR} />
          </linearGradient>
          <linearGradient id="expense-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor={EXPENSE_COLOR} />
          </linearGradient>
        </defs>
        {scale.ticks.map((tick) => {
          const y = base - (tick / scale.max) * innerHeight;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E8EDF5" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="12">{formatAxis(tick)}</text>
            </g>
          );
        })}
        {monthly.map((month, index) => {
          const center = pad.left + slot * index + slot / 2;
          const incomeHeight = (month.income / scale.max) * innerHeight;
          const expenseHeight = (month.expense / scale.max) * innerHeight;
          const hovered = active === index;
          return (
            <g key={month.key}>
              <rect x={center - slot / 2} y={pad.top} width={slot} height={innerHeight} fill={hovered ? 'rgba(67,24,255,0.05)' : 'transparent'} />
              {incomeHeight > 0 && (
                <rect x={center - barWidth - 3} y={base - incomeHeight} width={barWidth} height={incomeHeight} rx="5" fill="url(#income-bar)" />
              )}
              {expenseHeight > 0 && (
                <rect x={center + 3} y={base - expenseHeight} width={barWidth} height={expenseHeight} rx="5" fill="url(#expense-bar)" />
              )}
              <text x={center} y={height - 12} textAnchor="middle" fill={hovered ? '#1B2559' : '#64748B'} fontSize="12" fontWeight={hovered ? 700 : 500}>{month.label}</text>
              <rect x={center - slot / 2} y={pad.top} width={slot} height={innerHeight + 28} fill="transparent" onMouseEnter={() => setActive(index)} />
            </g>
          );
        })}
      </svg>
      {activeMonth && (
        <ChartTooltip
          title={activeMonth.label}
          x={(activeCenter / width) * 100}
          y={clamp((activeTop / height) * 100, 12, 70)}
          rows={[
            { label: 'Thu', amount: activeMonth.income, color: INCOME_COLOR },
            { label: 'Chi', amount: activeMonth.expense, color: EXPENSE_COLOR },
            { label: 'Chênh lệch', amount: activeMonth.surplus, color: SURPLUS_COLOR },
          ]}
        />
      )}
    </div>
  );
}

function TrendChart({ trends, months }) {
  const [active, setActive] = useState(null);
  if (trends.length === 0) {
    return <p className="text-sm text-slate-400">Chưa có khoản chi để vẽ xu hướng.</p>;
  }
  const scale = buildScale(Math.max(...trends.flatMap((trend) => trend.points), 0));
  const width = 760;
  const height = 340;
  const pad = { left: 52, right: 18, top: 18, bottom: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const base = pad.top + innerHeight;
  const xAt = (index) => pad.left + (months.length <= 1 ? innerWidth / 2 : (index / (months.length - 1)) * innerWidth);
  const yAt = (value) => base - (value / scale.max) * innerHeight;
  const slot = months.length <= 1 ? innerWidth : innerWidth / (months.length - 1);
  const activeMonth = active == null ? null : months[active];
  const activeValues = active == null ? [] : trends.map((trend) => trend.points[active] || 0);
  const guideY = activeValues.length ? yAt(Math.max(...activeValues)) : base;

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Xu hướng chi theo danh mục">
        {scale.ticks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E8EDF5" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="12">{formatAxis(tick)}</text>
            </g>
          );
        })}
        {trends.map((trend, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          const points = trend.points.map((value, pointIndex) => ({ x: xAt(pointIndex), y: yAt(value) }));
          const line = smoothLine(points, pad.top, base);
          const last = points[points.length - 1];
          const area = `${line} L ${last.x} ${base} L ${points[0].x} ${base} Z`;
          return (
            <g key={trend.name}>
              <path d={area} fill={color} fillOpacity="0.08" />
              <path d={line} fill="none" stroke={color} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {active != null && (
          <line x1={xAt(active)} x2={xAt(active)} y1={pad.top} y2={base} stroke="#94A3B8" strokeDasharray="4 4" />
        )}
        {trends.map((trend, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          return trend.points.map((value, pointIndex) => {
            const hovered = active === pointIndex;
            return (
              <circle
                key={`${trend.name}-${pointIndex}`}
                cx={xAt(pointIndex)}
                cy={yAt(value)}
                r={hovered ? 5.5 : 4}
                fill={hovered ? color : '#fff'}
                stroke={color}
                strokeWidth="2.5"
              />
            );
          });
        })}
        {months.map((month, index) => (
          <text key={month.key} x={xAt(index)} y={height - 12} textAnchor="middle" fill={active === index ? '#1B2559' : '#64748B'} fontSize="12" fontWeight={active === index ? 700 : 500}>{month.label}</text>
        ))}
        {months.map((month, index) => (
          <rect
            key={`${month.key}-hit`}
            x={xAt(index) - slot / 2}
            y={pad.top}
            width={slot}
            height={innerHeight + 28}
            fill="transparent"
            onMouseEnter={() => setActive(index)}
          />
        ))}
      </svg>
      {activeMonth && (
        <ChartTooltip
          title={activeMonth.label}
          x={(xAt(active) / width) * 100}
          y={clamp((guideY / height) * 100, 14, 68)}
          rows={trends.map((trend, index) => ({
            label: trend.name,
            amount: trend.points[active] || 0,
            color: CHART_COLORS[index % CHART_COLORS.length],
          }))}
        />
      )}
    </div>
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
  afterStats = null,
  goals = [],
  fundRepayments = [],
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
    goals,
    repayments: fundRepayments,
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
            <StatCard label="Tổng thu" value={utils.formatVND(period.income)} detail={`${period.count} giao dịch`} toneClass="tone-income" />
            <StatCard label="Tổng chi" value={utils.formatVND(period.expense)} detail={`Trung bình ${utils.formatVND(period.averagePerDay)} / ngày`} toneClass="tone-expense" />
            <StatCard label="Chênh lệch" value={utils.formatVND(period.surplus)} detail={`Tỷ lệ tiết kiệm ${(period.savingsRate * 100).toFixed(1)}%`} toneClass="tone-surplus" />
            <StatCard label="Chi trung bình / tháng" value={utils.formatVND(period.averageMonthlyExpense)} detail={`${utils.formatDisplayDate(period.from)} – ${utils.formatDisplayDate(period.to)} (${period.dayCount} ngày)`} toneClass="tone-average" />
          </div>
          <SalaryNotes picture={period.picture} />
          <FlowDetails picture={period.picture} flow={period.flow} onOpen={handleEditTransaction} />

          {afterStats}

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <ShareList title="Chi theo danh mục" rows={period.expenseCategories} />
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 min-w-0 h-full flex flex-col">
              <h3 className="text-base font-semibold text-slate-800 mb-5">Thu theo danh mục</h3>
              <ShareRows rows={period.incomeCategories} />
              <div className="my-6 border-t border-slate-100" />
              <h3 className="text-base font-semibold text-slate-800 mb-5">Chi theo ví</h3>
              <ShareRows rows={period.walletExpenses} />
            </section>
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
                      <span className="expense-ink text-sm font-semibold tabular-nums shrink-0" style={{ color: EXPENSE_COLOR }}>-{utils.formatVND(item.amount)}</span>
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
