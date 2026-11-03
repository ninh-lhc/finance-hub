import { AlertTriangle, Info, Loader2, ScanSearch } from 'lucide-react';

function BlockerMessage({ blockers }) {
  if (!blockers?.length) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs font-bold text-amber-900 space-y-1">
      {blockers.map((b) => (
        <p key={b.code}>{b.message}</p>
      ))}
    </div>
  );
}

function CountRow({ label, source, target, conflicts }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 py-2 border-b border-gray-100 last:border-0">
      <dt className="text-[10px] font-black uppercase tracking-widest text-[#A3AED0]">{label}</dt>
      <dd className="text-xs font-bold text-[#1B2559] sm:text-right tabular-nums">
        Nguồn cũ: {source} · UID: {target}
        {typeof conflicts === 'number' && conflicts > 0 ? (
          <span className="text-[#EE5D50] ml-2">({conflicts} xung đột ID)</span>
        ) : null}
      </dd>
    </div>
  );
}

export default function LegacySyncMigrationPanel({
  readiness,
  legacyMigrationInspection,
  isInspectingLegacyMigration,
  onInspect,
}) {
  const ready = readiness?.ready === true;
  const blockers = readiness?.blockers ?? [];
  const summary = legacyMigrationInspection?.summary;
  const inspectionError = legacyMigrationInspection?.error === true;

  return (
    <section
      className="rounded-[24px] border border-gray-100 bg-[#F8F9FA] p-6 lg:p-8 space-y-4"
      aria-labelledby="legacy-migration-dry-run-heading"
    >
      <div className="space-y-1">
        <h4
          id="legacy-migration-dry-run-heading"
          className="text-sm font-black uppercase tracking-widest text-[#1B2559]"
        >
          Kiểm tra migration (chỉ đọc)
        </h4>
        <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
          So sánh phòng đồng bộ công khai (legacy) với dữ liệu UID Google — không sao chép, ghi đè
          hoặc xóa.
        </p>
      </div>

      {!ready && <BlockerMessage blockers={blockers} />}

      {ready && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 font-bold">
            Không có dữ liệu nào được sao chép, ghi đè hoặc xóa.
          </p>
          <button
            type="button"
            onClick={onInspect}
            disabled={isInspectingLegacyMigration}
            className="py-3 px-6 bg-[#1B2559] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
          >
            {isInspectingLegacyMigration ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Đang kiểm tra…
              </>
            ) : (
              <>
                <ScanSearch size={16} />
                Kiểm tra dữ liệu cũ (chỉ đọc)
              </>
            )}
          </button>
        </div>
      )}

      {inspectionError && (
        <div className="flex gap-2 rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-xs font-bold text-red-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            {legacyMigrationInspection.message ??
              'Không thể hoàn tất kiểm tra. Thử lại hoặc kiểm tra quyền truy cập Firestore.'}
          </p>
        </div>
      )}

      {summary && !inspectionError && (
        <div className="space-y-4 animate-in fade-in">
          <dl className="bg-white rounded-2xl px-4 py-2 border border-gray-50">
            <CountRow
              label="Giao dịch (phạm vi quét)"
              source={summary.sourceCounts.transactions}
              target={summary.targetCounts.transactions}
              conflicts={summary.conflictCounts.transactions}
            />
            <CountRow
              label="Mục tiêu"
              source={summary.sourceCounts.goals}
              target={summary.targetCounts.goals}
              conflicts={summary.conflictCounts.goals}
            />
            <CountRow
              label="Ngân sách"
              source={summary.sourceCounts.budgets}
              target={summary.targetCounts.budgets}
              conflicts={summary.conflictCounts.budgets}
            />
            <CountRow
              label="Cài đặt (general)"
              source={summary.sourceCounts.settingsExists ? 1 : 0}
              target={summary.targetCounts.settingsExists ? 1 : 0}
              conflicts={summary.conflictCounts.settings}
            />
            <div className="py-2 border-b border-gray-100">
              <dt className="text-[10px] font-black uppercase tracking-widest text-[#A3AED0]">
                Phạm vi quét
              </dt>
              <dd className="text-xs font-bold text-[#1B2559] mt-1">
                {summary.scanRange.yearStart} – {summary.scanRange.yearEnd} (
                {summary.scanRange.transactionCollectionCount} bộ sưu tập tháng)
              </dd>
            </div>
            <div className="py-2">
              <dt className="text-[10px] font-black uppercase tracking-widest text-[#A3AED0]">
                Khoảng ngày giao dịch
              </dt>
              <dd className="text-xs font-bold text-[#1B2559] mt-1">
                Nguồn cũ: {summary.dateRange.sourceEarliest ?? '—'} →{' '}
                {summary.dateRange.sourceLatest ?? '—'}
                <br />
                UID: {summary.dateRange.targetEarliest ?? '—'} →{' '}
                {summary.dateRange.targetLatest ?? '—'}
              </dd>
            </div>
          </dl>

          <div className="text-[10px] font-bold text-gray-500 space-y-1">
            <p>
              Tổng xung đột ID (ước lượng):{' '}
              <span className="text-[#1B2559]">{summary.conflictCounts.total}</span>
            </p>
            {summary.maskedUid && (
              <p>
                UID (đã che): <span className="text-[#1B2559]">{summary.maskedUid}</span>
              </p>
            )}
            {summary.maskedSyncCode && (
              <p>
                Mã phòng (đã che):{' '}
                <span className="text-[#1B2559]">{summary.maskedSyncCode}</span>
              </p>
            )}
            <p className="text-[#05CD99] uppercase tracking-widest">
              Chưa migration · Backup chưa thực hiện · Rules chưa deploy
            </p>
          </div>

          {summary.warnings?.length > 0 && (
            <ul className="space-y-2">
              {summary.warnings.map((w) => (
                <li
                  key={w}
                  className="flex gap-2 text-[10px] font-bold text-amber-800 bg-amber-50/80 border border-amber-100 rounded-xl px-3 py-2"
                >
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          {summary.notes?.length > 0 && (
            <ul className="space-y-1">
              {summary.notes.map((n) => (
                <li key={n} className="flex gap-2 text-[10px] font-bold text-gray-500">
                  <Info size={12} className="flex-shrink-0 mt-0.5" />
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
