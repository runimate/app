// ui.js — daily/monthly + race (direct input) unified controller
// 화면/이벤트/애니메이션 컨트롤러
import { fontSettings, kmFontScale, applyFontIndents, applyFontStatsOffset } from './fonts.js';

/* =========================
   상태
========================= */
let parsedData = { km:null, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };
let recordType = 'daily';   // 'daily' | 'monthly' | 'race'
let layoutType = 'type1';
let selectedFont = 'Helvetica Neue';
let selectedDate = new Date();

// race 전용 상태
const raceState = {
  races: [],              // [{date:'YYYY-MM-DD', name:'...'}]
  dist: null,             // '5K'|'10K'|'Half'|'Marathon'|null
  bg: 'white'
};

/* =========================
   DOM (공용)
========================= */
const fontGridEl  = document.getElementById('font-grid');
const bgRow       = document.getElementById('bg-row');          // daily/monthly용
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

// 보드/패널 스위칭
const dmPanel   = document.getElementById('dm-panel');
const racePanel = document.getElementById('race-panel');
const dmBoard   = document.getElementById('dm-board');
const raceBoard = document.getElementById('race-board');

const stageCanvas = document.getElementById('stage-canvas');
const stageRoot   = document.getElementById('stage');

const MONTH_ABBR = ["JAN.","FEB.","MAR.","APR.","MAY.","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];

/* =========================
   DOM (race 전용 컨트롤)
========================= */
const raceMonthSel     = document.getElementById('race-month');
const raceListSel      = document.getElementById('race-list');
const raceNameInput    = document.getElementById('race-name-input');
const raceUploadBtn    = document.getElementById('race-upload');
const raceFileInput    = document.getElementById('race-file');
const raceClearBtn     = document.getElementById('race-clear');

const raceDistRow      = document.getElementById('race-dist-row');
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

// race 출력 요소
const raceTitleEl   = document.getElementById('race-title');
const raceSubtypeEl = document.getElementById('race-subtype');
const raceTimeEl    = document.getElementById('race-time');
const racePaceEl    = document.getElementById('race-pace');
const badgePB       = document.getElementById('badge-pb');
const badgeSub3     = document.getElementById('badge-sub3');
const badgeSub4     = document.getElementById('badge-sub4');

/* =========================
   유틸
========================= */
const zero2txt = (n)=>String(n).padStart(2,'0');

// CSS.escape 폴백 (iOS 사파리 구버전 등)
const cssEsc = (s)=> (window.CSS && typeof CSS.escape === 'function')
  ? CSS.escape(s)
  : String(s).replace(/"/g,'\\"');

function ensureFontReady(fontFamily, weight = 700, sizePx = 200, style='normal'){
  if (!('fonts' in document) || typeof document.fonts.load !== 'function') return Promise.resolve();
  const fam = `"${fontFamily}"`;
  return document.fonts.load(`${style} ${weight} ${sizePx}px ${fam}`).catch(()=>{});
}

function parseTimeToSecFlexible(raw){
  if(!raw) return NaN;
  const t = String(raw).trim()
    .replace(/[’'′]/g,':')
    .replace(/[″"]/g,':')
    .replace(/：/g,':');
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
const isFiniteNum = (x)=>Number.isFinite(x);

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
   숫자 표기
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
      if(!el) return;
      el.style.gridColumn = '';
      el.style.transform = '';
      el.style.marginLeft = '';
    });
    return;
  }
  if (recordType === 'daily'){
    if (paceWrap) {
      paceWrap.style.gridColumn = '1 / 2';
      paceWrap.style.transform = 'translateX(0)';
      paceWrap.style.marginLeft = '0';
    }
    if (timeWrap) {
      timeWrap.style.gridColumn = '2 / 3';
      timeWrap.style.transform = `translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`;
      timeWrap.style.marginLeft = '0';
    }
  } else if (recordType==='monthly') {
    if (runsWrap) {
      runsWrap.style.gridColumn = '1 / 2';
      runsWrap.style.transform = 'translateX(0)';
      runsWrap.style.marginLeft = '0';
    }
    if (paceWrap) {
      paceWrap.style.gridColumn = '2 / 3';
      paceWrap.style.transform = `translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`;
      paceWrap.style.marginLeft = '0';
    }
    if (timeWrap) {
      timeWrap.style.gridColumn = '3 / 4';
      timeWrap.style.transform = `translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull2').trim()})`;
      timeWrap.style.marginLeft = '0';
    }
  }
}

/* =========================
   표기 포맷(DM)
========================= */
function formatPaceByType(){
  const hasValidOcrPace =
    parsedData.paceMin!=null && parsedData.paceSec!=null &&
    (parsedData.paceMin + parsedData.paceSec) > 0;

  let mm, ss;
  if (hasValidOcrPace){
    mm = String(parsedData.paceMin);
    ss = zero2txt(parsedData.paceSec);
  } else {
    const tsec = getTimeSecFromParsed(parsedData);
    const km = parseFloat(parsedData.km);
    if (isFinite(tsec) && tsec>0 && isFinite(km) && km>0){
      const psec = Math.max(0, Math.round(tsec / km));
      mm = String(Math.floor(psec/60));
      ss = zero2txt(psec%60);
    } else {
      return (layoutType==='type1') ? '--:-- /km' : '--:--';
    }
  }
  return (layoutType==='type1') ? `${mm}:${ss} /km` : `${mm}:${ss}`;
}

function formatTimeByType(){
  if(layoutType==='type2') return parsedData.timeRaw ? parsedData.timeRaw : '00:00';
  const H = parsedData.timeH ?? 0, M = parsedData.timeM ?? 0, S = parsedData.timeS ?? 0;
  if (H > 0) return `${H}h ${zero2txt(M)}m ${zero2txt(S)}s`;
  return `${String(M)}m ${zero2txt(S)}s`;
}

function alignStatsBaseline(){
  if(layoutType !== 'type2') return;
  const stats = [];
  const addIfVisible = (id)=>{
    const wrap = document.getElementById(id+'-wrap');
    if(wrap && getComputedStyle(wrap).display!=='none'){
      stats.push(document.getElementById(id));
    }
  };
  addIfVisible('runs'); addIfVisible('pace'); addIfVisible('time');
  stats.forEach(el=>{ if(el) el.style.transform = ''; });
  const bottoms = stats.map(el=>el.getBoundingClientRect().bottom);
  const maxBottom = Math.max(...bottoms);
  stats.forEach((el,i)=>{
    const dy = Math.round(maxBottom - bottoms[i]);
    if (dy) el.style.transform = `translateY(${dy}px)`;
  });
}
function renderStats(){
  if (recordType==='race') return; // race 모드에선 DM 통계 비표시
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
  alignStatsBaseline();
}
function updateUploadLabel(){
  if(!uploadLabelText) return;
  uploadLabelText.textContent =
    recordType === 'monthly'
      ? 'Upload your mileage for THIS MONTH'
      : (recordType === 'race'
         ? 'Race mode: no upload — enter your record'
         : 'Upload your NRC record for TODAY');
}

/* =========================
   캔버스 스케일/애니 (DM)
========================= */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
function animateNumber(id,start,end,duration){
  return new Promise(resolve=>{
    const kmEl = document.getElementById(id);
    let startTime;
    function update(now){
      if(!startTime) startTime = now;
      const raw = Math.min((now - startTime)/duration,1);
      const eased = easeOutCubic(raw);
      const val = (start + (end-start)*eased);
      if (kmEl) kmEl.textContent = formatKm(val);
      raw < 1 ? requestAnimationFrame(update) : resolve();
    }
    requestAnimationFrame(update);
  });
}
function scaleStageCanvas(){
  if(!stageCanvas) return;
  const vw = window.innerWidth;
  const logicalWidth = (vw < 430) ? 540 : 720;
  const scale = Math.min(vw / logicalWidth, 1);
  stageCanvas.style.transform = `scale(${scale})`;
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
async function runAnimation(){
  // race 모드에서는 km 애니메이션 없음
  if (recordType==='race') return;
  fitKmRow();
  await new Promise(r=>setTimeout(r, 500));
  const endVal = parseFloat(parsedData.km || 0);
  await animateNumber("km", 0, isNaN(endVal)?0:endVal, 2200);
  fitKmRow();
}

/* =========================
   폰트/배경/모드/레이아웃
========================= */
function updateActive(groupEl, targetBtn){
  if(!groupEl) return;
  [...groupEl.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  if(targetBtn && targetBtn.classList) targetBtn.classList.add('is-active');
}
function setFont(font){
  selectedFont = font;

  // 스테이지 전체에 폰트 적용 (Race 포함)
  if (stageRoot) {
    stageRoot.style.fontFamily = `"${font}", sans-serif`;
    stageRoot.style.fontSynthesis = 'none';
  }

  // DM 전용 숫자/날짜 규격
  const km       = document.getElementById("km");
  const dateDisp = document.getElementById("date-display");
  const fs = fontSettings[font] || {};

  if (km) {
    km.style.fontFamily = `"${font}", sans-serif`;
    km.style.fontSize   = ((fs.base ?? 200)) + "px";
    km.style.fontWeight = (fs.weight ?? 700);
    km.style.transform  = fs.translate ? `translate(${fs.translate})` : "translate(0,0)";
    km.style.fontSynthesis = 'none';
  }

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
  renderDateDisplay();
}
function setBackground(color){
  const htmlEl = document.documentElement, bodyEl = document.body;
  if(color==='black'){ htmlEl.classList.replace('bg-white','bg-black'); bodyEl.classList.replace('bg-white','bg-black'); }
  else { htmlEl.classList.replace('bg-black','bg-white'); bodyEl.classList.replace('bg-black','bg-white'); }
  // race/dm 모두 버튼 active 표시
  const t1 = bgRow?.querySelector(`button[data-bg="${cssEsc(color)}"]`);
  const t2 = raceBgRow?.querySelector(`button[data-bg="${cssEsc(color)}"]`);
  updateActive(bgRow, t1);
  updateActive(raceBgRow, t2);
  raceState.bg = color;
}
function setRecordType(mode){
  recordType = mode;

  document.body.classList.toggle('mode-daily',   mode==='daily');
  document.body.classList.toggle('mode-monthly', mode==='monthly');
  document.body.classList.toggle('mode-race',    mode==='race');

  updateActive(modeRow, modeRow?.querySelector(`button[data-mode="${cssEsc(mode)}"]`));

  // 패널/보드 스위칭
  if (dmPanel)   dmPanel.style.display   = (mode==='race') ? 'none'  : 'block';
  if (racePanel) racePanel.style.display = (mode==='race') ? 'block' : 'none';
  if (dmBoard)   dmBoard.style.display   = (mode==='race') ? 'none'  : 'block';
  if (raceBoard) raceBoard.style.display = (mode==='race') ? 'block' : 'none';

  if (runsWrap) runsWrap.style.display = (mode==='monthly') ? 'block' : 'none';
  if (dateSection){
    // race에서는 날짜 입력 UI 숨김
    dateSection.style.display = (mode==='race') ? 'none' : (layoutType==='type2' || (layoutType==='type1'&&mode==='monthly') ? 'grid' : 'none');
  }

  if (mode!=='race'){
    // DM 초기 렌더
    renderKm(document.getElementById('km')?.textContent?.replace(/[^\d.]/g,'') || 0);
    renderStats();
    updateGridCols();
    fitKmRow();
    applyLayoutVisual();
    applyFontStatsOffset(selectedFont, layoutType, recordType);
  }

  updateUploadLabel();
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
  if (recordType==='race') return; // race는 별도 보드

  const word = document.getElementById('km-word');

  if(dateSection){
    if(layoutType==='type1'){
      dateSection.style.display = (recordType==='monthly') ? 'grid' : 'none';
    }else{
      dateSection.style.display = 'grid';
    }
  }

  if (dateDisplay){
    if (layoutType==='type2' || (layoutType==='type1' && recordType==='monthly')) {
      dateDisplay.style.display = 'block';
    } else {
      dateDisplay.style.display = 'none';
    }
  }

  if (word) word.style.display = 'block';

  if(dateInput && !dateInput.value){
    const today = new Date();
    const yyyy = today.getFullYear(), mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    selectedDate = today;
  }
  renderDateDisplay();

  document.body.classList.remove('type1','type2');
  document.body.classList.add(layoutType);

  setFont(selectedFont);
  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);

  renderStats();
  updateGridCols();
  layoutStatsGrid();
  fitKmRow();
  alignStatsBaseline();
}

/* =========================
   스타일 변수 제어(디자인 튜닝용)
========================= */
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
  if(type==='type1'){
    if (size) root.setProperty('--t1-kmWordSize', size);
    if (gap)  root.setProperty('--t1-kmWordGap', gap);
  }else{
    if (size) root.setProperty('--t2-kmWordSize', size);
    if (gap)  root.setProperty('--t2-kmWordGap', gap);
  }
}
function setTypeKmScale(type, scale){
  const root = document.documentElement.style;
  const val = String(scale);
  if(type==='type1') root.setProperty('--t1-kmScale', val);
  else               root.setProperty('--t2-kmScale', val);
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
   이벤트 바인딩 (공용)
========================= */
if (fontGridEl) fontGridEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-font]');
  if (btn) setFont(btn.dataset.font);
});
if (bgRow) bgRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-bg]');
  if (btn) setBackground(btn.dataset.bg);
});
if (modeRow) modeRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-mode]');
  if (btn) setRecordType(btn.dataset.mode);
});
if (layoutRow) layoutRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-layout]');
  if (btn) setLayout(btn.dataset.layout);
});
if (dateInput) dateInput.addEventListener('change', setDateFromInput);

