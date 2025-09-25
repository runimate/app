// ui.js — Daily/Monthly/Race 완전 통합판
// - 레이스: 월/대회 드롭다운 1:2 배치, '직접입력…' 맨 아래, 선택 즉시 프리뷰 반영
// - 레이스: Time > Pace 순서, PB 체크 즉시 배지 표시, SUB3/SUB4 자동 표시(풀코스만)
// - 폰트: Daily/Monthly는 지정 폰트를 앱 전반에(옵션) 적용, Race에선 상단 UI 고정
// - 크기 조정 포인트: CSS 변수 --race-time-size 등(필요시 fonts.js로 폰트별 튜닝)

import { fontSettings, kmFontScale, applyFontIndents, applyFontStatsOffset } from './fonts.js';

/* =========================
   상태
========================= */
let parsedData = { km:null, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };
let recordType = 'daily';
let layoutType = 'type1';
let selectedFont = 'Helvetica Neue';
let selectedDate = new Date();

const raceState = { races: [], dist: null, bg: 'white' };

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
const raceTitleEl   = document.getElementById('race-title');
const raceSubtypeEl = document.getElementById('race-subtype');
const raceTimeEl    = document.getElementById('race-time');
const racePaceEl    = document.getElementById('race-pace');
const badgePB       = document.getElementById('badge-pb');
const badgeSub3     = document.getElementById('badge-sub3');
const badgeSub4     = document.getElementById('badge-sub4');

