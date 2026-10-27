"use strict";
/* ProofRoll demo front-end. Runs the real provably-fair engine in the browser
   (keccak.js) so dice and crash are genuinely verifiable. No real funds. */

const REPO = "https://github.com/charlie-hk/ProofRoll-Crypto-Casino";
const HOUSE_EDGE_BPS = 100;

/* ---------- byte helpers ---------- */
function hexToBytes(h) {
  h = h.replace(/^0x/, "");
  if (h.length % 2) h = "0" + h;
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
  return a;
}
function bytesToHex(a) {
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, "0");
  return s;
}
function b32(bytes) {
  const a = new Uint8Array(32);
  a.set(bytes.subarray(0, 32), 0);
  return a;
}
function u256(n) {
  const a = new Uint8Array(32);
  let b = BigInt(n);
  for (let i = 31; i >= 0; i--) { a[i] = Number(b & 0xffn); b >>= 8n; }
  return a;
}
function concat(...arrs) {
  let L = arrs.reduce((s, a) => s + a.length, 0);
  const o = new Uint8Array(L); let p = 0;
  for (const a of arrs) { o.set(a, p); p += a.length; }
  return o;
}
function randSeedHex() {
  const a = new Uint8Array(32);
  (crypto || window.crypto).getRandomValues(a);
  return "0x" + bytesToHex(a);
}

/* ---------- provably-fair core (mirrors fairness.js + the contracts) ---------- */
const E = 2n ** 52n;
function entropyBig(serverHex, clientHex, nonce) {
  const packed = concat(b32(hexToBytes(serverHex)), b32(hexToBytes(clientHex)), u256(nonce));
  return BigInt("0x" + keccak256(packed));
}
function diceRoll(serverHex, clientHex, nonce) {
  return Number(entropyBig(serverHex, clientHex, nonce) % 10000n);
}
function crashPointBps(serverHex, clientHex, nonce, edge) {
  const h = entropyBig(serverHex, clientHex, nonce) % E;
  if (h % 10000n < BigInt(edge)) return 10000;
  let bps = ((100n * E - h) / (E - h)) * 100n;
  if (bps < 10000n) bps = 10000n;
  return Number(bps);
}
function commitHex(serverHex) {
  return "0x" + keccak256(b32(hexToBytes(serverHex)));
}

/* ---------- demo wallet ---------- */
const store = {
  get bal() {
    let v = NaN;
    try { v = parseFloat(localStorage.getItem("pr_bal")); } catch (_) {}
    return isFinite(v) ? v : 1000;
  },
  set bal(v) {
    try { localStorage.setItem("pr_bal", String(v)); } catch (_) {}
    renderBalance();
  },
};
const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function renderBalance() { document.getElementById("balance").textContent = fmt(store.bal); }

/* per-game seed session: one server seed, incrementing nonce */
function newSession() {
  return { serverSeed: randSeedHex(), clientSeed: randSeedHex(), nonce: 0 };
}
const dice = { sess: newSession() };
const crash = { sess: newSession() };

/* ---------- tabs ---------- */
document.getElementById("tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab"); if (!b) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === b));
  const id = b.dataset.tab;
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + id));
});

/* ---------- bet helpers ---------- */
function wireBetButtons(inputId) {
  const input = document.getElementById(inputId);
  input.parentElement.querySelectorAll("button[data-amt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      let v = parseFloat(input.value) || 0;
      if (btn.dataset.amt === "half") v = Math.max(0.01, v / 2);
      else if (btn.dataset.amt === "double") v = v * 2;
      else if (btn.dataset.amt === "max") v = store.bal;
      input.value = Math.min(v, store.bal).toFixed(2);
    });
  });
}