/* =========================
   이벤트 바인딩 (Race)
========================= */
function initRaceMonths(){
  if (!raceMonthSel) return;
  raceMonthSel.innerHTML = '';
  const now = new Date(), cur = now.getMonth()+1;
  for(let m=1;m<=12;m++){
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2,'0');
    opt.textContent = `${m}월`;
    if (m === cur) opt.selected = true;
    raceMonthSel.appendChild(opt);
  }
}
function populateRaceOptions(){
  if (!raceListSel) return;
  const month = raceMonthSel?.value || '';
  raceListSel.innerHTML = '';

  const top = document.createElement('option');
  top.value='__manual__'; top.textContent='직접입력…';
  raceListSel.appendChild(top);

  const filtered = (raceState.races||[]).filter(r => (r.date||'').slice(5,7) === month);
  filtered.forEach(r=>{
    const o = document.createElement('option');
    o.value = r.name; o.textContent = r.name;
    raceListSel.appendChild(o);
  });

  const bottom = document.createElement('option');
  bottom.value='__manual__2'; bottom.textContent='(직접입력)';
  raceListSel.appendChild(bottom);

  toggleRaceManualField();
}
function toggleRaceManualField(){
  if (!raceListSel || !raceNameInput) return;
  const v = raceListSel.value;
  const manual = (v==='__manual__' || v==='__manual__2');
  raceNameInput.style.display = manual ? 'block' : 'none';
}

