// js/ocr.js — robust OCR for NRC daily/monthly (eng+kor)

//////////////////////////////
// 1) Load tesseract once
//////////////////////////////
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

//////////////////////////////
// 2) Image helpers
//////////////////////////////
function toImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function drawCrop(img, x, y, w, h, scale = 2.2) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w * scale));
  c.height = Math.max(4, Math.round(h * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
function getGrayData(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = im.data;
  const g = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return { gray: g, im, ctx };
}
function otsuThreshold(gray) {
  // 256-bin histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0, wB = 0, wF = 0, mB = 0, mF = 0;
  let maxVar = -1, thresh = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    mB = sumB / wB;
    mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      thresh = t;
    }
  }
  return thresh;
}
function binarizeAuto(canvas, bias = 0) {
  const { gray, im, ctx } = getGrayData(canvas);
  const t = Math.min(255, Math.max(0, otsuThreshold(gray) + bias));
  const d = im.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = gray[j] > t ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}
function maskRect(canvas, x, y, w, h, fill = 255) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${fill},${fill},${fill})`;
  ctx.fillRect(x, y, w, h);
  return canvas;
}
function trimToStrongestTextLine(canvas) {
  // 수평 투영으로 가장 잉크가 많은 밴드만 남김(라벨 제거)
  const { gray } = getGrayData(canvas);
  const W = canvas.width, H = canvas.height;
  const rowInk = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let x = 0; x < W; x++) s += 255 - gray[y*W + x];
    rowInk[y] = s;
  }
  // 최댓값 주변으로 1줄(또는 소폭 여유)만
  let maxY = 0, maxV = -1;
  for (let y = 0; y < H; y++) if (rowInk[y] > maxV) { maxV = rowInk[y]; maxY = y; }
  // 위아래로 퍼진 숫자 두께 계산
  const cutoff = maxV * 0.35;
  let y1 = maxY, y2 = maxY;
  while (y1 > 0 && rowInk[y1] >= cutoff) y1--;
  while (y2 < H-1 && rowInk[y2] >= cutoff) y2++;

  const pad = Math.round(H * 0.08);
  y1 = Math.max(0, y1 - pad);
  y2 = Math.min(H - 1, y2 + pad);
  const h = Math.max(4, y2 - y1 + 1);

  // crop
  const out = document.createElement('canvas');
  out.width = W; out.height = h;
  out.getContext('2d').drawImage(canvas, 0, y1, W, h, 0, 0, W, h);
  return out;
}
const toDataURL = c => c.toDataURL('image/png');

//////////////////////////////
// 3) OCR call with whitelist
//////////////////////////////
async function ocrStrict(url, { whitelist, psm = 'SINGLE_LINE' } = {}) {
  const T = await ensureTesseract();
  const PSM = Tesseract.PSM;
  const pageSegMode = PSM[psm] ?? PSM.SINGLE_LINE;

  const params = {
    tessedit_pageseg_mode: pageSegMode,
    tessedit_char_whitelist: whitelist || '',
    classify_bln_numeric_mode: '1',  // 숫자 우선
    preserve_interword_spaces: '1'
  };
  const res = await Tesseract.recognize(url, 'eng+kor', params);
  return res?.data?.text || '';
}

//////////////////////////////
// 4) Layout ROIs
//////////////////////////////
function roisDaily(w, h) {
  const top  = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.88), h: Math.round(h*0.26) };
  const barY = Math.round(h*0.48), barH = Math.round(h*0.17);
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88);
  const cellW = Math.round(barW / 3);
  return {
    top,
    pace: { x: barX + 0*cellW, y: barY, w: cellW, h: barH },
    time: { x: barX + 1*cellW, y: barY, w: cellW, h: barH },
  };
}
function roisMonthly(w, h) {
  // 월간도 상단 합계 + 하단 3열( Runs / Avg. Pace / Time )
  const top  = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.88), h: Math.round(h*0.26) };
  const barY = Math.round(h*0.50), barH = Math.round(h*0.18);
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88);
  const cellW = Math.round(barW / 3);
  return {
    top,
    runs: { x: barX + 0*cellW, y: barY, w: cellW, h: barH },
    pace: { x: barX + 1*cellW, y: barY, w: cellW, h: barH },
    time: { x: barX + 2*cellW, y: barY, w: cellW, h: barH },
  };
}

//////////////////////////////
// 5) Parsers
//////////////////////////////
function normQuotes(s) {
  return String(s || '')
    .replace(/[’'′]/g, ':')
    .replace(/[″"]/g, ':')
    .replace(/：/g, ':')
    .replace(/[lI]/g, '1');  // I/l -> 1
}
function parseDistance(s) {
  const m = String(s || '').replace(/,/g, '.').match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
  return m ? parseFloat(m[1]) : null;
}
function parsePace(s) {
  const t = normQuotes(s);
  const m = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  return m ? { min:+m[1], sec:+m[2] } : { min:null, sec:null };
}
function parseTime(s) {
  const t = normQuotes(s);
  const hms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms  = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

//////////////////////////////
// 6) Public API
//////////////////////////////
export async function extractAll(imgDataURL, { recordType = 'daily' } = {}) {
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;

  // ROI 선택
  const R = recordType === 'monthly' ? roisMonthly(w,h) : roisDaily(w,h);

  // ---- Distance (top) ----
  let topC = drawCrop(img, R.top.x, R.top.y, R.top.w, R.top.h, 2.8);

  // 상단 우측 로고(예: GARMIN) 마스킹: 오른쪽 상단 30% x 40% 영역 흰색
  maskRect(topC, Math.round(topC.width*0.60), Math.round(topC.height*0.00),
                Math.round(topC.width*0.38), Math.round(topC.height*0.40), 255);

  topC = binarizeAuto(topC, +5);             // 자동 이분화(조금 밝게)
  topC = trimToStrongestTextLine(topC);      // 숫자 라인만 추림

  const kmTxt = await ocrStrict(toDataURL(topC), {
    whitelist: '0123456789.',
    psm: 'SINGLE_LINE'
  });
  const km = parseDistance(kmTxt);

  // ---- Pace & Time (하단 3열 중 좌/중 or 월간은 중/우) ----
  const paceBox = R.pace, timeBox = R.time;

  let paceC = drawCrop(img, paceBox.x, paceBox.y, paceBox.w, paceBox.h, 2.8);
  let timeC = drawCrop(img, timeBox.x, timeBox.y, timeBox.w, timeBox.h, 2.8);

  paceC = binarizeAuto(paceC, +0);
  timeC = binarizeAuto(timeC, +0);

  // 숫자 라인만 남기기(라벨 제거)
  paceC = trimToStrongestTextLine(paceC);
  timeC = trimToStrongestTextLine(timeC);

  const paceTxt = await ocrStrict(toDataURL(paceC), {
    whitelist: '0123456789:',
    psm: 'SINGLE_LINE'
  });
  const timeTxt = await ocrStrict(toDataURL(timeC), {
    whitelist: '0123456789:',
    psm: 'SINGLE_LINE'
  });

  const { min:paceMin, sec:paceSec } = parsePace(paceTxt);
  const T = parseTime(timeTxt);

  // ---- Runs (monthly only) ----
  let runs = null;
  if (recordType === 'monthly' && R.runs) {
    let runsC = drawCrop(img, R.runs.x, R.runs.y, R.runs.w, R.runs.h, 2.8);
    runsC = binarizeAuto(runsC, +0);
    runsC = trimToStrongestTextLine(runsC);
    const runsTxt = await ocrStrict(toDataURL(runsC), {
      whitelist: '0123456789',
      psm: 'SINGLE_LINE'
    });
    const m = runsTxt.match(/\b(\d{1,3})\b/);
    if (m) runs = +m[1];
  }

  return {
    km: km ?? 0,
    runs,
    paceMin, paceSec,
    timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
  };
}