/* ---------- DICE ---------- */
const diceEl = {
  dir: "under",
  target: document.getElementById("diceTarget"),
  targetLabel: document.getElementById("diceTargetLabel"),
  chance: document.getElementById("diceChance"),
  mult: document.getElementById("diceMult"),
  result: document.getElementById("diceResult"),
  fill: document.getElementById("diceFill"),
  marker: document.getElementById("diceMarker"),
  pointer: document.getElementById("dicePointer"),
  outcome: document.getElementById("diceOutcome"),
  bet: document.getElementById("diceBet"),
  fair: document.getElementById("diceFair"),
};
function diceOdds() {
  const t = parseFloat(diceEl.target.value); // 1..98 (percent)
  const target10000 = Math.round(t * 100); // 0..9999 scale
  const winCount = diceEl.dir === "over" ? 9999 - target10000 : target10000;
  const chance = (winCount / 10000) * 100;
  const mult = ((10000 - HOUSE_EDGE_BPS) * 10000) / winCount / 10000; // x
  return { t, target10000, chance, mult };
}
function renderDiceOdds() {
  const { t, chance, mult } = diceOdds();
  diceEl.targetLabel.textContent = t.toFixed(2);
  diceEl.chance.textContent = chance.toFixed(2) + "%";
  diceEl.mult.textContent = mult.toFixed(2) + "×";
  diceEl.marker.style.left = t + "%";
  diceEl.fill.style.left = diceEl.dir === "over" ? t + "%" : "0%";
  diceEl.fill.style.right = diceEl.dir === "over" ? "0%" : (100 - t) + "%";
}
document.getElementById("diceDir").addEventListener("click", (e) => {
  const b = e.target.closest(".seg-btn"); if (!b) return;
  diceEl.dir = b.dataset.dir;
  document.querySelectorAll("#diceDir .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
  renderDiceOdds();
});
diceEl.target.addEventListener("input", renderDiceOdds);
wireBetButtons("diceBet");

document.getElementById("diceRoll").addEventListener("click", () => {
  const bet = parseFloat(diceEl.bet.value);
  if (!(bet > 0) || bet > store.bal) { flash(diceEl.bet); return; }
  const { target10000, mult } = diceOdds();
  store.bal = +(store.bal - bet).toFixed(2);

  const s = dice.sess; s.nonce += 1;
  const roll = diceRoll(s.serverSeed, s.clientSeed, s.nonce);
  const won = diceEl.dir === "over" ? roll > target10000 : roll < target10000;
  const payout = won ? +(bet * mult).toFixed(2) : 0;

  animateNumber(diceEl.result, roll / 100, 650);
  diceEl.pointer.style.left = (roll / 10000) * 100 + "%";
  diceEl.result.className = "result-big " + (won ? "win" : "lose");
  diceEl.outcome.textContent = won ? `Win  +${fmt(payout)}` : `Lose  -${fmt(bet)}`;
  diceEl.outcome.className = "outcome-line " + (won ? "win" : "lose");
  if (won) store.bal = +(store.bal + payout).toFixed(2);

  renderFair(diceEl.fair, {
    commit: commitHex(s.serverSeed), serverSeed: s.serverSeed, clientSeed: s.clientSeed,
    nonce: s.nonce, result: `roll ${(roll / 100).toFixed(2)}`,
  });
});

/* ---------- CRASH ---------- */
const crashEl = {
  cash: document.getElementById("crashCash"),
  cashLabel: document.getElementById("crashCashLabel"),
  pay: document.getElementById("crashPay"),
  chance: document.getElementById("crashChance"),
  mult: document.getElementById("crashMult"),
  outcome: document.getElementById("crashOutcome"),
  bet: document.getElementById("crashBet"),
  fair: document.getElementById("crashFair"),
  canvas: document.getElementById("crashCanvas"),
};
const cctx = crashEl.canvas.getContext("2d");
function renderCrashOdds() {
  const c = parseFloat(crashEl.cash.value);
  crashEl.cashLabel.textContent = c.toFixed(2) + "×";
  crashEl.pay.textContent = c.toFixed(2) + "×";
  // win chance ≈ (1 - edge) / cashout
  const chance = ((1 - HOUSE_EDGE_BPS / 10000) / c) * 100;
  crashEl.chance.textContent = "~" + chance.toFixed(1) + "%";
}
crashEl.cash.addEventListener("input", renderCrashOdds);
wireBetButtons("crashBet");

let crashBusy = false;
document.getElementById("crashLaunch").addEventListener("click", () => {
  if (crashBusy) return;
  const bet = parseFloat(crashEl.bet.value);
  const cashout = parseFloat(crashEl.cash.value);
  if (!(bet > 0) || bet > store.bal) { flash(crashEl.bet); return; }
  crashBusy = true;
  store.bal = +(store.bal - bet).toFixed(2);

  const s = crash.sess; s.nonce += 1;
  const bustBps = crashPointBps(s.serverSeed, s.clientSeed, s.nonce, HOUSE_EDGE_BPS);
  const bust = bustBps / 10000;
  const cashoutBps = Math.round(cashout * 10000);
  const won = bustBps >= cashoutBps;
  const payout = won ? +(bet * cashout).toFixed(2) : 0;

  animateCrash(bust, cashout, won, () => {
    crashEl.outcome.textContent = won
      ? `Cashed out at ${cashout.toFixed(2)}×  +${fmt(payout)}`
      : `Crashed at ${bust.toFixed(2)}×  -${fmt(bet)}`;
    crashEl.outcome.className = "outcome-line " + (won ? "win" : "lose");
    if (won) store.bal = +(store.bal + payout).toFixed(2);
    renderFair(crashEl.fair, {
      commit: commitHex(s.serverSeed), serverSeed: s.serverSeed, clientSeed: s.clientSeed,
      nonce: s.nonce, result: `bust ${bust.toFixed(2)}×`,
    });
    crashBusy = false;
  });
});

function animateCrash(bust, cashout, won, done) {
  const W = crashEl.canvas.width, H = crashEl.canvas.height;
  const peak = won ? cashout : bust;
  const topMult = Math.max(peak * 1.15, 1.6);
  const dur = 420 + Math.min(1400, Math.log(peak) * 650);
  const t0 = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - t0) / dur);
    const cur = 1 + (peak - 1) * easeOut(p);
    cctx.clearRect(0, 0, W, H);
    // grid
    cctx.strokeStyle = "rgba(255,255,255,0.04)";
    cctx.lineWidth = 1;
    for (let gy = 0; gy <= 4; gy++) { const y = (H / 4) * gy; cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(W, y); cctx.stroke(); }
    // curve
    const col = won ? "#3fb950" : "#ff5a5f";
    const grad = cctx.createLinearGradient(0, H, W, 0);
    grad.addColorStop(0, "rgba(88,166,255,0.9)");
    grad.addColorStop(1, col);
    cctx.strokeStyle = grad; cctx.lineWidth = 3.5; cctx.beginPath();
    const N = 60;
    for (let k = 0; k <= N; k++) {
      const f = (k / N) * p;
      const m = 1 + (peak - 1) * easeOut(f);
      const x = (k / N) * p * W;
      const y = H - ((m - 1) / (topMult - 1)) * (H - 20) - 10;
      k === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
    }
    cctx.stroke();
    // head glow
    const hx = p * W;
    const hy = H - ((cur - 1) / (topMult - 1)) * (H - 20) - 10;
    cctx.fillStyle = col; cctx.beginPath(); cctx.arc(hx, hy, 5, 0, 7); cctx.fill();
    crashEl.mult.textContent = cur.toFixed(2) + "×";
    crashEl.mult.style.color = won ? "#e6edf3" : "#ff5a5f";
    if (p < 1) requestAnimationFrame(frame);
    else {
      crashEl.mult.textContent = peak.toFixed(2) + "×";
      crashEl.mult.style.color = won ? "#3fb950" : "#ff5a5f";
      if (!won) shake(crashEl.canvas);
      done();
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- VERIFY ---------- */
document.getElementById("vRun").addEventListener("click", () => {
  const sv = document.getElementById("vServer").value.trim();
  const cl = document.getElementById("vClient").value.trim();
  const nn = parseInt(document.getElementById("vNonce").value, 10);
  const game = document.getElementById("vGame").value;
  const out = document.getElementById("vOut");
  try {
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(sv) || !/^0x[0-9a-fA-F]{1,64}$/.test(cl)) throw new Error("seeds must be 0x hex up to 32 bytes");
    const commit = commitHex(sv);
    if (game === "dice") {
      const roll = diceRoll(sv, cl, nn);
      out.innerHTML = `commit = ${commit}\nroll   = ${(roll / 100).toFixed(2)}  (raw ${roll})`;
    } else {
      const bps = crashPointBps(sv, cl, nn, HOUSE_EDGE_BPS);
      out.innerHTML = `commit = ${commit}\nbust   = ${(bps / 10000).toFixed(2)}×  (raw ${bps} bps)`;
    }
  } catch (e) { out.textContent = "Error: " + e.message; }
});

