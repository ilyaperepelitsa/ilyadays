"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { foodHref } from "@/lib/paths";
import { sousVideTiming, duration, HEATING_SOURCE, SALMON_SOURCE, FROZEN_SOURCE } from "@/lib/sous-vide.mjs";

export function SousVideCalculator({ lang }: {lang: Lang}) {
  const ru=lang==="ru";
  const t=(en:string, r:string)=>ru?r:en;
  const [food,setFood]=useState("meat");
  const [state,setState]=useState("chilled");
  const [size,setSize]=useState("25");
  const [shape,setShape]=useState("slab");
  const [temp,setTemp]=useState("57");
  const mm=Number(size);
  const result=sousVideTiming({food,state,mm:size.trim()?mm:NaN,shape,temperature:Number(temp)});
  const salmon=food==="salmon";
  const lean=food==="lean-fish";
  const fish=salmon||lean;
  const maxMm=salmon?38:lean?40:50;
  return <section className="block sv-calculator" id="thickness">
    <h2>{t("Time by thickness", "Время по толщине")}</h2>
    <p>{t("Measure the thickest part. Bag individual portions in one layer, with water circulating on both sides.","Измерьте самую толстую часть. Укладывайте отдельные порции в один слой: вода должна омывать пакет с обеих сторон.")}</p>
    <div className="sv-inputs">
      <label>{t("Food", "Продукт")}<select value={food} onChange={e=>{const f=e.target.value;setFood(f);setShape("slab");setTemp(f==="salmon"?"50":f==="lean-fish"?"60":"57");}}>
        <option value="meat">{t("Meat: heat through", "Мясо: прогрев")}</option>
        <option value="lean-fish">{t("Lean fish: pasteurize at 60°C", "Нежирная рыба: пастеризация, 60 °C")}</option>
        <option value="salmon">{t("Salmon: soft at 50°C", "Лосось: нежный, 50 °C")}</option>
      </select></label>
      <label>{t("Starting state", "Начальное состояние")}<select value={state} onChange={e=>setState(e.target.value)}>
        <option value="chilled">{t("Chilled / thawed, 5°C", "Охлаждённый / размороженный, 5 °C")}</option>
        <option value="frozen">{t("Frozen, −18°C", "Замороженный, −18 °C")}</option>
      </select></label>
      <label>{t("Shape", "Форма")}<select value={shape} disabled={fish} onChange={e=>setShape(e.target.value)}>
        <option value="slab">{t("Flat: steak, chop or fillet", "Плоский кусок: стейк, отбивная, филе")}</option>
        <option value="cylinder">{t("Cylinder: tenderloin", "Цилиндр: вырезка")}</option>
        <option value="sphere">{t("Approximately round", "Примерно шарообразный")}</option>
      </select></label>
      <label>{shape==="slab"?t("Thickness, mm", "Толщина, мм"):t("Diameter, mm", "Диаметр, мм")}<input type="number" min="5" max={maxMm} step="1" value={size} onChange={e=>setSize(e.target.value)} /></label>
      <label>{t("Bath temperature, °C", "Температура воды, °C")}<input type="number" min="45" max="80" step="1" value={temp} disabled={fish} onChange={e=>setTemp(e.target.value)} /></label>
    </div>
    <div className="sv-answer" role="status" aria-live="polite" aria-atomic="true">
      {result.error ? <p>{result.error==="long"?t("Too long for this low-temperature heating schedule. Thaw first or use a thinner portion.","Слишком долгий прогрев при такой низкой температуре. Сначала разморозьте или возьмите более тонкий кусок."):result.error==="temperature"?t("Use a bath between 45 and 80°C.","Задайте температуру воды от 45 до 80 °C."):t(`Enter a thickness from 5 to ${maxMm} mm.`, `Введите толщину от 5 до ${maxMm} мм.`)}</p> : <>
        {result.thawFirst&&<p><b>{t("Thaw in the fridge first; then:","Сначала разморозьте в холодильнике, затем:")}</b></p>}
        <p className="sv-time">{result.approximate&&t("About ","Около ")}{duration(result.minutes!,lang)}</p>
        <p>{lean?t("Published lean-fish pasteurization time from 5°C at 60°C. Thawing time is separate; do not use this for salmon or other fatty fish.","Опубликованное время пастеризации нежирной рыбы из 5 °C при 60 °C. Разморозка занимает отдельное время; для лосося и другой жирной рыбы этот режим не подходит."):salmon?t("Recipe cooking time at 50°C; serve immediately. This is not a pasteurization schedule.","Время по рецепту при 50 °C; подавайте сразу. Это не режим пастеризации."):t("Approximate heat-through time, until the centre is within 0.5°C of the bath. This excludes pasteurization and collagen tenderizing.","Ориентировочное время прогрева: центр на 0,5 °C холоднее воды. Пастеризация и размягчение коллагена сюда не входят.")}</p>
        <small>{t(`Uses the ${result.usedMm} mm published row, rounded up from your size.`,`Используется опубликованная строка для ${result.usedMm} мм, с округлением вашей толщины вверх.`)}</small>
        {salmon&&state==="frozen"&&<p>{t("Frozen estimate: the fish-specific recipe time × 1.5, following ChefSteps’ general frozen-food guidance. It is an estimate, not a tested frozen-salmon pasteurization time.","Оценка для замороженного: время рецепта для рыбы × 1,5 по общему совету ChefSteps. Это оценка, а не проверенное время пастеризации замороженного лосося.")}</p>}
      </>}
    </div>
    <p className="sv-help">{lean?t("For cod and similar lean finfish. Remove reduced-oxygen retail packaging before fridge thawing. Keep portions separate; this schedule starts with fish fully thawed and chilled to 5°C.","Для трески и другой нежирной рыбы. Перед разморозкой в холодильнике снимите упаковку с пониженным содержанием кислорода. Порции держите отдельно; режим начинается с полностью размороженной рыбы при 5 °C."):salmon?t("At 50°C use salmon suitable for undercooked service with supplier-confirmed parasite controls. Ordinary freezer storage does not establish that. For a fully pasteurized option, use the chilled 60°C salmon table below.","При 50 °C нужен лосось, подходящий для подачи недоготовленным, с подтверждённой поставщиком защитой от паразитов. Обычное хранение в морозилке этого не подтверждает. Для пастеризации используйте таблицу охлаждённого лосося при 60 °C ниже."):t("Use these heating estimates for tender meat portions. Chicken needs its own poultry schedule; ribs and shanks need their longer texture times. Below 55°C, preparation, cooking and serving together must stay within four hours.","Оценки прогрева подходят для мягких порционных кусков мяса. Для курицы нужен отдельный режим для птицы; рёбрам и голяшкам — длительное приготовление до мягкости. Ниже 55 °C подготовка, готовка и подача вместе должны уложиться в четыре часа.")}</p>
    <p className="sv-sources">{t("Sources: ","Источники: ")}<a href={salmon?SALMON_SOURCE:lean?"https://douglasbaldwin.com/sous-vide.html#Fish_and_Shellfish":HEATING_SOURCE} target="_blank" rel="noopener">{salmon?"ChefSteps — salmon":lean?"Baldwin — 3.1":"Baldwin — 2.2 / 2.3"}</a>{salmon&&<> · <a href={FROZEN_SOURCE} target="_blank" rel="noopener">{t("Frozen timing", "Время из замороженного")}</a></>}{salmon&&<> · <a href={foodHref(lang,"sous-vide-salmon")}>{t("Full salmon recipe", "Полный рецепт лосося")}</a></>}</p>
  </section>;
}
