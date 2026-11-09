"use client";
import { useId, useState } from "react";
import type { Lang } from '@/lib/i18n';
import type { TripBrief, TripCommitment, TripEvent } from '@/lib/trips/types';
import { stayDates } from '@/lib/trips/dates.mjs';
import { acceptEvent } from '@/lib/trips/events.mjs';
const p = (lang: Lang, en: string, ru: string) => lang === 'ru' ? ru : en;
const TIME_ZONES = [
  ['Europe/Lisbon', 'Lisbon', 'Лиссабон'], ['Europe/London', 'London', 'Лондон'], ['Europe/Paris', 'Paris', 'Париж'],
  ['Europe/Rome', 'Rome', 'Рим'], ['Europe/Berlin', 'Berlin', 'Берлин'], ['Europe/Prague', 'Prague', 'Прага'],
  ['Europe/Vienna', 'Vienna', 'Вена'], ['Europe/Madrid', 'Madrid', 'Мадрид'], ['Europe/Athens', 'Athens', 'Афины'],
  ['Europe/Istanbul', 'Istanbul', 'Стамбул'], ['Asia/Yerevan', 'Yerevan', 'Ереван'], ['Asia/Tbilisi', 'Tbilisi', 'Тбилиси'],
  ['Asia/Tokyo', 'Tokyo', 'Токио'], ['Asia/Seoul', 'Seoul', 'Сеул'], ['Asia/Bangkok', 'Bangkok', 'Бангкок'],
  ['Asia/Singapore', 'Singapore', 'Сингапур'], ['America/New_York', 'New York', 'Нью-Йорк'],
  ['America/Chicago', 'Chicago', 'Чикаго'], ['America/Los_Angeles', 'Los Angeles', 'Лос-Анджелес'],
  ['Australia/Sydney', 'Sydney', 'Сидней'], ['Pacific/Auckland', 'Auckland', 'Окленд'], ['UTC', 'UTC', 'UTC'],
];

export function TripDates({ lang, brief, onChange }: { lang: Lang; brief: TripBrief; onChange: (b: TripBrief) => void }) {
  const zoneList = useId();
  const change = (patch: Partial<TripBrief>) => {
    const next = { ...brief, ...patch };
    try {
      const days = stayDates(next.stayStart, next.stayEnd);
      if (days.length && next.routes > days.length) { next.routes = days.length; if (next.routes === 1) next.sharedSpine = false; }
    } catch { /* incomplete date fields remain editable */ }
    onChange(next);
  };
  return <section className="trip-panel" id="trip-dates" data-testid="trip-dates">
    <h2>{p(lang, 'Dates of your stay', 'Даты поездки')}</h2>
    <p>{p(lang, 'Optional. Dates are local to your destination. Each walking route uses one day, starting on arrival.', 'Необязательно. Даты — по местному времени города. Каждый маршрут занимает день, начиная с приезда.')}</p>
    <div className="trip-metrics">
      <label className="trip-field"><span>{p(lang, 'Arrival', 'Приезд')}</span><input type="date" data-testid="trip-arrival" value={brief.stayStart ?? ''} onChange={(e) => change({ stayStart: e.target.value })} /></label>
      <label className="trip-field"><span>{p(lang, 'Departure (included)', 'Отъезд (включительно)')}</span><input type="date" data-testid="trip-departure" min={brief.stayStart} value={brief.stayEnd ?? ''} onChange={(e) => change({ stayEnd: e.target.value })} /></label>
    </div>
    <label className="trip-field"><span>{p(lang, 'Destination time zone', 'Часовой пояс города')}</span><input data-testid="trip-timezone" list={zoneList} value={brief.timeZone ?? ''} placeholder={p(lang, "Search a city, e.g. Rome", "Найдите город, например Рим")} onChange={(e) => change({ timeZone: e.target.value })} autoComplete="off" /><small>{p(lang, 'Required for events. Choose the venue’s local clock, which may differ from your phone’s. Search a city or enter a zone such as Europe/Rome.', 'Нужно для событий. Выберите местное время площадки: оно может отличаться от времени телефона. Найдите город или введите пояс, например Europe/Rome.')}</small></label>
    <datalist id={zoneList}>{TIME_ZONES.map(([zone, en, ru]) => <option key={zone} value={zone} label={p(lang, en, ru)} />)}</datalist>
  </section>;
}