if (raceMonthSel) raceMonthSel.addEventListener('change', populateRaceOptions);
if (raceListSel)  raceListSel.addEventListener('change', toggleRaceManualField);

if (raceUploadBtn) raceUploadBtn.addEventListener('click', ()=> raceFileInput && raceFileInput.click());
if (raceClearBtn)  raceClearBtn.addEventListener('click', ()=>{ raceState.races=[]; populateRaceOptions(); });

if (raceFileInput) raceFileInput.addEventListener('change', async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  try{
    const buf = await f.arrayBuffer();
    // SheetJS 전역 사용 (index.html에서 defer로 로드됨)
    const wb = window.XLSX && window.XLSX.read ? window.XLSX.read(buf, {type:'array'}) : null;
    if (!wb) throw new Error('XLSX not loaded');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, {defval:''});
    raceState.races = rows.map(r=>({date:String(r.date||'').slice(0,10), name:String(r.name||'').trim()})).filter(r=>r.name);
    populateRaceOptions();
  } catch(err){
    console.error('[RACE XLSX ERROR]', err);
    alert('엑셀 파일을 읽지 못했습니다. (date,name 컬럼 확인)');
  } finally {
    raceFileInput.value = '';
  }
});

if (raceDistRow) raceDistRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-dist]');
  if (!btn) return;
  // active 토글
  [...raceDistRow.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  btn.classList.add('is-active');
  raceState.dist = btn.dataset.dist;
  // 기타 입력 해제
  if (raceDistManualCk){ raceDistManualCk.checked = false; }
  if (raceDistManualIn){ raceDistManualIn.style.display = 'none'; }
});
if (raceDistManualCk) raceDistManualCk.addEventListener('change', (e)=>{
  const on = e.target.checked;
  if (raceDistManualIn) raceDistManualIn.style.display = on ? 'block' : 'none';
  if (on){ raceState.dist = null; [...(raceDistRow?.querySelectorAll('button')||[])].forEach(b=>b.classList.remove('is-active')); }
});

