export function formatTimeContextFact(
  selectedYear: number
): { fact: string; bucketMonths: number } {
  const now = new Date();
  const end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

  if (selectedYear > now.getFullYear()) {
    return { fact: "This year hasn’t started yet.", bucketMonths: 12 };
  }

  if (selectedYear < now.getFullYear() || end.getTime() <= now.getTime()) {
    return { fact: "This year is nearing its close.", bucketMonths: 0 };
  }

  const msLeft = end.getTime() - now.getTime();
  const daysLeft = msLeft / 86400000;
  const approxMonthsLeft = Math.max(0, Math.min(12, Math.round(daysLeft / 30.44)));
  if (approxMonthsLeft < 1) return { fact: "This year is nearing its close.", bucketMonths: 0 };
  return {
    fact: `About ${approxMonthsLeft} month${approxMonthsLeft === 1 ? "" : "s"} remain in this year.`,
    bucketMonths: approxMonthsLeft,
  };
}

export function getTimeContextReframes(bucketMonths: number): string[] {
  if (bucketMonths >= 6) {
    return [
      "Small, steady steps have time to grow.",
      "There’s room for experimentation, not perfection.",
    ];
  }
  if (bucketMonths >= 2) {
    return [
      "Some people use this time to build gentle momentum.",
      "Others use it to notice what matters before committing.",
    ];
  }
  if (bucketMonths >= 1) {
    return [
      "Starting imperfectly now is allowed.",
      "Reflecting now and carrying this forward is also allowed.",
    ];
  }
  return [
    "A Vision can begin quietly.",
    "Noticing what matters is already meaningful.",
  ];
}
