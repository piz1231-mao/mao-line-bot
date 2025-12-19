// ======================================================
// 毛怪天氣文案模組｜朋友版 v4.2（今日討論定版）
// ======================================================

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

  // ======================================================
  // 標題 emoji（只看雨）
  // ======================================================
  let weatherEmoji = "☁️";
  if (pop >= 60) weatherEmoji = "🌧️";
  else if (wx.includes("晴")) weatherEmoji = "☀️";

  // ======================================================
  // 一、降雨主線（20% 一級距）
  // ======================================================
  let rainLine = "";

  if (pop >= 80) {
    rainLine = rand([
      "這個基本上就是會下雨了，出門自己想清楚。",
      "雨勢機率很高，今天不被淋有點難。"
    ]);
  } else if (pop >= 60) {
    rainLine = rand([
      "降雨的機率偏高，等等下雨不要說我沒提醒。",
      "蠻有機會下雨的，帶不帶傘你自己決定。"
    ]);
  } else if (pop >= 40) {
    // 👉 你指定的 T0 區間
    rainLine = rand([
      "會不會下雨不好說，要不要聽隨你，但我有講。",
      "雨這件事有點曖昧，我有提醒，剩下看你。"
    ]);
  } else if (pop >= 20) {
    rainLine = rand([
      "下雨的機率有一點點啦，注意到就好。",
      "不是不會下雨，但也不用太緊張。"
    ]);
  } else {
    rainLine = rand([
      "幾乎不太會下雨，雨這件事可以先不用管。",
      "基本上不太會下雨，今天不是雨的問題。"
    ]);
  }

  // ======================================================
  // 二、溫度補句（體感分級）
  // ======================================================
  let tempLine = "";

  if (maxT <= 17) {
    tempLine = rand([
      "今天是真的偏冷，外出記得加件衣服。",
      "這溫度有冷，別鐵齒。"
    ]);
  } else if (maxT <= 21) {
    tempLine = rand([
      "天氣偏涼，其實還蠻舒服的。",
      "有點涼涼的，走動一下剛好。"
    ]);
  } else if (maxT <= 26) {
    tempLine = ""; // 舒服，不說
  } else if (maxT <= 30) {
    tempLine = rand([
      "天氣有點熱，跑來跑去會有點煩。",
      "開始有點熱了，外面走久會煩。"
    ]);
  } else if (maxT <= 33) {
    tempLine = rand([
      "天氣偏熱，外面動一動就會不爽。",
      "這種熱度，行程排太滿會煩。"
    ]);
  } else {
    tempLine = rand([
      "真的很熱，今天就是熱這件事最煩。",
      "這種溫度，能少動就少動。"
    ]);
  }

  // ======================================================
  // 三、組合毛怪說一句
  // ======================================================
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
