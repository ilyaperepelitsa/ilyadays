"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFitness } from "../Provider";
import { useStoreStatus } from "../ModeNote";
import { localPath } from "@/lib/i18n";
import { pick, t2 } from "@/lib/fitness/i18n";
import { GOAL_MODES, GOAL_IDS } from "@/lib/fitness/templates.mjs";
import { commitProgram, programDiff } from "@/lib/fitness/program-edit.mjs";
import { manualAdjustmentRow } from "@/lib/fitness/advisor.mjs";
import { defaultSettings } from "@/lib/fitness/store-core.mjs";
import { displayNameOf, isSyncedStore } from "@/lib/fitness/store";
import { profileErrors, profileName, profilePreferences, profilePlanDraft } from "@/lib/fitness/profile-core.mjs";
import type { GoalMode, Lang, TrainingPreferences } from "@/lib/fitness/types";

export function ProfilePanel({ lang }: { lang: Lang }) {
  const { auth, mode } = useFitness();
  const status = useStoreStatus();
  if (mode === "loading" || (mode === "synced" && status?.profile === "unknown")) return <p role="status">{pick(lang, "Loading your profile…", "Загружаем ваш профиль…")}</p>;
  return <ProfileForm key={auth.user?.id ?? "local"} lang={lang} />;
}

