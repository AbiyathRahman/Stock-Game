// Backend API URL
const API_URL = "http://localhost:5000";

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

// ---------- Game state from backend ----------
let gameState = null;

// ---------- Start screen ----------
$("#btnStart").addEventListener("click", async () => {
  const ticker = ($("#ticker").value || "").trim().toUpperCase();
  if (!ticker) {
    $("#errStart").textContent = "Please enter a ticker symbol";
    $("#errStart").classList.remove("hidden");
    return;
  }
  $("#errStart").classList.add("hidden");
  $("#btnStart").disabled = true;
  $("#btnStart").textContent = "Loading...";

  try {
    console.log(`Attempting to start game with ticker: ${ticker}`);
    console.log(`Connecting to: ${API_URL}/start-game`);

    const response = await fetch(`${API_URL}/start-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start game");
    }

    gameState = await response.json();
    console.log("Game state received:", gameState);
    renderMain();
    show("#screen-main");
  } catch (error) {
    console.error("Error starting game:", error);

    // Check if it's a network error
    if (error.message === "Failed to fetch") {
      $("#errStart").textContent =
        "Cannot connect to server. Make sure the backend is running on http://localhost:5000";
    } else {
      $("#errStart").textContent = error.message;
    }
    $("#errStart").classList.remove("hidden");
  } finally {
    $("#btnStart").disabled = false;
    $("#btnStart").textContent = "Start Game";
  }
});

// ---------- Render main screen ----------
function renderMain() {
  if (!gameState) return;

  const currentPrice = gameState.prices[gameState.currentDayIndex].finalPrice;
  const currentDate = gameState.prices[gameState.currentDayIndex].date;

  // Previous price for delta calculation
  let prevPrice = currentPrice;
  if (gameState.currentDayIndex > 0) {
    prevPrice = gameState.prices[gameState.currentDayIndex - 1].finalPrice;
  }

  $("#symTitle").textContent = gameState.ticker;
  $("#dayLabel").textContent = `Day ${gameState.currentDayIndex + 1} of ${
    gameState.prices.length
  }`;

  // Current price with delta
  $("#priceVal").textContent = fmt(currentPrice);
  const priceDelta = currentPrice - prevPrice;
  const pricePct = (priceDelta / prevPrice) * 100;
  const priceEl = $("#priceDelta");
  priceEl.textContent = `${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(
    2
  )} (${pricePct >= 0 ? "+" : ""}${pricePct.toFixed(2)}%)`;
  priceEl.classList.toggle("up", priceDelta >= 0);
  priceEl.classList.toggle("down", priceDelta < 0);

  // Bank account
  $("#bankVal").textContent = fmt(gameState.bank);

  // Investment value
  const investmentValue = gameState.shares * currentPrice;
  $("#invVal").textContent = fmt(investmentValue);
  $("#sharesVal").textContent = `${gameState.shares.toFixed(4)} shares`;

  // Total portfolio
  const portfolioValue = gameState.bank + investmentValue;
  $("#portVal").textContent = fmt(portfolioValue);
  const portfolioDelta = portfolioValue - 10000;
  const portfolioPct = (portfolioDelta / 10000) * 100;
  const portEl = $("#portDelta");
  portEl.textContent = `${
    portfolioDelta >= 0 ? "+" : ""
  }${portfolioDelta.toFixed(2)} (${
    portfolioPct >= 0 ? "+" : ""
  }${portfolioPct.toFixed(2)}%)`;
  portEl.classList.toggle("up", portfolioDelta >= 0);
  portEl.classList.toggle("down", portfolioDelta < 0);
}

// ---------- Actions ----------
$("#btnHold").addEventListener("click", async () => {
  try {
    // Send hold action
    await fetch(`${API_URL}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hold", amount: 1 }),
    });

    // Move to next day
    const response = await fetch(`${API_URL}/next-day`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    // Update game state
    gameState.currentDayIndex = data.currentDayIndex;
    gameState.bank = data.bank;
    gameState.shares = data.shares;

    // Check if game ended
    if (
      data.message === "Game ended. No more data available." ||
      gameState.currentDayIndex >= gameState.prices.length - 1
    ) {
      await finishGame();
    } else {
      renderMain();
    }
  } catch (error) {
    console.error("Hold action failed:", error);
    alert("Failed to process hold action");
  }
});

