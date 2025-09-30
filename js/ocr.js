// js/ocr.js — Classic fast OCR (rollback, daily order fix)

/* 1) Tesseract 보장 */
async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Tesseract.js'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  return window.Tesseract;
}

/* 2) 캔버스 유틸 */
function toImage(src){ return new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function drawCrop(img,x,y,w,h,scale=2.6){
  const c=makeCanvas(Math.round(w*scale), Math.round(h*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,x,y,w,h,0,0,c.width,c.height);
  return c;
}
function binarize(canvas, threshold=185){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const im=ctx.getImageData(0,0,canvas.width,canvas.height);
  const d=im.data;
  for(let i=0;i<d.length;i+=4){
    const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    const v=g>threshold?255:0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return canvas;
}
function fillWhite(canvas, rx, ry, rw, rh){
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(canvas.width*rx,canvas.height*ry,canvas.width*rw,canvas.height*rh);
  return canvas;
}
const toURL = (c)=>c.toDataURL('image/png');

/* 3) OCR (빠른 경로: eng → 실패 시 eng+kor 1회만) */
async function ocrOnce(url, { psm=7, whitelist='0123456789:’\'″"′ .,' , lang='eng'} = {}){
  await ensureTesseract();
  const opts = {
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
  };
  const res = await Tesseract.recognize(url, lang, opts);
  return (res?.data?.text || '').trim();
}
async function ocrFast(canvas, opt={}){
  // eng 먼저
  let txt = await ocrOnce(toURL(canvas), opt);
  if (txt && /[0-9]/.test(txt)) return txt;
  // 숫자 없으면 kor 합본으로 1회만 폴백
  return await ocrOnce(toURL(canvas), { ...opt, lang:'eng+kor' });
}

/* 4) ROI (예전 방식 + 데일리 순서만 교정) */
function roisDaily(w,h){
  const top  = { x:Math.round(w*0.06), y:Math.round(h*0.06), w:Math.round(w*0.80), h:Math.round(h*0.26) };
  const barX = Math.round(w*0.06), barW=Math.round(w*0.88), cellW=Math.round(barW/3);
  const barY = Math.round(h*0.50), barH=Math.round(h*0.18);
  return {
    top,
    runs: { x: barX + 0*cellW, y: barY, w: cellW, h: barH }, // ← 왼쪽은 Runs
    pace: { x: barX + 1*cellW, y: barY, w: cellW, h: barH }, // ← 가운데 Pace
    time: { x: barX + 2*cellW, y: barY, w: cellW, h: barH }, // ← 오른쪽 Time
  };
}
function roisMonthly(w,h){
  const top  = { x:Math.round(w*0.06), y:Math.round(h*0.06), w:Math.round(w*0.80), h:Math.round(h*0.26) };
  const barX = Math.round(w*0.06), barW=Math.round(w*0.88), cellW=Math.round(barW/3);
  const barY = Math.round(h*0.50), barH=Math.round(h*0.18);
  return {
    top,
    runs: { x: barX + 0*cellW, y: barY, w: cellW, h: barH },
    pace: { x: barX + 1*cellW, y: barY, w: cellW, h: barH },
    time: { x: barX + 2*cellW, y: barY, w: cellW, h: barH },
  };
}

/* 5) 파서 (예전 심플 버전) */
function normalizeDigits(s){
  return s
    .replace(/[Oo]/g,'0').replace(/[|Il]/g,'1')
    .replace(/[,]/g,'.').replace(/\s+/g,' ').trim();
}
function parseDistance(s){
  if(!s) return null;
  s = normalizeDigits(s).replace(/[·•:]/g,'.');
  const m = s.match(/\b(\d{1,4}(?:\.\d{1,2})?)\b/);
  if(!m) return null;
  let v = parseFloat(m[1]);
  if(!String(v).includes('.') && v>=100) v = parseFloat((v/100).toFixed(2));
  return v;
}
function parseRuns(s){
  const m = normalizeDigits(s).match(/\b(\d{1,3})\b/);
  return m ? parseInt(m[1],10) : null;
}
function parsePace(s){
  const t = (s||'').replace(/[’′']/g,':').replace(/[″"]/g,':').replace(/：/g,':');
  const m = t.match(/(\d{1,2})\s*:\s*([0-5]\d)/);
  return m ? { min:+m[1], sec:+m[2] } : { min:null, sec:null };
}
function parseTime(s){
  const t = (s||'').replace(/[’′']/g,':').replace(/：/g,':');
  const hms = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\s*:\s*([0-5]\d)\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms  = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

/* 6) 공개 API (예전 플로우) */
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;
  const R = recordType==='monthly' ? roisMonthly(w,h) : roisDaily(w,h);

  // ── KM ── (우상단/하단 라벨 조금 가림 + 단일 이진화)
  let topC = drawCrop(img, R.top.x, R.top.y, R.top.w, R.top.h, 2.6);
  topC = fillWhite(topC, 0.68, 0.00, 0.32, 0.45);
  topC = fillWhite(topC, 0.00, 0.60, 1.00, 0.40);
  const kmTxt = await ocrFast(binarize(topC, 190));
  const km = parseDistance(kmTxt) ?? 0;

  // ── 하단 3칸: 숫자 텍스트만 필요하므로 하단 라벨 35% 마스킹 ──
  const maskAndRead = async (cell)=>{
    const c = drawCrop(img, cell.x, cell.y, cell.w, cell.h, 2.6);
    fillWhite(c, 0, 0.65, 1, 0.35);
    return await ocrFast(c);
  };

  let runs=null, paceMin=null, paceSec=null, timeH=null, timeM=null, timeS=null, timeRaw=null;

  // Runs (monthly만 UI에 필요하지만, 데일리에서도 잘못 읽는 걸 막기 위해 제외하지 않음)
  if (R.runs){
    const runsTxt = await maskAndRead(R.runs);
    runs = parseRuns(runsTxt);
  }
  // Pace
  if (R.pace){
    const paceTxt = await maskAndRead(R.pace);
    const P = parsePace(paceTxt); paceMin=P.min; paceSec=P.sec;
  }
  // Time
  if (R.time){
    const timeTxt = await maskAndRead(R.time);
    const T = parseTime(timeTxt);
    timeH=T.H; timeM=T.M; timeS=T.S; timeRaw=T.raw;
  }

  return { km, runs, paceMin, paceSec, timeH, timeM, timeS, timeRaw };
}
