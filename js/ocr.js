// js/ocr.js — daily + monthly 지원 (ES Module)

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

// 2) 캔버스 유틸
function toImage(src){ return new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function drawCrop(img,x,y,w,h,scale=2.2){
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
function fillWhite(canvas, rx, ry, rw, rh){ // rx..: 0~1 비율 좌표
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(canvas.width*rx, canvas.height*ry, canvas.width*rw, canvas.height*rh);
  return canvas;
}
const toURL = (c)=>c.toDataURL('image/png');

// 3) OCR helpers
async function ocrLine(url, { psm=7, whitelist='0123456789:’\'″"′ ' } = {}){
  const T = await ensureTesseract();
  const opts = {
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: '1'
  };
  const res = await Tesseract.recognize(url, 'eng+kor', opts);
  return res?.data?.text?.trim() ?? '';
}
async function bestTextFrom(canvas){
  // 임계값 다양화 + 원본: 가장 긴 숫자 패턴 선택
  const candidates = [null, 165, 185, 205];
  const texts = [];
  for(const th of candidates){
    const c = th==null ? canvas : binarize(cloneCanvas(canvas), th);
    texts.push(await ocrLine(toURL(c)));
  }
  // 가장 숫자/콜론이 많은 걸 선택
  const score = (s)=> (s.match(/[0-9]/g)||[]).length + (s.match(/[:]/g)||[]).length*2;
  return texts.sort((a,b)=>score(b)-score(a))[0] || '';
}
function cloneCanvas(src){
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src,0,0);
  return c;
}

// 4) ROI들
function roisDaily(w,h){
  // 상단 큰 거리 (좌70% 영역만 사용, 우상단 로고 마스킹)
  const top = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.74), h: Math.round(h*0.26) };
  // 하단 3칸 중 Pace/Time
  const barY = Math.round(h*0.48), barH = Math.round(h*0.16);
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88), cellW = Math.round(barW/3);
  return {
    top,
    pace: { x: barX + 0*cellW, y: barY, w: cellW, h: barH },
    time: { x: barX + 1*cellW, y: barY, w: cellW, h: barH },
    runs: null
  };
}
function roisMonthly(w,h){
  // 상단 누적 KM
  const top = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.80), h: Math.round(h*0.26) };
  // 중단 3칸: Runs / Avg. Pace / Time (좌→우)
  const barY = Math.round(h*0.50), barH = Math.round(h*0.18);
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88), cellW = Math.round(barW/3);
  return {
    top,
    runs: { x: barX + 0*cellW, y: barY, w: cellW, h: barH },
    pace: { x: barX + 1*cellW, y: barY, w: cellW, h: barH },
    time: { x: barX + 2*cellW, y: barY, w: cellW, h: barH },
  };
}

// 5) 파서
function parseDistance(s){
  // 소수점/콤마 모두 허용. 1~3자리 정수 + 선택적 .dd
  const m = s.replace(/,/g,'.').match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
  return m ? parseFloat(m[1]) : null;
}
function parseRuns(s){
  const m = s.match(/\b(\d{1,3})\b/);
  return m ? parseInt(m[1],10) : null;
}
function parsePace(s){
  const t = s.replace(/[’′']/g,':').replace(/[″"]/g,':').replace(/：/g,':');
  const m = t.match(/(\d{1,2})\s*:\s*([0-5]\d)/);
  if(!m) return { min:null, sec:null };
  return { min:+m[1], sec:+m[2] };
}
function parseTime(s){
  const t = s.replace(/[’′']/g,':').replace(/：/g,':');
  // 5h 41m 34s 형태
  const hmsWords = t.match(/(\d{1,2})\s*h[^0-9]*(\d{1,2})\s*m[^0-9]*(\d{1,2})\s*s/i);
  if (hmsWords) return { raw:`${+hmsWords[1]}:${hmsWords[2]}:${hmsWords[3]}`, H:+hmsWords[1], M:+hmsWords[2], S:+hmsWords[3] };
  // 1:05:46
  const hms = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\s*:\s*([0-5]\d)\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  // 47:53
  const ms  = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

// 6) 공개 API
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;

  const R = recordType==='monthly' ? roisMonthly(w,h) : roisDaily(w,h);

  // --- 거리 (가민 로고 덮기 포함) ---
  let topC = drawCrop(img, R.top.x, R.top.y, R.top.w, R.top.h, 2.6);
  // 우상단 로고 영역을 강제로 흰색 덮기 (텍스트 라인에 방해되는 영역)
  topC = fillWhite(topC, 0.68, 0.00, 0.32, 0.45);
  const kmTxt = await bestTextFrom(binarize(cloneCanvas(topC), 190));
  const km = parseDistance(kmTxt);

  // --- 페이스 ---
  let paceMin=null, paceSec=null;
  if (R.pace){
    const paceC = drawCrop(img, R.pace.x, R.pace.y, R.pace.w, R.pace.h, 2.6);
    const paceTxt = await bestTextFrom(paceC);
    const P = parsePace(paceTxt);
    paceMin = P.min; paceSec = P.sec;
  }

  // --- 시간 ---
  let timeH=null, timeM=null, timeS=null, timeRaw=null;
  if (R.time){
    const timeC = drawCrop(img, R.time.x, R.time.y, R.time.w, R.time.h, 2.6);
    const timeTxt = await bestTextFrom(timeC);
    const T = parseTime(timeTxt);
    timeH = T.H; timeM = T.M; timeS = T.S; timeRaw = T.raw;
  }

  // --- 러닝 횟수 (monthly만) ---
  let runs = null;
  if (recordType==='monthly' && R.runs){
    const runsC = drawCrop(img, R.runs.x, R.runs.y, R.runs.w, R.runs.h, 2.6);
    const runsTxt = await bestTextFrom(runsC);
    runs = parseRuns(runsTxt);
  }

  return { km: km ?? 0, runs, paceMin, paceSec, timeH, timeM, timeS, timeRaw };
}
