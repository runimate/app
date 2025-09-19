// js/ocr.js — robust pass (distance/pace/time only)

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

// ---------- image utils ----------
function toImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}
function drawCrop(img, x, y, w, h, scale = 2.2) {
  const c = makeCanvas(w * scale, h * scale);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
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
const toURL = (c) => c.toDataURL('image/png');

// ---------- layout ROIs ----------
function rois(w, h) {
  // NOTE: top.w를 좁혀 우측의 GARMIN 박스를 배제
  const top = {
    x: Math.round(w * 0.06),
    y: Math.round(h * 0.06),
    w: Math.round(w * 0.72),       // ← 기존 0.86 → 0.72 (우측 28% 마스킹)
    h: Math.round(h * 0.24)
  };

  // 하단 3열 (NRC/가민 공통 배치에 맞춘 대략값)
  const bar = { x: Math.round(w*0.06), y: Math.round(h*0.48), w: Math.round(w*0.88), h: Math.round(h*0.16) };
  const cellW = Math.round(bar.w / 3);
  const pace = { x: bar.x + 0*cellW, y: bar.y, w: cellW, h: bar.h };
  const time = { x: bar.x + 1*cellW, y: bar.y, w: cellW, h: bar.h };

  return { top, pace, time };
}

// ---------- parsing ----------
function sanitizePunct(s){
  return String(s || '')
    .replace(/[’'′]/g, ':')   // minute mark → :
    .replace(/[″"]/g, ':')    // second mark → :
    .replace(/：/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}
function parseDistance(s) {
  const t = sanitizePunct(s).replace(/,/g, '.');
  const m = t.match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
  return m ? parseFloat(m[1]) : null;
}
function parsePace(s) {
  const t = sanitizePunct(s);
  const m = t.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return { min:null, sec:null };
  const mm = +m[1], ss = +m[2];
  if (mm < 2 || mm > 20 || ss > 59) return { min:null, sec:null };
  return { min:mm, sec:ss };
}
function parseTime(s) {
  const t = sanitizePunct(s);
  const hms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms  = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

// ---------- OCR core (multi-pass + whitelist) ----------
async function ocrLine(url, whitelist) {
  const T = await ensureTesseract();
  const baseCfg = {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    user_defined_dpi: '300',
    tessedit_char_whitelist: whitelist,
    load_system_dawg: 'F',
    load_freq_dawg: 'F'
  };
  // 한 번 더 강하게 숫자만
  const altCfg = {
    ...baseCfg,
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
  };

  // 4-pass: bin 165/185/205 + non-bin
  const results = [];
  const tryOne = async (url, cfg) => {
    const r = await Tesseract.recognize(url, 'eng', cfg);
    results.push({ text: r?.data?.text || '', conf: r?.data?.confidence ?? 0 });
  };
  await tryOne(url, baseCfg);

  // 비/가벼운 재시도를 위해 같은 이미지로 altCfg
  await tryOne(url, altCfg);

  return results.sort((a,b)=> (b.conf||0)-(a.conf||0))[0]; // 최고 confidence
}

async function ocrCandidatesFromCanvas(canvas, whitelist) {
  // 다양한 threshold로 만든 3장의 candidate + 원본 1장 => 각자 ocrLine
  const urls = [
    toURL(binarize(canvas.cloneNode(true), 165)),
    toURL(binarize(canvas.cloneNode(true), 185)),
    toURL(binarize(canvas.cloneNode(true), 205)),
    toURL(canvas) // non-binarized
  ];
  const outs = await Promise.all(urls.map(u => ocrLine(u, whitelist)));
  // 최고 conf 반환
  return outs.sort((a,b)=> (b.conf||0)-(a.conf||0))[0];
}

// ---------- public API ----------
export async function extractAll(imgDataURL, { recordType } = { recordType:'daily' }) {
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;
  const { top, pace, time } = rois(w, h);

  // distance (mask right-28% to avoid GARMIN)
  const topCrop = drawCrop(img, top.x, top.y, top.w, top.h, 2.6);
  // 추가 마스킹(혹시 남은 로고 영역 대비): 오른쪽 6% 더 잘라내기
  const mctx = topCrop.getContext('2d');
  mctx.fillStyle = '#fff';
  mctx.fillRect(Math.round(topCrop.width*0.94), 0, Math.round(topCrop.width*0.06), topCrop.height);

  const kmBest = await ocrCandidatesFromCanvas(topCrop, '0123456789.');
  const km = parseDistance(kmBest.text);

  // pace / time
  const paceCrop = drawCrop(img, pace.x, pace.y, pace.w, pace.h, 2.6);
  const timeCrop = drawCrop(img, time.x, time.y, time.w, time.h, 2.6);

  const paceBest = await ocrCandidatesFromCanvas(paceCrop, '0123456789:’′"');
  const timeBest = await ocrCandidatesFromCanvas(timeCrop, '0123456789:’′"');

  const { min:paceMin, sec:paceSec } = parsePace(paceBest.text);
  const T = parseTime(timeBest.text);

  return {
    km: km ?? 0,
    runs: (recordType === 'monthly') ? null : null,
    paceMin, paceSec,
    timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
  };
}
