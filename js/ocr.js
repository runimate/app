// js/ocr.js
// 단순+튼튼 OCR 파이프라인: 라벨 앵커 → ROI → 숫자 인식 (eng+kor 대응)

let T = null;
async function loadTesseract() {
  if (T) return T;
  // tesseract.js v2가 window.Tesseract로 로드되어 있다면 그걸 사용
  // (별도 CDN 스크립트를 index에 두지 않았다면 dynamic import)
  if (typeof window !== 'undefined' && window.Tesseract) {
    T = window.Tesseract;
  } else {
    T = await import('https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js');
    T = T.default || T;
  }
  return T;
}

// -------- 이미지 유틸 --------
function loadImage(dataURL) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = dataURL;
  });
}
function toCanvas(img, w = img.width, h = img.height) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently:true }).drawImage(img, 0, 0, w, h);
  return c;
}
function getImageData(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  return ctx.getImageData(0,0,canvas.width, canvas.height);
}
function putImageData(canvas, im) {
  canvas.getContext('2d').putImageData(im,0,0);
  return canvas;
}

// Otsu 동적 이진화
function otsuBinarize(canvas) {
  const im = getImageData(canvas);
  const d = im.data, N = d.length / 4;

  // 그레이스케일 & 히스토그램
  const hist = new Uint32Array(256);
  for (let i=0;i<N;i++){
    const r=d[i*4], g=d[i*4+1], b=d[i*4+2];
    const y = (r*0.299 + g*0.587 + b*0.114) | 0;
    hist[y]++; d[i*4]=d[i*4+1]=d[i*4+2]=y;
  }
  // Otsu
  let sum=0; for(let i=0;i<256;i++) sum += i*hist[i];
  let sumB=0, wB=0, wF=0, varMax=-1, thr=128;
  for(let t=0;t<256;t++){
    wB += hist[t]; if(!wB) continue;
    wF = N - wB; if(!wF) break;
    sumB += t*hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB*wF*(mB-mF)*(mB-mF);
    if (between > varMax){ varMax = between; thr = t; }
  }
  // 임계값 적용
  for (let i=0;i<N;i++){
    const y = d[i*4]; const v = (y>thr)?255:0;
    d[i*4]=d[i*4+1]=d[i*4+2]=v;
  }
  return putImageData(canvas, im).toDataURL('image/png');
}

