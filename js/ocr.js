/* OCR/전처리/파싱 전용 — 이 파일만 수정하면 정확도 개선 가능 */
/* Tesseract는 필요할 때만 지연 로딩 */

export async function ensureTesseract(){
  if (window.Tesseract) return;
  await new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ===== 문자열 정규화/시간 유틸 ===== */
export const normalizeOCR = (s) => (s||'')
  .replace(/[\u2018\u2019\u2032\u2035]/g,"'")
  .replace(/[\u201C\u201D\u2033]/g,'"')
  .replace(/[·•‧∙]/g,'.')
  .replace(/[︰﹕：ː]/g,':')
  .replace(/\u200B|\u00A0/g,' ')
  .replace(/[ ]{2,}/g,' ')
  .trim();

export function parseTimeToSec(t){
  if(!t) return NaN;
  const parts = t.split(':').map(n=>parseInt(n,10));
  if(parts.length===2) return parts[0]*60 + parts[1];
  if(parts.length===3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return NaN;
}

/* ===== Canvas 전처리/ROI ===== */
export async function toCanvas(dataURL){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>res({img, w:img.width, h:img.height});
    img.src = dataURL;
  });
}
export async function preprocessImageToDataURL(imgDataURL, scale=2.4, threshold=190){
  const {img, w:W, h:H} = await toCanvas(imgDataURL);
  const w = Math.round(W*scale), h = Math.round(H*scale);
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img,0,0,w,h);
  const im = ctx.getImageData(0,0,w,h); const d=im.data;
  for(let i=0;i<d.length;i+=4){
    const gray = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    const v = gray > threshold ? 255 : 0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return c.toDataURL('image/png');
}
export async function unsharp(srcDataURL, amount=0.9){
  const {img,w,h} = await toCanvas(srcDataURL);
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const im=ctx.getImageData(0,0,w,h);
  const d=im.data;
  for(let y=0;y<h;y++){
    for(let x=1;x<w;x++){
      const i=(y*w+x)*4, j=(y*w+x-1)*4;
      d[i]   = Math.min(255, Math.max(0, d[i]   + amount*(d[i]   - d[j])));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + amount*(d[i+1] - d[j+1])));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + amount*(d[i+2] - d[j+2])));
    }
  }
  ctx.putImageData(im,0,0);
  return c.toDataURL('image/png');
}
export async function cropTopNumberROI(imgDataURL, topPct=0.06, heightPct=0.30, sidePct=0.06, scale=2.8){
  const {img, w, h} = await toCanvas(imgDataURL);
  const x = Math.round(w*sidePct), y = Math.round(h*topPct);
  const cw = Math.round(w*(1-2*sidePct)), ch = Math.round(h*heightPct);
  const c = document.createElement('canvas');
  c.width = Math.round(cw*scale); c.height = Math.round(ch*scale);
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, cw, ch, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
export async function cropStatsROI(imgDataURL, topPct=0.40, heightPct=0.45, sidePct=0.06, scale=2.4){
  const {img, w, h} = await toCanvas(imgDataURL);
  const x = Math.round(w*sidePct), y = Math.round(h*topPct);
  const cw = Math.round(w*(1-2*sidePct)), ch = Math.round(h*heightPct);
  const c = document.createElement('canvas');
  c.width = Math.round(cw*scale); c.height = Math.round(ch*scale);
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, cw, ch, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
export async function cropStatsCellROI(imgDataURL, colIndex=0, topPct=0.52, heightPct=0.14, sidePct=0.06, scale=2.6){
  const {img, w, h} = await toCanvas(imgDataURL);
  const x0 = Math.round(w*sidePct), y  = Math.round(h*topPct);
  const cw = Math.round(w*(1-2*sidePct)), ch = Math.round(h*heightPct);
  const cellW = Math.round(cw/3);
  const x = x0 + cellW*colIndex;
  const c = document.createElement('canvas');
  c.width = Math.round(cellW*scale); c.height= Math.round(ch*scale);
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, cellW, ch, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/* ===== 수치 추출/후보 ===== */
export function numsFromText(s){
  const t = normalizeOCR(s||'');
  const m = t.match(/\b\d{1,3}[.,]\d{1,2}\b/g) || [];
  return m.map(x => ({ val: parseFloat(x.replace(',','.')), dec: (x.split(/[.,]/)[1]||'').length }));
}
export function kmCandidatesFromWords(words){
  if(!Array.isArray(words) || !words.length) return [];
  const lines = new Map();
  for(const w of words){
    const id = w.line ?? `y${Math.round(((w.bbox?.y0||0)+(w.bbox?.y1||0))/2)}`;
    const h  = (w.bbox ? Math.max(0,(w.bbox.y1 - w.bbox.y0)) : 0);
    const y  = (w.bbox ? (w.bbox.y0 + w.bbox.y1)/2 : 0);
    const t  = (w.text||'').trim();
    if(!lines.has(id)) lines.set(id, { text:[], maxH:0, y:Infinity });
    const L = lines.get(id);
    L.text.push(t);
    L.maxH = Math.max(L.maxH, h);
    L.y    = Math.min(L.y, y);
  }
  const arr = [...lines.values()];
  arr.sort((a,b)=> (a.y - b.y) || (b.maxH - a.maxH));
  const top = arr.slice(0, 4);
  const out = [];
  for(const L of top){
    const joined = L.text.join(' ');
    const onlyNum = L.text.filter(t=>/^[0-9.,]+$/.test(t)).join('');
    const c1 = numsFromText(joined);
    const c2 = numsFromText(onlyNum);
    c1.concat(c2).forEach(o=> out.push({ ...o, src:'word-top', score:L.maxH }));
  }
  return out;
}

function normColon(s){
  return (s||'').replace(/[’'′]/g, ':').replace(/[″"]/g, ':').replace(/：/g, ':').replace(/\s+/g,'').trim();
}
function parseTimeLike(s){
  const t = normColon(s);
  const m3 = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if(m3) return {h:+m3[1], m:+m3[2], s:+m3[3]};
  const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
  if(m2) return {h:0, m:+m2[1], s:+m2[2]};
  return null;
}

/* ===== Pace/Time 텍스트 파싱 ===== */
export function extractPace(text){
  const T = normalizeOCR(text);
  const labelIdx = (() => {
    const patterns = [/avg\.?\s*pace/i, /average\s*pace/i, /\bpace\b/i, /평균\s*페이스/i, /\b페이스\b/i];
    for (const re of patterns){
      const m = T.match(re);
      if (m) return m.index;
    }
    const kmPos = T.indexOf('/km');
    if (kmPos>-1) return Math.max(0, kmPos-40);
    const korKmPos = T.indexOf('분/km');
    if (korKmPos>-1) return Math.max(0, korKmPos-40);
    return -1;
  })();
  const scope = labelIdx>-1 ? T.slice(Math.max(0,labelIdx-20), labelIdx+120) : T;
  const patterns = [
    /(\d{1,2})\s*'\s*(\d{2})\s*"?/,
    /(\d{1,2})\s*:\s*(\d{2})(?=\s*\/?\s*km|\b)/,
    /(\d{1,2})\s*분\s*(\d{1,2})\s*초/,
  ];
  for (const re of patterns){
    const m = scope.match(re);
    if (m){
      const mm = parseInt(m[1],10);
      const ss = parseInt(m[2],10);
      if (!Number.isNaN(mm) && !Number.isNaN(ss)) return {min:mm, sec:ss};
    }
  }
  return {min:null, sec:null};
}
export function extractTime(text){
  const T = normalizeOCR(text);
  const idx = (() => {
    const patterns = [/time\b/i, /elapsed/i, /duration/i, /총?\s*시간/, /\b시간\b/];
    for (const re of patterns){ const m=T.match(re); if(m) return m.index; }
    return -1;
  })();
  const scope = idx>-1 ? T.slice(Math.max(0, idx-20), idx+120) : T;
  let m = scope.match(/\b(\d{1,2})\D{0,2}(\d{2})\D{0,2}(\d{2})\b/);
  if(m){ return {raw:`${zero2(m[1])}:${zero2(m[2])}:${zero2(m[3])}`, H:+m[1], M:+m[2], S:+m[3]}; }
  m = scope.match(/\b(\d{1,2})\D{0,2}(\d{2})\b/);
  if(m){ return {raw:`${zero2(m[1])}:${zero2(m[2])}`, H:null, M:+m[1], S:+m[2]}; }
  return {raw:null, H:null, M:null, S:null};
}
const zero2 = (n)=>String(n).padStart(2,'0');

/* ===== 후보 스코어링/판정 ===== */
export function groupScores(cands){
  const m=new Map();
  for(const c of cands){
    const key=(Math.round(c.val*100)/100).toFixed(2);
    const s=(c.score||0)+ (String(c.src||'').includes('roi')?4:0);
    m.set(key,(m.get(key)||0)+s);
  }
  return m;
}
export function bestScoreAround(scoresMap, center, tol=0.25){
  let best=0;
  for(const [k,v] of scoresMap){
    const x=parseFloat(k); if(Math.abs(x-center)<=tol) best=Math.max(best,v);
  }
  return best;
}
function pickBestKm(cands, recordType, estDistance){
  if(!cands || !cands.length) return null;
  const preferDec = (recordType==='monthly') ? 1 : 2;
  const groups = new Map();
  for(const c of cands){
    const key = (Math.round(c.val*100)/100).toFixed(2);
    if(!groups.has(key)) groups.set(key, { val:parseFloat(key), count:0, roi:0, decHits:0, score:0 });
    const g = groups.get(key);
    g.count++;
    if(String(c.src||'').includes('roi')) g.roi += 1;
    g.decHits += (c.dec===preferDec) ? 2 : 0.5;
    g.score += (c.score||0);
  }
  const ranked = [...groups.values()].sort((a,b)=>{
    return (b.roi - a.roi) || (b.decHits - a.decHits) || (b.count - a.count) || (b.score - a.score);
  });
  if (ranked.length >= 2 && estDistance!=null){
    const [a,b] = ranked;
    const d1 = Math.abs(a.val - estDistance), d2 = Math.abs(b.val - estDistance);
    if (Math.abs(d1 - d2) > 0.12) return d1 < d2 ? a.val : b.val;
  }
  return ranked[0]?.val ?? null;
}

/* ===== OCR(칸별) ===== */
export async function ocrPaceTimePrecise(imgDataURL){
  await ensureTesseract();
  const [paceROI, timeROI] = await Promise.all([
    cropStatsCellROI(imgDataURL, 0, 0.52, 0.14, 0.06, 2.6),
    cropStatsCellROI(imgDataURL, 1, 0.52, 0.14, 0.06, 2.6)
  ]);
  const [paceBin, timeBin] = await Promise.all([
    preprocessImageToDataURL(paceROI, 1.0, 190),
    preprocessImageToDataURL(timeROI, 1.0, 190)
  ]);
  const paceRes = await window.Tesseract.recognize(paceBin, 'eng', {
    tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_LINE,
    tessedit_char_whitelist: "0123456789:'″\" ",
    preserve_interword_spaces: '1'
  });
  const pTxt = paceRes.data.text || '';
  const pT = parseTimeLike(pTxt.replace(/'/g,':').replace(/″|"/g,':'));
  const paceSec = pT ? (pT.m*60 + pT.s) : NaN;

  const timeRes = await window.Tesseract.recognize(timeBin, 'eng', {
    tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_LINE,
    tessedit_char_whitelist: "0123456789: ",
    preserve_interword_spaces: '1'
  });
  const tTxt = timeRes.data.text || '';
  const tT = parseTimeLike(tTxt);
  const timeSec = tT ? (tT.h*3600 + tT.m*60 + tT.s) : NaN;

  return {
    paceSec: isFinite(paceSec) ? paceSec : NaN,
    timeSec: isFinite(timeSec) ? timeSec : NaN,
    paceRaw: pT ? `${pT.m}:${zero2(pT.s)}` : null,
    timeRaw: tT ? (tT.h>0 ? `${tT.h}:${zero2(tT.m)}:${zero2(tT.s)}` : `${tT.m}:${zero2(tT.s)}`) : null
  };
}

/* ===== km 후보(멀티패스) ===== */
const KM_LINE_OCR_OPTS_7 = { tessedit_pageseg_mode: 7, tessedit_char_whitelist: '0123456789.,', classify_bln_numeric_mode: '1' };
const KM_LINE_OCR_OPTS_8 = { tessedit_pageseg_mode: 8, tessedit_char_whitelist: '0123456789.,', classify_bln_numeric_mode: '1' };

export async function multiPassKmCandidates_FAST(imgDataURL){
  await ensureTesseract();
  const out = [];
  const roi0 = await cropTopNumberROI(imgDataURL, 0.06, 0.30, 0.06, 2.8);
  const roi1 = await unsharp(roi0, 0.9);
  const roi2 = await preprocessImageToDataURL(roi1, 1.0, 190);

  const [rA, rB, rC] = await Promise.all([
    window.Tesseract.recognize(roi1, 'eng', KM_LINE_OCR_OPTS_7),
    window.Tesseract.recognize(roi2, 'eng', KM_LINE_OCR_OPTS_7),
    window.Tesseract.recognize(roi2, 'eng', KM_LINE_OCR_OPTS_8)
  ]);

  [['roiA',rA],['roiB',rB],['roiC',rC]].forEach(([tag,res])=>{
    const conf = (res.data?.confidence ?? 60)/100;
    numsFromText(res.data.text).forEach(o=> out.push({ ...o, src:`${tag}-text`, score:(o.score||0)+conf*12 }));
    kmCandidatesFromWords(res.data.words).forEach(o=> out.push({ ...o, src:`${tag}-words`, score:(o.score||0)+conf*12 }));
  });

  return { cands: out, roiBin: roi2 };
}

/* 2/3 → 5 가드용 */
export async function recognizeLeadingChar(roiBinDataURL){
  await ensureTesseract();
  const {img,w,h} = await toCanvas(roiBinDataURL);
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  function colBlackCount(x){ let s=0; for(let y=0;y<h;y++){ if(ctx.getImageData(x,y,1,1).data[0]<128) s++; } return s; }
  let L=0; const need = Math.max(3, Math.floor(h*0.12));
  for(let x=0;x<w;x++){ if(colBlackCount(x)>need){ L=x; break; } }
  const digitW = Math.max(8, Math.floor(w*0.18));
  const R = Math.min(w-1, L+digitW);

  const cc=document.createElement('canvas');
  cc.width = R-L+1; cc.height = h;
  cc.getContext('2d').drawImage(c, L, 0, R-L+1, h, 0, 0, R-L+1, h);
  const cropURL = cc.toDataURL('image/png');

  const charRes = await window.Tesseract.recognize(cropURL, 'eng', {
    tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_CHAR,
    tessedit_char_whitelist: '235',
    classify_bln_numeric_mode: '1'
  });
  const ch = (charRes.data.text||'').trim().charAt(0) || '';
  const conf = Number(charRes.data.confidence ?? 0);
  return { ch, conf };
}
export async function looksLikeLeadingFive(roiBinDataURL){
  const {img,w,h} = await toCanvas(roiBinDataURL);
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const im=ctx.getImageData(0,0,w,h).data;

  function colBlackCount(x){ let s=0; for(let y=0;y<h;y++){ if(im[(y*w+x)*4]<128) s++; } return s; }
  let L=0; const need = Math.max(3, Math.floor(h*0.12));
  for(let x=0;x<w;x++){ if(colBlackCount(x)>need){ L=x; break; } }
  const digitW = Math.max(8, Math.floor(w*0.18));
  const R = Math.min(w-1, L+digitW);

  function bandDensity(y0,y1){
    let black=0; const total=(y1-y0)*(R-L+1);
    for(let y=y0; y<y1; y++){
      for(let x=L; x<=R; x++){ if(im[(y*w+x)*4]<128) black++; }
    }
    return black/Math.max(1,total);
  }
  const topDensity = bandDensity(0, Math.floor(h*0.14));
  const midDensity = bandDensity(Math.floor(h*0.47), Math.floor(h*0.62));

  let leftVert=0, total=0;
  const vx0 = Math.min(R, L + Math.max(2, Math.floor(digitW*0.18)));
  for(let y=Math.floor(h*0.35); y<Math.floor(h*0.85); y++){
    total++;
    if(im[(y*w+vx0)*4] < 128) leftVert++;
  }
  const leftVertRatio = leftVert/Math.max(1,total);
  return (topDensity>0.62 && midDensity>0.46 && leftVertRatio>0.32);
}

/* ===== 텍스트 전체 파싱 ===== */
export function parseFromOCR(textRaw){
  const text = normalizeOCR(textRaw);
  const {min:paceMin, sec:paceSec} = extractPace(text);
  const T = extractTime(text);

  const runs = (() => {
    const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for(let i=0;i<lines.length;i++){
      const L = lines[i];
      if (/^(Runs?|러닝)\b/i.test(L)){
        const prev = lines[i-1]||"", next = lines[i+1]||"";
        let mm;
        if ((mm = prev.match(/^\s*(\d{1,3})\s*$/))) return +mm[1];
        if ((mm = next.match(/^\s*(\d{1,3})\s*$/))) return +mm[1];
        if ((mm = L.match(/\b(\d{1,3})\b/)))       return +mm[1];
      }
    }
    const pacePos = text.search(/\d{1,2}\s*[:'분]\s*\d{2}/);
    const scope2 = pacePos>0 ? text.slice(0, pacePos) : text;
    const cands = (scope2.match(/\b\d{1,3}\b/g) || []).map(s=>+s).filter(n=>n>=0 && n<=999);
    return cands.length ? cands[cands.length-1] : null;
  })();

  const re2dec  = /(\d{1,3})\s*[.,]\s*(\d{2})\b/;
  const re1dec  = /(\d{1,3})\s*[.,]\s*(\d{1})\b/;
  const reInt   = /\b(\d{1,3})\b/;

  function first2Dec(s){ const mm = s.match(re2dec); return mm ? `${mm[1]}.${mm[2]}` : null; }
  function first1Dec(s){ const mm = s.match(re1dec); return mm ? `${mm[1]}.${mm[2]}` : null; }
  function firstInt (s){ const mm = s.match(reInt ); return mm ? mm[1] : null; }

  let kmFromLabel = null;
  {
    const idx = text.search(/킬로미터|kilometer|distance|거리/i);
    if (idx !== -1) {
      const before = text.slice(Math.max(0, idx - 60), idx);
      kmFromLabel = first2Dec(before) || first1Dec(before) || firstInt(before);
    }
  }

  return {
    km: kmFromLabel,
    runs,
    paceMin: (paceMin??null), paceSec: (paceSec??null),
    timeH: T.H, timeM: T.M, timeS: T.S, timeRaw: T.raw
  };
}

/* ===== 파이프라인: 이미지 → 결과 ===== */
export async function extractAll(imgDataURL, { recordType }){
  await ensureTesseract();

  // 1) 상단 km 후보
  const fast = await multiPassKmCandidates_FAST(imgDataURL);
  let kmCandidates = fast.cands;
  const roiBinForFiveGuard = fast.roiBin;

  // 2) 하단 ROI + 칸별 Pace/Time 우선 추출
  const statsROI = await cropStatsROI(imgDataURL, 0.40, 0.45, 0.06, 2.2);
  const statsROIBin = await preprocessImageToDataURL(statsROI, 1.0, 190);
  const precise = await ocrPaceTimePrecise(imgDataURL);

  // 3) 백업: 전체 텍스트 OCR
  const [rFull, rStats] = await Promise.all([
    window.Tesseract.recognize(imgDataURL, 'eng+kor', { preserve_interword_spaces: '1', tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_BLOCK }),
    window.Tesseract.recognize(statsROIBin, 'eng+kor', { preserve_interword_spaces: '1', tessedit_pageseg_mode: window.Tesseract.PSM.SPARSE_TEXT })
  ]);
  const mergedText = (rFull.data.text || "") + "\n" + (rStats.data.text || "");
  const p = parseFromOCR(mergedText);

  // 레이블 근처 km도 후보 추가
  if(p.km){
    const val = parseFloat(String(p.km).replace(',','.'));
    if (isFinite(val)) kmCandidates.push({ val, dec: (String(p.km).split(/[.,]/)[1]||'').length, src:'aux-label' });
  }

  // 4) 예상 거리 추정값 (pace/time 기반)
  const paceSec = isFinite(precise.paceSec) ? precise.paceSec :
                  (p.paceMin!=null && p.paceSec!=null ? (p.paceMin*60 + p.paceSec) : NaN);
  const timeSec = isFinite(precise.timeSec) ? precise.timeSec :
                  (p.timeRaw ? parseTimeToSec(p.timeRaw) : NaN);
  const estDist = (isFinite(paceSec) && isFinite(timeSec) && recordType!=='monthly') ? (timeSec/paceSec) : null;

  // 5) km 최종 후보 선택
  let kmBest = pickBestKm(kmCandidates, recordType, estDist);

  // 6) 2/3 → 5 오인식 가드
  if (kmBest!=null){
    const intPart = Math.floor(kmBest);
    if (intPart===2 || intPart===3){
      const { ch:leadCh, conf:leadConf } = await recognizeLeadingChar(roiBinForFiveGuard).catch(()=>({ch:'',conf:0}));
      const looks5 = await looksLikeLeadingFive(roiBinForFiveGuard).catch(()=>false);

      const sMap = groupScores(kmCandidates);
      const s2 = bestScoreAround(sMap, 2.0, 0.25);
      const s3 = bestScoreAround(sMap, 3.0, 0.25);
      const s5 = bestScoreAround(sMap, 5.0, 0.25);

      const estNear5 = (estDist!=null && estDist>=4.85 && estDist<=5.30);
      const strongNotFive = (leadCh==='2' || leadCh==='3') && leadConf>=70;
      const allowFixToFive =
        (leadCh==='5' && leadConf>=82) ||
        (looks5 && estNear5 && (s5 > Math.max(s2,s3) + 6));
      if (!strongNotFive && allowFixToFive){
        kmBest = 5 + (kmBest - intPart);
      }
    }
  }

  // 7) 최종 km/pace/time 계산
  const hasOCRkm = isFinite(kmBest);
  let finalKm = 0;
  if (recordType === 'daily'){
    finalKm = hasOCRkm ? kmBest : 0;
  } else {
    const calcKm = (isFinite(timeSec) && isFinite(paceSec)) ? (timeSec/paceSec) : NaN;
    finalKm = hasOCRkm ? kmBest : (isFinite(calcKm) ? calcKm : 0);
  }

  const finalPace = isFinite(paceSec) ? paceSec
                     : (isFinite(timeSec) && finalKm>0 ? Math.round(timeSec/finalKm) : NaN);

  let showTimeRaw = null, tH=null, tM=null, tS=null;
  if (isFinite(timeSec)) {
    const H = Math.floor(timeSec/3600);
    const M = Math.floor((timeSec%3600)/60);
    const S = Math.floor(timeSec%60);
    showTimeRaw = H>0 ? `${H}:${zero2(M)}:${zero2(S)}` : `${M}:${zero2(S)}`;
    tH=H; tM=M; tS=S;
  } else if (p.timeRaw) {
    showTimeRaw = p.timeRaw; tH=p.timeH; tM=p.timeM; tS=p.timeS;
  }

  // Runs(월간) 보조 추출 (words 기반)
  function extractRunsFromWords(words){
    if(!Array.isArray(words) || !words.length) return null;
    const anchors = words.filter(w => {
      const t = (w.text||"").trim().toLowerCase();
      return t === 'runs' || t === '러닝';
    });
    const sameLineNear = (anchor)=>{
      const same = words.filter(w => w.line === anchor.line);
      const nums = same
        .filter(w => /^\d{1,3}$/.test((w.text||'').trim()))
        .map(w => ({
          n: +w.text.trim(),
          dx: Math.abs(((w.bbox&&w.bbox.x0)||0) - ((anchor.bbox&&anchor.bbox.x1)||0))
        }));
      if(nums.length){ nums.sort((a,b)=>a.dx-b.dx); return nums[0].n; }
      return null;
    };
    const picks = anchors.map(a=>sameLineNear(a)).filter(v=>Number.isInteger(v));
    if(!picks.length) return null;
    picks.sort((a,b)=>a-b);
    return picks[Math.floor(picks.length/2)];
  }
  const runsFromWords = extractRunsFromWords(rFull.data.words||[]);

  return {
    km: finalKm ?? 0,
    runs: (recordType==='monthly') ? (p.runs ?? runsFromWords ?? null) : null,
    paceMin: isFinite(finalPace) ? Math.floor(finalPace/60) : null,
    paceSec: isFinite(finalPace) ? (finalPace%60) : null,
    timeH: tH, timeM: tM, timeS: tS,
    timeRaw: showTimeRaw || null
  };
}
