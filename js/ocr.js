// js/ocr.js — robust daily/monthly extractor

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load Tesseract.js'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  return window.Tesseract;
}

// ---------- image utils
function toImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
function drawCrop(img,x,y,w,h,scale=2.4){
  const c=document.createElement('canvas');
  c.width=Math.round(w*scale); c.height=Math.round(h*scale);
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,x,y,w,h,0,0,c.width,c.height);
  return c;
}
function cloneCanvas(c){ const d=document.createElement('canvas'); d.width=c.width; d.height=c.height; d.getContext('2d').drawImage(c,0,0); return d; }
function binarize(canvas,thr=185){
  const c=cloneCanvas(canvas);
  const ctx=c.getContext('2d',{willReadFrequently:true});
  const im=ctx.getImageData(0,0,c.width,c.height);
  const d=im.data;
  for(let i=0;i<d.length;i+=4){
    const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    const v=g>thr?255:0; d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return c;
}
const dataURL = c => c.toDataURL('image/png');

// ---------- text helpers
const norm = s => String(s||'')
  .replace(/[’'′]/g,':').replace(/[″"]/g,':').replace(/：/g,':')
  .replace(/\s+/g,' ').trim();

function parseDistanceBest(s){
  // 모든 후보 추출 후 0.1~200 사이 "최댓값" 선택
  const arr = [...s.replace(/,/g,'.').matchAll(/\d{1,3}(?:\.\d{1,2})?/g)]
    .map(m=>parseFloat(m[0]))
    .filter(v=>v>0.1 && v<200);
  if (!arr.length) return null;
  return Math.max(...arr);
}
function parseMmSs(s){
  const t=norm(s);
  const m=t.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if(!m) return {min:null,sec:null};
  const mm=+m[1], ss=+m[2];
  if (mm<0 || mm>59 || ss<0 || ss>59) return {min:null,sec:null};
  return {min:mm,sec:ss};
}
function parseTimeFlexible(s){
  const t=norm(s);
  const hms=t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if(hms) return {raw:`${+hms[1]}:${hms[2]}:${hms[3]}`,H:+hms[1],M:+hms[2],S:+hms[3]};
  const ms=t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if(ms) return {raw:`${+ms[1]}:${ms[2]}`,H:null,M:+ms[1],S:+ms[2]};
  return {raw:null,H:null,M:null,S:null};
}
const toSec = (T)=>{
  if (T.H!=null || T.M!=null || T.S!=null){
    const h=T.H||0,m=T.M||0,s=T.S||0;
    const v=h*3600+m*60+s;
    return v>0?v:NaN;
  }
  if (T.raw){ return toSec(parseTimeFlexible(T.raw)); }
  return NaN;
};
const validPace = s => Number.isFinite(s) && s>=150 && s<=1200; // 2:30~20:00

// ---------- ROIs (숫자 라인만 타깃)
function rois(w,h){
  // 거리: 좌여백 넉넉히
  const top = { x: Math.round(w*0.04), y: Math.round(h*0.06), w: Math.round(w*0.92), h: Math.round(h*0.26) };

  const barX = Math.round(w*0.06);
  const barW = Math.round(w*0.88);
  const barY = Math.round(h*0.48);
  const barH = Math.round(h*0.17);
  const cell = Math.round(barW/3);

  // 숫자가 있는 "윗쪽 55%"만 사용
  const bandY = y => y + Math.round(barH*0.05);
  const bandH = Math.round(barH*0.55);

  const pace = { x: barX + Math.round(cell*0.00), y: bandY(barY), w: Math.round(cell*0.80), h: bandH };
  const time = { x: barX + Math.round(cell*1.10), y: bandY(barY), w: Math.round(cell*0.80), h: bandH };

  return { top, pace, time };
}

// ---------- multi-pass OCR & 선택
async function ocrBest(canvas, lang, cfg){
  await ensureTesseract();
  const cand = [
    canvas,
    binarize(canvas,160),
    binarize(canvas,185),
    binarize(canvas,210),
  ];
  let best='', score=-1;
  for(const c of cand){
    const { data } = await Tesseract.recognize(dataURL(c), lang, cfg);
    const t = (data?.text||'').trim();
    const sc = (t.match(/[0-9]/g)||[]).length*2 + (t.match(/[:]/g)||[]).length + Math.min(t.length,8);
    if (sc>score){ score=sc; best=t; }
  }
  return best;
}

// ---------- public API
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  const img = await toImage(imgDataURL);
  const {width:w,height:h}=img;
  const { top, pace, time } = rois(w,h);

  // 거리
  const topC = drawCrop(img, top.x, top.y, top.w, top.h, 2.6);
  const kmTxt = await ocrBest(topC, 'eng+kor', {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: '0123456789.,'
  });
  let km = parseDistanceBest(kmTxt);

  // 페이스
  const paceC = drawCrop(img, pace.x, pace.y, pace.w, pace.h, 2.6);
  const paceTxt = norm(await ocrBest(paceC, 'eng+kor', {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: "0123456789:'′″\" :"
  }));
  let {min:paceMin, sec:paceSec} = parseMmSs(paceTxt);
  let paceTotal = (paceMin!=null && paceSec!=null) ? paceMin*60+paceSec : NaN;

  // 시간
  const timeC = drawCrop(img, time.x, time.y, time.w, time.h, 2.6);
  const timeTxt = norm(await ocrBest(timeC, 'eng+kor', {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
    tessedit_char_whitelist: "0123456789:'′″\" :"
  }));
  const T = parseTimeFlexible(timeTxt);
  const timeSec = toSec(T);

  // 교정
  if ((!validPace(paceTotal)) && Number.isFinite(timeSec) && Number.isFinite(km) && km>0){
    const guess = Math.round(timeSec / km);
    if (validPace(guess)){ paceTotal=guess; paceMin=Math.floor(guess/60); paceSec=guess%60; }
  }
  if ((!Number.isFinite(km) || km<=0) && Number.isFinite(timeSec) && validPace(paceTotal)){
    km = +(timeSec / paceTotal).toFixed(recordType==='monthly' ? 1 : 2);
  }

  return {
    km: km ?? 0,
    runs: (recordType==='monthly') ? null : null,
    paceMin: paceMin ?? null,
    paceSec: paceSec ?? null,
    timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
  };
}
