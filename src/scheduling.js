export const TIMES = Array.from(
  { length: 18 },
  (_, i) =>
    `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export const localDate = (date = new Date()) =>
  date.toLocaleDateString("en-CA");
export function shiftDate(date, amount) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + amount);
  return localDate(d);
}
export function weekDates(date) {
  const d = new Date(date + "T12:00:00");
  const offset = (d.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => shiftDate(date, i - offset));
}
export function isAvailable(
  appointments,
  doctor,
  date,
  time,
  now = new Date(),
) {
  return (
    Boolean(doctor && date) &&
    new Date(`${date}T${time}:00`) > now &&
    !appointments.some(
      (a) =>
        (a.doctor?._id || a.doctor) === doctor &&
        a.date === date &&
        a.time === time &&
        ["Scheduled", "Checked in"].includes(a.status),
    )
  );
}
