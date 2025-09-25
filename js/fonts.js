// fonts.js
// 폰트 스타일 프리셋 + 레이아웃 보정치 + 적용 함수들

// ─────────────────────────────────────────────────────────────
// 1) fontSettings
//    - 공통: base, weight, dateSize/Gap/Translate, translate, kmWordGap
//    - NEW:  kmLetter               → 데일리/먼쓸리 "거리 숫자(#km)" 자간(letter-spacing)
//    - 레이스 전용(모두 선택적):
//      • raceTitleSize        → 대회명 폰트 크기
//      • raceSubtypeSize      → 종목(Half Marathon 등) 폰트 크기
//      • raceTimeSize         → 시간 숫자 폰트 크기
//      • raceTimeLetterSpace  → 시간 숫자 자간(letter-spacing)
//      • raceTimeTranslate    → 시간 숫자 이동("x,y")
//      • racePaceSize         → Pace 숫자 폰트 크기
//      • racePaceLetterSpace  → Pace 숫자 자간(letter-spacing)   ← ★ 추가
//      • raceGapSubtypeB      → “종목 ↔ 시간” 세로 간격 (종목 아래 margin-bottom)
//      • raceGapTimeB         → “시간 ↔ Pace” 세로 간격 (시간 아래 margin-bottom)
//      • raceGapPaceT         → Pace 블록 위쪽 여백 (Pace wrap margin-top)
//      • racePaceLabelSize    → "Pace" 라벨의 폰트 크기(선택)
//    ※ 값 예: "88px", "-2px", "0px, -6px", "12px"
// ─────────────────────────────────────────────────────────────
export const fontSettings = {
  "Helvetica Neue": {
    base: 200, weight: 900,
    dateSize: "50px", dateGap: "10px", dateWeight: 700, dateTranslate: "5px, 15px",
    kmLetter: "0px",

    // Race tuning (기본 베이스)
    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "150px",
    raceTimeLetterSpace: "0px",
    raceTimeTranslate: "0px,-10px",
    racePaceSize: "56px",
    racePaceLetterSpace: "0px",
    raceGapSubtypeB: "18px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Anton": {
    base: 200, weight: 700,
    dateSize: "60px", dateGap: "10px", dateWeight: 700,
    kmLetter: "0px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "140px",
    raceTimeLetterSpace: "2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "58px",
    racePaceLetterSpace: "1px",
    raceGapSubtypeB: "18px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Big Shoulders Inline Text": {
    base: 200, weight: 800,
    dateSize: "40px", dateGap: "20px", dateWeight: 800, dateTranslate: "8px, 0px",
    kmLetter: "-1px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "140px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "64px",
    racePaceLetterSpace: "-1px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Tourney": {
    base: 200, weight: 800,
    dateSize: "40px", dateGap: "-20px", dateWeight: 800, dateTranslate: "8px, 0px",
    kmLetter: "-1px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "140px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "64px",
    racePaceLetterSpace: "-1px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Anta": {
    base: 160, weight: 700,
    dateSize: "38px", dateGap: "10px", dateWeight: 700, dateTranslate: "10px, 20px",
    kmLetter: "-0.5px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "130px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "58px",
    racePaceLetterSpace: "-1px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "21px"
  },

  "Arvo": {
    base: 180, weight: 700,
    dateSize: "38px", dateGap: "10px", dateWeight: 700, dateTranslate: "10px, 20px",
    kmLetter: "0px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "140px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "58px",
    racePaceLetterSpace: "0px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "21px"
  },

  "Iceberg": {
    base: 220, weight: 900,
    dateSize: "42px", dateGap: "10px", dateWeight: 700, dateTranslate: "12px, 30px",
    kmLetter: "-4px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "160px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "72px",
    racePaceLetterSpace: "-1px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Permanent Marker": {
    base: 190, weight: 700,
    dateSize: "44px", dateGap: "0px", dateWeight: 700, dateTranslate: "7px, 20px",
    kmLetter: "-0.5px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "140px",
    raceTimeLetterSpace: "-1px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "58px",
    racePaceLetterSpace: "-0.5px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Londrina Shadow": {
    base: 190, weight: 700,
    dateSize: "44px", dateGap: "0px", dateWeight: 700, dateTranslate: "7px, 20px",
    kmLetter: "-1px",   // KM 숫자만 적용(데일리/먼쓸리). 나머지는 기본 폰트 유지

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "150px",
    raceTimeLetterSpace: "0px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "64px",
    racePaceLetterSpace: "0px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "6px",
    racePaceLabelSize: "22px"
  },

  "Rock Salt": {
    base: 140, weight: 700,
    dateSize: "36px", dateGap: "40px", dateWeight: 600,
    kmWordGap: "40px", translate: "25px,-25px", dateTranslate: "20px,0px",
    kmLetter: "-1px", // KM 숫자만 적용(데일리/먼쓸리). 나머지는 기본 폰트 유지

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "84px",
    raceTimeLetterSpace: "-1px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "36px",
    racePaceLetterSpace: "-0.5px",
    raceGapSubtypeB: "24px",
    raceGapTimeB: "28px",
    raceGapPaceT: "20px",
    racePaceLabelSize: "18px"
  }
};

// ─────────────────────────────────────────────────────────────
// 2) kmFontScale (거리 숫자(데일리/먼슬리) 폰트별 스케일)
// ─────────────────────────────────────────────────────────────
export const kmFontScale = {
  "Helvetica Neue": { type1: 0.90, type2: 1.00 },
  "Anton": { type1: 0.90, type2: 1.00 },
  "Big Shoulders Inline Text": { type1: 0.95, type2: 1.10 },
  "Tourney": { type1: 0.85, type2: 0.89 },
  "Anta": { type1: 0.93, type2: 0.98 },
  "Arvo": { type1: 0.80, type2: 0.85 },
  "Iceberg": { type1: 0.85, type2: 0.90 },
  "Permanent Marker": { type1: 0.85, type2: 0.90 },
  "Londrina Shadow": { type1: 0.85, type2: 0.90 },
  "Rock Salt": { type1: 0.85, type2: 0.94 }
};

// ─────────────────────────────────────────────────────────────
// 3) 폰트별 들여쓰기 보정(기존)
// ─────────────────────────────────────────────────────────────
export const fontIndentMap = {
  "Helvetica Neue": { type1: { grid: 10,  kmWord: 10 },  type2: { grid: 10,  kmWord: 10 } },
  "Anton":          { type1: { grid: 10,  kmWord: 10 },  type2: { grid: 10,  kmWord: 10 } },
  "Big Shoulders Inline Text": { type1: { grid: 14, kmWord: 14 }, type2: { grid: 12, kmWord: 12 } },
  "Tourney":        { type1: { grid: 10,  kmWord: 10 },  type2: { grid: 12,  kmWord: 12 } },
  "Anta":           { type1: { grid: 14,  kmWord: 14 },  type2: { grid: 12,  kmWord: 12 } },
  "Arvo":           { type1: { grid: 10,  kmWord: 10 },  type2: { grid: 14,  kmWord: 14 } },
  "Iceberg":        { type1: { grid: 14,  kmWord: 14 },  type2: { grid: 14,  kmWord: 14 } },
  "Permanent Marker":{type1:{ grid: 14,  kmWord: 14 },  type2: { grid: 8,  kmWord: 8 } },
  "Londrina Shadow":{ type1: { grid: 14,  kmWord: 14 },  type2: { grid: 5,  kmWord: 5 } },
  "Rock Salt":      { type1: { grid: 25, kmWord: 25 },  type2: { grid: 25, kmWord: 25 } }
};

// ─────────────────────────────────────────────────────────────
// 4) type2 통계영역 좌측 오프셋(기존)
// ─────────────────────────────────────────────────────────────
const fontStatsOffsetMap = {
  "Helvetica Neue": { daily: "5px", monthly: "5px" },
  "Anton": { daily: "5px", monthly: "5px" },
  "Big Shoulders Inline Text": { daily: "8px", monthly: "8px" },
  "Tourney": { daily: "4px", monthly: "6px" },
  "Anta": { daily: "10px", monthly: "12px" },
  "Arvo": { daily: "6px", monthly: "6px" },
  "Iceberg": { daily: "6px", monthly: "8px" },
  "Permanent Marker": { daily: "6px", monthly: "8px" },
  "Londrina Shadow": { daily: "8px", monthly: "10px" },
  "Rock Salt": { daily: "24px", monthly: "24px" }
};

// CSS 변수 적용 (그리드 들여쓰기 / "Kilometers" 단어 들여쓰기)
export function applyFontIndents(font, type){
  const defaults = { grid: 5, kmWord: 0 };
  const conf = (fontIndentMap[font] && fontIndentMap[font][type]) || defaults;
  document.documentElement.style.setProperty('--gridFirstColIndent', `${conf.grid}px`);
  document.documentElement.style.setProperty('--kmWordIndent', `${conf.kmWord}px`);
}

// 통계 영역 좌측 오프셋 (type2에서만 유효)
export function applyFontStatsOffset(font, layoutType, recordType){
  if (layoutType !== 'type2') {
    document.documentElement.style.setProperty('--statsLeftOffset', '0px');
    return;
  }
  const map = fontStatsOffsetMap[font] || { daily:"0px", monthly:"0px" };
  const val = (recordType === 'daily') ? map.daily : map.monthly;
  document.documentElement.style.setProperty('--statsLeftOffset', val || '0px');
}
