// ui.js — daily/monthly + race(JSON schedule) controller
import { fontSettings, kmFontScale, applyFontIndents, applyFontStatsOffset } from './fonts.js';

/* =========================
   상태
========================= */
let parsedData = { km:null, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };
let recordType = 'daily';   // 'daily' | 'monthly' | 'race'
let layoutType = 'type1';
let selectedFont = 'Helvetica Neue';
let selectedDate = new Date();

const raceState = { races: [], dist: null, bg: 'white' };

/* =========================
   공용 DOM
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

const dmPanel   = document.getElementById('dm-panel');
const racePanel = document.getElementById('race-panel');
const dmBoard   = document.getElementById('dm-board');
const raceBoard = document.getElementById('race-board');

const stageCanvas = document.getElementById('stage-canvas');
const stageRoot   = document.getElementById('stage');

const MONTH_ABBR = ["JAN.","FEB.","MAR.","APR.","MAY.","JUN.","JUL.","AUG.","SEP.","OCT.","NOV.","DEC."];

/* =========================
   Race DOM
========================= */
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
const cssEsc = (s)=> (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(s) : String(s).replace(/"/g,'\\"');
const isFiniteNum = (x)=>Number.isFinite(x);

function ensureFontReady(fontFamily, weight=700, sizePx=200, style='normal'){
  if (!('fonts' in document) || typeof document.fonts.load !== 'function') return Promise.resolve();
  const fam = `"${fontFamily}"`;
  return document.fonts.load(`${style} ${weight} ${sizePx}px ${fam}`).catch(()=>{});
}

function parseTimeToSecFlexible(raw){
  if(!raw) return NaN;
  const t = String(raw).trim().replace(/[’'′]/g,':').replace(/[″"]/g,':').replace(/：/g,':');
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

/* =========================
   날짜/표시 (DM)
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
   숫자/애니 (DM)
========================= */
function truncate(v,d){ const f=10**d; return Math.floor((Number(v)||0)*f)/f; }
function formatKm(v){ v=Math.max(0, Number(v)||0); return (recordType==='monthly') ? truncate(v,1).toFixed(1) : truncate(v,2).toFixed(2); }
function renderKm(v){ const el=document.getElementById('km'); if(el) el.textContent = formatKm(v); }

function updateGridCols(){ if(!statsGrid) return; const cols=(layoutType==='type1')?1:(recordType==='monthly'?3:2); statsGrid.style.setProperty('--cols', cols); }
function layoutStatsGrid(){
  if (layoutType === 'type1'){ [runsWrap, paceWrap, timeWrap].forEach(el=>{ if(!el)return; el.style.gridColumn=''; el.style.transform=''; el.style.marginLeft='';}); return; }
  if (recordType === 'daily'){
    paceWrap&&(paceWrap.style.gridColumn='1 / 2', paceWrap.style.transform='translateX(0)');
    timeWrap&&(timeWrap.style.gridColumn='2 / 3', timeWrap.style.transform=`translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`);
  }else if(recordType==='monthly'){
    runsWrap&&(runsWrap.style.gridColumn='1 / 2');
    paceWrap&&(paceWrap.style.gridColumn='2 / 3', paceWrap.style.transform=`translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull').trim()})`);
    timeWrap&&(timeWrap.style.gridColumn='3 / 4', timeWrap.style.transform=`translateX(${getComputedStyle(document.documentElement).getPropertyValue('--statPull2').trim()})`);
  }
}
function formatPaceByType(){
  const has = parsedData.paceMin!=null && parsedData.paceSec!=null && (parsedData.paceMin+parsedData.paceSec)>0;
  let mm, ss;
  if (has){ mm=String(parsedData.paceMin); ss=zero2txt(parsedData.paceSec); }
  else{
    const tsec=getTimeSecFromParsed(parsedData); const km=parseFloat(parsedData.km);
    if(isFinite(tsec)&&tsec>0&&isFinite(km)&&km>0){ const p=Math.max(0,Math.round(tsec/km)); mm=String(Math.floor(p/60)); ss=zero2txt(p%60); }
    else return (layoutType==='type1') ? '--:-- /km' : '--:--';
  }
  return (layoutType==='type1') ? `${mm}:${ss} /km` : `${mm}:${ss}`;
}
function formatTimeByType(){
  if(layoutType==='type2') return parsedData.timeRaw ? parsedData.timeRaw : '00:00';
  const H=parsedData.timeH??0, M=parsedData.timeM??0, S=parsedData.timeS??0;
  return (H>0) ? `${H}h ${zero2txt(M)}m ${zero2txt(S)}s` : `${String(M)}m ${zero2txt(S)}s`;
}
function alignStatsBaseline(){
  if(layoutType!=='type2') return;
  const ids=['runs','pace','time']; const nodes=[];
  ids.forEach(id=>{ const wrap=document.getElementById(id+'-wrap'); if(wrap&&getComputedStyle(wrap).display!=='none') nodes.push(document.getElementById(id)); });
  nodes.forEach(n=>n&&(n.style.transform=''));
  const bottoms=nodes.map(n=>n.getBoundingClientRect().bottom); const max=Math.max(...bottoms);
  nodes.forEach((n,i)=>{ const dy=Math.round(max-bottoms[i]); if(dy) n.style.transform=`translateY(${dy}px)`; });
}
function renderStats(){
  if (recordType==='race') return;
  const paceLabel=document.getElementById('pace-label'); const timeLabel=document.getElementById('time-label');
  paceLabel&&(paceLabel.textContent='Avg. Pace'); timeLabel&&(timeLabel.textContent='Time');
  runsWrap&&(runsWrap.style.display=(recordType==='monthly')?'block':'none');
  if (recordType==='monthly'){ const runsEl=document.getElementById('runs'); runsEl&&(runsEl.textContent = String((parsedData.runs==null||Number.isNaN(parsedData.runs))?'--':parsedData.runs)); }
  const paceEl=document.getElementById('pace'); const timeEl=document.getElementById('time');
  paceEl&&(paceEl.textContent=formatPaceByType()); timeEl&&(timeEl.textContent=formatTimeByType());
  updateGridCols(); layoutStatsGrid(); alignStatsBaseline();
}

/* =========================
   스테이지/애니(DM)
========================= */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
function animateNumber(id,start,end,duration){
  return new Promise(resolve=>{
    const el=document.getElementById(id); let t0;
    function step(t){ if(!t0) t0=t; const r=Math.min((t-t0)/duration,1); const v=start+(end-start)*(1-Math.pow(1-r,3));
      el&&(el.textContent=formatKm(v)); r<1?requestAnimationFrame(step):resolve(); }
    requestAnimationFrame(step);
  });
}
function scaleStageCanvas(){ if(!stageCanvas) return; const vw=window.innerWidth; const logical=(vw<430)?540:720; const s=Math.min(vw/logical,1); stageCanvas.style.transform=`scale(${s})`; }
function syncDateWidth(){ if(layoutType!=='type2') return; const row=document.getElementById('km-row'); if(!row||!dateDisplay) return; dateDisplay.style.width=row.getBoundingClientRect().width+'px'; }
function fitKmRow(){
  const stage=document.getElementById('stage'), row=document.getElementById('km-row'), measure=document.getElementById('km-measure'), kmEl=document.getElementById('km');
  if(!stage||!row||!measure||!kmEl) return;
  const cs=window.getComputedStyle(kmEl);
  ['fontFamily','fontSize','fontStyle','fontWeight'].forEach(k=>{ measure.style[k]=cs[k]; });
  measure.textContent=kmEl.textContent;
  const st=window.getComputedStyle(stage); const avail=stage.clientWidth - ((+parseFloat(st.paddingLeft)||0)+(+parseFloat(st.paddingRight)||0));
  const need=measure.scrollWidth; const base = need?Math.min(1,(avail*0.98)/need):1;
  const css=getComputedStyle(document.body);
  const typeScale=parseFloat(css.getPropertyValue('--kmScale'))||1;
  const modeScale=parseFloat(css.getPropertyValue('--modeKmScale'))||1;
  const fontScale=(kmFontScale[selectedFont]&&kmFontScale[selectedFont][layoutType])?kmFontScale[selectedFont][layoutType]:1;
  row.style.transform=`scale(${base*typeScale*fontScale*modeScale})`; syncDateWidth();
}
async function runAnimation(){ if(recordType==='race') return; fitKmRow(); await new Promise(r=>setTimeout(r,500)); const end=parseFloat(parsedData.km||0); await animateNumber("km",0,isNaN(end)?0:end,2200); fitKmRow(); }

/* =========================
   폰트/배경/모드/레이아웃
========================= */
function updateActive(groupEl, targetBtn){ if(!groupEl) return; [...groupEl.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active')); targetBtn?.classList?.add('is-active'); }
function setFont(font){
  selectedFont = font;
  if (stageRoot){ stageRoot.style.fontFamily=`"${font}", sans-serif`; stageRoot.style.fontSynthesis='none'; }
  const km=document.getElementById("km"), dateDisp=document.getElementById("date-display"); const fs=fontSettings[font]||{};
  if (km){ km.style.fontFamily=`"${font}", sans-serif`; km.style.fontSize=(fs.base??200)+"px"; km.style.fontWeight=(fs.weight??700); km.style.transform=fs.translate?`translate(${fs.translate})`:"translate(0,0)"; km.style.fontSynthesis='none'; }
  const whitelist = new Set(["Helvetica Neue","Anton","Anta","Arvo","Iceberg"]);
  if (dateDisp){ if (whitelist.has(font)){ dateDisp.style.fontFamily=`"${font}", sans-serif`; dateDisp.style.fontWeight=(fs.dateWeight??700); dateDisp.style.fontSynthesis='none'; } else { dateDisp.style.fontFamily=""; dateDisp.style.fontWeight=700; } }
  const root=document.documentElement.style;
  const dSize=fs.dateSize||"50px", dGap=fs.dateGap||"10px", dTrans=fs.dateTranslate||"0px,0px";
  ["--d2","--m1","--m2"].forEach(p=>{ root.setProperty(`${p}-dateSize`, dSize); root.setProperty(`${p}-dateGap`, dGap); root.setProperty(`${p}-dateTranslate`, dTrans);});
  if (fs.kmWordGap) document.documentElement.style.setProperty('--kmWordGap', fs.kmWordGap);
  updateActive(fontGridEl, fontGridEl?.querySelector(`button[data-font="${cssEsc(font)}"]`));
  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);
  ensureFontReady(font, fs.weight??700, fs.base??200).then(()=>fitKmRow());
  fitKmRow(); renderStats(); renderDateDisplay();
}
function setBackground(color){
  const htmlEl=document.documentElement, bodyEl=document.body;
  if(color==='black'){ htmlEl.classList.replace('bg-white','bg-black'); bodyEl.classList.replace('bg-white','bg-black'); }
  else{ htmlEl.classList.replace('bg-black','bg-white'); bodyEl.classList.replace('bg-black','bg-white'); }
  updateActive(bgRow, bgRow?.querySelector(`button[data-bg="${cssEsc(color)}"]`));
  updateActive(raceBgRow, raceBgRow?.querySelector(`button[data-bg="${cssEsc(color)}"]`));
  raceState.bg = color;
}
function setRecordType(mode){
  recordType = mode;
  document.body.classList.toggle('mode-daily',   mode==='daily');
  document.body.classList.toggle('mode-monthly', mode==='monthly');
  document.body.classList.toggle('mode-race',    mode==='race');
  updateActive(modeRow, modeRow?.querySelector(`button[data-mode="${cssEsc(mode)}"]`));

  dmPanel&&(dmPanel.style.display=(mode==='race')?'none':'block');
  racePanel&&(racePanel.style.display=(mode==='race')?'block':'none');
  dmBoard&&(dmBoard.style.display=(mode==='race')?'none':'block');
  raceBoard&&(raceBoard.style.display=(mode==='race')?'block':'none');

  if (runsWrap) runsWrap.style.display = (mode==='monthly') ? 'block' : 'none';
  if (dateSection) dateSection.style.display = (mode==='race') ? 'none' : (layoutType==='type2'||(layoutType==='type1'&&mode==='monthly')?'grid':'none');

  if (mode!=='race'){ renderKm(document.getElementById('km')?.textContent?.replace(/[^\d.]/g,'')||0); renderStats(); updateGridCols(); fitKmRow(); applyLayoutVisual(); applyFontStatsOffset(selectedFont, layoutType, recordType); }
  updateUploadLabel();
}
function setLayout(type){ layoutType=type; updateActive(layoutRow, layoutRow?.querySelector(`button[data-layout="${cssEsc(type)}"]`)); applyLayoutVisual(); }
function setDateFromInput(){ const val=dateInput?.value; if(!val) return; const [y,m,d]=val.split('-').map(Number); selectedDate=new Date(y, m-1, d); renderDateDisplay(); syncDateWidth(); }
function renderDateDisplay(){ if (dateDisplay) dateDisplay.textContent = formatDateText(selectedDate); }
function applyLayoutVisual(){
  if (recordType==='race') return;
  const word=document.getElementById('km-word');
  dateSection&&(dateSection.style.display=(layoutType==='type1')?((recordType==='monthly')?'grid':'none'):'grid');
  dateDisplay&&(dateDisplay.style.display=(layoutType==='type2'||(layoutType==='type1'&&recordType==='monthly'))?'block':'none');
  word&&(word.style.display='block');
  if (dateInput && !dateInput.value){ const t=new Date(); dateInput.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; selectedDate=t; }
  renderDateDisplay();
  document.body.classList.remove('type1','type2'); document.body.classList.add(layoutType);
  setFont(selectedFont);
  applyFontIndents(selectedFont, layoutType);
  applyFontStatsOffset(selectedFont, layoutType, recordType);
  renderStats(); updateGridCols(); layoutStatsGrid(); fitKmRow(); alignStatsBaseline();
}
function updateUploadLabel(){
  if(!uploadLabelText) return;
  uploadLabelText.textContent =
    recordType === 'monthly' ? 'Upload your mileage for THIS MONTH'
    : recordType === 'race'   ? 'Race mode: enter your record'
    : 'Upload your NRC record for TODAY';
}

/* =========================
   Race: schedule.json 로딩/필터/출력
========================= */
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
function normalizeRow(row){
  const pick=(keys)=>{ for(const k of keys){ if(row[k]!=null && String(row[k]).trim()!=='') return row[k]; } return ''; };
  const date = String(pick(['date','날짜','date_str','DATE'])).slice(0,10);
  const name = String(pick(['name','대회명','title','TITLE'])).trim();
  return {date,name};
}
async function loadRaceScheduleJSON(){
  const candidates = ['./schedule.json','./data/schedule.json'];
  for (const url of candidates){
    try{
      const res = await fetch(url, {cache:'no-cache'});
      if (!res.ok) continue;
      const arr = await res.json(); // [{date,name}, ...]
      raceState.races = Array.isArray(arr) ? arr.map(normalizeRow).filter(r=>r.name) : [];
      populateRaceOptions();
      return;
    }catch(e){ /* try next */ }
  }
  raceState.races = [];
  populateRaceOptions();
}
function populateRaceOptions(){
  if (!raceListSel) return;
  const month = raceMonthSel?.value || '';
  raceListSel.innerHTML = '';
  const top = document.createElement('option'); top.value='__manual__'; top.textContent='직접입력…'; raceListSel.appendChild(top);
  const filtered = (raceState.races||[]).filter(r => (r.date||'').slice(5,7) === month);
  filtered.forEach(r=>{ const o=document.createElement('option'); o.value=r.name; o.textContent=r.name; raceListSel.appendChild(o); });
  const bottom = document.createElement('option'); bottom.value='__manual__2'; bottom.textContent='(직접입력)'; raceListSel.appendChild(bottom);
  toggleRaceManualField();
}
function toggleRaceManualField(){
  if (!raceListSel || !raceNameInput) return;
  const v = raceListSel.value;
  raceNameInput.style.display = (v==='__manual__'||v==='__manual__2') ? 'block':'none';
}

// 거리/배경/체크 이벤트
raceMonthSel?.addEventListener('change', populateRaceOptions);
raceListSel?.addEventListener('change', toggleRaceManualField);

raceDistGrid?.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-dist]'); if(!btn) return;
  [...raceDistGrid.querySelectorAll('button')].forEach(b=>b.classList.remove('is-active'));
  btn.classList.add('is-active'); raceState.dist = btn.dataset.dist;
  if (raceDistManualCk){ raceDistManualCk.checked=false; raceDistManualIn.style.display='none'; }
});
raceDistManualCk?.addEventListener('change', (e)=>{
  const on = e.target.checked; raceDistManualIn.style.display = on ? 'block' : 'none';
  if (on){ raceState.dist=null; [...(raceDistGrid?.querySelectorAll('button')||[])].forEach(b=>b.classList.remove('is-active')); }
});
raceBgRow?.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-bg]'); if (btn) setBackground(btn.dataset.bg);
});
racePB?.addEventListener('change', ()=>{ racePBMsg.style.display = racePB.checked ? 'inline' : 'none'; });

