import { useState } from 'react';
import {
  Calendar, Eye, ArrowUpRight, ArrowDownLeft, PiggyBank, Target,
  ChevronLeft, PieChart, List, ArrowRightLeft, Zap,
} from 'lucide-react';
import utils from '../../utils/format.js';
import { THEME } from '../../constants/theme.js';
import DonutChart from '../../components/common/DonutChart.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';

const INCOME_COLOR = '#16A34A';
const EXPENSE_COLOR = '#DC2626';
const SURPLUS_COLOR = '#D97706';

function compactVnd(amount) {
  const value = Number(amount) || 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) return `${sign}${Math.round(abs)}`;
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const digits = millions >= 10 ? 0 : 1;
    return `${sign}${millions.toFixed(digits).replace('.0', '').replace('.', ',')}tr`;
  }
  return `${sign}${Math.round(abs / 1000)}k`;
}

function money(show, amount, compact = false) {
  if (!show) return '••••';
  return compact ? compactVnd(amount) : utils.formatVND(amount);
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

function deltaPhrase(delta, compact = false) {
  if (!delta || delta.percent == null) {
    if (compact) return delta?.amount > 0 ? 'Mới' : '—';
    return delta?.amount > 0 ? 'Mới so với tháng trước' : 'Chưa có tháng trước';
  }
  const rounded = Math.round(delta.percent);
  const sign = rounded > 0 ? '+' : '';
  return compact ? `${sign}${rounded}%` : `${sign}${rounded}% so với tháng trước`;
}

function deltaTone(delta, invert) {
  if (!delta || delta.direction === 'flat' || delta.percent == null) return 'text-slate-400';
  const rose = delta.direction === 'up';
  const positive = invert ? !rose : rose;
  return positive ? 'text-[#16A34A]' : 'text-[#DC2626]';
}

function topExpenseSlices(chart) {
  const rows = chart || [];
  if (rows.length <= 5) return rows;
  const head = rows.slice(0, 4);
  const rest = rows.slice(4).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return [...head, { name: 'Khác', value: rest, color: '#CBD5E1' }];
}

function MetricCard({ label, display, compact, detail, detailCompact, detailClass, accent, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 min-h-[108px] text-left min-w-0"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <p className="text-[13px] text-slate-500 leading-5">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-lg sm:text-xl lg:text-[22px] break-words" style={{ color: accent }}>
        <span className="lg:hidden">{compact}</span>
        <span className="hidden lg:inline">{display}</span>
      </p>
      <p className={`mt-2 text-[13px] leading-5 ${detailClass}`}>
        <span className="lg:hidden">{detailCompact || detail}</span>
        <span className="hidden lg:inline">{detail}</span>
      </p>
    </button>
  );
}

function ChartTip({ title, rows, x }) {
  const placeLeft = x > 62;
  return (
    <div
      className="absolute z-20 pointer-events-none rounded-lg bg-white border border-slate-200 shadow-lg px-3 py-2 min-w-[150px]"
      style={{
        left: `${x}%`,
        top: '18%',
        transform: placeLeft ? 'translate(calc(-100% - 10px), 0)' : 'translate(10px, 0)',
      }}
    >
      <p className="text-xs font-semibold text-slate-800 mb-1">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="text-[12px] leading-5" style={{ color: row.color }}>
          {row.label}: {utils.formatVND(row.amount)}
        </p>
      ))}
    </div>
  );
}

function showMonth(event, index, setActive) {
  if (event.pointerType === 'touch') return;
  setActive(index);
}

function tapMonth(event, index, setActive) {
  if (event.pointerType !== 'touch') return;
  setActive((current) => (current === index ? null : index));
}

