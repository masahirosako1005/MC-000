export function getRewardStates(user, rewards) {
  const claimed = new Set(user.claimedRewardIds || []);
  return rewards.map((reward) => ({
    ...reward,
    status: user.stampCount < reward.threshold
      ? 'locked'
      : claimed.has(reward.id) ? 'claimed' : 'unclaimed'
  }));
}

export function recommendMission(user, missions, rewards) {
  const rewardStates = getRewardStates(user, rewards);
  const hasUnclaimed = rewardStates.some((reward) => reward.status === 'unclaimed');
  let theme = 'discovery';
  let reason = 'まだ見ていない景色を中心に選びました';

  if (hasUnclaimed) {
    theme = 'reward';
    reason = '受け取れる特典と一緒に楽しめる旅です';
  } else if ((user.goodPoint || '').includes('景観')) {
    theme = 'scenery';
    reason = '「景観・名所が良かった」という回答に合わせました';
  } else if ((user.goodPoint || '').includes('交流')) {
    theme = 'exchange';
    reason = '「旅先の交流が良かった」という回答に合わせました';
  } else if ((user.goodPoint || '').includes('スタンプ')) {
    theme = 'collection';
    reason = 'スタンプを集める楽しさをもう一度味わえる旅です';
  } else if (user.stampCount >= 7) {
    theme = 'scenery';
    reason = '一巡した人向けに、時間帯を変えた景色を選びました';
  }

  const mission = missions.find((item) => item.theme === theme) || missions[0];
  return { mission, reason };
}

export function createUserState() {
  return {
    selectedMissionId: null,
    plannedDate: '',
    missionStatus: 'suggested',
    visitedByMission: {},
    completedMissions: [],
    lastUpdatedAt: null
  };
}

export function toggleMissionSpot(state, missionId, spotId, missionSpotIds, now = new Date()) {
  const current = new Set(state.visitedByMission[missionId] || []);
  current.has(spotId) ? current.delete(spotId) : current.add(spotId);
  const visited = [...current];
  const complete = missionSpotIds.every((id) => current.has(id));
  const completedMissions = state.completedMissions.filter((item) => item.missionId !== missionId);
  if (complete) completedMissions.push({ missionId, completedAt: now.toISOString() });

  return {
    ...state,
    selectedMissionId: missionId,
    missionStatus: complete ? 'completed' : 'active',
    visitedByMission: { ...state.visitedByMission, [missionId]: visited },
    completedMissions,
    lastUpdatedAt: now.toISOString()
  };
}

export function progressFor(state, mission) {
  const visited = new Set(state.visitedByMission[mission.id] || []);
  const done = mission.spotIds.filter((id) => visited.has(id)).length;
  return { done, total: mission.spotIds.length, percent: mission.spotIds.length ? Math.round(done / mission.spotIds.length * 100) : 0 };
}