function ProfileForm({ lang }: { lang: Lang }) {
  const { auth, snapshot, store, mode, canWrite } = useFitness();
  const status = useStoreStatus();
  const own = canWrite ? snapshot : null;
  const saved = own?.activeProgramId ? own.programs[own.activeProgramId] : null;
  const initial = own?.settings;
  const prefs = saved?.preferences ?? initial?.trainingPreferences;
  const [name, setName] = useState(status?.profileDetails?.displayName ?? initial?.profileName ?? displayNameOf(auth.user));
  const [isPublic, setPublic] = useState(status?.profileDetails?.isPublic ?? false);
  const [goal, setPrimary] = useState<GoalMode>(saved?.goal ?? initial?.goal ?? "recomp");
  const [secondary, setSecondary] = useState<GoalMode[]>(prefs?.secondaryGoals ?? []);
  const [scope, setScope] = useState<TrainingPreferences["bodyScope"]>(prefs?.bodyScope ?? "upper");
  const [days, setFrequency] = useState<2 | 3 | 4>(saved?.daysPerWeek ?? initial?.daysPerWeek ?? 3);
  const [weight, setWeight] = useState(initial?.bodyweightKg == null ? "" : String(initial.bodyweightKg));
  const [height, setHeight] = useState(initial?.heightCm == null ? "" : String(initial.heightCm));
  const [applyPlan, setApplyPlan] = useState(!saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const preferences = useMemo(() => profilePreferences(prefs, scope, secondary, goal), [prefs, scope, secondary, goal]);
  const preview = useMemo(() => applyPlan ? profilePlanDraft(saved, {goal,days,preferences,title:pick(lang,"My program","Моя программа")}, own?.exerciseState ?? {}, new Date().toISOString()) : null,
    [applyPlan,saved,goal,days,preferences,lang,own?.exerciseState]);
  const canSave = canWrite || Boolean(auth.user);
  const parse = (text: string) => text.trim() ? Number(text.trim().replace(",", ".")) : null;
  const save = async () => {
    setError(""); setMessage("");
    if (applyPlan && (!preview || preview.days.some((d) => !d.slots.length))) {
      setError(pick(lang, "Every training day needs an exercise. Adjust the plan in the constructor, or save your profile without applying a new plan.", "В каждом тренировочном дне нужно упражнение. Измените план в конструкторе или сохраните профиль без новой программы.")); return;
    }
    const bw = parse(weight); const cm = parse(height);
    if (profileErrors(name, bw, cm).length) { setError(pick(lang, "Enter a name and valid optional measurements (weight 20–400 kg, height 100–250 cm).", "Введите имя и корректные необязательные измерения (вес 20–400 кг, рост 100–250 см).")); return; }
    setBusy(true);
    const account = auth.user?.id ?? null;
    try {
      const cloud = isSyncedStore(store) ? store : null;
      if (account && cloud) {
        const result = mode === "synced" && status?.profile === "present"
          ? await cloud.updateProfile({ displayName: profileName(name), isPublic })
          : await cloud.registerProfile(profileName(name));
        if (!result.ok) throw new Error(result.error ?? "Profile could not be saved");
        if (cloud.getStatus().userId !== account || cloud.mode() !== "synced") throw new Error(pick(lang, "Your account changed. Reload and try again.", "Аккаунт изменился. Обновите страницу и повторите."));
      }
      if (!store.canWrite()) throw new Error(pick(lang, "Sign in to create your profile.", "Войдите, чтобы создать профиль."));
      const fresh = store.getSnapshot();
      const at = new Date().toISOString();
      const settings = { ...(fresh.settings ?? defaultSettings()), profileName: profileName(name), ...(applyPlan ? { goal, daysPerWeek: days, trainingPreferences: preferences } : {}), updatedAt: at };
      if (bw != null) settings.bodyweightKg = bw; else delete settings.bodyweightKg;
      if (cm != null) settings.heightCm = cm; else delete settings.heightCm;
      store.upsert("settings", settings);
      if (applyPlan && preview) {
        const current = fresh.activeProgramId ? fresh.programs[fresh.activeProgramId] : null;
        const committed = commitProgram(current, preview, at);
        if (committed.archived) store.upsert("programs", committed.archived);
        store.upsert("programs", committed.program);
        store.upsert("adjustments", manualAdjustmentRow({ now: at, before: current, after: committed.program, lines: programDiff(current ?? preview, committed.program).map((l) => l.text) }));
      }
      setMessage(pick(lang, "Profile saved. Your plan and training history are ready.", "Профиль сохранён. Программа и история тренировок готовы."));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <div className="fprofile" data-testid="profile-panel">
    {!auth.user ? <div className="fit-note"><p>{pick(lang, "You can use a profile on this device. Sign in to create a private account and sync across devices.", "Можно пользоваться профилем на этом устройстве. Войдите, чтобы создать приватный аккаунт и синхронизировать данные.")}</p>
      {auth.configured ? <button type="button" className="fit-button quiet" onClick={() => void auth.signIn()}>{pick(lang, "Sign in with Google", "Войти через Google")}</button> : null}</div> : null}
    <form className="fit-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2>{pick(lang, "Your profile", "Ваш профиль")}</h2>
      {auth.user?.email ? <p>{auth.user.email}</p> : null}
      <label>{pick(lang, "Display name", "Имя")}<input data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" /></label>
      <div className="fprofile-grid">
        <label>{pick(lang, "Bodyweight (kg, optional)", "Вес тела (кг, необязательно)")}<input data-testid="profile-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <label>{pick(lang, "Height (cm, optional)", "Рост (см, необязательно)")}<input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
      </div>
      <p className="fit-muted">{pick(lang, "This weight sets your profile context. Record dated weigh-ins and waist/arm measurements on Progress; exercise weights are logged with each set.", "Этот вес задаёт контекст профиля. Взвешивания и замеры талии/рук с датами записывайте в «Прогрессе»; веса упражнений — в каждом подходе.")}</p>
      {mode === "synced" && status?.profile === "present" ? <label className="fprofile-check"><input data-testid="profile-public" type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />{pick(lang, "Make my fitness log public", "Открыть мой фитнес-журнал для всех")}</label> : <p className="fit-note">{pick(lang, "New accounts are private. Sharing is optional after your profile is created.", "Новые аккаунты приватны. Открыть данные можно после создания профиля.")}</p>}
      {isPublic ? <p className="fit-note">{pick(lang, "Public means your programs, workouts, bodyweight, body measurements, gyms and profile settings can be read by other people. Turn this off to keep them private.", "Публичный доступ открывает программы, тренировки, вес тела, замеры, залы и настройки другим людям. Отключите его для приватности.")}</p> : null}
      <label className="fprofile-check"><input data-testid="profile-apply-plan" type="checkbox" checked={applyPlan} onChange={(e) => setApplyPlan(e.target.checked)} />{saved ? pick(lang, "Apply these goals to a new version of my plan", "Применить эти цели в новой версии программы") : pick(lang, "Create my first plan", "Создать первую программу")}</label>
      <fieldset disabled={!applyPlan || busy}>
        <legend>{pick(lang, "Training preferences", "Предпочтения тренировок")}</legend>
        <label>{pick(lang, "Primary goal", "Главная цель")}<select data-testid="profile-goal" value={goal} onChange={(e) => { const value = e.target.value as GoalMode; setPrimary(value); setSecondary((s) => s.filter((g) => g !== value)); }}>{GOAL_IDS.map((g) => <option key={g} value={g}>{t2(lang, GOAL_MODES[g].name)}</option>)}</select></label>
        <p className="fit-muted">{pick(lang, "The primary goal sets reps, rest and progression. Up to two supporting goals record your priorities without mixing incompatible prescriptions.", "Главная цель задаёт повторения, отдых и прогрессию. До двух дополнительных целей фиксируют приоритеты без смешивания противоречащих режимов.")}</p>
        <div className="fprofile-options">{GOAL_IDS.filter((g) => g !== goal).map((g) => <label className="fprofile-check" key={g}><input type="checkbox" data-testid={`profile-secondary-${g}`} checked={secondary.includes(g)} disabled={!secondary.includes(g) && secondary.length >= 2} onChange={(e) => setSecondary((s) => e.target.checked ? [...s, g] : s.filter((v) => v !== g))} />{t2(lang, GOAL_MODES[g].name)}</label>)}</div>
        <label>{pick(lang, "Training days per week", "Тренировок в неделю")}<select data-testid="profile-days" value={days} onChange={(e) => setFrequency(Number(e.target.value) as 2 | 3 | 4)}>{[2, 3, 4].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>{pick(lang, "Body scope", "Что тренировать")}<select data-testid="profile-scope" value={scope} onChange={(e) => setScope(e.target.value as TrainingPreferences["bodyScope"])}><option value="upper">{pick(lang, "Upper body — no legs", "Верх тела — без ног")}</option><option value="full">{pick(lang, "Full body", "Всё тело")}</option><option value="custom">{pick(lang, "Custom — choose muscles in the constructor", "Свои группы — выбрать в конструкторе")}</option></select></label>
      </fieldset>
      {preview ? <div className="fit-note" data-testid="profile-plan-preview"><strong>{pick(lang, "Plan preview", "Предпросмотр программы")}</strong><p>{preview.days.map((d) => `${t2(lang, d.name)}: ${d.slots.length} ${pick(lang, "exercises", "упражнений")}`).join(" · ")}</p><p>{pick(lang, "Saving archives the previous plan. Your logged sets, baselines and any running workout stay intact.", "Сохранение архивирует предыдущую программу. Подходы, базовые веса и текущая тренировка сохраняются.")}</p></div> : null}
      {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      <div className="fprofile-actions"><button type="submit" className="fit-button" data-testid="profile-save" disabled={!canSave || busy || status?.syncing}>{busy ? pick(lang, "Saving…", "Сохраняем…") : pick(lang, "Save profile", "Сохранить профиль")}</button><Link prefetch={false} className="fit-button quiet" href={localPath(lang, "/fitness/program")}>{pick(lang, "Open plan constructor", "Открыть конструктор")}</Link><Link prefetch={false} href={localPath(lang, "/fitness/progress")}>{pick(lang, "Weigh-ins and measurements", "Взвешивания и замеры")}</Link></div>
    </form>
  </div>;
}
