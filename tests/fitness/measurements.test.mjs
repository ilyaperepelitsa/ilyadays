import assert from 'node:assert/strict';
import {test} from 'node:test';
import {measurementDate,measurementRow,measurementTrend,measurementValues} from '../../src/lib/fitness/measurements.mjs';
const NOW='2026-11-09T16:00:00.000Z';
test('circumference-only entries preserve independent left/right observations without invented bodyweight',()=>{
 const r=measurementRow({day:'2026-11-09',values:{waist:85.25,'left-biceps':33.1,'right-biceps':34},now:NOW});
 assert.deepEqual(r.values,{waist:85.3,'left-biceps':33.1,'right-biceps':34}); assert.equal('kg' in r,false);
 assert.notEqual(r.values['left-biceps'],r.values['right-biceps']);
});
test('measurements reject missing/unknown fields, invalid values, impossible dates and future observations',()=>{
 for(const v of [{}, {waist:0},{waist:-2},{waist:301},{waist:NaN},{bmi:25},[]])assert.equal(measurementValues(v),null);
 for(const day of ['2026-02-30','not-a-date','2026-11-10'])assert.equal(measurementDate(day,NOW),null);
 assert.ok(measurementDate('2024-02-29',NOW));
});
test('a site trend uses observed dates and never fills missing sides or sites',()=>{
 const a=measurementRow({id:'a',day:'2026-10-01',values:{waist:90},now:NOW});
 const b=measurementRow({id:'b',day:'2026-11-01',values:{'left-forearm':28},now:NOW});
 const c=measurementRow({id:'c',day:'2026-11-02',values:{waist:87},now:NOW});
 assert.deepEqual(measurementTrend({c,b,a},'waist').map(r=>r.cm),[90,87]);
 assert.deepEqual(measurementTrend([a,b,c],'right-forearm'),[]);
});
test('same-day measurements use observation entry time rather than random UUID order',()=>{
 const first=measurementRow({id:'z',day:'2026-11-09',values:{waist:88},now:'2026-11-09T14:00:00Z'});
 const second=measurementRow({id:'a',day:'2026-11-09',values:{waist:87},now:'2026-11-09T15:00:00Z'});
 assert.deepEqual(measurementTrend([second,first],'waist').map(r=>r.cm),[88,87]);
});