export function EventRecommendations({ lang, brief, events, accepted, searched, unavailableSources, busy, signedIn, onSearch, onChange, onError, onSignIn }: {
  lang: Lang; brief: TripBrief; events: TripEvent[]; accepted: TripCommitment[]; searched: boolean; unavailableSources: number; busy: boolean; signedIn: boolean;
  onSearch: () => void; onChange: (next: TripCommitment[]) => void; onError: (e: unknown) => void; onSignIn: () => void;
}) {
  const relevant = events.filter((e) => !accepted.some((c) => c.event.id === e.id));
  return <section className="trip-panel" data-testid="trip-event-recommendations">
    <h2>{p(lang, 'Concerts, exhibitions and events', 'Концерты, выставки и события')}</h2>
    <p>{p(lang, 'Search for these stay dates, review the publisher’s listing, then choose what to add. Accepted events become fixed appointments; tickets are never booked automatically.', 'Найдите события на даты поездки, проверьте страницу организатора и выберите, что добавить. Принятые события станут фиксированными пунктами; билеты автоматически не покупаются.')}</p>
    {!signedIn ? <button type="button" className="button ghost" onClick={onSignIn}>{p(lang, 'Sign in to check event sources', 'Войти для проверки событий')}</button> : <button type="button" data-testid="trip-find-events" className="button ghost" disabled={busy || !brief.stayStart || !brief.stayEnd || !brief.timeZone} onClick={onSearch}>{p(lang, 'Find events for my dates', 'Найти события на мои даты')}</button>}
    <p className="trip-hint">{p(lang, 'Live search uses your API key. Only listings with publisher-published venue and date data can be suggested. No results does not mean there are no events.', 'Поиск использует ваш API-ключ. Предлагаются только события с датой и местом, опубликованными организатором. Отсутствие результатов не означает отсутствия событий.')}</p>
    {searched && unavailableSources > 0 ? <p role="status" data-testid="trip-events-partial">{p(lang, 'Some publisher pages could not be checked. These results are incomplete; try again later.', 'Часть страниц организаторов недоступна. Результаты неполные; повторите поиск позже.')}</p> : null}
    {searched && !events.length ? <p role="status" data-testid="trip-no-events">{p(lang, 'No source-confirmed events found. You can still create the trip or search again later.', 'Не найдены события с подтверждёнными данными. Можно создать поездку или повторить поиск позже.')}</p> : null}
    {accepted.length ? <div data-testid="trip-accepted-events"><h3>{p(lang, 'Fixed in your plan', 'Закреплено в плане')}</h3>{accepted.map((c) => <article className="trip-day" key={c.event.id}>
      <strong>{c.event.name}</strong><p>{c.date} · {c.visitTime} · {c.durationMinutes} {p(lang, 'min', 'мин')} · {c.event.venue}</p>
      <a href={c.event.sourceUrl} target="_blank" rel="noopener noreferrer">{p(lang, 'Publisher’s listing', 'Страница организатора')}</a>{' '}
      <button type="button" className="button ghost" data-testid="trip-remove-event" onClick={() => onChange(accepted.filter((x) => x.event.id !== c.event.id))}>{p(lang, 'Remove from plan', 'Убрать из плана')}</button>
    </article>)}</div> : null}
    {relevant.map((event) => <EventChoice key={event.id} lang={lang} event={event} brief={brief} onAccept={(c) => onChange([...accepted, c])} onError={onError} />)}
  </section>;
}

function EventChoice({ lang, event, brief, onAccept, onError }: { lang: Lang; event: TripEvent; brief: TripBrief; onAccept: (c: TripCommitment) => void; onError: (e: unknown) => void }) {
  // Uncontrolled review fields keep a publisher's fixed concert time immutable.
  const [date, setDate] = useState(event.availableFrom > (brief.stayStart ?? '') ? event.availableFrom : brief.stayStart ?? '');
  const [time, setTime] = useState(event.fixedTime || '12:00');
  const [duration, setDuration] = useState(event.durationMinutes ?? 90);
  return <article className="trip-day" data-testid="trip-event-option">
    <h3>{event.name}</h3><p>{event.venue} · {event.address}</p><p>{event.availableFrom}{event.availableThrough !== event.availableFrom ? ` — ${event.availableThrough}` : ''}{event.fixedTime ? ` · ${event.fixedTime} ${event.timeZone} ${event.utcOffset ?? ""}` : ''}</p>
    <p><a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{p(lang, 'Check the publisher’s listing', 'Проверить страницу организатора')}</a>{event.ticketUrl ? <> · <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">{p(lang, 'Tickets / availability', 'Билеты / наличие')}</a></> : null}</p>
    <div className="trip-metrics">
      <label className="trip-field"><span>{p(lang, 'Visit date', 'Дата посещения')}</span><input type="date" value={date} min={event.availableFrom > (brief.stayStart ?? "") ? event.availableFrom : brief.stayStart} max={event.kind !== 'exhibition' ? event.availableFrom : event.availableThrough < (brief.stayEnd ?? '') ? event.availableThrough : brief.stayEnd} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="trip-field"><span>{event.fixedTime ? p(lang, 'Published start time', 'Опубликованное начало') : p(lang, 'Your planned visit time', 'Планируемое время посещения')}</span><input type="time" value={time} disabled={Boolean(event.fixedTime)} onChange={(e) => setTime(e.target.value)} /></label>
      <label className="trip-field"><span>{p(lang, 'Time to allow (minutes)', 'Выделить времени (минут)')}</span><input type="number" min={event.durationMinutes ?? 15} max={720} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
    </div>
    {!event.fixedTime ? <p>{p(lang, 'The listing does not fix a visit time. The time above is your own planning choice; check opening hours.', 'На странице нет фиксированного времени визита. Время выше — ваш выбор для плана; проверьте часы работы.')}</p> : null}
    <button type="button" className="button" data-testid="trip-accept-event" onClick={() => { try { onAccept(acceptEvent(event, brief, { date, visitTime: time, durationMinutes: duration })); } catch (e) { onError(e); } }}>{p(lang, 'Agree — add as a fixed event', 'Согласен — закрепить в плане')}</button>
  </article>;
}
