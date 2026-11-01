import {
  ArrowRightLeft, Search, FileDown, Upload, Download, Loader2, Filter, Link2, Edit2, Trash2
} from 'lucide-react';
import utils from '../../utils/format.js';

export default function TransactionsView(props) {
  const {
    logic,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterWallet,
    setFilterWallet,
    filterCategory,
    setFilterCategory,
    wallets,
    categories,
    isProcessing,
    handleDownloadSampleCSV,
    handleImportCSV,
    handleExportCSV,
    handleEditTransaction,
    dbActions,
  } = props;

  return (
            <div className="space-y-6 animate-in fade-in">
               <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
                     <div>
                        <h3 className="text-xl font-black text-[#1B2559] uppercase tracking-tighter italic flex items-center gap-3">
                           <ArrowRightLeft className="text-[#4318FF]"/> Nhật ký giao dịch
                        </h3>
                     </div>
                     <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch">
                        <div className="flex items-center gap-3 bg-[#F4F7FE] rounded-2xl px-5 py-3 border border-gray-100 shadow-inner">
                           <select className="bg-transparent text-xs font-black outline-none cursor-pointer uppercase tracking-widest" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                              {Array.from({length: 12}, (_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
                           </select>
                           <select className="bg-transparent text-xs font-black outline-none cursor-pointer tracking-widest" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                              {utils.getRelativeYears(selectedYear).map(y => <option key={y} value={y}>{y}</option>)}
                           </select>
                        </div>
                        <div className="relative flex-1 md:w-64">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                           <input type="text" placeholder={`Tìm trong T${selectedMonth + 1}...`} className="pl-12 pr-6 py-3 bg-[#F4F7FE] rounded-2xl text-xs font-black w-full outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                        </div>
                        
                        <div className="flex gap-2">
                           <button onClick={handleDownloadSampleCSV} className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-[#1B2559] px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 shadow-sm transition-all flex-shrink-0" title="Tải file Mẫu Excel">
                              <FileDown size={16}/> Mẫu
                           </button>
                           <label className="flex items-center justify-center gap-1.5 bg-[#4318FF] text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-lg shadow-indigo-100 transition-all cursor-pointer flex-shrink-0" title="Nhập dữ liệu từ file Excel (CSV)">
                              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16}/> Nhập</>}
                              <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={isProcessing}/>
                           </label>
                           <button onClick={handleExportCSV} className="flex items-center justify-center gap-1.5 bg-[#1B2559] text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#111C44] shadow-lg shadow-indigo-100 transition-all flex-shrink-0" title="Xuất dữ liệu">
                              <Download size={16}/> Xuất
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* BỘ LỌC THÔNG MINH */}
                  <div className="flex flex-wrap items-center gap-3 mb-8 bg-[#F8F9FA] p-3 rounded-2xl border border-gray-100">
                     <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">
                        <Filter size={14} /> Lọc theo:
                     </div>
                     <select className="bg-white px-4 py-2.5 rounded-xl text-xs font-black outline-none border border-gray-100 shadow-sm text-[#1B2559] cursor-pointer" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="ALL">Tất cả giao dịch</option>
                        <option value="INCOME">Chỉ khoản Thu</option>
                        <option value="EXPENSE">Chỉ khoản Chi</option>
                     </select>
                     <select className="bg-white px-4 py-2.5 rounded-xl text-xs font-black outline-none border border-gray-100 shadow-sm text-[#1B2559] cursor-pointer max-w-[150px] truncate" value={filterWallet} onChange={e => setFilterWallet(e.target.value)}>
                        <option value="ALL">Tất cả Ví / Nguồn</option>
                        {(wallets || []).map(w => <option key={w} value={w}>{w}</option>)}
                     </select>
                     <select className="bg-white px-4 py-2.5 rounded-xl text-xs font-black outline-none border border-gray-100 shadow-sm text-[#1B2559] cursor-pointer max-w-[150px] truncate" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="ALL">Tất cả Danh mục</option>
                        {filterType === 'INCOME' && (categories?.INCOME || []).map(c => <option key={c} value={c}>{c}</option>)}
                        {filterType === 'EXPENSE' && (categories?.EXPENSE || []).map(c => <option key={c} value={c}>{c}</option>)}
                        {filterType === 'ALL' && [...(categories?.INCOME || []), ...(categories?.EXPENSE || [])].map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     {(filterType !== 'ALL' || filterWallet !== 'ALL' || filterCategory !== 'ALL') && (
                        <button onClick={() => { setFilterType('ALL'); setFilterWallet('ALL'); setFilterCategory('ALL'); }} className="text-[10px] font-black text-[#EE5D50] hover:bg-red-50 px-4 py-2.5 rounded-xl transition-all ml-auto">
                           XÓA LỌC BỎ
                        </button>
                     )}
                  </div>
                  
                  <div className="overflow-x-auto">
                     <table className="w-full text-xs">
                        <thead className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 text-left">
                           <tr>
                              <th className="pb-5 pl-4">Thời gian</th>
                              <th className="pb-5">Nội dung</th>
                              <th className="pb-5 text-center">Danh mục</th>
                              <th className="pb-5 text-center">Nguồn</th>
                              <th className="pb-5 text-right pr-4">Số tiền</th>
                              <th className="pb-5 text-center"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {logic.filteredTransactions.map(t => (
                              <tr key={t.id} className="hover:bg-gray-50/80 transition-all group">
                                 <td className="py-5 pl-4 font-black text-gray-400 italic tabular-nums">{utils.formatDisplayDate(t.date)}</td>
                                 <td className="py-5 font-black text-[#1B2559] uppercase tracking-tight text-sm">{t.note}</td>
                                 <td className="py-5 text-center">
                                    <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-100 bg-white shadow-sm" style={{ color: logic.getCategoryColor(t.category) }}>
                                       {t.category}
                                    </span>
                                 </td>
                                 <td className="py-5 text-center font-black text-[#1B2559] uppercase text-[10px] tracking-tighter">
                                    {t.linkedWallet ? <span className="flex items-center justify-center gap-1"><Link2 size={10} className="text-[#4318FF]"/>{t.linkedWallet}</span> : t.wallet}
                                 </td>
                                 <td className={`py-5 text-right pr-4 font-black text-base tabular-nums ${t.type === 'INCOME' ? 'text-[#05CD99]' : 'text-[#EE5D50]'}`}>
                                    {t.type === 'INCOME' ? '+' : '-'}{utils.formatVND(t.amount)}
                                 </td>
                                 <td className="py-5 text-center">
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button onClick={() => handleEditTransaction(t)} className="p-2 text-[#4318FF] hover:bg-white rounded-xl shadow-sm"><Edit2 size={14}/></button>
                                       <button onClick={() => dbActions.deleteItem('transactions', t.id, t)} className="p-2 text-[#EE5D50] hover:bg-white rounded-xl shadow-sm"><Trash2 size={14}/></button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                     {logic.filteredTransactions.length === 0 && (
                        <div className="py-10 text-center text-xs font-black text-gray-400 uppercase tracking-widest opacity-50">Không tìm thấy giao dịch nào phù hợp</div>
                     )}
                  </div>
               </div>
            </div>
  );
}
