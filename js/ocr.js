// js/ocr.js — robust extractor (daily + monthly ready)

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load Tesseract.js CDN'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  return window.Tesseract;
}

// ---- image utils
function toImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
function drawCrop(img, x, y, w, h, scale=2.0){
  const c=document.createElement('canvas');
  c.width=Math.round(w*scale); c.height=Math.round(h*scale);
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
function cloneCanvas(c){
  const d=document.createElement('canvas');
  d.width=c.width; d.height=c.height;
  d.getContext('2d').drawImage(c,0,0);
  return d;
}
function binarize(canvas, threshold=185){
  const c=cloneCanvas(canvas);
  const ctx=c.getContext('2d',{willReadFrequently:true});
  const im=ctx.getImageData(0,0,c.width,c.height);
  const d=im.data;
  for(let i=0;i<d.length;i+=4){
    const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    const v=g>threshold?255:0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return c;
}
const dataURL = c => c.toDataURL('image/png');

// ---- text helpers
const norm = s => String(s||'')
  .replace(/[’'′]/g,':')
  .replace(/[″"]/g,':')
  .replace(/：/g,':')
  .replace(/\s+/g,' ')
  .trim();

function parseDistance(s){
  // 가장 그럴듯한 소수 한 개 (0.1~200)
  const m = s.replace(/,/g,'.').match(/(\d{1,3}(?:\.\d{1,2})?)/);
  if(!m) return null;
  const v = parseFloat(m[1]);
  return (v>0.1 && v<200) ? v : null;
}
function parseMmSs(s){
  const t = norm(s);
  const m = t.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if(!m) return {min:null, sec:null};
  const mm=+m[1], ss=+m[2];
  if (mm<0 || mm>59 || ss<0 || ss>59) return {min:null, sec:null};
  return {min:mm, sec:ss};
}
function parseTimeFlexible(s){
  const t = norm(s);
  const hms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms  = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}
const toSec = ({H=null,M=null,S=null,raw=null})=>{
  if (H!=null||M!=null||S!=null){
    const h=H||0,m=M||0,s=S||0;
    const v=h*3600+m*60+s;
    return v>0?v:NaN;
  }
  if (raw){
    const r=parseTimeFlexible(raw);
    return toSec(r);
  }
  return NaN;
};
const validPace = s => Number.isFinite(s) && s>=150 && s<=1200; // 2:30~20:00

// ---- ROIs (여유 있게 + 칸별 좁게)
function rois(w,h){
  // 상단 큰 거리: 왼쪽 여백을 넉넉히, 로고 영역까지 포함되더라도 숫자 화이트리스트로 보호
  const top = { x: Math.round(w*0.04), y: Math.round(h*0.06), w: Math.round(w*0.92), h: Math.round(h*0.26) };

  // 하단 정보 바: 세 칸
  const barY = Math.round(h*0.48);
  const barH = Math.round(h*0.17);
  const barX = Math.round(w*0.06);
  const barW = Math.round(w*0.88);
  const cell = Math.round(barW/3);

  // 페이스는 왼쪽 칸의 왼쪽 80%만 사용(옆 칸 숫자 유입 차단)
  const pace = { x: barX + Math.round(cell*0.00), y: barY, w: Math.round(cell*0.80), h: barH };
  // 시간은 가운데 칸의 중앙 80%
  const time = { x: barX + Math.round(cell*1.10), y: barY, w: Math.round(cell*0.80), h: barH };

  return { top, pace, time };
}

// ---- multi-pass OCR (여러 임계값 후보)
async function ocrBest(canvas, lang, baseCfg){
  await ensureTesseract();
  const candidates = [
    { c: canvas,            note: 'raw' },
    { c: binarize(canvas,160), note: 'b160' },
    { c: binarize(canvas,185), note: 'b185' },
    { c: binarize(canvas,210), note: 'b210' },
  ];
  let bestText = '', bestScore = -1;
  for (const k of candidates){
    const { data } = await Tesseract.recognize(k.c.toDataURL('image/png'), lang, baseCfg);
    const txt = data?.text || '';
    // 간단 스코어: 숫자/콜론 비율 + 길이
    const digits = (txt.match(/[0-9]/g)||[]).length;
    const colons = (txt.match(/[:]/g)||[]).length;
    const score = digits*2 + colons*1 + Math.min(txt.length, 8);
    if (score > bestScore){ bestScore=score; bestText=txt; }
  }
  return bestText.trim();
}

// ---- public API
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;
  const { top, pace, time } = rois(w,h);

  // 거리
  const topC = drawCrop(img, top.x, top.y, top.w, top.h, 2.6);
  const kmTxt = await ocrBest(topC, 'eng+kor', {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: '0123456789.,'
  });
  let km = parseDistance(kmTxt);

  // 페이스
  const paceC = drawCrop(img, pace.x, pace.y, pace.w, pace.h, 2.6);
  const paceTxt = norm(await ocrBest(paceC, 'eng+kor', {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: "0123456789:'′″\" :"
  }));
  let { min:paceMin, sec:paceSec } = parseMmSs(paceTxt);

  // 시간
  const timeC = drawCrop(img, time.x, time.y, time.w, time.h, 2.6);
  const timeTxt = norm(await ocrBest(timeC, 'eng+kor', {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: "0123456789:'′″\" :"
  }));
  const T = parseTimeFlexible(timeTxt);
  const timeSec = toSec(T);

  // 합리성 교정
  let paceSecTotal = (paceMin!=null && paceSec!=null) ? paceMin*60+paceSec : NaN;

  // pace가 비정상(없음/극단)이고 time, km가 있으면 pace := time/km
  if ((!validPace(paceSecTotal)) && Number.isFinite(timeSec) && Number.isFinite(km) && km>0){
    const guess = Math.round(timeSec / km);
    if (validPace(guess)){
      paceSecTotal = guess;
      paceMin = Math.floor(guess/60);
      paceSec = guess%60;
    }
  }

  // km가 없고(time+pace 존재) → 역산
  if ((!Number.isFinite(km) || km<=0) && Number.isFinite(timeSec) && validPace(paceSecTotal)){
    km = +(timeSec / paceSecTotal).toFixed(recordType==='monthly' ? 1 : 2);
  }

  // monthly 대비: 추후 'Runs' 라벨을 읽어서 채워 넣을 준비(미입수면 null)
  let runs = null;
  if (recordType === 'monthly'){
    // 간단 추정: 상단 숫자 바로 아래 "Kilometers"가 보이면 monthly로 간주
    // 실제 runs는 별도 ROI/라벨 탐지로 확장 가능
  }

  return {
    km: km ?? 0,
    runs,
    paceMin: paceMin ?? null,
    paceSec: paceSec ?? null,
    timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
  };
}
