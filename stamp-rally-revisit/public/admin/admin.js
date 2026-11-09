import { calculateAdminMetrics, createCampaign, segmentById } from '../admin-domain.js';

const STORAGE_KEY = 'hoshinagi-admin:v2:campaigns';
const DRAFT_KEY = 'hoshinagi-admin:v2:draft';

const navItems = [
  { id: 'dashboard', label: 'ダッシュボード', icon: '▦' },
  { id: 'campaigns', label: '再訪施策', icon: '✦' },
  { id: 'builder', label: '施策を作成', icon: '＋' },
  { id: 'segments', label: '参加者セグメント', icon: '◎' },
  { id: 'insights', label: '分析と提案', icon: '⌁' }
];

const defaultCampaigns = [
  {
    id: 'campaign-reward-01', name: '特典を受け取る港の小さな旅', segmentId: 'unclaimed-reward', missionId: 'reward-journey',
    channel: 'アプリ内', startDate: '2026-11-04', endDate: '2026-12-20', status: 'active', message: '受け取れる特典があります。港町の寄り道と一緒に楽しみませんか。',
    audienceCount: 227, plannedCount: 68, revisitCount: 31
  },
  {
    id: 'campaign-season-01', name: '夕景をめぐる秋の再訪企画', segmentId: 'completed-no-return', missionId: 'sunset-route',
    channel: 'アプリ内＋LINE', startDate: '2026-11-15', endDate: '2026-12-20', status: 'scheduled', message: '一巡した旅人へ。今度は光が変わる時間に、2つの景色を訪ねませんか。',
    audienceCount: 57, plannedCount: 0, revisitCount: 0
  },
  {
    id: 'campaign-next-01', name: 'あと2つ、旅の続きを案内', segmentId: 'mid-progress', missionId: 'next-two-spots',
    channel: 'アプリ内', startDate: '2026-11-20', endDate: '2027-01-31', status: 'draft', message: 'まだ見ていない景色から、移動しやすい2か所を選びました。',
    audienceCount: 302, plannedCount: 0, revisitCount: 0
  }
];

const app = {
  analytics: null,
  missions: null,
  spots: null,
  view: 'dashboard',
  campaigns: [],
  draft: null,
  lastFocus: null
};

const main = document.querySelector('#admin-main');
const nav = document.querySelector('#admin-nav');
const sidebar = document.querySelector('.admin-sidebar');
const menuButton = document.querySelector('#menu-button');
const modalRoot = document.querySelector('#admin-modal');

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`読込エラー: ${path}`);
  return response.json();
}

function loadCampaigns() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultCampaigns; }
  catch { return defaultCampaigns; }
}

function saveCampaigns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app.campaigns));
}

function loadDraft() {
  try { return { ...emptyDraft(), ...(JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}) }; }
  catch { return emptyDraft(); }
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(app.draft));
}

function emptyDraft() {
  return {
    name: '', segmentId: 'unclaimed-reward', missionId: 'reward-journey', channel: 'アプリ内',
    startDate: '2026-11-10', endDate: '2026-12-20', status: 'draft',
    message: '受け取れる特典があります。次の小さな旅と一緒に楽しみませんか。'
  };
}

function currentView() {
  const hash = location.hash.replace('#', '');
  return navItems.some((item) => item.id === hash) ? hash : 'dashboard';
}

function go(view) {
  if (location.hash === `#${view}`) render();
  else location.hash = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  sidebar.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}