// 상수
const MONTH_ABBR = ["JAN.","FEB.","MAR.","APR.","MAY.","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];

/* =========================
   유틸
========================= */
const zero2txt = (n)=>String(n).padStart(2,'0');
const cssEsc = (s)=> (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(s) : String(s).replace(/"/g,'\\"');
const isFiniteNum = (x)=>Number.isFinite(x);

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

/* =========================
   폰트/배경/모드/레이아웃
========================= */
function updateActive(groupEl, targetBtn){
  if(!groupEl) return;
  [...groupEl.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  if(targetBtn) targetBtn.classList.add('is-active');
}

/* 레이스 모드에서는 상단 UI 폰트를 바꾸지 않도록 제어 */
const WIDE_ALLOW = new Set([
  "Helvetica Neue","Anton","Big Shoulders Inline Text","Tourney","Anta","Arvo","Iceberg","Permanent Marker"
]);
function applyWideFontScope(){
  if (recordType === 'race') {
    document.body.classList.remove('wide-font'); // 레이스: 전역 강제 적용 OFF
    return;
  }
  if (WIDE_ALLOW.has(selectedFont)) {
    document.body.classList.add('wide-font');    // 데일리/먼슬리: 전역 적용
    document.documentElement.style.setProperty('--wideFontFamily', `"${selectedFont}", sans-serif`);
  } else {
    document.body.classList.remove('wide-font');
  }
}

/* 거리(큰 숫자) & 레이스 타임에 선택 폰트 적용 */
function setFont(font){
  selectedFont = font;

  // Daily/Monthly: km 숫자
  const kmEl = document.getElementById("km");
  const fs = fontSettings[font] || {};
  if (kmEl) {
    kmEl.style.fontFamily = `"${font}", sans-serif`;
    kmEl.style.fontSize   = ((fs.base ?? 200)) + "px";
    kmEl.style.fontWeight = (fs.weight ?? 700);
    kmEl.style.transform  = fs.translate ? `translate(${fs.translate})` : "translate(0,0)";
    kmEl.style.fontSynthesis = 'none';
  }

  // Race: 시간에 선택 폰트 적용 + 폰트별 튜닝 변수 반영
if (raceTimeEl){
  raceTimeEl.style.fontFamily = `"${font}", sans-serif`;
  const root = document.documentElement.style;
  if (fs.raceTimeSize)        root.setProperty('--race-time-size', fs.raceTimeSize);
  if (fs.raceTitleSize)       root.setProperty('--race-title-size', fs.raceTitleSize);
  if (fs.raceSubtypeSize)     root.setProperty('--race-subtype-size', fs.raceSubtypeSize);
  if (fs.racePaceSize)        root.setProperty('--race-pace-size', fs.racePaceSize);
  if (fs.raceTimeTranslate)   root.setProperty('--race-time-translate', fs.raceTimeTranslate);
  if (fs.raceTimeLetterSpace) root.setProperty('--race-time-letter', fs.raceTimeLetterSpace);

  // ★ 추가: 레이스 섹션 간 세로 간격(종목↔시간, 시간↔Pace, Pace 라벨 위) 변수 주입
  if (fs.raceGapSubtypeB) root.setProperty('--race-gap-subtype-b', fs.raceGapSubtypeB);
  if (fs.raceGapTimeB)    root.setProperty('--race-gap-time-b',    fs.raceGapTimeB);
  if (fs.raceGapPaceT)    root.setProperty('--race-gap-pace-t',    fs.raceGapPaceT);

  // (선택) Pace 라벨 글자 크기를 폰트별로 달리 쓰고 싶으면 이 줄도 사용
  if (fs.racePaceLabelSize) root.setProperty('--race-pace-label-size', fs.racePaceLabelSize);
}

  // 날짜(일부 폰트만)
  const dateDisp = document.getElementById("date-display");
  const whitelist = new Set(["Helvetica Neue","Anton","Anta","Arvo","Iceberg"]);
  if (dateDisp) {
    if (whitelist.has(font)) {
      dateDisp.style.fontFamily = `"${font}", sans-serif`;
      dateDisp.style.fontWeight = (fs.dateWeight ?? 700);
      dateDisp.style.fontSynthesis = 'none';
    } else {
      dateDisp.style.fontFamily = "";
      dateDisp.style.fontWeight = 700;
    }
  }

  // 전역 적용 스코프(레이스 모드에서는 끔)
  applyWideFontScope();

  // 날짜 관련 변수 유지
  const root = document.documentElement.style;
  const dSize = fs.dateSize || "50px";
  const dGap  = fs.dateGap  || "10px";
  const dTrans= fs.dateTranslate || "0px,0px";
  root.setProperty("--d2-dateSize", dSize);
  root.setProperty("--d2-dateGap", dGap);
  root.setProperty("--d2-dateTranslate", dTrans);
  root.setProperty("--m1-dateSize", dSize);
  root.setProperty("--m1-dateGap", dGap);
  root.setProperty("--m1-dateTranslate", dTrans);
  root.setProperty("--m2-dateSize", dSize);
  root.setProperty("--m2-dateGap", dGap);
  root.setProperty("--m2-dateTranslate", dTrans);

  if (fs.kmWordGap) document.documentElement.style.setProperty('--kmWordGap', fs.kmWordGap);

  const targetBtn = fontGridEl?.querySelector(`button[data-font="${cssEsc(font)}"]`);
  updateActive(fontGridEl, targetBtn);

  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);

  ensureFontReady(font, fs.weight ?? 700, fs.base ?? 200).then(()=>{ fitKmRow(); });
  fitKmRow();
  renderStats();
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

  // 레이스 모드에서는 전역 폰트 강제 적용 OFF
  applyWideFontScope();

  if (runsWrap) runsWrap.style.display = (mode==='monthly') ? 'block' : 'none';
  renderKm(document.getElementById('km')?.textContent?.replace(/[^\d.]/g,'') || 0);
  renderStats();
  updateGridCols();
  fitKmRow();
  applyLayoutVisual();
  applyFontStatsOffset(selectedFont, layoutType, recordType);
  updateUploadLabel();

  if (mode==='race') renderRaceBoard(true);
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

function renderDateDisplay(){
  if (dateDisplay) dateDisplay.textContent = formatDateText(selectedDate);
}

function applyLayoutVisual(){
  if (recordType === 'race') return; // 레이스는 별도 보드
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

  setFont(selectedFont);
  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);

  renderStats();
  updateGridCols();
  fitKmRow();
}

function setTypeStatsStyle(type, { size, labelSize, gap, pull, pull2 } = {}){
  const root = document.documentElement.style;
  if(type==='type1'){
    if (size)      root.setProperty('--t1-statSize', size);
    if (labelSize) root.setProperty('--t1-labelSize', labelSize);
    if (gap!=null) root.setProperty('--t1-statGap', gap);
    if (pull!=null)root.setProperty('--t1-statPull', pull);
    if (pull2!=null)root.setProperty('--t1-statPull2', pull2);
  }else{
    if (size)      root.setProperty('--t2-statSize', size);
    if (labelSize) root.setProperty('--t2-labelSize', labelSize);
    if (gap!=null) root.setProperty('--t2-statGap', gap);
    if (pull!=null) root.setProperty('--t2-statPull', pull);
    if (pull2!=null)root.setProperty('--t2-statPull2', pull2);
  }
  renderStats();
}
function setTypeKmWordStyle(type, { size, gap } = {}){
  const root = document.documentElement.style;
  if(type==='type1'){ if (size) root.setProperty('--t1-kmWordSize', size); if (gap) root.setProperty('--t1-kmWordGap', gap); }
  else              { if (size) root.setProperty('--t2-kmWordSize', size); if (gap) root.setProperty('--t2-kmWordGap', gap); }
}
function setTypeKmScale(type, scale){
  const root = document.documentElement.style;
  root.setProperty(type==='type1'?'--t1-kmScale':'--t2-kmScale', String(scale));
  fitKmRow();
}
function setModeStyle(mode, { kmScale, statGap, kmWordBottomGap } = {}){
  const root = document.documentElement.style;
  if(mode==='daily'){
    if (kmScale!=null) root.setProperty('--d-kmScale', String(kmScale));
    if (statGap!=null) root.setProperty('--d-statGap', String(statGap));
    if (kmWordBottomGap!=null) root.setProperty('--d-kmWordBottomGap', String(kmWordBottomGap));
  }else{
    if (kmScale!=null) root.setProperty('--m-kmScale', String(kmScale));
    if (statGap!=null) root.setProperty('--m-statGap', String(statGap));
    if (kmWordBottomGap!=null) root.setProperty('--m-kmWordBottomGap', String(kmWordBottomGap));
  }
  fitKmRow();
}

/* =========================
   RACE — schedule & board
========================= */
function parseLenientJSON(txt){
  if (!txt) return null;
  txt = txt.replace(/^\uFEFF/, '');               // BOM
  txt = txt.replace(/\/\*[\s\S]*?\*\//g, '');     // /* ... */
  txt = txt.replace(/(^|[^:])\/\/.*$/gm, '$1');   // // ...
  txt = txt.replace(/,\s*([}\]])/g, '$1');        // trailing comma
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
  const m = String(raw).match(/^(\d{1,2})\s*[/\\]\s*\d{1,2}/); // 9/21(일) or 9\/21(일)
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

  // 항상 맨 아래에 '직접입력…'
  const manual = document.createElement('option');
  manual.value='__manual__'; manual.textContent='직접입력…';
  raceListSel.appendChild(manual);

  // 기본 선택: 있으면 첫 대회, 없으면 직접입력
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
  // 우선 내장 JSON
  if (loadInlineScheduleJSON()) return;

  // 파일 fetch (철자 오타 포함 다 시도)
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
  // 실패해도 UI는 동작(직접입력)
  raceState.races = [];
  populateRaceOptions();
}

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
  // 수동 입력이 켜져 있으면 입력값을 기준으로 라벨 생성
  if (raceDistManualCk?.checked){
    const vStr = (raceDistManualIn?.value || '').trim();
    const km = parseFloat(vStr);

    if (Number.isFinite(km) && km > 0){
      // 관용 라벨 보정
      if (Math.abs(km - 21) < 0.6)      return 'Half Marathon';
      if (Math.abs(km - 42) < 1.2 || Math.abs(km - 42.195) < 1.2) return 'Marathon';

      // 5/10 처럼 딱 떨어지면 정수, 아니면 소수 한 자리
      const kmText = Math.abs(km - Math.round(km)) < 0.01 ? String(Math.round(km)) : String(km.toFixed(1));
      return `${kmText}K Race`;
    }
    return 'Custom';
  }

  // 버튼 선택 시 라벨
  switch (raceState.dist){
    case '5K':       return '5K Race';
    case '10K':      return '10K Race';
    case 'Half':     return 'Half Marathon';
    case 'Marathon': return 'Marathon';
    default:         return '종목';
  }
}
function isFullCourse(){
  if (raceState.dist === 'Marathon') return true;
  if (raceDistManualCk?.checked){
    const v = parseFloat(raceDistManualIn?.value||'0');
    return isFinite(v) && v >= 42;
  }
  return false;
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

  let distKm = null;
  if (raceState.dist==='5K') distKm = 5;
  else if (raceState.dist==='10K') distKm = 10;
  else if (raceState.dist==='Half') distKm = 21.0975;
  else if (raceState.dist==='Marathon') distKm = 42.195;
  else if (raceDistManualCk?.checked){
    const v = parseFloat(raceDistManualIn?.value||'0');
    if (isFinite(v) && v>0) distKm = v;
  }
  const sec = computeRaceSeconds();
  if (!distKm || sec<=0) return `0:00 /km`;
  const p = Math.round(sec / distKm);
  return `${Math.floor(p/60)}:${zero2txt(p%60)} /km`;
}
function renderRaceBoard(updateBadges=true){
  if (raceTitleEl)   raceTitleEl.textContent = getRaceSelectedName();
  if (raceSubtypeEl) raceSubtypeEl.textContent = getRaceSubtypeLabel();
  if (raceTimeEl)    raceTimeEl.textContent = secToRaceDisplay(computeRaceSeconds());
  if (racePaceEl)    racePaceEl.textContent = computeRacePaceText();

  if (updateBadges){
    const sec=computeRaceSeconds();
    if (badgePB)   badgePB.style.display   = racePB?.checked ? 'inline' : 'none';
    if (badgeSub3) badgeSub3.style.display = (isFullCourse() && sec>0 && sec<3*3600) ? 'inline' : 'none';
    if (badgeSub4) badgeSub4.style.display = (isFullCourse() && sec>=3*3600 && sec<4*3600) ? 'inline' : 'none';
  }
}
async function runRaceAnimation(){
  renderRaceBoard(false);
  await animateRaceTime('race-time', computeRaceSeconds(), 2400);
  renderRaceBoard(true);
}

/* =========================
   이벤트 바인딩
========================= */
// 공통
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
  renderRaceBoard(true);
});
raceDistManualCk?.addEventListener('change', (e)=>{
  const on=e.target.checked; if (raceDistManualIn) raceDistManualIn.style.display=on?'block':'none';
  if (on){ raceState.dist=null; [...(raceDistGrid?.querySelectorAll('button')||[])].forEach(b=>b.classList.remove('is-active')); }
  renderRaceBoard(true);
});
raceDistManualIn?.addEventListener('input', ()=> renderRaceBoard(true));

