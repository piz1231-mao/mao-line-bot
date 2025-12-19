// ======================================================
// 毛怪天氣文案模組｜朋友嘴砲版 v1.4（結構自動偵測）
// ======================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTempFeeling(t) {
  if (t <= 18) return "有點冷";
  if (t <= 23) return "偏涼";
  if (t <= 27) return "算舒服";
  if (t <= 31) return "有點熱";
  return "滿熱的";
}

function isNight() {
  const h = new Date().getHours();
  return h >= 18 || h < 6;
}

// 🔒 從任何可能位置安全抓 weatherElement
function extractWeatherElement(weather) {
  if (!weather) return null;

  // 情況 A：data.weatherElement
  if (Array.isArray(weather.data?.weatherElement)) {
    return weather.data.weatherElement;
  }

  // 情況 B：data.records.location[0].weatherElement（CWA 常見）
  if (
    Array.isArray(weather.data?.records?.location) &&
    weather.data.records.location[0]?.weatherElement
  ) {
    return weather.data.records.location[0].weatherElement;
  }

  return null;
}

function getElement(elements, name, fallback = "") {
  try {
    return (
      elements.find(e => e.elementName === name)
        ?.time?.[0]?.parameter?.parameterName
    ) || fallback;
  } catch {
    return fallback;
  }
}

function buildWeatherFriendText(weather) {
  const city = weather?.city || "這個地方";

  const elements = extractWeatherElement(weather);
  if (!elements) {
    return `${city} 天氣資料暫時抓不到，晚點再看。`;
  }

  const wx = getElement(elements, "Wx", "天氣不明");
  const pop = Number(getElement(elements, "PoP", 0));
  const tMin = Number(getElement(elements, "MinT", 0));
  const tMax = Number(getElement(elements, "MaxT", 0));

  let maoLine = "";

  // ======================================================
  // 🌧️ 降雨機率分級（你定稿）
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

  // 🌡️ 溫度補嘴
  if (tMax >= 28 && pop >= 40) {
    maoLine += " 又熱又可能下雨，這種最容易讓人煩。";
  } else if (tMax <= 18) {
    maoLine += " 溫度偏低，記得不要著涼。";
  }

  // 🌙 晚上語氣
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
