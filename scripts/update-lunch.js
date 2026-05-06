const fs = require("fs");
const path = require("path");

const DASHBOARD_PATH = path.join(__dirname, "..", "dashboard-data.js");
const FOODSAFETY_ORIGIN = "https://www.foodsafetykorea.go.kr";
const MENU_NO = process.env.FOODSAFETY_MENU_NO || "3017";
const SCHOOL_CODE = process.env.FOODSAFETY_SCHOOL_CODE || "7004207";
const TZ = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

async function main() {
  const today = getSeoulToday();
  const week = getWeekOfMonth(today.year, today.month, today.day);
  const payload = await postFoodsafety("/portal/sensuousmenu/selectSchoolWeekMealsDetail.do", {
    menu_no: MENU_NO,
    schl_cd: SCHOOL_CODE,
    type_cd: "W",
    year: String(today.year),
    month: String(today.month),
    week: String(week),
  });

  const lunchData = parseFoodsafetyWeekResponse(payload, today);
  updateDashboardFile(lunchData);
  console.log(`Updated lunchFallback for ${today.year}-${pad2(today.month)}-${pad2(today.day)}`);
}

async function postFoodsafety(endpointPath, bodyObject) {
  const response = await fetch(`${FOODSAFETY_ORIGIN}${endpointPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams(bodyObject),
  });

  if (!response.ok) {
    throw new Error(`식품안전나라 응답 오류: ${response.status}`);
  }

  return response.json();
}

function parseFoodsafetyWeekResponse(payload, today) {
  const list = Array.isArray(payload.list) ? payload.list : [];
  const matched = list.find((item) => Number(item.dd_date) === Number(today.day));
  const weekday = WEEKDAYS[new Date(today.year, today.month - 1, today.day).getDay()];

  if (!matched || !matched.lunch) {
    return {
      ok: false,
      statusText: "오늘 급식 없음",
      summary: `${today.year}년 ${today.month}월 ${today.day}일 ${weekday}요일 급식 정보 없음`,
      items: ["등록된 급식 정보가 없습니다."],
    };
  }

  const dishNames = String(matched.lunch || "")
    .split(/\n+/)
    .map((item) => sanitizeDishName(item))
    .filter(Boolean);

  return {
    ok: true,
    statusText: "오늘 급식",
    summary: `${today.year}년 ${today.month}월 ${today.day}일 ${weekday}요일 중식`,
    items: dishNames,
  };
}

function sanitizeDishName(value) {
  return String(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/[0-9]+\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function updateDashboardFile(lunchData) {
  const source = fs.readFileSync(DASHBOARD_PATH, "utf8");
  const replacement = [
    '  "lunchFallback": {',
    `    "ok": ${lunchData.ok ? "true" : "false"},`,
    `    "statusText": ${toJsString(lunchData.statusText)},`,
    `    "summary": ${toJsString(lunchData.summary)},`,
    '    "items": [',
    lunchData.items.map((item) => `      ${toJsString(item)}`).join(",\n"),
    "    ]",
    "  },",
  ].join("\n");

  const updated = source.replace(/  "lunchFallback": \{[\s\S]*?^  \},/m, replacement);

  if (updated === source) {
    throw new Error('dashboard-data.js에서 "lunchFallback" 블록을 찾지 못했습니다.');
  }

  fs.writeFileSync(DASHBOARD_PATH, updated, "utf8");
}

function getSeoulToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === "year").value),
    month: Number(parts.find((part) => part.type === "month").value),
    day: Number(parts.find((part) => part.type === "day").value),
  };
}

function getWeekOfMonth(year, month, day) {
  const monthStartDay = new Date(year, month - 1, 1).getDay();
  return Math.floor((day + monthStartDay - 1) / 7) + 1;
}

function toJsString(value) {
  return JSON.stringify(String(value));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
