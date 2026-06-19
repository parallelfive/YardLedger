// NM 57-30-8/9: a scrap purchase must reach the state recycled-metals database
// by the close of the 2nd business day following the purchase. Business days are
// Mon–Fri; state holidays are not yet accounted for (a future refinement, which
// can only make a receipt MORE overdue, never less).

export function reportDueDate(purchasedAt: Date, businessDays = 2): Date {
  const d = new Date(purchasedAt);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1; // skip Sun(0)/Sat(6)
  }
  d.setHours(23, 59, 59, 999); // close of the due business day
  return d;
}

export function isReportOverdue(
  purchasedAt: string,
  businessDays = 2,
  now: Date = new Date()
): boolean {
  return (
    now.getTime() > reportDueDate(new Date(purchasedAt), businessDays).getTime()
  );
}
