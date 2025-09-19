// js/ocr.js — pace/time 특화 안정화 버전 (영/한 공용 레이아웃)
// 필요한 3개만 뽑음: km, pace(mm:ss), time(H:MM:SS | MM:SS)

/////////////////////////////
// 0) Tesseract 보장
/////////////////////////////
async function ensureTesseract () {
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

/////////////////////////////
// 1) 이미지/캔버스 유틸
/////////////////////////////
function toImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function drawCrop(img, x, y, w, h, scale = 2.8) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
function toGray(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    d[i] = d[i+1] = d[i+2] = g;
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}
function binarize(canvas, th = 185) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > th ? 255 : 0; // 이미 gray 가정
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}
const dataURL = (c) => c.toDataURL('image/png');

/////////////////////////////
// 2) ROIs (NRC/가민 카드 공통 비율)
//   - 상단 큰 "거리"
//   - 하단 3열(좌: Pace, 중: Time)
//   * 일부 스크린샷 편차를 흡수하도록 여백 확대
/////////////////////////////
function rois(w, h) {
  const top = {
    x: Math.round(w * 0.06),
    y: Math.round(h * 0.06),
    w: Math.round(w * 0.88),
    h: Math.round(h * 0.26),
  };
  const barY = Math.round(h * 0.47);
  const barH = Math.round(h * 0.19);
  const barX = Math.round(w * 0.06);
  const barW = Math.round(w * 0.88);
  const cellW = Math.round(barW / 3);

  const pace = { x: barX + 0 * cellW, y: barY, w: cellW, h: barH };
  const time = { x: barX + 1 * cellW, y: barY, w: cellW, h: barH };

  return { top, pace, time };
}

/////////////////////////////
// 3) OCR 래퍼 (화이트리스트 & 다중전처리)
/////////////////////////////
async function ocrLine(url, { whitelist = null, lang = 'eng', psm = 'SINGLE_LINE' } = {}) {
  const T = await ensureTesseract();
  const params = {
    preserve_interword_spaces: '1',
    tessedit_pageseg_mode: T.PSM[psm] ?? T.PSM.SINGLE_LINE,
  };
  if (whitelist) params.tessedit_char_whitelist = whitelist;

  const { data } = await Tesseract.recognize(url, lang, params);
  // text와 confidence를 함께 반환
  const text = (data?.text || '').trim();
  const conf = (data?.confidence ?? 0);
  return { text, conf };
}

