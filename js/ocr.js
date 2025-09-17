// js/ocr.js  — ES Module

// 1) Tesseract 보장: window.Tesseract 없으면 CDN 로드 시도
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

// 2) 캔버스/전처리 유틸 (심플)
function toImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function drawCrop(img, x, y, w, h, scale = 2.0) {
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
const dataURL = (canvas) => canvas.toDataURL('image/png');

// 3) 간단 OCR 호출
async function ocr(url, opts) {
  const T = await ensureTesseract();
  const res = await Tesseract.recognize(url, 'eng+kor', opts || {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1'
  });
  return res?.data?.text || '';
}

// 4) NRC 기본 레이아웃 기준 ROI (퍼센트)
function rois(w, h) {
  // 상단 큰 거리
  const top = { x: Math.round(w*0.07), y: Math.round(h*0.07), w: Math.round(w*0.86), h: Math.round(h*0.24) };
  // 하단 3열
  const bar = { x: Math.round(w*0.06), y: Math.round(h*0.48), w: Math.round(w*0.88), h: Math.round(h*0.16) };
  const cellW = Math.round(bar.w / 3);
  const pace = { x: bar.x + 0*cellW, y: bar.y, w: cellW, h: bar.h };
  const time = { x: bar.x + 1*cellW, y: bar.y, w: cellW, h: bar.h };
  return { top, pace, time };
}

// 5) 파서들
function parseDistance(s) {
  const m = s.replace(/,/g, '.').match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
  return m ? parseFloat(m[1]) : null;
}
function parsePace(s) {
  const t = s.replace(/[’'′]/g, ':').replace(/″|"/g, ':').replace(/：/g, ':');
  const m = t.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return { min:null, sec:null };
  return { min: +m[1], sec: +m[2] };
}
function parseTime(s) {
  const t = s.replace(/[’'′]/g, ':').replace(/：/g, ':');
  const hms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (hms) return { raw: `${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (ms)  return { raw: `${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

// 6) 공개 API
export async function extractAll(imgDataURL, { recordType } = { recordType:'daily' }) {
  try {
    const img = await toImage(imgDataURL);
    const { width:w, height:h } = img;
    const { top, pace, time } = rois(w, h);

    // 거리
    const topC = binarize(drawCrop(img, top.x, top.y, top.w, top.h, 2.6), 190);
    const kmTxt = await ocr(dataURL(topC), { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
    const km = parseDistance(kmTxt);

    // 페이스/시간
    const paceC = binarize(drawCrop(img, pace.x, pace.y, pace.w, pace.h, 2.6), 185);
    const timeC = binarize(drawCrop(img, time.x, time.y, time.w, time.h, 2.6), 185);

    const paceTxt = await ocr(dataURL(paceC), { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
    const timeTxt = await ocr(dataURL(timeC), { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });

    const { min:paceMin, sec:paceSec } = parsePace(paceTxt);
    const T = parseTime(timeTxt);

    return {
      km: km ?? 0,
      runs: null,
      paceMin, paceSec,
      timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
    };
  } catch (e) {
    // 호출측에 원인 전달
    throw e;
  }
}
