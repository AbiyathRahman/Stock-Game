// Force dark mode on initial load
document.body.classList.add("theme-dark");

// ---------- Theme toggle ----------
const themeBtn = document.getElementById("themeBtn");
if (localStorage.getItem("theme") === "dark")
  document.body.classList.add("theme-dark");
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("theme-dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("theme-dark") ? "dark" : "light"
  );
});

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const show = (id) =>
  ["#screen-start", "#screen-main", "#screen-results"].forEach((s) =>
    $(s).classList.toggle("hidden", s !== id)
  );
const fmt = (v) =>
  "$" +
  Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ---------- Mock price series ----------
function makeSeries() {
  const rows = [];
  let price = 100 + Math.random() * 50;
  const today = new Date();
  for (let i = 730; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    price *= 1 + (Math.random() - 0.5) * 0.02;
    rows.push({
      date: d.toISOString().slice(0, 10),
      close: Math.max(1, +price.toFixed(2)),
    });
  }
  return rows;
}
const SERIES = makeSeries();
let startIdx = (() => {
  // pick start ≥6 months old
  const last = new Date(SERIES[SERIES.length - 1].date);
  const min = new Date(last);
  min.setMonth(min.getMonth() - 6);
  const elig = SERIES.map((r, i) => ({ i, d: new Date(r.date) }))
    .filter((x) => x.d <= min)
    .map((x) => x.i);
  return elig[Math.floor(Math.random() * elig.length)];
})();
let idx = startIdx;

// ---------- Game state ----------
const state = {
  ticker: "AAPL",
  bank: 10000,
  shares: 0,
  price: SERIES[idx].close,
  prev: SERIES[idx].close,
  day: 1,
  total: 7,
  startDate: SERIES[startIdx].date,
  endDate: SERIES[startIdx].date,
};

// ---------- Start screen ----------
$("#btnStart").addEventListener("click", () => {
  const t = ($("#ticker").value || "AAPL").trim().toUpperCase();
  if (!t) {
    $("#errStart").textContent = "Please enter a ticker symbol";
    $("#errStart").classList.remove("hidden");
    return;
  }
  $("#errStart").classList.add("hidden");

  state.ticker = t;
  renderMain();
  show("#screen-main");
});

// ---------- Render main ----------
function renderMain() {
  $("#symTitle").textContent = state.ticker;
  $("#dayLabel").textContent = `Day ${state.day} of ${state.total}`;

  $("#priceVal").textContent = fmt(state.price);
  const d = state.price - state.prev;
  const pct = (d / state.prev) * 100;
  const el = $("#priceDelta");
  el.textContent = `${d >= 0 ? "+" : ""}${d.toFixed(2)} (${
    pct >= 0 ? "+" : ""
  }${pct.toFixed(2)}%)`;
  el.classList.toggle("up", d >= 0);
  el.classList.toggle("down", d < 0);

  $("#bankVal").textContent = fmt(state.bank);
  const inv = state.shares * state.price;
  $("#invVal").textContent = fmt(inv);
  $("#sharesVal").textContent = `${state.shares.toFixed(4)} shares`;

  const port = state.bank + inv;
  $("#portVal").textContent = fmt(port);
  const pd = port - 10000,
    pp = (pd / 10000) * 100;
  const pe = $("#portDelta");
  pe.textContent = `${pd >= 0 ? "+" : ""}${pd.toFixed(2)} (${
    pp >= 0 ? "+" : ""
  }${pp.toFixed(2)}%)`;
  pe.classList.toggle("up", pd >= 0);
  pe.classList.toggle("down", pd < 0);
}

function nextDay() {
  if (idx < SERIES.length - 1) idx++;
  state.prev = state.price;
  state.price = SERIES[idx].close;
  state.day = Math.min(state.day + 1, state.total);
  state.endDate = SERIES[idx].date;
}

// ---------- Actions ----------
$("#btnHold").addEventListener("click", () => {
  nextDay();
  if (state.day >= state.total) return finish();
  renderMain();
});
$("#btnQuit").addEventListener("click", finish);

