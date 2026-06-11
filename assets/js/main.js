/* ================================================================
   AutoProphet Invest — main.js
   File: assets/js/main.js
   Handles: Matrix · Session Clock · Attrition Ticker · Engine ·
            Prophet Loader · Oracle Toggle · Economic Data
   ================================================================ */

'use strict';

/* ── HELPERS ─────────────────────────────────────────────────── */
const $       = (id)     => document.getElementById(id);
const fmt     = (v, d=0) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
const fmtD    = (v)      => fmt(v, 2);
const setText = (id, v)  => { const el=$(id); if(el) el.textContent = v; };
const setHTML = (id, v)  => { const el=$(id); if(el) el.innerHTML   = v; };

/* ── MATRIX RAIN ─────────────────────────────────────────────── */
function initMatrix() {
  const canvas = $('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const fs  = 16;
  let W, H, cols, drops;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols  = Math.floor(W / fs);
    drops = Array(cols).fill(1);
  }
  window.addEventListener('resize', resize);
  resize();

  setInterval(() => {
    ctx.fillStyle   = 'rgba(1,4,9,0.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.font        = `bold ${fs}px monospace`;
    ctx.fillStyle   = 'rgba(59,130,246,0.55)';
    ctx.shadowBlur  = 6;
    ctx.shadowColor = '#3b82f6';
    for (let i = 0; i < cols; i++) {
      ctx.fillText(Math.random() > 0.5 ? '1' : '0', i * fs, drops[i] * fs);
      if (drops[i] * fs > H && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }, 50);
}

/* ── SESSION LOSS CLOCK ──────────────────────────────────────── */
function initSessionClock() {
  if (!$('lossClock')) return;
  let loss = 0;
  setInterval(() => {
    const r   = parseFloat($('rate')?.value)      || 80;
    const h   = parseFloat($('hours')?.value)     || 40;
    const inf = parseFloat($('inflation')?.value) || 0.09;
    const yLoss = r * h * 52 * inf;
    if (yLoss > 0) {
      loss += (yLoss / 31536000) / 10;
      $('lossClock').textContent = '$' + loss.toFixed(4);
    }
  }, 100);
}

/* ── HOMEPAGE ATTRITION TICKER ───────────────────────────────── */
function initAttritionTicker() {
  if (!$('liveBleedTotal')) return;
  const yr    = 65000 * 0.085;
  const rates = {
    sec: yr/(365*24*60*60), min: yr/(365*24*60), hour: yr/(365*24),
    day: yr/365, week: yr/52, month: yr/12, quart: yr/4, year: yr
  };
  setText('valSec',   fmtD(rates.sec));
  setText('valMin',   fmt(rates.min));
  setText('valHour',  fmt(rates.hour));
  setText('valDay',   fmt(rates.day));
  setText('valWeek',  fmt(rates.week));
  setText('valMonth', fmt(rates.month));
  setText('valQuart', fmt(rates.quart));
  setText('valYear',  fmt(rates.year));

  let session = 0;
  setInterval(() => {
    session += rates.sec / 10;
    $('liveBleedTotal').textContent = '$' + session.toFixed(4);
  }, 100);
}

/* ── DECAY CHART ─────────────────────────────────────────────── */
function initDecayChart() {
  const el = $('decayChart');
  if (!el || typeof Chart === 'undefined') return;
  const inf  = 0.085;
  const yrs  = [0,1,2,3,4,5,6,7,8,9,10];
  const data = yrs.map(y => 100000 * Math.pow(1 - inf, y));
  new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels: yrs.map(y => 'Yr ' + y),
      datasets: [{
        label: 'Purchasing Power of $100k',
        data,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.07)',
        borderWidth: 2.5, fill: true, tension: 0.4,
        pointBackgroundColor: '#fff', pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color:'#8b949e', callback: v => fmt(v) }, grid: { color:'rgba(255,255,255,0.04)' } },
        x: { ticks: { color:'#8b949e' }, grid: { display: false } }
      }
    }
  });
}

