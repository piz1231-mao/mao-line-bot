// ======================================================
// 毛怪天氣文案模組｜朋友版 v4.0（雨 × 溫度完整整合）
// ======================================================

function buildWeatherFriendText(weather) {
  const city = weather.city;
  const elements = weather.data.weatherElement;

  const wx = elements.find(e => e.elementName === "Wx")
    .time[0].parameter.parameterName;

  const pop = Number(
    elements.find(e => e.elementName === "PoP")
      .time[0].parameter.parameterName
  );

  const minT = Number(
    elements.find(e => e.elementName === "MinT")
      .time[0].parameter.parameterName
  );

  const maxT = Number(
    elements.find(e => e.elementName === "MaxT")
      .time[0].parameter.parameterName
  );

  // ======================================================
  // 標題 emoji（只看雨的重量）
  // ======================================================
  let weatherEmoji = "☁️";
  if (pop >= 60) weatherEmoji = "🌧️";
  else if (wx.includes("晴")) weatherEmoji = "☀️";

  // ======================================================
  // 一、降雨主線（R0–R4）
  // ======================================================
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

  // ======================================================
  // 二、溫度補句（C0–C5｜C2 不說話）
  // ======================================================
  let tempLine = "";

  if (maxT <= 17) {
    tempLine = "今天是真的偏冷，外出記得加件衣服。";
  } else if (maxT <= 21) {
    tempLine = "天氣偏涼，其實還蠻舒服的。";
  } else if (maxT <= 26) {
    tempLine = ""; // C2 舒服，不補
  } else if (maxT <= 30) {
    tempLine = "天氣有點熱，跑來跑去會有點煩。";
  } else if (maxT <= 33) {
    tempLine = "天氣偏熱，外面動一動就會不爽。";
  } else {
    tempLine = "真的很熱，今天就是熱這件事最煩。";
  }

  // ======================================================
  // 三、組合毛怪說一句（雨主線＋溫度補句）
  // ======================================================
  const maoLine = tempLine
    ? `${rainLine} ${tempLine}`
    : rainLine;

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