function formatNumber(value) { return new Intl.NumberFormat('ja-JP').format(value || 0); }
function formatDate(value) {
  if (!value) return '未設定';
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function statusLabel(status) {
  return { draft: '下書き', scheduled: '公開予約', active: '実施中', completed: '終了' }[status] || status;
}

function channelLabel(value) { return value || 'アプリ内'; }

function renderNav() {
  nav.innerHTML = navItems.map((item) => `
    <a class="admin-nav-item ${app.view === item.id ? 'active' : ''}" href="#${item.id}" ${app.view === item.id ? 'aria-current="page"' : ''}>
      <span class="icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>
    </a>
  `).join('');
  document.querySelector('#current-section').textContent = navItems.find((item) => item.id === app.view).label;
}

function pageHead(eyebrow, title, subtitle, action = '') {
  return `<header class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action}</header>`;
}

function activityChart() {
  const max = Math.max(...app.analytics.dailyActivity.map((item) => item.stamps));
  return `<div class="activity-chart" aria-label="日別スタンプ・特典イベント">
    ${app.analytics.dailyActivity.map((item) => `<div class="bar-group" title="${item.date}: スタンプ${item.stamps}件、特典${item.rewards}件"><span class="chart-bar stamps" style="height:${item.stamps / max * 100}%"></span><span class="chart-bar rewards" style="height:${item.rewards / max * 100}%"></span><span class="bar-label">${item.date}</span></div>`).join('')}
  </div><div class="chart-legend"><span><i class="legend-dot" style="background:var(--teal)"></i>スタンプ取得</span><span><i class="legend-dot" style="background:var(--gold)"></i>特典受取</span></div>`;
}

function renderDashboard() {
  const k = app.analytics.kpis;
  const m = calculateAdminMetrics(k);
  const activeCampaigns = app.campaigns.filter((item) => item.status === 'active').length;
  const scheduledCampaigns = app.campaigns.filter((item) => item.status === 'scheduled').length;
  const funnel = [
    ['登録', k.registeredUsers], ['スタンプ取得', k.stampUsers], ['1周完了', k.firstRoundCompletedUsers], ['2周目参加', k.secondRoundUsers]
  ];
  return `<div class="page-enter">
    ${pageHead('Operations overview', '運営ダッシュボード', '再訪につながる変化と、次に打つべき施策を確認できます。', `<div class="head-meta">集計期間 ${app.analytics.period}<br>CSV解析値を使用</div>`)}
    <section class="kpi-grid" aria-label="主要指標">
      <article class="kpi-card"><div class="kpi-label"><span>スタンプ利用率</span><span class="kpi-icon">◎</span></div><strong class="kpi-value">${m.stampActivationRate}%</strong><span class="kpi-detail"><span class="trend">${formatNumber(k.stampUsers)}人</span> / 登録${formatNumber(k.registeredUsers)}人</span></article>
      <article class="kpi-card warm"><div class="kpi-label"><span>2周目移行率</span><span class="kpi-icon">↻</span></div><strong class="kpi-value">${m.secondRoundRate}%</strong><span class="kpi-detail">一巡者からは <span class="trend attention">${m.secondRoundConversion}%</span></span></article>
      <article class="kpi-card warm"><div class="kpi-label"><span>特典受取率</span><span class="kpi-icon">♢</span></div><strong class="kpi-value">${m.rewardReceiveRate}%</strong><span class="kpi-detail"><span class="trend attention">295件</span> が解放後未受取</span></article>
      <article class="kpi-card"><div class="kpi-label"><span>再訪施策</span><span class="kpi-icon">✦</span></div><strong class="kpi-value">${activeCampaigns}</strong><span class="kpi-detail">実施中 / 公開予約 ${scheduledCampaigns}件</span></article>
    </section>

    <div class="grid-main">
      <section class="panel" aria-labelledby="activity-title"><div class="panel-head"><div><h2 id="activity-title" class="panel-title">日別の利用状況</h2><p class="panel-note">スタンプ取得と特典受取イベント</p></div></div>${activityChart()}</section>
      <section class="panel" aria-labelledby="funnel-title"><div class="panel-head"><div><h2 id="funnel-title" class="panel-title">参加ファネル</h2><p class="panel-note">登録から2周目まで</p></div></div><div class="funnel">${funnel.map(([label, value]) => `<div class="funnel-row"><span class="funnel-label">${label}</span><div class="funnel-track"><div class="funnel-bar" style="width:${value / k.registeredUsers * 100}%">${Math.round(value / k.registeredUsers * 100)}%</div></div><span class="funnel-value">${value}人</span></div>`).join('')}</div></section>
      <section class="panel" aria-labelledby="insight-title"><div class="panel-head"><div><h2 id="insight-title" class="panel-title">今週の提案</h2><p class="panel-note">ログから推測した再訪施策</p></div><button class="subtle-link" data-action="go" data-view="insights">すべて見る</button></div><div class="insight-list">${app.analytics.insights.slice(0, 2).map(insightCard).join('')}</div></section>
      <section class="panel" aria-labelledby="campaign-title"><div class="panel-head"><div><h2 id="campaign-title" class="panel-title">施策の進行状況</h2><p class="panel-note">直近の再訪企画</p></div><button class="subtle-link" data-action="go" data-view="campaigns">一覧を見る</button></div>${campaignMiniTable()}</section>
    </div>
  </div>`;
}

function insightCard(insight) {
  return `<article class="insight-card ${insight.level}"><span class="insight-mark" aria-hidden="true">${insight.level === 'opportunity' ? '✦' : 'i'}</span><div><h3>${insight.title}</h3><p>${insight.body}</p><span class="impact-label">期待効果: ${insight.impact}</span></div></article>`;
}

function campaignMiniTable() {
  const rows = app.campaigns.slice(0, 3);
  return rows.length ? `<div class="campaign-table-wrap"><table class="campaign-table" style="min-width:540px"><thead><tr><th>施策</th><th>期間</th><th>状態</th><th>対象</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${item.name}</strong><small>${segmentById(app.analytics, item.segmentId)?.name || ''}</small></td><td>${formatDate(item.startDate)}〜</td><td><span class="status ${item.status}">${statusLabel(item.status)}</span></td><td>${formatNumber(item.audienceCount || segmentById(app.analytics, item.segmentId)?.count)}人</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><strong>施策はまだありません</strong>新しい再訪施策を作成してください。</div>';
}

function renderCampaigns() {
  return `<div class="page-enter">
    ${pageHead('Revisit campaigns', '再訪施策', '対象者、ミッション、公開期間を組み合わせて施策を管理します。実際の通知送信は行いません。', '<button class="btn btn-primary" data-action="new-campaign">＋ 新しい施策</button>')}
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">施策一覧</h2><p class="panel-note">ブラウザ内に保存されるデモデータ</p></div></div>
      <div class="campaign-table-wrap"><table class="campaign-table"><thead><tr><th>施策名</th><th>対象者</th><th>公開期間</th><th>チャネル</th><th>状態</th><th>計画 / 再訪</th><th></th></tr></thead><tbody>
      ${app.campaigns.map((item) => {
        const segment = segmentById(app.analytics, item.segmentId);
        return `<tr><td><strong>${item.name}</strong><small>${app.missions.find((m) => m.id === item.missionId)?.title || 'ミッション未設定'}</small></td><td>${segment?.name || '未設定'}<br><small>${formatNumber(item.audienceCount || segment?.count)}人</small></td><td>${formatDate(item.startDate)}<br><small>〜 ${formatDate(item.endDate)}</small></td><td>${channelLabel(item.channel)}</td><td><span class="status ${item.status}">${statusLabel(item.status)}</span></td><td>${formatNumber(item.plannedCount)} / ${formatNumber(item.revisitCount)}</td><td><button class="btn btn-quiet btn-small" data-action="campaign-detail" data-campaign-id="${item.id}">詳細</button></td></tr>`;
      }).join('')}
      </tbody></table></div>
    </section>
  </div>`;
}

function renderSegments() {
  return `<div class="page-enter">
    ${pageHead('Audience segments', '参加者セグメント', '次の行動が異なる参加者を分け、適切な再訪理由を設計します。')}
    <div class="segment-grid">${app.analytics.segments.map((segment) => `<article class="segment-card"><div class="segment-top"><div><span class="priority ${segment.priority}">${{ high: '優先度 高', medium: '優先度 中', low: '優先度 低' }[segment.priority]}</span><h3 style="margin-top:10px">${segment.name}</h3></div><div class="segment-count">${formatNumber(segment.count)}<small>人</small></div></div><p>${segment.signal}</p><div class="recommendation-line"><span aria-hidden="true">✦</span><span><strong>推奨:</strong> ${segment.recommendedAction}<br><small>${segment.recommendedChannel}</small></span></div><button class="btn btn-secondary btn-small" data-action="campaign-for-segment" data-segment-id="${segment.id}">この対象に施策を作る</button></article>`).join('')}</div>
  </div>`;
}

function renderInsights() {
  return `<div class="page-enter">
    ${pageHead('Analysis & planning', '分析と企画提案', 'ログの観測値から、再訪に影響しそうな打ち手を優先度順に整理しています。')}
    <div class="grid-main">
      <section class="panel"><div class="panel-head"><div><h2 class="panel-title">企画提案</h2><p class="panel-note">因果ではなく、検証すべき仮説です</p></div></div><div class="insight-list">${app.analytics.insights.map((insight) => `<article class="insight-card ${insight.level}"><span class="insight-mark">${insight.level === 'opportunity' ? '✦' : 'i'}</span><div><h3>${insight.title}</h3><p>${insight.body}</p><span class="impact-label">期待効果: ${insight.impact}</span><div style="margin-top:9px"><button class="btn btn-secondary btn-small" data-action="campaign-from-insight" data-template-id="${insight.actionTemplate}">この提案から施策を作る</button></div></div></article>`).join('')}</div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="panel-title">スポット別取得状況</h2><p class="panel-note">取得者480人に対する割合</p></div></div><div class="spot-table">${app.analytics.spotPerformance.map((spot) => `<div class="spot-row"><strong>${spot.name}</strong><div class="mini-track"><div class="mini-bar" style="width:${spot.share}%"></div></div><span>${spot.visits}</span></div>`).join('')}</div><p class="page-subtitle" style="margin-top:16px">最少と最多の差は17件です。特定スポットの重大なボトルネックより、全体の次回目的と受取導線を優先します。</p></section>
    </div>
  </div>`;
}

function renderBuilder() {
  const d = app.draft;
  const selectedSegment = segmentById(app.analytics, d.segmentId);
  const selectedMission = app.missions.find((mission) => mission.id === d.missionId) || app.missions[0];
  return `<div class="page-enter">
    ${pageHead('Campaign builder', '再訪施策を作成', '対象者にとって無理のない旅と、具体的な訪問情報を組み合わせます。')}
    <div class="builder-layout">
      <form id="campaign-form" class="form-panel" novalidate>
        <section class="form-section"><h2>1. 施策の基本情報</h2><div class="field-grid two">
          <div class="field" style="grid-column:1/-1"><label for="campaign-name">施策名</label><input id="campaign-name" name="name" value="${escapeHtml(d.name)}" placeholder="例: 夕景をめぐる秋の再訪企画" required></div>
          <div class="field"><label for="campaign-start">開始日</label><input id="campaign-start" name="startDate" type="date" value="${d.startDate}" required></div>
          <div class="field"><label for="campaign-end">終了日</label><input id="campaign-end" name="endDate" type="date" value="${d.endDate}" required></div>
        </div></section>
        <section class="form-section"><h2>2. 対象者とミッション</h2><div class="field-grid two">
          <div class="field"><label for="campaign-segment">参加者セグメント</label><select id="campaign-segment" name="segmentId">${app.analytics.segments.map((segment) => `<option value="${segment.id}" ${segment.id === d.segmentId ? 'selected' : ''}>${segment.name}（${segment.count}人）</option>`).join('')}</select></div>
          <div class="field"><label for="campaign-mission">表示するミッション</label><select id="campaign-mission" name="missionId">${app.missions.map((mission) => `<option value="${mission.id}" ${mission.id === d.missionId ? 'selected' : ''}>${mission.title}</option>`).join('')}</select></div>
        </div></section>
        <section class="form-section"><h2>3. 表示方法</h2><div class="field-grid two">
          <div class="field"><label for="campaign-channel">計画チャネル</label><select id="campaign-channel" name="channel"><option ${d.channel === 'アプリ内' ? 'selected' : ''}>アプリ内</option><option ${d.channel === 'アプリ内＋LINE' ? 'selected' : ''}>アプリ内＋LINE</option></select><span class="field-help">デモでは外部送信しません</span></div>
          <div class="field"><label for="campaign-status">保存状態</label><select id="campaign-status" name="status"><option value="draft" ${d.status === 'draft' ? 'selected' : ''}>下書き</option><option value="scheduled" ${d.status === 'scheduled' ? 'selected' : ''}>公開予約</option><option value="active" ${d.status === 'active' ? 'selected' : ''}>すぐにアプリ内公開</option></select></div>
          <div class="field" style="grid-column:1/-1"><label for="campaign-message">参加者への案内文</label><textarea id="campaign-message" name="message" maxlength="180">${escapeHtml(d.message)}</textarea><span class="field-help">受取場所、所要時間、次の行動が分かる文章を推奨</span></div>
        </div></section>
        <div class="button-row" style="display:flex;gap:9px;margin-top:22px"><button type="submit" class="btn btn-primary">${d.status === 'draft' ? '下書きを保存' : '施策を保存'} </button><button type="button" class="btn btn-quiet" data-action="reset-draft">入力をリセット</button></div>
      </form>
      <aside class="preview-panel" aria-label="施策プレビュー"><span class="tag">参加者画面プレビュー</span><h2 id="preview-name">${d.name || selectedMission.title}</h2><p id="preview-message">${d.message || selectedMission.description}</p><div class="preview-meta"><div><span>ミッション</span><strong id="preview-mission">${selectedMission.title}</strong></div><div><span>期間</span><strong id="preview-period">${formatDate(d.startDate)}〜${formatDate(d.endDate)}</strong></div><div><span>チャネル</span><strong id="preview-channel">${d.channel}</strong></div></div><div class="preview-audience"><small>対象セグメント</small><strong id="preview-audience">${selectedSegment?.name}・${selectedSegment?.count}人</strong></div></aside>
    </div>
  </div>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function render() {
  app.view = currentView();
  renderNav();
  const views = { dashboard: renderDashboard, campaigns: renderCampaigns, builder: renderBuilder, segments: renderSegments, insights: renderInsights };
  main.innerHTML = views[app.view]();
  document.title = `${navItems.find((item) => item.id === app.view).label} | 星凪 運営コンソール`;
}

function prefillForSegment(segmentId) {
  const mapping = {
    'unclaimed-reward': { name: '特典を受け取る小さな旅', missionId: 'reward-journey', message: '受け取れる特典があります。受取場所の近くをめぐる小さな旅へ出かけませんか。' },
    'completed-no-return': { name: '一巡後の季節ミッション', missionId: 'sunset-route', message: '一巡した旅人へ。今度は光が変わる時間に、2つの景色を訪ねませんか。' },
    'mid-progress': { name: 'あと2つ、旅の続きを案内', missionId: 'next-two-spots', message: 'まだ見ていない景色から、移動しやすい2か所を選びました。' },
    'registered-no-stamp': { name: '最初の1スポット案内', missionId: 'next-two-spots', message: '現在地から訪れやすいスポットと、スタンプの集め方をご案内します。' },
    'survey-nonresponders': { name: '旅の記録とミニアンケート', missionId: 'local-encounters', message: '旅の記録ができました。次のおすすめを見る前に、印象に残ったことを教えてください。' }
  };
  app.draft = { ...emptyDraft(), segmentId, ...mapping[segmentId] };
  saveDraft();
}

function prefillFromInsight(templateId) {
  const segment = templateId === 'seasonal-return' ? 'completed-no-return' : templateId === 'reward-pickup' ? 'unclaimed-reward' : 'mid-progress';
  prefillForSegment(segment);
}

function updateBuilderPreview() {
  const form = document.querySelector('#campaign-form');
  if (!form) return;
  const values = Object.fromEntries(new FormData(form));
  app.draft = { ...app.draft, ...values };
  saveDraft();
  const segment = segmentById(app.analytics, values.segmentId);
  const mission = app.missions.find((item) => item.id === values.missionId);
  document.querySelector('#preview-name').textContent = values.name || mission?.title || '施策名';
  document.querySelector('#preview-message').textContent = values.message || mission?.description || '';
  document.querySelector('#preview-mission').textContent = mission?.title || '未設定';
  document.querySelector('#preview-period').textContent = `${formatDate(values.startDate)}〜${formatDate(values.endDate)}`;
  document.querySelector('#preview-channel').textContent = values.channel;
  document.querySelector('#preview-audience').textContent = `${segment?.name || '未設定'}・${segment?.count || 0}人`;
}

function showCampaignDetail(campaignId, trigger) {
  const campaign = app.campaigns.find((item) => item.id === campaignId);
  if (!campaign) return;
  const segment = segmentById(app.analytics, campaign.segmentId);
  const mission = app.missions.find((item) => item.id === campaign.missionId);
  app.lastFocus = trigger;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" data-modal-panel><div class="modal-head"><div><span class="status ${campaign.status}">${statusLabel(campaign.status)}</span><h2 id="detail-title" style="margin-top:9px">${campaign.name}</h2></div><button class="close-button" data-action="close-modal" aria-label="閉じる">×</button></div><div class="field-grid two"><div class="field"><span class="field-label">対象者</span><strong>${segment?.name}</strong><span class="field-help">${segment?.count}人</span></div><div class="field"><span class="field-label">ミッション</span><strong>${mission?.title}</strong></div><div class="field"><span class="field-label">公開期間</span><strong>${formatDate(campaign.startDate)}〜${formatDate(campaign.endDate)}</strong></div><div class="field"><span class="field-label">チャネル</span><strong>${campaign.channel}</strong></div></div><div class="form-section"><h2>案内文</h2><p class="page-subtitle">${campaign.message}</p></div><div class="form-section"><h2>途中経過</h2><div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)"><div class="kpi-card"><span class="kpi-label">対象</span><strong class="kpi-value">${campaign.audienceCount || segment?.count}</strong></div><div class="kpi-card"><span class="kpi-label">計画</span><strong class="kpi-value">${campaign.plannedCount || 0}</strong></div><div class="kpi-card"><span class="kpi-label">再訪</span><strong class="kpi-value">${campaign.revisitCount || 0}</strong></div></div></div><button class="btn btn-primary btn-block" data-action="close-modal" style="margin-top:20px">閉じる</button></section></div>`;
  modalRoot.querySelector('.close-button').focus();
}

function closeModal() {
  modalRoot.innerHTML = '';
  app.lastFocus?.focus();
}

function showToast(message) {
  const region = document.querySelector('#admin-toast');
  region.innerHTML = `<div class="toast">${message}</div>`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { region.innerHTML = ''; }, 2600);
}

document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  if (action === 'go') go(control.dataset.view);
  if (action === 'new-campaign') { app.draft = emptyDraft(); saveDraft(); go('builder'); }
  if (action === 'campaign-for-segment') { prefillForSegment(control.dataset.segmentId); go('builder'); }
  if (action === 'campaign-from-insight') { prefillFromInsight(control.dataset.templateId); go('builder'); }
  if (action === 'campaign-detail') showCampaignDetail(control.dataset.campaignId, control);
  if (action === 'reset-draft') { app.draft = emptyDraft(); saveDraft(); render(); showToast('入力内容をリセットしました'); }
  if (action === 'close-modal' && (!event.target.closest('[data-modal-panel]') || control.classList.contains('close-button') || control.classList.contains('btn'))) closeModal();
});

document.addEventListener('input', (event) => {
  if (event.target.closest('#campaign-form')) updateBuilderPreview();
});
document.addEventListener('change', (event) => {
  if (event.target.closest('#campaign-form')) updateBuilderPreview();
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'campaign-form') return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  const result = createCampaign(values);
  if (!result.ok) {
    if (result.errors.includes('dateRange')) showToast('終了日は開始日以降にしてください');
    else showToast('必須項目を入力してください');
    const firstInvalid = event.target.querySelector(':invalid');
    firstInvalid?.focus();
    return;
  }
  const segment = segmentById(app.analytics, result.campaign.segmentId);
  app.campaigns.unshift({ ...result.campaign, audienceCount: segment?.count || 0, plannedCount: 0, revisitCount: 0 });
  saveCampaigns();
  app.draft = emptyDraft();
  saveDraft();
  go('campaigns');
  showToast(result.campaign.status === 'draft' ? '施策を下書き保存しました' : '施策を保存しました');
});

menuButton.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalRoot.innerHTML) closeModal();
});
window.addEventListener('hashchange', render);

async function init() {
  try {
    [app.analytics, app.missions, app.spots] = await Promise.all([
      fetchJson('../data/admin-analytics.json'), fetchJson('../data/missions.json'), fetchJson('../data/spots.json')
    ]);
    app.campaigns = loadCampaigns();
    app.draft = loadDraft();
    if (!location.hash) history.replaceState(null, '', '#dashboard');
    render();
  } catch (error) {
    console.error(error);
    main.innerHTML = '<div class="panel"><h1>管理画面を読み込めませんでした</h1><p>localhostサーバーを起動して再読み込みしてください。</p></div>';
  }
}

init();