// -------- 텍스트 정규화/파서 --------
function norm(s){ 
  return (s||'')
    .replace(/[\u2018\u2019\u2032\u2035‘’′]/g,"'")   // prime
    .replace(/[\u201C\u201D\u2033\u3011\u3010“”″]/g,'"') // double prime
    .replace(/[：﹕:]/g,':')
    .replace(/\s+/g,' ')
    .trim();
}
function parsePace(text){
  const t = norm(text).toLowerCase();
  // 6'22", 6:22, 6’22″
  const m1 = t.match(/(\d{1,2})\s*[:'"]\s*(\d{2})/);
  if (m1) return {min:+m1[1], sec:+m1[2]};
  // 6분22초 (한글)
  const m2 = t.match(/(\d{1,2})\s*분\s*(\d{1,2})\s*초/);
  if (m2) return {min:+m2[1], sec:+m2[2]};
  return {min:null, sec:null};
}
function parseTime(text){
  const t = norm(text).toLowerCase();
  // h m s 패턴 (콜론 오인식 보호)
  let m = t.match(/(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*(\d{1,2})\s*s/);
  if (m) return {raw:`${+m[1]}:${String(+m[2]).padStart(2,'0')}:${String(+m[3]).padStart(2,'0')}`, H:+m[1], M:+m[2], S:+m[3]};
  // mm:ss
  m = t.match(/(\d{1,2})\s*:\s*(\d{2})\b/);
  if (m) return {raw:`${+m[1]}:${m[2]}`, H:null, M:+m[1], S:+m[2]};
  // hh:mm:ss
  m = t.match(/(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})/);
  if (m) return {raw:`${+m[1]}:${m[2]}:${m[3]}`, H:+m[1], M:+m[2], S:+m[3]};
  return {raw:null, H:null, M:null, S:null};
}
const secOf = (H,M,S)=> (H||0)*3600 + (M||0)*60 + (S||0);

// -------- OCR 헬퍼 --------
async function ocrWords(dataURL, psm='SPARSE_TEXT'){
  const TT = await loadTesseract();
  const res = await TT.recognize(dataURL, 'eng+kor', {
    tessedit_pageseg_mode: TT.PSM[psm] ?? TT.PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1'
  });
  return res.data.words || [];
}
async function ocrLineDigits(dataURL, whitelist="0123456789:'″\" ", psm='SINGLE_LINE'){
  const TT = await loadTesseract();
  const res = await TT.recognize(dataURL, 'eng+kor', {
    tessedit_pageseg_mode: TT.PSM[psm] ?? TT.PSM.SINGLE_LINE,
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: '1',
    classify_bln_numeric_mode: '1'
  });
  return (res.data.text || '').trim();
}

// 단어 배열에서 앵커 찾기
function findAnchor(words, patterns){
  const rx = new RegExp(patterns.join('|'), 'i');
  const hits = words.filter(w => rx.test((w.text||'').trim()));
  if (!hits.length) return null;
  // 가장 큰 폰트/가장 높은 confidence 우선
  hits.sort((a,b)=>{
    const ha = (a.bbox ? (a.bbox.y1 - a.bbox.y0) : 0);
    const hb = (b.bbox ? (b.bbox.y1 - b.bbox.y0) : 0);
    return (hb - ha) || ((b.confidence||0)-(a.confidence||0));
  });
  return hits[0];
}
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// 앵커 기준 ROI 계산 (앵커 "아래 라벨" 가정: 숫자는 라벨의 위쪽 큰 텍스트)
function roiAbove(anchor, padX, padY, canvasW, canvasH, heightMul=1.4){
  if (!anchor || !anchor.bbox) return null;
  const {x0,x1,y0,y1} = anchor.bbox;
  const w = x1 - x0;
  const h = y1 - y0;
  const cx0 = clamp(x0 - padX, 0, canvasW-1);
  const cx1 = clamp(x1 + padX, 0, canvasW-1);
  const cy1 = clamp(y0 - padY, 0, canvasH-1);
  const cy0 = clamp(cy1 - Math.max(h*heightMul, h*1.0), 0, canvasH-1);
  return {x:cx0, y:cy0, w:(cx1-cx0), h:(cy1-cy0)};
}
function cropCanvas(canvas, box){
  if (!box) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(box.w)); 
  c.height= Math.max(1, Math.floor(box.h));
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
  return c;
}

// 최상단 큰 거리 숫자: 상단 45% 영역에서 가장 큰 숫자 라인 추출(앵커 실패 시)
async function fallbackTopDistance(canvas){
  const hCut = Math.floor(canvas.height * 0.45);
  const c = cropCanvas(canvas, {x: Math.floor(canvas.width*0.06), y: Math.floor(canvas.height*0.06), w: Math.floor(canvas.width*0.88), h: hCut});
  if (!c) return null;
  const binURL = otsuBinarize(c);
  const text = await ocrLineDigits(binURL, "0123456789.,", 'SINGLE_LINE');
  const m = text.match(/\b\d{1,3}[.,]\d{1,2}\b/);
  return m ? parseFloat(m[0].replace(',','.')) : null;
}

// -------- 메인: 추출 --------
export async function extractAll(imgDataURL, {recordType} = {recordType:'daily'}){
  await loadTesseract();

  const img = await loadImage(imgDataURL);
  const base = toCanvas(img);
  const W = base.width, H = base.height;

  // 1) 전체에서 단어 인식(원본, Otsu 두 번)
  const wordsRaw = await ocrWords(base.toDataURL(), 'SPARSE_TEXT');
  const wordsBin = await ocrWords(otsuBinarize(toCanvas(img)), 'SPARSE_TEXT');
  const words = [...wordsRaw, ...wordsBin];

  // 2) 앵커 찾기
  const aKM   = findAnchor(words, ['Kilometers','Kilometer','킬로미터']);
  const aPACE = findAnchor(words, ['Avg\\.\\s*Pace','Pace','페이스','평균\\s*페이스','/km']);
  const aTIME = findAnchor(words, ['Time','시간']);

  // 3) 각 ROI를 앵커 기준으로 자르기 (위쪽 큰 숫자 라인)
  const padX = Math.round(W*0.02), padY = Math.round(H*0.01);
  const rKm  = roiAbove(aKM,   padX, padY, W, H, 1.6);
  const rPac = roiAbove(aPACE, padX, padY, W, H, 1.4);
  const rTim = roiAbove(aTIME, padX, padY, W, H, 1.4);

  const getTextFromROI = async (roi, whitelist) => {
    if (!roi) return '';
    const c = cropCanvas(base, roi);
    const binURL = otsuBinarize(c);
    // 원본/이진 2 패스로 시도
    const t1 = await ocrLineDigits(c.toDataURL(), whitelist);
    const t2 = await ocrLineDigits(binURL, whitelist);
    return (t1 && t1.length >= t2.length) ? t1 : t2;
  };

  // 4) km / pace / time 인식
  let kmText = await getTextFromROI(rKm, "0123456789.,");
  let km = null;
  const mkm = (kmText||'').match(/\b\d{1,3}[.,]\d{1,2}\b/);
  if (mkm) km = parseFloat(mkm[0].replace(',','.'));
  if (km==null){ km = await fallbackTopDistance(base); }

  const paceText = await getTextFromROI(rPac, "0123456789:'″\" ");
  const {min:paceMin_raw, sec:paceSec_raw} = parsePace(paceText);
  let paceMin = paceMin_raw, paceSec = paceSec_raw;

  const timeText = await getTextFromROI(rTim, "0123456789: hms");
  let Tm = parseTime(timeText);
  // 짧은 러닝인데 h가 들어간 경우 mm:ss로 재해석
  if (Tm.H!=null && km!=null && km < 20 && Tm.H >= 3){
    const fixed = timeText.replace(/[hms]/g, ':').replace(/::+/g,':');
    const alt = parseTime(fixed);
    if (alt.raw) Tm = alt;
  }

  // 5) 일관성 체크(±20%): time ≈ pace × km
  const paceSec = (paceMin!=null && paceSec!=null) ? (paceMin*60 + paceSec) : null;
  const timeSec = (Tm.raw ? secOf(Tm.H, Tm.M, Tm.S) : null);
  if (km!=null && paceSec && timeSec){
    const expect = km * paceSec;
    const tol = Math.max(30, expect*0.2);
    const err = Math.abs(timeSec - expect);
    if (err > tol){
      // 시간 재시도(다른 PSM)
      const timeText2 = await getTextFromROI(rTim, "0123456789: ", 'SINGLE_WORD');
      const tAlt = parseTime(timeText2);
      const altSec = tAlt.raw ? secOf(tAlt.H, tAlt.M, tAlt.S) : null;
      if (altSec && Math.abs(altSec - expect) < err){ Tm = tAlt; }
    }
  }

  // 6) 결과 조립
  const out = {
    km: km || 0,
    paceMin: paceMin ?? null,
    paceSec: paceSec ?? null,
    timeH: Tm.H, timeM: Tm.M, timeS: Tm.S, timeRaw: Tm.raw || null,
    runs: null
  };

  // 디버깅 힌트(선택): #cv-hint에 표기
  const hintEl = document.getElementById('cv-hint');
  if (hintEl) {
    const p = (out.paceMin!=null && out.paceSec!=null) ? `${out.paceMin}:${String(out.paceSec).padStart(2,'0')}` : '--';
    hintEl.style.display = 'block';
    hintEl.textContent = `OCR km=${out.km ?? '--'} pace=${p} time=${out.timeRaw ?? '--'}`;
  }

  return out;
}

export default { extractAll };
