"use client";
/**
 * /fitness/progress (stream 06 — plans/fitness/06-progress-analytics.md): body weight, strength, volume, adherence
 * and the fitness–fatigue model from the local-first snapshot. Writes (weigh-ins) only when the store can write.
 * Before hydration (no clock yet) the sections render their titles only.
 */
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { useFitness } from "../Provider";
import { AdherenceSection } from "./AdherenceSection";
import { BodyweightSection } from "./BodyweightSection";
import { MeasurementsPanel } from "./MeasurementsPanel";
import { ModelSection } from "./ModelSection";
import { SECTIONS, sectionTitle } from "./names";
import { Empty, Section, useNow } from "./shared";
import { StrengthSection } from "./StrengthSection";
import type { ProgressCatalog, ProgressGroup } from "./types";
import { useProgressData } from "./useProgressData";
import { VolumeSection } from "./VolumeSection";

export function ProgressPanel({ lang, catalog, groups }: { lang: Lang; catalog: ProgressCatalog; groups: ProgressGroup[] }) {
  const { snapshot, store, canWrite } = useFitness();
  const now = useNow();
  const data = useProgressData(snapshot, catalog);
  return (
    <div className="fitp">
      <nav className="fitp-jump" aria-label={pick(lang, "Progress sections", "Разделы прогресса")}>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {pick(lang, s.short[0], s.short[1])}
          </a>
        ))}
      </nav>
      {now == null ? (
        SECTIONS.map((s) => (
          <Section key={s.id} id={s.id} title={sectionTitle(s.id, lang)}>
            <Empty>{pick(lang, "Loading…", "Загрузка…")}</Empty>
          </Section>
        ))
      ) : (
        <>
          <BodyweightSection lang={lang} data={data} now={now} canWrite={canWrite} store={store} defaultKg={snapshot.settings?.bodyweightKg ?? null} goal={snapshot.settings?.goal ?? null} />
          <MeasurementsPanel lang={lang} now={now} />
          <StrengthSection lang={lang} data={data} catalog={catalog} now={now} />
          <VolumeSection lang={lang} data={data} catalog={catalog} groups={groups} now={now} />
          <AdherenceSection lang={lang} data={data} now={now} />
          <ModelSection lang={lang} data={data} now={now} />
        </>
      )}
    </div>
  );
}