[raceHH,raceMM,raceSS,racePaceMM,racePaceSS].forEach(inp=>inp?.addEventListener('input', ()=> renderRaceBoard(true)));
raceBgRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-bg]'); if(btn) setBackground(btn.dataset.bg); });
racePB?.addEventListener('change', ()=>{ if (racePBMsg) racePBMsg.style.display = racePB.checked ? 'inline' : 'none'; renderRaceBoard(true); });

/* =========================
   Run / Focus
========================= */
window.onRun = function onRun(){
  document.body.classList.add('focus');
  document.getElementById('stage-canvas')?.scrollIntoView({behavior:'smooth', block:'start'});
  if (recordType==='race'){ runRaceAnimation(); return; }
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

window.onload = ()=>{
  // 기본 모드/레이아웃/배경/폰트
  setRecordType('daily');
  setLayout('type1');
  setBackground('white');
  setFont('Helvetica Neue');

  // 레이스 시간 기본 크기 (반으로 축소 느낌)
  document.documentElement.style.setProperty('--race-time-size','88px');

  syncPillLikeToPillBtn();

  setTypeStatsStyle('type1', { size:'40px', labelSize:'18px', gap:'24px', pull:'0px' });
  setTypeKmWordStyle('type1', { size:'36px', gap:'16px' });
  setTypeKmScale('type1', 1.00);

  setTypeStatsStyle('type2', { size:'40px', labelSize:'20px', gap:'16px', pull:'50px', pull2:'40px' });
  setTypeKmWordStyle('type2', { size:'36px', gap:'16px' });
  setTypeKmScale('type2', 1.00);

  setModeStyle('daily',   { kmScale:1.0 });
  setModeStyle('monthly', { kmScale:1.0 });

  const t=new Date();
  if (dateInput) dateInput.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  selectedDate = t;

  // Race 초기화
  initRaceMonths();
  populateRaceOptions();   // 스케줄 로드 전에도 '직접입력'이 보이도록
  loadRaceScheduleJSON();  // 내장/외부 JSON 로드 시 목록 갱신

  scaleStageCanvas();
  applyLayoutVisual();

  renderKm(0);
  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);

  fitKmRow();
  renderStats();
  updateUploadLabel();
};

window.addEventListener('resize', ()=>{ syncPillLikeToPillBtn(); scaleStageCanvas(); fitKmRow(); });
window.addEventListener('orientationchange', ()=> { setTimeout(()=>{ syncPillLikeToPillBtn(); scaleStageCanvas(); fitKmRow(); }, 50); });
