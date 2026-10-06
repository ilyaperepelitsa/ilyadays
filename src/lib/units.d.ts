// Types for units.js — copied from ../recipes/static/units.js by `npm run sync` (one implementation for both sites).
export type Units = "metric" | "us";
export type FormatOpts = { factor: number; units: Units; lang: "en" | "ru" };
export type QData = Record<string, string | number | undefined> & { k: string; o: string };

export function plural(n: number, forms: string[]): number;
export function roundTo(x: number, step: number): number;
export function frac(x: number): string;
export function dec(x: number, lang: string): string;
export function formatQ(d: QData, opts: FormatOpts): { text: string; unit: string };
export function applyQuantities(root: ParentNode, opts: FormatOpts): number;
export function factorFor(state: { n: number; perPerson: boolean }, info: { mode: string; serves: number }): number;
export const UNITS_KEY: string;
export function portionsKey(slug: string): string;
export const UNITS_EVENT: string;
export const REFRESH_EVENT: string;
export function readUnits(): Units;
export function mountPortions(el: HTMLElement, root: HTMLElement): () => void;
