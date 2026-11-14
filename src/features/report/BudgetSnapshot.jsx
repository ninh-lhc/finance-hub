import { Target } from 'lucide-react';
import utils from '../../utils/format.js';
import { buildBudgetSnapshot } from '../../logic/budgetSnapshot.js';

const STATUS = {
  left: { label: 'Còn', tone: '#157A45', detail: (item) => `Còn ${utils.formatVND(item.remaining)}` },
  used: { label: 'Hết', tone: '#B45309', detail: () => 'Đã hết hạn mức' },
  over: { label: 'Âm', tone: '#C2413C', detail: (item) => `Âm ${utils.formatVND(item.spent - item.limit)}` },
};

function movementPhrase(delta) {
  if (!delta) return 'Đang lấy';
  if (!delta.amount) return 'Bằng';
  if (delta.percent == null) return delta.amount > 0 ? 'Mới' : 'Không chi';
  const rounded = Math.round(Math.abs(delta.percent));
  return delta.amount > 0 ? `Tăng ${rounded}%` : `Giảm ${rounded}%`;
}

function movementDot(delta) {
  if (!delta || !delta.amount) return '#94A3B8';
  return delta.amount > 0 ? '#C2413C' : '#157A45';
}

function Verdict({ totals, hasTargets }) {
  if (!hasTargets) {
    return totals.openSpent > 0
      ? `Chưa đặt mục tiêu. Tháng này đã chi ${utils.formatVND(totals.openSpent)} ngoài hạn mức.`
      : 'Chưa đặt mục tiêu chi cho tháng này.';
  }
  if (totals.overCount > 0) {
    return `${totals.overCount} khoản đã âm ${utils.formatVND(totals.overAmount)}.`;
  }
  if (totals.usedCount > 0 && totals.leftCount === 0) return 'Mọi mục tiêu đã dùng hết.';
  if (totals.leftCount > 0 && totals.usedCount === 0) return `Còn ${utils.formatVND(totals.leftAmount)} trong các mục tiêu.`;
  return `${totals.leftCount} khoản còn dư, ${totals.usedCount} khoản đã hết.`;
}

function Meter({ totals }) {
  const width = Math.max(0, Math.min(totals.percent, 100));
  const tone = totals.remaining < 0 ? STATUS.over.tone : totals.remaining === 0 ? STATUS.used.tone : STATUS.left.tone;
  const headline = totals.remaining < 0 ? 'Đã âm' : totals.remaining === 0 ? 'Đã hết' : 'Còn lại';
  const headlineAmount = totals.remaining < 0 ? totals.overAmount : totals.remaining;
  return (
    <div className="bg-[#F8F9FA] rounded-2xl border border-slate-100 p-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">Đã chi trong hạn mức</p>
          <p className="text-2xl font-semibold text-[#1B2559] tabular-nums mt-1">{utils.formatVND(totals.spent)}</p>
        </div>
        <div className="rounded-xl px-3 py-2 text-white text-right shrink-0" style={{ background: tone }}>
          <p className="text-sm">{headline}</p>
          <p className="text-xl font-semibold tabular-nums">{utils.formatVND(headlineAmount)}</p>
        </div>
      </div>
      <div className="mt-4 h-3 rounded-full bg-[#F4F7FE] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${totals.spent > 0 ? Math.max(width, 4) : 0}%`, background: tone }} />
      </div>
      <p className="text-xs text-slate-500 mt-2">Hạn mức {utils.formatVND(totals.limit)} · đã dùng {Math.round(totals.percent)}%</p>
    </div>
  );
}

function StatusChip({ label, value, detail, tone }) {
  return (
    <div className="rounded-2xl p-4 min-w-0 text-white" style={{ background: tone }}>
      <p className="text-sm text-white">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums break-words">{value}</p>
      <p className="text-xs text-white mt-1">{detail}</p>
    </div>
  );
}

function CompareColumns({ current, previous, samePeriod, previousLabel, currentTone }) {
  const max = Math.max(current, previous, samePeriod || 0, 1);
  const columns = [
    { label: 'Tháng này', amount: current, tone: currentTone },
    { label: previousLabel, amount: previous, tone: '#94A3B8' },
    { label: 'Cùng kỳ', amount: samePeriod, tone: '#E3940A' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {columns.map((column) => {
        const amount = column.amount;
        const share = amount > 0 ? Math.max((amount / max) * 100, 12) : 0;
        return (
          <div key={column.label} className="min-w-0">
            <div className="h-10 flex items-end">
              <div className="w-full rounded-t-md" style={{ height: `${share}%`, background: column.tone }} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 truncate">{column.label}</p>
            <p className="text-xs font-semibold text-[#1B2559] tabular-nums truncate">{amount == null ? '…' : utils.formatVND(amount)}</p>
          </div>
        );
      })}
    </div>
  );
}

function DeltaLine({ delta, label }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1B2559] min-w-0">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: movementDot(delta) }} />
      <span className="truncate">{label}: {movementPhrase(delta)}</span>
    </p>
  );
}

