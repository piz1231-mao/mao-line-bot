// ======================================================
// 毛怪天氣文案模組｜正式版 v1.2
// - 相容 CWA 新舊 JSON 結構
// - 降雨機率為主軸
// - 溫度使用嘴砲句庫（隨機）
// - 40–60% 為「下不下不好說」區
// ======================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isNight() {
  const h = new Date().getHours();
  return h >= 18 || h < 6;
}

// ======================================================
// 溫度分級
// ======================================================
function getTempLevel(tMax) {
  if (tMax <= 18) return "cold";
  if (tMax <= 23) return "cool";
  if (tMax <= 27) return "nice";
  if (tMax <= 31) return "warm";
  return "hot";
}

// ======================================================
// 溫度嘴砲句庫（你定的）
// ======================================================
const TEMP_LINES = {
  cold: [
    "今天偏冷，穿少一點真的會後悔。",
    "這溫度不是在跟你客氣的，自己注意一下。",
    "不冷是不可能的，自己保重。"
  ],
  cool: [
    "有點涼，早晚可能會想加件外套。",
    "風來的時候會有感覺那種涼。",
    "不算冷，但也不是短袖隨便穿的天氣。"
  ],
  nice: [
    "溫度其實蠻剛好的。",
    "這種天氣基本上不會讓人不爽。",
    "不冷不熱，算是難得正常的一天。"
  ],
  warm: [
    "開始有點悶了，動一動就會流汗。",
    "不至於爆炸，但會開始覺得煩。",
    "這溫度已經不是可以忽略的那種。"
  ],
  hot: [
    "這已經不是熱，是在考驗耐心。",
    "出門沒心理準備會直接不爽。",
    "今天會熱到讓人懷疑人生。"
  ]
};

// ======================================================
// 抽取 weatherElement（新舊 CWA 相容）
// ======================================================
function extractWeatherElement(weather) {
  if (!weather) return null;

  const records = weather.data?.records || weather.records;
  if (Array.isArray(records?.location) && records.location[0]?.weatherElement) {
    return records.location[0].weatherElement;
  }

  if (Array.isArray(weather.data?.weatherElement)) {
    return weather.data.weatherElement;
  }

  if (Array.isArray(weather.weatherElement)) {
    return weather.weatherElement;
  }

  return null;
}

// ======================================================
// 取單一氣象元素（elementValue / parameter 雙支援）
// ======================================================
function getElement(elements, name, fallback = "") {
  if (!elements) return fallback;

  const el = elements.find(e => e.elementName === name);
  if (!el || !Array.isArray(el.time) || !el.time[0]) return fallback;

  const t = el.time[0];

  if (Array.isArray(t.elementValue) && t.elementValue[0]?.value != null) {
    return t.elementValue[0].value;
  }

  if (t.parameter?.parameterName != null) {
    return t.parameter.parameterName;
  }

  return fallback;
}

// ======================================================
// 主輸出
// ======================================================
function buildWeatherFriendText(weather) {
  const city =
    weather?.city ||
    weather?.data?.records?.location?.[0]?.locationName ||
    "這個地方";

  const elements = extractWeatherElement(weather);
  if (!elements) {
    return `【毛怪天氣 🌧️】
━━━━━━━━━━━
${city}

天氣資料暫時抓不到，晚點再看。`;
  }

  const wx = getElement(elements, "Wx", "天氣不明");
  const pop = Number(getElement(elements, "PoP", 0));
  const tMin = Number(getElement(elements, "MinT", 0));
  const tMax = Number(getElement(elements, "MaxT", 0));

  let maoLine = "";

  // ======================================================
  // 🌧️ 降雨機率嘴砲（主線）
  // ======================================================
  if (pop <= 20) {
    maoLine = pick([
      "基本上不太會下，要不要管隨你。",
      "雨是沒什麼機會啦，今天可以放鬆一點。"
    ]);
  } else if (pop <= 39) {
    maoLine = pick([
      "有一點點機率，但不用自己嚇自己。",
      "想帶傘也行，不帶其實也說得過去。"
    ]);
  } else if (pop <= 60) {
    maoLine = pick([
      "下不下不好說，要不要聽隨你，但我有講。",
      "這種不上不下的機率最煩，等等突然下也不奇怪。"
    ]);
  } else if (pop <= 80) {
    maoLine = pick([
      "這個機率我會當作會下啦，你自己想一下。",
      "不想淋雨的話，今天就不要賭。"
    ]);
  } else {
    maoLine = pick([
      "不用幻想了，這個就是會下。",
      "這種機率還想賭不下雨，我是覺得很勇。"
    ]);
  }

  // ======================================================
  // 🌡️ 溫度體感補嘴（隨機句庫）
  // ======================================================
  if (tMax > 0) {
    if (pop >= 40 && tMax >= 28) {
      maoLine += " 又熱又可能下雨，這種最容易讓人煩。";
    } else {
      const tempLevel = getTempLevel(tMax);
      const tempLine = TEMP_LINES[tempLevel]
        ? pick(TEMP_LINES[tempLevel])
        : "";
      if (tempLine) maoLine += ` ${tempLine}`;
    }
  }

  // ======================================================
  // 🌙 晚上語氣
  // ======================================================
  if (isNight()) {
    maoLine += " 晚上要不要出門，你自己評估。";
  }

  return `【毛怪天氣 🌧️】
━━━━━━━━━━━
${city}｜${wx}

💧 降雨的機率 ${pop}%
🌡️ 氣溫 ${tMin}～${tMax}°C

😈 毛怪說一句：
${maoLine}`;
}

module.exports = {
  buildWeatherFriendText
};
