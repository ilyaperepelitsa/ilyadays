"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
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
import { GoalPicker } from "../GoalPicker";
import { PlanPreview } from "./PlanPreview";
import { SelectionGroup } from "../SelectionGroup";
import { GROUPS } from "@/lib/fitness/catalog.mjs";
import { LOWER_BODY_GROUPS } from "@/lib/fitness/plan-preferences.mjs";
import { profileSelection } from "@/lib/fitness/selection-query.mjs";

const subscribeNothing = () => () => {};

export function ProfilePanel({ lang }: { lang: Lang }) {
  const { auth, mode } = useFitness();
  const status = useStoreStatus();
  const search = useSyncExternalStore(subscribeNothing, () => location.search, () => "");
  const preset = profileSelection(search, GROUPS.map((g) => g.id));
  if (mode === "loading" || (mode === "synced" && status?.profile === "unknown")) return <p role="status">{pick(lang, "Loading your profile…", "Загружаем ваш профиль…")}</p>;
  return <ProfileForm key={`${auth.user?.id ?? "local"}:${JSON.stringify(preset)}`} lang={lang} preset={preset} />;
}

function ProfileForm({ lang, preset }: { lang: Lang; preset: ReturnType<typeof profileSelection> }) {
  const { auth, snapshot, store, mode, canWrite } = useFitness();
  const status = useStoreStatus();
  const own = canWrite ? snapshot : null;
  const saved = own?.activeProgramId ? own.programs[own.activeProgramId] : null;
  const initial = own?.settings;
  const prefs = saved?.preferences ?? initial?.trainingPreferences;
  const [name, setName] = useState(status?.profileDetails?.displayName ?? initial?.profileName ?? displayNameOf(auth.user));
  const [isPublic, setPublic] = useState(status?.profileDetails?.isPublic ?? false);
  const [goal, setPrimary] = useState<GoalMode>(preset?.goals[0] ?? saved?.goal ?? initial?.goal ?? "recomp");
  const [secondary, setSecondary] = useState<GoalMode[]>(preset?.goals.length ? preset.goals.slice(1) : prefs?.secondaryGoals ?? []);
  const [scope, setScope] = useState<TrainingPreferences["bodyScope"]>(prefs?.bodyScope ?? (preset?.focusGroups.some((g) => LOWER_BODY_GROUPS.includes(g)) ? "full" : "upper"));
  const [focus, setFocus] = useState(preset?.focusGroups.length ? preset.focusGroups : prefs?.focusGroups ?? []);
  const [days, setFrequency] = useState<2 | 3 | 4>(saved?.daysPerWeek ?? initial?.daysPerWeek ?? 3);
  const [weight, setWeight] = useState(initial?.bodyweightKg == null ? "" : String(initial.bodyweightKg));
  const [height, setHeight] = useState(initial?.heightCm == null ? "" : String(initial.heightCm));
  const [applyPlan, setApplyPlan] = useState(Boolean(preset) || !saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const preferences = useMemo(() => profilePreferences(prefs, scope, secondary, goal, focus), [prefs, scope, secondary, goal, focus]);
  const conflict = focus.filter((g) => preferences.excludedGroups.includes(g));
  const preview = useMemo(() => applyPlan ? profilePlanDraft(saved, {goal,days,preferences,title:pick(lang,"My program","Моя программа")}, own?.exerciseState ?? {}, new Date().toISOString()) : null,
    [applyPlan,saved,goal,days,preferences,lang,own?.exerciseState]);
  const canSave = canWrite || Boolean(auth.user);
  const parse = (text: string) => text.trim() ? Number(text.trim().replace(",", ".")) : null;
  const save = async () => {
    setError(""); setMessage("");
    if (applyPlan && conflict.length) { setError(pick(lang, "Some focus muscles are excluded. Change your training scope or remove those focus choices before saving.", "Некоторые приоритетные мышцы исключены. Измените охват тренировки или снимите эти приоритеты перед сохранением.")); return; }
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
    {!auth.user ? <div className="fprofile-auth"><p>{pick(lang, "Private by default. Sign in to sync across devices.", "Приватно по умолчанию. Войдите для синхронизации.")}</p>
      {auth.configured ? <button type="button" className="fit-button quiet" onClick={() => void auth.signIn()}>{pick(lang, "Sign in with Google", "Войти через Google")}</button> : null}</div> : null}
    <form className="fprofile-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="fprofile-workspace"><div className="fprofile-fields">
      <section className="fprofile-section"><h2>{pick(lang, "About you", "О вас")}</h2>
      {auth.user?.email ? <p>{auth.user.email}</p> : null}
      <div className="fprofile-basics-grid"><label>{pick(lang, "Display name", "Имя")}<input data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" /></label>
      <div className="fprofile-grid">
        <label>{pick(lang, "Bodyweight (kg, optional)", "Вес тела (кг, необязательно)")}<input data-testid="profile-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <label>{pick(lang, "Height (cm, optional)", "Рост (см, необязательно)")}<input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
      </div></div>
      <p className="fit-muted fprofile-helper">{pick(lang, "Optional starting measurements. Dated weigh-ins and body measurements go on Progress.", "Необязательные начальные измерения. Взвешивания и замеры с датами — в «Прогрессе».")}</p>
      {mode === "synced" && status?.profile === "present" ? <label className="fprofile-check"><input data-testid="profile-public" type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />{pick(lang, "Make my fitness log public", "Открыть мой фитнес-журнал для всех")}</label> : <p className="fprofile-helper fit-muted">{pick(lang, "New accounts are private. Sharing is optional.", "Новые аккаунты приватны. Публичный доступ необязателен.")}</p>}
      {isPublic ? <p className="fit-note">{pick(lang, "Public means your programs, workouts, bodyweight, body measurements, gyms and profile settings can be read by other people. Turn this off to keep them private.", "Публичный доступ открывает программы, тренировки, вес тела, замеры, залы и настройки другим людям. Отключите его для приватности.")}</p> : null}
      </section>
      <label className="fprofile-check fprofile-apply"><input data-testid="profile-apply-plan" type="checkbox" checked={applyPlan} onChange={(e) => setApplyPlan(e.target.checked)} />{saved ? pick(lang, "Apply these goals to a new version of my plan", "Применить эти цели в новой версии программы") : pick(lang, "Create my first plan", "Создать первую программу")}</label>
      <fieldset className="fprofile-section fprofile-preferences" disabled={!applyPlan || busy}>
        <legend>{pick(lang, "Training preferences", "Предпочтения тренировок")}</legend>
        <h3>{pick(lang, "Primary goal", "Главная цель")}</h3>
        <GoalPicker lang={lang} value={goal} testId="profile-goal" disabled={!applyPlan || busy} onChange={(value) => { setPrimary(value); setSecondary((s) => s.filter((g) => g !== value)); }} />
        <p className="fit-muted fprofile-helper">{pick(lang, "These are the main-lift targets. RIR means clean reps left in reserve when you stop.", "Это цели для основных упражнений. RIR — сколько чистых повторений остаётся в запасе.")}</p>
        <h3>{pick(lang, "Supporting goals · choose several", "Дополнительные цели · выберите несколько")}</h3>
        <SelectionGroup label={pick(lang, "Supporting goals", "Дополнительные цели")} values={secondary} testId="profile-secondary" options={GOAL_IDS.filter((g) => g !== goal).map((g) => ({ id: g, label: t2(lang, GOAL_MODES[g].name) }))} onChange={setSecondary} />
        <div className="fprofile-grid"><label>{pick(lang, "Training days per week", "Тренировок в неделю")}<select data-testid="profile-days" value={days} onChange={(e) => setFrequency(Number(e.target.value) as 2 | 3 | 4)}>{[2, 3, 4].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>{pick(lang, "Body scope", "Что тренировать")}<select data-testid="profile-scope" value={scope} onChange={(e) => setScope(e.target.value as TrainingPreferences["bodyScope"])}><option value="upper">{pick(lang, "Upper body — no legs", "Верх тела — без ног")}</option><option value="full">{pick(lang, "Full body", "Всё тело")}</option><option value="custom">{pick(lang, "Custom — choose muscles in the constructor", "Свои группы — выбрать в конструкторе")}</option></select></label></div>
        <h3>{pick(lang, "Focus muscles · choose several", "Приоритетные мышцы · выберите несколько")}</h3>
        {preferences.excludedGroups.length ? <p className="fit-muted fprofile-helper">{pick(lang, "Unavailable muscles are excluded by your training scope. Choose Full body to include legs; custom exclusions can be changed in the constructor.", "Недоступные мышцы исключены настройками тренировки. Для ног выберите «Всё тело»; свои исключения можно изменить в конструкторе.")}</p> : null}
        <SelectionGroup label={pick(lang, "Focus muscles", "Приоритетные мышцы")} values={focus} testId="profile-focus" onChange={setFocus}
          options={GROUPS.map((g) => ({ id: g.id, label: t2(lang, g.name), disabled: preferences.excludedGroups.includes(g.id) && !focus.includes(g.id), description: preferences.excludedGroups.includes(g.id) ? pick(lang, "Excluded by your training scope", "Исключено настройками тренировки") : undefined }))} />
        <p className="fit-muted fprofile-helper">{pick(lang, "Focus exercises come first. Missing targets can be added to the preview within the plan’s volume range. Review the week before saving; supporting goals do not change your primary prescription.", "Приоритетные упражнения идут первыми. Недостающие группы могут добавляться в предпросмотр в пределах объёма программы. Проверьте неделю перед сохранением: дополнительные цели не меняют основное предписание.")}</p>
        {conflict.length ? <p role="alert">{pick(lang, "Change the training scope or remove excluded focus muscles:", "Измените охват тренировки или снимите исключённые приоритеты:")} {conflict.map((g) => t2(lang, GROUPS.find((v) => v.id === g)?.name, g)).join(", ")}</p> : null}
      </fieldset>
      <p className="fit-muted fprofile-helper">{pick(lang, "A new plan keeps your past workouts, baselines and any session already in progress.", "Новая программа сохраняет прошлые тренировки, базовые веса и уже начатую тренировку.")}</p>
      </div><PlanPreview lang={lang} program={preview ?? saved} isDraft={applyPlan} /></div>
      {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      {!canSave ? <p className="fit-muted">{pick(lang, "Sign in to save your profile. You can explore the plan preview before signing in.", "Войдите, чтобы сохранить профиль. До входа можно настроить и посмотреть программу.")}</p> : null}
      <div className="fprofile-actions"><button type="submit" className="fit-button" data-testid="profile-save" disabled={!canSave || busy || status?.syncing}>{busy ? pick(lang, "Saving…", "Сохраняем…") : pick(lang, "Save profile", "Сохранить профиль")}</button><Link prefetch={false} className="fit-button quiet" href={localPath(lang, "/fitness/program")}>{pick(lang, "Open plan constructor", "Открыть конструктор")}</Link><Link prefetch={false} href={localPath(lang, "/fitness/progress")}>{pick(lang, "Weigh-ins and measurements", "Взвешивания и замеры")}</Link></div>
    </form>
  </div>;
}
