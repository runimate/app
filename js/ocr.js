// js/ocr.js — daily + monthly 지원 (ES Module, robust KM & Monthly ROIs + role assignment + KM fallback)

/* 1) Tesseract 보장 */
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

/* 2) 캔버스 유틸 */
function toImage(src){ return new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function cloneCanvas(src){ const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src,0,0); return c; }
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
function fillWhite(canvas, rx, ry, rw, rh){
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(canvas.width*rx, canvas.height*ry, canvas.width*rw, canvas.height*rh);
  return canvas;
}
const toURL = (c)=>c.toDataURL('image/png');

/* 3) OCR helpers */
async function ocrLine(url, { psm=7, whitelist='0123456789:’\'″"′ .,' } = {}){
  await ensureTesseract();
  const opts = {
    tessedit_pageseg_mode: psm,                     // Single line
    tessedit_char_whitelist: whitelist,            // 숫자/구분자만
    preserve_interword_spaces: '1'
  };
  const res = await Tesseract.recognize(url, 'eng+kor', opts);
  return res?.data?.text?.trim() ?? '';
}
async function bestTextFrom(canvas, thresholds=[null, 165, 180, 190, 205]){
  const texts = [];
  for(const th of thresholds){
    const c = th==null ? canvas : binarize(cloneCanvas(canvas), th);
    texts.push(await ocrLine(toURL(c)));
  }
  const score = (s)=> (s.match(/[0-9]/g)||[]).length + (s.match(/[:.]/g)||[]).length*2;
  return texts.sort((a,b)=>score(b)-score(a))[0] || '';
}

/* 4) ROI들 */
function roisDaily(w,h){
  const top = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.74), h: Math.round(h*0.26) };
  const barY = Math.round(h*0.48), barH = Math.round(h*0.16);
  const barX = Math.round(w*0.06), barW = Math.round(w*0.88), cellW = Math.round(barW/3);
  return {
    top,
    pace: { x: barX + 0*cellW, y: barY, w: cellW, h: barH },
    time: { x: barX + 1*cellW, y: barY, w: cellW, h: barH },
    runs: null
  };
}

/* 월간: 기기/버전에 따라 가로/세로 위치 편차가 커서 후보 세트를 다변화 */
function roisMonthlyVariants(w,h){
  // 상단 KM 박스 후보 (조금 더 넓게 잡아 소수점 오른쪽 손실 방지)
  const topCandidates = [
    { x: Math.round(w*0.04), w: Math.round(w*0.90) },
    { x: Math.round(w*0.06), w: Math.round(w*0.86) },
    { x: Math.round(w*0.04), w: Math.round(w*0.94) },
  ].map(t => ({ x:t.x, y: Math.round(h*0.06), w:t.w, h: Math.round(h*0.26) }));

  // 하단 3열 박스 후보 (가로/세로 함께 변화)
  const barXList = [0.04, 0.06, 0.08];
  const barWList = [0.90, 0.88, 0.84];
  const barYList = [0.50, 0.57, 0.62];
  const barHList = [0.16, 0.18, 0.20];

  const sets = [];
  for (const top of topCandidates){
    for (const bx of barXList){
      for (const bw of barWList){
        for (const by of barYList){
          for (const bh of barHList){
            const barX = Math.round(w*bx);
            const barW = Math.round(w*bw);
            const cellW = Math.round(barW/3);
            sets.push({
              top,
              runs: { x: barX + 0*cellW, y: Math.round(h*by), w: cellW, h: Math.round(h*bh) },
              pace: { x: barX + 1*cellW, y: Math.round(h*by), w: cellW, h: Math.round(h*bh) },
              time: { x: barX + 2*cellW, y: Math.round(h*by), w: cellW, h: Math.round(h*bh) },
            });
          }
        }
      }
    }
  }
  return sets;
}

