import { Zap, Plus, Settings } from 'lucide-react';

export default function AppHeader(props) {
  const {
    greeting,
    syncCode,
    activeTab,
    setActiveTab,
    setActiveSettingTab,
    wallets,
    categories,
    setEditingTxId,
    setModalType,
    setFormData,
    setShowModal,
  } = props;

  return (
    <div className="flex justify-between items-center py-4 gap-4">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 bg-[#4318FF] rounded-[14px] flex items-center justify-center text-white shadow-xl shadow-indigo-100 relative">
          <Zap size={22} fill="white" />
          {syncCode && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#05CD99] border-2 border-white rounded-full animate-pulse" title="Đang đồng bộ"></div>}
        </div>
        <div>
          <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Finance<span className="text-[#4318FF]">Hub</span></h1>
          <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-widest uppercase">{greeting} 👋</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button onClick={() => { setEditingTxId(null); setModalType('TRANSACTION'); setFormData({ type: 'INCOME', wallet: wallets?.[0] || '', category: categories?.INCOME?.[0] || '' }); setShowModal(true); }} className="bg-[#05CD99] text-white px-4 md:px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation"><Plus size={14} strokeWidth={3}/> <span className="hidden sm:inline">Thu</span></button>
        <button onClick={() => { setEditingTxId(null); setModalType('TRANSACTION'); setFormData({ type: 'EXPENSE', wallet: wallets?.[0] || '', category: categories?.EXPENSE?.[0] || '' }); setShowModal(true); }} className="bg-[#EE5D50] text-white px-4 md:px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation"><Plus size={14} strokeWidth={3}/> <span className="hidden sm:inline">Chi</span></button>
        <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
        <button onClick={() => {setActiveTab('settings'); setActiveSettingTab('sync');}} className={`p-2.5 rounded-full transition-all relative touch-manipulation ${activeTab === 'settings' ? 'bg-[#4318FF] text-white shadow-xl shadow-indigo-100 scale-105' : 'bg-[#F4F7FE] text-[#A3AED0] hover:text-[#4318FF]'}`}>
          <Settings size={20} />
          {syncCode && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#05CD99] rounded-full border-2 border-white"></span>}
        </button>
      </div>
    </div>
  );
}
