import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast?.show) return null;

  return (
    <div className={`fixed top-5 right-5 z-[60] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-5 fade-in duration-300 ${toast.type === 'warning' || toast.type === 'error' ? 'bg-[#EE5D50] text-white' : 'bg-[#05CD99] text-white'}`}>
      {toast.type === 'warning' || toast.type === 'error' ? <AlertTriangle size={20}/> : <CheckCircle2 size={20}/>}
      <span className="text-xs font-black tracking-wide">{toast.message}</span>
    </div>
  );
}
