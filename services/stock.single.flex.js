// ======================================================
// 📊 Stock / Futures Single Flex Formatter（最終定版）
// ------------------------------------------------------
// ✔ 個股 / 台指期 共用
// ✔ 價位＋漲跌＋漲跌幅 同一行
// ✔ 三個數值字體大小一致
// ✔ 台指期使用 API 原生欄位（11, 56）
// ✔ 顏色與方向完全正確
// ✔ 僅使用 filler（避免 400）
// ======================================================

// ===== 色碼（券商風）=====
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#0B8F3A"; // 深綠
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
// 🧩 價位主行（共用）
// ======================================================
function buildPriceRow({ price, yPrice, change, pct, isTXF }) {
  const safeChange =
    change !== undefined && change !== null
      ? change
      : price !== null && yPrice !== null
      ? price - yPrice
      : 0;

  const safePct =
    pct !== undefined && pct !== null
      ? pct
      : yPrice
      ? (safeChange / yPrice) * 100
      : 0;

  const color = colorByChange(safeChange);

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

      // ⚠️ 只能用 filler
      { type: "filler" },

      {
        type: "text",
        text: `${sign(safeChange)} ${fmt(Math.abs(safeChange), isTXF ? 0 : 2)}`,
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },
      {
        type: "text",
        text: `(${fmt(Math.abs(safePct), 2)}%)`,
        size: "lg",
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
// 📊 個股 Flex
// ======================================================
function buildStockFlex(data) {
  const {
    id,
    name,
    price,
    yPrice,
    open,
    high,
    low,
    vol,
    time,
    change,
    pct
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
            change,
            pct,
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
// 📈 台指期 Flex（重點修正）
// ======================================================
function buildTXFFlex(data) {
  const {
    price,
    open,
    high,
    low,
    vol,
    time
  } = data;

  // ✅ 台指期專用欄位（你貼的 API）
  const change = data.change ?? data["11"]; // 64
  const pct = data.pct ?? data["56"];       // 0.22

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

          buildKV("📦 總量", vol || "—"),
          buildKV("⏰ 時間", time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 🔥 唯一出口（index.js 用）
// ======================================================
function buildStockSingleFlex(data) {
  if (!data) {
    return { type: "text", text: "⚠️ 查無資料" };
  }

  if (data.id === "TXF" || data.name?.includes("台指期")) {
    return buildTXFFlex(data);
  }

  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
