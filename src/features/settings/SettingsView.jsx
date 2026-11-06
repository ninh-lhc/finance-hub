import {
  Link2, Target, Wallet, List, PiggyBank, Loader2, Sparkles, Trash2, Cloud, Laptop, Smartphone,
  Save, Plus, Edit2, RotateCcw, Landmark
} from 'lucide-react';
import GoogleUpgradeButton from '../../components/GoogleUpgradeButton.jsx';
import DataSourceDiagnostics from './DataSourceDiagnostics.jsx';
import LegacySyncMigrationPanel from './LegacySyncMigrationPanel.jsx';
import utils from '../../utils/format.js';

export default function SettingsView(props) {
  const {
    activeSettingTab,
    setActiveSettingTab,
    cancelEdit,
    auth,
    user,
    showToast,
    isProcessing,
    syncCode,
    setSyncCode,
    inputSyncCode,
    setInputSyncCode,
    dbActions,
    settingsForm,
    setSettingsForm,
    editingId,
    setEditingId,
    budgets,
    wallets,
    walletBalances,
    categories,
    goals,
    logic,
    handleSaveBudget,
    handleSaveWallet,
    handleDeleteWallet,
    handleSaveCategory,
    handleDeleteCategory,
    handleSaveGoal,
    resetWalletBalance,
    dataSourceDiagnostics,
    legacyMigrationReadiness,
    legacyMigrationInspection,
    isInspectingLegacyMigration,
    onInspectLegacyMigration,
    authInitialized,
  } = props;

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in">
      <div className="w-full lg:w-56 flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
        {[{id: 'sync', icon: Link2, label: 'ĐỒNG BỘ'}, {id: 'budget', icon: Target, label: 'NGÂN SÁCH'}, {id: 'wallet', icon: Wallet, label: 'VÍ TIỀN'}, {id: 'category', icon: List, label: 'DANH MỤC'}, {id: 'goal', icon: PiggyBank, label: 'MỤC TIÊU'}].map(item => (
          <button key={item.id} onClick={() => { setActiveSettingTab(item.id); cancelEdit(); }} className={`flex items-center justify-center lg:justify-start gap-3 px-5 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${activeSettingTab === item.id ? 'bg-[#4318FF] text-white shadow-xl scale-105' : 'bg-white text-[#A3AED0] hover:text-[#4318FF] border border-gray-50'}`}>
            <item.icon size={16}/>{item.label}
          </button>
        ))}
      </div>
      <div className="flex-1 bg-white rounded-[32px] p-6 lg:p-10 shadow-sm border border-gray-100 min-h-[500px]">
        {activeSettingTab === 'sync' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Đồng bộ đa thiết bị</h3><p className="text-[10px] text-gray-400 font-bold uppercase italic">Dùng chung dữ liệu mà không cần tạo tài khoản mật khẩu</p></div>

            <DataSourceDiagnostics diagnostics={dataSourceDiagnostics} />

            <LegacySyncMigrationPanel
              readiness={legacyMigrationReadiness}
              legacyMigrationInspection={legacyMigrationInspection}
              isInspectingLegacyMigration={isInspectingLegacyMigration}
              onInspect={onInspectLegacyMigration}
            />

            <GoogleUpgradeButton auth={auth} user={user} authInitialized={authInitialized} onToast={showToast} disabled={isProcessing} />

            <div className="p-6 bg-indigo-50/50 rounded-[24px] border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-[#1B2559] uppercase">Dữ liệu thử nghiệm</h4>
                <p className="text-xs text-gray-500 mt-1">Nạp các giao dịch mẫu năm 2025 để kiểm tra tính năng biểu đồ.</p>
              </div>
              <button onClick={dbActions.generateSampleData} disabled={isProcessing} className="py-3 px-6 bg-[#4318FF] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap">
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={16}/> NẠP MẪU</>}
              </button>
            </div>

            <div className="p-6 bg-red-50/50 rounded-[24px] border border-red-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-[#1B2559] uppercase">Xóa dữ liệu mẫu</h4>
                <p className="text-xs text-gray-500 mt-1">Dọn dẹp sạch sẽ toàn bộ các giao dịch thử nghiệm.</p>
              </div>
              <button onClick={dbActions.clearSampleData} disabled={isProcessing} className="py-3 px-6 bg-[#EE5D50] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap">
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16}/> XÓA SẠCH</>}
              </button>
            </div>

            {syncCode ? (
              <div className="bg-[#111C44] rounded-[32px] p-10 text-center relative overflow-hidden shadow-2xl">
                <Cloud size={48} className="text-[#05CD99] mx-auto mb-4" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Mã phòng hiện tại</p>
                <div className="text-4xl md:text-5xl font-black text-white tracking-[0.2em] my-6 bg-white/10 py-4 px-8 rounded-3xl inline-block border border-white/20">{syncCode}</div>
                <p className="text-[11px] text-gray-300 font-medium max-w-sm mx-auto mb-8">Hãy nhập mã này trên thiết bị khác để dùng chung dữ liệu.</p>
                <button onClick={() => { localStorage.removeItem('finance_hub_sync_code'); setSyncCode(''); showToast('Đã ngắt kết nối đồng bộ', 'success'); }} className="text-red-400 hover:text-white border border-red-400/20 px-6 py-3 rounded-2xl text-[9px] font-black uppercase">Ngắt kết nối phòng</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#F8F9FA] rounded-[32px] p-8 border border-gray-100 flex flex-col justify-between">
                  <div><Laptop size={24} className="text-[#4318FF] mb-4"/><h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-3">Tạo mới mã phòng</h4><p className="text-xs text-gray-500 mb-6 leading-relaxed">Hệ thống sẽ tải toàn bộ lịch sử 5 năm lên Đám mây để các thiết bị khác tải về.</p></div>
                  <button onClick={dbActions.enableCloudSync} disabled={isProcessing} className="w-full py-4 bg-[#4318FF] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><Cloud size={16}/> TẠO MÃ ĐỒNG BỘ</>}</button>
                </div>
                <div className="bg-[#F8F9FA] rounded-[32px] p-8 border border-gray-100 flex flex-col justify-between">
                  <div><Smartphone size={24} className="text-[#05CD99] mb-4"/><h4 className="text-sm font-black text-[#1B2559] uppercase tracking-widest mb-3">Kết nối mã có sẵn</h4><p className="text-xs text-gray-500 mb-6 leading-relaxed">Nếu bạn đã có mã phòng từ máy tính, hãy nhập vào đây để đồng bộ ngay lập tức.</p></div>
                  <div><input type="text" placeholder="Nhập mã phòng..." className="w-full p-4 mb-3 bg-white rounded-2xl font-black text-center uppercase tracking-[0.2em] outline-none text-[#1B2559]" value={inputSyncCode} onChange={(e) => setInputSyncCode(e.target.value)} maxLength={6} /><button onClick={dbActions.joinCloudSync} className="w-full py-4 bg-[#05CD99] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">KẾT NỐI NGAY</button></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSettingTab === 'budget' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Quản lý Ngân sách</h3><p className="text-[10px] text-gray-400 font-bold uppercase italic">Thiết lập hạn mức chi tiêu để kiểm soát tài chính tốt hơn</p></div>
            <div className="flex flex-col md:flex-row gap-4 p-5 bg-[#F8F9FA] rounded-[24px] border border-gray-100">
              <select className="bg-transparent font-black text-[#1B2559] outline-none flex-1 text-xs py-2" value={settingsForm.budgetCategory} onChange={(e) => setSettingsForm({...settingsForm, budgetCategory: e.target.value})}>
                <option value="">Chọn danh mục...</option>
                {(categories?.EXPENSE || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="text" inputMode="numeric" placeholder="Số tiền tối đa..." className="bg-transparent font-black text-[#1B2559] outline-none w-full md:w-48 text-xs border-l-2 border-gray-100 pl-4 py-2" value={utils.formatInputNumber(settingsForm.budgetAmount)} onChange={(e) => setSettingsForm({...settingsForm, budgetAmount: utils.parseInputNumber(e.target.value)})} />
              <button onClick={handleSaveBudget} className={`w-full md:w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all ${editingId ? 'bg-[#05CD99]' : 'bg-[#4318FF]'}`}>
                {editingId ? <Save size={20}/> : <Plus size={20}/>}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgets.map(b => (
                <div key={b.id} className="p-6 bg-[#F8F9FA] rounded-[24px] flex justify-between items-center border border-transparent hover:border-indigo-100">
                  <div className="space-y-1"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{b.category}</p><p className="font-black text-[#1B2559] text-base">{utils.formatVND(b.amount)}</p></div>
                  <div className="flex gap-2"><button onClick={() => { setEditingId(b.id); setSettingsForm({...settingsForm, budgetCategory: b.category, budgetAmount: b.amount}); }} className="text-gray-400 hover:text-[#4318FF]"><Edit2 size={16}/></button><button onClick={() => dbActions.deleteItem('budgets', b.id)} className="text-gray-400 hover:text-[#EE5D50]"><Trash2 size={16}/></button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSettingTab === 'wallet' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Danh sách Ví & Tài khoản</h3></div>

            <div className="flex flex-col sm:flex-row gap-4 p-5 bg-indigo-50/50 rounded-[24px] border border-indigo-100 items-start sm:items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black text-[#1B2559] uppercase">Đồng bộ & Tính toán lại</h4>
                <p className="text-[10px] text-gray-500 mt-1">Quét toàn bộ lịch sử 5 năm để sửa lỗi lệch số dư ví (nếu có).</p>
              </div>
              <button onClick={dbActions.recalculateAllBalances} disabled={isProcessing} className="px-6 py-3 bg-[#4318FF] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 transition-transform active:scale-95 flex items-center gap-2 whitespace-nowrap">
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <><RotateCcw size={16}/> SỬA LỖI SỐ DƯ</>}
              </button>
            </div>

            <div className="flex gap-4 p-5 bg-[#F8F9FA] rounded-[24px] border border-gray-100">
              <input type="text" placeholder="Tên ví mới (VD: Ví Momo, Techcombank...)" className="bg-transparent font-black text-[#1B2559] outline-none flex-1 text-xs" value={settingsForm.walletName} onChange={(e) => setSettingsForm({...settingsForm, walletName: e.target.value})} />
              <button onClick={handleSaveWallet} className="w-12 h-12 bg-[#4318FF] rounded-xl flex items-center justify-center text-white shadow-xl transition-all"><Plus size={20}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(wallets || []).map((w, i) => (
                <div key={i} className="p-6 bg-[#F8F9FA] rounded-[24px] flex justify-between items-center border border-transparent hover:border-indigo-100">
                  <div className="flex items-center gap-4 min-w-0"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-[#1B2559] shrink-0"><Landmark size={20}/></div><div className="min-w-0"><h4 className="text-xs font-black text-[#1B2559] uppercase">{w}</h4><p className="text-[10px] font-bold text-gray-400">{utils.formatVND(walletBalances[w] || 0)}</p>{(goals || []).filter((goal) => goal.wallet === w).length > 0 && <p className="text-[9px] font-bold text-[#FFA800] mt-1">Khóa {(goals || []).filter((goal) => goal.wallet === w).map((goal) => `${goal.name} ${utils.formatVND(goal.amount)}`).join(' · ')}</p>}</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => resetWalletBalance(w)} title="Reset về 0đ" className="text-gray-400 hover:text-[#05CD99] p-2 rounded-xl transition-all"><RotateCcw size={16}/></button>
                    <button onClick={() => { setEditingId(i); setSettingsForm({...settingsForm, walletName: w}); }} className="text-gray-400 hover:text-[#4318FF] p-2 rounded-xl transition-all"><Edit2 size={16}/></button>
                    <button type="button" aria-label={`Xóa ${w}`} onClick={() => handleDeleteWallet(i)} className="text-gray-400 hover:text-[#EE5D50] p-2 rounded-xl transition-all"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSettingTab === 'category' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Phân loại Danh mục</h3>
              <div className="flex bg-[#F8F9FA] p-1 rounded-xl">
                <button type="button" onClick={() => { setEditingId(null); setSettingsForm({...settingsForm, categoryType: 'INCOME', categoryName: ''}); }} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${settingsForm.categoryType === 'INCOME' ? 'bg-white text-[#05CD99] shadow-sm' : 'text-gray-400'}`}>THU</button>
                <button type="button" onClick={() => { setEditingId(null); setSettingsForm({...settingsForm, categoryType: 'EXPENSE', categoryName: ''}); }} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${settingsForm.categoryType === 'EXPENSE' ? 'bg-white text-[#EE5D50] shadow-sm' : 'text-gray-400'}`}>CHI</button>
              </div>
            </div>
            <div className="flex gap-4 p-5 bg-[#F8F9FA] rounded-[24px] border border-gray-100">
              <input type="text" placeholder="Nhập tên hạng mục..." className="bg-transparent font-black text-[#1B2559] outline-none flex-1 text-xs min-w-0" value={settingsForm.categoryName} onChange={(e) => setSettingsForm({...settingsForm, categoryName: e.target.value})} />
              {editingId !== null && (
                <button type="button" onClick={() => { setEditingId(null); setSettingsForm({...settingsForm, categoryName: ''}); }} className="px-4 py-3 bg-white text-[#A3AED0] rounded-xl text-[10px] font-black border border-gray-100">HỦY</button>
              )}
              <button type="button" onClick={handleSaveCategory} className="px-6 sm:px-8 py-3 bg-[#1B2559] text-white rounded-xl text-[10px] font-black shadow-lg shrink-0">{editingId !== null ? 'CẬP NHẬT' : 'LƯU'}</button>
            </div>
            <div className="flex flex-wrap gap-3">
              {(categories[settingsForm.categoryType] || []).map((cat, i) => (
                <div key={`${settingsForm.categoryType}-${i}`} className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2 ${editingId === i ? 'bg-white border-[#4318FF]' : 'bg-[#F8F9FA] border-gray-100'}`}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: logic.getCategoryColor(cat)}}></span>
                  <span className="text-xs font-black text-[#111C44] uppercase tracking-tighter">{cat}</span>
                  <button type="button" aria-label={`Sửa ${cat}`} onClick={() => { setEditingId(i); setSettingsForm({...settingsForm, categoryName: cat}); }} className="p-1.5 text-[#4318FF] bg-white rounded-lg"><Edit2 size={12}/></button>
                  <button type="button" aria-label={`Xóa ${cat}`} onClick={() => handleDeleteCategory(i)} className="p-1.5 text-[#EE5D50] bg-white rounded-lg"><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSettingTab === 'goal' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-1"><h3 className="text-base font-black uppercase tracking-widest text-[#1B2559]">Ước mơ & Tích lũy</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-[#F8F9FA] rounded-[32px]">
              <input type="text" placeholder="Tên mục tiêu..." className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs" value={settingsForm.goalName} onChange={(e) => setSettingsForm({...settingsForm, goalName: e.target.value})} />
              <input type="text" inputMode="numeric" placeholder="Đã tích lũy..." className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs" value={utils.formatInputNumber(settingsForm.goalCurrentAmount)} onChange={(e) => setSettingsForm({...settingsForm, goalCurrentAmount: utils.parseInputNumber(e.target.value)})} />
              <input type="text" inputMode="numeric" placeholder="Số tiền đích..." className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs" value={utils.formatInputNumber(settingsForm.goalAmount)} onChange={(e) => setSettingsForm({...settingsForm, goalAmount: utils.parseInputNumber(e.target.value)})} />
              <select className="p-4 bg-white rounded-2xl font-black text-[#1B2559] outline-none text-xs md:col-span-3" value={settingsForm.goalWallet || ''} onChange={(e) => setSettingsForm({...settingsForm, goalWallet: e.target.value})}>
                <option value="">Chọn ví đang giữ số tiền này</option>
                {(wallets || []).map((wallet) => <option key={wallet} value={wallet}>{wallet}</option>)}
              </select>
              <button onClick={handleSaveGoal} className="col-span-1 md:col-span-3 py-4 bg-[#FFA800] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-100">Xác nhận kế hoạch</button>
            </div>
            <div className="space-y-4">
              {goals.map(g => (
                <div key={g.id} className="p-8 bg-[#F8F9FA] rounded-[32px] flex justify-between items-center hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-[#1B2559] italic tracking-tighter uppercase">{g.name}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold tracking-widest mt-1">
                      <span className="text-[#05CD99]">CÓ: {utils.formatVND(g.amount)}</span>
                      <span className="text-gray-400">ĐÍCH: {utils.formatVND(g.target)}</span>
                      <span className="text-[#4318FF]">{g.wallet ? `VÍ: ${g.wallet}` : 'CHƯA GẮN VÍ'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(g.id); setSettingsForm({...settingsForm, goalName: g.name, goalAmount: g.target, goalCurrentAmount: g.amount, goalWallet: g.wallet || ''}); }} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-[#4318FF] shadow-sm"><Edit2 size={18}/></button>
                    <button onClick={() => dbActions.deleteItem('goals', g.id)} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-[#EE5D50] shadow-sm"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
