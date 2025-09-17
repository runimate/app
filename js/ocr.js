// js/ocr.js
// 단순·안정 OCR: 라벨 근처에서만 값 추출

const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js";

async function ensureTesseract() {
  if (window.Tesseract) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = TESS_URL;
    s.onload = res;
    s.onerror = () => rej(new Error("Failed to load Tesseract"));
    document.head.appendChild(s);
  });
}

const re = {
  dist: /\b\d{1,3}[.,]\d{1,2}\b/,
  pace: /\b(\d{1,2})[:'′](\d{2})\b/,
  time: /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/,
  kmUnit: /^\/?km$/i
};

const KOREAN = {
  kilometers: "킬로미터",
  pace: "페이스",
  time: "시간"
};

function norm(s="") {
  return s
    .replace(/[’′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[：]/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimeToken(txt) {
  const m = norm(txt).match(re.time);
  if (!m) return null;
  const H = m[3] ? parseInt(m[1],10) : 0;
  const M = parseInt(m[3] ? m[2] : m[1], 10);
  const S = parseInt(m[3] ? m[3] : m[2], 10);
  return { H, M, S, raw: m[3] ? `${H}:${String(M).padStart(2,'0')}:${String(S).padStart(2,'0')}`
                             : `${M}:${String(S).padStart(2,'0')}` };
}

function toSecs({H=0,M=0,S=0}) { return (H*3600 + M*60 + S); }

function fromSecs(sec) {
  const H = Math.floor(sec/3600);
  const M = Math.floor((sec%3600)/60);
  const S = Math.floor(sec%60);
  return { H, M, S, raw: H>0 ? `${H}:${String(M).padStart(2,'0')}:${String(S).padStart(2,'0')}`
                             : `${M}:${String(S).padStart(2,'0')}` };
}

function boxCenter(w){ return { x:(w.x0+w.x1)/2, y:(w.y0+w.y1)/2 }; }
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

function wordsFrom(data){
  return (data.words||[]).map(w=>({
    text:(w.text||"").trim(),
    x0: w.bbox?.x0 ?? 0, y0: w.bbox?.y0 ?? 0,
    x1: w.bbox?.x1 ?? 0, y1: w.bbox?.y1 ?? 0,
    h: (w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0),
    conf: Number(w.confidence ?? 0)
  })).filter(w=>w.text);
}

function pickDistance(all){
  // 1) 'Kilometers/킬로미터' 라벨 근처의 가장 큰 숫자
  const anchor = all.filter(w => /kilometers/i.test(w.text) || w.text === KOREAN.kilometers);
  const nums   = all.filter(w => re.dist.test(w.text));
  if (anchor.length && nums.length){
    const A = anchor[0];
    const Ac = boxCenter(A);
    // 앵커 기준 위쪽 200px 이내 & 수직 정렬 점수
    const cand = nums
      .map(n => ({ w:n, c:boxCenter(n), score: (n.h*2) - Math.abs(n.y1 - A.y0) - dist(boxCenter(n), Ac)/5 }))
      .sort((a,b)=>b.score-a.score)[0];
    if (cand) return parseFloat(cand.w.text.replace(',','.'));
  }
  // 2) 최상단 40% 영역에서 글자 크기(h)가 가장 큰 숫자
  const maxY = Math.min(...all.map(w=>w.y0)) + (Math.max(...all.map(w=>w.y1)) - Math.min(...all.map(w=>w.y0))) * 0.4;
  const topNums = all.filter(w => re.dist.test(w.text) && w.y0 < maxY);
  if (topNums.length){
    const big = topNums.sort((a,b)=>b.h-a.h)[0];
    return parseFloat(big.text.replace(',','.'));
  }
  return null;
}

function pickPace(all){
  const paceLabel = all.filter(w=> /avg\.*\s*pace/i.test(w.text) || w.text.includes(KOREAN.pace));
  const kmTokens  = all.filter(w=> re.kmUnit.test(w.text));
  const paceNums  = all.filter(w=> re.pace.test(w.text.replace(/\s/g,'')));

  // /km 근접한 mm:ss
  if (kmTokens.length && paceNums.length){
    const out = paceNums
      .map(p => {
        const pc = boxCenter(p);
        const nearestKm = kmTokens.map(k => ({ d: dist(pc, boxCenter(k)), k })).sort((a,b)=>a.d-b.d)[0];
        return { w:p, d: nearestKm ? nearestKm.d : 1e9, h:p.h };
      })
      .sort((a,b)=> (a.d-b.d) || (b.h-a.h))[0];
    if (out) {
      const m = re.pace.exec(out.w.text.replace(/\s/g,''));
      return { min: +m[1], sec:+m[2] };
    }
  }
  // 라벨 근처
  if (paceLabel.length && paceNums.length){
    const A = paceLabel[0];
    const out = paceNums
      .map(p => ({ w:p, d: dist(boxCenter(A), boxCenter(p)), h:p.h }))
      .sort((a,b)=> (a.d-b.d) || (b.h-a.h))[0];
    if (out){
      const m = re.pace.exec(out.w.text.replace(/\s/g,''));
      return { min: +m[1], sec:+m[2] };
    }
  }
  // 마지막 보루: 모든 paceNums 중 글자 큰 것
  if (paceNums.length){
    const p = paceNums.sort((a,b)=>b.h-a.h)[0];
    const m = re.pace.exec(p.text.replace(/\s/g,''));
    return { min:+m[1], sec:+m[2] };
  }
  return null;
}

function pickTime(all){
  const timeLabel = all.filter(w => /^time$/i.test(w.text) || w.text === KOREAN.time);
  const timeNums  = all.filter(w => re.time.test(w.text));
  if (!timeNums.length) return null;

  if (timeLabel.length){
    const A = timeLabel[0];
    const best = timeNums
      .map(t => ({ w:t, d: dist(boxCenter(A), boxCenter(t)), h:t.h }))
      .sort((a,b)=> (a.d-b.d) || (b.h-a.h))[0];
    if (best) return parseTimeToken(best.w.text);
  }
  // 라벨이 없으면 'Kilometers' 아래쪽에서 가장 큰 시간값
  const kilo = all.find(w => /kilometers/i.test(w.text) || w.text === KOREAN.kilometers);
  const pool = kilo ? timeNums.filter(t => t.y0 > kilo.y0) : timeNums;
  const best = pool.sort((a,b)=>b.h-a.h)[0] || timeNums[0];
  return parseTimeToken(best.text);
}

function sanity({ km, pace, time }) {
  // pace 범위: 3:00~12:00
  if (pace && (pace.min<3 || pace.min>12 || pace.sec>=60)) pace = null;

  // time이 6시간 초과면 의심
  if (time && toSecs(time) > 6*3600) time = null;

  // 일관성 검사: time ≈ pace * km
  if (km && pace && time){
    const pred = (pace.min*60 + pace.sec) * km;
    const delta = Math.abs(pred - toSecs(time));
    if (delta > Math.max(90, pred*0.25)) {
      // 2파트로 재해석( mm:ss ) 시도
      const m = re.time.exec(time.raw);
      if (m && !m[3]) {
        time = null;
      } else {
        // 3파트였다면 H가 말이 안 되는 경우 버림
        if (time.H >= 5 && km < 21) time = null;
      }
    }
  }

  // 보정: time이 없고 km+pace가 있으면 계산
  if (!time && km && pace){
    const sec = Math.round((pace.min*60 + pace.sec) * km);
    time = fromSecs(sec);
  }

  // 보정: pace가 없고 km+time이 있으면 역산
  if (!pace && km && time){
    const s = toSecs(time);
    const spk = Math.round(s / Math.max(0.1, km));
    const min = Math.floor(spk/60), sec = spk%60;
    if (min>=3 && min<=12) pace = { min, sec };
  }

  return { km, pace, time };
}

export async function extractAll(imgDataURL, { recordType='daily' } = {}) {
  await ensureTesseract();

  const { data } = await window.Tesseract.recognize(imgDataURL, 'eng', {
    tessedit_pageseg_mode: window.Tesseract.PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1'
  });

  const all = wordsFrom(data);

  // 1) 기본 추출
  let km   = pickDistance(all);
  let pace = pickPace(all);
  let time = pickTime(all);

  // 2) 정합성 체크/보정
  ({ km, pace, time } = sanity({ km, pace, time }));

  return {
    km: km ?? 0,
    runs: null, // 월간용은 별도 필요 시 추가
    paceMin: pace ? pace.min : null,
    paceSec: pace ? pace.sec : null,
    timeH: time ? time.H : null,
    timeM: time ? time.M : null,
    timeS: time ? time.S : null,
    timeRaw: time ? time.raw : null
  };
}
