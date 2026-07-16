import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import { formatMoney, LOAN_OPTIONS } from '../game/constants.ts';

function BarChart() {
  const history = useGameStore(s => s.quarterlyHistory);
  const records = useMemo(() => history.slice(-4), [history]);

  if (records.length === 0) {
    return <div className="text-white/40 text-[10px] text-center py-3">四半期データなし</div>;
  }

  const maxVal = Math.max(...records.flatMap(r => [r.income, r.expenses]), 1);

  return (
    <div className="flex items-end gap-1.5 h-20 px-1">
      {records.map((r, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="flex items-end gap-px w-full h-14">
            <div
              className="flex-1 bg-emerald-500/70 rounded-t-sm"
              style={{ height: `${(r.income / maxVal) * 100}%` }}
              title={`収入: ${formatMoney(r.income)}`}
            />
            <div
              className="flex-1 bg-red-500/70 rounded-t-sm"
              style={{ height: `${(r.expenses / maxVal) * 100}%` }}
              title={`支出: ${formatMoney(r.expenses)}`}
            />
          </div>
          <span className="text-[8px] text-white/50">Q{r.quarter}</span>
        </div>
      ))}
    </div>
  );
}

function LoanSection() {
  const loans = useGameStore(s => s.loans);
  const takeLoan = useGameStore(s => s.takeLoan);
  const repayLoan = useGameStore(s => s.repayLoan);

  return (
    <div className="border-t border-white/10 pt-2 mt-2 space-y-1.5 text-xs">
      <div className="text-white/50 font-bold text-[10px] uppercase tracking-wider">融資</div>

      {/* Active loans */}
      {loans.map(loan => (
        <div key={loan.id} className="flex justify-between items-center">
          <div>
            <div className="text-white/70">{formatMoney(loan.principal)}</div>
            <div className="text-white/40 text-[10px]">残{loan.remainingMonths}ヶ月</div>
          </div>
          <button
            onClick={() => repayLoan(loan.id)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/30 hover:bg-red-500/50 text-red-300 transition-all"
          >
            返済
          </button>
        </div>
      ))}

      {/* New loan options */}
      <div className="flex flex-wrap gap-1 mt-1">
        {LOAN_OPTIONS.map(opt => (
          <button
            key={opt.amount}
            onClick={() => takeLoan(opt.amount, opt.months)}
            className="px-2 py-1 rounded text-[10px] bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition-all"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FinancePanel() {
  const finance = useGameStore(s => s.finance);
  const showFinancePanel = useGameStore(s => s.showFinancePanel);
  const toggleFinancePanel = useGameStore(s => s.toggleFinancePanel);

  if (!showFinancePanel) return null;

  const income = finance.quarterlyIncome;
  const expenses = finance.quarterlyExpenses;
  const totalIncome = income.railFare + income.subsidiary + income.other + income.landRent + income.materialTransport;
  const totalExpenses = expenses.trackMaintenance + expenses.trainMaintenance +
    expenses.staffCost + expenses.subsidiaryRunning + expenses.interestPayment;
  const net = totalIncome - totalExpenses;

  return (
    <div className="w-64 p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">財務ダッシュボード</span>
        <button
          onClick={toggleFinancePanel}
          className="text-white/40 hover:text-white/80 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Cash & Debt */}
      <div className="space-y-1 text-xs mb-2">
        <div className="flex justify-between">
          <span className="text-white/60">資金</span>
          <span className={`font-bold ${finance.cash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(finance.cash)}
          </span>
        </div>
        {finance.debt > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">負債</span>
            <span className="text-red-400 font-medium">{formatMoney(finance.debt)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-white/60">株価</span>
          <span className="text-white/80 font-medium">{finance.stockPrice.toLocaleString()}円</span>
        </div>
      </div>

      {/* Income breakdown */}
      <div className="border-t border-white/10 pt-2 mb-2 space-y-1 text-xs">
        <div className="text-emerald-400/70 font-bold text-[10px] uppercase tracking-wider">収入（四半期累計）</div>
        <div className="flex justify-between">
          <span className="text-white/60">運賃収入</span>
          <span className="text-emerald-400">{formatMoney(income.railFare)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">子会社収入</span>
          <span className="text-emerald-400">{formatMoney(income.subsidiary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">税収</span>
          <span className="text-emerald-400">{formatMoney(income.other)}</span>
        </div>
        {income.landRent > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">地代収入</span>
            <span className="text-emerald-400">{formatMoney(income.landRent)}</span>
          </div>
        )}
        {income.materialTransport > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">資材輸送収入</span>
            <span className="text-emerald-400">{formatMoney(income.materialTransport)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-white/5 pt-0.5">
          <span className="text-white/70 font-medium">合計</span>
          <span className="text-emerald-400 font-bold">{formatMoney(totalIncome)}</span>
        </div>
      </div>

      {/* Expense breakdown */}
      <div className="border-t border-white/10 pt-2 mb-2 space-y-1 text-xs">
        <div className="text-red-400/70 font-bold text-[10px] uppercase tracking-wider">支出（四半期累計）</div>
        <div className="flex justify-between">
          <span className="text-white/60">線路維持費</span>
          <span className="text-red-400">{formatMoney(expenses.trackMaintenance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">車両維持費</span>
          <span className="text-red-400">{formatMoney(expenses.trainMaintenance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">人件費</span>
          <span className="text-red-400">{formatMoney(expenses.staffCost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">子会社経費</span>
          <span className="text-red-400">{formatMoney(expenses.subsidiaryRunning)}</span>
        </div>
        {expenses.interestPayment > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">利息</span>
            <span className="text-red-400">{formatMoney(expenses.interestPayment)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-white/5 pt-0.5">
          <span className="text-white/70 font-medium">合計</span>
          <span className="text-red-400 font-bold">{formatMoney(totalExpenses)}</span>
        </div>
      </div>

      {/* Net */}
      <div className="border-t border-white/10 pt-2 mb-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/80 font-bold">損益</span>
          <span className={`font-bold flex items-center gap-1 ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {net > 0 ? '▲' : net < 0 ? '▼' : '→'} {formatMoney(net)}
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="border-t border-white/10 pt-2">
        <div className="text-white/50 font-bold text-[10px] uppercase tracking-wider mb-1">四半期推移</div>
        <BarChart />
        <div className="flex justify-center gap-3 mt-1 text-[8px] text-white/40">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/70 rounded-sm" /> 収入</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/70 rounded-sm" /> 支出</span>
        </div>
      </div>

      {/* Loan section */}
      <LoanSection />
    </div>
  );
}