async function ocrBestFromVariants(canvas, { whitelist, lang = 'eng' } = {}) {
  // pace/time는 작은 기호(′ ″ :) 보존이 중요 → 여러 임계값 시도
  const variants = [];
  const ths = [170, 185, 200];
  const gray = toGray(canvas);

  // 원본 회색, 임계값 3종
  variants.push(gray);
  ths.forEach(th => {
    const c = document.createElement('canvas');
    c.width = gray.width; c.height = gray.height;
    c.getContext('2d').drawImage(gray, 0, 0);
    variants.push(binarize(c, th));
  });

  // RAW_LINE 한 번, SINGLE_LINE 한 번 → 총 8패스까지
  const tries = [];
  for (const c of variants) {
    const url = dataURL(c);
    tries.push(ocrLine(url, { whitelist, lang, psm: 'RAW_LINE' }));
    tries.push(ocrLine(url, { whitelist, lang, psm: 'SINGLE_LINE' }));
  }

  // 가장 "그럴듯한" 문자열 선택: 숫자/콜론 비율 높고 길이 3~7, confidence 높은 것 우선
  const results = await Promise.all(tries);
  let best = { text: '', conf: -1, score: -1 };
  for (const r of results) {
    const t = r.text || '';
    const digits = (t.match(/[0-9]/g) || []).length;
    const colons = (t.match(/[:’'′″"]/g) || []).length;
    const len = t.length;
    const score = digits * 3 + colons * 2 + r.conf * 0.02 - Math.abs(len - 5); // 대략적인 휴리스틱
    if (score > best.score) best = { ...r, score };
  }
  return best.text;
}

/////////////////////////////
// 4) 파서 & 정규화
/////////////////////////////
function normPaceString(s) {
  if (!s) return '';
  return s
    // 흔한 잘못된 문자들을 콜론으로 통일
    .replace(/[’'′]/g, ':')
    .replace(/[“”″"]/g, ':')
    .replace(/：/g, ':')
    // 'O', 'o' → 0, 'l','I' → 1, 'S'→'5', 'B'→'8'
    .replace(/[Oo]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    // 숫자/콜론 외 제거 & 콜론 중복 정리
    .replace(/[^0-9:]/g, '')
    .replace(/:+/g, ':')
    .replace(/^:|:$/g, '');
}
function parsePaceStrict(s) {
  const t = normPaceString(s);
  const m = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return { min: null, sec: null, raw: t };

  let mm = +m[1], ss = +m[2];

  // 초가 60 이상으로 뜨면 흔한 오인식(7→1 등) 보정 시도
  if (ss >= 60 && ss <= 79) ss -= 20; // 72→52 같은 케이스 보정
  if (ss >= 60) ss = ss % 60;

  // '15:06'처럼 앞에 붙는 유령 '1' 보정 (정상 페이스 범위 고려)
  if (mm >= 13 && mm <= 21) {
    const mm2 = mm - 10;
    if (mm2 >= 3 && mm2 <= 12) mm = mm2;
  }

  // 최종 유효성 검사 (2:30~12:00/km를 합리 범위로)
  if (!(mm >= 2 && mm <= 12) || !(ss >= 0 && ss <= 59)) {
    return { min: null, sec: null, raw: t };
  }
  return { min: mm, sec: ss, raw: t };
}

function parseTimeFlexible(s) {
  if (!s) return { raw: null, H: null, M: null, S: null };
  const t = s
    .replace(/[’'′]/g, ':')
    .replace(/：/g, ':')
    .replace(/[Oo]/g, '0')
    .replace(/[lI]/g, '1');
  const hms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})\b/);
  if (hms) return { raw: `${+hms[1]}:${hms[2]}:${hms[3]}`, H: +hms[1], M: +hms[2], S: +hms[3] };
  const ms = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (ms)  return { raw: `${+ms[1]}:${ms[2]}`, H: null, M: +ms[1], S: +ms[2] };
  return { raw: null, H: null, M: null, S: null };
}

function parseDistanceStrict(s) {
  // 큰 거리 라인: 숫자와 점만 허용, 소수점 1~2자리
  const t = s.replace(/[^0-9.]/g, '').replace(/\.{2,}/g, '.');
  const m = t.match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
  return m ? parseFloat(m[1]) : null;
}

/////////////////////////////
// 5) 공개 API
/////////////////////////////
export async function extractAll(imgDataURL, { recordType } = { recordType: 'daily' }) {
  const img = await toImage(imgDataURL);
  const { width: w, height: h } = img;
  const { top, pace, time } = rois(w, h);

  // 5-1. 거리 (숫자+점만 화이트리스트, SINGLE_LINE)
  const topC = drawCrop(img, top.x, top.y, top.w, top.h, 2.6);
  toGray(topC);
  binarize(topC, 190);
  const topTxt = (await ocrLine(dataURL(topC), {
    whitelist: '0123456789.',
    lang: 'eng',
    psm: 'SINGLE_LINE'
  })).text;
  const km = parseDistanceStrict(topTxt);

  // 5-2. 페이스 (숫자+콜론만 허용, 다중 전처리 → 베스트 선택)
  const paceC = drawCrop(img, pace.x, pace.y, pace.w, pace.h, 3.0);
  const paceTxt = await ocrBestFromVariants(paceC, {
    whitelist: '0123456789:\'′″"',
    lang: 'eng' // 숫자/콜론만 필요해서 eng로 충분
  });
  const { min: paceMin, sec: paceSec } = parsePaceStrict(paceTxt);

  // 5-3. 시간 (숫자+콜론, SINGLE_LINE 우선)
  const timeC = drawCrop(img, time.x, time.y, time.w, time.h, 3.0);
  const timeRes = await ocrLine(dataURL(toGray(timeC)), {
    whitelist: '0123456789:',
    lang: 'eng',
    psm: 'SINGLE_LINE'
  });
  const T = parseTimeFlexible(timeRes.text);

  return {
    km: Number.isFinite(km) ? km : 0,
    runs: (recordType === 'monthly') ? null : null, // 월간은 별도 설계에 맞춰 확장
    paceMin: Number.isFinite(paceMin) ? paceMin : null,
    paceSec: Number.isFinite(paceSec) ? paceSec : null,
    timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
  };
}
