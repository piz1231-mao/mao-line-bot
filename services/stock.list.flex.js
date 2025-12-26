// ======================================================
// 🛒 Stock List Flex Formatter（v2.2.0 小數點修正版）
// ------------------------------------------------------
// 修正重點：
// 1. fmt 函式補回 forceInt 參數
// 2. 針對 TWII, OTC, TXF 強制整數 (現價 & 漲跌)
// 3. 直接使用 service 傳來的 change/percent (避免重複計算)
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#008A3B"; // 綠
  return "#666666";                 // 平盤
}

function sign(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "";
}

// 🔥 1. 補回 forceInt 邏輯
function fmt(n, digits = 2, forceInt = false) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return forceInt 
    ? Math.round(Number(n)).toString() 
    : Number(n).toFixed(digits);
}

// ======================================================
// 🔹 單一項目
// ======================================================
function buildRow(item) {
  // 🔥 2. 直接使用 Service 算好的資料
  const { id, name, price, change, percent } = item;
  const color = colorByChange(change);

  // 🔥 3. 判斷是否為指數/期貨 (這三種都要整數)
  const isIndexLike = ["TWII", "OTC", "TXF"].includes(id);

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // 代號＋名稱
      {
        type: "text",
        text: `${id}  ${name}`,
        size: "md",
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // 價位列（固定欄位對齊）
      {
        type: "box",
        layout: "baseline",
        contents: [
          // 💎
          { type: "text", text: "💎", size: "sm", flex: 0 },

          // 價位 (應用 forceInt)
          {
            type: "text",
            // 🔥 4. 指數類 -> 強制整數
            text: fmt(price, 2, isIndexLike),
            size: "md",
            weight: "bold",
            color,
            flex: 3
          },

          // 漲跌 (應用 forceInt)
          {
            type: "text",
            // 🔥 5. 漲跌點數 -> 指數類也要整數
            text: `${sign(change)} ${fmt(Math.abs(change), 2, isIndexLike)}`,
            size: "md",
            weight: "bold",
            color,
            flex: 2
          },

          // 漲跌幅 (維持 2 位小數)
          {
            type: "text",
            text: `(${fmt(Math.abs(percent), 2)}%)`,
            size: "md",
            weight: "bold",
            color,
            flex: 2
          }
        ]
      }
    ]
  };
}

// ======================================================
// 🛒 清單主體
// ======================================================
function buildStockListFlex(list) {
  return {
    type: "flex",
    altText: "🛒 我的購物車",
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
            text: "🛒 我的購物車",
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          ...list.map(buildRow)
        ]
      }
    }
  };
}

module.exports = { buildStockListFlex };
