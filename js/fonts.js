// fonts.js
// 폰트 스타일 프리셋 + 레이아웃 보정치 + 적용 함수들

// ─────────────────────────────────────────────────────────────
// 1) fontSettings
//    - 공통: base, weight, dateSize/Gap/Translate, translate, kmWordGap
//    - 레이스 전용(모두 선택적):
//      • raceTitleSize        → 대회명 폰트 크기
//      • raceSubtypeSize      → 종목(Half Marathon 등) 폰트 크기
//      • raceTimeSize         → 시간 숫자 폰트 크기
//      • raceTimeLetterSpace  → 시간 숫자 자간(letter-spacing)
//      • raceTimeTranslate    → 시간 숫자 이동("x,y")
//      • racePaceSize         → Pace 숫자 폰트 크기
//      • raceGapSubtypeB      → “종목 ↔ 시간” 세로 간격 (종목 아래 margin-bottom)
//      • raceGapTimeB         → “시간 ↔ Pace” 세로 간격 (시간 아래 margin-bottom)
//      • raceGapPaceT         → Pace 블록 위쪽 여백 (Pace wrap margin-top)
//
//    ※ 값 예: "88px", "-2px", "0px, -6px", "12px"
// ─────────────────────────────────────────────────────────────
export const fontSettings = {
  "Helvetica Neue": {
    base: 200, weight: 900,
    dateSize: "60px", dateGap: "10px", dateWeight: 700,

    // Race tuning (기본 베이스)
    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "130px",
    raceTimeLetterSpace: "0px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "56px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "8px",
    raceGapPaceT: "14px"
  },

  "Anton": {
    base: 200, weight: 700,
    dateSize: "60px", dateGap: "10px", dateWeight: 700,

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "120px",
    raceTimeLetterSpace: "0px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "58px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "10px",
    raceGapPaceT: "14px"
  },

  "Big Shoulders Inline Text": {
    base: 200, weight: 800,
    dateSize: "40px", dateGap: "20px", dateWeight: 800, dateTranslate: "8px, 0px",

    raceTitleSize: "44px",
    raceSubtypeSize: "64px",
    raceTimeSize: "92px",
    raceTimeLetterSpace: "-3px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "54px",
    raceGapSubtypeB: "12px",
    raceGapTimeB: "8px",
    raceGapPaceT: "14px"
  },

  "Tourney": {
    base: 200, weight: 800,
    dateSize: "40px", dateGap: "-20px", dateWeight: 800, dateTranslate: "8px, 0px",

    raceTitleSize: "44px",
    raceSubtypeSize: "62px",
    raceTimeSize: "90px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "52px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "8px",
    raceGapPaceT: "12px"
  },

  "Anta": {
    base: 160, weight: 700,
    dateSize: "38px", dateGap: "10px", dateWeight: 700, dateTranslate: "10px, 20px",

    raceTitleSize: "42px",
    raceSubtypeSize: "60px",
    raceTimeSize: "90px",
    raceTimeLetterSpace: "-3px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "52px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "8px",
    raceGapPaceT: "12px"
  },

  "Arvo": {
    base: 180, weight: 700,
    dateSize: "38px", dateGap: "10px", dateWeight: 700, dateTranslate: "10px, 20px",

    raceTitleSize: "42px",
    raceSubtypeSize: "60px",
    raceTimeSize: "92px",
    raceTimeLetterSpace: "-3px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "52px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "8px",
    raceGapPaceT: "12px"
  },

  "Iceberg": {
    base: 200, weight: 700,
    dateSize: "42px", dateGap: "10px", dateWeight: 700, dateTranslate: "7px, 20px",

    raceTitleSize: "44px",
    raceSubtypeSize: "64px",
    raceTimeSize: "94px",
    raceTimeLetterSpace: "-3px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "54px",
    raceGapSubtypeB: "12px",
    raceGapTimeB: "8px",
    raceGapPaceT: "14px"
  },

  "Permanent Marker": {
    base: 190, weight: 700,
    dateSize: "44px", dateGap: "0px", dateWeight: 700, dateTranslate: "7px, 20px",

    raceTitleSize: "44px",
    raceSubtypeSize: "62px",
    raceTimeSize: "90px",
    raceTimeLetterSpace: "-2px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "52px",
    raceGapSubtypeB: "10px",
    raceGapTimeB: "8px",
    raceGapPaceT: "14px"
  },

  "Londrina Shadow": {
    base: 190, weight: 700,
    dateSize: "44px", dateGap: "0px", dateWeight: 700, dateTranslate: "7px, 20px",

    raceTitleSize: "44px",
    raceSubtypeSize: "62px",
    raceTimeSize: "88px",
    raceTimeLetterSpace: "-4px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "52px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "12px"
  },

  "Rock Salt": {
    base: 140, weight: 700,
    dateSize: "36px", dateGap: "40px", dateWeight: 600,
    kmWordGap: "40px", translate: "25px,-25px", dateTranslate: "20px,0px",

    raceTitleSize: "40px",
    raceSubtypeSize: "58px",
    raceTimeSize: "84px",
    raceTimeLetterSpace: "-4px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "48px",
    raceGapSubtypeB: "8px",
    raceGapTimeB: "8px",
    raceGapPaceT: "12px"
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
  "Helvetica Neue": { type1: { grid: 5,  kmWord: 0 },  type2: { grid: 5,  kmWord: 0 } },
  "Anton":          { type1: { grid: 5,  kmWord: 0 },  type2: { grid: 5,  kmWord: 0 } },
  "Big Shoulders Inline Text": { type1: { grid: 8, kmWord: 3 }, type2: { grid: 8, kmWord: 3 } },
  "Tourney":        { type1: { grid: 6,  kmWord: 2 },  type2: { grid: 6,  kmWord: 2 } },
  "Anta":           { type1: { grid: 8,  kmWord: 0 },  type2: { grid: 6,  kmWord: 0 } },
  "Arvo":           { type1: { grid: 4,  kmWord: 0 },  type2: { grid: 4,  kmWord: 0 } },
  "Iceberg":        { type1: { grid: 8,  kmWord: 1 },  type2: { grid: 8,  kmWord: 1 } },
  "Permanent Marker":{type1:{ grid: 8,  kmWord: 1 },  type2: { grid: 8,  kmWord: 1 } },
  "Londrina Shadow":{ type1: { grid: 5,  kmWord: 2 },  type2: { grid: 5,  kmWord: 2 } },
  "Rock Salt":      { type1: { grid: 25, kmWord: 0 },  type2: { grid: 25, kmWord: 0 } }
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