if (raceBgRow) raceBgRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-bg]');
  if (btn) setBackground(btn.dataset.bg);
});

if (racePB && racePBMsg){
  racePB.addEventListener('change', ()=>{ racePBMsg.style.display = racePB.checked ? 'inline' : 'none'; });
}

/* =========================
   Race 출력/포맷
========================= */
function formatRaceTime(hh, mm, ss){
  const H = Math.max(0, parseInt(hh||0,10));
  const M = Math.max(0, parseInt(mm||0,10));
  const S = Math.max(0, parseInt(ss||0,10));
  if (H > 0) return `${H}:${zero2txt(M)}:${zero2txt(S)}`;
  return `${String(M)}:${zero2txt(S)}`;
}
function getRaceSubtypeLabel(){
  if (raceDistManualCk && raceDistManualCk.checked){
    const v = (raceDistManualIn?.value||'').trim();
    return v || 'Custom';
  }
  if (raceState.dist === 'Half') return 'Half Marathon';
  return raceState.dist || '종목';
}
function getRaceSelectedName(){
  const v = raceListSel?.value;
  if (!v) return '대회명 미선택';
  if (v==='__manual__' || v==='__manual__2'){
    const t = (raceNameInput?.value||'').trim();
    return t || '대회명 미입력';
  }
  return v;
}
function computeRaceSeconds(){
  const H = parseInt(raceHH?.value||0,10);
  const M = parseInt(raceMM?.value||0,10);
  const S = parseInt(raceSS?.value||0,10);
  return (H*3600 + M*60 + S);
}
function renderRaceBoard(){
  if (!raceBoard) return;

  // 제목/종목
  if (raceTitleEl)   raceTitleEl.textContent   = getRaceSelectedName();
  const subtype = getRaceSubtypeLabel();
  if (raceSubtypeEl) raceSubtypeEl.textContent = subtype;

  // 시간/페이스
  const H = raceHH?.value||0, M=raceMM?.value||0, S=raceSS?.value||0;
  const t = formatRaceTime(H,M,S);
  if (raceTimeEl) raceTimeEl.textContent = t;

  const pm = Math.max(0, parseInt(racePaceMM?.value||0,10));
  const ps = Math.max(0, parseInt(racePaceSS?.value||0,10));
  if (racePaceEl) racePaceEl.textContent = `${pm}:${zero2txt(ps)} /km`;

  // 배지
  const sec = computeRaceSeconds();
  // PB
  if (badgePB)   badgePB.style.display   = (racePB && racePB.checked) ? 'inline' : 'none';

  // SUB3 / SUB4 (마라톤 전용)
  const isFull = subtype === 'Marathon';
  if (badgeSub3) badgeSub3.style.display = (isFull && sec > 0 && sec < 3*3600) ? 'inline' : 'none';
  if (badgeSub4) badgeSub4.style.display = (isFull && sec >= 3*3600 && sec < 4*3600) ? 'inline' : 'none';
}

