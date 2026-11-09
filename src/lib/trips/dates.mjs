/** Local calendar dates: never shift a travel day through the browser's timezone. */
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function stayDates(start, end) {
  if (!start && !end) return [];
  if (!validDate(start) || !validDate(end) || end < start) throw new RangeError('Choose valid arrival and departure dates.');
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  if (days > 90) throw new RangeError('A dated stay can cover up to 90 days.');
  return Array.from({ length: days }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
}
export const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const timeMinute = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export const minuteTime = (value) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;


export function canonicalTimeZone(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)?|UTC)$/.test(value)) return null;
  try { return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone; } catch { return null; }
}
const zoneFormatters = new Map();
/** Convert an absolute source instant to the explicitly selected destination's local calendar and clock. */
export function zonedParts(instant, timeZone) {
  if (!zoneFormatters.has(timeZone)) { if (zoneFormatters.size >= 32) zoneFormatters.clear(); zoneFormatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })); }
  const parts = zoneFormatters.get(timeZone).formatToParts(new Date(instant));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}
/** Unzoned venue-local times are usable only when the chosen timezone identifies exactly one instant. */
export function localInstant(date, time, timeZone) {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const matches = [];
  for (let delta = -14 * 60; delta <= 14 * 60; delta += 15) {
    const instant = naive + delta * 60000;
    const local = zonedParts(instant, timeZone);
    if (local.date === date && local.time === time) matches.push(instant);
  }
  return matches.length === 1 ? matches[0] : null;
}

export const nextDate = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