function SixMonthChart({ months, ready }) {
  const [active, setActive] = useState(null);
  const peak = Math.max(...months.map((month) => Math.max(month.income, month.expense)), 0);
  const scale = chartScale(peak);
  const width = 640;
  const height = 220;
  const pad = { left: 46, right: 12, top: 12, bottom: 28 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const slot = innerWidth / Math.max(months.length, 1);
  const barWidth = Math.min(18, slot * 0.28);
  const base = pad.top + innerHeight;
  const activeMonth = active == null ? null : months[active];

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
      <h3 className="text-sm font-semibold text-slate-800">Thu chi 6 tháng gần nhất</h3>
      {!ready ? (
        <p className="text-sm text-slate-400 py-10 text-center">Đang tổng hợp các tháng...</p>
      ) : (
        <div className="relative mt-2" onPointerLeave={(event) => { if (event.pointerType !== 'touch') setActive(null); }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Thu chi 6 tháng gần nhất">
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
                  {incomeHeight > 0 && <rect x={center - barWidth - 2} y={base - incomeHeight} width={barWidth} height={incomeHeight} rx="4" fill={INCOME_COLOR} />}
                  {expenseHeight > 0 && <rect x={center + 2} y={base - expenseHeight} width={barWidth} height={expenseHeight} rx="4" fill={EXPENSE_COLOR} />}
                  <text x={center} y={height - 8} textAnchor="middle" fill={hovered ? '#1B2559' : '#64748B'} fontSize="12" fontWeight={hovered ? 700 : 500}>{month.label}</text>
                  <rect
                    x={center - slot / 2}
                    y={pad.top}
                    width={slot}
                    height={innerHeight + 24}
                    fill="transparent"
                    onPointerEnter={(event) => showMonth(event, index, setActive)}
                    onPointerDown={(event) => tapMonth(event, index, setActive)}
                  />
                </g>
              );
            })}
          </svg>
          {activeMonth && (
            <ChartTip
              title={activeMonth.label}
              x={((pad.left + slot * active + slot / 2) / width) * 100}
              rows={[
                { label: 'Thu', amount: activeMonth.income, color: INCOME_COLOR },
                { label: 'Chi', amount: activeMonth.expense, color: EXPENSE_COLOR },
              ]}
            />
          )}
          <div className="flex items-center justify-center gap-4 mt-1 text-[13px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_COLOR }} />Thu</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} />Chi</span>
          </div>
        </div>
      )}
    </section>
  );
}

