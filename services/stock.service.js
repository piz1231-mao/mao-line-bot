// ======================================================
// 📊 Stock / TXF Single Flex（定版最終版）
// - 股票 / 指數 / 台指期 共用
// - 指數 / 台指期：不顯示小數
// - 個股：保留兩位小數
// ======================================================

// ------------------ 顏色 ------------------
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#0B8F3A"; // 綠
  return "#666666";                // 平盤
}

// ------------------ 箭頭 ------------------
function sign(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "—";
}

// ------------------ 數字格式 ------------------
function fmt(n, digits = 2, forceInt = false) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return forceInt
    ? Math.round(Number(n)).toString()
    : Number(n).toFixed(digits);
}

// ======================================================
// 💎 價位主行
// ======================================================
function buildPriceRow(data) {
  const { price, change, percent, id } = data;
  const color = colorByChange(change);

  // 指數 / 台指期 → 整數顯示
  const isIndexLike = ["TWII", "OTC", "TXF"].includes(id);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: "💎", size: "sm" },
      {
        type: "text",
        text: fmt(price, 2, isIndexLike),
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },
      { type: "filler" },
      {
        type: "text",
        text: `${sign(change)} ${fmt(Math.abs(change), 2, isIndexLike)}`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      },
      {
        type: "text",
        text: `(${fmt(Math.abs(percent), 2)}%)`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      }
    ]
  };
}

// ======================================================
// 🔹 Key / Value Row
// ======================================================
function buildKV(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: label, size: "md", color: "#888888", flex: 2 },
      { type: "text", text: String(value ?? "—"), size: "md", color: "#222222", flex: 4 }
    ]
  };
}

// ======================================================
// 📈 股票 / 指數
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

          buildPriceRow(data),

          { type: "separator" },

          buildKV("🔥 開盤", fmt(data.open)),
          buildKV("🏔️ 最高", fmt(data.high)),
          buildKV("🌊 最低", fmt(data.low)),
          buildKV("📉 昨收", fmt(data.yPrice)),
          buildKV("📦 成交", data.vol ? `${data.vol} 張` : "—"),
          buildKV("⏰ 時間", data.time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 📊 台指期 TXF
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
          {
            type: "text",
            text: "📊 期貨快報【台指期 TXF】",
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          buildPriceRow(data),

          { type: "separator" },

          buildKV("📌 開盤", fmt(data.open, 0, true)),
          buildKV("🔺 最高", fmt(data.high, 0, true)),
          buildKV("🔻 最低", fmt(data.low, 0, true)),
          buildKV("📦 總量", data.vol),
          buildKV("⏰ 時間", data.time)
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

  if (data.id === "TXF" || data.name?.includes("台指期")) {
    return buildTXFFlex(data);
  }

  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
console.log("🧪 stock.service exports =", module.exports);
