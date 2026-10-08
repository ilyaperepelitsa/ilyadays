"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { strings } from "@/lib/i18n";
import { LIMITS, type Theme, type TripBrief } from "@/lib/trips";

type Copy = ReturnType<typeof strings>;
type SetBrief = (next: TripBrief) => void;

export function BriefFields({ brief, copy, onChange }: { brief: TripBrief; copy: Copy; onChange: SetBrief }) {
  const set = (patch: Partial<TripBrief>) => onChange({ ...brief, ...patch });
  return (
    <>
      <section className="trip-panel">
        <h2>{copy.tripSectionShape}</h2>
        <label className="trip-field trip-city">
          <span>{copy.tripCity}</span>
          <input value={brief.city} placeholder={copy.tripCityPh} onChange={(e) => set({ city: e.target.value })} autoComplete="off" />
        </label>
        <div className="trip-metrics">
          <Slider label={copy.tripRoutes} hint={copy.tripRoutesHint} value={brief.routes} min={LIMITS.routes[0]} max={LIMITS.routes[1]} onChange={(routes) => set({ routes, sharedSpine: routes < 2 ? false : brief.sharedSpine })} />
          <Slider label={copy.tripHours} hint={copy.tripHoursHint} value={brief.hours} min={LIMITS.hours[0]} max={LIMITS.hours[1]} onChange={(hours) => set({ hours })} />
          <Slider label={copy.tripPlaces} hint={copy.tripPlacesHint} value={brief.placesPerRoute} min={LIMITS.places[0]} max={LIMITS.places[1]} onChange={(placesPerRoute) => set({ placesPerRoute })} />
          <Slider label={copy.tripFood} hint={copy.tripFoodHint} value={brief.foodBreaks} min={LIMITS.food[0]} max={LIMITS.food[1]} onChange={(foodBreaks) => set({ foodBreaks })} />
        </div>
        <div className="trip-choices" role="radiogroup" aria-label={copy.tripPace}>
          <Choice name="pace" checked={brief.pace === "linger"} title={copy.tripLinger} hint={copy.tripLingerHint} onChange={() => set({ pace: "linger" })} />
          <Choice name="pace" checked={brief.pace === "rapid"} title={copy.tripRapid} hint={copy.tripRapidHint} onChange={() => set({ pace: "rapid" })} />
        </div>
        <Switch
          checked={brief.sharedSpine}
          disabled={brief.routes < 2}
          title={copy.tripSpine}
          hint={copy.tripSpineHint}
          onChange={() => set({ sharedSpine: !brief.sharedSpine })}
        />
      </section>
      <PreferenceFields brief={brief} copy={copy} onChange={onChange} />
    </>
  );
}

function PreferenceFields({ brief, copy, onChange }: { brief: TripBrief; copy: Copy; onChange: SetBrief }) {
  const [wishText, setWishText] = useState(() => brief.wishes.join("\n"));
  const set = (patch: Partial<TripBrief>) => onChange({ ...brief, ...patch });
  return (
    <section className="trip-panel">
      <h2>{copy.tripSectionTaste}</h2>
      <label className="trip-field">
        <span>{copy.tripPreferences}</span>
        <textarea rows={3} value={brief.preferences} onChange={(e) => set({ preferences: e.target.value })} />
        <small>{copy.tripPreferencesHint}</small>
      </label>
      <label className="trip-field">
        <span>{copy.tripWishes}</span>
        <textarea
          rows={4}
          value={wishText}
          onChange={(e) => {
            const value = e.target.value;
            setWishText(value);
            set({ wishes: value.split("\n").map((line) => line.trim()).filter(Boolean) });
          }}
        />
        <small>{copy.tripWishesHint}</small>
      </label>
    </section>
  );
}

