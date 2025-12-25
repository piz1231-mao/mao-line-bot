// ======================================================
// 📊 Stock / Futures Single Flex Formatter（TXF 修正定版）
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

function fmt(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

// ======================================================
// 🧩 價位主行（⚠️ 不做任何計算）
// ======================================================
function buildPriceRow({ price, change, pct, isTXF }) {
  const color = colorByChange(change);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: "💎",
        size: "sm"
      },
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
// 🔹 Key / Value
// ======================================================
function buildKV(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size: "md",
        color: "#888888",
        flex: 2
      },
      {
        type: "text",
        text: String(value),
        size: "md",
        color: "#222222",
        flex: 4
      }
    ]
  };
}

// ======================================================
// 📈 台指期 TXF（只貼 API 給的值）
// ======================================================
function buildTXFFlex(data) {
  const {
    price,
    change,
    pct,
    open,
    high,
    low,
    vol,
    time
  } = data;

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
            isTXF: true
          }),

          { type: "separator" },

          buildKV("📌 開盤", fmt(open, 0)),
          buildKV("🔺 最高", fmt(high, 0)),
          buildKV("🔻 最低", fmt(low, 0)),

          { type: "separator" },

          buildKV("📦 總量", vol),
          buildKV("⏰ 時間", time)
        ]
      }
    }
  };
}

// ======================================================
// 🔥 唯一出口
// ======================================================
function buildStockSingleFlex(data) {
  if (!data) {
    return { type: "text", text: "⚠️ 查無資料" };
  }

  if (data.id === "TXF" || data.name?.includes("台指期")) {
    return buildTXFFlex(data);
  }

  // 個股你原本那套是 OK 的
  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
