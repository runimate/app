// js/ocr.js
let T = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // 이미 로드돼 있으면 패스
    if ([...document.scripts].some(s => s.src.includes('tesseract.min.js'))) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load Tesseract script'));
    document.head.appendChild(s);
  });
}

async function loadTesseract() {
  if (T) return T;
  // 1) window.Tesseract 있으면 사용
  if (typeof window !== 'undefined' && window.Tesseract) {
    T = window.Tesseract;
    return T;
  }
  // 2) 없으면 UMD 스크립트 주입
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js');
  if (!window.Tesseract) throw new Error('Tesseract not available after script load');
  T = window.Tesseract;
  return T;
}

// ========= 이하 기존 함수들은 그대로 사용 =========
// (그대로 붙여넣기) ----------------------------------

// 이미지 유틸, Otsu, 파서, OCR 헬퍼 등 전부 그대로…(생략 표시 없이 실제 코드 붙이세요)
function loadImage(dataURL){ return new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=dataURL; }); }
function toCanvas(img, w = img.width, h = img.height){ const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,w,h); return c; }
function getImageData(canvas){ const ctx=canvas.getContext('2d',{willReadFrequently:true}); return ctx.getImageData(0,0,canvas.width,canvas.height); }
function putImageData(canvas, im){ canvas.getContext('2d').putImageData(im,0,0); return canvas; }
function otsuBinarize(canvas){ const im=getImageData(canvas); const d=im.data, N=d.length/4; const hist=new Uint32Array(256); for(let i=0;i<N;i++){ const r=d[i*4],g=d[i*4+1],b=d[i*4+2]; const y=(r*0.299+g*0.587+b*0.114)|0; hist[y]++; d[i*4]=d[i*4+1]=d[i*4+2]=y; }
  let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i]; let sumB=0,wB=0,varMax=-1,thr=128; const total=N;
  for(let t=0;t<256;t++){ wB+=hist[t]; if(!wB) continue; const wF=total-wB; if(!wF) break; sumB+=t*hist[t]; const mB=sumB/wB, mF=(sum-sumB)/wF; const between=wB*wF*(mB-mF)*(mB-mF); if(between>varMax){varMax=between;thr=t;} }
  for(let i=0;i<N;i++){ const v=(d[i*4]>thr)?255:0; d[i*4]=d[i*4+1]=d[i*4+2]=v; } return putImageData(canvas,im).toDataURL('image/png'); }
