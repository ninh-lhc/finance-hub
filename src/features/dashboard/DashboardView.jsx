import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, Calendar, Eye, Wallet, ArrowUpRight, ArrowDownLeft, Landmark, BarChart3, Zap,
  PiggyBank, Target, ChevronLeft, PieChart, List, ArrowRightLeft,
} from 'lucide-react';
import utils from '../../utils/format.js';
import { THEME } from '../../constants/theme.js';
import DonutChart from '../../components/common/DonutChart.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';

const INCOME_COLOR = '#16A34A';
const EXPENSE_COLOR = '#DC2626';

function compactVnd(amount) {
  const value = Number(amount) || 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) return `${sign}${Math.round(abs)}`;
  if (abs >= 1000000) {
    const millions = abs / 1000000;
    const digits = millions >= 10 ? 0 : 1;
    return `${sign}${millions.toFixed(digits).replace('.0', '').replace('.', ',')}tr`;
  }
  return `${sign}${Math.round(abs / 1000)}k`;
}

function shownMoney(show, amount, compact = false) {
  if (!show) return '••••';
  return compact ? compactVnd(amount) : utils.formatVND(amount);
}

function deltaPhrase(delta, compact = false) {
  if (!delta || delta.percent == null) {
    if (compact) return delta?.amount > 0 ? 'Mới' : '—';
    return delta?.amount > 0 ? 'Mới so với tháng trước' : 'Chưa có tháng trước';
  }
  const rounded = Math.round(delta.percent);
  const sign = rounded > 0 ? '+' : '';
  return compact ? `${sign}${rounded}%` : `${sign}${rounded}% so với tháng trước`;
}

function formatAxis(amount) {
  if (amount <= 0) return '0';
  const millions = amount / 1_000_000;
  const rounded = Math.abs(millions - Math.round(millions)) < 0.05
    ? Math.round(millions)
    : Math.round(millions * 10) / 10;
  return `${String(rounded).replace('.', ',')} tr`;
}

function chartScale(peak) {
  const millions = Math.max(peak, 1_000_000) / 1_000_000;
  const raw = millions / 4;
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const normalized = raw / power;
  const stepTr = Math.max(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power);
  const steps = Math.max(1, Math.ceil((millions * 1.05) / stepTr));
  return {
    max: steps * stepTr * 1_000_000,
    ticks: Array.from({ length: steps + 1 }, (_, index) => index * stepTr * 1_000_000),
  };
}

function weekCompareText(current, previous) {
  if (previous == null) return '';
  if (previous <= 0) return current > 0 ? 'Mới so với 7 ngày trước' : '';
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return 'Bằng 7 ngày trước';
  return percent > 0 ? `Cao hơn 7 ngày trước ${percent}%` : `Thấp hơn 7 ngày trước ${Math.abs(percent)}%`;
}

function topExpenseSlices(chart) {
  const rows = chart || [];
  if (rows.length <= 5) return rows;
  const head = rows.slice(0, 4);
  const rest = rows.slice(4).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return [...head, { name: 'Khác', value: rest, color: '#CBD5E1' }];
}

function DashboardChartEmpty({ label = 'Chưa có' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F4F7FE] flex items-center justify-center text-[#A3AED0] mb-3">
        <PieChart size={28} strokeWidth={1.5} />
      </div>
      <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">{label}</p>
      <p className="text-sm font-black text-gray-300 mt-1 tabular-nums">0 ₫</p>
    </div>
  );
}

function DashboardSetupButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full sm:w-auto max-w-full px-5 py-3 sm:py-2.5 rounded-xl bg-[#4318FF] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:brightness-110 active:scale-[0.98] transition-all"
    >
      {children}
    </button>
  );
}

function ColorStat({ tone, label, shortLabel, amount, compact, detail, shortDetail, icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`relative overflow-hidden rounded-2xl p-3 sm:p-4 min-h-[112px] text-left text-white min-w-0 shadow-sm ${tone}`}>
      <span className="absolute -right-4 -top-6 h-20 w-20 rounded-full bg-white/15" />
      <span className="relative flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold leading-5 text-white/90">
          <span className="lg:hidden">{shortLabel}</span>
          <span className="hidden lg:inline">{label}</span>
        </span>
        {icon}
      </span>
      <span className="relative mt-2 block font-black tracking-tight text-lg sm:text-2xl break-words">
        <span className="lg:hidden">{compact}</span>
        <span className="hidden lg:inline">{amount}</span>
      </span>
      <span className="relative mt-2 block text-[13px] leading-5 text-white/90">
        <span className="lg:hidden">{shortDetail}</span>
        <span className="hidden lg:inline">{detail}</span>
      </span>
    </button>
  );
}

