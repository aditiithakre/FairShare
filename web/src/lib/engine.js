/* Balances are never stored - they are recomputed from the expense list every
   time, so deleting or editing an expense cannot leave stale totals behind. */

export function calculateBalances(expenses) {
  const balances = {};
  const bump = (who, delta) => { balances[who] = (balances[who] || 0) + delta; };

  for (const expense of expenses) {
    const total = expense.amountPaise;
    const { mode, people } = expense.split;
    const shares = {};
    let leftover = 0;

    if (mode === "equal") {
      if (!people.length) continue;
      const each = Math.floor(total / people.length);
      people.forEach((name) => { shares[name] = each; });
      leftover = total - each * people.length;
    } else if (mode === "shares") {
      const units = Object.values(people).reduce((a, b) => a + b, 0);
      if (!units) continue;
      const unit = Math.floor(total / units);
      Object.keys(people).forEach((name) => { shares[name] = unit * people[name]; });
      leftover = total - Object.values(shares).reduce((a, b) => a + b, 0);
    } else if (mode === "percentage") {
      Object.keys(people).forEach((name) => { shares[name] = Math.floor((total * people[name]) / 100); });
      leftover = total - Object.values(shares).reduce((a, b) => a + b, 0);
    } else {
      Object.keys(people).forEach((name) => { shares[name] = people[name]; });
      leftover = total - Object.values(shares).reduce((a, b) => a + b, 0);
    }

    const payer = expense.paidBy;
    if (!(payer in balances)) balances[payer] = 0;

    // the payer absorbs the rounding remainder, so balances always sum to zero
    if (payer in shares) bump(payer, total - shares[payer] - leftover);
    else bump(payer, total - leftover);

    Object.keys(shares).forEach((name) => {
      if (!(name in balances)) balances[name] = 0;
      if (name !== payer) bump(name, -shares[name]);
    });
  }
  return balances;
}

/* Greedy: the largest debtor pays the largest creditor the smaller of the two
   amounts. Near-optimal in practice; the true minimum-transaction problem is
   NP-hard, which is not a trade worth making here. */
export function settleBalances(balances) {
  const creditors = Object.keys(balances).filter((p) => balances[p] > 0)
    .map((p) => ({ person: p, amount: balances[p] })).sort((a, b) => b.amount - a.amount);
  const debtors = Object.keys(balances).filter((p) => balances[p] < 0)
    .map((p) => ({ person: p, amount: -balances[p] })).sort((a, b) => b.amount - a.amount);

  const payments = [];
  for (const debtor of debtors) {
    for (const creditor of creditors) {
      if (debtor.amount === 0) break;
      const paid = Math.min(debtor.amount, creditor.amount);
      if (paid === 0) continue;
      payments.push({ from: debtor.person, to: creditor.person, amount: paid });
      debtor.amount -= paid;
      creditor.amount -= paid;
    }
  }
  return payments;
}

export function monthlySummary(expenses, month) {
  let total = 0;
  const byCategory = {};
  for (const expense of expenses) {
    if (expense.date.slice(0, 7) !== month) continue;
    if (expense.category === "Settlement") continue; // repaying a debt is not spending
    total += expense.amountPaise;
    byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amountPaise;
  }
  return { total, byCategory };
}
