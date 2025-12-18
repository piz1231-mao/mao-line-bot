// ======================================================
// 毛怪天氣文案模組｜朋友版 v1.5（自用嘴爆＋emoji＋溫度）
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

  const minT = elements
    .find(e => e.elementName === "MinT")
    .time[0].parameter.parameterName;

  const maxT = elements
    .find(e => e.elementName === "MaxT")
    .time[0].parameter.parameterName;

  const popNum = Number(pop);

  // ===== 天氣 emoji（只標狀態）=====
  let weatherEmoji = "☁️";
  if (wx.includes("雨")) weatherEmoji = "🌧️";
  else if (wx.includes("晴")) weatherEmoji = "☀️";

  // ===== 毛怪說一句（自用嘴爆版）=====
  let maoLine = "天氣看起來還行，應該不用特別理它";
  let hintEmoji = "";

  if (popNum >= 60) {
    maoLine = "降雨的機率蠻高的，被淋到真的不要說我沒講";
    hintEmoji = "🌧️";
  } else if (popNum >= 30) {
    maoLine = "降雨的機率有一點啦，要不要管隨你，我只是講一下";
    hintEmoji = "👀";
  } else {
    maoLine = "天氣算穩，今天應該沒什麼好煩的";
  }

  return `【毛怪天氣 ${weatherEmoji}】
━━━━━━━━━━━
${city}｜${wx}

${hintEmoji ? hintEmoji + " " : ""}降雨的機率 ${pop}%
🌡️ 氣溫 ${minT}～${maxT}°C

毛怪說一句：
${maoLine}`;
}

module.exports = {
  buildWeatherFriendText
};
