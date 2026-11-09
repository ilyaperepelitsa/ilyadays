import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileName, profileErrors } from '../../src/lib/fitness/profile-core.mjs';
test('profile names allow real localized names but strip control characters and limit length', () => {
  assert.equal(profileName('  Илья   Perepelitsa\u0000 '), 'Илья Perepelitsa');
  assert.equal(profileName('x'.repeat(200)).length, 80);
  assert.equal(profileName(null), '');
});
test('optional personal measurements are validated instead of coerced into invented values', () => {
  assert.deepEqual(profileErrors('Ilya', null, null), []);
  assert.deepEqual(profileErrors(' ', -5, NaN), ['name', 'weight', 'height']);
  assert.deepEqual(profileErrors('Me', 85.5, 182), []);
  assert.deepEqual(profileErrors('Me', 400, 500), ['weight', 'height']);
});

import { profilePreferences, profilePlanDraft } from '../../src/lib/fitness/profile-core.mjs';
import { buildPersonalProgram } from '../../src/lib/fitness/plan-builder.mjs';
import { exerciseById } from '../../src/lib/fitness/catalog.mjs';
test('profile pivots preserve explicit exclusions across upper/custom and add actual leg work on full-body transition',()=>{
 const at='2026-11-09T16:00:00.000Z';
 const saved=buildPersonalProgram({bodyScope:'upper',excludedGroups:['biceps'],now:at});
 const upper=profilePreferences(saved.preferences,'upper',['hypertrophy'],'strength');
 assert.ok(upper.excludedGroups.includes('biceps'));
 const custom=profilePreferences(saved.preferences,'custom',[],'strength');
 assert.ok(custom.excludedGroups.includes('quads'));
 const full=profilePreferences(saved.preferences,'full',[],'strength');
 assert.ok(full.excludedGroups.includes('biceps')); assert.ok(!full.excludedGroups.includes('quads'));
 const next=profilePlanDraft(saved,{goal:'strength',days:3,preferences:full},{},at);
 assert.ok(next.days.flatMap(d=>d.slots).some(s=>['squat','hip-hinge','knee-extension','knee-flexion'].includes(exerciseById(s.exerciseId)?.pattern)));
 assert.deepEqual(saved.preferences.bodyScope,'upper');
});
