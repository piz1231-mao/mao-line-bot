// ======================================================
// 毛怪天氣文案模組｜朋友版 v4.0.2（結構防炸最終版）
// ======================================================

function buildWeatherFriendText(weather) {
  // ========= 最外層防呆 =========
  if (!weather) {
    throw new Error("weather is undefined");
  }

  const city = weather.city || "未知地區";

  // 支援兩種資料結構
  const elements =
    weather.weatherElement ||
    (weather.data && weather.data.weatherElement);

  if (!Array.isArray(elements)) {
    throw new Error("weatherElement not found");
  }

  // ========= 安全取值工具 =========
  function getParam(names) {
    for (const name of names) {
      const el = elements.find(e => e.elementName === name);
      if (el && el.time && el.time[0] && el.time[0].parameter) {
        return Number(el.time[0].parameter.parameterName);
      }
    }
    return null;
  }

  function getText(names) {
    for (const name of names) {
      const el = elements.find(e => e.elementName === name);
      if (el && el.time && el.time[0] && el.time[0].parameter) {
        return el.time[0].parameter.parameterName;
      }
    }
    return "";
  }

  const wx = getText(["Wx"]);
  const pop = getParam(["PoP12h", "PoP"]) ?? 0;
  const minT = getParam(["MinT"]) ?? 0;
  const maxT = getParam(["MaxT"]) ?? 0;

  // ========= 標題 emoji =========
  let weatherEmoji = "☁️";
  if (pop >= 60) weatherEmoji = "🌧️";
  else if (wx.includes("晴")) weatherEmoji = "☀️";

  // ========= 降雨主線 =========
  let rainLine = "";
  if (pop >= 80) {
    rainLine = "這個基本上就是會下雨了，出門自己想清楚。";
  } else if (pop >= 60) {
    rainLine = "降雨的機率偏高，等等下雨不要說我沒提醒。";
  } else if (pop >= 40) {
    rainLine = "會不會下雨不好說，要不要聽隨你，但我有講。";
  } else if (pop >= 20) {
    rainLine = "下雨的機率有一點點啦，注意到就好。";
  } else {
    rainLine = "幾乎不太會下雨，雨這件事可以先不用管。";
  }

  // ========= 溫度補句 =========
  let tempLine = "";
  if (maxT <= 17) {
    tempLine = "今天是真的偏冷，外出記得加件衣服。";
  } else if (maxT <= 21) {
    tempLine = "天氣偏涼，其實還蠻舒服的。";
  } else if (maxT <= 26) {
    tempLine = "";
  } else if (maxT <= 30) {
    tempLine = "天氣有點熱，跑來跑去會有點煩。";
  } else if (maxT <= 33) {
    tempLine = "天氣偏熱，外面動一動就會不爽。";
  } else {
    tempLine = "真的很熱，今天就是熱這件事最煩。";
  }

  const maoLine = tempLine ? `${rainLine} ${tempLine}` : rainLine;

  return `【毛怪天氣 ${weatherEmoji}】
━━━━━━━━━━━
${city}｜${wx}

💧 降雨的機率 ${pop}%
🌡️ 氣溫 ${minT}～${maxT}°C

😈 毛怪說一句：
${maoLine}`;
}

module.exports = {
  buildWeatherFriendText
};
