// ======================================================
// 📊 Stock / TXF Single Flex（定版最終版）
// - 股票 / 指數 / 台指期 共用
// - emoji 與欄位完全依照「之前定版畫面」
// ======================================================

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

function fmt(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

// ======================================================
// 💎 價位主行（股票 / 期貨共用）
// ======================================================
function buildPriceRow({ price, change, percent, isTXF }) {
  const color = colorByChange(change);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: "💎", size: "sm" },
      {
        type: "text",
        text: fmt(price, isTXF ? 0 : 2),
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },
      { type: "filler" },
      {
        type: "text",
        text: `${sign(change)} ${fmt(Math.abs(change), isTXF ? 0 : 2)}`,
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
// 🔹 Key / Value Row（依原本定版 emoji）
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
// 📈 股票 / 指數（完全照 3105 穩懋定版）
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

          buildPriceRow({ ...data, isTXF: false }),

          { type: "separator" },

          // ⬇️ 這一段 emoji、順序「完全不改」
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
// 📊 台指期 TXF（期貨專屬語意）
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

          buildPriceRow({ ...data, isTXF: true }),

          { type: "separator" },

          // ⬇️ 期貨用自己的 emoji（不混股票）
          buildKV("📌 開盤", fmt(data.open, 0)),
          buildKV("🔺 最高", fmt(data.high, 0)),
          buildKV("🔻 最低", fmt(data.low, 0)),
          buildKV("📦 總量", data.vol),
          buildKV("⏰ 時間", data.time)
        ]
      }
    }
  };
}

// ======================================================
// 🔥 唯一出口（index.js 用）
// ======================================================
function buildStockSingleFlex(data) {
  if (!data) return { type: "text", text: "⚠️ 查無資料" };

  if (data.id === "TXF" || data.name?.includes("台指期")) {
    return buildTXFFlex(data);
  }

  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
