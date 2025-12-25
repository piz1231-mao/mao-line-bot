// ======================================================
// 📊 Stock / Futures Single Flex Formatter（最終定版）
// - 個股：理解算
// - 台指期：只吃 API 原始欄位，不計算
// ======================================================

// ===== 色碼 =====
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#0B8F3A"; // 綠
  return "#666666";                // 平盤
}

function sign(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "—";
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

// ======================================================
// 🧩 價位列（共用排版，不共用邏輯）
// ======================================================
function buildPriceRow({ price, change, pct, digits }) {
  const color = colorByChange(change);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: "💎", size: "sm" },

      {
        type: "text",
        text: fmt(price, digits),
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },

      { type: "filler" },

      {
        type: "text",
        text: `${sign(change)} ${fmt(Math.abs(change), digits)}`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      },
      {
        type: "text",
        text: `(${fmt(Math.abs(pct), 2)}%)`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      }
    ]
  };
}

// ======================================================
// 📊 個股 Flex（可算）
// ======================================================
function buildStockFlex(data) {
  const { id, name, price, yPrice, open, high, low, vol, time } = data;

  const change = price - yPrice;
  const pct = yPrice ? (change / yPrice) * 100 : 0;

  return {
    type: "flex",
    altText: `${id} ${name}`,
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
            text: `📊 股票快報【${id} ${name}】`,
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          buildPriceRow({
            price,
            change,
            pct,
            digits: 2
          }),

          { type: "separator" },

          buildKV("🌅 開盤", fmt(open)),
          buildKV("🔺 最高", fmt(high)),
          buildKV("🔻 最低", fmt(low)),
          buildKV("📉 昨收", fmt(yPrice)),
          buildKV("📦 成交", vol ? `${vol} 張` : "—"),
          buildKV("⏰ 時間", time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 📈 台指期 Flex（⚠️ 不算，只對欄位）
// ======================================================
function buildTXFFlex(data) {
  const price  = Number(data.price);
  const change = Number(data["11"]); // API 原始
  const pct    = Number(data["56"]); // API 原始

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

          buildPriceRow({
            price,
            change,
            pct,
            digits: 0
          }),

          { type: "separator" },

          buildKV("📌 開盤", fmt(data.open, 0)),
          buildKV("🔺 最高", fmt(data.high, 0)),
          buildKV("🔻 最低", fmt(data.low, 0)),

          { type: "separator" },

          buildKV("📦 總量", data.vol || "—"),
          buildKV("⏰ 時間", data.time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 🔹 Key / Value
// ======================================================
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
