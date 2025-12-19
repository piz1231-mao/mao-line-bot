/**
 * 將氣象署 36 小時資料轉成毛怪朋友版文字
 */
function buildWeatherFriendText(data) {
  const location = data?.records?.location?.[0];

  if (!location || !Array.isArray(location.weatherElement)) {
    throw new Error("Invalid weather data structure");
  }

  const city = location.locationName;
  const elements = location.weatherElement;

  const wx = elements.find(e => e.elementName === "Wx");
  const pop = elements.find(e => e.elementName === "PoP");
  const minT = elements.find(e => e.elementName === "MinT");
  const maxT = elements.find(e => e.elementName === "MaxT");

  const desc = wx?.time?.[0]?.parameter?.parameterName ?? "—";
  const rain = pop?.time?.[0]?.parameter?.parameterName ?? "—";
  const minTemp = minT?.time?.[0]?.parameter?.parameterName ?? "—";
  const maxTemp = maxT?.time?.[0]?.parameter?.parameterName ?? "—";

  return `【${city} 天氣預報】
天氣：${desc}
降雨機率：${rain}%
氣溫：${minTemp}°C ～ ${maxTemp}°C`;
}

module.exports = {
  buildWeatherFriendText
};