function SixMonthChart({ months, ready }) {
  const [active, setActive] = useState(null);
  const frameRef = useRef(null);
  const [frame, setFrame] = useState({ width: 640, plot: 240 });
  const peak = Math.max(...months.map((month) => Math.max(month.income, month.expense)), 0);
  const scale = chartScale(peak);
  const width = 640;
  const pad = { left: 52, right: 18, top: 12, bottom: 28 };
  const legendSpace = 36;
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const update = () => {
      const widthPx = Math.max(1, Math.round(node.clientWidth));
      const plot = Math.max(160, Math.round(node.clientHeight - legendSpace));
      setFrame((current) => (current.width === widthPx && current.plot === plot ? current : { width: widthPx, plot }));
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    const timer = window.setInterval(update, 400);
    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [ready]);
  const height = Math.max(220, Math.round((width * frame.plot) / frame.width));
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const slot = innerWidth / Math.max(months.length, 1);
  const barWidth = slot * 0.3;
  const base = pad.top + innerHeight;
  const activeMonth = active == null ? null : months[active];
  const tipX = active == null ? 0 : ((pad.left + slot * active + slot / 2) / width) * 100;

  return (
    <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0 h-full flex flex-col">
      <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest shrink-0">Thu chi 6 tháng gần nhất</h4>
      {!ready ? (
        <p className="text-sm text-gray-400 py-12 text-center">Đang tổng hợp các tháng...</p>
      ) : (
        <div ref={frameRef} className="relative mt-4 flex-1 min-h-[220px]" onPointerLeave={(event) => { if (event.pointerType !== 'touch') setActive(null); }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-x-0 top-0 w-full" style={{ height: `calc(100% - ${legendSpace}px)` }} role="img" aria-label="Thu chi 6 tháng gần nhất">
            {scale.ticks.map((tick) => {
              const y = base - (tick / scale.max) * innerHeight;
              return (
                <g key={tick}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E8EDF5" />
                  <text x={pad.left - 6} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="11">{formatAxis(tick)}</text>
                </g>
              );
            })}
            {months.map((month, index) => {
              const center = pad.left + slot * index + slot / 2;
              const incomeHeight = (month.income / scale.max) * innerHeight;
              const expenseHeight = (month.expense / scale.max) * innerHeight;
              const hovered = active === index;
              return (
                <g key={month.month}>
                  <rect x={center - slot / 2} y={pad.top} width={slot} height={innerHeight} fill={hovered ? 'rgba(67,24,255,0.05)' : 'transparent'} />
                  {incomeHeight > 0 && <rect x={center - barWidth - 3} y={base - incomeHeight} width={barWidth} height={incomeHeight} rx="6" fill={INCOME_COLOR} />}
                  {expenseHeight > 0 && <rect x={center + 3} y={base - expenseHeight} width={barWidth} height={expenseHeight} rx="6" fill={EXPENSE_COLOR} />}
                  <text x={center} y={height - 8} textAnchor="middle" fill={hovered ? '#1B2559' : '#64748B'} fontSize="12" fontWeight={hovered ? 700 : 500}>{month.label}</text>
                  <rect
                    x={center - slot / 2}
                    y={pad.top}
                    width={slot}
                    height={innerHeight + 24}
                    fill="transparent"
                    onPointerEnter={(event) => { if (event.pointerType !== 'touch') setActive(index); }}
                    onPointerDown={(event) => { if (event.pointerType === 'touch') setActive((current) => (current === index ? null : index)); }}
                  />
                </g>
              );
            })}
          </svg>
          {activeMonth && (
            <div
              className="absolute z-20 pointer-events-none rounded-lg bg-white border border-slate-200 shadow-lg px-3 py-2 min-w-[140px]"
              style={{ left: `${tipX}%`, top: '12%', transform: tipX > 62 ? 'translate(calc(-100% - 8px), 0)' : 'translate(8px, 0)' }}
            >
              <p className="text-xs font-semibold text-slate-800">{activeMonth.label}</p>
              <p className="text-[12px] mt-1" style={{ color: INCOME_COLOR }}>Thu: {utils.formatVND(activeMonth.income)}</p>
              <p className="text-[12px]" style={{ color: EXPENSE_COLOR }}>Chi: {utils.formatVND(activeMonth.expense)}</p>
            </div>
          )}
          <div data-legend className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 text-[13px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_COLOR }} />Thu</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} />Chi</span>
          </div>
        </div>
      )}
    </div>
  );
}

