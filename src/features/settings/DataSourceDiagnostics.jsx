import { AlertTriangle, Info } from 'lucide-react';

const AUTH_LABELS = {
  anonymous: 'Ẩn danh',
  google: 'Google',
  'authenticated-other': 'Khác',
  'not-authenticated': 'Chưa sẵn sàng',
};

const DATA_SOURCE_LABELS = {
  'legacy-public-sync': 'Phòng đồng bộ cũ (legacy public sync)',
  'uid-owned': 'Dữ liệu theo UID',
  'not-ready': 'Chưa sẵn sàng',
};

function DiagnosticRow({ label, value, valueClassName = '' }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 py-2 border-b border-gray-100 last:border-0">
      <dt className="text-[10px] font-black uppercase tracking-widest text-[#A3AED0]">{label}</dt>
      <dd className={`text-xs font-bold text-[#1B2559] sm:text-right ${valueClassName}`}>{value}</dd>
    </div>
  );
}

export default function DataSourceDiagnostics({ diagnostics }) {
  if (!diagnostics) {
    return null;
  }

  const {
    authMode,
    dataSourceMode,
    maskedUid,
    hasSyncCode,
    maskedSyncCode,
    selectedPeriod,
    loadedCounts,
    loadedWalletBalanceCount,
    warnings,
    notes,
  } = diagnostics;

  return (
    <section
      className="rounded-[24px] border border-gray-100 bg-[#F8F9FA] p-6 lg:p-8 space-y-4"
      aria-labelledby="data-source-diagnostics-heading"
    >
      <div className="space-y-1">
        <h4
          id="data-source-diagnostics-heading"
          className="text-sm font-black uppercase tracking-widest text-[#1B2559]"
        >
          Chẩn đoán dữ liệu và đồng bộ
        </h4>
        <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
          Công cụ này chỉ đọc trạng thái hiện tại, không sửa hoặc di chuyển dữ liệu.
        </p>
        <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
          Các con số dưới đây chỉ phản ánh dữ liệu đang được tải trên thiết bị này, không phải toàn bộ
          lịch sử.
        </p>
      </div>

      <dl className="bg-white rounded-2xl px-4 py-2 border border-gray-50">
        <DiagnosticRow label="Kiểu đăng nhập" value={AUTH_LABELS[authMode] ?? authMode} />
        <DiagnosticRow
          label="Nguồn dữ liệu (resolver)"
          value={DATA_SOURCE_LABELS[dataSourceMode] ?? dataSourceMode}
        />
        <DiagnosticRow label="UID (đã che)" value={maskedUid ?? '—'} />
        <DiagnosticRow label="Có mã đồng bộ" value={hasSyncCode ? 'Có' : 'Không'} />
        {hasSyncCode && (
          <DiagnosticRow label="Mã đồng bộ (đã che)" value={maskedSyncCode ?? '—'} />
        )}
        <DiagnosticRow label="Kỳ đang quan sát" value={selectedPeriod ?? '—'} />
        <DiagnosticRow
          label="Giao dịch (tháng đang tải)"
          value={String(loadedCounts.transactions)}
        />
        <DiagnosticRow label="Số ví" value={String(loadedCounts.wallets)} />
        <DiagnosticRow label="Số danh mục" value={String(loadedCounts.categories)} />
        <DiagnosticRow label="Số mục tiêu" value={String(loadedCounts.goals)} />
        <DiagnosticRow label="Số ngân sách" value={String(loadedCounts.budgets)} />
        <DiagnosticRow
          label="Ví có entry số dư"
          value={String(loadedWalletBalanceCount)}
        />
      </dl>

      {warnings.length > 0 && (
        <ul className="space-y-2" aria-label="Cảnh báo chẩn đoán">
          {warnings.map((text) => (
            <li
              key={text}
              className="flex gap-2 text-[11px] text-[#1B2559] font-medium leading-relaxed bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
            >
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <ul className="space-y-2" aria-label="Ghi chú chẩn đoán">
          {notes.map((text) => (
            <li
              key={text}
              className="flex gap-2 text-[11px] text-[#1B2559] font-medium leading-relaxed bg-indigo-50/60 border border-indigo-100 rounded-xl px-3 py-2"
            >
              <Info size={16} className="text-[#4318FF] shrink-0 mt-0.5" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
