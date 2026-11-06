import {
  BarChart3, Loader2, Activity, ChevronLeft
} from 'lucide-react';
import utils from '../../utils/format.js';
import { THEME } from '../../constants/theme.js';
import DonutChart from '../../components/common/DonutChart.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import { DeltaLabel } from '../dashboard/MonthComparisonPanel.jsx';
import { buildAmountDelta, filterByYearMonth, summarizeCounted } from '../../logic/monthComparison.js';

export default function AnnualView(props) {
  const {
    logic,
    selectedYear,
    setSelectedYear,
    annualSelectedMonth,
    setAnnualSelectedMonth,
    annualSelectedExpenseCategory,
    setAnnualSelectedExpenseCategory,
    isFetchingAnnual,
    handleExportCSV,
    generateAnnualAIAdvice,
    handleEditTransaction,
    previousYearTransactions,
    previousYearReady,
  } = props;

  const peak = logic.yearSummary.reduce((best, month, index) => (
    month.expense > best.expense ? { expense: month.expense, index } : best
  ), { expense: 0, index: -1 });
  const maxBar = Math.max(...logic.yearSummary.map((month) => Math.max(month.income, month.expense)), 1);
  const compareMonth = annualSelectedMonth === 'ALL' ? null : annualSelectedMonth;
  const previousScope = summarizeCounted(
    compareMonth == null
      ? previousYearTransactions
      : filterByYearMonth(previousYearTransactions, selectedYear - 1, compareMonth),
  );
  const deltaPrefix = compareMonth == null
    ? `so với ${selectedYear - 1}`
    : `so với T${compareMonth + 1}/${selectedYear - 1}`;
  const categoryTransactions = annualSelectedExpenseCategory
    ? logic.annualData.scopeTransactions.filter((transaction) => transaction.category === annualSelectedExpenseCategory && transaction.type === 'EXPENSE')
    : [];

  const selectMonth = (month) => {
    setAnnualSelectedExpenseCategory(null);
    setAnnualSelectedMonth(annualSelectedMonth === month ? 'ALL' : month);
  };

  return (
            <div className="space-y-6 animate-in fade-in min-w-0">
               <div className="bg-white p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-w-0">
                  <div className="flex items-center gap-4 min-w-0">
                     <div className="w-12 h-12 rounded-2xl bg-[#F4F7FE] flex items-center justify-center text-[#4318FF] shrink-0"><BarChart3 size={24} /></div>
                     <div className="min-w-0"><h3 className="text-lg font-black text-[#1B2559] uppercase tracking-tighter italic">Tổng kết năm</h3></div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
                     <button onClick={handleExportCSV} className="bg-[#1B2559] text-white px-4 sm:px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shrink-0">Xuất cả năm</button>
                     <div className="flex-1 bg-[#F4F7FE] px-4 sm:px-6 py-3 rounded-2xl border border-gray-100 shadow-inner flex items-center gap-4 min-w-0">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Năm</span>
                        <select className="bg-transparent text-sm font-black text-[#4318FF] outline-none min-w-0" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                           {utils.getRelativeYears(selectedYear).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                     </div>
                  </div>
               </div>

               <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 no-scrollbar">
                  <button
                     onClick={() => { setAnnualSelectedMonth('ALL'); setAnnualSelectedExpenseCategory(null); }}
                     className={`px-3 py-2 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${annualSelectedMonth === 'ALL' ? 'bg-[#4318FF] text-white' : 'bg-white text-[#A3AED0] border border-gray-100'}`}
                  >
                     Cả năm {selectedYear}
                  </button>
                  {Array.from({length: 12}, (_, i) => (
                      <button
                        key={i}
                        onClick={() => selectMonth(i)}
                        className={`px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${annualSelectedMonth === i ? 'bg-[#4318FF] text-white' : 'bg-white text-[#A3AED0] border border-gray-100'}`}
                      >
                         T{i + 1}
                      </button>
                  ))}
               </div>

               {isFetchingAnnual ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border border-gray-100"><Loader2 size={40} className="animate-spin text-[#4318FF] mb-4" /><p className="text-[10px] font-black uppercase">Đang tổng hợp...</p></div>
               ) : (
                  <>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                        <div className="bg-[#111C44] p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] text-white shadow-2xl overflow-hidden relative min-w-0">
                           <div className="absolute top-0 right-0 w-24 h-24 bg-[#05CD99] blur-[50px] opacity-20"></div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tổng thu nhập</p>
                           <h3 className="text-xl sm:text-3xl font-black text-[#05CD99] break-words">{utils.formatVND(logic.annualData.scopeIncome)}</h3>
                           {previousYearReady && (
                             <p className="mt-2"><DeltaLabel delta={buildAmountDelta(logic.annualData.scopeIncome, previousScope.income)} prefix={deltaPrefix} /></p>
                           )}
                        </div>
                        <div className="bg-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border border-gray-100 min-w-0">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tổng chi tiêu</p>
                           <h3 className="text-xl sm:text-3xl font-black text-[#EE5D50] break-words">{utils.formatVND(logic.annualData.scopeExpense)}</h3>
                           {previousYearReady && (
                             <p className="mt-2"><DeltaLabel delta={buildAmountDelta(logic.annualData.scopeExpense, previousScope.expense)} invert prefix={deltaPrefix} /></p>
                           )}
                           <div className="mt-4"><ProgressBar value={logic.annualData.scopeExpense} max={logic.annualData.scopeIncome} color={THEME.error} /></div>
                        </div>
                        <div className="bg-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border border-gray-100 relative overflow-hidden min-w-0">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tích lũy trong kỳ</p>
                           <h3 className="text-xl sm:text-3xl font-black text-[#4318FF] break-words">{utils.formatVND(logic.annualData.scopeSurplus)}</h3>
                           {previousYearReady && (
                             <p className="mt-2"><DeltaLabel delta={buildAmountDelta(logic.annualData.scopeSurplus, previousScope.surplus)} prefix={deltaPrefix} /></p>
                           )}
                           <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                               <p className="text-[10px] font-black text-gray-400 uppercase">Tiết kiệm: {logic.annualData.scopeIncome > 0 ? (logic.annualData.scopeSurplus/logic.annualData.scopeIncome*100).toFixed(0) : 0}%</p>
                               <p className="text-[10px] font-black text-gray-400 uppercase">Gốc đầu kỳ: <span className="text-[#1B2559]">{utils.formatVND(logic.annualData.scopeInitialBalance)}</span></p>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => peak.index >= 0 && selectMonth(peak.index)}
                          className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-left shadow-sm"
                        >
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tháng chi nhiều nhất</p>
                          <p className="text-sm font-black text-[#EE5D50] mt-1">
                            {peak.expense > 0 ? `T${peak.index + 1} · ${utils.formatVND(peak.expense)}` : 'Chưa có khoản chi'}
                          </p>
                        </button>
                        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trung bình tháng</p>
                          <p className="text-sm font-black text-[#1B2559] mt-1">{utils.formatVND(logic.annualData.avgMonthlyExpense)}</p>
                        </div>
                     </div>

                     <div className="bg-[#111C44] rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 text-white flex items-start gap-4 sm:gap-6 border border-white/5 min-w-0">
                        <Activity size={28} className="text-[#4318FF] mt-1 shrink-0"/>
                        <div className="min-w-0">
                           <h4 className="text-sm font-black uppercase tracking-widest text-[#05CD99] mb-2">Chuyên gia AI phân tích</h4>
                           <p className="text-sm text-gray-300 italic">"{generateAnnualAIAdvice()}"</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border border-gray-100 min-h-[320px] lg:h-[440px] flex flex-col min-w-0">
                           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                              <h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest">Dòng tiền theo thời gian</h4>
                              <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#05CD99]" /> Thu</span>
                                 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EE5D50]" /> Chi</span>
                              </div>
                           </div>
                           <div className="flex-1 min-h-[180px] flex items-end justify-between gap-1 sm:gap-2 border-b-2 border-gray-50 pb-2">
                              {logic.yearSummary.map((month, index) => {
                                 const selected = annualSelectedMonth === index;
                                 const dimmed = annualSelectedMonth !== 'ALL' && !selected;
                                 return (
                                 <button
                                   key={index}
                                   type="button"
                                   title={`T${index + 1}: Thu ${utils.formatVND(month.income)}, Chi ${utils.formatVND(month.expense)}`}
                                   onClick={() => selectMonth(index)}
                                   className={`flex-1 flex flex-col items-center h-full justify-end min-w-0 bg-transparent border-0 p-0 cursor-pointer rounded-lg ${selected ? 'bg-[#F4F7FE]' : ''}`}
                                 >
                                    <div className={`flex items-end gap-0.5 sm:gap-1 w-full justify-center flex-1 min-h-0 ${dimmed ? 'opacity-35' : ''}`}>
                                       <div className="w-1.5 sm:w-2.5 bg-[#05CD99] rounded-t-md" style={{ height: `${(month.income / maxBar) * 100}%` }}></div>
                                       <div className="w-1.5 sm:w-2.5 bg-[#EE5D50] rounded-t-md" style={{ height: `${(month.expense / maxBar) * 100}%` }}></div>
                                    </div>
                                    <span className={`text-[9px] font-black mt-2 ${selected ? 'text-[#4318FF]' : 'text-gray-400'}`}>T{index + 1}</span>
                                 </button>
                                 );
                              })}
                           </div>
                           {compareMonth != null && (
                             <p className="text-[10px] font-black text-[#1B2559] mt-3">
                               T{compareMonth + 1}: Thu {utils.formatVND(logic.yearSummary[compareMonth].income)} · Chi {utils.formatVND(logic.yearSummary[compareMonth].expense)}
                             </p>
                           )}
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-xl border border-gray-100 min-h-[320px] lg:h-[440px] flex flex-col min-w-0">
                           <div className="flex justify-between items-center mb-4 gap-3">
                              {annualSelectedExpenseCategory ? (
                                 <button onClick={() => setAnnualSelectedExpenseCategory(null)} className="text-sm font-black text-[#4318FF] uppercase tracking-widest flex items-center gap-1 min-w-0">
                                    <ChevronLeft size={16}/> <span className="truncate">Quay lại ({annualSelectedExpenseCategory})</span>
                                 </button>
                              ) : (
                                 <h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest">Cơ cấu chi tiêu</h4>
                              )}
                           </div>
                           <div className="flex-1 min-h-[220px] relative">
                              {!annualSelectedExpenseCategory ? (
                                 <DonutChart data={logic.annualData.scopeExpenseChart} total={logic.annualData.scopeExpense} centerLabel="Tổng chi" onItemClick={setAnnualSelectedExpenseCategory} />
                              ) : (
                                 <div className="lg:absolute lg:inset-0 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                    {categoryTransactions.length === 0 && (
                                      <p className="text-[10px] font-bold text-gray-400">Không có khoản chi trong danh mục này.</p>
                                    )}
                                    {categoryTransactions.map(t => (
                                       <div key={t.id} className="border border-gray-100 rounded-xl p-3 bg-[#F8F9FA]">
                                          <div className="flex items-center justify-between gap-2">
                                             <div className="truncate min-w-0"><p className="text-[10px] font-black text-[#1B2559] uppercase truncate">{t.note || t.category}</p><p className="text-[8px] font-bold text-gray-400 mt-0.5">{utils.formatDisplayDate(t.date)} · {t.linkedWallet || t.wallet}</p></div>
                                             <span className="text-[11px] font-black text-[#EE5D50] shrink-0">-{utils.formatVND(t.amount)}</span>
                                          </div>
                                          <div className="mt-2 flex justify-end">
                                             <button type="button" onClick={() => handleEditTransaction(t)} className="text-[10px] font-black text-[#4318FF] uppercase tracking-widest">Sửa</button>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </>
               )}
            </div>
  );
}
