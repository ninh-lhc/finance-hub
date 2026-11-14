import { useState } from 'react';
import { AlertTriangle, ChevronLeft, PieChart } from 'lucide-react';
import utils from '../../utils/format.js';
import { DeltaLabel } from '../dashboard/MonthComparisonPanel.jsx';
import { transactionsForCategory } from '../../logic/monthReport.js';
import PeriodOverview from './PeriodOverview.jsx';
import BudgetSnapshot from './BudgetSnapshot.jsx';

function monthTag(month, year, selectedYear) {
  const label = `T${month + 1}`;
  return year === selectedYear ? label : `${label}/${year}`;
}

function AmountRow({ label, amount, max, color }) {
  const scale = max > 0 ? max : 1;
  const width = Math.min(100, (Number(amount || 0) / scale) * 100);
  return (
    <div className="grid grid-cols-[4.5rem_1fr_auto] sm:grid-cols-[5.5rem_1fr_auto] gap-2 items-center">
      <span className="text-[9px] font-black uppercase tracking-wide text-gray-400 truncate">{label}</span>
      <div className="h-1.5 rounded-full bg-[#F4F7FE] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${amount > 0 ? Math.max(width, 4) : 0}%`, background: color }} />
      </div>
      <span className="text-[10px] font-black text-[#1B2559] tabular-nums">{utils.formatVND(amount || 0)}</span>
    </div>
  );
}

