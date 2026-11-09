import {
  createUserState,
  getRewardStates,
  progressFor,
  recommendMission,
  toggleMissionSpot
} from './domain.js';

const DATA_FILES = ['users', 'missions', 'spots', 'rewards'];
const STORAGE_PREFIX = 'hoshinagi-revisit:v2:';
const SELECTED_USER_KEY = 'hoshinagi-revisit:v2:selected-user';
const EVENT_KEY = 'hoshinagi-revisit:v2:events';

const navItems = [
  { id: 'home', label: 'ホーム', icon: '⌂' },
  { id: 'missions', label: 'ミッション', icon: '✦' },
  { id: 'plan', label: '旅の計画', icon: '⌖' },
  { id: 'rewards', label: '特典', icon: '♢' },
  { id: 'journal', label: '旅の記録', icon: '▤' }
];

const statusLabels = {
  locked: 'あと少しで解放',
  unclaimed: '受け取れます',
  claimed: '受取済み'
};

const app = {
  data: null,
  user: null,
  state: null,
  view: 'home',
  missionFilter: 'all',
  lastFocusedElement: null
};

const main = document.querySelector('#main-content');
const userSelect = document.querySelector('#traveler-select');
const headerAvatar = document.querySelector('#header-avatar');
const modalRoot = document.querySelector('#modal-root');

async function loadData() {
  const responses = await Promise.all(DATA_FILES.map((name) => fetch(`./data/${name}.json`)));
  responses.forEach((response) => {
    if (!response.ok) throw new Error(`データの読込に失敗しました: ${response.url}`);
  });
  const [users, missions, spots, rewards] = await Promise.all(responses.map((response) => response.json()));
  return { users, missions, spots, rewards };
}

