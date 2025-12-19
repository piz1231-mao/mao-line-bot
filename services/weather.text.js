// ======================================================
// 毛怪天氣文案模組｜正式版 v1.0
// 說明：
// - 相容 CWA 新舊 JSON 結構
// - 同時支援 elementValue / parameter.parameterName
// - 降雨機率為主，溫度補嘴
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
// 從 CWA 各種可能結構中取出 weatherElement
// ======================================================
function extractWeatherElement(weather) {
  if (!weather) return null;

  // 常見：weather.data.records.location[0].weatherElement
  const records = weather.data?.records || weather.records;
  if (Array.isArray(records?.location) && records.location[0]?.weatherElement) {
    return records.location[0].weatherElement;
  }

  // 舊結構：weather.data.weatherElement
  if (Array.isArray(weather.data?.weatherElement)) {
    return weather.data.weatherElement;
  }

  // 最後保底
  if (Array.isArray(weather.weatherElement)) {
    return weather.weatherElement;
  }

  return null;
}

// ======================================================
// 取單一氣象元素（新舊格式相容）
// ======================================================
function getElement(elements, name, fallback = "") {
  if (!elements) return fallback;

  const el = elements.find(e => e.elementName === name);
  if (!el || !Array.isArray(el.time) || !el.time[0]) return fallback;

  const t = el.time[0];

  // 新版 CWA
  if (Array.isArray(t.elementValue) && t.elementValue[0]?.value != null) {
    return t.elementValue[0].value;
  }

  // 舊版 CWA
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
  // 🌧️ 降雨機率分級（定稿）
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
  // 🌡️ 溫度補嘴（輔助）
  // ======================================================
  if (tMax >= 28 && pop >= 40) {
    maoLine += " 又熱又可能下雨，這種最容易讓人煩。";
  } else if (tMax <= 18 && tMax > 0) {
    maoLine += " 溫度偏低，記得不要著涼。";
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
