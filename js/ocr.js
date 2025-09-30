// js/ocr.js — FAST OCR (HTML 버전 파이프라인 이식, ES Module)

/* 1) Tesseract 보장 (v2 권장, 이미 로드되어 있으면 사용) */
async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // v2가 성능/호환이 좋아서 기본값을 v2로
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Tesseract.js v2'));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new Error('Tesseract failed to initialize');
  return window.Tesseract;
}

/* 2) 캔버스 유틸 */
function toImage(src){ return new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function cloneCanvas(src){ const c=makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src,0,0); return c; }
const toURL = (c)=>c.toDataURL('image/png');

async function toCanvas(imgDataURL){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res({img, w:img.width, h:img.height});
    img.src=imgDataURL;
  });
}
async function preprocessImageToDataURL(imgDataURL, scale = 2.4, threshold = 190){
  const {img, w:W, h:H} = await toCanvas(imgDataURL);
  const w = Math.round(W*scale), h = Math.round(H*scale);
  const c = makeCanvas(w,h);
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img,0,0,w,h);
  const im=ctx.getImageData(0,0,w,h), d=im.data;
  for(let i=0;i<d.length;i+=4){
    const g = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    const v = g>threshold ? 255 : 0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im,0,0);
  return c.toDataURL('image/png');
}
async function unsharp(srcDataURL, amount=0.9){
  const {img,w,h} = await toCanvas(srcDataURL);
  const c=makeCanvas(w,h), ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const im=ctx.getImageData(0,0,w,h), d=im.data;
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
async function cropTopNumberROI(imgDataURL, topPct=0.06, heightPct=0.30, sidePct=0.06, scale=2.8){
  const {img, w, h} = await toCanvas(imgDataURL);
  const x = Math.round(w*sidePct);
  const y = Math.round(h*topPct);
  const cw = Math.round(w*(1-2*sidePct));
  const ch = Math.round(h*heightPct);
  const c = makeCanvas(Math.round(cw*scale), Math.round(ch*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,x,y,cw,ch,0,0,c.width,c.height);
  return c.toDataURL('image/png');
}

/* 3) 공통 정규화 & 파서 */
function normalizeOCR(s){
  return (s||'')
    .replace(/[\u2018\u2019\u2032\u2035]/g,"'")
    .replace(/[\u201C\u201D\u2033]/g,'"')
    .replace(/[·•]/g,'.')
    .replace(/\u200B|\u00A0/g,' ')
    .replace(/[ ]{2,}/g,' ')
    .trim();
}
function zero2(n){ return String(n).padStart(2,'0'); }

/* ===== 숫자 후보/스코어 ===== */
function numsFromText(s){
  const t = normalizeOCR(s||'');
  const m = t.match(/\b\d{1,3}[.,]\d{1,2}\b/g) || [];
  return m.map(x => ({ val: parseFloat(x.replace(',','.')), dec: (x.split(/[.,]/)[1]||'').length }));
}
function kmCandidatesFromWords(words){
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
  const arr = [...lines.values()].sort((a,b)=> (a.y - b.y) || (b.maxH - a.maxH)).slice(0,4);
  const out=[];
  for(const L of arr){
    const joined = L.text.join(' ');
    const onlyNum = L.text.filter(t=>/^[0-9.,]+$/.test(t)).join('');
    const c1 = numsFromText(joined);
    const c2 = numsFromText(onlyNum);
    c1.concat(c2).forEach(o=> out.push({ ...o, src:'word-top', score:L.maxH }));
  }
  return out;
}

/* ===== Pace/Time/Runs 파서 (전체 텍스트에서) ===== */
function parseFromOCR(textRaw){
  const text = normalizeOCR(textRaw);

  // Pace 6'30"
  const paceMatch = text.match(/\b(\d{1,2})\s*'\s*(\d{2})\s*"?\b/);

  // Time 22:59:01 / 59:01
  let timeH=null,timeM=null,timeS=null,timeRaw=null;
  let m = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  if(m){ timeH=+m[1]; timeM=+m[2]; timeS=+m[3]; timeRaw=`${zero2(timeH)}:${zero2(timeM)}:${zero2(timeS)}`; }
  else{ m = text.match(/\b(\d{1,2}):(\d{2})\b/);
        if(m){ timeM=+m[1]; timeS=+m[2]; timeRaw=`${zero2(timeM)}:${zero2(timeS)}`; } }

  // 거리(라벨 앞의 숫자)
  const re2dec  = /(\d{1,3})\s*[.,]\s*(\d{2})\b/;
  const re1dec  = /(\d{1,3})\s*[.,]\s*(\d{1})\b/;
  const reInt   = /\b(\d{1,3})\b/;
  const first2Dec = s=> (s.match(re2dec) ? RegExp.$1+'.'+RegExp.$2 : null);
  const first1Dec = s=> (s.match(re1dec) ? RegExp.$1+'.'+RegExp.$2 : null);
  const firstInt  = s=> (s.match(reInt)  ? RegExp.$1 : null);

  let kmFromLabel = null;
  {
    const idx = text.search(/킬로미터|kilometer/i);
    if (idx !== -1) {
      const before = text.slice(Math.max(0, idx - 60), idx);
      kmFromLabel = first2Dec(before) || first1Dec(before) || firstInt(before);
    }
  }

  // Runs
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
    // 앵커 못 찾으면 Pace 이전 범위에서 마지막 정수
    const pacePos = text.search(/\d{1,2}\s*'\s*\d{2}/);
    const scope = pacePos>0 ? text.slice(0, pacePos) : text;
    const cands = (scope.match(/\b\d{1,3}\b/g) || []).map(s=>+s).filter(n=>n>=0 && n<=999);
    return cands.length ? cands[cands.length-1] : null;
  })();

  return {
    km: kmFromLabel ? parseFloat(String(kmFromLabel).replace(',','.')) : null,
    runs,
    paceMin: paceMatch ? parseInt(paceMatch[1],10) : null,
    paceSec: paceMatch ? parseInt(paceMatch[2],10) : null,
    timeH, timeM, timeS, timeRaw
  };
}

/* ===== 거리 후보 생성 (ROI 3패스 + 단어기반) ===== */
const KM_LINE_OCR_OPTS_LINE = { tessedit_pageseg_mode: (Tesseract && Tesseract.PSM && Tesseract.PSM.SINGLE_LINE) || 7,
  tessedit_char_whitelist: '0123456789.,',
  classify_bln_numeric_mode: '1'
};
const KM_LINE_OCR_OPTS_WORD = { tessedit_pageseg_mode: (Tesseract && Tesseract.PSM && Tesseract.PSM.SINGLE_WORD) || 8,
  tessedit_char_whitelist: '0123456789.,',
  classify_bln_numeric_mode: '1'
};

async function multiPassKmCandidates_FAST(imgDataURL){
  await ensureTesseract();

  const out = [];
  const roi0 = await cropTopNumberROI(imgDataURL, 0.06, 0.30, 0.06, 2.8);
  const roi1 = await unsharp(roi0, 0.9);
  const roi2 = await preprocessImageToDataURL(roi1, 1.0, 190);

  const [rA, rB, rC] = await Promise.all([
    Tesseract.recognize(roi1, 'eng', KM_LINE_OCR_OPTS_LINE),
    Tesseract.recognize(roi2, 'eng', KM_LINE_OCR_OPTS_LINE),
    Tesseract.recognize(roi2, 'eng', KM_LINE_OCR_OPTS_WORD)
  ]);

  [['roiA',rA],['roiB',rB],['roiC',rC]].forEach(([tag,res])=>{
    const conf = (res.data?.confidence ?? 60)/100;
    numsFromText(res.data.text).forEach(o=> out.push({ ...o, src:`${tag}-text`, score:(o.score||0)+conf*12 }));
    kmCandidatesFromWords(res.data.words).forEach(o=> out.push({ ...o, src:`${tag}-words`, score:(o.score||0)+conf*12 }));
  });

  return { cands: out, roiBin: roi2 };
}

/* ===== 5-가드(2.x/3.x → 5.x 오인식 보정) ===== */
async function recognizeLeadingChar(roiBinDataURL){
  const {img,w,h} = await toCanvas(roiBinDataURL);
  const c=makeCanvas(w,h), ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);

  function colBlackCount(x){ let s=0; for(let y=0;y<h;y++){ if(ctx.getImageData(x,y,1,1).data[0]<128) s++; } return s; }
  let L=0; const need = Math.max(3, Math.floor(h*0.12));
  for(let x=0;x<w;x++){ if(colBlackCount(x)>need){ L=x; break; } }
  const digitW = Math.max(8, Math.floor(w*0.18));
  const R = Math.min(w-1, L+digitW);

  const cc=makeCanvas(R-L+1,h);
  cc.getContext('2d').drawImage(c, L,0, R-L+1,h, 0,0, R-L+1,h);
  const cropURL = cc.toDataURL('image/png');

  const charRes = await Tesseract.recognize(cropURL, 'eng', {
    tessedit_pageseg_mode: (Tesseract.PSM && Tesseract.PSM.SINGLE_CHAR) || 10,
    tessedit_char_whitelist: '235',
    classify_bln_numeric_mode: '1'
  });
  const ch = (charRes.data.text||'').trim().charAt(0) || '';
  const conf = Number(charRes.data.confidence ?? 0);
  return { ch, conf };
}
async function looksLikeLeadingFive(roiBinDataURL){
  const {img,w,h} = await toCanvas(roiBinDataURL);
  const c=makeCanvas(w,h), ctx=c.getContext('2d',{willReadFrequently:true});
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

/* ===== KM 후보 랭킹 & 보정 ===== */
function groupScores(cands){
  const m=new Map();
  for(const c of cands){
    const key=(Math.round(c.val*100)/100).toFixed(2);
    const s=(c.score||0)+ (String(c.src||'').includes('roi')?4:0);
    m.set(key,(m.get(key)||0)+s);
  }
  return m;
}
function bestScoreAround(scoresMap, center, tol=0.25){
  let best=0;
  for(const [k,v] of scoresMap){
    const x=parseFloat(k); if(Math.abs(x-center)<=tol) best=Math.max(best,v);
  }
  return best;
}
function leadingDigit(n){
  if(!isFinite(n)) return null;
  const s = Math.floor(Math.abs(n)).toString();
  return s.length ? s[0] : null;
}

function parseTimeToSec(t){
  if(!t) return NaN;
  const parts = t.split(':').map(n=>parseInt(n,10));
  if(parts.length===2) return parts[0]*60 + parts[1];
  if(parts.length===3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return NaN;
}
function paceToSec(min,sec){
  if(min==null || sec==null) return NaN;
  return min*60 + sec;
}

/* recordType: 'daily'|'monthly' */
function pickBestKm(cands, { recordType='daily', timeRaw=null, paceMin=null, paceSec=null } = {}){
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
  const ranked = [...groups.values()].sort((a,b)=>
    (b.roi - a.roi) || (b.decHits - a.decHits) || (b.count - a.count) || (b.score - a.score)
  );

  // pace/time로 추정거리 보조
  const ts = parseTimeToSec(timeRaw||'');
  const ps = paceToSec(paceMin, paceSec);
  const est = (isFinite(ts) && isFinite(ps) && ps>0) ? (ts/ps) : null;

  if (ranked.length >= 2 && est!=null){
    const [a,b] = ranked;
    const d1 = Math.abs(a.val - est), d2 = Math.abs(b.val - est);
    if (Math.abs(d1 - d2) > 0.12) return d1 < d2 ? a.val : b.val;
  }
  return ranked[0]?.val ?? null;
}

/* 4) 공개 API — 한 번의 호출로 전체 필드 반환 */
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  await ensureTesseract();

  // 1) 상단 ROI 3패스 → KM 후보
  const fast = await multiPassKmCandidates_FAST(imgDataURL);
  let kmCandidates = fast.cands;
  const roiBinForFiveGuard = fast.roiBin;

  // 2) 전체 이미지 1패스 → pace/time/runs/보조 km
  const baseOpts = { preserve_interword_spaces: '1', tessedit_pageseg_mode: (Tesseract.PSM && Tesseract.PSM.SINGLE_BLOCK) || 3 };
  const rFull = await Tesseract.recognize(imgDataURL, 'eng+kor', baseOpts);
  const p = parseFromOCR(rFull.data.text || "");

  if (p.km!=null) kmCandidates.push({ val: p.km, dec: (String(p.km).split('.')[1]||'').length, src:'aux' });

  // 3) KM 최종 선택
  let kmBest = pickBestKm(kmCandidates, { recordType, timeRaw:p.timeRaw, paceMin:p.paceMin, paceSec:p.paceSec });

  // 3-1) 5-가드: 2.x/3.x → 5.x 오인식 보정
  if (kmBest!=null){
    const intPart = Math.floor(kmBest);
    if (intPart===2 || intPart===3){
      try{
        const { ch:leadCh, conf:leadConf } = await recognizeLeadingChar(roiBinForFiveGuard);
        const looks5 = await looksLikeLeadingFive(roiBinForFiveGuard);
        const ts = parseTimeToSec(p.timeRaw||'');
        const ps = paceToSec(p.paceMin, p.paceSec);
        const est = (isFinite(ts) && isFinite(ps) && ps>0) ? (ts/ps) : null;

        const scores = groupScores(kmCandidates);
        const s2 = bestScoreAround(scores, 2.0, 0.25);
        const s3 = bestScoreAround(scores, 3.0, 0.25);
        const s5 = bestScoreAround(scores, 5.0, 0.25);

        const strongNotFive = (leadCh==='2' || leadCh==='3') && leadConf>=70;
        const estNear5 = (est!=null && est>=4.85 && est<=5.30);
        const allowFixToFive =
          (leadCh==='5' && leadConf>=82) ||
          (looks5 && estNear5 && (s5 > Math.max(s2,s3) + 6));

        if (!strongNotFive && allowFixToFive){
          kmBest = 5 + (kmBest - intPart);
        }
      }catch(_e){}
    }
  }

  // 4) pace/time로 거리/페이스 상호보정 (월간은 보수적: 계산값으로 강제치환 X)
  const ts = parseTimeToSec(p.timeRaw||'');
  const ps = paceToSec(p.paceMin, p.paceSec);
  const kmFromCalc = (isFinite(ts) && isFinite(ps) && ps>0) ? (ts/ps) : NaN;

  const ocrKmRaw = (kmBest ?? p.km ?? NaN);
  const ldOCR  = leadingDigit(ocrKmRaw);
  const ldCALC = leadingDigit(kmFromCalc);
  const leadMismatch = (ldOCR!==null && ldCALC!==null && ldOCR !== ldCALC);

  let finalKm;
  if (recordType==='daily'){
    if (leadMismatch && isFinite(kmFromCalc)) finalKm = kmFromCalc;
    else if (!isFinite(ocrKmRaw) && isFinite(kmFromCalc)) finalKm = kmFromCalc;
    else finalKm = isFinite(ocrKmRaw) ? ocrKmRaw : (isFinite(kmFromCalc)?kmFromCalc:0);
  }else{
    finalKm = isFinite(ocrKmRaw) ? ocrKmRaw : (isFinite(kmFromCalc)?kmFromCalc:0);
  }

  // 5) 결과 조립
  const out = {
    km: finalKm ?? 0,
    runs: (recordType==='monthly') ? (p.runs ?? null) : null,
    paceMin: p.paceMin, paceSec: p.paceSec,
    timeH: p.timeH, timeM: p.timeM, timeS: p.timeS,
    timeRaw: p.timeRaw || null
  };
  return out;
}
