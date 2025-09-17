// js/ocr.js
// (1) Tesseract 지연 로딩
export async function ensureTesseract(){
  if (window.Tesseract) return;
  await new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ===== 공통 유틸 ===== */
const zero2 = n => String(n).padStart(2, '0');
const norm = s => (s||'')
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

/* ===== 이미지 전처리/ROI ===== */
// ▼ 아래 함수들에 기존 코드 그대로 옮기면 됨
export async function toCanvas(imgDataURL){ /* ... (네 기존 본문) ... */ }
export async function preprocessImageToDataURL(imgDataURL, scale=2.4, threshold=190){ /* ... */ }
export async function unsharp(srcDataURL, amount=0.9){ /* ... */ }
export async function cropTopNumberROI(imgDataURL, topPct=0.06, heightPct=0.30, sidePct=0.06, scale=2.8){ /* ... */ }
export async function cropStatsROI(imgDataURL, topPct=0.40, heightPct=0.45, sidePct=0.06, scale=2.4){ /* ... */ }
export async function cropStatsCellROI(imgDataURL, colIndex=0, topPct=0.52, heightPct=0.14, sidePct=0.06, scale=2.6){ /* ... */ }

/* ===== 파싱/후보 ===== */
export function numsFromText(s){ /* ... */ }
export function kmCandidatesFromWords(words){ /* ... */ }
export function extractPace(text){ /* ... */ }
export function extractTime(text){ /* ... */ }
export function parseFromOCR(textRaw){ /* ... */ }
export function groupScores(cands){ /* ... */ }
export function bestScoreAround(scoresMap, center, tol=0.25){ /* ... */ }
export async function recognizeLeadingChar(roiBinDataURL){ /* ... */ }
export async function looksLikeLeadingFive(roiBinDataURL){ /* ... */ }

const KM_LINE_OCR_OPTS_7 = { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, tessedit_char_whitelist:'0123456789.,', classify_bln_numeric_mode:'1' };
const KM_LINE_OCR_OPTS_8 = { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD, tessedit_char_whitelist:'0123456789.,', classify_bln_numeric_mode:'1' };

export async function ocrPaceTimePrecise(imgDataURL){ /* ... (칸별 ROI) ... */ }
export async function multiPassKmCandidates_FAST(imgDataURL){ /* ... */ }

/* ===== 파이프라인: 이미지 → {km, runs, pace..., time...} ===== */
export async function extractAll(imgDataURL, { recordType }){
  await ensureTesseract();

  // 너의 기존 “업로드 → OCR 파이프라인” 로직을 이 안으로 옮겼어.
  // (fast 후보, stats ROI, 칸별 pace/time, rFull/rStats 병합, pickBestKm, 2/3→5 가드, runs 추출 등)
  // 최종적으로 parsedData 형태로 리턴.
  // ---- START: 네 기존 로직 그대로 이동 ----
  // const fast = await multiPassKmCandidates_FAST(imgDataURL);
  // ...
  // return { km, runs, paceMin, paceSec, timeH, timeM, timeS, timeRaw };
  // ---- END ----
}