/* ── REALITY ENGINE ──────────────────────────────────────────── */
let _chartObj = null;

function runAnalysis() {
  const rate      = parseFloat($('rate').value)           || 0;
  const hours     = parseFloat($('hours').value)          || 0;
  const expenses  = parseFloat($('expenses').value) * 12  || 0;
  const infRate   = parseFloat($('inflation').value)      || 0;
  const projYears = parseInt($('projectionYears').value)  || 5;
  const taxRate   = parseFloat($('taxRate')?.value)       || 0.31;
  if (!rate || !hours) return;

  const gross     = rate * hours * 52;
  const taxes     = gross * taxRate;
  const net       = gross - taxes;
  const infYr     = net * infRate;
  const infTot    = infYr * projYears;
  const surplus   = net - expenses;
  const realYr    = net - infYr;
  const realHr    = realYr / (hours * 52);
  const realDay   = realHr * 8;
  const realWk    = realHr * hours;
  const realMo    = realWk * 4.33;
  const realQt    = realMo * 3;

  setText('resTax',     fmt(taxes));
  setText('resInf',     fmt(infTot));
  setText('resSurplus', fmt(surplus));
  setText('projLabel',  projYears + 'Y');

  const surpEl = $('resSurplus');
  if (surpEl) surpEl.style.color = surplus < 0 ? 'var(--red)' : 'var(--green)';

  setText('rbHourly',    fmtD(realHr));
  setText('rbDaily',     fmt(realDay));
  setText('rbWeekly',    fmt(realWk));
  setText('rbMonthly',   fmt(realMo));
  setText('rbQuarterly', fmt(realQt));

  const pill   = $('statusPill');
  const interp = $('interpretation');
  const alert  = realHr < rate * 0.7
    ? '<br><br><strong>SYSTEM ALERT:</strong> Your effective hourly value is significantly reduced after systemic costs — compounding structural inefficiency.'
    : '';

  if (surplus < 0) {
    pill.textContent = 'CRITICAL'; pill.style.cssText = 'background:var(--red);color:#fff;';
    interp.innerHTML = 'SYSTEM CRITICAL — Survival costs exceed net income. This structure is mathematically unsustainable. Immediate restructuring required.' + alert;
  } else if (infYr > surplus * 0.8) {
    pill.textContent = 'UNSTABLE'; pill.style.cssText = 'background:var(--orange);color:#000;';
    interp.innerHTML = 'SYSTEM UNSTABLE — Inflation decay approaches total surplus. You are working for maintenance, not growth. Structural intervention required.' + alert;
  } else if (infYr > surplus * 0.4) {
    pill.textContent = 'STABLE'; pill.style.cssText = 'background:var(--green);color:#000;';
    interp.innerHTML = 'SYSTEM STABLE — Baseline balance achieved. Decay is present but manageable. Focus: widen surplus gap to enable asymmetric capital deployment.' + alert;
  } else {
    pill.textContent = 'OPTIMIZED'; pill.style.cssText = 'background:var(--blue);color:#fff;';
    interp.innerHTML = 'SYSTEM OPTIMIZED — Surplus substantially exceeds decay forces. Position to deploy capital into compounding asymmetric structures.' + alert;
  }

  const area = $('results-area');
  if (area) { area.style.display = 'block'; area.scrollIntoView({ behavior:'smooth', block:'start' }); }

  const chartEl = $('realityChart');
  if (chartEl && typeof Chart !== 'undefined') {
    if (_chartObj) _chartObj.destroy();
    _chartObj = new Chart(chartEl.getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Tax','Inflation','Expenses','Surplus'],
        datasets: [{
          data: [taxes, infYr, expenses, surplus > 0 ? surplus : 0],
          backgroundColor: ['#ef4444','#f97316','#334155','#2563eb'],
          borderColor: '#010409', borderWidth: 2
        }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#8b949e', font:{size:10} } } } }
    });
  }
}