/* 5) 파서 (보정 강화) */
function normalizeDigits(s){
  return String(s||'')
    .replace(/[Oo]/g, '0')
    .replace(/[|Il]/g, '1')
    .replace(/[，]/g, ',')
    .replace(/[·•]/g, '.')         // 점처럼 보이는 기호
    .replace(/[,]/g, '.')          // 쉼표 → 소수점
    .replace(/\s+/g, ' ')
    .trim();
}
function parseDistance(raw){
  if (!raw) return null;
  const s0 = normalizeDigits(raw).replace(/[’′"″]/g,'.').replace(/[:]/g,'.');
  // 소수점이 2개 이상이면 첫 번째만 유효 처리
  const s = s0.replace(/(\d)\.(?=.*\.)/g, '$1');
  const matches = [...s.matchAll(/\b(\d{1,4}(?:\.\d{1,2})?)\b/g)];
  if (!matches.length) return null;

  // 가장 그럴싸한 후보 고르는 규칙:
  // 1) 값이 큰 쪽 선호(월간 합계 특성)  2) 소수점 있는 값 선호  3) 자리수 많은 쪽
  let best = null;
  for (const m of matches){
    const txt = m[1];
    const val = parseFloat(txt);
    if (!Number.isFinite(val)) continue;
    const score = (val) + (txt.includes('.')?50:0) + (txt.replace('.','').length);
    if (!best || score > best.score) best = { score, val, txt };
  }
  let val = best?.val ?? null;

  // 예외: 3자리 정수인데 점 없고 100 이상이면 /100 보정(23001 → 230.01 류 오인식)
  if (val!=null && !String(best.txt).includes('.') && val >= 100) {
    val = parseFloat((val/100).toFixed(2));
  }
  return val;
}
function parseRuns(s){
  if (!s) return null;
  const m = normalizeDigits(s).match(/\b(\d{1,3})\b/);
  return m ? parseInt(m[1],10) : null;
}
function parsePace(s){
  if (!s) return { min:null, sec:null };
  const t = String(s).replace(/[’′']/g,':').replace(/[″"]/g,':').replace(/：/g,':');
  const m = t.match(/(\d{1,2})\s*:\s*([0-5]\d)/);
  if(!m) return { min:null, sec:null };
  return { min:+m[1], sec:+m[2] };
}
function parseTime(s){
  if (!s) return { raw:null, H:null, M:null, S:null };
  const t = String(s).replace(/[’′']/g,':').replace(/：/g,':');
  const hmsWords = t.match(/(\d{1,2})\s*h[^0-9]*(\d{1,2})\s*m[^0-9]*(\d{1,2})\s*s/i);
  if (hmsWords) return { raw:`${+hmsWords[1]}:${hmsWords[2]}:${hmsWords[3]}`, H:+hmsWords[1], M:+hmsWords[2], S:+hmsWords[3] };
  const hms = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\s*:\s*([0-5]\d)\b/);
  if (hms) return { raw:`${+hms[1]}:${hms[2]}:${hms[3]}`, H:+hms[1], M:+hms[2], S:+hms[3] };
  const ms  = t.match(/\b(\d{1,2})\s*:\s*([0-5]\d)\b/);
  if (ms)  return { raw:`${+ms[1]}:${ms[2]}`, H:null, M:+ms[1], S:+ms[2] };
  return { raw:null, H:null, M:null, S:null };
}

/* Pace/Time 문자열의 "역할" 점수화 → 월간에서 자리 뒤바뀐 경우 자동 재배치 */
function scoreAsRuns(txt){
  const t = normalizeDigits(txt);
  const colon = (t.match(/[:]/g)||[]).length;
  const m = t.match(/^\s*\d{1,3}\s*$/) ? 3 : (t.match(/\b\d{1,3}\b/) ? 1 : 0);
  return m - colon*2; // 콜론 있으면 Runs일 확률 급감
}
function scoreAsPace(txt){
  const t = String(txt);
  const hasQuote = /[’′'″"]/.test(t);
  const mmss = /(^|\s)\d{1,2}\s*[:’′'″"]\s*[0-5]\d(?!:)/.test(t);
  const m = parsePace(t);
  return (m.min!=null ? 4:0) + (mmss?2:0) + (hasQuote?1:0);
}
function scoreAsTime(txt){
  const t = String(txt);
  const colonCnt = (t.match(/[:]/g)||[]).length;
  const hasHMS = /h|m|s/i.test(t);
  const parsed = parseTime(t);
  return (parsed.raw?5:0) + (colonCnt>=2?2:0) + (hasHMS?1:0) + (t.length>=6?1:0);
}
function assignMonthlyRoles(strRuns, strPace, strTime){
  const items = [
    { key:'A', txt:strRuns },
    { key:'B', txt:strPace },
    { key:'C', txt:strTime }
  ].map(x=>({
    key:x.key, txt:x.txt,
    r: scoreAsRuns(x.txt),
    p: scoreAsPace(x.txt),
    t: scoreAsTime(x.txt)
  }));

  // Runs: r 점수 최대
  const runsItem = items.slice().sort((a,b)=>b.r-a.r)[0];
  const left = items.filter(i=>i!==runsItem);

  // Time / Pace: 남은 두 개 중 t/p 점수 비교
  const timeItem = left.slice().sort((a,b)=>b.t-a.t)[0];
  const paceItem = left.filter(i=>i!==timeItem)[0];

  return {
    runsText: runsItem.txt,
    paceText: paceItem.txt,
    timeText: timeItem.txt
  };
}

/* KM 텍스트를 여러 후보로 읽고 최적 채택 */
async function bestKmFromTopCanvas(topCanvas){
  const candidates = [];

  // 1) 원본
  candidates.push(await bestTextFrom(cloneCanvas(topCanvas)));

  // 2) 오른쪽 상단 마스킹 — 크기 2종
  for (const rw of [0.18, 0.26, 0.32]) {
    const c = fillWhite(cloneCanvas(topCanvas), 1-rw, 0, rw, 0.55);
    candidates.push(await bestTextFrom(c));
  }

  // 3) 하단 라벨(킬로미터/Kilometers) 마스킹
  const cBottom = fillWhite(cloneCanvas(topCanvas), 0.00, 0.60, 1.00, 0.40);
  candidates.push(await bestTextFrom(cBottom));

  // 점수: 파싱 가능한 거리값 + 소수점 보너스 + 자리수
  const scored = candidates.map(txt=>{
    const val = parseDistance(txt);
    if (val==null) return {score:-1, val:null};
    const raw = String(txt);
    const digitCount = (raw.match(/\d/g)||[]).length;
    const dotBonus = String(val).includes('.') ? 2 : 0;
    return {score: (val/2) + digitCount + dotBonus*3, val};
  }).sort((a,b)=>b.score-a.score);

  return (scored[0]?.val ?? null);
}

/* Time & Pace로 계산한 KM (월간 보정용) */
function kmFromTP(timeObj, paceObj){
  if (!paceObj || paceObj.min==null || paceObj.sec==null) return null;
  const psec = paceObj.min*60 + paceObj.sec;
  if (psec<=0) return null;

  let tsec = 0;
  if (timeObj){
    if (timeObj.H!=null || timeObj.M!=null || timeObj.S!=null){
      tsec = (timeObj.H||0)*3600 + (timeObj.M||0)*60 + (timeObj.S||0);
    } else if (timeObj.raw){
      const m3 = String(timeObj.raw).match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
      const m2 = String(timeObj.raw).match(/^(\d{1,2}):(\d{2})$/);
      if (m3) tsec = (+m3[1])*3600 + (+m3[2])*60 + (+m3[3]);
      else if (m2) tsec = (+m2[1])*60 + (+m2[2]);
    }
  }
  if (tsec<=0) return null;
  const km = tsec / psec;
  return Number.isFinite(km) ? km : null;
}

/* 6) 공개 API */
export async function extractAll(imgDataURL, { recordType='daily' } = {}){
  const img = await toImage(imgDataURL);
  const { width:w, height:h } = img;

  const monthlySets = recordType==='monthly' ? roisMonthlyVariants(w,h) : null;
  const setsToTry = monthlySets || [roisDaily(w,h)];

  let best = { score:-1, out:null };

  for (const R of setsToTry){
    // ── KM ──
    const topC = drawCrop(img, R.top.x, R.top.y, R.top.w, R.top.h, 2.6);
    const kmRaw = await bestKmFromTopCanvas(topC);
    const kmVal = Number.isFinite(kmRaw) ? kmRaw : null;

    // ── 하단 3칸 문자열 일단 추출 ──
    let rawRuns=null, rawPace=null, rawTime=null;
    if (R.runs){
      const runsC = drawCrop(img, R.runs.x, R.runs.y, R.runs.w, R.runs.h, 2.6);
      rawRuns = await bestTextFrom(runsC);
    }
    if (R.pace){
      const paceC = drawCrop(img, R.pace.x, R.pace.y, R.pace.w, R.pace.h, 2.6);
      rawPace = await bestTextFrom(paceC);
    }
    if (R.time){
      const timeC = drawCrop(img, R.time.x, R.time.y, R.time.w, R.time.h, 2.6);
      rawTime = await bestTextFrom(timeC);
    }

    // ── 월간일 때는 내용 기반으로 Runs/Pace/Time 재배치 ──
    if (recordType==='monthly'){
      const assigned = assignMonthlyRoles(rawRuns, rawPace, rawTime);
      rawRuns = assigned.runsText;
      rawPace = assigned.paceText;
      rawTime = assigned.timeText;
    }

    // ── 파싱 ──
    const runs = recordType==='monthly' ? parseRuns(rawRuns) : null;
    const P = parsePace(rawPace);      // {min,sec}
    const T = parseTime(rawTime);      // {raw,H,M,S}
    const paceMin=P.min, paceSec=P.sec;
    let timeH=T.H, timeM=T.M, timeS=T.S, timeRaw=T.raw;

    // ── KM 보정: Time÷Pace가 정상이고, KM과 큰 괴리가 나면 보정 ──
    let km = kmVal;
    const kmCalc = kmFromTP(T, P);
    if (kmCalc!=null){
      if (km==null || !Number.isFinite(km) || km<=0){
        km = kmCalc;
      }else{
        const ratio = km / kmCalc;
        if (ratio < 0.7 || ratio > 1.3) km = kmCalc;   // 30% 이상 벗어나면 보정
      }
    }
    if (!Number.isFinite(km)) km = 0;

    // ── 스코어: KM 가중 + 나머지 인식 수 ──
    const fieldsOk = [
      Number.isFinite(km) && km>0,
      (paceMin!=null && paceSec!=null && (paceMin+paceSec)>0),
      (timeRaw!=null || timeH!=null || timeM!=null || timeS!=null),
      (recordType==='monthly' ? runs!=null : true)
    ].filter(Boolean).length;
    const score = (Number.isFinite(km)&&km>0?6:0) + fieldsOk + (recordType==='monthly' && runs!=null ? 1:0);

    if (score > best.score){
      best = { score, out:{ km, runs, paceMin, paceSec, timeH, timeM, timeS, timeRaw } };
    }
  }

  // 최종 안전가드
  const out = best.out ?? { km:0, runs:null, paceMin:null, paceSec:null, timeH:null, timeM:null, timeS:null, timeRaw:null };

  // 월간 값 형태 보정(표시는 ui.js 쪽에서 처리하지만, km 소수 1자리 선호)
  if (recordType==='monthly' && Number.isFinite(out.km)) {
    out.km = Math.max(0, +out.km.toFixed(1));
  }

  return out;
}
