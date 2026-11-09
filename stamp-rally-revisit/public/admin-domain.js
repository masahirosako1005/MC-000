export function calculateAdminMetrics(kpis) {
  const percent = (numerator, denominator) => denominator ? Math.round(numerator / denominator * 1000) / 10 : 0;
  return {
    stampActivationRate: percent(kpis.stampUsers, kpis.registeredUsers),
    firstRoundRate: percent(kpis.firstRoundCompletedUsers, kpis.registeredUsers),
    secondRoundRate: percent(kpis.secondRoundUsers, kpis.registeredUsers),
    secondRoundConversion: percent(kpis.secondRoundUsers, kpis.firstRoundCompletedUsers),
    rewardReceiveRate: percent(kpis.rewardReceivedEvents, kpis.rewardEligibleEvents),
    surveyRate: percent(kpis.postSurveyUsers, kpis.registeredUsers),
    positiveRate: percent(kpis.positiveSurveyUsers, kpis.postSurveyUsers)
  };
}

export function createCampaign(input, now = new Date()) {
  const required = ['name', 'segmentId', 'missionId', 'startDate', 'endDate'];
  const missing = required.filter((key) => !String(input[key] || '').trim());
  if (missing.length) return { ok: false, errors: missing };
  if (input.endDate < input.startDate) return { ok: false, errors: ['dateRange'] };
  return {
    ok: true,
    campaign: {
      id: `campaign-${now.getTime()}`,
      name: input.name.trim(),
      segmentId: input.segmentId,
      missionId: input.missionId,
      channel: input.channel || 'in-app',
      startDate: input.startDate,
      endDate: input.endDate,
      message: (input.message || '').trim(),
      status: input.status || 'draft',
      createdAt: now.toISOString()
    }
  };
}

export function recommendedTemplates(analytics) {
  return analytics.insights.map((insight) => ({
    id: insight.actionTemplate,
    title: insight.title,
    impact: insight.impact,
    insightId: insight.id
  }));
}

export function segmentById(analytics, segmentId) {
  return analytics.segments.find((segment) => segment.id === segmentId) || null;
}
