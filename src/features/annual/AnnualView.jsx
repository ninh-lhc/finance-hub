import {
  BarChart3, Loader2, Activity, ChevronLeft
} from 'lucide-react';
import utils from '../../utils/format.js';
import { THEME } from '../../constants/theme.js';
import DonutChart from '../../components/common/DonutChart.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';

export default function AnnualView(props) {
  const {
    logic,
    selectedYear,
    setSelectedYear,
    annualSelectedMonth,
    setAnnualSelectedMonth,
    annualSelectedExpenseCategory,
    setAnnualSelectedExpenseCategory,
    annualExpandedTxId,
    setAnnualExpandedTxId,
    isFetchingAnnual,
    handleExportCSV,
    generateAnnualAIAdvice,
    handleEditTransaction,
  } = props;

  return (
            <div className="space-y-6 animate-in fade-in">
               <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-[#F4F7FE] flex items-center justify-center text-[#4318FF]"><BarChart3 size={24} /></div>
                     <div><h3 className="text-lg font-black text-[#1B2559] uppercase tracking-tighter italic">Tổng kết năm</h3></div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                     <button onClick={handleExportCSV} className="bg-[#1B2559] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Xuất Cả Năm</button>
                     <div className="flex-1 bg-[#F4F7FE] px-6 py-3 rounded-2xl border border-gray-100 shadow-inner flex items-center gap-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">NĂM</span>
                        <select className="bg-transparent text-sm font-black text-[#4318FF] outline-none" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                           {utils.getRelativeYears(selectedYear).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                     </div>
                  </div>
               </div>

               {/* Month Selector Toggle */}
               <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 no-scrollbar">
                  <button 
                     onClick={() => { setAnnualSelectedMonth('ALL'); setAnnualSelectedExpenseCategory(null); }} 
                     className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${annualSelectedMonth === 'ALL' ? 'bg-[#4318FF] text-white' : 'bg-white text-[#A3AED0] border border-gray-100'}`}
                  >
                     CẢ NĂM {selectedYear}
                  </button>
                  {Array.from({length: 12}, (_, i) => (
                      <button 
                        key={i} 
                        onClick={() => { setAnnualSelectedMonth(i); setAnnualSelectedExpenseCategory(null); }} 
                        className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm ${annualSelectedMonth === i ? 'bg-[#4318FF] text-white' : 'bg-white text-[#A3AED0] border border-gray-100'}`}
                      >
                         Tháng {i + 1}
                      </button>
                  ))}
               </div>

               {isFetchingAnnual ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border border-gray-100"><Loader2 size={40} className="animate-spin text-[#4318FF] mb-4" /><p className="text-[10px] font-black uppercase">Đang tổng hợp...</p></div>
               ) : (
                  <>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-[#111C44] p-8 rounded-[32px] text-white shadow-2xl overflow-hidden relative">
                           <div className="absolute top-0 right-0 w-24 h-24 bg-[#05CD99] blur-[50px] opacity-20"></div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">TỔNG THU NHẬP</p>
                           <h3 className="text-3xl font-black text-[#05CD99]">{utils.formatVND(logic.annualData.scopeIncome)}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">TỔNG CHI TIÊU</p>
                           <h3 className="text-3xl font-black text-[#EE5D50]">{utils.formatVND(logic.annualData.scopeExpense)}</h3>
                           <div className="mt-4"><ProgressBar value={logic.annualData.scopeExpense} max={logic.annualData.scopeIncome} color={THEME.error} /></div>
                        </div>
                        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100 relative overflow-hidden">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">TÍCH LŨY TRONG KỲ</p>
                           <h3 className="text-3xl font-black text-[#4318FF]">{utils.formatVND(logic.annualData.scopeSurplus)}</h3>
                           <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                               <p className="text-[9px] font-black text-gray-400 uppercase">Tiết kiệm: {logic.annualData.scopeIncome > 0 ? (logic.annualData.scopeSurplus/logic.annualData.scopeIncome*100).toFixed(0) : 0}%</p>
                               <p className="text-[9px] font-black text-gray-400 uppercase">Gốc đầu kỳ: <span className="text-[#1B2559]">{utils.formatVND(logic.annualData.scopeInitialBalance)}</span></p>
                           </div>
                        </div>
                     </div>

                     <div className="bg-[#111C44] rounded-[32px] p-8 text-white flex items-start gap-6 border border-white/5">
                        <Activity size={28} className="text-[#4318FF] mt-1"/>
                        <div>
                           <h4 className="text-sm font-black uppercase tracking-widest text-[#05CD99] mb-2">Chuyên gia AI phân tích</h4>
                           <p className="text-sm text-gray-300 italic">"{generateAnnualAIAdvice()}"</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100 h-[400px] flex flex-col">
                           <h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-8">Dòng tiền theo thời gian</h4>
                           <div className="flex-1 flex items-end justify-between gap-2 border-b-2 border-gray-50 pb-2">
                              {logic.yearSummary.map((m, i) => (
                                 <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer" onClick={() => setAnnualSelectedMonth(i)}>
                                    <div className="flex items-end gap-1 w-full justify-center h-full">
                                       <div className="w-2.5 bg-[#05CD99] rounded-t-md opacity-80" style={{ height: `${(m.income / (Math.max(...logic.yearSummary.map(x => Math.max(x.income, x.expense))) || 1)) * 100}%` }}></div>
                                       <div className="w-2.5 bg-[#EE5D50] rounded-t-md opacity-80" style={{ height: `${(m.expense / (Math.max(...logic.yearSummary.map(x => Math.max(x.income, x.expense))) || 1)) * 100}%` }}></div>
                                    </div>
                                    <span className="text-[9px] font-black text-gray-400 mt-3">T{i+1}</span>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100 h-[400px] flex flex-col">
                           <div className="flex justify-between items-center mb-6">
                              {annualSelectedExpenseCategory ? (
                                 <button onClick={() => setAnnualSelectedExpenseCategory(null)} className="text-sm font-black text-[#4318FF] uppercase tracking-widest flex items-center gap-1">
                                    <ChevronLeft size={16}/> QUAY LẠI ({annualSelectedExpenseCategory})
                                 </button>
                              ) : (
                                 <h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest">Cơ cấu chi tiêu</h4>
                              )}
                           </div>
                           <div className="flex-1 min-h-0 relative">
                              {!annualSelectedExpenseCategory ? (
                                 <DonutChart data={logic.annualData.scopeExpenseChart} total={logic.annualData.scopeExpense} centerLabel="Tổng chi" onItemClick={setAnnualSelectedExpenseCategory} />
                              ) : (
                                 <div className="absolute inset-0 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                    {logic.annualData.scopeTransactions.filter(t => t.category === annualSelectedExpenseCategory && t.type === 'EXPENSE').map(t => (
                                       <div key={t.id} className="border border-gray-100 rounded-xl p-3 hover:bg-[#F4F7FE] cursor-pointer" onClick={() => setAnnualExpandedTxId(annualExpandedTxId === t.id ? null : t.id)}>
                                          <div className="flex items-center justify-between">
                                             <div className="truncate"><p className="text-[10px] font-black text-[#1B2559] uppercase truncate">{t.note || t.category}</p><p className="text-[8px] font-bold text-gray-400 mt-0.5">{utils.formatDisplayDate(t.date)}</p></div>
                                             <span className="text-[11px] font-black text-[#EE5D50] ml-2">-{utils.formatVND(t.amount)}</span>
                                          </div>
                                          {annualExpandedTxId === t.id && (
                                             <div className="bg-[#F8F9FA] p-3 border-t border-gray-100 mt-2 text-[10px] flex justify-between animate-in slide-in-from-top-1">
                                                <span className="text-gray-400 font-bold uppercase tracking-widest">Nguồn: {t.linkedWallet || t.wallet}</span>
                                                <button onClick={() => handleEditTransaction(t)} className="text-[#4318FF] font-black">SỬA</button>
                                             </div>
                                          )}
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
