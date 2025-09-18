// js/ocr.js — monthly Runs 지원 + pace 교정 + dual-threshold

// 1) Tesseract 보장
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

// 2) 이미지/전처리 유틸
function toImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function drawCrop(img, x, y, w, h, scale = 2.6) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
function binarize(canvas, threshold = 185) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    const v = g > threshold ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}
const toDataURL = (canvas) => canvas.toDataURL('image/png');

// 3) OCR 호출 (숫자 전용 세팅)
async function ocrDigits(url, T, psm = T.PSM.SINGLE_LINE) {
  const res = await T.recognize(url, 'eng+kor', {
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: '0123456789:.',
    classify_bln_numeric_mode: '1',
    preserve_interword_spaces: '1'
  });
  return res?.data?.text || '';
}

// 4) ROI (일/월 레이아웃 분기)
function rois(w, h, recordType = 'daily') {
  const top = { x: Math.round(w*0.07), y: Math.round(h*0.07), w: Math.round(w*0.86), h: Math.round(h*0.24) };

  const bar = { x: Math.round(w*0.06), y: Math.round(h*0.48), w: Math.round(w*0.88), h: Math.round(h*0.16) };
  const cellW = Math.round(bar.w / 3);

  if (recordType === 'monthly') {
    // [Runs][Pace][Time]
    const runs = { x: bar.x + 0*cellW, y: bar.y, w: cellW, h: bar.h };
    const pace = { x: bar.x + 1*cellW, y: bar.y, w: cellW, h: bar.h };
    const time = { x: bar.x + 2*cellW, y: bar.y, w: cellW, h: bar.h };
    return { top, runs, pace, time };
  } else {
    // [Pace][Time][(unused)]
    const pace = { x: bar.x + 0*cellW, y: bar.y, w: cellW, h: bar.h };
    const time = { x: bar.x + 1*cellW, y: bar.y, w: cellW, h: bar.h };
    return { top, pace, time };
  }
}

