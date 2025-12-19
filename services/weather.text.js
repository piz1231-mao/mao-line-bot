// ======================================================
// 毛怪天氣文案模組｜朋友版 v4.1（結構對齊穩定版）
// ======================================================

function buildWeatherFriendText(weather) {
  if (!weather || !Array.isArray(weather.weatherElement)) {
    throw new Error("weatherElement not found");
  }
 
  const city = weather.city || "未知地區";
  const elements = weather.weatherElement;

  // ---------- 安全取值 ----------
  function getText(names) {
    for (const n of names) {
      const el = elements.find(e => e.elementName === n);
      if (el?.time?.[0]?.parameter?.parameterName) {
        return el.time[0].parameter.parameterName;
      }
    }
    return "";
  }

  function getNumber(names, def = 0) {
    for (const n of names) {
      const el = elements.find(e => e.elementName === n);
      if (el?.time?.[0]?.parameter?.parameterName) {
        return Number(el.time[0].parameter.parameterName);
      }
    }
    return def;
  }

  const wx = getText(["Wx"]);
  const pop = getNumber(["PoP12h", "PoP"], 0);
  const minT = getNumber(["MinT"], 0);
  const maxT = getNumber(["MaxT"], 0);

  // ---------- 標題 emoji ----------
  let weatherEmoji = "☁️";
  if (pop >= 60) weatherEmoji = "🌧️";
  else if (wx.includes("晴")) weatherEmoji = "☀️";

  // ---------- 降雨主線 ----------
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

  // ---------- 溫度補句 ----------
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