/* =========================
   Run / Focus
========================= */
window.onRun = function onRun(){
  document.body.classList.add('focus');
  if (stageCanvas) stageCanvas.scrollIntoView({behavior:'smooth', block:'start'});

  if (recordType==='race'){
    renderRaceBoard();
    return;
  }
  runAnimation();
};
window.exitFocus = function exitFocus(){
  document.body.classList.remove('focus');
  window.scrollTo({top:0, behavior:'smooth'});
  const kmEl = document.getElementById('km');
  if (kmEl) kmEl.textContent = recordType==='monthly' ? "0.0" : "0.00";
};

/* =========================
   OCR 파이프라인 (DM에서만 사용)
========================= */
async function runOcrPipeline(imgDataURL){
  const OCR = await import('./ocr.js');
  return OCR.extractAll(imgDataURL, { recordType });
}

/* =========================
   업로드 이벤트 — DM 전용
========================= */
if (fileInputEl) fileInputEl.addEventListener("change", async (e)=>{
  if (recordType==='race') { fileInputEl.value=''; return; } // race에선 미사용
  const file = e.target.files[0]; if(!file) return;
  const status = document.getElementById("upload-status");
  if (status) status.textContent = "Processing…";
  fileInputEl.disabled = true;

  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const img = reader.result;
      const o = await runOcrPipeline(img);

      // 원시값
      let km = isFiniteNum(+o.km) ? +o.km : null;
      let paceMin = isFiniteNum(+o.paceMin) ? +o.paceMin : null;
      let paceSec = isFiniteNum(+o.paceSec) ? +o.paceSec : null;

      // time 초
      let timeSec = NaN;
      if (isFiniteNum(o.timeH) || isFiniteNum(o.timeM) || isFiniteNum(o.timeS)) {
        const h = o.timeH||0, m=o.timeM||0, s=o.timeS||0;
        timeSec = h*3600 + m*60 + s;
      } else if (o.timeRaw) {
        timeSec = parseTimeToSecFlexible(o.timeRaw);
      }

      // pace 보정 (없거나 0:00이면)
      const hasPace = isFiniteNum(paceMin) && isFiniteNum(paceSec) && (paceMin + paceSec) > 0;
      if (!hasPace && isFinite(timeSec) && timeSec>0 && isFinite(km) && km>0) {
        const p = Math.max(0, Math.round(timeSec / km));
        paceMin = Math.floor(p/60);
        paceSec = p%60;
      }

      // km 보정 (km가 없을 때만)
      if ((!isFinite(km) || km<=0) && isFinite(timeSec) && timeSec>0 && hasPace) {
        const psec = paceMin*60 + paceSec;
        if (psec > 0) km = +(timeSec / psec).toFixed(recordType==='monthly' ? 1 : 2);
      }

      // UI 상태 업데이트
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
      fileInputEl.value = '';     // 같은 파일 다시 선택 가능
      fileInputEl.disabled = false;
    }
  };
  reader.readAsDataURL(file);
});