/* ── PROPHET INSIGHT LOADER ──────────────────────────────────── */
async function loadProphetInsight(path) {
  const el = $('insightContainer');
  if (!el) return;

  try {
    const res = await fetch(path || 'data/latest_insight.json');
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();

    const sc  = {CRITICAL:'#ef4444',UNSTABLE:'#f59e0b',STABLE:'#10b981',OPTIMIZED:'#2563eb'}[d.market_status] || '#2563eb';
    const tc  = (d.market_status==='UNSTABLE'||d.market_status==='STABLE') ? '#000' : '#fff';

    const sectors = d.sectors ? `
      <div class="mt-24">
        <span class="eyebrow">Sector Signals</span>
        <div class="sector-grid">
          ${d.sectors.map(s => {
            const c = s.signal==='BULLISH'?'#10b981':s.signal==='BEARISH'?'#ef4444':'#f59e0b';
            return `<div class="bleed-card" style="border-color:${c}33;">
              <span>${s.name}</span>
              <b style="color:${c};font-family:var(--mono);font-size:0.82rem;">${s.signal}</b>
            </div>`;
          }).join('')}
        </div>
      </div>` : '';

    const action = d.action_signal ? `
      <div class="mt-24" style="padding:16px 18px;border-left:3px solid var(--blue);background:rgba(255,255,255,0.02);border-radius:0 6px 6px 0;">
        <span class="eyebrow">Action Signal</span>
        <p style="font-size:0.9rem;color:var(--text-2);line-height:1.75;">${d.action_signal}</p>
      </div>` : '';

    el.innerHTML = `
      <div class="insight-wrap fade-up">
        <div class="insight-meta">
          <span class="live-dot"></span>
          ${d.date} &middot; AUTOPROPHET INTELLIGENCE
          <span class="status-pill" style="background:${sc};color:${tc};margin-left:auto;">${d.market_status}</span>
        </div>
        <h2 class="insight-headline">${d.headline}</h2>
        <p class="insight-body">${d.analysis}</p>
        ${sectors}${action}
      </div>`;
  } catch(e) {
    el.innerHTML = `
      <div class="insight-wrap">
        <p class="mono text-muted" style="font-size:0.75rem;">// FEED OFFLINE — data/latest_insight.json not found.</p>
        <p class="text-dim mt-8" style="font-size:0.85rem;">Run <code style="background:#000;padding:2px 6px;border-radius:3px;">python scripts/generate_insight.py</code> locally or let the GitHub Action handle it daily at 08:00 UTC.</p>
      </div>`;
  }
}

/* ── ECONOMIC DATA LOADER ────────────────────────────────────── */
async function loadEconomicData(path) {
  const el = $('economicData');
  if (!el) return;
  try {
    const res = await fetch(path || 'data/economic_data.json');
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    el.innerHTML = d.indicators.map(ind => `
      <div class="metric-row">
        <span class="m-label">${ind.name}</span>
        <span class="m-val ${ind.trend==='up'?'neg':''}">${ind.value}</span>
      </div>`).join('');
  } catch(e) { /* placeholder rows remain */ }
}

