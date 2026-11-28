import utils from '../../utils/format.js';

function MiniStat({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-black text-[#1B2559] tabular-nums truncate">{value}</p>
    </div>
  );
}

function FlowRow({ item, title, detail, amount, tone, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(item.transaction)} className="w-full flex items-center gap-3 py-2.5 text-left bg-transparent border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1B2559] truncate">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{detail}</p>
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${tone}`}>{amount}</span>
    </button>
  );
}

function rowDetail(item) {
  return [utils.formatDisplayDate(item.date), item.wallet, item.note].filter(Boolean).join(' · ');
}

export default function FlowDetails({ picture, flow, onOpen, onMatchReimbursement }) {
  if (!picture || !flow) return null;
  const hasHelped = picture.helped > 0 || picture.reimbursement > 0;
  const hasFund = picture.outstandingBorrow > 0 || picture.fundBorrow > 0 || picture.repaid > 0
    || flow.remainder > 0 || flow.transfers.length > 0 || flow.spends.length > 0;
  if (!hasHelped && !hasFund) return null;

  const owed = picture.outstandingBorrow ?? Math.max(0, picture.fundBorrow - picture.repaid);
  const settled = owed === 0 && picture.repaid > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
      <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 min-w-0">
        <h3 className="text-base font-semibold text-[#1B2559] mb-4">Chi hộ và hoàn tiền</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="Đã thu lại" value={utils.formatVND(picture.matched)} />
          <MiniStat label="Hoa hồng" value={utils.formatVND(picture.commission)} />
          <MiniStat label="Chưa nhận lại" value={utils.formatVND(picture.unreimbursed)} />
        </div>
        {flow.helped.length === 0 && flow.reimbursements.length === 0 ? (
          <p className="text-sm text-slate-400">Không có chi hộ hay hoàn tiền trong kỳ này.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {flow.helped.map((item) => (
              <FlowRow
                key={item.id || `${item.date}-chi-ho-${item.amount}-${item.note}`}
                item={item}
                title={item.fromFund ? 'Chi hộ · lấy từ quỹ' : 'Chi hộ'}
                detail={rowDetail(item)}
                amount={`-${utils.formatVND(item.amount)}`}
                tone="expense-ink"
                onOpen={onOpen}
              />
            ))}
            {flow.reimbursements.map((item) => (
              <div key={item.id || `${item.date}-hoan-${item.amount}-${item.note}`}>
                <FlowRow
                  item={item}
                  title={item.unmatched ? 'Hoàn ứng · Chưa đối chiếu' : 'Thu nợ/Hoàn ứng'}
                  detail={item.commission ? `${rowDetail(item)} · Hoa hồng ${utils.formatVND(item.commission)}` : rowDetail(item)}
                  amount={`+${utils.formatVND(item.amount)}`}
                  tone="text-[#157A45]"
                  onOpen={onOpen}
                />
                {onMatchReimbursement && item.id && item.candidates?.some((expense) => expense.id) && (
                  <select
                    aria-label="Chọn giao dịch chi hộ để đối chiếu"
                    value=""
                    className="mb-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
                    onChange={({ target }) => {
                      const expense = item.candidates.find(({ id }) => id === target.value);
                      if (expense) onMatchReimbursement(item.transaction, expense);
                    }}
                  >
                    <option value="">Chọn khoản chi hộ đã được hoàn</option>
                    {item.candidates.filter((expense) => expense.id).map((expense) => (
                      <option key={expense.id} value={expense.id}>
                        {utils.formatDisplayDate(expense.date)} · {utils.formatVND(expense.amount)} · {expense.note || expense.wallet}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 min-w-0">
        <h3 className="text-base font-semibold text-[#1B2559] mb-4">Quỹ khẩn cấp</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MiniStat label="Đã mượn" value={utils.formatVND(picture.fundBorrow)} />
          <MiniStat label="Đã chi" value={utils.formatVND(flow.spent)} />
          <MiniStat label="Còn trong ví nhận" value={utils.formatVND(flow.remainder)} />
          <MiniStat label={settled ? 'Đã trả' : 'Còn nợ'} value={utils.formatVND(settled ? picture.repaid : owed)} />
        </div>
        {flow.transfers.length === 0 && flow.spends.length === 0 && flow.repayments.length === 0 ? (
          <p className="text-sm text-slate-400">Không có khoản mượn quỹ trong kỳ này.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {flow.transfers.map((item) => (
              <FlowRow
                key={item.id || `${item.date}-out-${item.amount}`}
                item={item}
                title={item.toWallet ? `Chuyển sang ${item.toWallet}` : 'Chuyển từ quỹ'}
                detail={rowDetail(item)}
                amount={utils.formatVND(item.amount)}
                tone="text-[#1B2559]"
                onOpen={onOpen}
              />
            ))}
            {flow.spends.map((item) => (
              <FlowRow
                key={item.id || `${item.date}-spend-${item.amount}-${item.note}`}
                item={item}
                title={item.category || 'Chi từ quỹ'}
                detail={rowDetail(item)}
                amount={`-${utils.formatVND(item.amount)}`}
                tone="expense-ink"
                onOpen={onOpen}
              />
            ))}
            {flow.repayments.map((item) => (
              <FlowRow
                key={item.id || `${item.date}-repay-${item.amount}`}
                item={item}
                title="Trả về quỹ"
                detail={rowDetail(item)}
                amount={utils.formatVND(item.amount)}
                tone="text-[#157A45]"
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
