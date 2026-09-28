/* Money is integer paise everywhere. Rupees exist only at the edges:
   parseRupees on the way in, formatPaise on the way out. A float anywhere in
   between would undo the whole point - 0.1 + 0.2 === 0.30000000000000004. */

export function formatPaise(amount) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;

  let digits = String(rupees);
  if (digits.length > 3) {
    // Indian grouping: last three digits, then twos - 9,00,000 not 900,000
    const groups = [digits.slice(-3)];
    let rest = digits.slice(0, -3);
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    groups.unshift(rest);
    digits = groups.join(",");
  }
  return `${sign}₹${digits}.${String(paise).padStart(2, "0")}`;
}

export function parseRupees(text) {
  const clean = String(text ?? "").trim().replace(/^₹/, "").trim().replace(/,/g, "");
  const parts = clean.split(".");
  if (parts.length > 2) throw new Error("Enter an amount like 2216.67");

  const rupees = parts[0] || "";
  const paise = parts.length === 2 ? parts[1] : "";

  if (!rupees && !paise) throw new Error("Enter an amount like 2216.67");
  if (rupees && !/^\d+$/.test(rupees)) throw new Error("Enter an amount like 2216.67");
  if (paise && !/^\d+$/.test(paise)) throw new Error("Enter an amount like 2216.67");
  if (paise.length > 2) throw new Error("Amounts can have at most two decimal places");

  return parseInt(rupees || "0", 10) * 100 + parseInt(paise.padEnd(2, "0") || "0", 10);
}