// 5) 파서
function parseDistance(s) {
  const m = String(s || '').replace(/,/g, '.').match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
  return m ? parseFloat(m[1]) : null;
}
function parseRuns(s) {
  const m = String(s || '').match(/\b(\d{1,3})\b/);
  if (!m) return null;
  const v = +m[1];
  // 월간 러닝 횟수 현실 범위 (1~60 정도로 제한)
  return (v >= 1 && v <= 60) ? v : null;
}
function parsePace(s) {
  const t = String(s || '')
    .replace(/[’'′]/g, ':')
    .replace(/″|"/g, ':')
    .replace(/：/g, ':');
  const m = t.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return { min:null, sec:null, secTotal:null, raw:null };
  const min = +m[1], sec = +m[2];
  return { min, sec, secTotal: min*60 + sec, raw: `${min}:${m[2]}` };
}
function parseTime(s) {
  const t = String(s || '').replace(/[’'′]/g, ':').replace(/：/g, ':');
  const hms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (hms) {
    const H=+hms[1], M=+hms[2], S=+hms[3];
    return { raw:`${H}:${hms[2]}:${hms[3]}`, H, M, S, secTotal: H*3600 + M*60 + S };
  }
  const ms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (ms)  {
    const M=+ms[1], S=+ms[2];
    return { raw:`${M}:${ms[2]}`, H:null, M, S, secTotal: M*60 + S };
  }
  return { raw:null, H:null, M:null, S:null, secTotal:null };
}

// 6) 합리성 체크 & 교차검증
const validPace = (s)=> Number.isFinite(s) && s>=120 && s<=1200; // 2:00~20:00
const validKm   = (k)=> Number.isFinite(k) && k>0 && k<1000;
const validTime = (t)=> Number.isFinite(t) && t>0 && t<= (15*3600);

function reconcilePace(ocrPaceSec, timeSec, km) {
  const calc = (validTime(timeSec) && validKm(km)) ? Math.round(timeSec / km) : null;
  if (!validPace(ocrPaceSec) && validPace(calc)) return calc;
  if (validPace(ocrPaceSec) && validPace(calc)) {
    const diff = Math.abs(ocrPaceSec - calc);
    if (diff >= 20) return calc; // 6↔5분대 대실수 방지
  }
  return ocrPaceSec ?? calc ?? null;
}

// 7) 공개 API
export async function extractAll(imgDataURL, { recordType } = { recordType:'daily' }) {
  const T = await ensureTesseract();
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;
  const R = rois(w, h, recordType);

  // --- 거리
  const topC = binarize(drawCrop(img, R.top.x, R.top.y, R.top.w, R.top.h, 2.6), 190);
  const kmTxt = await ocrDigits(toDataURL(topC), T, T.PSM.SINGLE_LINE);
  const km = parseDistance(kmTxt);

  // --- 페이스/시간 (dual threshold)
  const paceBoxes = R.pace
    ? [ binarize(drawCrop(img, R.pace.x, R.pace.y, R.pace.w, R.pace.h, 2.6), 185),
        binarize(drawCrop(img, R.pace.x, R.pace.y, R.pace.w, R.pace.h, 2.6), 200) ]
    : [];
  const timeBox = R.time
    ? binarize(drawCrop(img, R.time.x, R.time.y, R.time.w, R.time.h, 2.6), 185)
    : null;

  const [paceTxt1, paceTxt2, timeTxt] = await Promise.all([
    paceBoxes[0] ? ocrDigits(toDataURL(paceBoxes[0]), T, T.PSM.SINGLE_LINE) : '',
    paceBoxes[1] ? ocrDigits(toDataURL(paceBoxes[1]), T, T.PSM.SINGLE_LINE) : '',
    timeBox ? ocrDigits(toDataURL(timeBox), T, T.PSM.SINGLE_LINE) : ''
  ]);

  const p1 = parsePace(paceTxt1);
  const p2 = parsePace(paceTxt2);
  const Tm = parseTime(timeTxt);
  const timeSec = Tm.secTotal ?? null;

  // pace 후보 선택(보수적으로 더 느린 쪽 우선)
  const candidates = [p1.secTotal, p2.secTotal].filter(Number.isFinite);
  let ocrPaceSec = null;
  if (candidates.length === 1) ocrPaceSec = candidates[0];
  else if (candidates.length === 2) ocrPaceSec = Math.max(candidates[0], candidates[1]);
  const finalPaceSec = reconcilePace(ocrPaceSec, timeSec, km);

  let paceMin = null, paceSec = null;
  if (Number.isFinite(finalPaceSec)) {
    paceMin = Math.floor(finalPaceSec/60);
    paceSec = finalPaceSec % 60;
  }

  // --- 월간: Runs 추출
  let runs = null;
  if (recordType === 'monthly' && R.runs) {
    const runsC1 = binarize(drawCrop(img, R.runs.x, R.runs.y, R.runs.w, R.runs.h, 2.6), 185);
    const runsC2 = binarize(drawCrop(img, R.runs.x, R.runs.y, R.runs.w, R.runs.h, 2.6), 200);
    const [runsTxt1, runsTxt2] = await Promise.all([
      ocrDigits(toDataURL(runsC1), T, T.PSM.SINGLE_LINE),
      ocrDigits(toDataURL(runsC2), T, T.PSM.SINGLE_LINE),
    ]);
    // 두 결과 중 유효한 값을 고름(큰 값 우선)
    const r1 = parseRuns(runsTxt1);
    const r2 = parseRuns(runsTxt2);
    runs = [r1, r2].filter((x)=>Number.isInteger(x)).sort((a,b)=>b-a)[0] ?? null;
  }

  return {
    km: validKm(km) ? km : 0,
    runs,
    paceMin, paceSec,
    timeH: Tm.H, timeM: Tm.M, timeS: Tm.S, timeRaw: Tm.raw
  };
}