function TargetCard({ item, previousLabel, onOpen }) {
  const status = STATUS[item.status];
  return (
    <button type="button" onClick={() => onOpen(item.name)} className="w-full text-left bg-[#F8F9FA] rounded-2xl border border-slate-100 p-4 hover:border-[#4318FF]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#1B2559] truncate">{item.name}</p>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: status.tone }}>{status.label}</span>
      </div>
      <div className="mt-3 rounded-xl px-3 py-3 text-white" style={{ background: status.tone }}>
        <p className="text-xl font-semibold tabular-nums">{status.detail(item)}</p>
        <p className="text-xs text-white mt-1">Đã chi {utils.formatVND(item.spent)} / {utils.formatVND(item.limit)}</p>
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-[#F4F7FE] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${item.spent > 0 ? Math.max(Math.min(item.percent, 100), 4) : 0}%`, background: status.tone }} />
      </div>
      <CompareColumns
        current={item.spent}
        previous={item.previous}
        samePeriod={item.samePeriod}
        previousLabel={previousLabel}
        currentTone={status.tone}
      />
      <div className="mt-3 space-y-1">
        <DeltaLine delta={item.previousDelta} label={previousLabel} />
        <DeltaLine delta={item.samePeriodDelta} label="Cùng kỳ" />
      </div>
    </button>
  );
}

function OpenCard({ item, previousLabel, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(item.name)} className="w-full text-left bg-[#F8F9FA] rounded-2xl border border-slate-100 p-4 hover:border-[#4318FF]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#1B2559] truncate">{item.name}</p>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: '#31457A' }}>Chưa đặt</span>
      </div>
      <p className="text-xl font-semibold text-[#1B2559] mt-3 tabular-nums">{utils.formatVND(item.spent)}</p>
      <p className="text-xs text-slate-500 mt-1">Tháng này, chưa có hạn mức để biết còn hay hết.</p>
      <CompareColumns
        current={item.spent}
        previous={item.previous}
        samePeriod={item.samePeriod}
        previousLabel={previousLabel}
        currentTone="#4318FF"
      />
      <div className="mt-3 space-y-1">
        <DeltaLine delta={item.previousDelta} label={previousLabel} />
        <DeltaLine delta={item.samePeriodDelta} label="Cùng kỳ" />
      </div>
    </button>
  );
}

export default function BudgetSnapshot({
  budgets = [],
  expenseCategories = [],
  samePeriodReady = false,
  ready = false,
  monthLabel,
  previousLabel,
  onOpenCategory,
  onOpenBudgets,
}) {
  const snapshot = buildBudgetSnapshot({ budgets, expenseCategories, samePeriodReady });
  const { tracked, open, totals } = snapshot;
  const hasTargets = tracked.length > 0;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#F4F7FE] flex items-center justify-center text-[#4318FF] shrink-0">
            <Target size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#1B2559]">Mục tiêu chi</h3>
            <p className="text-xs text-slate-500 mt-0.5">{monthLabel} · còn, hết, hay đã âm so với hạn mức</p>
          </div>
        </div>
        {onOpenBudgets && (
          <button type="button" onClick={onOpenBudgets} className="text-xs font-semibold text-[#4318FF] bg-[#F4F7FE] rounded-xl px-3 py-2 self-start">
            Đặt mục tiêu
          </button>
        )}
      </div>

      {!ready ? (
        <p className="text-sm text-slate-400">Đang tổng hợp mục tiêu chi...</p>
      ) : (
        <>
          <p className="text-lg font-semibold text-[#1B2559] leading-snug">
            <Verdict totals={totals} hasTargets={hasTargets} />
          </p>

          {hasTargets ? (
            <>
              <Meter totals={totals} />
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <StatusChip label="Còn" value={utils.formatVND(totals.leftAmount)} detail={`${totals.leftCount} khoản`} tone={STATUS.left.tone} />
                <StatusChip label="Hết" value={String(totals.usedCount)} detail="khoản đúng hạn mức" tone={STATUS.used.tone} />
                <StatusChip label="Âm" value={utils.formatVND(totals.overAmount)} detail={`${totals.overCount} khoản vượt`} tone={STATUS.over.tone} />
                <StatusChip label="Chưa đặt" value={utils.formatVND(totals.openSpent)} detail={`${totals.openCount} khoản`} tone="#31457A" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#1B2559] mb-3">Đã đặt mục tiêu</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {tracked.map((item) => (
                    <TargetCard key={item.name} item={item} previousLabel={previousLabel} onOpen={onOpenCategory} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] p-5">
              <p className="text-sm text-[#1B2559]">Đặt hạn mức cho từng danh mục chi để thấy tháng này còn, hết, hay đã âm.</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-[#1B2559] mb-1">Chưa đặt mục tiêu</h4>
            <p className="text-xs text-slate-500 mb-3">Những khoản chi này chưa có hạn mức, nên chỉ so được với tháng trước và cùng kỳ.</p>
            {open.length === 0 ? (
              <p className="text-sm text-slate-400">{hasTargets ? 'Mọi khoản chi đang nằm trong mục tiêu.' : 'Tháng này chưa có khoản chi ngoài mục tiêu.'}</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {open.map((item) => (
                  <OpenCard key={item.name} item={item} previousLabel={previousLabel} onOpen={onOpenCategory} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