function formatRaceTime(hh,mm,ss){ const H=+hh||0,M=+mm||0,S=+ss||0; return (H>0)?`${H}:${zero2txt(M)}:${zero2txt(S)}`:`${M}:${zero2txt(S)}`; }
function getRaceSubtypeLabel(){
  if (raceDistManualCk?.checked){ const v=(raceDistManualIn?.value||'').trim(); return v||'Custom'; }
  if (raceState.dist==='Half') return 'Half Marathon';
  return raceState.dist || '종목';
}
function getRaceSelectedName(){
  const v=raceListSel?.value; if(!v) return '대회명 미선택';
  if (v==='__manual__'||v==='__manual__2'){ const t=(raceNameInput?.value||'').trim(); return t||'대회명 미입력'; }
  return v;
}
function computeRaceSeconds(){ return (+raceHH.value||0)*3600 + (+raceMM.value||0)*60 + (+raceSS.value||0); }
function renderRaceBoard(){
  raceTitleEl&&(raceTitleEl.textContent=getRaceSelectedName());
  const subtype=getRaceSubtypeLabel();
  raceSubtypeEl&&(raceSubtypeEl.textContent=subtype);
  raceTimeEl&&(raceTimeEl.textContent = formatRaceTime(raceHH.value,raceMM.value,raceSS.value));
  racePaceEl&&(racePaceEl.textContent = `${(+racePaceMM.value||0)}:${zero2txt(+racePaceSS.value||0)} /km`);
  const sec=computeRaceSeconds(), isFull=(subtype==='Marathon');
  badgePB&&(badgePB.style.display = racePB.checked ? 'inline' : 'none');
  badgeSub3&&(badgeSub3.style.display = (isFull && sec>0 && sec<3*3600) ? 'inline' : 'none');
  badgeSub4&&(badgeSub4.style.display = (isFull && sec>=3*3600 && sec<4*3600) ? 'inline' : 'none');
}

