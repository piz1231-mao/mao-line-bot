// ======================================================
// 📊 Stock / Futures Single Flex Formatter（定版）
// ------------------------------------------------------
// 用途：
// - 查個股（上市 / 上櫃）
// - 台指期 TXF
//
// 規格（已驗證）
// - 價位＋漲跌＋漲跌幅 同一行
// - baseline + spacer box 撐距（不黏、不爆）
// - 所有 text 一律為 string（避免 LINE 400）
// ======================================================

// ===== 色碼（券商風）=====
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#0B8F3A"; // 深綠
  return "#666666";                // 平盤灰
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
// 💎 價位主行（共用）
// ======================================================
function buildPriceRow({ price, yPrice, isTXF }) {
  const p = Number(price);
  const y = Number(yPrice);

  const change =
    !isNaN(p) && !isNaN(y) ? p - y : 0;

  const pct =
    !isNaN(p) && !isNaN(y) && y !== 0
      ? (change / y) * 100
      : 0;

  const color = colorByChange(change);

  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: "💎",
        size: "sm",
        flex: 0
      },
      {
        type: "text",
        text: fmt(p, isTXF ? 0 : 2),
        size: "lg",
        weight: "bold",
        color,
        flex: isTXF ? 3 : 2
      },

      // ===== spacer：撐開價格與漲跌 =====
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: []
      },

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
        color,
        flex: 2
      }
    ]
  };
}

// ======================================================
// 🔹 Key / Value Row（⚠️ value 一定轉字串）
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
        text:
          value === null || value === undefined
            ? "—"
            : String(value),
        size: "md",
        color: "#222222",
        flex: 4
      }
    ]
  };
}

// ======================================================
// 📊 個股 Flex
// ======================================================
function buildStockSingleFlex(data) {
  const {
    id,
    name,
    price,
    yPrice,
    open,
    high,
    low,
    vol,
    time
  } = data;

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
            yPrice,
            isTXF: false
          }),

          { type: "separator" },

          buildKV("🌅 開盤", fmt(open)),
          buildKV("🏔️ 最高", fmt(high)),
          buildKV("🌊 最低", fmt(low)),
          buildKV("📉 昨收", fmt(yPrice)),
          buildKV("📦 成交", vol ? `${vol} 張` : "—"),
          buildKV("🕒 時間", time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 📈 台指期 TXF Flex（專屬）
// ======================================================
function buildTXFFlex(data) {
  const {
    price,
    yPrice,
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
            yPrice,
            isTXF: true
          }),

          { type: "separator" },

          buildKV("📌 開盤", fmt(open, 0)),
          buildKV("🔺 最高", fmt(high, 0)),
          buildKV("🔻 最低", fmt(low, 0)),

          { type: "separator" },

          buildKV("📦 總量", vol ? String(vol) : "—"),
          buildKV("⏰ 時間", time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 🔥 單一出口（index.js 用）
// ======================================================
function buildStockSingleFlexMessage(data) {
  if (!data) {
    return {
      type: "text",
      text: "⚠️ 查無資料"
    };
  }

  if (data.id === "TXF" || data.name?.includes("台指期")) {
    return buildTXFFlex(data);
  }

  return buildStockSingleFlex(data);
}

module.exports = {
  buildStockSingleFlexMessage
};
