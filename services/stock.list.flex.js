// ======================================================
// 📋 Stock List Flex（購物車定版 v1.0）
// ------------------------------------------------------
// 用途：
// - 查購物車 / 查清單
// - 精簡顯示：名稱 + 價位 + 漲跌 + 漲跌幅
//
// 規格：
// - baseline + filler（與單一個股完全一致）
// - 固定 flex 欄位，視覺對齊
// - 不使用空 box（避免 400）
// ======================================================

// ===== 色碼（與 single 完全一致）=====
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
// 🧩 單一購物車列（核心）
// ======================================================
function buildListRow({ name, price, yPrice, isTXF }) {
  const change =
    price !== null && yPrice !== null ? price - yPrice : 0;

  const pct =
    yPrice ? (change / yPrice) * 100 : 0;

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
        text: fmt(price, isTXF ? 0 : 2),
        size: "md",
        weight: "bold",
        color,
        flex: 3
      },

      // ✅ 關鍵：filler 撐距（安全）
      {
        type: "filler",
        flex: 1
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
// 📋 購物車 Flex 主體
// ======================================================
function buildStockListFlex(list = []) {
  if (!list.length) {
    return {
      type: "text",
      text: "📋 我的購物車\n━━━━━━━━━━━\n\n（清單是空的）"
    };
  }

  const rows = [];

  for (const s of list) {
    rows.push(
      buildListRow({
        name: s.name,
        price: s.price,
        yPrice: s.yPrice,
        isTXF: s.id === "TXF" || s.name?.includes("台指")
      })
    );
  }

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
          ...rows
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