function finish() {
  // liquidate
  state.bank += state.shares * state.price;
  state.shares = 0;
  $("#finalVal").textContent = fmt(state.bank);
  const pnl = state.bank - 10000,
    pp = (pnl / 10000) * 100;
  $("#finalDelta").textContent = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${
    pp >= 0 ? "+" : ""
  }${pp.toFixed(2)}%)`;
  $("#resIcon").classList.toggle("up", pnl >= 0);
  $("#resIcon").classList.toggle("down", pnl < 0);
  $("#resTicker").textContent = state.ticker;
  $("#resStart").textContent = fmt(10000);
  $("#resStartDate").textContent = state.startDate;
  $("#resEndDate").textContent = state.endDate;
  show("#screen-results");
}
$("#btnAgain").addEventListener("click", () => {
  // reset quick
  startIdx = (() => {
    const last = new Date(SERIES[SERIES.length - 1].date);
    const min = new Date(last);
    min.setMonth(min.getMonth() - 6);
    const elig = SERIES.map((r, i) => ({ i, d: new Date(r.date) }))
      .filter((x) => x.d <= min)
      .map((x) => x.i);
    return elig[Math.floor(Math.random() * elig.length)];
  })();
  idx = startIdx;
  Object.assign(state, {
    bank: 10000,
    shares: 0,
    price: SERIES[idx].close,
    prev: SERIES[idx].close,
    day: 1,
    total: 7,
    startDate: SERIES[startIdx].date,
    endDate: SERIES[startIdx].date,
  });
  show("#screen-start");
});

// ---------- Trade modal (3 synced inputs) ----------
let mode = "buy"; // buy | sell
let maxAmt = 0;
const modal = $("#modal");
const txt = $("#txtAmount"),
  sld = $("#sldPct"),
  num = $("#numPct");
const pie = $("#pie"),
  ctx = pie.getContext("2d");

function openTrade(kind) {
  mode = kind;
  $("#tradeTitle").textContent =
    (mode === "sell" ? "Sell" : "Buy") + " — Shares";
  $("#verb").textContent = mode === "sell" ? "sell" : "buy";
  $("#srcLabel").textContent = mode === "sell" ? "Investment" : "Bank Account";
  $("#srcKey").textContent = mode === "sell" ? "Investment" : "Bank";
  $("#tgtKey").textContent = mode === "sell" ? "Bank" : "Investment";

  maxAmt = mode === "sell" ? state.shares * state.price : state.bank;
  $("#srcAmt").textContent = fmt(maxAmt);
  txt.value = "0";
  num.value = "0";
  sld.value = "0";
  updateSliderBg(0);
  drawPie(0);
  $("#srcLeft").textContent = fmt(maxAmt);
  $("#tgtAmt").textContent = fmt(0);
  $("#amtLive").textContent = fmt(0);

  modal.classList.remove("hidden");
}
function closeTrade() {
  modal.classList.add("hidden");
}

function syncFrom(source) {
  let pct = Number(num.value) || 0;
  if (source === "slider") pct = Number(sld.value) || 0;
  if (source === "pie") pct = Number(num.value) || 0;
  pct = Math.max(0, Math.min(100, pct));
  num.value = String(Math.round(pct));
  sld.value = String(pct);
  updateSliderBg(pct);
  const amt = (pct / 100) * maxAmt;
  txt.value = amt.toFixed(2);
  drawPie(pct);
  $("#srcLeft").textContent = fmt(maxAmt - amt);
  $("#tgtAmt").textContent = fmt(amt);
  $("#amtLive").textContent = fmt(amt);
}
function syncFromText() {
  let amt = Math.max(0, Math.min(Number(txt.value) || 0, maxAmt));
  const pct = maxAmt ? (amt / maxAmt) * 100 : 0;
  num.value = String(Math.round(pct));
  sld.value = String(pct);
  updateSliderBg(pct);
  drawPie(pct);
  $("#srcLeft").textContent = fmt(maxAmt - amt);
  $("#tgtAmt").textContent = fmt(amt);
  $("#amtLive").textContent = fmt(amt);
}

$("#btnBuy").addEventListener("click", () => openTrade("buy"));
$("#btnSell").addEventListener("click", () => openTrade("sell"));
$("#btnClose").addEventListener("click", closeTrade);
$("#btnCancel").addEventListener("click", closeTrade);

num.addEventListener("input", () => syncFrom("num"));
sld.addEventListener("input", () => syncFrom("slider"));
txt.addEventListener("input", syncFromText);

// Canvas pie interactions
let dragging = false;
function drawPie(pct) {
  const cx = pie.width / 2,
    cy = pie.height / 2,
    r = 90;
  ctx.clearRect(0, 0, pie.width, pie.height);
  // base ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();
  // slice
  const col = mode === "sell" ? "#f59e0b" : "#10b981";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(
    cx,
    cy,
    r,
    -Math.PI / 2,
    -Math.PI / 2 + 2 * Math.PI * (pct / 100),
    false
  );
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  // inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
  ctx.fillStyle =
    getComputedStyle(document.body).getPropertyValue("--panel").trim() ||
    "#fff";
  ctx.fill();
  // label
  ctx.fillStyle =
    getComputedStyle(document.body).getPropertyValue("--ink").trim() || "#222";
  ctx.font = "16px system-ui";
  const label = `${Math.round(pct)}%`;
  const tw = ctx.measureText(label).width;
  ctx.fillText(label, cx - tw / 2, cy + 6);
  $("#pieHint").textContent = `${Math.round(pct)}% of max`;
}
function setPieFromPoint(x, y) {
  const rect = pie.getBoundingClientRect();
  const cx = rect.left + pie.width / 2,
    cy = rect.top + pie.height / 2;
  const ang = Math.atan2(y - cy, x - cx);
  let a = ang - -Math.PI / 2;
  if (a < 0) a += 2 * Math.PI;
  const pct = Math.max(0, Math.min(100, (a / (2 * Math.PI)) * 100));
  num.value = String(Math.round(pct));
  syncFrom("pie");
}
pie.addEventListener("pointerdown", (e) => {
  dragging = true;
  setPieFromPoint(e.clientX, e.clientY);
  pie.setPointerCapture(e.pointerId);
});
pie.addEventListener("pointermove", (e) => {
  if (dragging) setPieFromPoint(e.clientX, e.clientY);
});
pie.addEventListener("pointerup", () => (dragging = false));
pie.addEventListener("pointercancel", () => (dragging = false));

function updateSliderBg(pct) {
  const col = mode === "sell" ? "#f59e0b" : "#10b981";
  $(
    "#sldPct"
  ).style.background = `linear-gradient(90deg, ${col} 0%, ${col} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
}

$("#btnConfirm").addEventListener("click", () => {
  const amt = Math.max(0, Math.min(Number(txt.value) || 0, maxAmt));
  if (amt <= 0) return;
  if (mode === "buy") {
    const qty = amt / state.price;
    state.bank -= amt;
    state.shares += qty;
  } else {
    const qty = amt / state.price;
    state.bank += amt;
    state.shares = Math.max(0, state.shares - qty);
  }
  closeTrade();
  nextDay();
  if (state.day >= state.total) return finish();
  renderMain();
});

// initial view
show("#screen-start");
