"use strict";

/* ===== 星座データ ===== */
// start: 開始日(月*100+日)。山羊座は年をまたぐため最後に判定する。
const SIGNS = [
  { name: "牡羊座", symbol: "♈", start: 321, end: "3/21〜4/19", element: "火", trait: "情熱的で行動力があり、先頭に立つのが得意。" },
  { name: "牡牛座", symbol: "♉", start: 420, end: "4/20〜5/20", element: "地", trait: "穏やかで堅実。美味しいものと心地よさを愛する。" },
  { name: "双子座", symbol: "♊", start: 521, end: "5/21〜6/21", element: "風", trait: "好奇心旺盛で話し上手。情報収集の達人。" },
  { name: "蟹座",   symbol: "♋", start: 622, end: "6/22〜7/22", element: "水", trait: "思いやりが深く、家族や仲間を大切にする。" },
  { name: "獅子座", symbol: "♌", start: 723, end: "7/23〜8/22", element: "火", trait: "堂々として華があり、頼れるリーダー気質。" },
  { name: "乙女座", symbol: "♍", start: 823, end: "8/23〜9/22", element: "地", trait: "繊細で几帳面。分析力とサポート力が高い。" },
  { name: "天秤座", symbol: "♎", start: 923, end: "9/23〜10/23", element: "風", trait: "バランス感覚に優れ、社交的で美意識が高い。" },
  { name: "蠍座",   symbol: "♏", start: 1024, end: "10/24〜11/22", element: "水", trait: "一途で洞察力が鋭く、集中力に優れる。" },
  { name: "射手座", symbol: "♐", start: 1123, end: "11/23〜12/21", element: "火", trait: "自由を愛する楽天家。冒険と学びが大好き。" },
  { name: "山羊座", symbol: "♑", start: 1222, end: "12/22〜1/19", element: "地", trait: "努力家で責任感が強く、目標に向かって着実に進む。" },
  { name: "水瓶座", symbol: "♒", start: 120,  end: "1/20〜2/18", element: "風", trait: "独創的で自由な発想の持ち主。友情を大切にする。" },
  { name: "魚座",   symbol: "♓", start: 219,  end: "2/19〜3/20", element: "水", trait: "優しく感受性豊か。直感と想像力に恵まれる。" },
];

const COLORS = [
  ["赤", "#e5484d"], ["オレンジ", "#f76b15"], ["黄色", "#f5d90a"], ["緑", "#30a46c"],
  ["水色", "#5ec8f2"], ["青", "#3e63dd"], ["紫", "#8e4ec6"], ["ピンク", "#e93d82"],
  ["白", "#f4f4f4"], ["金", "#d4a72c"], ["銀", "#c0c4cc"], ["黒", "#2b2b2b"],
];

const ITEMS = [
  "腕時計", "ハンカチ", "手帳", "イヤホン", "観葉植物", "マグカップ", "香水",
  "ペン", "スニーカー", "チョコレート", "ミニバッグ", "メガネ", "お守り", "文庫本",
];

const OVERALL_MSG = [
  "今日は少し慎重に。焦らず一歩ずつ進めば大丈夫です。",
  "平穏な一日。身の回りの整理整頓が運気を上げます。",
  "良い流れが来ています。小さな挑戦をしてみましょう。",
  "周囲の協力に恵まれる日。感謝を言葉にすると吉。",
  "直感が冴えわたる日。ひらめきを信じて動いてみて。",
  "最高の運気！やりたかったことを実行に移すチャンスです。",
];
const LOVE_MSG = [
  "気持ちが空回りしがち。聞き役に回ると good。",
  "さりげない気遣いが距離を縮めます。",
  "素直な一言が相手の心に届きそう。",
  "思わぬ出会いや嬉しい連絡の予感。",
  "笑顔が最大の魅力。自信を持って。",
];
const WORK_MSG = [
  "ミスに注意。ダブルチェックを心がけて。",
  "コツコツ作業が評価につながる日。",
  "アイデアが採用されやすい。積極的に提案を。",
  "チームワークが成果を生みます。報連相を丁寧に。",
  "集中力が高まる日。難しいタスクに向いています。",
];
const MONEY_MSG = [
  "衝動買いに注意。必要かどうかを一度考えて。",
  "節約が吉。小さな無駄を見直してみましょう。",
  "臨時収入や嬉しいおまけの予感。",
  "自己投資に向いた日。学びにお金を使うと◎。",
  "金運は安定。計画通りに進めればOK。",
];