/* =========================
   공용 이벤트
========================= */
fontGridEl?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-font]'); if(btn) setFont(btn.dataset.font); });
bgRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-bg]'); if(btn) setBackground(btn.dataset.bg); });
modeRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-mode]'); if(btn) setRecordType(btn.dataset.mode); });
layoutRow?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-layout]'); if(btn) setLayout(btn.dataset.layout); });
dateInput?.addEventListener('change', setDateFromInput);

/* =========================
   Run / Focus
========================= */
window.onRun = function onRun(){
  document.body.classList.add('focus');
  stageCanvas?.scrollIntoView({behavior:'smooth', block:'start'});
  if (recordType==='race'){ renderRaceBoard(); return; }
  runAnimation();
};
window.exitFocus = function exitFocus(){
  document.body.classList.remove('focus');
  window.scrollTo({top:0, behavior:'smooth'});
  const kmEl=document.getElementById('km'); kmEl&&(kmEl.textContent = recordType==='monthly' ? "0.0" : "0.00");
};

/* =========================
   OCR (DM 전용)
========================= */
async function runOcrPipeline(imgDataURL){ const OCR=await import('./ocr.js'); return OCR.extractAll(imgDataURL, { recordType }); }
fileInputEl?.addEventListener("change", async (e)=>{
  if (recordType==='race'){ fileInputEl.value=''; return; }
  const file=e.target.files[0]; if(!file) return;
  const status=document.getElementById("upload-status"); status&&(status.textContent="Processing…");
  fileInputEl.disabled=true;
  const reader=new FileReader();
  reader.onload=async()=>{ try{
    const img=reader.result; const o=await runOcrPipeline(img);
    let km=isFiniteNum(+o.km)?+o.km:null;
    let paceMin=isFiniteNum(+o.paceMin)?+o.paceMin:null;
    let paceSec=isFiniteNum(+o.paceSec)?+o.paceSec:null;
    let timeSec=NaN;
    if (isFiniteNum(o.timeH)||isFiniteNum(o.timeM)||isFiniteNum(o.timeS)){ const h=o.timeH||0,m=o.timeM||0,s=o.timeS||0; timeSec=h*3600+m*60+s; }
    else if(o.timeRaw){ timeSec=parseTimeToSecFlexible(o.timeRaw); }
    const hasPace=isFiniteNum(paceMin)&&isFiniteNum(paceSec)&&(paceMin+paceSec)>0;
    if(!hasPace&&isFinite(timeSec)&&timeSec>0&&isFinite(km)&&km>0){ const p=Math.max(0,Math.round(timeSec/km)); paceMin=Math.floor(p/60); paceSec=p%60; }
    if((!isFinite(km)||km<=0)&&isFinite(timeSec)&&timeSec>0&&hasPace){ const psec=paceMin*60+paceSec; if(psec>0) km=+(timeSec/psec).toFixed(recordType==='monthly'?1:2); }
    parsedData={ km:km??0, runs:(recordType==='monthly')?(o.runs??null):null, paceMin:paceMin??null, paceSec:paceSec??null, timeH:o.timeH??null, timeM:o.timeM??null, timeS:o.timeS??null, timeRaw:o.timeRaw??null };
    renderKm(0); renderStats(); status&&(status.textContent="Done");
  }catch(err){ console.error('[OCR ERROR]',err); status&&(status.textContent="Upload failed"); }
  finally{ fileInputEl.value=''; fileInputEl.disabled=false; } };
  reader.readAsDataURL(file);
});

