// ======================================================
// 📊 Stock / TXF Single Flex（修正小數點問題）
// ======================================================

// ------------------ 顏色 ------------------
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#0B8F3A"; // 綠
  return "#666666";                 // 平盤
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
    ? Math.round(Number(n)).toString() // 強制轉整數 (四捨五入)
    : Number(n).toFixed(digits);       // 保留小數
}

// ======================================================
// 💎 價位主行（這裡修好了）
// ======================================================
function buildPriceRow({ price, change, percent, id }) {
  const color = colorByChange(change);

  // 判斷是否為指數 (TWII, OTC) 或 台指期 (TXF)
  const isIndexLike = ["TWII", "OTC", "TXF"].includes(id);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: "💎", size: "sm", flex: 0 },
      
      // 1. 現價：如果是指數，digits=0 且 forceInt=true
      {
        type: "text",
        text: fmt(price, isIndexLike ? 0 : 2, isIndexLike), // 🔥 第三個參數補上了！
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },
      
      { type: "filler" },
      
      // 2. 漲跌：如果是指數，digits=0 且 forceInt=true
      {
        type: "text",
        text: `${sign(change)} ${fmt(Math.abs(change), isIndexLike ? 0 : 2, isIndexLike)}`, // 🔥 第三個參數補上了！
        size: "md",
        weight: "bold",
        color,
        flex: 2
      },
      
      // 3. 漲跌幅：永遠保持 2 位小數 (因為是百分比)
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
// 🔹 Key / Value Row（不動）
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
// 📈 股票 / 指數（這裡要補上開高低的小數點判斷）
// ======================================================
function buildStockFlex(data) {
  // 判斷是否為指數
  const isIndex = ["TWII", "OTC"].includes(data.id);

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

          // 🔥 這裡也要補上第三個參數，讓開高低也變整數
          buildKV("🔥 開盤", fmt(data.open, isIndex ? 0 : 2, isIndex)),
          buildKV("🏔️ 最高", fmt(data.high, isIndex ? 0 : 2, isIndex)),
          buildKV("🌊 最低", fmt(data.low, isIndex ? 0 : 2, isIndex)),
          buildKV("📉 昨收", fmt(data.yPrice, isIndex ? 0 : 2, isIndex)),
          buildKV("📦 成交", data.vol ? `${data.vol} 張` : "—"),
          buildKV("⏰ 時間", data.time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 📊 台指期 TXF（這裡原本就是強制整數，沒問題）
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

          buildPriceRow(data), // 這裡會吃到 buildPriceRow 的 isIndexLike 判斷

          { type: "separator" },

          buildKV("📌 開盤", fmt(data.open, 0, true)),
          buildKV("🔺 最高", fmt(data.high, 0, true)),
          buildKV("🔻 最低", fmt(data.low, 0, true)),
          
          { type: "separator" },

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