function WeekChart({ items, max }) {
  const total = items.reduce((sum, item) => sum + item.total, 0);
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Chi tiêu 7 ngày qua</h3>
        <span className="text-sm font-semibold tabular-nums" style={{ color: EXPENSE_COLOR }}>{utils.formatVND(total)}</span>
      </div>
      <div className="flex items-end gap-2 h-28">
        {items.map((item, index) => (
          <div key={item.dateStr || item.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <span className="text-[11px] text-slate-400 tabular-nums mb-1">{compactVnd(item.total)}</span>
            <div className="w-full max-w-8 flex-1 bg-slate-100 rounded-full flex items-end overflow-hidden">
              <div
                className="w-full rounded-full"
                style={{
                  height: `${max > 0 ? (item.total / max) * 100 : 0}%`,
                  minHeight: item.total > 0 ? '6px' : '0',
                  background: index === items.length - 1 ? EXPENSE_COLOR : '#FB7185',
                }}
              />
            </div>
            <span className={`text-[11px] mt-2 truncate max-w-full ${index === items.length - 1 ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
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
  const [adviceOpen, setAdviceOpen] = useState(false);

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
  const advice = generateDashboardAdvice();
  const fieldClass = 'h-11 bg-transparent text-sm text-slate-700 outline-none cursor-pointer';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Tổng quan</h3>
          <p className="text-[13px] text-slate-400">Số dư, tháng này và việc cần xem</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-xl border border-slate-100 w-full sm:w-auto">
          <Calendar size={16} className="text-[#4318FF] shrink-0" />
          <select className={fieldClass} value={selectedMonth} onChange={(event) => setSelectedMonth(parseInt(event.target.value, 10))} aria-label="Tháng">
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Tháng {index + 1}</option>)}
          </select>
          <div className="w-px h-5 bg-slate-200" />
          <select className={`${fieldClass} font-semibold text-[#4318FF]`} value={selectedYear} onChange={(event) => setSelectedYear(parseInt(event.target.value, 10))} aria-label="Năm">
            {utils.getRelativeYears(selectedYear).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="col-span-3 lg:col-span-1 bg-[#111C44] text-white rounded-2xl p-4 min-h-[108px] min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-white/70">Khả dụng chi tiêu</p>
            <button type="button" onClick={() => setShowBalance(!showBalance)} className="min-w-11 min-h-11 -mr-2 inline-flex items-center justify-center text-white/70" aria-label={showBalance ? 'Ẩn số dư' : 'Hiện số dư'}>
              <Eye size={16} />
            </button>
          </div>
          <p className="text-2xl sm:text-[28px] font-semibold tracking-tight break-all leading-tight">{money(showBalance, logic.spendableBal)}</p>
          <p className="text-xs text-white/60 mt-2 leading-5">
            Thực tế {money(showBalance, logic.globalBal)} · Khóa quỹ {money(showBalance, logic.totalGoalsAmount)}
          </p>
        </div>
        <MetricCard
          label="Thu tháng này"
          display={money(true, logic.income)}
          compact={money(true, logic.income, true)}
          detail={monthComparison?.ready ? deltaPhrase(monthComparison.incomeDelta) : 'Đang đối chiếu'}
          detailCompact={monthComparison?.ready ? deltaPhrase(monthComparison.incomeDelta, true) : '…'}
          detailClass={monthComparison?.ready ? deltaTone(monthComparison.incomeDelta) : 'text-slate-400'}
          accent={INCOME_COLOR}
          onOpen={openReport}
        />
        <MetricCard
          label="Chi tháng này"
          display={money(true, logic.expense)}
          compact={money(true, logic.expense, true)}
          detail={monthComparison?.ready ? deltaPhrase(monthComparison.expenseDelta) : 'Đang đối chiếu'}
          detailCompact={monthComparison?.ready ? deltaPhrase(monthComparison.expenseDelta, true) : '…'}
          detailClass={monthComparison?.ready ? deltaTone(monthComparison.expenseDelta, true) : 'text-slate-400'}
          accent={EXPENSE_COLOR}
          onOpen={openReport}
        />
        <MetricCard
          label="Tích lũy"
          display={money(true, logic.income - logic.expense)}
          compact={money(true, logic.income - logic.expense, true)}
          detail={`Tỷ lệ tiết kiệm ${saveRate.toFixed(0)}%`}
          detailCompact={`${saveRate.toFixed(0)}%`}
          detailClass="text-slate-500"
          accent={SURPLUS_COLOR}
          onOpen={openReport}
        />
      </div>

      {logic.isCurrentMonthView && <WeekChart items={logic.weeklyExpenses} max={logic.maxWeeklyExpense} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        <div className="lg:col-span-7 min-w-0">
          <SixMonthChart months={monthBars} ready={Boolean(comparisonReady)} />
        </div>
        <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4 min-w-0">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4318FF] inline-flex items-center justify-center"><Zap size={16} /></span>
              <h3 className="text-sm font-semibold text-slate-800">Cố vấn dòng tiền</h3>
            </div>
            <p className={`text-sm text-slate-600 leading-6 ${adviceOpen ? '' : 'line-clamp-2 lg:line-clamp-none'}`}>{advice}</p>
            <button type="button" onClick={() => setAdviceOpen((open) => !open)} className="lg:hidden mt-1 min-h-11 text-sm font-medium text-[#4318FF]">
              {adviceOpen ? 'Thu gọn' : 'Xem thêm'}
            </button>
            <div className="mt-3">
              <ProgressBar value={logic.expense} max={logic.income || 100} color={logic.income > 0 && logic.expense / logic.income > 0.8 ? THEME.error : THEME.success} height="h-2" />
            </div>
          </section>

          {logic.priorityGoal ? (
            <button type="button" onClick={openGoalSettings} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-500 inline-flex items-center gap-1.5"><PiggyBank size={14} /> Quỹ ưu tiên</p>
                  <p className="text-sm font-semibold text-slate-800 truncate mt-1">{logic.priorityGoal.name}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#16A34A]">{utils.calculateProgress(logic.priorityGoal.amount, logic.priorityGoal.target).toFixed(0)}%</span>
              </div>
              <p className="text-lg font-semibold text-slate-800 mt-2 tabular-nums">{money(showBalance, logic.priorityGoal.amount)}</p>
              <p className="text-xs text-slate-400 mt-1">Đích {money(showBalance, logic.priorityGoal.target)}{logic.priorityGoal.wallet ? ` · ${logic.priorityGoal.wallet}` : ''}</p>
              <div className="mt-3">
                <ProgressBar value={logic.priorityGoal.amount} max={logic.priorityGoal.target} color={THEME.success} height="h-2" />
              </div>
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 inline-flex items-center justify-center shrink-0"><Target size={16} /></span>
                <p className="text-sm text-slate-500">Chưa có quỹ ưu tiên.</p>
              </div>
              <button type="button" onClick={openGoalSettings} className="min-h-11 px-4 rounded-xl bg-[#4318FF] text-white text-sm shrink-0">Thiết lập mục tiêu</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Phân bổ chi tiêu</h3>
          {!selectedExpenseCategory ? (
            logic.expense > 0 && expenseSlices.length > 0 ? (
              <DonutChart
                data={expenseSlices}
                total={logic.expense}
                centerLabel="Tổng chi"
                onItemClick={(name) => { if (name !== 'Khác') setSelectedExpenseCategory(name); }}
              />
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">Chưa có khoản chi trong tháng.</p>
            )
          ) : (
            <div>
              <button type="button" onClick={() => setSelectedExpenseCategory(null)} className="min-h-11 text-sm font-medium text-[#4318FF] inline-flex items-center gap-1">
                <ChevronLeft size={16} /> {selectedExpenseCategory}
              </button>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {logic.monthData.filter((item) => item.category === selectedExpenseCategory).map((item) => (
                  <button key={item.id} type="button" onClick={() => handleEditTransaction(item)} className="w-full text-left rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-800 truncate">{item.note || item.category}</p>
                      <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: EXPENSE_COLOR }}>-{utils.formatVND(item.amount)}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{utils.formatDisplayDate(item.date)} · {item.linkedWallet || item.wallet}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Cơ cấu ví</h3>
            <button type="button" onClick={() => setWalletView((view) => (view === 'list' ? 'chart' : 'list'))} className="min-w-11 min-h-11 rounded-xl bg-slate-50 text-[#4318FF] inline-flex items-center justify-center" aria-label={walletView === 'list' ? 'Xem biểu đồ ví' : 'Xem danh sách ví'}>
              {walletView === 'list' ? <PieChart size={16} /> : <List size={16} />}
            </button>
          </div>
          {selectedWalletDetail ? (
            <div>
              <button type="button" onClick={() => setSelectedWalletDetail(null)} className="min-h-11 text-sm font-medium text-[#16A34A] inline-flex items-center gap-1">
                <ChevronLeft size={16} /> {selectedWalletDetail}
              </button>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {logic.monthData.filter((item) => item.wallet === selectedWalletDetail && item.type === 'INCOME').map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 truncate">{item.note || item.category}</p>
                      <p className="text-xs text-slate-400">{utils.formatDisplayDate(item.date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#16A34A] shrink-0">+{utils.formatVND(item.amount)}</span>
                  </div>
                ))}
                {logic.monthData.filter((item) => item.wallet === selectedWalletDetail && item.type === 'INCOME').length === 0 && (
                  <p className="text-sm text-slate-400">Tháng này không có thu vào ví này.</p>
                )}
              </div>
            </div>
          ) : walletView === 'chart' ? (
            logic.globalBal > 0 && logic.walletChart?.length > 0 ? (
              <DonutChart data={logic.walletChart} total={logic.globalBal} centerLabel="Tài sản" onItemClick={setSelectedWalletDetail} />
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">Chưa có số dư ví.</p>
            )
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {(logic.fullWalletList || []).map((wallet) => (
                <button key={wallet.name} type="button" onClick={() => setSelectedWalletDetail(wallet.name)} className="w-full text-left min-h-11">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 min-w-0 text-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: wallet.color }} />
                      <span className="truncate">{wallet.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums shrink-0">{money(showBalance, wallet.value)}</span>
                  </div>
                  {wallet.locked > 0 && (
                    <p className="text-xs text-[#D97706] mt-1 leading-5">
                      Khóa {wallet.locks.map((lock) => `${lock.name} ${money(showBalance, lock.amount)}`).join(' · ')}
                      {' · '}còn chi {money(showBalance, wallet.spendable)}
                    </p>
                  )}
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${logic.globalBal > 0 ? (Math.max(0, wallet.value) / logic.globalBal) * 100 : 0}%`, backgroundColor: wallet.color }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Giao dịch mới nhất</h3>
            <button type="button" onClick={() => setActiveTab('transactions')} className="min-h-11 px-2 text-sm font-medium text-[#4318FF]">Xem tất cả</button>
          </div>
          {logic.monthData.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Chưa có giao dịch trong tháng.</p>
          ) : (
            <div className="space-y-2">
              {logic.monthData.slice(0, 4).map((item) => (
                <button key={item.id} type="button" onClick={() => handleEditTransaction(item)} className="w-full flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left min-h-11">
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ backgroundColor: `${logic.getCategoryColor(item.category)}18`, color: logic.getCategoryColor(item.category) }}>
                      {item.category.includes('Chuyển khoản') ? <ArrowRightLeft size={16} /> : item.type === 'INCOME' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-800 truncate">{item.note || item.category}</span>
                      <span className="block text-xs text-slate-400 mt-0.5 truncate">{utils.formatDisplayDate(item.date)} · {item.category}</span>
                    </span>
                  </span>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${item.type === 'INCOME' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {item.type === 'INCOME' ? '+' : '-'}{utils.formatVND(item.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Ngân sách tháng {selectedMonth + 1}</h3>
        {budgets.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Chưa đặt hạn mức cho danh mục nào.</p>
            <button type="button" onClick={openBudgetSettings} className="min-h-11 px-4 rounded-xl bg-[#4318FF] text-white text-sm shrink-0">Thiết lập ngân sách</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {logic.budgetProgress.map((item) => {
              const left = item.amount - item.currentSpent;
              const over = left < 0;
              return (
                <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-3 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-800 inline-flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: logic.getCategoryColor(item.category) }} />
                      <span className="truncate">{item.category}</span>
                    </p>
                    <p className={`text-xs shrink-0 ${over || item.percent >= 90 ? 'text-[#DC2626]' : 'text-slate-500'}`}>
                      {over ? `Vượt ${utils.formatVND(-left)}` : `Còn ${utils.formatVND(left)}`}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 tabular-nums">{utils.formatVND(item.currentSpent)} / {utils.formatVND(item.amount)}</p>
                  <div className="mt-2">
                    <ProgressBar value={item.currentSpent} max={item.amount} color={item.statusColor} height="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
