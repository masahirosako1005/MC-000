import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdminMetrics, createCampaign } from '../public/admin-domain.js';

test('管理KPIをログ集計値から計算する', () => {
  const metrics = calculateAdminMetrics({
    registeredUsers: 500,
    stampUsers: 480,
    firstRoundCompletedUsers: 178,
    secondRoundUsers: 121,
    rewardEligibleEvents: 879,
    rewardReceivedEvents: 584,
    postSurveyUsers: 287,
    positiveSurveyUsers: 178
  });
  assert.equal(metrics.stampActivationRate, 96);
  assert.equal(metrics.secondRoundConversion, 68);
  assert.equal(metrics.rewardReceiveRate, 66.4);
});

test('必須項目を満たした施策を作成できる', () => {
  const result = createCampaign({
    name: '秋の再訪企画', segmentId: 'completed-no-return', missionId: 'sunset-route',
    channel: 'in-app', startDate: '2026-11-10', endDate: '2026-12-20', status: 'scheduled'
  }, new Date('2026-11-04T00:00:00Z'));
  assert.equal(result.ok, true);
  assert.equal(result.campaign.status, 'scheduled');
});

test('終了日が開始日より前の施策を拒否する', () => {
  const result = createCampaign({
    name: '不正な期間', segmentId: 'x', missionId: 'y', startDate: '2026-12-20', endDate: '2026-11-10'
  });
  assert.deepEqual(result.errors, ['dateRange']);
});
