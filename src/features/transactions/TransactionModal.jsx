import { X } from 'lucide-react';
import utils from '../../utils/format.js';

export default function TransactionModal(props) {
  const {
    editingTxId,
    formData,
    setFormData,
    categories,
    wallets,
    useLinkedWallet,
    setUseLinkedWallet,
    handleCloseModal,
    onSaveTransaction,
  } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111C44]/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 sm:p-8 border border-gray-100 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto custom-scrollbar overscroll-contain flex flex-col">

        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h3 className="text-xs font-black text-[#1B2559] uppercase tracking-widest italic">
            {editingTxId ? 'Cập nhật giao dịch' : formData.type === 'INCOME' ? 'Thêm thu nhập' : formData.type === 'EXPENSE' ? 'Ghi khoản chi' : 'Chuyển khoản nội bộ'}
          </h3>
          <button onClick={handleCloseModal} className="p-2.5 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-all"><X size={18}/></button>
        </div>

        {!editingTxId && (
          <div className="flex bg-[#F4F7FE] p-1.5 rounded-[16px] mb-6">
            <button onClick={() => setFormData({...formData, type: 'INCOME', category: categories?.INCOME?.[0] || ''})} className={`flex-1 py-2.5 rounded-[12px] text-[9px] font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-white shadow text-[#05CD99]' : 'text-gray-400'}`}>Thu</button>
            <button onClick={() => setFormData({...formData, type: 'EXPENSE', category: categories?.EXPENSE?.[0] || ''})} className={`flex-1 py-2.5 rounded-[12px] text-[9px] font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-white shadow text-[#EE5D50]' : 'text-gray-400'}`}>Chi</button>
            <button onClick={() => setFormData({...formData, type: 'TRANSFER', category: ''})} className={`flex-1 py-2.5 rounded-[12px] text-[9px] font-black uppercase tracking-widest transition-all ${formData.type === 'TRANSFER' ? 'bg-white shadow text-[#4318FF]' : 'text-gray-400'}`}>Chuyển</button>
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Số tiền (VND)</label>
            <div className="relative">
              <input type="text" inputMode="numeric" className="w-full h-14 bg-[#F4F7FE] rounded-2xl px-6 text-3xl font-black text-[#2B3674] outline-none border-2 border-transparent focus:border-[#4318FF]/20 transition-all" placeholder="0" autoFocus value={utils.formatInputNumber(formData.amount)} onChange={e => setFormData({...formData, amount: utils.parseInputNumber(e.target.value)})} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Nội dung</label>
            <input type="text" className="w-full p-4 bg-[#F4F7FE] rounded-2xl font-black text-xs text-[#2B3674] outline-none border-2 border-transparent focus:border-[#4318FF]/20" placeholder="Mua sắm, ăn sáng..." value={formData.note || ''} onChange={e => setFormData({...formData, note: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{formData.type === 'TRANSFER' ? 'Từ ví' : 'Nguồn tiền'}</label>
              <select className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none cursor-pointer border-2 border-transparent focus:border-[#4318FF]/20" value={formData.wallet || wallets[0]} onChange={e => setFormData({...formData, wallet: e.target.value})}>
                {(wallets || []).map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            {formData.type === 'TRANSFER' ? (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Đến ví</label>
                <select className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none cursor-pointer border-2 border-transparent focus:border-[#4318FF]/20" value={formData.toWallet || ''} onChange={e => setFormData({...formData, toWallet: e.target.value})}>
                  <option value="">Chọn...</option>
                  {(wallets || []).filter(w => w !== formData.wallet).map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Danh mục</label>
                <select className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none cursor-pointer border-2 border-transparent focus:border-[#4318FF]/20" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})}>
                  {(categories[formData.type === 'INCOME' ? 'INCOME' : 'EXPENSE'] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {formData.type === 'EXPENSE' && (
            <div className="space-y-2 bg-[#F4F7FE] p-3 rounded-2xl border border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-[#4318FF] focus:ring-0" checked={useLinkedWallet} onChange={(e) => setUseLinkedWallet(e.target.checked)} />
                <span className="text-[10px] font-bold text-[#1B2559] uppercase">Trừ tiền thực tế từ nguồn khác?</span>
              </label>
              {useLinkedWallet && (
                <div className="pl-6 pt-1 animate-in slide-in-from-top-1">
                  <p className="text-[9px] text-gray-400 mb-1 italic">Chọn ví để trừ tiền thực tế:</p>
                  <select className="w-full p-3 bg-white rounded-xl text-[10px] font-black outline-none border-2 border-transparent focus:border-[#4318FF]/20" value={formData.linkedWallet || ''} onChange={e => setFormData({...formData, linkedWallet: e.target.value})}>
                    <option value="">Chọn...</option>
                    {(wallets || []).filter(w => w !== formData.wallet).map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Thời gian</label>
            <input type="date" className="w-full p-4 bg-[#F4F7FE] rounded-2xl text-[10px] font-black outline-none border-2 border-transparent focus:border-[#4318FF]/20" value={formData.date || utils.getLocalYMD()} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>

          <button onClick={onSaveTransaction} className={`w-full py-5 rounded-2xl font-black text-[10px] text-white shadow-xl uppercase tracking-[0.3em] active:scale-95 transition-all mt-4 ${editingTxId ? 'bg-[#05CD99]' : formData.type === 'INCOME' ? 'bg-[#05CD99]' : formData.type === 'EXPENSE' ? 'bg-[#EE5D50]' : 'bg-[#4318FF]'}`}>
            {editingTxId ? 'Lưu thay đổi' : 'Xác nhận giao dịch'}
          </button>
        </div>
      </div>
    </div>
  );
}