/* =========================
   초기화
========================= */
window.onload = ()=>{
  // 기본 모드/레이아웃/배경/폰트
  setRecordType('daily');
  setLayout('type1');
  setBackground('white');
  setFont('Helvetica Neue');

  // DM 스타일 튜닝
  setTypeStatsStyle('type1', { size:'40px', labelSize:'18px', gap:'24px', pull:'0px' });
  setTypeKmWordStyle('type1', { size:'36px', gap:'16px' });
  setTypeKmScale('type1', 1.00);

  setTypeStatsStyle('type2', { size:'40px', labelSize:'20px', gap:'16px', pull:'50px', pull2:'40px' });
  setTypeKmWordStyle('type2', { size:'36px', gap:'16px' });
  setTypeKmScale('type2', 1.00);

  setModeStyle('daily',   { kmScale:1.0 });
  setModeStyle('monthly', { kmScale:1.0 });

  // 날짜 초기값
  const t=new Date();
  const di = document.getElementById('date-input');
  if (di) di.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  selectedDate = t;

  // Race 초기 UI
  initRaceMonths();
  populateRaceOptions();

  scaleStageCanvas();
  applyLayoutVisual();

  renderKm(0);
  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);

  fitKmRow();
  renderStats();
  updateUploadLabel();
};

window.addEventListener('resize', ()=>{ scaleStageCanvas(); fitKmRow(); alignStatsBaseline(); });
window.addEventListener('orientationchange', ()=> { setTimeout(()=>{ scaleStageCanvas(); fitKmRow(); alignStatsBaseline(); }, 50); });
