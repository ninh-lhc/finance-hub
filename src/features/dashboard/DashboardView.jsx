import {
  LayoutDashboard, Calendar, Eye, Wallet, ArrowUpRight, ArrowDownLeft, Landmark, BarChart3, Zap,
  PiggyBank, Target, ChevronLeft, PieChart, List, ArrowRightLeft
} from 'lucide-react';
import utils from '../../utils/format.js';
import { THEME } from '../../constants/theme.js';
import DonutChart from '../../components/common/DonutChart.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';

function formatTopWalletLabel(name) {
  if (name === 'Chưa có ví' || !name) {
    return 'Chưa có';
  }
  return name;
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
      className="mt-4 px-5 py-2.5 rounded-xl bg-[#4318FF] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:brightness-110 active:scale-[0.98] transition-all"
    >
      {children}
    </button>
  );
}

function DashboardBudgetPlaceholderCard({ category }) {
  return (
    <div className="bg-[#F8F9FA] p-5 rounded-[24px] border border-dashed border-gray-200 opacity-60 pointer-events-none select-none">
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="text-xs font-black text-[#A3AED0] uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            {category}
          </p>
          <p className="text-[10px] font-bold text-gray-300 mt-1">Hạn mức: —</p>
        </div>
        <div className="text-right">
          <span className="text-base font-black text-gray-300 tabular-nums">0 ₫</span>
          <p className="text-[10px] font-black text-gray-300 mt-0.5">Đã dùng 0%</p>
        </div>
      </div>
      <div className="w-full bg-[#E9EDF7] rounded-full h-2.5 overflow-hidden">
        <div className="h-full w-0 rounded-full bg-gray-300" />
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
  } = props;

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

  return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
               {/* Dashboard Header */}
               <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                     <select className="bg-transparent text-xs font-black text-[#1B2559] outline-none cursor-pointer uppercase tracking-widest" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                        {Array.from({length: 12}, (_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
                     </select>
                     <div className="w-px h-5 bg-gray-300"></div>
                     <select className="bg-transparent text-sm font-black text-[#4318FF] outline-none cursor-pointer tracking-widest" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                        {utils.getRelativeYears(selectedYear).map(y => <option key={y} value={y}>{y}</option>)}
                     </select>
                  </div>
               </div>

               {/* Top Hero Grid */}
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Tổng tài sản */}
                  <div className="lg:col-span-8 bg-[#111C44] rounded-[32px] p-8 text-white relative shadow-[0_20px_50px_-12px_rgba(17,28,68,0.2)] flex flex-col justify-between min-h-[340px]">
                     <div className="flex justify-between items-start mb-6">
                        <div className="space-y-2">
                           <div className="flex items-center gap-2">
                              <p className="text-[11px] font-black text-[#05CD99] uppercase tracking-[0.2em]">Khả dụng chi tiêu</p>
                              <button onClick={() => setShowBalance(!showBalance)} className="text-gray-500 hover:text-white transition-colors"><Eye size={14}/></button>
                           </div>
                           <h3 className="text-5xl md:text-6xl font-black tracking-tighter">
                              {showBalance ? utils.formatVND(logic.spendableBal) : "••••••••"}
                           </h3>
                           <div className="flex flex-wrap gap-3 mt-4">
                              <div className="bg-[#1B2559] px-4 py-2.5 rounded-xl border border-white/5 shadow-inner">
                                 <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">Thực tế</p>
                                 <p className="text-sm font-black text-white">{showBalance ? utils.formatVND(logic.globalBal) : "••••"}</p>
                              </div>
                              <div className="bg-[#1B2559] px-4 py-2.5 rounded-xl border border-white/5 shadow-inner">
                                 <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">Đã khóa Quỹ</p>
                                 <p className="text-sm font-black text-[#FFCE20]">{showBalance ? utils.formatVND(logic.totalGoalsAmount) : "••••"}</p>
                              </div>
                           </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 bg-[#1B2559] p-2 pr-5 rounded-[20px] border border-white/5 shadow-inner">
                           <div className="w-10 h-10 bg-[#4318FF] rounded-[14px] flex items-center justify-center">
                              <Wallet size={18} className="text-white"/>
                           </div>
                           <div>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Lớn nhất</p>
                              <p className="text-xs font-black text-white uppercase tracking-widest truncate max-w-[120px]">{formatTopWalletLabel(logic.topWallet.name)}</p>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-[#1C244B] p-5 rounded-[24px] border border-white/5 shadow-inner">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Thu nhập T{selectedMonth+1}</p>
                           <div className="flex justify-between items-end gap-2 mt-2">
                              <span className="text-xl lg:text-[22px] font-black text-[#05CD99] tracking-tighter">{utils.formatVND(logic.income)}</span>
                              <ArrowUpRight size={20} className="text-[#05CD99] opacity-80"/>
                           </div>
                        </div>
                        <div className="bg-[#1C244B] p-5 rounded-[24px] border border-white/5 shadow-inner">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chi tiêu T{selectedMonth+1}</p>
                           <div className="flex justify-between items-end gap-2 mt-2">
                              <span className="text-xl lg:text-[22px] font-black text-[#EE5D50] tracking-tighter">{utils.formatVND(logic.expense)}</span>
                              <ArrowDownLeft size={20} className="text-[#EE5D50] opacity-80"/>
                           </div>
                        </div>
                        <div className="bg-[#1C244B] p-5 rounded-[24px] border border-white/5 shadow-inner">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tích lũy tháng</p>
                           <div className="flex justify-between items-end gap-2 mt-2">
                              <span className="text-xl lg:text-[22px] font-black text-[#FFCE20] tracking-tighter">{utils.formatVND(logic.income - logic.expense)}</span>
                              <Landmark size={20} className="text-[#FFCE20] opacity-80"/>
                           </div>
                        </div>
                     </div>

                     {/* Biểu đồ tuần */}
                     <div className="bg-[#1C244B] p-6 rounded-[32px] border border-white/5 relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#EE5D50] blur-[120px] opacity-[0.03] pointer-events-none"></div>
                        
                        <div className="flex justify-between items-center mb-8 relative z-10">
                           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              <BarChart3 size={14} className="text-[#EE5D50]"/> {logic.isCurrentMonthView ? 'Chi tiêu 7 ngày qua' : `Chi tiêu các tuần T${selectedMonth + 1}`} <span className="text-[8px] opacity-70">({logic.isCurrentMonthView ? 'Thực tế' : 'Lịch sử'})</span>
                           </h4>
                           <div className="flex items-center gap-2 bg-[#EE5D50]/10 px-3 py-1.5 rounded-full border border-[#EE5D50]/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#EE5D50] animate-pulse"></span>
                              <span className="text-[10px] font-black text-[#EE5D50]">{utils.formatVND(logic.weeklyExpenses.reduce((s, d) => s + d.total, 0))}</span>
                           </div>
                        </div>
                        
                        <div className="relative flex items-end justify-between h-[100px] gap-2 sm:gap-4 mt-2 z-10 px-2">
                           <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                              <div className="w-full border-t border-dashed border-gray-500"></div>
                              <div className="w-full border-t border-dashed border-gray-500"></div>
                              <div className="w-full border-t border-dashed border-gray-500"></div>
                           </div>
                           
                           {logic.weeklyExpenses.map((item, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative z-10 cursor-pointer">
                                 <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:-translate-y-1 bg-[#2B3674] text-white text-[10px] font-black px-3 py-1.5 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-xl border border-white/10 flex flex-col items-center">
                                    {utils.formatVND(item.total)}
                                    <div className="absolute -bottom-1 w-2 h-2 bg-[#2B3674] rotate-45 border-r border-b border-white/10"></div>
                                 </div>
                                 
                                 <div className="w-full max-w-[36px] bg-[#111C44] rounded-full group-hover:bg-[#15204c] transition-colors relative flex justify-end flex-col overflow-hidden shadow-inner border border-white/5" style={{height: '100%'}}>
                                    <div className="w-full bg-gradient-to-t from-[#EE5D50] to-[#FF938A] rounded-full transition-all duration-1000 ease-out group-hover:brightness-110 shadow-[0_0_15px_rgba(238,93,80,0.5)]" style={{height: `${logic.maxWeeklyExpense > 0 ? (item.total / logic.maxWeeklyExpense) * 100 : 0}%`, minHeight: item.total > 0 ? '8px' : '0'}}></div>
                                 </div>
                                 <span className={`text-[9px] font-bold mt-3 uppercase tracking-tighter transition-colors ${i === 6 && logic.isCurrentMonthView ? 'text-[#05CD99]' : 'text-gray-500 group-hover:text-gray-300'}`}>{item.label}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Cố vấn & Quỹ */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                     <div className="bg-[#111C44] rounded-[32px] p-6 text-white shadow-xl border border-white/5 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-4">
                           <div className="w-10 h-10 rounded-[14px] bg-[#4318FF] flex items-center justify-center shadow-lg"><Zap size={20} fill="white"/></div>
                           <h4 className="text-sm font-black uppercase tracking-widest text-white">Cố vấn dòng tiền</h4>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-medium mb-6 italic">
                           "{generateDashboardAdvice()}"
                        </p>
                        <ProgressBar value={logic.expense} max={logic.income || 100} color={logic.income > 0 && logic.expense/logic.income*100 > 80 ? THEME.error : THEME.success} height="h-2" />
                     </div>

                     {logic.priorityGoal ? (
                        <div 
                           onClick={() => {setActiveTab('settings'); setActiveSettingTab('goal'); cancelEdit();}}
                           className="bg-white rounded-[32px] p-7 shadow-sm border border-gray-100 flex-1 flex flex-col justify-between group cursor-pointer hover:shadow-md transition-all"
                        >
                           <div>
                              <div className="flex justify-between items-start mb-4">
                                 <div>
                                    <p className="text-[10px] font-black text-[#05CD99] uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                                       <PiggyBank size={14} /> Quỹ ưu tiên
                                    </p>
                                    <h4 className="text-lg font-black text-[#1B2559] truncate pr-4">{logic.priorityGoal.name}</h4>
                                 </div>
                                 <div className="w-10 h-10 rounded-2xl bg-[#E6FDF9] flex items-center justify-center flex-shrink-0 border border-[#05CD99]/20">
                                    <Target size={20} className="text-[#05CD99]"/>
                                 </div>
                              </div>
                              <div className="mt-4">
                                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hiện có</p>
                                 <span className="text-3xl font-black text-[#1B2559] leading-none tracking-tighter">{utils.formatVND(logic.priorityGoal.amount)}</span>
                              </div>
                           </div>
                           <div className="mt-6">
                              <div className="flex justify-between items-end mb-2">
                                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Đích: {utils.formatVND(logic.priorityGoal.target)}</span>
                                 <span className="text-sm font-black text-[#05CD99]">{utils.calculateProgress(logic.priorityGoal.amount, logic.priorityGoal.target).toFixed(0)}%</span>
                              </div>
                              <ProgressBar value={logic.priorityGoal.amount} max={logic.priorityGoal.target} color={THEME.success} height="h-2.5" />
                           </div>
                        </div>
                     ) : (
                        <div className="bg-[#F8F9FA] rounded-[32px] p-6 border border-dashed border-gray-200 flex-1 flex flex-col justify-between min-h-[200px]">
                           <div className="flex justify-between items-start opacity-50 pointer-events-none select-none">
                              <div>
                                 <p className="text-[10px] font-black text-[#A3AED0] uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                                    <PiggyBank size={14} /> Quỹ ưu tiên
                                 </p>
                                 <h4 className="text-sm font-black text-gray-300 uppercase tracking-widest">—</h4>
                              </div>
                              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center border border-gray-100">
                                 <Target size={20} className="text-gray-300" strokeWidth={1.75} />
                              </div>
                           </div>
                           <div className="mt-4 opacity-50 pointer-events-none select-none">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hiện có</p>
                              <span className="text-2xl font-black text-gray-300 leading-none tracking-tighter tabular-nums">0 ₫</span>
                              <div className="mt-4 w-full bg-[#E9EDF7] rounded-full h-2.5 overflow-hidden">
                                 <div className="h-full w-0 rounded-full bg-gray-300" />
                              </div>
                           </div>
                           <div className="mt-5 flex flex-col items-center text-center">
                              <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Chưa có mục tiêu</p>
                              <p className="text-[10px] font-bold text-gray-400 mt-2 max-w-[220px]">
                                 Đặt mục tiêu tích lũy để theo dõi tiến độ ngay trên dashboard.
                              </p>
                              <DashboardSetupButton onClick={openGoalSettings}>Thiết lập mục tiêu</DashboardSetupButton>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
               
               {/* Section Phân tích Chi tiết */}
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Phân bổ chi tiêu */}
                  <div className="lg:col-span-4 bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col h-[400px]">
                     <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest mb-6">Phân bổ chi tiêu</h4>
                     <div className="flex-1 min-h-0 relative">
                        {!selectedExpenseCategory ? (
                           logic.expense > 0 && logic.expenseChart?.length > 0 ? (
                             <DonutChart data={logic.expenseChart} total={logic.expense} centerLabel="Tổng chi" onItemClick={setSelectedExpenseCategory} />
                           ) : (
                             <DashboardChartEmpty label="Chưa có" />
                           )
                        ) : (
                           <div className="absolute inset-0 flex flex-col">
                              <button onClick={() => {setSelectedExpenseCategory(null); setExpandedTxId(null);}} className="text-[10px] font-black text-[#4318FF] uppercase tracking-widest flex items-center gap-1 mb-4">
                                 <ChevronLeft size={14}/> QUAY LẠI ({selectedExpenseCategory})
                              </button>
                              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                 {logic.monthData.filter(t => t.category === selectedExpenseCategory).map(t => (
                                    <div key={t.id} className="border border-gray-50 rounded-xl bg-[#F8F9FA] p-3">
                                       <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-black text-[#1B2559] uppercase truncate">{t.note || t.category}</p>
                                          <span className="text-[11px] font-black text-[#EE5D50]">-{utils.formatVND(t.amount)}</span>
                                       </div>
                                       <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase italic">{utils.formatDisplayDate(t.date)} - {t.linkedWallet || t.wallet}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Cơ cấu ví tiền */}
                  <div className="lg:col-span-4 bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col h-[400px]">
                     <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Cơ cấu ví tiền</h4>
                        <button onClick={() => setWalletView(v => v === 'list' ? 'chart' : 'list')} className="p-2 bg-[#F4F7FE] rounded-xl text-[#4318FF] hover:bg-indigo-50 transition-colors">
                           {walletView === 'list' ? <PieChart size={16}/> : <List size={16}/>}
                        </button>
                     </div>
                     <div className="flex-1 min-h-0 relative">
                        {selectedWalletDetail ? (
                           <div className="absolute inset-0 flex flex-col">
                              <button onClick={() => setSelectedWalletDetail(null)} className="text-[10px] font-black text-[#05CD99] uppercase tracking-widest flex items-center gap-1 mb-4 hover:opacity-70">
                                 <ChevronLeft size={14}/> QUAY LẠI ({selectedWalletDetail})
                              </button>
                              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                 {logic.monthData.filter(t => t.wallet === selectedWalletDetail && t.type === 'INCOME').map(t => (
                                    <div key={t.id} className="border border-gray-50 rounded-xl bg-[#F8F9FA] p-3 flex justify-between items-center">
                                       <div className="truncate pr-2">
                                          <p className="text-[10px] font-black text-[#1B2559] uppercase truncate">{t.note || t.category}</p>
                                          <p className="text-[8px] font-bold text-gray-400">{utils.formatDisplayDate(t.date)}</p>
                                       </div>
                                       <span className="text-[10px] font-black text-[#05CD99]">+{utils.formatVND(t.amount)}</span>
                                    </div>
                                 ))}
                                 {logic.monthData.filter(t => t.wallet === selectedWalletDetail && t.type === 'INCOME').length === 0 && (
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
                           <div className="absolute inset-0 overflow-y-auto pr-1 custom-scrollbar space-y-4">
                              {(logic.fullWalletList || []).map(w => (
                                 <div key={w.name} className="flex flex-col gap-2 cursor-pointer group" onClick={() => setSelectedWalletDetail(w.name)}>
                                    <div className="flex items-center justify-between text-xs">
                                       <div className="flex items-center gap-2 truncate pr-2">
                                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: w.color}}></div>
                                          <span className="font-bold text-[#1B2559] truncate">{w.name}</span>
                                       </div>
                                       <span className="font-black text-[#1B2559]">{showBalance ? utils.formatVND(w.value) : "••••"}</span>
                                    </div>
                                    <div className="w-full bg-[#F4F7FE] rounded-full h-2 overflow-hidden">
                                       <div className="h-full rounded-full transition-all" style={{width: `${logic.globalBal > 0 ? (Math.max(0, w.value) / logic.globalBal) * 100 : 0}%`, backgroundColor: w.color}}></div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Nhật ký mới */}
                  <div className="lg:col-span-4 bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col h-[400px]">
                     <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Giao dịch mới nhất</h4>
                        <button onClick={() => setActiveTab('transactions')} className="text-[9px] font-black text-[#4318FF] uppercase tracking-widest">Xem tất cả</button>
                     </div>
                     <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {logic.monthData.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                              <div className="w-12 h-12 rounded-2xl bg-[#F4F7FE] flex items-center justify-center text-[#A3AED0] mb-3">
                                 <ArrowRightLeft size={22} />
                              </div>
                              <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Chưa có giao dịch</p>
                              <p className="text-sm font-black text-gray-300 mt-1 tabular-nums">0</p>
                           </div>
                        ) : (
                           logic.monthData.slice(0, 8).map((t) => (
                              <div key={t.id} className="flex items-center justify-between p-3 border border-gray-50 rounded-2xl bg-[#F8F9FA] hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                                 <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{backgroundColor: `${logic.getCategoryColor(t.category)}15`, color: logic.getCategoryColor(t.category)}}>
                                       {t.category.includes('Chuyển khoản') ? <ArrowRightLeft size={16}/> : t.type === 'INCOME' ? <ArrowUpRight size={16}/> : <ArrowDownLeft size={16}/>}
                                    </div>
                                    <div className="truncate">
                                       <p className="text-[11px] font-black text-[#1B2559] uppercase truncate">{t.note || t.category}</p>
                                       <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{utils.formatDisplayDate(t.date)} - {t.category}</p>
                                    </div>
                                 </div>
                                 <span className={`text-xs font-black whitespace-nowrap ${t.type === 'INCOME' ? 'text-[#05CD99]' : 'text-[#EE5D50]'}`}>{t.type === 'INCOME' ? '+' : '-'}{utils.formatVND(t.amount)}</span>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               </div>

               {/* Ngân sách */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-8">Tiến độ Ngân sách T{selectedMonth + 1}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {logic.budgetProgress.map(b => (
                        <div key={b.id} className="bg-[#F8F9FA] p-5 rounded-[24px] border border-transparent hover:border-gray-200 transition-all">
                           <div className="flex justify-between items-end mb-3">
                              <div>
                                 <p className="text-xs font-black text-[#1B2559] uppercase flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: logic.getCategoryColor(b.category)}}></span>
                                    {b.category}
                                 </p>
                                 <p className="text-[10px] font-bold text-gray-400 mt-1">Hạn mức: {utils.formatVND(b.amount)}</p>
                              </div>
                              <div className="text-right">
                                 <span className={`text-base font-black ${b.percent >= 90 ? 'text-[#EE5D50]' : 'text-[#1B2559]'}`}>{utils.formatVND(b.currentSpent)}</span>
                                 <p className="text-[10px] font-black text-gray-400 mt-0.5">Đã dùng {b.percent.toFixed(0)}%</p>
                              </div>
                           </div>
                           <ProgressBar value={b.currentSpent} max={b.amount} color={b.statusColor} height="h-2.5" />
                        </div>
                     ))}
                     {budgets.length === 0 && (
                        <>
                           <DashboardBudgetPlaceholderCard category="Danh mục mẫu" />
                           <DashboardBudgetPlaceholderCard category="Hạn mức tháng" />
                           <div className="col-span-2 py-10 px-6 flex flex-col items-center justify-center text-center rounded-[24px] border border-dashed border-gray-200 bg-[#F8F9FA]">
                              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#4318FF] mb-3 border border-indigo-50 shadow-sm">
                                 <Wallet size={22} strokeWidth={1.75} />
                              </div>
                              <p className="text-xs font-black text-[#1B2559] uppercase tracking-widest">Chưa có ngân sách</p>
                              <p className="text-[10px] font-bold text-gray-400 mt-2 max-w-md">
                                 Vào Cài đặt → Ngân sách để thiết lập hạn mức theo từng danh mục chi tiêu.
                              </p>
                              <DashboardSetupButton onClick={openBudgetSettings}>Thiết lập ngân sách</DashboardSetupButton>
                           </div>
                        </>
                     )}
                  </div>
               </div>
            </div>
  );
}