function CategoryBars({ categories, max, previousLabel, showSamePeriod, selectedName, onSelect }) {
  if (categories.length === 0) {
    return <p className="text-[10px] font-bold text-gray-400">Chưa có khoản nào để so sánh.</p>;
  }
  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
      {categories.map((item) => {
        const selected = selectedName === item.name;
        return (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelect(item.name)}
            className={`w-full text-left rounded-2xl border px-3 py-3 transition-all ${selected ? 'border-[#4318FF] bg-[#F4F7FE]' : 'border-transparent hover:bg-[#F4F7FE]'}`}
          >
            <p className="text-[11px] font-black text-[#1B2559] uppercase truncate mb-2">{item.name}</p>
            <div className="space-y-1.5">
              <AmountRow label="Tháng này" amount={item.current} max={max} color="#4318FF" />
              <AmountRow label={previousLabel} amount={item.previous} max={max} color="#A3AED0" />
              {showSamePeriod && <AmountRow label="Cùng kỳ" amount={item.samePeriod} max={max} color="#FFCE20" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PeriodColumn({ label, current, previous, samePeriod, max, showSamePeriod, amountClass }) {
  const bars = [
    { key: 'current', value: current, color: '#4318FF' },
    { key: 'previous', value: previous, color: '#A3AED0' },
    ...(showSamePeriod ? [{ key: 'same', value: samePeriod || 0, color: '#FFCE20' }] : []),
  ];
  const scale = max > 0 ? max : 1;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{label}</p>
      <div className="h-36 flex items-end justify-center gap-2 sm:gap-3">
        {bars.map((bar) => {
          const height = bar.value > 0 ? Math.max(8, (bar.value / scale) * 100) : 0;
          return (
            <div key={bar.key} className="w-6 sm:w-8 h-full flex items-end" title={utils.formatVND(bar.value)}>
              <div className="w-full rounded-t-xl" style={{ height: `${height}%`, background: bar.color }} />
            </div>
          );
        })}
      </div>
      <p className={`text-sm sm:text-base font-black mt-3 tabular-nums ${amountClass}`}>{utils.formatVND(current)}</p>
    </div>
  );
}

function SummaryCard({ label, amount, amountClass, previousDelta, samePeriodDelta, invert, previousPrefix, samePrefix, onPrevious, onSamePeriod }) {
  return (
    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={`text-xl sm:text-2xl font-black mt-2 break-words ${amountClass}`}>{utils.formatVND(amount)}</p>
      <div className="mt-3 space-y-1">
        <DeltaLabel delta={previousDelta} invert={invert} prefix={previousPrefix} onClick={onPrevious} />
        {samePeriodDelta && (
          <div>
            <DeltaLabel delta={samePeriodDelta} invert={invert} prefix={samePrefix} onClick={onSamePeriod} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportView({
  report,
  transactions,
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  onOpenLedger,
  handleEditTransaction,
  yearTransactions,
  wallets,
  budgets = [],
  onOpenBudgets,
}) {
  const [selection, setSelection] = useState(null);

  const chooseMonth = (month) => {
    setSelection(null);
    setSelectedMonth(month);
  };

  const chooseYear = (year) => {
    setSelection(null);
    setSelectedYear(year);
  };

  const openPreviousMonth = () => {
    if (!report) return;
    setSelection(null);
    setSelectedMonth(report.previousMonth);
    setSelectedYear(report.previousYear);
  };

  const openSamePeriod = () => {
    if (!report?.samePeriodReady) return;
    setSelection(null);
    setSelectedMonth(report.samePeriodMonth);
    setSelectedYear(report.samePeriodYear);
  };

  const selectCategory = (type, name) => {
    setSelection((current) => (
      current?.type === type && current?.category === name ? null : { type, category: name }
    ));
  };

  const previousLabel = report ? monthTag(report.previousMonth, report.previousYear, selectedYear) : '';
  const sameLabel = report ? `so với ${monthTag(report.samePeriodMonth, report.samePeriodYear, selectedYear)}` : '';
  const rows = selection ? transactionsForCategory(transactions, selection.type, selection.category) : [];
  const flowValues = report
    ? [report.income, report.expense, report.previousIncome, report.previousExpense, report.samePeriodIncome || 0, report.samePeriodExpense || 0]
    : [];
  const hasFlow = flowValues.some((value) => value > 0);
  const flowMax = Math.max(...flowValues, 1);

  return (
    <div className="space-y-6 animate-in fade-in min-w-0">
      <div className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-w-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F7FE] flex items-center justify-center text-[#4318FF] shrink-0">
            <PieChart size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[#1B2559] uppercase tracking-tighter italic">Báo cáo thu chi</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Theo kỳ, danh mục, ví và cùng kỳ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#F4F7FE] rounded-2xl px-5 py-3 border border-gray-100 shadow-inner w-full md:w-auto">
          <select className="bg-transparent text-xs font-black outline-none cursor-pointer uppercase tracking-widest" value={selectedMonth} onChange={(event) => chooseMonth(parseInt(event.target.value, 10))}>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Tháng {index + 1}</option>)}
          </select>
          <select className="bg-transparent text-xs font-black outline-none cursor-pointer tracking-widest" value={selectedYear} onChange={(event) => chooseYear(parseInt(event.target.value, 10))}>
            {utils.getRelativeYears(selectedYear).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>

      <PeriodOverview
        key={selectedYear}
        transactions={yearTransactions}
        wallets={wallets}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        ready={Boolean(report?.ready)}
        handleEditTransaction={handleEditTransaction}
        afterStats={(
          <BudgetSnapshot
            key={`${selectedYear}-${selectedMonth}`}
            budgets={budgets}
            expenseCategories={report?.expenseCategories || []}
            samePeriodReady={Boolean(report?.samePeriodReady)}
            ready={Boolean(report?.ready)}
            monthLabel={`Tháng ${selectedMonth + 1}/${selectedYear}`}
            previousLabel={previousLabel || 'Tháng trước'}
            onOpenCategory={(name) => onOpenLedger('EXPENSE', name)}
            onOpenBudgets={onOpenBudgets}
          />
        )}
      />

      {report?.ready && (
        <details className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-800">
            Đối chiếu với tháng trước và cùng kỳ · Tháng {selectedMonth + 1}/{selectedYear}
          </summary>
          <div className="px-5 pb-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              label="Thu nhập"
              amount={report.income}
              amountClass="text-[#05CD99]"
              previousDelta={report.incomeDelta}
              samePeriodDelta={report.incomeSamePeriodDelta}
              previousPrefix={`so với ${previousLabel}`}
              samePrefix={sameLabel}
              onPrevious={openPreviousMonth}
              onSamePeriod={openSamePeriod}
            />
            <SummaryCard
              label="Chi tiêu"
              amount={report.expense}
              amountClass="text-[#EE5D50]"
              previousDelta={report.expenseDelta}
              samePeriodDelta={report.expenseSamePeriodDelta}
              invert
              previousPrefix={`so với ${previousLabel}`}
              samePrefix={sameLabel}
              onPrevious={openPreviousMonth}
              onSamePeriod={openSamePeriod}
            />
            <SummaryCard
              label="Chênh lệch"
              amount={report.surplus}
              amountClass="text-[#4318FF]"
              previousDelta={report.surplusDelta}
              samePeriodDelta={report.surplusSamePeriodDelta}
              previousPrefix={`so với ${previousLabel}`}
              samePrefix={sameLabel}
              onPrevious={openPreviousMonth}
              onSamePeriod={openSamePeriod}
            />
          </div>

          <div className="bg-[#111C44] rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 text-white shadow-2xl min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest">Thu chi ba mốc</h4>
                <p className="text-[10px] font-bold text-gray-400 mt-1">Tháng {selectedMonth + 1}/{selectedYear}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4318FF]" /> Tháng này</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#A3AED0]" /> {previousLabel}</span>
                {report.samePeriodReady && (
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FFCE20]" /> Cùng kỳ</span>
                )}
              </div>
            </div>
            {!report.samePeriodReady && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Đang lấy số cùng kỳ năm trước.</p>
            )}
            {!hasFlow ? (
              <p className="text-sm font-bold text-gray-400">Chưa có thu chi trong các mốc này.</p>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <PeriodColumn
                  label="Thu"
                  current={report.income}
                  previous={report.previousIncome}
                  samePeriod={report.samePeriodIncome}
                  max={flowMax}
                  showSamePeriod={report.samePeriodReady}
                  amountClass="text-[#05CD99]"
                />
                <PeriodColumn
                  label="Chi"
                  current={report.expense}
                  previous={report.previousExpense}
                  samePeriod={report.samePeriodExpense}
                  max={flowMax}
                  showSamePeriod={report.samePeriodReady}
                  amountClass="text-[#EE5D50]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
              <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-4">Chi theo danh mục</h4>
              <CategoryBars
                categories={report.expenseCategories}
                max={Math.max(...report.expenseCategories.flatMap((item) => [item.current, item.previous, item.samePeriod]), 1)}
                previousLabel={previousLabel}
                showSamePeriod={report.samePeriodReady}
                selectedName={selection?.type === 'EXPENSE' ? selection.category : null}
                onSelect={(name) => selectCategory('EXPENSE', name)}
              />
            </div>
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
              <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-4">Thu theo danh mục</h4>
              <CategoryBars
                categories={report.incomeCategories}
                max={Math.max(...report.incomeCategories.flatMap((item) => [item.current, item.previous, item.samePeriod]), 1)}
                previousLabel={previousLabel}
                showSamePeriod={report.samePeriodReady}
                selectedName={selection?.type === 'INCOME' ? selection.category : null}
                onSelect={(name) => selectCategory('INCOME', name)}
              />
            </div>
          </div>

          {selection && (
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <button type="button" onClick={() => setSelection(null)} className="text-sm font-black text-[#4318FF] uppercase tracking-widest flex items-center gap-1 min-w-0 bg-transparent border-0 p-0">
                  <ChevronLeft size={16} />
                  <span className="truncate">{selection.category}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLedger(selection.type, selection.category)}
                  className="text-[10px] font-black text-[#4318FF] uppercase tracking-widest bg-[#F4F7FE] px-4 py-2 rounded-xl"
                >
                  Mở sổ giao dịch
                </button>
              </div>
              {rows.length === 0 ? (
                <p className="text-[10px] font-bold text-gray-400">Tháng này không có giao dịch trong danh mục này.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((transaction) => (
                    <div key={transaction.id || `${transaction.date}-${transaction.amount}`} className="border border-gray-100 rounded-xl p-3 bg-[#F8F9FA] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{transaction.note || transaction.category}</p>
                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{utils.formatDisplayDate(transaction.date)} · {transaction.linkedWallet || transaction.wallet || '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[12px] font-black tabular-nums ${selection.type === 'INCOME' ? 'text-[#05CD99]' : 'text-[#EE5D50]'}`}>
                          {selection.type === 'INCOME' ? '+' : '-'}{utils.formatVND(transaction.amount)}
                        </span>
                        <button type="button" onClick={() => handleEditTransaction(transaction)} className="text-[10px] font-black text-[#4318FF] uppercase tracking-widest">Sửa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 shadow-sm border border-gray-100 min-w-0">
            <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-4">Khoản lệch đáng chú ý</h4>
            {report.issues.length === 0 ? (
              <p className="text-[10px] font-bold text-gray-400">Tháng này không có khoản lệch đáng kể so với tháng trước.</p>
            ) : (
              <div className="space-y-3">
                {report.issues.map((issue) => {
                  const clickable = Boolean(issue.category && issue.type);
                  const body = (
                    <>
                      <AlertTriangle size={16} className={issue.tone === 'bad' ? 'text-[#EE5D50]' : 'text-[#FFCE20]'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{issue.title}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{issue.detail}</p>
                      </div>
                      <span className="text-[11px] font-black text-[#1B2559] tabular-nums shrink-0">{utils.formatVND(issue.amount)}</span>
                    </>
                  );
                  const className = `w-full flex items-start gap-3 text-left rounded-2xl border px-3 py-3 ${issue.tone === 'bad' ? 'border-[#EE5D50]/20 bg-[#FFF6F6]' : 'border-[#FFCE20]/40 bg-[#FFFDF5]'} ${clickable ? 'cursor-pointer' : ''}`;
                  if (!clickable) {
                    return <div key={issue.id} className={className}>{body}</div>;
                  }
                  return (
                    <button key={issue.id} type="button" onClick={() => selectCategory(issue.type, issue.category)} className={className}>
                      {body}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </details>
      )}
    </div>
  );
}