/* =========================
   초기화
========================= */
window.onload = ()=>{
  setRecordType('daily'); setLayout('type1'); setBackground('white'); setFont('Helvetica Neue');

  // DM 스타일 튜닝
  setTypeStatsStyle('type1', { size:'40px', labelSize:'18px', gap:'24px', pull:'0px' });
  setTypeKmWordStyle('type1', { size:'36px', gap:'16px' }); setTypeKmScale('type1', 1.00);
  setTypeStatsStyle('type2', { size:'40px', labelSize:'20px', gap:'16px', pull:'50px', pull2:'40px' });
  setTypeKmWordStyle('type2', { size:'36px', gap:'16px' }); setTypeKmScale('type2', 1.00);
  setModeStyle('daily', { kmScale:1.0 }); setModeStyle('monthly', { kmScale:1.0 });

  // 날짜 기본값
  const t=new Date(); const di=document.getElementById('date-input');
  if (di) di.value=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  selectedDate=t;

  // Race 초기화
  initRaceMonths();
  loadRaceScheduleJSON();

  scaleStageCanvas(); applyLayoutVisual(); renderKm(0);
  applyFontIndents(selectedFont, layoutType); applyFontStatsOffset(selectedFont, layoutType, recordType);
  fitKmRow(); renderStats(); updateUploadLabel();
};

