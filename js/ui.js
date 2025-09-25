// ui.js — Daily/Monthly/Race 통합 + 모바일 휠피커 + Time→Pace(↔︎) 자동계산
/* eslint-disable */

import { kmFontScale, applyFontTheme } from './fonts.js';

/* =========================
   상태
========================= */
let parsedData   = { km:null, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };
let recordType   = 'daily';
let layoutType   = 'type1';
let selectedFont = 'Helvetica Neue';
let selectedDate = new Date();
let isAnimatingRace = false;

const raceState = { races: [], dist: null, bg: 'white' };
const AUTO_SYNC = { timeToPace: true, paceToTime: true }; // 원하면 false로 끄면 됨
let isSyncing = false; // 루프 방지

/* =========================
   DOM
========================= */
// 공통 UI
const fontGridEl  = document.getElementById('font-grid');
const bgRow       = document.getElementById('bg-row');
const modeRow     = document.getElementById('mode-row');
const layoutRow   = document.getElementById('layout-row');
const dateSection = document.getElementById('date-section');
const dateInput   = document.getElementById('date-input');
const dateDisplay = document.getElementById('date-display');
const statsGrid   = document.getElementById('stats-grid');
const runsWrap    = document.getElementById('runs-wrap');
const paceWrap    = document.getElementById('pace-wrap');
const timeWrap    = document.getElementById('time-wrap');
const uploadLabelText = document.getElementById('upload-label-text');
const fileInputEl = document.getElementById('file-upload');

// 보드 스위칭
const dmPanel   = document.getElementById('dm-panel');
const racePanel = document.getElementById('race-panel');
const dmBoard   = document.getElementById('dm-board');
const raceBoard = document.getElementById('race-board');

// Race 입력
const raceMonthSel     = document.getElementById('race-month');
const raceListSel      = document.getElementById('race-list');
const raceNameInput    = document.getElementById('race-name-input');

const raceDistGrid     = document.getElementById('race-dist-grid');
const raceDistManualCk = document.getElementById('race-dist-manual-check');
const raceDistManualIn = document.getElementById('race-dist-manual');

const raceHH = document.getElementById('race-hh');
const raceMM = document.getElementById('race-mm');
const raceSS = document.getElementById('race-ss');
const racePaceMM = document.getElementById('race-pace-mm');
const racePaceSS = document.getElementById('race-pace-ss');

const racePB     = document.getElementById('race-pb');
const racePBMsg  = document.getElementById('race-pb-congrats');
const raceBgRow  = document.getElementById('race-bg-row');

// Race 출력
const raceTitleEl     = document.getElementById('race-title');
const raceSubtypeEl   = document.getElementById('race-subtype');
const raceTimeEl      = document.getElementById('race-time');
const racePaceEl      = document.getElementById('race-pace');
const badgePB         = document.getElementById('badge-pb');
const badgeSub3       = document.getElementById('badge-sub3');
const badgeSub4       = document.getElementById('badge-sub4');
const racePaceWrap    = document.querySelector('.race-pace-wrap');