$("#btnQuit").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to quit and end the game?")) return;

  try {
    const response = await fetch(`${API_URL}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quit", amount: 1 }),
    });

    const data = await response.json();

    if (data.gameOver) {
      gameState.bank = data.summary.finalBalance;
      gameState.shares = 0;
      await finishGame();
    }
  } catch (error) {
    console.error("Quit action failed:", error);
    alert("Failed to quit game");
  }
});

async function finishGame() {
  // Get final game state
  const currentPrice = gameState.prices[gameState.currentDayIndex].finalPrice;
  const finalBalance = gameState.bank + gameState.shares * currentPrice;
  const profitLoss = finalBalance - 10000;
  const profitPct = (profitLoss / 10000) * 100;

  $("#finalVal").textContent = fmt(finalBalance);
  $("#finalDelta").textContent = `${
    profitLoss >= 0 ? "+" : ""
  }${profitLoss.toFixed(2)} (${profitPct >= 0 ? "+" : ""}${profitPct.toFixed(
    2
  )}%)`;

  const resIcon = $("#resIcon");
  resIcon.classList.toggle("up", profitLoss >= 0);
  resIcon.classList.toggle("down", profitLoss < 0);

  $("#resTicker").textContent = gameState.ticker;
  $("#resStart").textContent = fmt(10000);
  $("#resStartDate").textContent = gameState.prices[0].date;
  $("#resEndDate").textContent =
    gameState.prices[gameState.currentDayIndex].date;

  show("#screen-results");
}

$("#btnAgain").addEventListener("click", async () => {
  // Reset game on backend
  try {
    await fetch(`${API_URL}/reset-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    gameState = null;
    $("#ticker").value = "";
    show("#screen-start");
  } catch (error) {
    console.error("Reset failed:", error);
    // Still go back to start even if reset fails
    gameState = null;
    $("#ticker").value = "";
    show("#screen-start");
  }
});

// ---------- Trade modal ----------
let mode = "buy"; // buy | sell
let maxAmt = 0;
const modal = $("#modal");
const txt = $("#txtAmount"),
  sld = $("#sldPct"),
  num = $("#numPct");
const pie = $("#pie"),
  ctx = pie.getContext("2d");

function openTrade(kind) {
  if (!gameState) return;

  mode = kind;
  const currentPrice = gameState.prices[gameState.currentDayIndex].finalPrice;

  $("#tradeTitle").textContent =
    (mode === "sell" ? "Sell" : "Buy") + " — Shares";
  $("#verb").textContent = mode === "sell" ? "sell" : "buy";
  $("#srcLabel").textContent = mode === "sell" ? "Investment" : "Bank Account";
  $("#srcKey").textContent = mode === "sell" ? "Investment" : "Bank";
  $("#tgtKey").textContent = mode === "sell" ? "Bank" : "Investment";

  maxAmt = mode === "sell" ? gameState.shares * currentPrice : gameState.bank;
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

  // Base ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();

  // Slice
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

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
  ctx.fillStyle =
    getComputedStyle(document.body).getPropertyValue("--panel").trim() ||
    "#fff";
  ctx.fill();

  // Label
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

// Confirm trade
$("#btnConfirm").addEventListener("click", async () => {
  const amt = Math.max(0, Math.min(Number(txt.value) || 0, maxAmt));
  if (amt <= 0) {
    alert("Please enter a valid amount");
    return;
  }

  const currentPrice = gameState.prices[gameState.currentDayIndex].finalPrice;
  const shares = amt / currentPrice;

  try {
    // Send action to backend
    const response = await fetch(`${API_URL}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: mode,
        amount: shares,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Transaction failed");
    }

    const data = await response.json();

    // Update local game state
    gameState.bank = data.bank;
    gameState.shares = data.shares;

    closeTrade();

    // Move to next day
    const nextDayResponse = await fetch(`${API_URL}/next-day`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const nextDayData = await nextDayResponse.json();

    // Update game state
    gameState.currentDayIndex = nextDayData.currentDayIndex;
    gameState.bank = nextDayData.bank;
    gameState.shares = nextDayData.shares;

    // Check if game ended
    if (
      nextDayData.message === "Game ended. No more data available." ||
      gameState.currentDayIndex >= gameState.prices.length - 1
    ) {
      await finishGame();
    } else {
      renderMain();
    }
  } catch (error) {
    console.error("Transaction failed:", error);
    alert(error.message);
  }
});

// Initial view
show("#screen-start");
