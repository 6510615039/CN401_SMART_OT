/**
 * Smart default month: day 1–15 → previous month (กำลังทำเรื่องเดือนก่อน)
 *                      day 16+  → current month
 */
export function smartDefaultDate(): { year: number; month: number } {
  const now = new Date();
  if (now.getDate() <= 15) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function smartDefaultMonth(): number {
  return smartDefaultDate().month;
}

export function smartDefaultYear(): number {
  return smartDefaultDate().year;
}

/** Thai fiscal year: Oct(year-1)–Sep(year) */
export function smartDefaultThaiYear(): number {
  const { year, month } = smartDefaultDate();
  return year + 543 + (month >= 10 ? 1 : 0);
}