/* ===== ユーティリティ ===== */

// 文字列 → 32bitハッシュ(xmur3)
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// シード付き乱数(mulberry32)。同じ入力なら同じ結果になる。
function createRng(seedStr) {
  let a = hashString(seedStr);
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

function stars(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatDateLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// "YYYY-MM-DD" → {y, m, d}。不正ならnull
function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

function getSign(m, d) {
  const key = m * 100 + d;
  if (key >= 1222 || key < 120) return SIGNS[9]; // 山羊座
  // 開始日の降順に並べ、最初に key 以上の開始日を満たす星座を採用
  const ordered = SIGNS.filter((s) => s.start !== 1222).sort((a, b) => b.start - a.start);
  return ordered.find((s) => s.start <= key);
}

// 要素を安全に作る(ユーザー入力はテキストとしてのみ挿入)
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ===== 運勢ロジック ===== */

function buildFortune(sign, dateStr) {
  const rng = createRng(`${sign.name}|${dateStr}`);
  const level = () => randInt(rng, 1, 5);
  const overall = level();
  const love = level(), work = level(), money = level();
  const [colorName, colorHex] = pick(rng, COLORS);
  return {
    overall, love, work, money,
    overallMsg: OVERALL_MSG[Math.min(overall, 5)],
    loveMsg: pick(rng, LOVE_MSG),
    workMsg: pick(rng, WORK_MSG),
    moneyMsg: pick(rng, MONEY_MSG),
    colorName, colorHex,
    item: pick(rng, ITEMS),
    number: randInt(rng, 1, 99),
    // 12星座中の順位(同日の全星座を同じ方式で計算)
    rank: calcRank(sign, dateStr),
  };
}

function calcRank(sign, dateStr) {
  const scores = SIGNS.map((s) => {
    const r = createRng(`rank|${s.name}|${dateStr}`);
    return { name: s.name, score: r() };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scores.findIndex((s) => s.name === sign.name) + 1;
}

function renderFortune(sign, dateStr) {
  const f = buildFortune(sign, dateStr);
  const box = document.getElementById("fortune-result");
  box.replaceChildren();

  const head = el("div", "card sign-head");
  head.append(
    el("div", "symbol", sign.symbol),
    el("h2", null, sign.name),
    el("div", "meta", `${sign.end} ／ ${sign.element}のエレメント`),
    el("p", "msg", sign.trait)
  );

  const rank = el("div", "card rank");
  const strong = el("strong", null, String(f.rank));
  rank.append(`${dateStr} の運勢ランキング `, strong, " 位 / 12");
  rank.append(el("div", "stars-text", stars(f.overall)));
  rank.append(el("p", "msg", f.overallMsg));

  const detail = el("div", "card");
  [
    ["💕 恋愛運", f.love, f.loveMsg],
    ["💼 仕事運", f.work, f.workMsg],
    ["💰 金運", f.money, f.moneyMsg],
  ].forEach(([label, lv, msg]) => {
    const row = el("div", "row");
    const left = el("div");
    left.append(el("div", null, label), el("div", "msg", msg));
    row.append(left, el("div", "stars-text", stars(lv)));
    detail.append(row);
  });

  const lucky = el("div", "card lucky");
  const c = el("div");
  const sw = el("span", "swatch");
  sw.style.background = f.colorHex;
  c.append(el("small", null, "ラッキーカラー"));
  c.append(sw, f.colorName);
  const i = el("div");
  i.append(el("small", null, "ラッキーアイテム"), f.item);
  const n = el("div");
  n.append(el("small", null, "ラッキーナンバー"), String(f.number));
  lucky.append(c, i, n);

  box.append(head, rank, detail, lucky);
  box.hidden = false;
}

/* ===== 相性ロジック ===== */

const ELEMENT_SCORE = {
  "火火": 85, "地地": 85, "風風": 85, "水水": 85,
  "火風": 90, "風火": 90, "地水": 90, "水地": 90,
  "火水": 55, "水火": 55, "地風": 55, "風地": 55,
  "火地": 65, "地火": 65, "風水": 65, "水風": 65,
};

const MATCH_COMMENT = [
  [90, "運命的な相性！自然体でいられる最高のパートナーです。"],
  [75, "とても良い相性。お互いを高め合える関係です。"],
  [60, "ほどよい相性。違いを楽しめば絆が深まります。"],
  [0,  "刺激的な組み合わせ。思いやりと対話が鍵になります。"],
];

function renderMatch(a, b) {
  const base = ELEMENT_SCORE[a.element + b.element];
  // 順序に依存しない揺らぎ(±10)
  const key = [a.name, b.name].sort().join("|");
  const jitter = Math.floor(createRng(`match|${key}`)() * 21) - 10;
  const score = Math.max(30, Math.min(99, base + jitter));
  const comment = MATCH_COMMENT.find(([min]) => score >= min)[1];

  const box = document.getElementById("match-result");
  box.replaceChildren();
  const card = el("div", "card score");
  const bar = el("div", "bar");
  const fill = el("span");
  fill.style.width = `${score}%`;
  bar.append(fill);
  card.append(
    el("h2", null, `${a.symbol} ${a.name} × ${b.symbol} ${b.name}`),
    el("div", "pct", `${score}%`),
    bar,
    el("p", null, comment),
    el("p", "msg", `エレメント：${a.element} × ${b.element}`)
  );
  box.append(card);
  box.hidden = false;
}

/* ===== UI ===== */

const STORE_KEY = "horoscope.birthday";

function safeStorage(fn) {
  try { return fn(); } catch { return null; }
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".panel").forEach((p) => {
        p.classList.toggle("active", p.id === `tab-${btn.dataset.tab}`);
      });
    });
  });
}

