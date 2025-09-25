// fonts.js
// 폰트 프리셋 + D1/D2/M1/M2/Race 사이즈/위치 일괄 적용 유틸

/* ──────────────────────────────────────────────────────────
   0) 공통 기본값
────────────────────────────────────────────────────────── */
const DEFAULTS = {
  // Daily/Monthly 기본 타이포(레이아웃별)
  t1: { statSize:'40px', labelSize:'18px', statGap:'24px', pull:'0px',  pull2:'0px', kmWordSize:'36px', kmWordGap:'16px' },
  t2: { statSize:'40px', labelSize:'20px', statGap:'16px', pull:'50px', pull2:'40px', kmWordSize:'36px', kmWordGap:'16px' },

  // 날짜(D2, M1, M2에서 사용)
  date: { size:'50px', gap:'10px', translate:'0px,0px', weight:700 },

  // Race 기본
  race: {
    titleSize:'30px', subtypeSize:'50px',
    timeSize:'88px',  timeLetter:'0px', timeTranslate:'0px,0px',
    paceSize:'56px',  paceLetter:'0px',
    gapSubtypeB:'8px', gapTimeB:'8px', gapPaceT:'6px',
    paceLabelSize:'22px'
  }
};

/* ──────────────────────────────────────────────────────────
   1) 폰트 프리셋 (질문에서 준 값 그대로 사용)
   - 필요 시 kmWordSize / kmWordGap / statsT1 / statsT2 도 추가 가능
────────────────────────────────────────────────────────── */
export const fontSettings = {
  "Helvetica Neue": {
    base: 200, weight: 900,
    dateSize: "50px", dateGap: "10px", dateWeight: 700, dateTranslate: "5px, 15px",
    kmLetter: "0px",

    raceTitleSize: "30px",
    raceSubtypeSize: "50px",
    raceTimeSize: "150px",
    raceTimeLetterSpace: "0px",
    raceTimeTranslate: "0px,0px",
    racePaceSize: "56px",
    racePaceLetterSpace: "0px",
    raceGapSubtypeB: "8px",
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
    raceGapPaceT: "20px",
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
    kmLetter: "-1px",

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
    kmLetter: "-1px",

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

/* ──────────────────────────────────────────────────────────
   2) KM 숫자 스케일
────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────
   3) 들여쓰기/오프셋 (기존 그대로)
────────────────────────────────────────────────────────── */
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
export function applyFontIndents(font, type){
  const defaults = { grid: 5, kmWord: 0 };
  const conf = (fontIndentMap[font] && fontIndentMap[font][type]) || defaults;
  document.documentElement.style.setProperty('--gridFirstColIndent', `${conf.grid}px`);
  document.documentElement.style.setProperty('--kmWordIndent', `${conf.kmWord}px`);
}
export function applyFontStatsOffset(font, layoutType, recordType){
  if (layoutType !== 'type2') {
    document.documentElement.style.setProperty('--statsLeftOffset', '0px');
    return;
  }
  const map = fontStatsOffsetMap[font] || { daily:"0px", monthly:"0px" };
  const val = (recordType === 'daily') ? map.daily : map.monthly;
  document.documentElement.style.setProperty('--statsLeftOffset', val || '0px');
}

/* ──────────────────────────────────────────────────────────
   4) 핵심: 폰트별 사이즈/위치 전체 적용기
      - ui.js는 이 함수만 호출하면 됨
────────────────────────────────────────────────────────── */
export function applyFontTheme(font, layoutType, recordType){
  const fs   = fontSettings[font] || {};
  const root = document.documentElement.style;

  /* 4-1) KM 큰 숫자(폰트·사이즈·이동·자간) */
  const kmEl = document.getElementById('km');
  if (kmEl){
    kmEl.style.fontFamily   = `"${font}", sans-serif`;
    kmEl.style.fontSize     = ((fs.base ?? 200)) + "px";
    kmEl.style.fontWeight   = (fs.weight ?? 700);
    kmEl.style.transform    = fs.translate ? `translate(${fs.translate})` : "translate(0,0)";
    kmEl.style.fontSynthesis= 'none';
    if (fs.kmLetter != null) kmEl.style.letterSpacing = String(fs.kmLetter);
    else kmEl.style.removeProperty('letter-spacing');
  }

  /* 4-2) 날짜 사이즈/위치 (D2/M1/M2 공통으로 세팅) */
  const d = {
    size:      fs.dateSize      || DEFAULTS.date.size,
    gap:       fs.dateGap       || DEFAULTS.date.gap,
    translate: fs.dateTranslate || DEFAULTS.date.translate
  };
  root.setProperty("--d2-dateSize", d.size);
  root.setProperty("--d2-dateGap", d.gap);
  root.setProperty("--d2-dateTranslate", d.translate);
  root.setProperty("--m1-dateSize", d.size);
  root.setProperty("--m1-dateGap", d.gap);
  root.setProperty("--m1-dateTranslate", d.translate);
  root.setProperty("--m2-dateSize", d.size);
  root.setProperty("--m2-dateGap", d.gap);
  root.setProperty("--m2-dateTranslate", d.translate);

  /* 4-3) Kilometers(단어) 크기/간격 */
  const t1 = { ...DEFAULTS.t1 };
  const t2 = { ...DEFAULTS.t2 };
  if (fs.kmWordSize) { t1.kmWordSize = fs.kmWordSize; t2.kmWordSize = fs.kmWordSize; }
  if (fs.kmWordGap)  { t1.kmWordGap  = fs.kmWordGap;  t2.kmWordGap  = fs.kmWordGap;  }
  if (fs.statsT1) Object.assign(t1, fs.statsT1);
  if (fs.statsT2) Object.assign(t2, fs.statsT2);

  root.setProperty('--t1-kmWordSize', t1.kmWordSize);
  root.setProperty('--t1-kmWordGap',  t1.kmWordGap);
  root.setProperty('--t2-kmWordSize', t2.kmWordSize);
  root.setProperty('--t2-kmWordGap',  t2.kmWordGap);

  /* 4-4) 통계(라벨/값) 크기 및 좌우 끌어당김 */
  root.setProperty('--t1-statSize',  t1.statSize);
  root.setProperty('--t1-labelSize', t1.labelSize);
  root.setProperty('--t1-statGap',   t1.statGap);
  root.setProperty('--t1-statPull',  t1.pull);
  root.setProperty('--t1-statPull2', t1.pull2);

  root.setProperty('--t2-statSize',  t2.statSize);
  root.setProperty('--t2-labelSize', t2.labelSize);
  root.setProperty('--t2-statGap',   t2.statGap);
  root.setProperty('--t2-statPull',  t2.pull);
  root.setProperty('--t2-statPull2', t2.pull2);

  /* 4-5) Race 타이포/간격/위치 */
  const r = {
    titleSize:   fs.raceTitleSize   || DEFAULTS.race.titleSize,
    subtypeSize: fs.raceSubtypeSize || DEFAULTS.race.subtypeSize,
    timeSize:    fs.raceTimeSize    || DEFAULTS.race.timeSize,
    timeLetter:  fs.raceTimeLetterSpace ?? DEFAULTS.race.timeLetter,
    timeTranslate: fs.raceTimeTranslate || DEFAULTS.race.timeTranslate,
    paceSize:    fs.racePaceSize    || DEFAULTS.race.paceSize,
    paceLetter:  fs.racePaceLetterSpace ?? DEFAULTS.race.paceLetter,
    gapSubtypeB: fs.raceGapSubtypeB || DEFAULTS.race.gapSubtypeB,
    gapTimeB:    fs.raceGapTimeB    || DEFAULTS.race.gapTimeB,
    gapPaceT:    fs.raceGapPaceT    || DEFAULTS.race.gapPaceT,
    paceLabelSize: fs.racePaceLabelSize || DEFAULTS.race.paceLabelSize
  };
  root.setProperty('--race-title-size',   r.titleSize);
  root.setProperty('--race-subtype-size', r.subtypeSize);
  root.setProperty('--race-time-size',    r.timeSize);
  root.setProperty('--race-time-translate', r.timeTranslate);
  root.setProperty('--race-time-letter',  r.timeLetter);
  root.setProperty('--race-pace-size',    r.paceSize);
  root.setProperty('--race-gap-subtype-b', r.gapSubtypeB);
  root.setProperty('--race-gap-time-b',    r.gapTimeB);
  root.setProperty('--race-gap-pace-t',    r.gapPaceT);
  root.setProperty('--race-pace-label-size', r.paceLabelSize);

  // 레이스 숫자/라벨에 letter-spacing 바로 적용(변수 미사용 영역 보완)
  const timeEl = document.getElementById('race-time');
  const paceEl = document.getElementById('race-pace');
  const paceLabelEl = document.getElementById('race-pace-label') ||
                      document.querySelector('.race-pace-wrap .label');
  if (timeEl) timeEl.style.letterSpacing = String(r.timeLetter);
  if (paceEl) paceEl.style.letterSpacing = String(r.paceLetter);
  if (timeEl) timeEl.style.fontFamily = `"${font}", sans-serif`;
  if (paceEl) paceEl.style.fontFamily = `"${font}", sans-serif`;
  if (paceLabelEl){
    paceLabelEl.style.fontFamily = `"${font}", sans-serif`;
    paceLabelEl.style.fontSize   = r.paceLabelSize;
  }

  /* 4-6) 그리드 들여쓰기/통계 좌측 오프셋 */
  applyFontIndents(font, layoutType);
  applyFontStatsOffset(font, layoutType, recordType);
}