/* ── ORACLE MODE ─────────────────────────────────────────────── */
const TAROT = [
  {card:'The Tower',    meaning:'Structural collapse precedes transformation. Unsustainable systems must break before better ones emerge.'},
  {card:'The Wheel',    meaning:'Cyclical forces are turning. A new macro phase begins — positioning now precedes the obvious signal.'},
  {card:'The Hermit',   meaning:'Real clarity comes from internal audit and structural review, not market noise or external validation.'},
  {card:'The Magician', meaning:'Resources are already present. The barrier is structural misalignment, not material shortage.'},
  {card:'Judgment',     meaning:'A systemic reckoning approaches. Those positioned before the signal capture the full asymmetry.'},
  {card:'The Star',     meaning:'Long-cycle bottom forming. Patient accumulation and quiet positioning is the disciplined response.'},
  {card:'The Chariot',  meaning:'Controlled forward momentum. Deploy with structure and discipline — not urgency or emotion.'},
  {card:'The Emperor',  meaning:'System and framework outlast spontaneous action. Build the structure. The returns follow.'},
  {card:'The World',    meaning:'A major cycle is completing. Consolidate and integrate before the next expansion begins.'},
  {card:'Strength',     meaning:'The move requiring the most patience carries the highest return. Hold the position.'}
];
const PLANETS = [
  'Saturn transit sharpens structural awareness — long-duration positions favored this cycle.',
  'Jupiter conjunct Chiron signals expansion through resolution of prior financial wounds.',
  'Mercury retrograde shadow — delay major commitments; audit and review existing structures.',
  'Venus in practical Virgo — precision over speculation. Detail-level review yields results.',
  'Mars direct — initiating new income structures carries strong forward-momentum energy now.'
];
const SIGN_THEMES = {
  Aries:'bold first-mover positioning and initiation of new income cycles.',
  Taurus:'resource preservation, long-duration holding, and material security.',
  Gemini:'information arbitrage, dual-position hedging, and rapid adaptability.',
  Cancer:'defensive cash positioning and protective allocation strategies.',
  Leo:'high-conviction asymmetric bets and visible leadership in volatility.',
  Virgo:'systematic process optimization and detail-level financial audit.',
  Libra:'portfolio rebalancing, fair value identification, and symmetry.',
  Scorpio:'deep research into hidden value and transformative restructuring.',
  Sagittarius:'macro perspective, global diversification, and philosophical risk tolerance.',
  Capricorn:'long-duration compounding, institutional-grade positioning, and discipline.',
  Aquarius:'contrarian thesis development and systemic disruption positioning.',
  Pisces:'pattern recognition, liquidity optimization, and cyclical flow awareness.'
};
const SIGNS = Object.keys(SIGN_THEMES);

function activateOracle() {
  const panel = $('oraclePanel');
  const icon  = $('oracleIcon');
  if (!panel) return;

  panel.classList.toggle('open');
  if (icon) icon.classList.toggle('open');

  if (!panel.dataset.loaded && panel.classList.contains('open')) {
    const t = TAROT[Math.floor(Math.random() * TAROT.length)];
    const p = PLANETS[Math.floor(Math.random() * PLANETS.length)];
    const s = SIGNS[Math.floor(Math.random() * SIGNS.length)];

    setHTML('oracleContent', `
      <div class="mb-16">
        <span class="eyebrow">Tarot Signal</span>
        <p style="font-family:var(--mono);font-size:1rem;margin-bottom:8px;color:var(--text);">${t.card}</p>
        <p style="font-size:0.88rem;color:var(--text-2);line-height:1.75;">${t.meaning}</p>
      </div>
      <div class="mb-16">
        <span class="eyebrow">Planetary Context</span>
        <p style="font-size:0.88rem;color:var(--text-2);line-height:1.75;">${p}</p>
      </div>
      <div>
        <span class="eyebrow">Archetypal Alignment &mdash; ${s}</span>
        <p style="font-size:0.88rem;color:var(--text-2);line-height:1.75;">Current energy resonates with <strong style="color:var(--text);">${s}</strong> themes: ${SIGN_THEMES[s]}</p>
      </div>`);
    panel.dataset.loaded = '1';
  }
}

/* ── INIT ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMatrix();
  initSessionClock();
  initAttritionTicker();
  initDecayChart();

  const page = document.body.dataset.page;
  if (page === 'prophet') {
    loadProphetInsight('data/latest_insight.json');
    loadEconomicData('data/economic_data.json');
  }
});