function setupFortune() {
  const bday = document.getElementById("birthday");
  const target = document.getElementById("target-date");
  const remember = document.getElementById("remember");
  const today = new Date();
  const todayStr = formatDateLocal(today);

  bday.max = todayStr;
  target.value = todayStr;

  const saved = safeStorage(() => localStorage.getItem(STORE_KEY));
  if (saved && parseDate(saved)) {
    bday.value = saved;
    document.getElementById("birthday-a").value = saved;
  }

  document.getElementById("fortune-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const b = parseDate(bday.value);
    const t = parseDate(target.value);
    if (!b || !t) return;
    if (remember.checked) {
      safeStorage(() => localStorage.setItem(STORE_KEY, bday.value));
    } else {
      safeStorage(() => localStorage.removeItem(STORE_KEY));
    }
    renderFortune(getSign(b.m, b.d), target.value);
  });
}

function setupMatch() {
  const a = document.getElementById("birthday-a");
  const b = document.getElementById("birthday-b");
  const todayStr = formatDateLocal(new Date());
  a.max = todayStr;
  b.max = todayStr;

  document.getElementById("match-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const da = parseDate(a.value);
    const db = parseDate(b.value);
    if (!da || !db) return;
    renderMatch(getSign(da.m, da.d), getSign(db.m, db.d));
  });
}

function setupList() {
  const grid = document.getElementById("sign-list");
  SIGNS.forEach((s) => {
    const card = el("div", "card");
    card.append(
      el("div", "symbol", s.symbol),
      el("h3", null, s.name),
      el("p", null, `${s.end}（${s.element}）`),
      el("p", null, s.trait)
    );
    grid.append(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupFortune();
  setupMatch();
  setupList();
});
