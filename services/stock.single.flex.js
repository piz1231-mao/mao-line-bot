// ======================================================
// 📊 Stock Single Flex（定版 v1.0）
// ======================================================

function colorByChange(c) {
  if (c > 0) return "#D32F2F";
  if (c < 0) return "#0B8F3A";
  return "#666666";
}

function sign(c) {
  if (c > 0) return "▲";
  if (c < 0) return "▼";
  return "—";
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

// ======================================================
// 💎 價位列（共用）
// ======================================================
function buildPriceRow(data, isTXF = false) {
  const color = colorByChange(data.change);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: "💎", size: "sm" },
      {
        type: "text",
        text: fmt(data.price, isTXF ? 0 : 2),
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },
      { type: "filler" },
      {
        type: "text",
        text: `${sign(data.change)} ${fmt(Math.abs(data.change), isTXF ? 0 : 2)}`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      },
      {
        type: "text",
        text: `(${fmt(Math.abs(data.percent), 2)}%)`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      }
    ]
  };
}

function buildKV(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: label, size: "md", color: "#888888", flex: 2 },
      { type: "text", text: String(value), size: "md", color: "#222222", flex: 4 }
    ]
  };
}

// ======================================================
// 📈 台指期
// ======================================================
function buildTXFFlex(data) {
  return {
    type: "flex",
    altText: "📊 台指期 TXF",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "📊 期貨快報【台指期 TXF】", size: "lg", weight: "bold" },
          { type: "separator" },
          buildPriceRow(data, true),
          { type: "separator" },
          buildKV("📌 開盤", fmt(data.open, 0)),
          buildKV("🔺 最高", fmt(data.high, 0)),
          buildKV("🔻 最低", fmt(data.low, 0)),
          { type: "separator" },
          buildKV("📦 總量", data.vol),
          buildKV("⏰ 時間", data.time)
        ]
      }
    }
  };
}

// ======================================================
// 📊 個股 / 指數
// ======================================================
function buildStockFlex(data) {
  return {
    type: "flex",
    altText: `${data.id} ${data.name}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `📊 股票快報【${data.id} ${data.name}】`,
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },
          buildPriceRow(data, false),
          { type: "separator" },
          buildKV("🌅 開盤", fmt(data.open)),
          buildKV("🏔️ 最高", fmt(data.high)),
          buildKV("🌊 最低", fmt(data.low)),
          buildKV("📉 昨收", fmt(data.yPrice)),
          buildKV("📦 成交", data.vol ? `${data.vol} 張` : "—"),
          buildKV("🕒 時間", data.time)
        ]
      }
    }
  };
}

// ======================================================
// 🔥 唯一出口
// ======================================================
function buildStockSingleFlex(data) {
  if (!data) return { type: "text", text: "⚠️ 查無資料" };
  if (data.id === "TXF") return buildTXFFlex(data);
  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
