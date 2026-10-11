"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { sousVideTiming, duration, HEATING_SOURCE, SALMON_SOURCE, FROZEN_SOURCE } from "@/lib/sous-vide.mjs";

export function SousVideCalculator({ lang, food, state }: {lang: Lang; food: string; state: string}) {
  const ru=lang==="ru";
  const t=(en:string, r:string)=>ru?r:en;
  const [size,setSize]=useState("25");
  const [shape,setShape]=useState("slab");
  const [temp,setTemp]=useState(food==="salmon"?"50":food==="meat"?"57":"60");
  const mm=Number(size);
  const result=sousVideTiming({food,state,mm:size.trim()?mm:NaN,shape,temperature:Number(temp)});
  const salmon=food==="salmon";
  const lean=food==="lean-fish";
  const fatty=food==="salmon-pasteurized";
  const fish=salmon||lean||fatty;
  const maxMm=salmon?38:fish?40:50;
  return <div className="sv-calculator">
    <p>{t("Measure the thickest part. Bag individual portions in one layer, with water circulating on both sides.","Измерьте самую толстую часть. Укладывайте отдельные порции в один слой: вода должна омывать пакет с обеих сторон.")}</p>
    {!fish&&<fieldset className="sv-choice"><legend>{t("Shape", "Форма")}</legend><div className="sv-buttons">
      {[["slab",t("Flat steak / chop","Стейк / отбивная")],["cylinder",t("Tenderloin / cylinder","Вырезка / цилиндр")],["sphere",t("Round portion","Шарообразный кусок")]].map(([value,label])=><button type="button" key={value} aria-pressed={shape===value} onClick={()=>setShape(value)}>{label}</button>)}
    </div></fieldset>}
    <div className="sv-sliders">
      <div className="sv-slider">
        <label htmlFor="sv-size">{shape==="slab"?t("Thickness", "Толщина"):t("Diameter", "Диаметр")}</label>
        <div className="sv-number"><input id="sv-size" type="number" min="5" max={maxMm} step="1" value={size} onChange={e=>setSize(e.target.value)}/><span>{t("mm","мм")}</span></div>
        <input aria-label={shape==="slab"?t("Thickness slider","Ползунок толщины"):t("Diameter slider","Ползунок диаметра")} type="range" min="5" max={maxMm} step="1" value={Number.isFinite(mm)?Math.min(maxMm,Math.max(5,mm)):5} onChange={e=>setSize(e.target.value)}/>
        <div className="sv-range-ends"><span>5 {t("mm","мм")}</span><span>{maxMm} {t("mm","мм")}</span></div>
      </div>
      <div className="sv-slider">
        <label htmlFor={fish?undefined:"sv-temperature"}>{t("Bath temperature", "Температура воды")}</label>
        {fish?<p className="sv-fixed-temp">{temp} °C <small>{t("Fixed for this schedule", "Для выбранного режима")}</small></p>:<>
          <div className="sv-number"><input id="sv-temperature" type="number" min="45" max="80" step="1" value={temp} onChange={e=>setTemp(e.target.value)}/><span>°C</span></div>
          <input aria-label={t("Temperature slider","Ползунок температуры")} type="range" min="45" max="80" step="1" value={Number.isFinite(Number(temp))?Math.min(80,Math.max(45,Number(temp))):45} onChange={e=>setTemp(e.target.value)}/>
          <div className="sv-range-ends"><span>45 °C</span><span>80 °C</span></div>
        </>}
      </div>
    </div>
    <div className="sv-answer" role="status" aria-live="polite" aria-atomic="true">
      {result.error ? <p>{result.error==="long"?t("Too long for this low-temperature heating schedule. Thaw first or use a thinner portion.","Слишком долгий прогрев при такой низкой температуре. Сначала разморозьте или возьмите более тонкий кусок."):result.error==="temperature"?t("Use a bath between 45 and 80°C.","Задайте температуру воды от 45 до 80 °C."):t(`Enter a thickness from 5 to ${maxMm} mm.`, `Введите толщину от 5 до ${maxMm} мм.`)}</p> : <>
        {result.thawFirst&&<p><b>{t("Thaw in the fridge first; then:","Сначала разморозьте в холодильнике, затем:")}</b></p>}
        <p className="sv-result-label">{t("Time in the bath", "Время в воде")} · {temp} °C</p>
        <p className="sv-time">{result.approximate&&t("About ","Около ")}{duration(result.minutes!,lang)}</p>
        <p>{fatty?t("Published fatty-fish pasteurization time for salmon from 5°C at 60°C. Thawing time is separate.","Опубликованное время пастеризации жирной рыбы (лосося) из 5 °C при 60 °C. Разморозка занимает отдельное время."):lean?t("Published lean-fish pasteurization time from 5°C at 60°C. Thawing time is separate; do not use this for salmon or other fatty fish.","Опубликованное время пастеризации нежирной рыбы из 5 °C при 60 °C. Разморозка занимает отдельное время; для лосося и другой жирной рыбы этот режим не подходит."):salmon?t("Recipe cooking time at 50°C; serve immediately. This is not a pasteurization schedule.","Время по рецепту при 50 °C; подавайте сразу. Это не режим пастеризации."):t("Approximate heat-through time, until the centre is within 0.5°C of the bath. This excludes pasteurization and collagen tenderizing.","Ориентировочное время прогрева: центр на 0,5 °C холоднее воды. Пастеризация и размягчение коллагена сюда не входят.")}</p>
        <small>{t(`Uses the ${result.usedMm} mm published row, rounded up from your size.`,`Используется опубликованная строка для ${result.usedMm} мм, с округлением вашей толщины вверх.`)}</small>
        {salmon&&state==="frozen"&&<p>{t("Frozen estimate: the fish-specific recipe time × 1.5, following ChefSteps’ general frozen-food guidance. It is an estimate, not a tested frozen-salmon pasteurization time.","Оценка для замороженного: время рецепта для рыбы × 1,5 по общему совету ChefSteps. Это оценка, а не проверенное время пастеризации замороженного лосося.")}</p>}
      </>}
    </div>
    <p className="sv-help">{fatty?t("Remove reduced-oxygen retail packaging before fridge thawing. Keep portions separate; this schedule starts with salmon fully thawed and chilled to 5°C.","Перед разморозкой в холодильнике снимите упаковку с пониженным содержанием кислорода. Порции держите отдельно; режим начинается с полностью размороженного лосося при 5 °C."):lean?t("For cod and similar lean finfish. Remove reduced-oxygen retail packaging before fridge thawing. Keep portions separate; this schedule starts with fish fully thawed and chilled to 5°C.","Для трески и другой нежирной рыбы. Перед разморозкой в холодильнике снимите упаковку с пониженным содержанием кислорода. Порции держите отдельно; режим начинается с полностью размороженной рыбы при 5 °C."):salmon?t("At 50°C use salmon suitable for undercooked service with supplier-confirmed parasite controls. Ordinary freezer storage does not establish that. For a fully pasteurized option, choose “Salmon · pasteurized” above.","При 50 °C нужен лосось, подходящий для подачи недоготовленным, с подтверждённой поставщиком защитой от паразитов. Обычное хранение в морозилке этого не подтверждает. Для пастеризации выберите «Лосось · пастеризация» выше."):t("Use these heating estimates for tender meat portions. Chicken needs its own poultry schedule; ribs and shanks need their longer texture times. Below 55°C, preparation, cooking and serving together must stay within four hours.","Оценки прогрева подходят для мягких порционных кусков мяса. Для курицы нужен отдельный режим для птицы; рёбрам и голяшкам — длительное приготовление до мягкости. Ниже 55 °C подготовка, готовка и подача вместе должны уложиться в четыре часа.")}</p>
    <p className="sv-sources">{t("Sources: ","Источники: ")}<a href={salmon?SALMON_SOURCE:fish?"https://douglasbaldwin.com/sous-vide.html#Fish_and_Shellfish":HEATING_SOURCE} target="_blank" rel="noopener">{salmon?"ChefSteps — salmon":fish?"Baldwin — 3.1":"Baldwin — 2.2 / 2.3"}</a>{salmon&&<> · <a href={FROZEN_SOURCE} target="_blank" rel="noopener">{t("Frozen timing", "Время из замороженного")}</a></>}</p>
  </div>;
}
