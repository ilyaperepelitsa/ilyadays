/** Published lookup rows, not a fitted formula. Minutes. See art/sous-vide/reference-review.json. */
export const HEATING_SOURCE = 'https://douglasbaldwin.com/sous-vide.html#Table_2.2';
export const SALMON_SOURCE = 'https://www.chefsteps.com/recipes/sous-vide-salmon';
export const FROZEN_SOURCE = 'https://www.chefsteps.com/guides-tools/you-can-cook-frozen-food-sous-vide-without-defrosting-here-s-how';
export const HEATING_ROWS = [
  { mm: 5, chilled: [5,5,4], frozen: [7,7,6] },
  { mm: 10, chilled: [19,11,8], frozen: [30,17,12] },
  { mm: 15, chilled: [35,18,13], frozen: [50,30,20] },
  { mm: 20, chilled: [50,30,20], frozen: [75,40,30] },
  { mm: 25, chilled: [75,40,25], frozen: [105,55,40] },
  { mm: 30, chilled: [90,50,35], frozen: [135,75,55] },
  { mm: 35, chilled: [120,60,45], frozen: [180,90,75] },
  { mm: 40, chilled: [150,75,55], frozen: [210,120,90] },
  { mm: 45, chilled: [180,90,75], frozen: [270,150,105] },
  { mm: 50, chilled: [210,120,90], frozen: [315,165,120] },
];
export const SALMON_ROWS = [{mm:13, minutes:30},{mm:25, minutes:40},{mm:38, minutes:60}];
// Baldwin table 3.1, lean fish starting at 5°C, bath 60°C. Includes pasteurization.
export const LEAN_FISH_ROWS = [30,35,50,60,75,105,120,135].map((minutes,i)=>({mm:(i+1)*5,minutes}));
/** @param {{food: string, state: string, mm: number, shape?: string, temperature?: number}} input */
export function sousVideTiming({food, state, mm, shape='slab', temperature=57}) {
  if (!['meat','salmon','lean-fish'].includes(food) || !['chilled','frozen'].includes(state) ||
      !Number.isFinite(mm) || mm<5 || mm>(food==='salmon'?38:food==='lean-fish'?40:50)) return {error:'size'};
  if (food==='lean-fish') {
    if (temperature!==60 || shape!=='slab') return {error:'temperature'};
    const row=LEAN_FISH_ROWS.find(r=>r.mm>=mm);
    return {minutes:row.minutes,usedMm:row.mm,approximate:false,kind:'pasteurization',thawFirst:state==='frozen'};
  }
  if (food==='salmon') {
    // Recipe doneness at 50°C, not a heat-transfer or pasteurization calculation.
    if (temperature!==50 || shape!=='slab') return {error:'temperature'};
    const row=SALMON_ROWS.find(r=>r.mm>=mm);
    return {minutes:Math.ceil(row.minutes*(state==='frozen'?1.5:1)), usedMm:row.mm,
      approximate:state==='frozen', kind:'recipe'};
  }
  const column=['slab','cylinder','sphere'].indexOf(shape);
  if (column<0 || !Number.isFinite(temperature) || temperature<45 || temperature>80) return {error:'temperature'};
  const row=HEATING_ROWS.find(r=>r.mm>=mm);
  const minutes=row[state][column];
  // Excludes preparation and serving; a shorter result is not a safety clearance.
  if (temperature<55 && minutes>=240) return {error:'long',usedMm:row.mm};
  return {minutes,usedMm:row.mm,approximate:true,kind:'heating'};
}
export function duration(minutes, lang='en') {
  const hours=Math.floor(minutes/60), rest=minutes%60;
  return [hours?`${hours} ${lang==='ru'?'ч':'h'}`:'',rest?`${rest} ${lang==='ru'?'мин':'min'}`:''].filter(Boolean).join(' ');
}