/* =========================
   상수/유틸
========================= */
const MONTH_ABBR = ["JAN.","FEB.","MAR.","APR.","MAY.","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];

const zero2txt = (n)=>String(n).padStart(2,'0');
const cssEsc   = (s)=> (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(s) : String(s).replace(/"/g,'\\"');
const isFiniteNum = (x)=>Number.isFinite(x);
const sleep = (ms)=>new Promise(res=>setTimeout(res, ms));
const isMobile = ()=> /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser|Windows Phone|Opera Mini/i.test(navigator.userAgent);

function ensureFontReady(fontFamily, weight = 700, sizePx = 200, style='normal'){
  if (!('fonts' in document) || typeof document.fonts.load !== 'function') return Promise.resolve();
  const fam = `"${fontFamily}"`;
  return document.fonts.load(`${style} ${weight} ${sizePx}px ${fam}`).catch(()=>{});
}

/* 입력/셀렉트를 pill 버튼 규격으로 동기화 */
function syncPillLikeToPillBtn(){
  const ref = document.querySelector('.pill-btn');
  if (!ref) return;
  const cs = getComputedStyle(ref);
  const root = document.documentElement.style;
  root.setProperty('--pill-h', cs.height);
  root.setProperty('--pill-radius', cs.borderTopLeftRadius);
  root.setProperty('--pill-bw', cs.borderTopWidth);
  root.setProperty('--pill-fz', cs.fontSize);
  root.setProperty('--pill-fw', cs.fontWeight);
}

/* =========================
   날짜/표시
========================= */
function formatDateText(d){
  const day = String(d.getDate());
  const yr  = d.getFullYear();
  if (recordType === 'daily' && layoutType === 'type2') {
    const monShort = MONTH_ABBR[d.getMonth()];
    return `${day} ${monShort} ${yr}`;
  }
  if (recordType === 'monthly') {
    const monLong = d.toLocaleString('en-US', { month: 'long' });
    return `${monLong} ${yr}`;
  }
  return ``;
}
function renderDateDisplay(){
  if (dateDisplay) dateDisplay.textContent = formatDateText(selectedDate);
}

/* =========================
   숫자 표기 (DM)
========================= */
function truncate(value, digits){ const f=Math.pow(10,digits); return Math.floor((Number(value)||0)*f)/f; }
function formatKm(value){ const v=Math.max(0, Number(value)||0); return (recordType==='monthly') ? truncate(v,1).toFixed(1) : truncate(v,2).toFixed(2); }
function renderKm(value){ const el=document.getElementById('km'); if(el) el.textContent = formatKm(value); }

/* =========================
   레이아웃 (DM)
========================= */
function updateGridCols(){
  if(!statsGrid) return;
  const cols = (layoutType==='type1') ? 1 : (recordType==='monthly' ? 3 : 2);
  statsGrid.style.setProperty('--cols', cols);
}
function layoutStatsGrid(){
  if (layoutType === 'type1'){
    [runsWrap, paceWrap, timeWrap].forEach(el=>{
      if(!el) return; el.style.gridColumn=''; el.style.transform=''; el.style.marginLeft='';
    });
    return;
  }
  if (recordType === 'daily'){
    if (paceWrap) { paceWrap.style.gridColumn='1 / 2'; paceWrap.style.transform='translateX(0)'; paceWrap.style.marginLeft='0'; }
    if (timeWrap) { timeWrap.style.gridColumn='2 / 3'; timeWrap.style.transform=`translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`; timeWrap.style.marginLeft='0'; }
  } else if (recordType === 'monthly') {
    if (runsWrap) { runsWrap.style.gridColumn='1 / 2'; runsWrap.style.transform='translateX(0)'; }
    if (paceWrap) { paceWrap.style.gridColumn='2 / 3'; paceWrap.style.transform=`translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`; }
    if (timeWrap) { timeWrap.style.gridColumn='3 / 4'; timeWrap.style.transform=`translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull2').trim()})`; }
  }
}

/* =========================
   포맷 (DM)
========================= */
function parseTimeToSecFlexible(raw){
  if(!raw) return NaN;
  const t = String(raw).trim()
    .replace(/[’'′]/g,':').replace(/[″"]/g,':').replace(/：/g,':');
  const m3 = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m3) return (+m3[1])*3600 + (+m3[2])*60 + (+m3[3]);
  const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m2) return (+m2[1])*60 + (+m2[2]);
  return NaN;
}
function getTimeSecFromParsed(pd){
  if (pd.timeH!=null || pd.timeM!=null || pd.timeS!=null){
    const H = pd.timeH||0, M=pd.timeM||0, S=pd.timeS||0;
    const sec = H*3600 + M*60 + S;
    if (sec>0) return sec;
  }
  if (pd.timeRaw){
    const sec = parseTimeToSecFlexible(pd.timeRaw);
    if (isFinite(sec) && sec>0) return sec;
  }
  return NaN;
}
function formatPaceByType(){
  const hasValidOcrPace =
    parsedData.paceMin!=null && parsedData.paceSec!=null &&
    (parsedData.paceMin + parsedData.paceSec) > 0;
  let mm, ss;
  if (hasValidOcrPace){
    mm = String(parsedData.paceMin); ss = zero2txt(parsedData.paceSec);
  } else {
    const tsec = getTimeSecFromParsed(parsedData);
    const km = parseFloat(parsedData.km);
    if (isFinite(tsec) && tsec>0 && isFinite(km) && km>0){
      const psec = Math.max(0, Math.round(tsec / km));
      mm = String(Math.floor(psec/60));
      ss = zero2txt(psec%60);
    } else { return (layoutType==='type1') ? '--:-- /km' : '--:--'; }
  }
  return (layoutType==='type1') ? `${mm}:${ss} /km` : `${mm}:${ss}`;
}
function formatTimeByType(){
  if(layoutType==='type2') return parsedData.timeRaw ? parsedData.timeRaw : '00:00';
  const H = parsedData.timeH ?? 0, M = parsedData.timeM ?? 0, S = parsedData.timeS ?? 0;
  if (H > 0) return `${H}h ${zero2txt(M)}m ${zero2txt(S)}s`;
  return `${String(M)}m ${zero2txt(S)}s`;
}
function renderStats(){
  if (recordType === 'race') return;
  const paceLabel = document.getElementById('pace-label');
  const timeLabel = document.getElementById('time-label');
  if (paceLabel) paceLabel.textContent = 'Avg. Pace';
  if (timeLabel) timeLabel.textContent = 'Time';

  if (runsWrap) runsWrap.style.display = (recordType === 'monthly') ? 'block' : 'none';
  if (recordType === 'monthly') {
    const runsVal = (parsedData.runs == null || Number.isNaN(parsedData.runs)) ? '--' : parsedData.runs;
    const runsEl = document.getElementById('runs');
    if (runsEl) runsEl.textContent = String(runsVal);
  }
  const paceEl = document.getElementById('pace');
  const timeEl = document.getElementById('time');
  if (paceEl) paceEl.textContent = formatPaceByType();
  if (timeEl) timeEl.textContent = formatTimeByType();

  updateGridCols();
  layoutStatsGrid();
}

/* =========================
   캔버스 스케일/애니
========================= */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
function animateNumber(id,start,end,duration){
  return new Promise(resolve=>{
    const el = document.getElementById(id); let t0;
    function step(t){ if(!t0)t0=t; const r=Math.min((t-t0)/duration,1);
      const val = (start+(end-start)*easeOutCubic(r));
      if (el) el.textContent = formatKm(val);
      r<1 ? requestAnimationFrame(step) : resolve();
    }
    requestAnimationFrame(step);
  });
}
function runAnimation(){
  const end = isFiniteNum(parsedData.km) ? parsedData.km : parseFloat((document.getElementById('km')?.textContent||'0').replace(/[^\d.]/g,'')) || 0;
  return animateNumber('km', 0, end, 1600);
}
function animateRaceTime(id, endSec, duration=2400){
  return new Promise(resolve=>{
    const el = document.getElementById(id); if(!el){ resolve(); return; }
    let t0;
    function step(t){
      if(!t0) t0=t;
      const r = Math.min((t - t0)/duration, 1);
      const cur = Math.round(endSec * easeOutCubic(r));
      el.textContent = secToRaceDisplay(cur);
      (r<1) ? requestAnimationFrame(step) : resolve();
    }
    requestAnimationFrame(step);
  });
}
function scaleStageCanvas(){
  const canvas = document.getElementById('stage-canvas');
  if(!canvas) return;
  const vw = window.innerWidth;
  const logicalWidth = (vw < 430) ? 540 : 720;
  const scale = Math.min(vw / logicalWidth, 1);
  canvas.style.transform = `scale(${scale})`;
}
function syncDateWidth(){
  if (layoutType !== 'type2') return;
  const row = document.getElementById('km-row');
  if (!row || !dateDisplay) return;
  const width = row.getBoundingClientRect().width;
  dateDisplay.style.width = width + 'px';
}
function fitKmRow(){
  const stage   = document.getElementById('stage');
  const row     = document.getElementById('km-row');
  const measure = document.getElementById('km-measure');
  const kmEl    = document.getElementById('km');
  if(!stage || !row || !measure || !kmEl) return;

  const kmCS = window.getComputedStyle(kmEl);
  measure.style.fontFamily = kmCS.fontFamily;
  measure.style.fontSize   = kmCS.fontSize;
  measure.style.fontStyle  = kmCS.fontStyle;
  measure.style.fontWeight = kmCS.fontWeight;

  measure.textContent = kmEl.textContent;

  const stCS = window.getComputedStyle(stage);
  const padL = parseFloat(stCS.paddingLeft)  || 0;
  const padR = parseFloat(stCS.paddingRight) || 0;
  const avail = stage.clientWidth - (padL + padR);

  const safe  = 0.98;
  const need  = measure.scrollWidth;
  const baseFit  = need ? Math.min(1, (avail * safe) / need) : 1;

  const css = getComputedStyle(document.body);
  const typeScale = parseFloat(css.getPropertyValue('--kmScale')) || 1;
  const modeScale = parseFloat(css.getPropertyValue('--modeKmScale')) || 1;
  const fontScale = (kmFontScale[selectedFont] && kmFontScale[selectedFont][layoutType]) ? kmFontScale[selectedFont][layoutType] : 1;

  row.style.transform = `scale(${baseFit * typeScale * fontScale * modeScale})`;
  syncDateWidth();
}

/* ──────────────── 배지 페이드(레이아웃 유지) ──────────────── */
function prepBadgesForFade(){
  [badgePB, badgeSub3, badgeSub4].forEach(b=>{
    if(!b) return;
    if (getComputedStyle(b).display === 'none') b.style.display = 'inline-block';
    b.style.visibility = 'hidden';
    b.style.opacity = '0';
    b.style.transform = 'translateY(-6px)';
    b.style.transition = 'opacity 420ms ease, transform 420ms ease';
  });
}
function fadeInVisibleBadges(){
  [badgePB, badgeSub3, badgeSub4].forEach(b=>{
    if(!b) return;
    if (b.dataset._targetVisible === '1'){
      b.style.visibility = 'visible';
      void b.offsetWidth;
      b.style.opacity = '1';
      b.style.transform = 'translateY(0)';
    }else{
      b.style.visibility = 'hidden';
      b.style.opacity = '0';
      b.style.transform = 'translateY(-6px)';
    }
  });
}
function applyBadgeVisibilityNow(){
  [badgePB, badgeSub3, badgeSub4].forEach(b=>{
    if(!b) return;
    const on = b.dataset._targetVisible === '1';
    b.style.transition = 'none';
    b.style.visibility = on ? 'visible' : 'hidden';
    b.style.opacity    = on ? '1' : '0';
    b.style.transform  = 'translateY(0)';
    requestAnimationFrame(()=>{ b.style.transition = 'opacity 420ms ease, transform 420ms ease'; });
  });
}

/* =========================
   폰트/배경/모드/레이아웃
========================= */
function updateActive(groupEl, targetBtn){
  if(!groupEl) return;
  [...groupEl.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  if(targetBtn) targetBtn.classList.add('is-active');
}

/* 상단 UI(버튼/인풋 등)는 어떤 모드/폰트 선택에도 폰트 고정 */
function applyWideFontScope(){ document.body.classList.remove('wide-font'); }

// Daily/Monthly 전역 적용 예외 폰트: KM 숫자에만 적용
const DM_FONT_EXCEPT = new Set(["Londrina Shadow", "Rock Salt"]);

/** Daily/Monthly 보드의 폰트 범위를 재적용 */
function applyDmStageFontScope(){
  if (recordType === 'race') return;
  const useAll = !DM_FONT_EXCEPT.has(selectedFont);
  const targets = [
    document.getElementById('date-display'),
    document.getElementById('km-word'),
    ...document.querySelectorAll('#stats-grid .label, #stats-grid .stat')
  ];
  targets.forEach(el=>{
    if (!el) return;
    if (useAll){
      el.style.fontFamily = `"${selectedFont}", sans-serif`;
      el.style.fontSynthesis = 'none';
    } else {
      el.style.fontFamily = '';
      el.style.fontSynthesis = '';
    }
  });
}

/* =========================
   거리/시간/페이스 계산 유틸
========================= */
function getCurrentDistKm(){
  if (raceState.dist==='5K') return 5;
  if (raceState.dist==='10K') return 10;
  if (raceState.dist==='Half') return 21.0975;
  if (raceState.dist==='Marathon') return 42.195;
  if (raceDistManualCk?.checked){
    const v = parseFloat(raceDistManualIn?.value||'');
    if (isFinite(v) && v>0) return v;
  }
  return null;
}
function computeRaceSeconds(){ return (+raceHH?.value||0)*3600 + (+raceMM?.value||0)*60 + (+raceSS?.value||0); }
function secToRaceDisplay(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return (h>0) ? `${h}:${zero2txt(m)}:${zero2txt(s)}` : `${m}:${zero2txt(s)}`;
}
function computeRacePaceText(){
  const mm = +racePaceMM?.value || 0;
  const ss = +racePaceSS?.value || 0;
  if (mm+ss>0) return `${mm}:${zero2txt(ss)} /km`;
  const distKm = getCurrentDistKm();
  const sec = computeRaceSeconds();
  if (!distKm || sec<=0) return `0:00 /km`;
  const p = Math.round(sec / distKm);
  return `${Math.floor(p/60)}:${zero2txt(p%60)} /km`;
}

/* ───────── 자동 동기화: Time → Pace (↔︎ Pace → Time) ───────── */
function syncPaceFromTime(){
  if (!AUTO_SYNC.timeToPace || isSyncing) return;
  const distKm = getCurrentDistKm(); if (!distKm) return;
  const sec = computeRaceSeconds(); if (sec<=0) return;

  const p = Math.max(0, Math.round(sec / distKm));
  const mm = Math.floor(p/60), ss = p%60;

  isSyncing = true;
  if (racePaceMM) racePaceMM.value = String(mm);
  if (racePaceSS) racePaceSS.value = String(ss);
  isSyncing = false;
}
function syncTimeFromPace(){
  if (!AUTO_SYNC.paceToTime || isSyncing) return;
  const distKm = getCurrentDistKm(); if (!distKm) return;

  const mm = +racePaceMM?.value || 0;
  const ss = +racePaceSS?.value || 0;
  const psec = mm*60 + ss;
  if (psec<=0) return;

  const tot = Math.round(psec * distKm);
  const H = Math.floor(tot/3600), M = Math.floor((tot%3600)/60), S = tot%60;

  isSyncing = true;
  if (raceHH) raceHH.value = String(H);
  if (raceMM) raceMM.value = String(M);
  if (raceSS) raceSS.value = String(S);
  isSyncing = false;
}

/* =========================
   모바일 휠피커 (네이티브 select 활용)
========================= */
function injectPickerCSS(){
  if (document.getElementById('wheel-picker-style')) return;
  const css = `
  .picker-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:flex-end;}
  .picker-panel{background:#fff;width:100%;border-top-left-radius:16px;border-top-right-radius:16px;box-shadow:0 -8px 24px rgba(0,0,0,.2);padding:12px;animation:slideUp .18s ease-out;}
  .picker-head{display:flex;justify-content:space-between;align-items:center;padding:6px 4px 10px;}
  .picker-title{font-weight:700}
  .picker-actions button{appearance:none;border:none;background:#111;color:#fff;border-radius:10px;padding:8px 14px;font-weight:700}
  .picker-actions .cancel{background:#e5e5e5;color:#111;margin-right:6px}
  .picker-grid{display:grid;grid-template-columns: repeat(var(--cols,3),1fr);gap:8px;padding:6px 0 2px}
  .picker-grid label{font-size:12px;color:#555;display:block;margin-bottom:4px}
  .picker-grid select{width:100%;padding:10px;border-radius:12px;border:1px solid #e4e4e7;font-size:18px}
  @keyframes slideUp{from{transform:translateY(12px);opacity:.6}to{transform:translateY(0);opacity:1}}
  `;
  const style = document.createElement('style');
  style.id = 'wheel-picker-style';
  style.textContent = css;
  document.head.appendChild(style);
}
function buildSelect(min,max,cur,pad2=true){
  const sel = document.createElement('select');
  for(let v=min; v<=max; v++){
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = pad2 ? String(v).padStart(2,'0') : String(v);
    if (v===cur) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}
function openWheelPicker({ title='Select', cols=3, fields=[/* {label,min,max,value,pad2} */], onCancel, onOK }){
  injectPickerCSS();
  const ov = document.createElement('div'); ov.className='picker-overlay';
  const panel = document.createElement('div'); panel.className='picker-panel'; panel.style.setProperty('--cols', String(cols));
  const head = document.createElement('div'); head.className='picker-head';
  const hTitle = document.createElement('div'); hTitle.className='picker-title'; hTitle.textContent = title;
  const hActions = document.createElement('div'); hActions.className='picker-actions';
  const btnCancel = document.createElement('button'); btnCancel.className='cancel'; btnCancel.textContent='Cancel';
  const btnOK = document.createElement('button'); btnOK.textContent='Done';
  hActions.appendChild(btnCancel); hActions.appendChild(btnOK);
  head.appendChild(hTitle); head.appendChild(hActions);

  const grid = document.createElement('div'); grid.className='picker-grid';
  const selects = [];
  fields.forEach(f=>{
    const wrap = document.createElement('div');
    const lab = document.createElement('label'); lab.textContent = f.label||'';
    const sel = buildSelect(f.min, f.max, f.value, f.pad2!==false);
    wrap.appendChild(lab); wrap.appendChild(sel);
    grid.appendChild(wrap);
    selects.push(sel);
  });

  panel.appendChild(head); panel.appendChild(grid);
  ov.appendChild(panel);
  document.body.appendChild(ov);

  const close = ()=>{
    ov.remove();
    if (onCancel) onCancel();
  };
  btnCancel.addEventListener('click', close);
  ov.addEventListener('click', (e)=>{ if (e.target===ov) close(); });

  btnOK.addEventListener('click', ()=>{
    const vals = selects.map(s=> +s.value);
    ov.remove();
    if (onOK) onOK(vals);
  });
}
function enableMobileWheelPickers(){
  if (!isMobile()) return;

  const preventKeyboard = (inp)=>{ if (!inp) return; inp.readOnly = true; inp.setAttribute('inputmode','none'); };

  [raceHH,raceMM,raceSS,racePaceMM,racePaceSS].forEach(preventKeyboard);

  const openTime = ()=>{
    const h  = +raceHH?.value || 0;
    const m  = +raceMM?.value || 0;
    const s  = +raceSS?.value || 0;
    openWheelPicker({
      title:'Finish Time',
      cols:3,
      fields:[
        {label:'HH', min:0, max:99, value:h},
        {label:'MM', min:0, max:59, value:m},
        {label:'SS', min:0, max:59, value:s},
      ],
      onOK(vals){
        const [H,M,S] = vals;
        if (raceHH) raceHH.value = String(H);
        if (raceMM) raceMM.value = String(M);
        if (raceSS) raceSS.value = String(S);
        // 자동 동기화 & 보드 갱신
        syncPaceFromTime();
        renderRaceBoard(true);
      }
    });
  };
  const openPace = ()=>{
    const m  = +racePaceMM?.value || 0;
    const s  = +racePaceSS?.value || 0;
    openWheelPicker({
      title:'Pace (/km)',
      cols:2,
      fields:[
        {label:'MM', min:0, max:15, value:m},
        {label:'SS', min:0, max:59, value:s},
      ],
      onOK(vals){
        const [M,S] = vals;
        if (racePaceMM) racePaceMM.value = String(M);
        if (racePaceSS) racePaceSS.value = String(S);
        // 자동 동기화 & 보드 갱신
        syncTimeFromPace();
        renderRaceBoard(true);
      }
    });
  };

  // 입력 포커스/클릭 시 휠피커 오픈
  [raceHH,raceMM,raceSS].forEach(inp=>{
    inp?.addEventListener('focus', (e)=>{ e.preventDefault(); openTime(); });
    inp?.addEventListener('click', (e)=>{ e.preventDefault(); openTime(); });
  });
  [racePaceMM,racePaceSS].forEach(inp=>{
    inp?.addEventListener('focus', (e)=>{ e.preventDefault(); openPace(); });
    inp?.addEventListener('click', (e)=>{ e.preventDefault(); openPace(); });
  });
}

/* =========================
   레이스 보드 렌더링
========================= */
function getRaceSelectedName(){
  if (!raceListSel) return '대회명 미선택';
  const v=raceListSel.value;
  if (v==='__manual__'){
    const t=(raceNameInput?.value||'').trim();
    return t||'대회명 미입력';
  }
  return v||'대회명 미선택';
}
function getRaceSubtypeLabel(){
  if (raceDistManualCk?.checked){
    const vStr = (raceDistManualIn?.value || '').trim();
    const km = parseFloat(vStr);

    if (Number.isFinite(km) && km > 0){
      if (Math.abs(km - 21) < 0.6)      return 'Half Marathon';
      if (Math.abs(km - 42) < 1.2 || Math.abs(km - 42.195) < 1.2) return 'Marathon';
      const kmText = Math.abs(km - Math.round(km)) < 0.01 ? String(Math.round(km)) : String(km.toFixed(1));
      return `${kmText}K Race`;
    }
    return 'Custom';
  }

  switch (raceState.dist){
    case '5K':       return '5K Race';
    case '10K':      return '10K Race';
    case 'Half':     return 'Half Marathon';
    case 'Marathon': return 'Marathon';
    default:         return 'Race Type?';
  }
}
function isFullCourse(){
  const v = getCurrentDistKm();
  return isFinite(v) && v >= 42;
}
function renderRaceBoard(updateBadges=true){
  if (raceTitleEl)   raceTitleEl.textContent = getRaceSelectedName();
  if (raceSubtypeEl) raceSubtypeEl.textContent = getRaceSubtypeLabel();
  if (raceTimeEl)    raceTimeEl.textContent = secToRaceDisplay(computeRaceSeconds());
  if (racePaceEl)    racePaceEl.textContent = computeRacePaceText();

  if (updateBadges){
    const sec=computeRaceSeconds();
    if (badgePB)   badgePB.dataset._targetVisible = (racePB?.checked ? '1' : '0');
    if (badgeSub3) badgeSub3.dataset._targetVisible = (isFullCourse() && sec>0 && sec<3*3600) ? '1' : '0';
    if (badgeSub4) badgeSub4.dataset._targetVisible = (isFullCourse() && sec>=3*3600 && sec<4*3600) ? '1' : '0';
    if (!isAnimatingRace) applyBadgeVisibilityNow();
  }
}

/* =========================
   레이스 스케줄
========================= */
function parseLenientJSON(txt){
  if (!txt) return null;
  txt = txt.replace(/^\uFEFF/, '');
  txt = txt.replace(/\/\*[\s\S]*?\*\//g, '');
  txt = txt.replace(/(^|[^:])\/\/.*$/gm, '$1');
  txt = txt.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(txt); } catch { return null; }
}
function initRaceMonths(){
  if (!raceMonthSel) return;
  raceMonthSel.innerHTML = '';
  const now = new Date(), cur = now.getMonth()+1;
  for(let m=1;m<=12;m++){
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2,'0');
    opt.textContent = `${m}월`;
    if (m===cur) opt.selected = true;
    raceMonthSel.appendChild(opt);
  }
}
function extractMonthFromRawDate(raw){
  if (!raw) return null;
  const m = String(raw).match(/^(\d{1,2})\s*[/\\]\s*\d{1,2}/);
  if (m) return parseInt(m[1],10);
  const d = new Date(raw);
  return isNaN(d) ? null : (d.getMonth()+1);
}
function normalizeRow(row){
  const rawDate = row.date ?? row['날짜'] ?? row.DATE ?? row['DATE'] ?? '';
  const name    = row.name ?? row['대회명'] ?? row.title ?? row['TITLE'] ?? '';
  return { date: rawDate, name: String(name).trim(), month: extractMonthFromRawDate(rawDate) };
}
function toggleRaceManualField(){
  if (!raceListSel || !raceNameInput) return;
  raceNameInput.style.display = (raceListSel.value==='__manual__') ? 'block':'none';
  renderRaceBoard(true);
}
function populateRaceOptions(){
  if (!raceListSel) return;
  const month = parseInt(raceMonthSel?.value || '1', 10);
  raceListSel.innerHTML = '';

  const filtered = (raceState.races||[]).filter(r => r.month === month);

  filtered.forEach(r=>{
    const o=document.createElement('option');
    o.value=r.name; o.textContent=r.name;
    raceListSel.appendChild(o);
  });

  const manual = document.createElement('option');
  manual.value='__manual__'; manual.textContent='직접입력…';
  raceListSel.appendChild(manual);

  if (filtered.length>0) raceListSel.selectedIndex = 0;
  else                   raceListSel.value = '__manual__';

  toggleRaceManualField();
  renderRaceBoard(true);
}
function loadInlineScheduleJSON(){
  const script = document.getElementById('race-schedule');
  if (!script) return false;
  const arr = parseLenientJSON((script.textContent || '').trim());
  if (!Array.isArray(arr)) return false;
  raceState.races = arr.map(normalizeRow).filter(r=>r.name);
  populateRaceOptions();
  return true;
}
async function loadRaceScheduleJSON(){
  if (loadInlineScheduleJSON()) return;

  const urls = ['./schedule.json','./data/schedule.json','./schedule.jsaon'];
  for (const u of urls){
    try{
      const res = await fetch(u, {cache:'no-cache'});
      if (!res.ok) continue;
      const text = await res.text();
      const data = parseLenientJSON(text);
      if (Array.isArray(data)){
        raceState.races = data.map(normalizeRow).filter(r=>r.name);
        populateRaceOptions();
        return;
      }
    }catch{/* try next */}
  }
  raceState.races = [];
  populateRaceOptions();
}

/* =========================
   이벤트 바인딩
========================= */
// 폰트/배경/모드/레이아웃
function updateActiveUI(){
  updateActive(modeRow,  modeRow?.querySelector(`button[data-mode="${cssEsc(recordType)}"]`));
  updateActive(layoutRow,layoutRow?.querySelector(`button[data-layout="${cssEsc(layoutType)}"]`));
}
function setBackground(color){
  const htmlEl = document.documentElement, bodyEl = document.body;
  if(color==='black'){ htmlEl.classList.replace('bg-white','bg-black'); bodyEl.classList.replace('bg-white','bg-black'); }
  else { htmlEl.classList.replace('bg-black','bg-white'); bodyEl.classList.replace('bg-black','bg-white'); }
  updateActive(bgRow, bgRow?.querySelector(`button[data-bg="${cssEsc(color)}"]`));
  updateActive(raceBgRow, raceBgRow?.querySelector(`button[data-bg="${cssEsc(color)}"]`));
  raceState.bg = color;
}
function setRecordType(mode){
  recordType = mode;
  document.body.classList.toggle('mode-daily', mode==='daily');
  document.body.classList.toggle('mode-monthly', mode==='monthly');
  document.body.classList.toggle('mode-race', mode==='race');
  updateActive(modeRow, modeRow?.querySelector(`button[data-mode="${cssEsc(mode)}"]`));

  // 패널/보드 전환
  if (dmPanel)   dmPanel.style.display   = (mode==='race') ? 'none'  : 'block';
  if (racePanel) racePanel.style.display = (mode==='race') ? 'block' : 'none';
  if (dmBoard)   dmBoard.style.display   = (mode==='race') ? 'none'  : 'block';
  if (raceBoard) raceBoard.style.display = (mode==='race') ? 'block' : 'none';

  applyWideFontScope();

  if (runsWrap) runsWrap.style.display = (mode==='monthly') ? 'block' : 'none';
  renderKm(document.getElementById('km')?.textContent?.replace(/[^\d.]/g,'') || 0);
  renderStats();
  updateGridCols();
  fitKmRow();
  applyLayoutVisual();
  updateUploadLabel();

  // 폰트 테마 일괄 적용
  applyFontTheme(selectedFont, layoutType, recordType);

  if (mode==='race') {
    renderRaceBoard(true);
    tightenRaceGapsHard();
    squeezeRacePanel();
  }

  applyDmStageFontScope();
}
function setLayout(type){
  layoutType = type;
  updateActive(layoutRow, layoutRow?.querySelector(`button[data-layout="${cssEsc(type)}"]`));
  applyLayoutVisual();
}
function setDateFromInput(){
  const val = dateInput?.value; if(!val) return;
  const [y,m,d] = val.split('-').map(Number);
  selectedDate = new Date(y, m-1, d);
  renderDateDisplay(); syncDateWidth();
}
function applyLayoutVisual(){
  if (recordType === 'race') return;
  if(dateSection){
    dateSection.style.display = (layoutType==='type1' ? (recordType==='monthly'?'grid':'none') : 'grid');
  }
  if (dateDisplay){
    if (layoutType==='type2' || (layoutType==='type1' && recordType==='monthly')) dateDisplay.style.display='block';
    else dateDisplay.style.display='none';
  }
  if(dateInput && !dateInput.value){
    const t=new Date();
    dateInput.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    selectedDate=t;
  }
  renderDateDisplay();

  document.body.classList.remove('type1','type2');
  document.body.classList.add(layoutType);

  applyFontTheme(selectedFont, layoutType, recordType);

  renderStats();
  updateGridCols();
  fitKmRow();
  applyDmStageFontScope();
}

/* =========================
   폰트 선택
========================= */
function setFont(font){
  selectedFont = font;

  applyFontTheme(selectedFont, layoutType, recordType);

  const targetBtn = fontGridEl?.querySelector(`button[data-font="${cssEsc(font)}"]`);
  updateActive(fontGridEl, targetBtn);

  applyDmStageFontScope();

  ensureFontReady(font, 700, 200).then(()=>{ fitKmRow(); });
  fitKmRow();
  renderStats();

  if (recordType === 'race') { tightenRaceGapsHard(); squeezeRacePanel(); }
}

/* =========================
   Run / Focus
========================= */
window.onRun = function onRun(){
  document.body.classList.add('focus');
  document.getElementById('stage-canvas')?.scrollIntoView({behavior:'smooth', block:'start'});
  if (recordType==='race'){ prepBadgesForFade(); runRaceAnimation(); return; }
  runAnimation();
};
window.exitFocus = function exitFocus(){
  document.body.classList.remove('focus');
  window.scrollTo({top:0, behavior:'smooth'});
  const kmEl = document.getElementById('km');
  if (kmEl) kmEl.textContent = recordType==='monthly' ? "0.0" : "0.00";
};

/* =========================
   OCR (DM 전용)
========================= */
async function runOcrPipeline(imgDataURL){
  const OCR = await import('./ocr.js');
  return OCR.extractAll(imgDataURL, { recordType });
}
fileInputEl?.addEventListener("change", async (e)=>{
  if (recordType==='race'){ fileInputEl.value=''; return; }
  const file = e.target.files[0]; if(!file) return;
  const status = document.getElementById("upload-status");
  if (status) status.textContent = "Processing…";
  fileInputEl.disabled = true;

  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const img = reader.result;
      const o = await runOcrPipeline(img);

      let km = isFiniteNum(+o.km) ? +o.km : null;
      let paceMin = isFiniteNum(+o.paceMin) ? +o.paceMin : null;
      let paceSec = isFiniteNum(+o.paceSec) ? +o.paceSec : null;

      let timeSec = NaN;
      if (isFiniteNum(o.timeH) || isFiniteNum(o.timeM) || isFiniteNum(o.timeS)) {
        const h = o.timeH||0, m=o.timeM||0, s=o.timeS||0; timeSec = h*3600 + m*60 + s;
      } else if (o.timeRaw) { timeSec = parseTimeToSecFlexible(o.timeRaw); }

      const hasPace = isFiniteNum(paceMin) && isFiniteNum(paceSec) && (paceMin + paceSec) > 0;
      if (!hasPace && isFinite(timeSec) && timeSec>0 && isFinite(km) && km>0) {
        const p = Math.max(0, Math.round(timeSec / km)); paceMin = Math.floor(p/60); paceSec = p%60;
      }
      if ((!isFinite(km) || km<=0) && isFinite(timeSec) && timeSec>0 && hasPace) {
        const psec = paceMin*60 + paceSec; if (psec > 0) km = +(timeSec / psec).toFixed(recordType==='monthly' ? 1 : 2);
      }

      parsedData = {
        km: km ?? 0,
        runs: (recordType==='monthly') ? (o.runs ?? null) : null,
        paceMin: paceMin ?? null,
        paceSec: paceSec ?? null,
        timeH: o.timeH ?? null,
        timeM: o.timeM ?? null,
        timeS: o.timeS ?? null,
        timeRaw: o.timeRaw ?? null,
      };

      renderKm(0);
      renderStats();
      if (status) status.textContent = "Done";
    } catch (err) {
      console.error('[OCR ERROR]', err && err.stack ? err.stack : err);
      if (status) status.textContent = "Upload failed";
    } finally {
      fileInputEl.value = '';
      fileInputEl.disabled = false;
    }
  };
  reader.readAsDataURL(file);
});

/* =========================
   초기화
========================= */
function updateUploadLabel(){
  if(!uploadLabelText) return;
  uploadLabelText.textContent =
    recordType === 'monthly'
      ? 'Upload your mileage for THIS MONTH'
      : 'Upload your NRC record for TODAY';
}

// 최상단 타이틀을 Anta 폰트로 고정 (header h1 포함)
function setFixedTitleFont(){
  const title = document.querySelector('header h1, #app-title, #page-title, .app-title, .top-title, h1.title');
  if (title){
    title.style.fontFamily = '"Anta", sans-serif';
    title.style.fontWeight = '700';
    title.style.fontSynthesis = 'none';
  }
}

window.onload = ()=>{
  // 기본 모드/레이아웃/배경/폰트
  setRecordType('daily');
  setLayout('type1');
  setBackground('white');
  setFont('Helvetica Neue'); // 내부에서 applyFontTheme 호출

  syncPillLikeToPillBtn();

  const t=new Date();
  if (dateInput) dateInput.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  selectedDate = t;

  // Race 초기화
  initRaceMonths();
  populateRaceOptions();
  loadRaceScheduleJSON();

  scaleStageCanvas();
  applyLayoutVisual();

  renderKm(0);

  fitKmRow();
  renderStats();
  updateUploadLabel();

  applyDmStageFontScope();
  tightenRaceGapsHard();
  squeezeRacePanel();
  setFixedTitleFont();

  // 모바일 휠피커 활성화
  enableMobileWheelPickers();
};

/* ====== 입력 이벤트: 자동계산 & 즉시 렌더 ====== */
// 기존 단일 리스너를 대체 (Time/ Pace 변경 시 동기화)
[raceHH,raceMM,raceSS].forEach(inp=>inp?.addEventListener('input', ()=>{
  syncPaceFromTime();
  renderRaceBoard(true);
}));
[racePaceMM,racePaceSS].forEach(inp=>inp?.addEventListener('input', ()=>{
  syncTimeFromPace();
  renderRaceBoard(true);
}));

/* 탭/버튼 이벤트 */
fontGridEl?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-font]'); if(btn) setFont(btn.dataset.font); });
bgRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-bg]'); if(btn) setBackground(btn.dataset.bg); });
modeRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-mode]'); if(btn) setRecordType(btn.dataset.mode); });
layoutRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-layout]'); if(btn) setLayout(btn.dataset.layout); });
dateInput?.addEventListener('change', setDateFromInput);