function Slider({ label, hint, value, min, max, onChange }: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const span = Math.max(max - min, 1);
  const style = { "--pct": `${((value - min) / span) * 100}%` } as CSSProperties;
  return (
    <label className="trip-slider">
      <span className="trip-slider-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <input className="trip-range" type="range" min={min} max={max} step={1} value={value} style={style} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="trip-slider-scale"><span>{min}</span><span>{max}</span></span>
      <small>{hint}</small>
    </label>
  );
}

function Choice({ name, checked, title, hint, onChange }: {
  name: string;
  checked: boolean;
  title: string;
  hint: string;
  onChange: () => void;
}) {
  return (
    <label className={`trip-choice${checked ? " on" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <strong>{title}</strong>
      <span>{hint}</span>
    </label>
  );
}

function Switch({ checked, disabled, title, hint, onChange }: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  hint: string;
  onChange: () => void;
}) {
  const state = `${checked ? " on" : ""}${disabled ? " is-off" : ""}`;
  return (
    <label className={`trip-switch${state}`}>
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <span className="trip-knob">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={onChange} />
      </span>
    </label>
  );
}

const EFFORTS = ["low", "medium", "high", "xhigh"] as const;

export function EffortPicker({ value, copy, onChange }: { value: string; copy: Copy; onChange: (next: string) => void }) {
  const labels = { low: copy.tripEffortLow, medium: copy.tripEffortMedium, high: copy.tripEffortHigh, xhigh: copy.tripEffortTop };
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = EFFORTS.indexOf(value as (typeof EFFORTS)[number]);
    const next = EFFORTS[(Math.max(index, 0) + step + EFFORTS.length) % EFFORTS.length];
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-effort="${next}"]`)?.focus();
  };
  return (
    <div className="trip-field">
      <span>{copy.tripEffort}</span>
      <div className="trip-segment" role="radiogroup" aria-label={copy.tripEffort} onKeyDown={move}>
        {EFFORTS.map((id) => (
          <button key={id} type="button" role="radio" data-effort={id} aria-checked={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>
            {labels[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThemeFields({ themes, copy, onChange }: { themes: Theme[]; copy: Copy; onChange: (next: Theme[]) => void }) {
  const set = (index: number, patch: Partial<Theme>) => onChange(themes.map((theme, i) => (i === index ? { ...theme, ...patch } : theme)));
  return (
    <section className="trip-panel">
      <h2>{copy.tripThemes}</h2>
      <p>{copy.tripThemesHint}</p>
      <div className="trip-days">
        {themes.map((theme, index) => (
          <article className="trip-day" key={index}>
            <h3 className="trip-day-h">{copy.tripDay} <span>{index + 1}</span></h3>
            <div className="trip-langs">
              <LangFields mark="EN" theme={theme} copy={copy} onChange={(patch) => set(index, patch)} ru={false} />
              <LangFields mark="RU" theme={theme} copy={copy} onChange={(patch) => set(index, patch)} ru />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LangFields({ mark, theme, copy, ru, onChange }: {
  mark: string;
  theme: Theme;
  copy: Copy;
  ru: boolean;
  onChange: (patch: Partial<Theme>) => void;
}) {
  const title = ru ? theme.titleRu : theme.title;
  const about = ru ? theme.descriptionRu : theme.description;
  return (
    <div>
      <label className="trip-field">
        <span className="trip-lang-name">{mark} · {copy.tripThemeTitle}</span>
        <input value={title} placeholder={copy.tripThemeTitlePh} onChange={(e) => onChange(ru ? { titleRu: e.target.value } : { title: e.target.value })} />
      </label>
      <label className="trip-field">
        <span className="trip-lang-name">{mark} · {copy.tripThemeAbout}</span>
        <textarea rows={2} value={about} placeholder={copy.tripThemeAboutPh} onChange={(e) => onChange(ru ? { descriptionRu: e.target.value } : { description: e.target.value })} />
      </label>
    </div>
  );
}

export function blankTheme(): Theme {
  return { title: "", description: "", titleRu: "", descriptionRu: "" };
}