window.addEventListener('resize', ()=>{ scaleStageCanvas(); fitKmRow(); alignStatsBaseline(); });
window.addEventListener('orientationchange', ()=>{ setTimeout(()=>{ scaleStageCanvas(); fitKmRow(); alignStatsBaseline(); }, 50); });

/* ===== 디자인 변수 Helpers ===== */
function setTypeStatsStyle(type, { size, labelSize, gap, pull, pull2 } = {}){ const r=document.documentElement.style;
  if(type==='type1'){ if(size)r.setProperty('--t1-statSize',size); if(labelSize)r.setProperty('--t1-labelSize',labelSize); if(gap!=null)r.setProperty('--t1-statGap',gap); if(pull!=null)r.setProperty('--t1-statPull',pull); if(pull2!=null)r.setProperty('--t1-statPull2',pull2); }
  else{ if(size)r.setProperty('--t2-statSize',size); if(labelSize)r.setProperty('--t2-labelSize',labelSize); if(gap!=null)r.setProperty('--t2-statGap',gap); if(pull!=null)r.setProperty('--t2-statPull',pull); if(pull2!=null)r.setProperty('--t2-statPull2',pull2); }
}
function setTypeKmWordStyle(type,{size,gap}={}){ const r=document.documentElement.style; if(type==='type1'){ if(size)r.setProperty('--t1-kmWordSize',size); if(gap)r.setProperty('--t1-kmWordGap',gap);} else{ if(size)r.setProperty('--t2-kmWordSize',size); if(gap)r.setProperty('--t2-kmWordGap',gap);} }
function setTypeKmScale(type, scale){ const r=document.documentElement.style; r.setProperty(type==='type1'?'--t1-kmScale':'--t2-kmScale', String(scale)); fitKmRow(); }
function setModeStyle(mode,{kmScale,statGap,kmWordBottomGap}={}){ const r=document.documentElement.style;
  if(mode==='daily'){ if(kmScale!=null)r.setProperty('--d-kmScale',String(kmScale)); if(statGap!=null)r.setProperty('--d-statGap',String(statGap)); if(kmWordBottomGap!=null)r.setProperty('--d-kmWordBottomGap',String(kmWordBottomGap)); }
  else{ if(kmScale!=null)r.setProperty('--m-kmScale',String(kmScale)); if(statGap!=null)r.setProperty('--m-statGap',String(statGap)); if(kmWordBottomGap!=null)r.setProperty('--m-kmWordBottomGap',String(kmWordBottomGap)); }
}
