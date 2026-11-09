// @ts-check
/** Circumferences are observations in cm, never inferred from strength, fat estimates or the scale. */
import { newId, toIso } from './templates.mjs';
/** @typedef {import('./types').BodyMeasurementEntry} Entry */
/** @typedef {import('./types').MeasurementSite} Site */
export const MEASUREMENT_SITES = Object.freeze([
  ['waist','Waist','Талия'], ['chest','Chest','Грудь'], ['hips','Hips','Бёдра'], ['neck','Neck','Шея'],
  ['left-biceps','Left upper arm','Левое плечо (бицепс)'], ['right-biceps','Right upper arm','Правое плечо (бицепс)'],
  ['left-forearm','Left forearm','Левое предплечье'], ['right-forearm','Right forearm','Правое предплечье'],
  ['left-thigh','Left thigh','Левое бедро'], ['right-thigh','Right thigh','Правое бедро'],
  ['left-calf','Left calf','Левая голень'], ['right-calf','Right calf','Правая голень'],
]);
const SITES = new Set(MEASUREMENT_SITES.map(([id])=>id));
/** @param {unknown} value @returns {Partial<Record<Site,number>>|null} */
export function measurementValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  /** @type {Partial<Record<Site,number>>} */
  const out={};
  for(const [key,n] of Object.entries(value)) {
    if(!SITES.has(key) || typeof n!=='number' || !Number.isFinite(n) || n<=0 || n>300) return null;
    const rounded = Math.round(n*10)/10;
    if (rounded <= 0) return null;
    out[/** @type {Site} */(key)] = rounded;
  }
  return Object.keys(out).length ? out : null;
}
/** Date-only inputs use local noon, preventing a UTC conversion from changing the selected day.
 * @param {string} day @param {Date|string|number} [now] */
export function measurementDate(day, now=new Date()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y,m,d]=day.split('-').map(Number); const at=new Date(y,m-1,d,12);
  if(at.getFullYear()!==y || at.getMonth()!==m-1 || at.getDate()!==d) return null;
  const today=new Date(now); today.setHours(23,59,59,999);
  return at.getTime()<=today.getTime() ? at.toISOString() : null;
}
/** @param {{day:string,values:unknown,note?:string,now?:Date|string|number,id?:string}} input @returns {Entry|null} */
export function measurementRow({day,values,note='',now=new Date(),id}) {
  const cleaned=measurementValues(values); const at=measurementDate(day,now);
  if(!cleaned || !at) return null;
  return {id:id??newId(),at,values:cleaned,...(note.trim()?{note:note.trim().slice(0,500)}:{}),updatedAt:toIso(now)};
}
/** @param {Record<string,Entry>|Entry[]} rows @param {Site} site */
export function measurementTrend(rows,site) {
  return Object.values(rows).filter((r)=>Number.isFinite(r.values[site])).sort((a,b)=>a.at.localeCompare(b.at)||a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id)).map((r)=>({id:r.id,at:r.at,cm:/** @type {number} */(r.values[site])}));
}
