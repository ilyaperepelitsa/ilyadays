// Column positions are schema, never inferred from translated labels or cell text.
export const PRESET_COLUMNS = {
  vegetables: { label: [0], temperature: 2, time: 3, note: 4 },
  'chicken-breast': { label: [0,1], temperature: 3, time: 4, note: 5 },
  drumsticks: { label: [0], temperature: 2, time: 3, note: 4 },
  beef: { label: [0,1,3], temperature: 4, time: 5, note: 6 },
  'pork-ribs': { label: [0], temperature: 2, time: 3, note: 4 },
  lamb: { label: [0,1], temperature: 3, time: 4, note: 5 },
  'lamb-slices': { label: [0,1], temperature: 3, time: 4, note: 5 },
};

/** @param {{id:string, rows:string[][], states?:string[]}} table @param {string} state */
export function cookingPresets(table, state) {
  const c=PRESET_COLUMNS[table.id];
  if (!c || !['chilled','frozen'].includes(state)) return [];
  const key = row => JSON.stringify([...c.label.map(i=>row[i]), row[c.temperature]]);
  // Preserve the chosen food/size/texture when switching starting state, even if
  // the source's frozen rows appear in a different order (asparagus does).
  return table.rows.filter((_,i)=>table.states?.[i]==='chilled').flatMap(base=>{
    const id=key(base);
    const row=table.rows.find((r,i)=>table.states?.[i]===state && key(r)===id);
    return row ? [{id, label:c.label.map(i=>row[i]).join(' · '), temperature:row[c.temperature], time:row[c.time], note:row[c.note]}] : [];
  });
}
