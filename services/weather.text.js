// ======================================================
// 毛怪天氣文案模組｜語氣定版＋功能完成版（不 throw）
// ======================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getElement(elements, name) {
  return elements.find(e => e.elementName === name);
}

function buildWeatherFriendText(payload) {
  // ===== 錯誤狀態（服務層已保證不 throw）=====
  if (!payload || payload.ok === false) {
    const msg = {
      NO_API_KEY: "天氣 API 沒鑰匙，我也沒轍。",
      CITY_NOT_FOUND: "這個地方我真的找不到，你是不是打錯？",
      NO_LOCATION_LIST: "氣象署回的資料怪怪的，先別問我。",
      API_ERROR: "氣象署現在在裝死，晚點再試。"
    };
    return `【毛怪天氣 🌧️】
━━━━━━━━━━━
😈 毛怪說一句：
${msg[payload?.error] || "天氣系統有點怪，但不是你的錯。"}`;
  }

  const city = payload.city;
  const elements = payload.weatherElement;

  // ===== 取資料（安全）=====
  const wxEl = getElement(elements, "Wx");
  const popEl = getElement(elements, "PoP");
  const minTEl = getElement(elements, "MinT");
  const maxTEl = getElement(elements, "MaxT");

  const wx = wxEl?.time?.[0]?.parameter?.parameterName || "天氣不明";
  const pop = Number(popEl?.time?.[0]?.parameter?.parameterName ?? 0);
  const minT = Number(minTEl?.time?.[0]?.parameter?.parameterName ?? 0);
  const maxT = Number(maxTEl?.time?.[0]?.parameter?.parameterName ?? 0);

  // ===== 降雨機率嘴法（20% 級距）=====
  let rainLine = "";
  if (pop < 20) {
    rainLine = pick([
      "幾乎不會下雨，今天可以當自己很幸運。",
      "雨基本上沒戲，想幹嘛就幹嘛。"
    ]);
  } else if (pop < 40) {
    rainLine = pick([
      "下雨機率不高，但偶爾會給你一個驚喜。",
      "雨有一點點機會，帶不帶傘隨你。"
    ]);
  } else if (pop < 60) {
    // T0 區間（你指定的語氣）
    rainLine = pick([
      "會不會下雨不好說，要不要聽隨你，但我有講。",
      "雨這種東西現在很曖昧，我講了，你自己看著辦。"
    ]);
  } else if (pop < 80) {
    rainLine = pick([
      "下雨機率不低，跑來跑去會有點煩。",
      "今天雨很有存在感，行程自己抓。"
    ]);
  } else {
    rainLine = pick([
      "雨基本上已經在線上，別再幻想了。",
      "這不是會不會下雨，是什麼時候下。"
    ]);
  }

  // ===== 溫度嘴法 =====
  const avgT = (minT + maxT) / 2;
  let tempLine = "";

  if (avgT < 15) {
    tempLine = "偏冷，穿少會後悔。";
  } else if (avgT < 20) {
    tempLine = "有點涼，早晚自己注意。";
  } else if (avgT < 26) {
    tempLine = "溫度算舒服，沒什麼好抱怨的。";
  } else if (avgT < 30) {
    tempLine = "有點熱，動一動就會流汗。";
  } else {
    tempLine = "偏熱，脾氣跟汗水一起上來那種。";
  }

  // ===== 組合輸出 =====
  return `【毛怪天氣 🌧️】
━━━━━━━━━━━
${city}｜${wx}

💧 降雨的機率 ${pop}%
🌡️ 氣溫 ${minT}～${maxT}°C

😈 毛怪說一句：
${rainLine} ${tempLine}`;
}

module.exports = {
  buildWeatherFriendText
};
