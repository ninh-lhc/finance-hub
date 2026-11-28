import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import utils from '../../utils/format.js';
import { SIX_JARS, suggestJarSettings } from '../../logic/sixJars.js';

const field = 'min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm';

function CategoryBudgets({ budgets, transactions, onOpenTransaction }) {
  return budgets.map(({ id, category, amount, currentSpent }) => (
    <details key={id} className="mt-2 text-xs text-slate-700">
      <summary className="cursor-pointer">
        {category} · {utils.formatVND(currentSpent)} / {utils.formatVND(amount)}
        {currentSpent > amount && <strong className="ml-1 text-red-700 expense-ink">Vượt {utils.formatVND(currentSpent - amount)}</strong>}
      </summary>
      {currentSpent === 0 && <p className="pl-3">Chưa có khoản chi.</p>}
      {transactions.filter((row) => row.type === 'EXPENSE' && row.category === category).map((row) => (
        <button key={row.id} type="button" className="block py-1 pl-3 text-left text-[#4318FF]" onClick={() => onOpenTransaction(row)}>
          {utils.formatDisplayDate(row.date)} · {row.note || row.category} · {utils.formatVND(row.amount)}
        </button>
      ))}
    </details>
  ));
}

export default function SixJarsPanel({ settings, categories, plan, onSave, budgetProgress, transactions, onOpenTransaction, onOpenBudgets }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestionVersion, setSuggestionVersion] = useState(0);
  const suggested = suggestJarSettings(categories);
  const config = settings || suggested;
  const savedAssignments = new Map(config.categoryJars);
  const assignments = suggestionVersion ? new Map(suggested.categoryJars) : savedAssignments;
  const childBudget = budgetProgress.find(({ category, amount }) => category === config.childCategory && Number(amount) > 0);
  const renderBudgets = (budgets) => <CategoryBudgets budgets={budgets} transactions={transactions} onOpenTransaction={onOpenTransaction} />;

  const persist = async (nextSettings) => {
    setSaving(true);
    try {
      await onSave(nextSettings);
      setEditing(false);
    } catch (error) {
      console.error('Không lưu được cấu hình 6 hũ', error);
    } finally {
      setSaving(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const childCategory = String(form.get('childCategory')).trim();
    const childTarget = Number(form.get('childTarget') ?? config.childTarget);
    if (!childCategory || !Number.isSafeInteger(childTarget) || childTarget < 1) return;
    const categoryJars = categories.flatMap((category, index) => {
      const jar = form.get(`category-${index}`);
      return jar && category !== childCategory ? [[category, jar]] : [];
    });
    return persist({ childCategory, childTarget, categoryJars });
  };

  return (
    <section className="space-y-4 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="six-jars-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="six-jars-title" className="text-lg font-bold text-[#1B2559]">Ngân sách &amp; 6 hũ</h2>
        <button type="button" onClick={onOpenBudgets} className="ml-auto min-h-10 px-3 text-sm font-semibold text-[#4318FF]">
          Sửa ngân sách danh mục
        </button>
        <button type="button" disabled={saving} onClick={() => {
          if (!settings) return persist(config);
          setSuggestionVersion(0);
          setEditing((open) => !open);
        }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-[#4318FF] disabled:opacity-60">
          <Settings2 size={16} aria-hidden="true" /> {saving ? 'Đang lưu…' : settings ? 'Thiết lập' : 'Bật 6 hũ'}
        </button>
      </div>

      {editing && (
        <form className="space-y-4 border-t border-slate-100 pt-4" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Danh mục chi cho con
              <input className={field} name="childCategory" list="six-jars-expense-categories" required defaultValue={config.childCategory} />
            </label>
            <datalist id="six-jars-expense-categories">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
            {childBudget ? (
              <p className="self-center text-sm text-slate-600">Mức chi cho con theo ngân sách {utils.formatVND(childBudget.amount)}</p>
            ) : <label className="grid gap-1 text-sm">Mức chi cho con mỗi tháng (đ)
              <input className={field} name="childTarget" type="number" min="1" step="1" required defaultValue={config.childTarget} />
            </label>}
          </div>
          <button type="button" disabled={saving} onClick={() => setSuggestionVersion((version) => version + 1)} className="min-h-10 rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-[#4318FF]">
            Tự gán danh mục
          </button>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => (
              <label key={category} className="grid gap-1 text-sm">{category}
                <select key={suggestionVersion} className={field} name={`category-${index}`} defaultValue={assignments.get(category) || ''}>
                  <option value="">Chưa gán hũ</option>
                  {SIX_JARS.map((jar) => <option key={jar.id} value={jar.id}>{jar.label}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="submit" disabled={saving} className="min-h-10 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Đang lưu…' : 'Lưu thiết lập'}
          </button>
        </form>
      )}

      {settings && !plan && <p role="status" className="text-sm text-slate-600">Đang tải lịch sử chi tiêu…</p>}
      {settings && plan && (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <span>Lương {utils.formatVND(plan.salary)}</span>
            <span>Chi cho con {utils.formatVND(plan.childPaid)} / {utils.formatVND(plan.childTarget)}</span>
            {plan.repaid > 0 && <span>Đã hoàn quỹ {utils.formatVND(plan.repaid)}</span>}
          </div>
          {!plan.ready ? (
            <p role="status" className="text-sm text-slate-600">
              {plan.salary > 0 ? 'Đã ghi nhận lương.' : 'Đang chờ ghi nhận lương tháng này.'}
              {' '}{plan.childPaid < plan.childTarget
                ? `Còn ${utils.formatVND(plan.childTarget - plan.childPaid)} cần chi cho con.`
                : 'Đã chi đủ khoản cho con.'}
              {' '}Hạn mức tự hiện khi đủ cả hai điều kiện.
            </p>
          ) : (
            <>
              {renderBudgets(budgetProgress.filter(({ category }) => category === config.childCategory))}
              <p className="text-sm text-slate-700">
                Tổng tiền chia hũ <strong>{utils.formatVND(plan.available)}</strong>.
                {' '}{plan.mappedPrevious ? 'Hạn mức kết hợp tỷ lệ 6 hũ gốc và tỷ trọng chi đã gán hũ tháng trước theo tỷ lệ 50/50.' : 'Dùng tỷ lệ 6 hũ gốc vì tháng trước chưa có khoản chi đã gán hũ.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plan.jars.map((jar) => {
                  const budgets = budgetProgress.filter(({ category }) => category !== config.childCategory && savedAssignments.get(category) === jar.id);
                  const totalCaps = budgets.reduce((sum, { amount }) => sum + Number(amount), 0);
                  return (
                  <article key={jar.id} data-jar={jar.id} className="six-jar-card rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-[#1B2559]">{jar.label}</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {categories.filter((category) => category !== config.childCategory
                        && savedAssignments.get(category) === jar.id).join(' · ') || 'Chưa có danh mục'}
                    </p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${jar.remaining < 0 ? 'text-red-700 expense-ink' : 'text-[#1B2559]'}`}>
                      {jar.remaining < 0 ? 'Vượt ' : 'Còn '}{utils.formatVND(Math.abs(jar.remaining))}
                    </p>
                    <p className="text-xs text-slate-600">Đã chi {utils.formatVND(jar.spent)} / {utils.formatVND(jar.limit)}</p>
                    <p className="mt-1 text-xs text-slate-600">Tháng trước {utils.formatVND(jar.lastSpent)}</p>
                    {renderBudgets(budgets)}
                    {totalCaps > jar.limit && (
                      <p className="mt-2 text-xs text-red-700 expense-ink">
                        Tổng trần danh mục {utils.formatVND(totalCaps)} cao hơn hạn mức hũ {utils.formatVND(totalCaps - jar.limit)}.
                      </p>
                    )}
                  </article>
                  );
                })}
              </div>
              {renderBudgets(budgetProgress.filter(({ category }) => category !== config.childCategory && !savedAssignments.has(category)))}
              {(plan.unassigned > 0 || plan.previousUnassigned > 0) && (
                <p className="text-sm text-slate-600">
                  Chi chưa gán hũ · Tháng này {utils.formatVND(plan.unassigned)} · Tháng trước {utils.formatVND(plan.previousUnassigned)}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