function loadUserState(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${userId}`));
    return saved ? { ...createUserState(), ...saved } : createUserState();
  } catch {
    return createUserState();
  }
}

function saveUserState() {
  localStorage.setItem(`${STORAGE_PREFIX}${app.user.id}`, JSON.stringify(app.state));
}

function track(eventName, properties = {}) {
  const event = {
    eventId: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    userId: app.user.id,
    eventName,
    occurredAt: new Date().toISOString(),
    properties
  };
  let events = [];
  try { events = JSON.parse(localStorage.getItem(EVENT_KEY)) || []; } catch { events = []; }
  events.push(event);
  localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(-200)));
}

function setCurrentUser(userId) {
  app.user = app.data.users.find((user) => user.id === userId) || app.data.users[0];
  app.state = loadUserState(app.user.id);
  localStorage.setItem(SELECTED_USER_KEY, app.user.id);
  userSelect.value = app.user.id;
  headerAvatar.textContent = app.user.avatar;
  track('traveler_changed', { sampleUserId: app.user.id });
}

function currentView() {
  const value = location.hash.replace('#', '');
  return navItems.some((item) => item.id === value) ? value : 'home';
}

function go(view) {
  if (location.hash === `#${view}`) {
    app.view = view;
    render();
  } else {
    location.hash = view;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDate(value, options = { month: 'long', day: 'numeric' }) {
  if (!value) return '未設定';
  const date = new Date(`${value.length === 10 ? value + 'T00:00:00' : value}`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('ja-JP', options).format(date);
}

function formatShortDate(value) {
  return formatDate(value, { year: 'numeric', month: 'short', day: 'numeric' });
}

function spotById(id) { return app.data.spots.find((spot) => spot.id === id); }
function missionById(id) { return app.data.missions.find((mission) => mission.id === id); }

function effectiveRecommendation() {
  return recommendMission(app.user, app.data.missions, app.data.rewards);
}

function activeMission() {
  return missionById(app.state.selectedMissionId) || effectiveRecommendation().mission;
}

function renderNavigation() {
  const markup = navItems.map((item) => `
    <a class="nav-item ${app.view === item.id ? 'active' : ''}" href="#${item.id}" ${app.view === item.id ? 'aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('');
  document.querySelector('#desktop-nav').innerHTML = markup;
  document.querySelector('#mobile-nav').innerHTML = markup;
}

function missionTags(mission) {
  return `
    <div class="tag-row">
      <span class="tag">${mission.themeLabel}</span>
      <span class="tag warm">${mission.season}</span>
      <span class="tag neutral">${mission.spotIds.length}スポット</span>
    </div>
  `;
}

function progressMarkup(mission) {
  const progress = progressFor(app.state, mission);
  return `
    <div class="progress-wrap">
      <div class="progress-label"><span>ミッション進捗</span><span>${progress.done} / ${progress.total}</span></div>
      <div class="progress-track" aria-label="進捗 ${progress.percent}%"><div class="progress-bar" style="width:${progress.percent}%"></div></div>
    </div>
  `;
}

function spotCard(spot) {
  return `
    <article class="spot-card">
      <div class="spot-art ${spot.accent}" aria-hidden="true"><span>${spot.icon}</span></div>
      <div class="spot-body">
        <small>${spot.area}</small>
        <h3>${spot.name}</h3>
        <p>${spot.description}</p>
      </div>
    </article>
  `;
}

function renderHome() {
  const recommendation = effectiveRecommendation();
  const mission = activeMission();
  const progress = progressFor(app.state, mission);
  const rewards = getRewardStates(app.user, app.data.rewards);
  const unclaimed = rewards.filter((reward) => reward.status === 'unclaimed');
  const selectedIsRecommendation = !app.state.selectedMissionId || app.state.selectedMissionId === recommendation.mission.id;
  const missionSpots = mission.spotIds.map(spotById).filter(Boolean);
  track('revisit_home_viewed', { unclaimedRewardCount: unclaimed.length });

  return `
    <div class="page-enter">
      <section class="hero">
        <span class="hero-kicker">✦ 旅のつづきが届きました</span>
        <h1>${app.user.name}さん、次は<em>どんな景色</em>に会いに行く？</h1>
        <p>前回の旅をもとに、無理なく楽しめる小さな再訪プランを用意しました。</p>
        <div class="hero-stats">
          <div class="hero-stat"><strong>${app.user.stampCount}</strong><span>集めたスタンプ</span></div>
          <div class="hero-stat"><strong>${app.user.visitedSpotIds.length}</strong><span>訪れた場所</span></div>
          <div class="hero-stat"><strong>${app.state.completedMissions.length}</strong><span>旅のバッジ</span></div>
        </div>
      </section>

      <div class="home-columns">
        <section class="section" aria-labelledby="next-mission-title">
          <div class="section-head">
            <div><h2 id="next-mission-title" class="section-title">次のおすすめ</h2><p class="section-note">あなたの旅に合わせたミッション</p></div>
            <button class="text-link" data-action="go" data-view="missions">ほかを見る</button>
          </div>
          <article class="mission-feature">
            ${missionTags(mission)}
            <h3>${mission.title}</h3>
            <p>${mission.description}</p>
            <div class="mission-meta">
              <span class="meta-item">◷ 約${mission.estimatedMinutes}分</span>
              <span class="meta-item">⌖ ${mission.spotIds.length}か所</span>
              <span class="meta-item">${mission.badgeIcon} ${mission.badge}</span>
            </div>
            ${selectedIsRecommendation ? `<div class="recommend-reason"><span aria-hidden="true">✦</span><span>${recommendation.reason}</span></div>` : ''}
            ${progressMarkup(mission)}
            <div class="button-row">
              <button class="btn btn-primary" data-action="select-mission" data-mission-id="${mission.id}">旅を計画する <span aria-hidden="true">→</span></button>
              <button class="btn btn-secondary" data-action="go" data-view="plan">詳しく見る</button>
            </div>
          </article>
        </section>

        <section class="section" aria-labelledby="reward-alert-title">
          <div class="section-head"><div><h2 id="reward-alert-title" class="section-title">特典ボックス</h2><p class="section-note">旅で解放されたごほうび</p></div></div>
          ${unclaimed.length ? `
            <button class="reward-alert" data-action="open-reward" data-reward-id="${unclaimed[0].id}" style="width:100%;text-align:left;cursor:pointer">
              <span class="reward-icon" aria-hidden="true">${unclaimed[0].icon}</span>
              <span><strong>${unclaimed[0].name}を受け取れます</strong><p>${unclaimed[0].pickup}・${formatDate(unclaimed[0].expires)}まで</p></span>
              <span class="round-arrow" aria-hidden="true">›</span>
            </button>
          ` : `
            <div class="reward-alert">
              <span class="reward-icon" aria-hidden="true">✓</span>
              <span><strong>受取待ちの特典はありません</strong><p>次の特典まであと${Math.max(0, 7 - app.user.stampCount)}スタンプ</p></span>
            </div>
          `}
        </section>
      </div>

      <section class="section" aria-labelledby="route-preview-title">
        <div class="section-head">
          <div><h2 id="route-preview-title" class="section-title">この旅でめぐる場所</h2><p class="section-note">アクセスや休憩場所も確認できます</p></div>
          <button class="text-link" data-action="go" data-view="plan">ルート詳細</button>
        </div>
        <div class="spot-strip">${missionSpots.map(spotCard).join('')}</div>
      </section>
    </div>
  `;
}

function renderMissions() {
  const filters = [
    ['all', 'すべて'], ['scenery', '景色'], ['exchange', '交流'], ['collection', '収集'], ['reward', '特典'], ['discovery', '未訪問']
  ];
  const missions = app.missionFilter === 'all'
    ? app.data.missions
    : app.data.missions.filter((mission) => mission.theme === app.missionFilter);

  return `
    <div class="page-enter">
      <header class="page-head">
        <div><p class="eyebrow">Choose your next journey</p><h1 class="page-title">次の旅を選ぶ</h1><p class="page-subtitle">長い旅でなくても大丈夫。今の気分と時間に合う、小さなミッションから始められます。</p></div>
      </header>
      <div class="filter-row" aria-label="ミッションの絞り込み">
        ${filters.map(([id, label]) => `<button class="filter-chip ${app.missionFilter === id ? 'active' : ''}" data-action="filter-missions" data-filter="${id}">${label}</button>`).join('')}
      </div>
      <div class="mission-grid">
        ${missions.map((mission) => {
          const isSelected = app.state.selectedMissionId === mission.id;
          const progress = progressFor(app.state, mission);
          return `
            <article class="mission-card ${isSelected ? 'selected' : ''}">
              ${missionTags(mission)}
              <h3>${mission.title}</h3>
              <p>${mission.description}</p>
              <div class="mission-meta">
                <span class="meta-item">◷ ${mission.estimatedMinutes}分</span>
                <span class="meta-item">${mission.badgeIcon} ${mission.badge}</span>
              </div>
              ${progress.done ? progressMarkup(mission) : ''}
              <div class="button-row">
                <button class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'} btn-small" data-action="select-mission" data-mission-id="${mission.id}">${isSelected ? '選択中・詳細を見る' : 'この旅を選ぶ'}</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderPlan() {
  const mission = activeMission();
  const spots = mission.spotIds.map(spotById).filter(Boolean);
  const progress = progressFor(app.state, mission);
  const visited = new Set(app.state.visitedByMission[mission.id] || []);
  const statusText = app.state.missionStatus === 'completed' ? '達成しました' : app.state.missionStatus === 'active' ? '旅の途中です' : app.state.missionStatus === 'planned' ? `${formatDate(app.state.plannedDate)}に予定` : 'まだ計画していません';

  return `
    <div class="page-enter">
      <header class="page-head">
        <div><p class="eyebrow">Your travel plan</p><h1 class="page-title">旅の計画</h1><p class="page-subtitle">訪問順と現地情報をまとめました。訪問の記録は既存スタンプ機能との連携を想定したデモ操作です。</p></div>
      </header>
      <section class="plan-summary">
        ${missionTags(mission)}
        <h2>${mission.title}</h2>
        <p>${mission.description}</p>
        <div class="mission-meta">
          <span class="meta-item" style="color:rgba(255,255,255,.82)">◷ 約${mission.estimatedMinutes}分</span>
          <span class="meta-item" style="color:rgba(255,255,255,.82)">${mission.badgeIcon} ${mission.badge}</span>
        </div>
        ${progressMarkup(mission)}
        <strong>${statusText}</strong>
      </section>

      <section class="date-planner" aria-labelledby="date-planner-title">
        <label id="date-planner-title" for="planned-date">訪問予定日</label>
        <input class="date-input" id="planned-date" type="date" value="${app.state.plannedDate || ''}" min="2026-11-04">
        <button class="btn btn-primary" data-action="save-plan" data-mission-id="${mission.id}">予定を保存</button>
      </section>

      <section class="section" aria-labelledby="route-title">
        <div class="section-head"><div><h2 id="route-title" class="section-title">おすすめの訪問順</h2><p class="section-note">各スポットの現地情報</p></div></div>
        <div class="timeline">
          ${spots.map((spot, index) => {
            const done = visited.has(spot.id);
            return `
              <article class="timeline-item ${done ? 'done' : ''}">
                <div class="timeline-marker">${done ? '✓' : index + 1}</div>
                <div class="timeline-content">
                  <span class="area">${spot.area}</span>
                  <h3>${spot.name}</h3>
                  <p class="page-subtitle" style="margin-top:5px">${spot.description}</p>
                  <ul class="info-list">
                    <li><span aria-hidden="true">◷</span><span><strong>おすすめ:</strong> ${spot.bestTime}・滞在約${spot.stayMinutes}分</span></li>
                    <li><span aria-hidden="true">↗</span><span><strong>アクセス:</strong> ${spot.access}</span></li>
                    <li><span aria-hidden="true">♨</span><span><strong>休憩:</strong> ${spot.rest}</span></li>
                    <li><span aria-hidden="true">＋</span><span><strong>周辺:</strong> ${spot.nearby}</span></li>
                  </ul>
                  <button class="spot-check" data-action="toggle-spot" data-mission-id="${mission.id}" data-spot-id="${spot.id}">
                    <span aria-hidden="true">${done ? '✓' : '○'}</span>${done ? '訪問済み・取り消す' : '訪問を記録する'}
                  </button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderRewards() {
  const rewards = getRewardStates(app.user, app.data.rewards);
  const unclaimed = rewards.filter((reward) => reward.status === 'unclaimed').length;
  return `
    <div class="page-enter">
      <header class="page-head">
        <div><p class="eyebrow">Travel rewards</p><h1 class="page-title">特典ボックス</h1><p class="page-subtitle">特典は「解放」と「受取」を分けて表示します。受取場所と時間を確認してから訪問できます。</p></div>
      </header>
      ${unclaimed ? `<div class="reward-alert" style="margin-bottom:20px"><span class="reward-icon">🎁</span><span><strong>受け取れる特典が${unclaimed}件あります</strong><p>期限内に受取場所で特典画面を提示してください</p></span></div>` : ''}
      <div class="reward-grid">
        ${rewards.map((reward) => `
          <article class="reward-card ${reward.status}">
            <span class="reward-icon" aria-hidden="true">${reward.status === 'locked' ? '🔒' : reward.icon}</span>
            <div>
              <h3>${reward.name}</h3>
              <p>スタンプ${reward.threshold}個で解放</p>
              <span class="status-badge ${reward.status}">${statusLabels[reward.status]}</span>
            </div>
            ${reward.status !== 'locked' ? `<button class="btn ${reward.status === 'unclaimed' ? 'btn-primary' : 'btn-quiet'} btn-small" data-action="open-reward" data-reward-id="${reward.id}">${reward.status === 'unclaimed' ? '受取方法を見る' : '受取記録を見る'}</button>` : `<p style="grid-column:1/-1">現在 ${app.user.stampCount} / ${reward.threshold} スタンプ</p>`}
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderJournal() {
  const completed = app.state.completedMissions.map((item) => ({ ...item, mission: missionById(item.missionId) })).filter((item) => item.mission);
  return `
    <div class="page-enter">
      <header class="page-head">
        <div><p class="eyebrow">Your journey</p><h1 class="page-title">旅の記録</h1><p class="page-subtitle">一度目の旅も、帰ってきた旅も、ここに少しずつ残っていきます。</p></div>
      </header>
      <div class="journey-summary">
        <div class="summary-tile"><strong>${app.user.visitedSpotIds.length}</strong><span>初回の訪問地</span></div>
        <div class="summary-tile"><strong>${completed.length}</strong><span>再訪ミッション</span></div>
        <div class="summary-tile"><strong>${app.user.stampCount}</strong><span>スタンプ</span></div>
      </div>
      <section class="section" style="margin-top:0" aria-labelledby="badges-title">
        <div class="section-head"><div><h2 id="badges-title" class="section-title">旅のバッジ</h2><p class="section-note">再訪ミッションの記念</p></div></div>
        ${completed.length ? `
          <div class="badge-grid">
            ${completed.map((item) => `<article class="badge-card"><div class="badge-symbol">${item.mission.badgeIcon}</div><h3>${item.mission.badge}</h3><p>${formatShortDate(item.completedAt)}に達成</p></article>`).join('')}
          </div>
        ` : `
          <div class="empty-state"><span aria-hidden="true">🧭</span><h3>最初のバッジを見つけよう</h3><p>ミッションのスポットをすべて訪れると、その旅だけのバッジが記録されます。</p><button class="btn btn-primary" data-action="go" data-view="missions">旅を選ぶ</button></div>
        `}
      </section>
      <section class="section" aria-labelledby="first-journey-title">
        <div class="section-head"><div><h2 id="first-journey-title" class="section-title">最初の旅</h2><p class="section-note">${formatShortDate(app.user.lastVisit)}までの記録</p></div></div>
        <div class="mission-feature">
          <div class="tag-row"><span class="tag">スタンプラリー</span><span class="tag warm">${app.user.visitedSpotIds.length}スポット</span></div>
          <h3>星凪をめぐる最初の一歩</h3>
          <p>「${app.user.goodPoint}」が心に残った旅。ここから次の旅が始まります。</p>
          <div class="progress-wrap"><div class="progress-label"><span>初回スタンプ</span><span>${app.user.stampCount} / 7</span></div><div class="progress-track"><div class="progress-bar" style="width:${Math.min(100, app.user.stampCount / 7 * 100)}%"></div></div></div>
        </div>
      </section>
    </div>
  `;
}

function render() {
  app.view = currentView();
  renderNavigation();
  const renderers = { home: renderHome, missions: renderMissions, plan: renderPlan, rewards: renderRewards, journal: renderJournal };
  main.innerHTML = renderers[app.view]();
  document.title = `${navItems.find((item) => item.id === app.view).label} | 旅のつづき`;
}

function showToast(message) {
  const region = document.querySelector('#toast-region');
  region.innerHTML = `<div class="toast">${message}</div>`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { region.innerHTML = ''; }, 2600);
}

function openReward(rewardId, trigger) {
  const reward = getRewardStates(app.user, app.data.rewards).find((item) => item.id === rewardId);
  if (!reward) return;
  app.lastFocusedElement = trigger;
  track('reward_guide_opened', { rewardId });
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="reward-modal-title" data-modal-panel>
        <div class="modal-head">
          <div><span class="reward-icon" aria-hidden="true">${reward.icon}</span><h2 id="reward-modal-title" style="margin-top:12px">${reward.name}</h2></div>
          <button class="close-button" data-action="close-modal" aria-label="閉じる">×</button>
        </div>
        <p>${reward.guide}</p>
        <dl class="modal-details">
          <div><dt>受取場所</dt><dd>${reward.pickup}</dd></div>
          <div><dt>受付時間</dt><dd>${reward.hours}</dd></div>
          <div><dt>受取期限</dt><dd>${formatShortDate(reward.expires)}</dd></div>
          <div><dt>状態</dt><dd>${statusLabels[reward.status]}</dd></div>
        </dl>
        <button class="btn btn-primary btn-block" data-action="close-modal">確認しました</button>
      </section>
    </div>
  `;
  modalRoot.querySelector('.close-button').focus();
}

function closeModal() {
  modalRoot.innerHTML = '';
  app.lastFocusedElement?.focus();
}

document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;

  if (action === 'go') go(control.dataset.view);
  if (action === 'filter-missions') {
    app.missionFilter = control.dataset.filter;
    render();
  }
  if (action === 'select-mission') {
    app.state = { ...app.state, selectedMissionId: control.dataset.missionId, missionStatus: 'suggested', lastUpdatedAt: new Date().toISOString() };
    saveUserState();
    track('mission_detail_viewed', { missionId: control.dataset.missionId });
    go('plan');
  }
  if (action === 'save-plan') {
    const input = document.querySelector('#planned-date');
    if (!input?.value) {
      input?.focus();
      showToast('訪問予定日を選んでください');
      return;
    }
    app.state = { ...app.state, selectedMissionId: control.dataset.missionId, plannedDate: input.value, missionStatus: 'planned', lastUpdatedAt: new Date().toISOString() };
    saveUserState();
    track('mission_planned', { missionId: control.dataset.missionId, plannedDate: input.value });
    showToast(`${formatDate(input.value)}の予定を保存しました`);
    render();
  }
  if (action === 'toggle-spot') {
    const mission = missionById(control.dataset.missionId);
    const previous = progressFor(app.state, mission);
    app.state = toggleMissionSpot(app.state, mission.id, control.dataset.spotId, mission.spotIds);
    saveUserState();
    const next = progressFor(app.state, mission);
    track('mission_spot_completed', { missionId: mission.id, spotId: control.dataset.spotId, completed: next.done > previous.done });
    if (next.percent === 100) {
      track('mission_completed', { missionId: mission.id });
      showToast(`「${mission.badge}」バッジを獲得しました`);
    } else {
      showToast(next.done > previous.done ? '訪問を記録しました' : '訪問記録を取り消しました');
    }
    render();
  }
  if (action === 'open-reward') openReward(control.dataset.rewardId, control);
  if (action === 'close-modal' && (!event.target.closest('[data-modal-panel]') || control.classList.contains('close-button') || control.classList.contains('btn'))) closeModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalRoot.innerHTML) closeModal();
});

window.addEventListener('hashchange', render);
userSelect.addEventListener('change', () => {
  setCurrentUser(userSelect.value);
  render();
  showToast(`${app.user.name}さんの旅に切り替えました`);
});

async function init() {
  try {
    app.data = await loadData();
    userSelect.innerHTML = app.data.users.map((user) => `<option value="${user.id}">${user.name}さん</option>`).join('');
    setCurrentUser(localStorage.getItem(SELECTED_USER_KEY) || app.data.users[0].id);
    if (!location.hash) history.replaceState(null, '', '#home');
    render();
  } catch (error) {
    console.error(error);
    main.innerHTML = `<div class="error-panel"><h1>読み込めませんでした</h1><p>localhostサーバーを起動してから、もう一度お試しください。</p></div>`;
  }
}

init();
