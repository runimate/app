// ui.js — clean version (no hint banners)
// 화면/이벤트/애니메이션 컨트롤러
import { fontSettings, kmFontScale, applyFontIndents, applyFontStatsOffset } from './fonts.js';

/* =========================
   상태
========================= */
let parsedData = { km:null, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };
let recordType = 'daily';
let layoutType = 'type1';
let selectedFont = 'Helvetica Neue';
let selectedDate = new Date();

/* =========================
   DOM
========================= */
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

const MONTH_ABBR = ["JAN.","FEB.","MAR.","APR.","MAY.","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];

/* =========================
   유틸
========================= */
const zero2txt = (n)=>String(n).padStart(2,'0');

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
function renderKm(value){ document.getElementById('km').textContent = formatKm(value); }

/* =========================
   레이아웃
========================= */
function updateGridCols(){
  const cols = (layoutType==='type1') ? 1 : (recordType==='monthly' ? 3 : 2);
  statsGrid.style.setProperty('--cols', cols);
}
function layoutStatsGrid(){
  if (layoutType === 'type1'){
    [runsWrap, paceWrap, timeWrap].forEach(el=>{
      el.style.gridColumn = '';
      el.style.transform = '';
      el.style.marginLeft = '';
    });
    return;
  }
  if (recordType === 'daily'){
    paceWrap.style.gridColumn = '1 / 2';
    timeWrap.style.gridColumn = '2 / 3';
    paceWrap.style.transform = 'translateX(0)';
    timeWrap.style.transform = `translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`;
    paceWrap.style.marginLeft = '0';
    timeWrap.style.marginLeft = '0';
  } else {
    runsWrap.style.gridColumn = '1 / 2';
    paceWrap.style.gridColumn = '2 / 3';
    timeWrap.style.gridColumn = '3 / 4';
    runsWrap.style.transform = 'translateX(0)';
    paceWrap.style.transform = `translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`;
    timeWrap.style.transform = `translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull2').trim()})`;
    runsWrap.style.marginLeft = '0';
    paceWrap.style.marginLeft = '0';
    timeWrap.style.marginLeft = '0';
  }
}

/* =========================
   표기 포맷(조용한 폴백 포함)
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
    if(getComputedStyle(wrap).display!=='none'){
      stats.push(document.getElementById(id));
    }
  };
  addIfVisible('runs'); addIfVisible('pace'); addIfVisible('time');
  stats.forEach(el=>{ el.style.transform = ''; });
  const bottoms = stats.map(el=>el.getBoundingClientRect().bottom);
  const maxBottom = Math.max(...bottoms);
  stats.forEach((el,i)=>{
    const dy = Math.round(maxBottom - bottoms[i]);
    if (dy) el.style.transform = `translateY(${dy}px)`;
  });
}
function renderStats(){
  document.getElementById('pace-label').textContent = 'Avg. Pace';
  document.getElementById('time-label').textContent = 'Time';
  runsWrap.style.display = (recordType === 'monthly') ? 'block' : 'none';
  if (recordType === 'monthly') {
    const runsVal = (parsedData.runs == null || Number.isNaN(parsedData.runs)) ? '--' : parsedData.runs;
    document.getElementById('runs').textContent = String(runsVal);
  }
  document.getElementById('pace').textContent = formatPaceByType();
  document.getElementById('time').textContent = formatTimeByType();

  updateGridCols();
  layoutStatsGrid();
  alignStatsBaseline();
}
function updateUploadLabel(){
  if(!uploadLabelText) return;
  uploadLabelText.textContent =
    recordType === 'monthly'
      ? 'Upload your mileage for THIS MONTH'
      : 'Upload your NRC record for TODAY';
}

/* =========================
   캔버스 스케일/애니
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
      kmEl.textContent = formatKm(val);
      raw < 1 ? requestAnimationFrame(update) : resolve();
    }
    requestAnimationFrame(update);
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
  const width = row.getBoundingClientRect().width;
  dateDisplay.style.width = width + 'px';
}
function fitKmRow(){
  const stage   = document.getElementById('stage');
  const row     = document.getElementById('km-row');
  const measure = document.getElementById('km-measure');
  const kmEl    = document.getElementById('km');

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
  [...groupEl.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  if(targetBtn) targetBtn.classList.add('is-active');
}
function setFont(font){
  selectedFont = font;

  const km       = document.getElementById("km");
  const dateDisp = document.getElementById("date-display");
  const fs = fontSettings[font] || {};

  km.style.fontFamily = `"${font}", sans-serif`;
  km.style.fontSize   = ((fs.base ?? 200)) + "px";
  km.style.fontWeight = (fs.weight ?? 700);
  km.style.transform  = fs.translate ? `translate(${fs.translate})` : "translate(0,0)";
  km.style.fontSynthesis = 'none';

  const whitelist = new Set(["Helvetica Neue","Anton","Anta","Arvo","Iceberg"]);
  if (whitelist.has(font)) {
    dateDisp.style.fontFamily = `"${font}", sans-serif`;
    dateDisp.style.fontWeight = (fs.dateWeight ?? 700);
    dateDisp.style.fontSynthesis = 'none';
  } else {
    dateDisp.style.fontFamily = "";
    dateDisp.style.fontWeight = 700;
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

  const targetBtn = fontGridEl.querySelector(`button[data-font="${CSS.escape(font)}"]`);
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
  const targetBtn = bgRow.querySelector(`button[data-bg="${CSS.escape(color)}"]`);
  updateActive(bgRow, targetBtn);
}
function setRecordType(mode){
  recordType = mode;
  document.body.classList.toggle('mode-daily', mode==='daily');
  document.body.classList.toggle('mode-monthly', mode==='monthly');
  updateActive(modeRow, modeRow.querySelector(`button[data-mode="${CSS.escape(mode)}"]`));
  runsWrap.style.display = (mode==='monthly') ? 'block' : 'none';
  renderKm(document.getElementById('km').textContent.replace(/[^\d.]/g,'') || 0);
  renderStats();
  updateGridCols();
  fitKmRow();
  applyLayoutVisual();
  applyFontStatsOffset(selectedFont, layoutType, recordType);
  updateUploadLabel();
}
function setLayout(type){
  layoutType = type;
  updateActive(layoutRow, layoutRow.querySelector(`button[data-layout="${CSS.escape(type)}"]`));
  applyLayoutVisual();
}
function setDateFromInput(){
  const val = dateInput.value; if(!val) return;
  const [y,m,d] = val.split('-').map(Number);
  selectedDate = new Date(y, m-1, d);
  renderDateDisplay(); syncDateWidth();
}
function renderDateDisplay(){
  dateDisplay.textContent = formatDateText(selectedDate);
}
function applyLayoutVisual(){
  const word = document.getElementById('km-word');

  if(layoutType==='type1'){
    dateSection.style.display = (recordType==='monthly') ? 'grid' : 'none';
  }else{
    dateSection.style.display = 'grid';
  }

  if (layoutType==='type2' || (layoutType==='type1' && recordType==='monthly')) {
    dateDisplay.style.display = 'block';
  } else {
    dateDisplay.style.display = 'none';
  }

  word.style.display = 'block';

  if(!dateInput.value){
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
   Run / Focus
========================= */
window.onRun = function onRun(){
  document.body.classList.add('focus');
  document.getElementById('stage-canvas').scrollIntoView({behavior:'smooth', block:'start'});
  runAnimation();
};
window.exitFocus = function exitFocus(){
  document.body.classList.remove('focus');
  window.scrollTo({top:0, behavior:'smooth'});
  document.getElementById('km').textContent = recordType==='monthly' ? "0.0" : "0.00";
};

/* =========================
   OCR 파이프라인 (지연 로드)
========================= */
async function runOcrPipeline(imgDataURL){
  const OCR = await import('./ocr.js');
  return OCR.extractAll(imgDataURL, { recordType });
}

/* =========================
   업로드 이벤트 — 단 하나만!
========================= */
fileInputEl.addEventListener("change", async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const status = document.getElementById("upload-status");
  status.textContent = "Processing…";
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
      status.textContent = "Done";
    } catch (err) {
      console.error('[OCR ERROR]', err && err.stack ? err.stack : err);
      status.textContent = "Upload failed";
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
  setRecordType('daily');
  setLayout('type1');
  setBackground('white');
  setFont('Helvetica Neue');

  setTypeStatsStyle('type1', { size:'40px', labelSize:'18px', gap:'24px', pull:'0px' });
  setTypeKmWordStyle('type1', { size:'36px', gap:'16px' });
  setTypeKmScale('type1', 1.00);

  setTypeStatsStyle('type2', { size:'40px', labelSize:'20px', gap:'16px', pull:'50px', pull2:'40px' });
  setTypeKmWordStyle('type2', { size:'36px', gap:'16px' });
  setTypeKmScale('type2', 1.00);

  setModeStyle('daily',   { kmScale:1.0 });
  setModeStyle('monthly', { kmScale:1.0 });

  const t=new Date();
  document.getElementById('date-input').value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  selectedDate = t;

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
