import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserState, getRewardStates, progressFor, recommendMission, toggleMissionSpot } from '../public/domain.js';

const rewards = [
  { id: 'r1', threshold: 3 },
  { id: 'r2', threshold: 5 },
  { id: 'r3', threshold: 7 }
];
const missions = [
  { id: 'scenery', theme: 'scenery', spotIds: ['a', 'b'] },
  { id: 'exchange', theme: 'exchange', spotIds: ['a', 'b'] },
  { id: 'collection', theme: 'collection', spotIds: ['a', 'b'] },
  { id: 'reward', theme: 'reward', spotIds: ['a', 'b'] },
  { id: 'discovery', theme: 'discovery', spotIds: ['a', 'b'] }
];

test('解放済み・未受取の特典がある場合はごほうびの旅を推薦する', () => {
  const user = { stampCount: 7, claimedRewardIds: ['r1', 'r2'], goodPoint: '景観・名所' };
  assert.equal(recommendMission(user, missions, rewards).mission.id, 'reward');
});

test('未受取特典がなければアンケートの関心を推薦に使う', () => {
  const user = { stampCount: 2, claimedRewardIds: [], goodPoint: '旅先の交流' };
  assert.equal(recommendMission(user, missions, rewards).mission.id, 'exchange');
});

test('特典状態を未解放・未受取・受取済みに分ける', () => {
  const states = getRewardStates({ stampCount: 5, claimedRewardIds: ['r1'] }, rewards);
  assert.deepEqual(states.map((item) => item.status), ['claimed', 'unclaimed', 'locked']);
});

test('全スポット記録後にミッションを完了する', () => {
  let state = createUserState();
  state = toggleMissionSpot(state, 'm1', 'a', ['a', 'b'], new Date('2026-11-01T00:00:00Z'));
  assert.equal(progressFor(state, { id: 'm1', spotIds: ['a', 'b'] }).percent, 50);
  state = toggleMissionSpot(state, 'm1', 'b', ['a', 'b'], new Date('2026-11-02T00:00:00Z'));
  assert.equal(state.missionStatus, 'completed');
  assert.equal(state.completedMissions.length, 1);
});