function norm(s){ return (s||'').replace(/[\u2018\u2019\u2032\u2035‘’′]/g,"'").replace(/[\u201C\u201D\u2033\u3011\u3010“”″]/g,'"').replace(/[：﹕:]/g,':').replace(/\s+/g,' ').trim(); }
function parsePace(text){ const t=norm(text).toLowerCase(); const m1=t.match(/(\d{1,2})\s*[:'"]\s*(\d{2})/); if(m1) return {min:+m1[1],sec:+m1[2]}; const m2=t.match(/(\d{1,2})\s*분\s*(\d{1,2})\s*초/); if(m2) return {min:+m2[1],sec:+m2[2]}; return {min:null,sec:null}; }
function parseTime(text){ const t=norm(text).toLowerCase(); let m=t.match(/(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*(\d{1,2})\s*s/); if(m) return {raw:`${+m[1]}:${String(+m[2]).padStart(2,'0')}:${String(+m[3]).padStart(2,'0')}`,H:+m[1],M:+m[2],S:+m[3]}; m=t.match(/(\d{1,2})\s*:\s*(\d{2})\b/); if(m) return {raw:`${+m[1]}:${m[2]}`,H:null,M:+m[1],S:+m[2]}; m=t.match(/(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})/); if(m) return {raw:`${+m[1]}:${m[2]}:${m[3]}`,H:+m[1],M:+m[2],S:+m[3]}; return {raw:null,H:null,M:null,S:null}; }
const secOf=(H,M,S)=>(H||0)*3600+(M||0)*60+(S||0);
async function ocrWords(dataURL, psm='SPARSE_TEXT'){ const TT=await loadTesseract(); const res=await TT.recognize(dataURL,'eng+kor',{ tessedit_pageseg_mode: TT.PSM[psm]??TT.PSM.SPARSE_TEXT, preserve_interword_spaces:'1' }); return res.data.words||[]; }
async function ocrLineDigits(dataURL, whitelist="0123456789:'″\" ", psm='SINGLE_LINE'){ const TT=await loadTesseract(); const res=await TT.recognize(dataURL,'eng+kor',{ tessedit_pageseg_mode: TT.PSM[psm]??TT.PSM.SINGLE_LINE, tessedit_char_whitelist: whitelist, preserve_interword_spaces:'1', classify_bln_numeric_mode:'1' }); return (res.data.text||'').trim(); }
function findAnchor(words, patterns){ const rx=new RegExp(patterns.join('|'),'i'); const hits=words.filter(w=>rx.test((w.text||'').trim())); if(!hits.length) return null; hits.sort((a,b)=>{ const ha=a.bbox?(a.bbox.y1-a.bbox.y0):0; const hb=b.bbox?(b.bbox.y1-b.bbox.y0):0; return (hb-ha)||((b.confidence||0)-(a.confidence||0)); }); return hits[0]; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function roiAbove(anchor,padX,padY,canvasW,canvasH,heightMul=1.4){ if(!anchor||!anchor.bbox) return null; const {x0,x1,y0,y1}=anchor.bbox; const h=y1-y0; const cx0=clamp(x0-padX,0,canvasW-1); const cx1=clamp(x1+padX,0,canvasW-1); const cy1=clamp(y0-padY,0,canvasH-1); const cy0=clamp(cy1-Math.max(h*heightMul,h*1.0),0,canvasH-1); return {x:cx0,y:cy0,w:(cx1-cx0),h:(cy1-cy0)}; }
function cropCanvas(canvas, box){ if(!box) return null; const c=document.createElement('canvas'); c.width=Math.max(1,Math.floor(box.w)); c.height=Math.max(1,Math.floor(box.h)); const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=false; ctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height); return c; }
async function fallbackTopDistance(canvas){ const hCut=Math.floor(canvas.height*0.45); const c=cropCanvas(canvas,{x:Math.floor(canvas.width*0.06), y:Math.floor(canvas.height*0.06), w:Math.floor(canvas.width*0.88), h:hCut}); if(!c) return null; const binURL=otsuBinarize(c); const text=await ocrLineDigits(binURL,"0123456789.,",'SINGLE_LINE'); const m=text.match(/\b\d{1,3}[.,]\d{1,2}\b/); return m?parseFloat(m[0].replace(',','.')):null; }

// 메인
export async function extractAll(imgDataURL, {recordType} = {recordType:'daily'}){
  await loadTesseract();
  const img = await loadImage(imgDataURL);
  const base = toCanvas(img);
  const W=base.width, H=base.height;

  const wordsRaw = await ocrWords(base.toDataURL(), 'SPARSE_TEXT');
  const wordsBin = await ocrWords(otsuBinarize(toCanvas(img)), 'SPARSE_TEXT');
  const words = [...wordsRaw, ...wordsBin];

  const aKM   = findAnchor(words, ['Kilometers','Kilometer','킬로미터']);
  const aPACE = findAnchor(words, ['Avg\\.\\s*Pace','Pace','페이스','평균\\s*페이스','/km']);
  const aTIME = findAnchor(words, ['Time','시간']);

  const padX=Math.round(W*0.02), padY=Math.round(H*0.01);
  const rKm=roiAbove(aKM,padX,padY,W,H,1.6);
  const rPac=roiAbove(aPACE,padX,padY,W,H,1.4);
  const rTim=roiAbove(aTIME,padX,padY,W,H,1.4);

  const getTextFromROI = async (roi, whitelist) => {
    if (!roi) return '';
    const c = cropCanvas(base, roi);
    const binURL = otsuBinarize(c);
    const t1 = await ocrLineDigits(c.toDataURL(), whitelist);
    const t2 = await ocrLineDigits(binURL, whitelist);
    return (t1 && t1.length >= t2.length) ? t1 : t2;
  };

  let kmText = await getTextFromROI(rKm, "0123456789.,");
  let km = null;
  const mkm = (kmText||'').match(/\b\d{1,3}[.,]\d{1,2}\b/);
  if (mkm) km = parseFloat(mkm[0].replace(',','.'));
  if (km==null) km = await fallbackTopDistance(base);

  const paceText = await getTextFromROI(rPac, "0123456789:'″\" ");
  const {min:paceMin_raw, sec:paceSec_raw} = parsePace(paceText);
  let paceMin = paceMin_raw, paceSec = paceSec_raw;

  const timeText = await getTextFromROI(rTim, "0123456789: hms");
  let Tm = parseTime(timeText);
  if (Tm.H!=null && km!=null && km<20 && Tm.H>=3){
    const fixed = timeText.replace(/[hms]/g, ':').replace(/::+/g,':');
    const alt = parseTime(fixed);
    if (alt.raw) Tm = alt;
  }

  const paceSec = (paceMin!=null && paceSec!=null) ? (paceMin*60 + paceSec) : null;
  const timeSec = (Tm.raw ? secOf(Tm.H, Tm.M, Tm.S) : null);
  if (km!=null && paceSec && timeSec){
    const expect = km * paceSec;
    const tol = Math.max(30, expect*0.2);
    const err = Math.abs(timeSec - expect);
    if (err > tol){
      const t2 = await getTextFromROI(rTim, "0123456789: ");
      const a2 = parseTime(t2);
      const s2 = a2.raw ? secOf(a2.H,a2.M,a2.S) : null;
      if (s2 && Math.abs(s2 - expect) < err) Tm = a2;
    }
  }

  const out = { km: km || 0, paceMin: paceMin ?? null, paceSec: paceSec ?? null, timeH: Tm.H, timeM: Tm.M, timeS: Tm.S, timeRaw: Tm.raw || null, runs: null };
  const hintEl = document.getElementById('cv-hint');
  if (hintEl) { const p=(out.paceMin!=null&&out.paceSec!=null)?`${out.paceMin}:${String(out.paceSec).padStart(2,'0')}`:'--'; hintEl.style.display='block'; hintEl.textContent=`OCR km=${out.km ?? '--'} pace=${p} time=${out.timeRaw ?? '--'}`; }
  return out;
}

export default { extractAll };
