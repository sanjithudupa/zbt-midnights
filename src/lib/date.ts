import { DAY_LABELS, FULL_DAY_LABELS } from "./constants";

export function getDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getMonday(date: Date): Date {
  const dayIndex = getDayIndex(date);
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayIndex);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isMonday(date: Date): boolean {
  return getDayIndex(date) === 0;
}

export function dayLabel(dayIndex: number): string {
  return DAY_LABELS[dayIndex] ?? "Day";
}

export function fullDayLabel(dayIndex: number): string {
  return FULL_DAY_LABELS[dayIndex] ?? "Day";
}
