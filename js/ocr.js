// js/ocr.js — Daily/Monthly OCR (robust ROIs, bilingual labels, fixes)

/* 1) Tesseract 보장 */
async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Tesseract.js CDN'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  return window.Tesseract;
}

/* 2) 캔버스 유틸 */
function toImage(src){ return new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function cloneCanvas(src){ const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src,0,0); return c; }
function drawCrop(img,x,y,w,h,scale=2.6){
  const c=makeCanvas(Math.round(w*scale), Math.round(h*scale));
  const ctx=c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img, x,y,w,h, 0,0,c.width,c.height);
  return c;
}
function binarize(canvas, threshold=185){
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  const im  = ctx.getImageData(0,0,canvas.width,canvas.height);
  const d   = im.data;
  for(let i=0;i<d.length;i+=4){
    const g = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    const v = g>threshold ? 255 : 0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return canvas;
}
function fillWhite(canvas, rx, ry, rw, rh){
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(canvas.width*rx, canvas.height*ry, canvas.width*rw, canvas.height*rh);
  return canvas;
}
const toURL = (c)=>c.toDataURL('image/png');

/* 3) OCR helpers */
async function ocrLine(url, { psm=7, whitelist='0123456789:’\'″"′ .,' } = {}){
  await ensureTesseract();
  const opts = {
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
  };
  const res = await Tesseract.recognize(url, 'eng+kor', opts);
  return res?.data?.text?.trim() ?? '';
}
async function bestTextFrom(canvas, thresholds=[null, 165, 180, 190, 205]){
  const texts = [];
  for(const th of thresholds){
    const c = th==null ? canvas : binarize(cloneCanvas(canvas), th);
    texts.push(await ocrLine(toURL(c)));
  }
  const score = (s)=> (s.match(/[0-9]/g)||[]).length + (s.match(/[:.]/g)||[]).length*2;
  return texts.sort((a,b)=>score(b)-score(a))[0] || '';
}

/* 4) ROI들 */
/* ✔ Daily: 실제 순서가 [Runs | Pace | Time] 이므로 pace=cell1, time=cell2 로 교정 */
function roisDailyVariants(w,h){
  const top = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.80), h: Math.round(h*0.26) };
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88), cellW = Math.round(barW/3);
  const mk = (barYRatio, barHRatio)=>({
    top,
    runs: { x: barX + 0*cellW, y: Math.round(h*barYRatio), w: cellW, h: Math.round(h*barHRatio) },
    pace: { x: barX + 1*cellW, y: Math.round(h*barYRatio), w: cellW, h: Math.round(h*barHRatio) },
    time: { x: barX + 2*cellW, y: Math.round(h*barYRatio), w: cellW, h: Math.round(h*barHRatio) },
  });
  // 기기/버전별 세로 편차 커버
  return [
    mk(0.48, 0.16),
    mk(0.52, 0.17),
    mk(0.56, 0.18),
    mk(0.60, 0.20),
  ];
}

/* ✔ Monthly: [Runs | Pace | Time] 동일하지만 y 편차가 더 큼 → 후보 세트 확장 */
function roisMonthlyVariants(w,h){
  const top = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.80), h: Math.round(h*0.26) };
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88), cellW = Math.round(barW/3);
  const mk = (barYRatio, barHRatio)=>({
    top,
    runs: { x: barX + 0*cellW, y: Math.round(h*barYRatio), w: cellW, h: Math.round(h*barHRatio) },
    pace: { x: barX + 1*cellW, y: Math.round(h*barYRatio), w: cellW, h: Math.round(h*barHRatio) },
    time: { x: barX + 2*cellW, y: Math.round(h*barYRatio), w: cellW, h: Math.round(h*barHRatio) },
  });
  return [
    mk(0.50, 0.18),
    mk(0.54, 0.18),
    mk(0.57, 0.18),
    mk(0.60, 0.20),
    mk(0.63, 0.20),
  ];
}