// 레이스 입력 변화 즉시 반영
raceMonthSel?.addEventListener('change', ()=>{ populateRaceOptions(); });
raceListSel?.addEventListener('change', toggleRaceManualField);
raceNameInput?.addEventListener('input', ()=> renderRaceBoard(true));

raceDistGrid?.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-dist]'); if(!btn) return;
  [...raceDistGrid.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  btn.classList.add('is-active'); raceState.dist = btn.dataset.dist;
  if (raceDistManualCk){ raceDistManualCk.checked=false; raceDistManualIn.style.display='none'; }
  syncPaceFromTime(); // 거리 바뀌면 페이스/타임 재계산
  syncTimeFromPace();
  renderRaceBoard(true);
});
raceDistManualCk?.addEventListener('change', (e)=>{
  const on=e.target.checked; if (raceDistManualIn) raceDistManualIn.style.display=on?'block':'none';
  if (on){ raceState.dist=null; [...(raceDistGrid?.querySelectorAll('button')||[])].forEach(b=>b.classList.remove('is-active')); }
  syncPaceFromTime();
  syncTimeFromPace();
  renderRaceBoard(true);
});
raceDistManualIn?.addEventListener('input', ()=>{ syncPaceFromTime(); syncTimeFromPace(); renderRaceBoard(true); });

raceBgRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-bg]'); if(btn) setBackground(btn.dataset.bg); });
racePB?.addEventListener('change', ()=>{ if (racePBMsg) racePBMsg.style.display = racePB.checked ? 'inline' : 'none'; renderRaceBoard(true); });

window.addEventListener('resize', ()=>{ syncPillLikeToPillBtn(); scaleStageCanvas(); fitKmRow(); });
window.addEventListener('orientationchange', ()=> { setTimeout(()=>{ syncPillLikeToPillBtn(); scaleStageCanvas(); fitKmRow(); }, 50); });
