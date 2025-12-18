// ======================================================
// 毛怪天氣文案模組｜朋友版 v1.0（只負責說話）
// ======================================================

function buildWeatherFriendText(weather) {
  const city = weather.city;
  const elements = weather.data.weatherElement;

  const wx = elements
    .find(e => e.elementName === "Wx")
    .time[0].parameter.parameterName;

  const pop = elements
    .find(e => e.elementName === "PoP")
    .time[0].parameter.parameterName;

  // ===== 毛怪說一句（朋友版）=====
  let maoLine = "想幹啥就幹啥";

  const popNum = Number(pop);

  if (popNum >= 60) {
    maoLine = "今天降雨機率不低，小心等等下雨";
  } else if (popNum >= 30) {
    maoLine = "有可能會下雨，留意一下天氣變化";
  } else {
    maoLine = "天氣還算穩定，沒什麼問題";
  }

  return `【毛怪天氣】
━━━━━━━━━━━
${city}｜${wx}

降雨機率 ${pop}%

毛怪說一句：
${maoLine}`;
}

module.exports = {
  buildWeatherFriendText
};