/* 5) 파서 (보정 강화) */
function normalizeDigits(s){
  return s
    .replace(/[Oo]/g, '0')
    .replace(/[|Il]/g, '1')
    .replace(/[,]/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}
function parseDistance(raw){
  if (!raw) return null;
  // 칠러(· • :)를 소수점으로 잘못 찍은 경우가 있어서 우선 제거 → 두개 이상 점도 정리
  let s = normalizeDigits(raw).replace(/[·•:]/g, '.').replace(/(\d)\.(?=.*\.)/g, '$1');
  const matches = [...s.matchAll(/\b(\d{1,4}(?:\.\d{1,2})?)\b/g)];
  if (!matches.length) return null;
  // 자리수+소수점 유무 기준으로 가장 그럴듯한 수를 선택
  const pick = (arr)=>arr.sort((a,b)=>{
    const A=a[1], B=b[1];
    const lenScore = B.replace('.','').length - A.replace('.','').length;
    const dotScore = (B.includes('.')?1:0) - (A.includes('.')?1:0);
    return lenScore || dotScore;
  })[0];
  let val = parseFloat(pick(matches)[1]);
  if (!String(val).includes('.') && val >= 100) val = parseFloat((val/100).toFixed(2)); // 100 이상 정수 오인식 보정
  return val;
}
function parseRuns(s){
  if (!s) return null;
  const m = normalizeDigits(s).match(/\b(\d{1,3})\b/);
  return m ? parseInt(m[1],10) : null;
}
function parsePace(s){
  if (!s) return { min:null, sec:null };
  const t = s.replace(/[’′']/g,':').replace(/[″"]/g,':').replace(/：/g,':');
  const m = t.match(/(\d{1,2})\s*:\s*([0-5]\d)/);
  if(!m) return { min:null, sec:null };
  return { min:+m[1], sec:+m[2] };
}
function parseTime(s){
  if (!s) return { raw:null, H:null, M:null, S:null };
  const t = s.replace(/[’′']/g,':').replace(/：/g,':');
  const hmsWords = t.match(/(\d{1,2})\s*h[^0-9]*(\d{1,2})\s*m[^0-9]*(\d{1,2})\s*s/i);
  if (hmsWords) return { raw:`${+hmsWords[1]}:${hmsWords[2]}:${hmsWords[3]}`, H:+hmsWords[1], M:+hmsWords[2], S:+hmsWords[3] };
  const hms = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\s*:\s*([0-5]\d)\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms  = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

/* KM 텍스트를 여러 후보로 읽고 최적 채택 (라벨 영역 마스킹 포함) */
async function bestKmFromTopCanvas(topCanvas){
  const candidates = [];
  // 원본
  candidates.push(await bestTextFrom(cloneCanvas(topCanvas)));
  // 우상단/하단 라벨 마스킹 조합
  for (const rw of [0.22, 0.30]) {
    const c1 = fillWhite(cloneCanvas(topCanvas), 1-rw, 0, rw, 0.50);
    candidates.push(await bestTextFrom(c1));
  }
  const cBottom = fillWhite(cloneCanvas(topCanvas), 0.00, 0.60, 1.00, 0.40);
  candidates.push(await bestTextFrom(cBottom));

  const scored = candidates.map(txt=>{
    const val = parseDistance(txt);
    if (val==null) return {score:-1, val:null};
    const raw = String(txt);
    const digitCount = (raw.match(/\d/g)||[]).length;
    const dotBonus = String(val).includes('.') ? 1 : 0;
    return {score: digitCount + dotBonus*2, val};
  }).sort((a,b)=>b.score-a.score);

  return (scored[0]?.val ?? null);
}

/* 6) 공개 API */
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;

  const setsToTry = (recordType==='monthly') ? roisMonthlyVariants(w,h) : roisDailyVariants(w,h);

  let best = { score:-1, out:null };

  for (const R of setsToTry){
    // ── KM ──
    let topC = drawCrop(img, R.top.x, R.top.y, R.top.w, R.top.h, 2.8);
    const km = await bestKmFromTopCanvas(topC);

    // ── Pace ── (라벨이 끼지 않게 하단 35% 마스킹)
    let paceMin=null, paceSec=null;
    if (R.pace){
      const paceC = drawCrop(img, R.pace.x, R.pace.y, R.pace.w, R.pace.h, 2.8);
      fillWhite(paceC, 0, 0.65, 1, 0.35);
      const paceTxt = await bestTextFrom(paceC);
      const P = parsePace(paceTxt);
      paceMin = P.min; paceSec = P.sec;
    }

    // ── Time ── (동일 마스킹)
    let timeH=null, timeM=null, timeS=null, timeRaw=null;
    if (R.time){
      const timeC = drawCrop(img, R.time.x, R.time.y, R.time.w, R.time.h, 2.8);
      fillWhite(timeC, 0, 0.65, 1, 0.35);
      const timeTxt = await bestTextFrom(timeC);
      const T = parseTime(timeTxt);
      timeH = T.H; timeM = T.M; timeS = T.S; timeRaw = T.raw;
    }

    // ── Runs (monthly only) ──
    let runs = null;
    if (recordType==='monthly' && R.runs){
      const runsC = drawCrop(img, R.runs.x, R.runs.y, R.runs.w, R.runs.h, 2.8);
      fillWhite(runsC, 0, 0.65, 1, 0.35);
      const runsTxt = await bestTextFrom(runsC);
      runs = parseRuns(runsTxt);
    }

    // 스코어: KM 인식 여부(가중) + 필드 수
    const fieldsOk = [
      Number.isFinite(km),
      (paceMin!=null && paceSec!=null && (paceMin+paceSec)>0),
      (timeRaw!=null || timeH!=null || timeM!=null || timeS!=null),
      (recordType==='monthly' ? runs!=null : true)
    ].filter(Boolean).length;
    const score = (Number.isFinite(km)?5:0) + fieldsOk;

    if (score > best.score){
      best = { score, out:{ km: Number.isFinite(km)?km:0, runs, paceMin, paceSec, timeH, timeM, timeS, timeRaw } };
    }
  }

  return best.out ?? { km:0, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };
}