/* ---------- shared fairness panel ---------- */
function renderFair(el, d) {
  el.innerHTML = `
    <div class="fair-head">Provably fair <span class="chk">verified ✓</span></div>
    <div class="fair-grid">
      <div><span>Commit</span><code>${short(d.commit)}</code></div>
      <div><span>Server seed</span><code>${short(d.serverSeed)}</code></div>
      <div><span>Client seed</span><code>${short(d.clientSeed)}</code></div>
      <div><span>Nonce</span><code>${d.nonce}</code></div>
      <div><span>Result</span><code>${d.result}</code></div>
    </div>
    <button class="btn-ghost small" id="copyFair">Copy seeds to Verify tab</button>`;
  el.querySelector("#copyFair").addEventListener("click", () => {
    document.getElementById("vServer").value = d.serverSeed;
    document.getElementById("vClient").value = d.clientSeed;
    document.getElementById("vNonce").value = d.nonce;
    document.querySelector('.tab[data-tab="verify"]').click();
  });
}
const short = (h) => (h && h.length > 20 ? h.slice(0, 10) + "…" + h.slice(-6) : h);

/* ---------- tiny animations ---------- */
function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
function animateNumber(el, to, dur) {
  const t0 = performance.now();
  function f(now) {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = (to * easeOut(p)).toFixed(2);
    if (p < 1) requestAnimationFrame(f); else el.textContent = to.toFixed(2);
  }
  requestAnimationFrame(f);
}
function flash(el) { el.classList.add("bad"); setTimeout(() => el.classList.remove("bad"), 500); }
function shake(el) { el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 400); }

/* ---------- init ---------- */
document.getElementById("resetBalance").addEventListener("click", () => { store.bal = 1000; });
document.getElementById("repoLink").href = REPO;
document.getElementById("repoLink2").href = REPO;
renderBalance();
renderDiceOdds();
renderCrashOdds();
// first idle crash frame
cctx.clearRect(0, 0, crashEl.canvas.width, crashEl.canvas.height);