function dayCategory(items) {
  const totals = {};
  (items || []).forEach((item) => {
    const name = item.category || 'Khác';
    totals[name] = (totals[name] || 0) + Number(item.amount || 0);
  });
  const top = Object.entries(totals).sort((left, right) => right[1] - left[1])[0];
  return top ? top[0] : '';
}

function sortByAmount(items) {
  return [...(items || [])].sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0));
}

function WeekPanel({ logic, selectedMonth, activeDay, setActiveDay, onEdit }) {
  const [openListKey, setOpenListKey] = useState(null);
  const days = logic.weeklyExpenses || [];
  const insight = logic.weekInsight || { previousTotal: null, topCategories: [], peakLabel: '', peakTotal: 0 };
  const currentTotal = days.reduce((sum, day) => sum + day.total, 0);
  const selectedIndex = Math.min(activeDay ?? Math.max(days.length - 1, 0), Math.max(days.length - 1, 0));
  const selected = days[selectedIndex];
  const selectedItems = sortByAmount(selected?.items);
  const selectedIncomes = sortByAmount(selected?.incomes);
  const dayRows = [...selectedItems, ...selectedIncomes];
  const listKey = `${selectedMonth}:${selected?.dateStr || selected?.label || ''}`;
  const listOpen = openListKey === listKey;
  const visibleRows = listOpen ? dayRows : dayRows.slice(0, 3);
  const compare = weekCompareText(currentTotal, insight.previousTotal);
  const summary = [
    insight.peakTotal > 0 ? `Cao nhất ${insight.peakLabel} · ${compactVnd(insight.peakTotal)}` : '',
    compare,
  ].filter(Boolean).join(' · ');

  return (
    <div className="min-w-0 h-full bg-[#111C44] rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 text-white shadow-[0_20px_50px_-12px_rgba(17,28,68,0.2)]">
      <div className="bg-[#1C244B] p-4 sm:p-5 rounded-[24px] border border-white/5 relative overflow-hidden">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4 relative z-10">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
            <BarChart3 size={14} className="text-[#EE5D50] shrink-0" />
            <span className="leading-snug">{logic.isCurrentMonthView ? 'Chi tiêu 7 ngày qua (Thực tế)' : `Chi tiêu các tuần T${selectedMonth + 1} (Lịch sử)`}</span>
          </h4>
          <div className="flex items-center gap-2 bg-[#EE5D50]/10 px-3 py-1.5 rounded-full border border-[#EE5D50]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EE5D50]" />
            <span className="text-[10px] font-black text-[#EE5D50]">{utils.formatVND(currentTotal)}</span>
          </div>
        </div>
        {summary && <p className="text-[11px] text-gray-300 mb-3 relative z-10">{summary}</p>}
        <div className="relative flex items-end justify-between h-[132px] gap-2 sm:gap-4 z-10 px-1">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="w-full border-t border-dashed border-gray-500" />
            <div className="w-full border-t border-dashed border-gray-500" />
            <div className="w-full border-t border-dashed border-gray-500" />
          </div>
          {days.map((item, index) => (
            <button
              key={item.dateStr || item.label}
              type="button"
              onClick={() => setActiveDay(index)}
              className={`flex-1 flex flex-col items-center justify-end h-full relative z-10 bg-transparent border-0 min-w-0 ${index === selectedIndex ? 'opacity-100' : 'opacity-80'}`}
            >
              <span className="text-[8px] font-black text-gray-300 mb-1 tabular-nums">{compactVnd(item.total)}</span>
              <span className={`w-full max-w-[36px] flex-1 bg-[#111C44] rounded-full relative flex justify-end flex-col overflow-hidden shadow-inner border ${index === selectedIndex ? 'border-white/40' : 'border-white/5'}`}>
                <span className="w-full bg-gradient-to-t from-[#EE5D50] to-[#FF938A] rounded-full" style={{ height: `${logic.maxWeeklyExpense > 0 ? (item.total / logic.maxWeeklyExpense) * 100 : 0}%`, minHeight: item.total > 0 ? '8px' : '0' }} />
              </span>
              <span className={`text-[9px] font-bold mt-3 uppercase tracking-tighter ${index === selectedIndex ? 'text-[#05CD99]' : 'text-gray-500'}`}>{item.label}</span>
            </button>
          ))}
        </div>
        {insight.topCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 relative z-10">
            {insight.topCategories.map((category) => (
              <span key={category.name} className="text-[11px] text-white/80 bg-white/10 rounded-full px-2.5 py-1">{category.name} · {compactVnd(category.amount)}</span>
            ))}
          </div>
        )}
        {selected && (
          <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{selected.label}{dayCategory(selectedItems) ? ` · ${dayCategory(selectedItems)}` : ''}</p>
              <p className="text-sm font-semibold text-[#FF938A] tabular-nums">{utils.formatVND(selected.total)}</p>
            </div>
            {dayRows.length === 0 ? (
              <p className="text-xs text-gray-400 mt-2">Không có khoản thu chi.</p>
            ) : (
              <div className="mt-2 divide-y divide-white/10">
                {visibleRows.map((item, index) => {
                  const income = item.type === 'INCOME';
                  const previous = visibleRows[index - 1];
                  const showHeading = selectedIncomes.length > 0 && selectedItems.length > 0 && (!previous || previous.type !== item.type);
                  return (
                    <div key={item.id || `${item.type}-${item.date}-${item.amount}-${item.note}`}>
                      {showHeading && <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{income ? 'Thu' : 'Chi'}</p>}
                      <button type="button" onClick={() => onEdit(item)} className="w-full flex items-center justify-between gap-3 text-left bg-transparent border-0 min-h-11 px-2 -mx-2 rounded-xl hover:bg-white/10">
                        <span className="min-w-0">
                          <span className="block text-sm text-white truncate">{item.note || item.category}</span>
                          <span className="block text-[11px] text-gray-400 truncate">{item.linkedWallet || item.wallet}</span>
                        </span>
                        <span className={`text-sm tabular-nums shrink-0 ${income ? 'text-[#05CD99]' : 'text-[#FF938A]'}`}>{income ? '+' : '-'}{utils.formatVND(item.amount)}</span>
                      </button>
                    </div>
                  );
                })}
                {dayRows.length > 3 && (
                  <button type="button" onClick={() => setOpenListKey(listOpen ? null : listKey)} className="w-full min-h-11 text-left text-[11px] text-gray-300 bg-transparent border-0 hover:text-white">
                    {listOpen ? 'Thu gọn' : `và ${dayRows.length - 3} khoản nữa`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardView(props) {
  const {
    logic,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    showBalance,
    setShowBalance,
    selectedExpenseCategory,
    setSelectedExpenseCategory,
    setExpandedTxId,
    walletView,
    setWalletView,
    selectedWalletDetail,
    setSelectedWalletDetail,
    budgets,
    setActiveTab,
    setActiveSettingTab,
    cancelEdit,
    generateDashboardAdvice,
    monthComparison,
    handleEditTransaction,
    comparisonReady,
  } = props;

  const [activeDay, setActiveDay] = useState(null);
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState(null);
  const openReport = () => setActiveTab('report');
  const openGoalSettings = () => {
    setActiveTab('settings');
    setActiveSettingTab('goal');
    cancelEdit();
  };
  const openBudgetSettings = () => {
    setActiveTab('settings');
    setActiveSettingTab('budget');
    cancelEdit();
  };

  const monthBars = (logic.yearSummary || [])
    .slice(Math.max(0, selectedMonth - 5), selectedMonth + 1)
    .map((month) => ({ ...month, label: `T${month.month + 1}` }));
  const saveRate = logic.income > 0 ? ((logic.income - logic.expense) / logic.income) * 100 : 0;
  const expenseSlices = topExpenseSlices(logic.expenseChart);
  const incomeDetail = monthComparison?.ready ? deltaPhrase(monthComparison.incomeDelta) : 'Đang đối chiếu';
  const expenseDetail = monthComparison?.ready ? deltaPhrase(monthComparison.expenseDelta) : 'Đang đối chiếu';
  const fieldClass = 'bg-transparent text-xs font-black text-[#1B2559] outline-none cursor-pointer uppercase tracking-widest';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F7FE] flex items-center justify-center flex-shrink-0 text-[#4318FF]">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1B2559] uppercase tracking-tighter italic">Báo cáo tổng quan</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Theo dõi nhịp đập tài chính</p>
          </div>
        </div>
        <div className="flex items-center justify-between w-full sm:w-auto gap-4 bg-[#F4F7FE] px-5 py-3 rounded-2xl border border-gray-100 shadow-inner">
          <Calendar size={16} className="text-[#4318FF]" />
          <select className={fieldClass} value={selectedMonth} onChange={(event) => setSelectedMonth(parseInt(event.target.value, 10))} aria-label="Tháng">
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Tháng {index + 1}</option>)}
          </select>
          <div className="w-px h-5 bg-gray-300" />
          <select className="bg-transparent text-sm font-black text-[#4318FF] outline-none cursor-pointer tracking-widest" value={selectedYear} onChange={(event) => setSelectedYear(parseInt(event.target.value, 10))} aria-label="Năm">
            {utils.getRelativeYears(selectedYear).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="col-span-3 lg:col-span-1 relative overflow-hidden rounded-2xl bg-[#2563EB] p-4 min-h-[112px] text-white shadow-sm">
          <span className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-white/15" />
          <div className="relative flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-white/90">Khả dụng chi tiêu</p>
            <button type="button" onClick={() => setShowBalance(!showBalance)} className="min-w-11 min-h-11 -mr-2 inline-flex items-center justify-center text-white/80" aria-label={showBalance ? 'Ẩn số dư' : 'Hiện số dư'}>
              <Eye size={16} />
            </button>
          </div>
          <p className="relative text-2xl sm:text-[28px] font-black tracking-tight break-all leading-tight">{shownMoney(showBalance, logic.spendableBal)}</p>
          <p className="relative text-[13px] text-white/85 mt-2 leading-5">
            Thực tế {shownMoney(showBalance, logic.globalBal)} · Khóa quỹ {shownMoney(showBalance, logic.totalGoalsAmount)}
          </p>
        </div>
        <ColorStat
          tone="bg-[#05CD99]"
          label="Thu tháng này"
          shortLabel="Thu"
          amount={utils.formatVND(logic.income)}
          compact={compactVnd(logic.income)}
          detail={incomeDetail}
          shortDetail={monthComparison?.ready ? deltaPhrase(monthComparison.incomeDelta, true) : '…'}
          icon={<ArrowUpRight size={18} className="text-white/90 shrink-0" />}
          onClick={openReport}
        />
        <ColorStat
          tone="bg-[#EE5D50]"
          label="Chi tháng này"
          shortLabel="Chi"
          amount={utils.formatVND(logic.expense)}
          compact={compactVnd(logic.expense)}
          detail={expenseDetail}
          shortDetail={monthComparison?.ready ? deltaPhrase(monthComparison.expenseDelta, true) : '…'}
          icon={<ArrowDownLeft size={18} className="text-white/90 shrink-0" />}
          onClick={openReport}
        />
        <ColorStat
          tone="bg-[#E3940A]"
          label="Tích lũy"
          shortLabel="Tích lũy"
          amount={utils.formatVND(logic.income - logic.expense)}
          compact={compactVnd(logic.income - logic.expense)}
          detail={`Tỷ lệ tiết kiệm ${saveRate.toFixed(0)}%`}
          shortDetail={`${saveRate.toFixed(0)}%`}
          icon={<Landmark size={18} className="text-white/90 shrink-0" />}
          onClick={openReport}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-w-0 h-full">
          <div className="bg-[#111C44] rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 text-white shadow-xl border border-white/5 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[14px] bg-[#4318FF] flex items-center justify-center shadow-lg"><Zap size={20} fill="white" /></div>
              <h4 className="text-sm font-black uppercase tracking-widest text-white">Cố vấn dòng tiền</h4>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed font-medium italic">&quot;{generateDashboardAdvice()}&quot;</p>
            <div className="grid grid-cols-3 gap-3 mt-auto pt-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Thu</p>
                <p className="text-sm font-black text-[#05CD99] tabular-nums mt-1">{compactVnd(logic.income)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Chi</p>
                <p className="text-sm font-black text-[#FF938A] tabular-nums mt-1">{compactVnd(logic.expense)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tỷ lệ chi</p>
                <p className="text-sm font-black tabular-nums mt-1">{logic.income > 0 ? `${((logic.expense / logic.income) * 100).toFixed(0)}%` : '0%'}</p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar value={logic.expense} max={logic.income || 100} color={logic.income > 0 && logic.expense / logic.income * 100 > 80 ? THEME.error : THEME.success} height="h-2" />
            </div>
          </div>
        </div>

        {logic.priorityGoal ? (
            <div onClick={openGoalSettings} className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 shadow-sm border border-gray-100 w-full h-full flex flex-col justify-between group cursor-pointer hover:shadow-md transition-all min-w-0">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black text-[#05CD99] uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                      <PiggyBank size={14} /> Quỹ ưu tiên
                    </p>
                    <h4 className="text-lg font-black text-[#1B2559] truncate pr-4">{logic.priorityGoal.name}</h4>
                    {logic.priorityGoal.wallet && (
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Trong ví {logic.priorityGoal.wallet}</p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-[#E6FDF9] flex items-center justify-center flex-shrink-0 border border-[#05CD99]/20">
                    <Target size={20} className="text-[#05CD99]" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hiện có</p>
                  <span className="text-3xl font-black text-[#1B2559] leading-none tracking-tighter">{shownMoney(showBalance, logic.priorityGoal.amount)}</span>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Đích: {shownMoney(showBalance, logic.priorityGoal.target)}</span>
                  <span className="text-sm font-black text-[#05CD99]">{utils.calculateProgress(logic.priorityGoal.amount, logic.priorityGoal.target).toFixed(0)}%</span>
                </div>
                <ProgressBar value={logic.priorityGoal.amount} max={logic.priorityGoal.target} color={THEME.success} height="h-2.5" />
              </div>
            </div>
          ) : (
            <div className="bg-[#F8F9FA] rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 border border-dashed border-gray-200 w-full h-full">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#A3AED0] mb-3 border border-gray-100">
                  <Target size={22} strokeWidth={1.75} />
                </div>
                <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Chưa có mục tiêu</p>
                <p className="text-[10px] font-bold text-gray-400 mt-2 max-w-[240px] leading-relaxed">
                  Đặt mục tiêu tích lũy để theo dõi tiến độ ngay trên dashboard.
                </p>
                <DashboardSetupButton onClick={openGoalSettings}>Thiết lập mục tiêu</DashboardSetupButton>
              </div>
            </div>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeekPanel
          logic={logic}
          selectedMonth={selectedMonth}
          activeDay={activeDay}
          setActiveDay={setActiveDay}
          onEdit={handleEditTransaction}
        />
        <SixMonthChart months={monthBars} ready={Boolean(comparisonReady)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col min-w-0 min-h-[320px] h-full">
          <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-4 shrink-0">Phân bổ chi tiêu</h4>
          <div className="flex-1 min-h-[180px] relative">
            {!selectedExpenseCategory ? (
              logic.expense > 0 && expenseSlices.length > 0 ? (
                <DonutChart data={expenseSlices} total={logic.expense} centerLabel="Tổng chi" onItemClick={(name) => { if (name !== 'Khác') setSelectedExpenseCategory(name); }} />
              ) : (
                <DashboardChartEmpty label="Chưa có" />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col">
                <button type="button" onClick={() => { setSelectedExpenseCategory(null); setExpandedTxId(null); }} className="min-h-11 text-[10px] font-black text-[#4318FF] uppercase tracking-widest flex items-center gap-1 mb-4">
                  <ChevronLeft size={14} /> QUAY LẠI ({selectedExpenseCategory})
                </button>
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                  {logic.monthData.filter((item) => item.category === selectedExpenseCategory).map((item) => (
                    <button key={item.id} type="button" onClick={() => handleEditTransaction(item)} className="w-full text-left border border-gray-50 rounded-xl bg-[#F8F9FA] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black text-[#1B2559] uppercase truncate">{item.note || item.category}</p>
                        <span className="text-[11px] font-black text-[#EE5D50] shrink-0">-{utils.formatVND(item.amount)}</span>
                      </div>
                      <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase italic">{utils.formatDisplayDate(item.date)} - {item.linkedWallet || item.wallet}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col min-w-0 h-full">
          <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0">
            <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Cơ cấu ví tiền</h4>
            <button type="button" onClick={() => setWalletView((view) => (view === 'list' ? 'chart' : 'list'))} className="min-w-11 min-h-11 bg-[#F4F7FE] rounded-xl text-[#4318FF] hover:bg-indigo-50 transition-colors inline-flex items-center justify-center" aria-label={walletView === 'list' ? 'Xem biểu đồ ví' : 'Xem danh sách ví'}>
              {walletView === 'list' ? <PieChart size={16} /> : <List size={16} />}
            </button>
          </div>
          <div className="flex-1 min-h-[220px] relative">
            {selectedWalletDetail ? (
              <div className="absolute inset-0 flex flex-col">
                <button type="button" onClick={() => setSelectedWalletDetail(null)} className="min-h-11 text-[10px] font-black text-[#05CD99] uppercase tracking-widest flex items-center gap-1 mb-4 hover:opacity-70">
                  <ChevronLeft size={14} /> QUAY LẠI ({selectedWalletDetail})
                </button>
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                  {logic.monthData.filter((item) => item.wallet === selectedWalletDetail && item.type === 'INCOME').map((item) => (
                    <div key={item.id} className="border border-gray-50 rounded-xl bg-[#F8F9FA] p-3 flex justify-between items-center">
                      <div className="truncate pr-2">
                        <p className="text-[10px] font-black text-[#1B2559] uppercase truncate">{item.note || item.category}</p>
                        <p className="text-[8px] font-bold text-gray-400">{utils.formatDisplayDate(item.date)}</p>
                      </div>
                      <span className="text-[10px] font-black text-[#05CD99]">+{utils.formatVND(item.amount)}</span>
                    </div>
                  ))}
                  {logic.monthData.filter((item) => item.wallet === selectedWalletDetail && item.type === 'INCOME').length === 0 && (
                    <div className="text-center text-[9px] text-gray-400 font-bold mt-10">THÁNG NÀY KHÔNG CÓ THU NHẬP VÀO VÍ NÀY</div>
                  )}
                </div>
              </div>
            ) : walletView === 'chart' ? (
              logic.globalBal > 0 && logic.walletChart?.length > 0 ? (
                <DonutChart data={logic.walletChart} total={logic.globalBal} centerLabel="Tổng tài sản" onItemClick={setSelectedWalletDetail} />
              ) : (
                <DashboardChartEmpty label="Chưa có" />
              )
            ) : (
              <div className="overflow-y-auto max-h-[320px] pr-1 custom-scrollbar space-y-4">
                {(logic.fullWalletList || []).map((wallet) => (
                  <div key={wallet.name} className="flex flex-col gap-2 cursor-pointer group" onClick={() => setSelectedWalletDetail(wallet.name)}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: wallet.color }} />
                        <span className="font-bold text-[#1B2559] truncate">{wallet.name}</span>
                      </div>
                      <span className="font-black text-[#1B2559]">{shownMoney(showBalance, wallet.value)}</span>
                    </div>
                    {wallet.locked > 0 && (
                      <p className="text-[9px] font-bold text-[#FFA800] leading-relaxed">
                        Khóa {wallet.locks.map((lock) => `${lock.name} ${shownMoney(showBalance, lock.amount)}`).join(' · ')}
                        {' · '}còn chi {shownMoney(showBalance, wallet.spendable)}
                      </p>
                    )}
                    <div className="w-full bg-[#F4F7FE] rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${logic.globalBal > 0 ? (Math.max(0, wallet.value) / logic.globalBal) * 100 : 0}%`, backgroundColor: wallet.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col min-w-0 h-full">
          <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0 gap-3">
            <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Giao dịch mới nhất</h4>
            <button type="button" onClick={() => setActiveTab('transactions')} className="min-h-11 text-[9px] font-black text-[#4318FF] uppercase tracking-widest">Xem tất cả</button>
          </div>
          <div className="space-y-3 flex-1 min-h-[160px] lg:min-h-0 overflow-y-auto pr-1 custom-scrollbar">
            {logic.monthData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F4F7FE] flex items-center justify-center text-[#A3AED0] mb-3">
                  <ArrowRightLeft size={22} />
                </div>
                <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Chưa có giao dịch</p>
                <p className="text-sm font-black text-gray-300 mt-1 tabular-nums">0</p>
              </div>
            ) : (
              logic.monthData.slice(0, 4).map((item) => (
                <div key={item.id} onClick={() => handleEditTransaction(item)} className="flex items-center justify-between p-3 border border-gray-50 rounded-2xl bg-[#F8F9FA] hover:bg-white hover:shadow-sm transition-all cursor-pointer min-h-11">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${logic.getCategoryColor(item.category)}15`, color: logic.getCategoryColor(item.category) }}>
                      {item.category.includes('Chuyển khoản') ? <ArrowRightLeft size={16} /> : item.type === 'INCOME' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{item.note || item.category}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{utils.formatDisplayDate(item.date)} - {item.category}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-black whitespace-nowrap ${item.type === 'INCOME' ? 'text-[#05CD99]' : 'text-[#EE5D50]'}`}>{item.type === 'INCOME' ? '+' : '-'}{utils.formatVND(item.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-sm border border-gray-100 min-w-0 h-full flex flex-col">
        {selectedBudgetCategory ? (
          <div className="flex flex-col min-h-0 flex-1">
            <button type="button" onClick={() => setSelectedBudgetCategory(null)} className="min-h-11 text-[10px] font-black text-[#4318FF] uppercase tracking-widest flex items-center gap-1 mb-4 self-start">
              <ChevronLeft size={14} /> Quay lại · {selectedBudgetCategory}
            </button>
            <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {logic.monthData.filter((item) => item.type === 'EXPENSE' && item.category === selectedBudgetCategory).length === 0 ? (
                <p className="text-xs font-bold text-gray-400">Không có khoản chi.</p>
              ) : logic.monthData.filter((item) => item.type === 'EXPENSE' && item.category === selectedBudgetCategory).map((item) => (
                <button key={item.id} type="button" onClick={() => handleEditTransaction(item)} className="w-full text-left border border-gray-50 rounded-xl bg-[#F8F9FA] p-3 min-h-11">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{item.note || item.category}</p>
                    <span className="text-[11px] font-black text-[#EE5D50] shrink-0">-{utils.formatVND(item.amount)}</span>
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">{utils.formatDisplayDate(item.date)} · {item.linkedWallet || item.wallet}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
        <>
        <h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-5 sm:mb-8">Tiến độ Ngân sách T{selectedMonth + 1}</h4>
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {logic.budgetProgress.map((item) => {
            const left = item.amount - item.currentSpent;
            return (
              <button key={item.id} type="button" onClick={() => setSelectedBudgetCategory(item.category)} className="bg-[#F8F9FA] p-4 sm:p-5 rounded-[24px] border border-transparent hover:border-gray-200 transition-all min-w-0 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#1B2559] uppercase flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: logic.getCategoryColor(item.category) }} />
                      <span className="truncate">{item.category}</span>
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">Hạn mức: {utils.formatVND(item.amount)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-base font-black ${item.percent >= 90 ? 'text-[#EE5D50]' : 'text-[#1B2559]'}`}>{utils.formatVND(item.currentSpent)}</span>
                    <p className={`text-[10px] font-black mt-0.5 ${left < 0 ? 'text-[#EE5D50]' : 'text-gray-400'}`}>
                      {left < 0 ? `Vượt ${utils.formatVND(-left)}` : `Còn ${utils.formatVND(left)} · đã dùng ${item.percent.toFixed(0)}%`}
                    </p>
                  </div>
                </div>
                <ProgressBar value={item.currentSpent} max={item.amount} color={item.statusColor} height="h-2.5" />
              </button>
            );
          })}
          {budgets.length === 0 && (
            <div className="col-span-full py-8 sm:py-10 px-4 sm:px-6 flex flex-col items-center justify-center text-center rounded-[24px] border border-dashed border-gray-200 bg-[#F8F9FA]">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#4318FF] mb-3 border border-indigo-50 shadow-sm">
                <Wallet size={22} strokeWidth={1.75} />
              </div>
              <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Chưa có ngân sách</p>
              <p className="text-[10px] font-bold text-gray-400 mt-2 max-w-md leading-relaxed">
                Vào Cài đặt → Ngân sách để thiết lập hạn mức theo từng danh mục chi tiêu.
              </p>
              <DashboardSetupButton onClick={openBudgetSettings}>Thiết lập ngân sách</DashboardSetupButton>
            </div>
          )}
        </div>
        </>
        )}
        </div>
      </div>
    </div>
  );
}
