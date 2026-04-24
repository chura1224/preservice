const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DASHBOARD_PATH = path.join(ROOT, "data", "dashboard.json");
const CONFIG_PATH = path.join(ROOT, "config.local.json");
const FOODSAFETY_ORIGIN = "https://www.foodsafetykorea.go.kr";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === "/api/dashboard") {
      const dashboard = readJsonFile(DASHBOARD_PATH);
      sendJson(response, 200, dashboard);
      return;
    }

    if (url.pathname === "/api/lunch") {
      const date = url.searchParams.get("date") || getTodayKey();
      const payload = await getLunchPayload(date);
      sendJson(response, 200, payload);
      return;
    }

    serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error.message,
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`교생 안내 보드 서버 실행 중: http://${HOST}:${PORT}`);
});

function serveStatic(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));

  if (!filePath.startsWith(ROOT)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendText(response, 404, "Not found");
        return;
      }

      sendText(response, 500, "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    response.end(file);
  });
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadConfig() {
  const envConfig = {
    foodsafety: {
      schoolCode: process.env.FOODSAFETY_SCHOOL_CODE || "",
      schoolName: process.env.FOODSAFETY_SCHOOL_NAME || "",
      region: process.env.FOODSAFETY_REGION || "",
      menuNo: process.env.FOODSAFETY_MENU_NO || "3017",
    },
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return envConfig;
  }

  const fileConfig = readJsonFile(CONFIG_PATH);
  return {
    foodsafety: {
      ...envConfig.foodsafety,
      ...(fileConfig.foodsafety || {}),
    },
  };
}

async function getLunchPayload(dateKey) {
  const config = loadConfig();
  const { menuNo, region, schoolName } = config.foodsafety;
  let { schoolCode } = config.foodsafety;

  if (!schoolCode && (!schoolName || !region)) {
    return {
      ok: false,
      statusText: "설정 필요",
      summary: "config.local.json에 지역과 학교명을 넣으면 식품안전나라에서 자동 조회됩니다.",
      items: ["학교명과 지역 또는 학교코드를 설정해 주세요."],
    };
  }

  try {
    if (!schoolCode) {
      schoolCode = await findSchoolCode({
        menuNo,
        region,
        schoolName,
      });
    }

    const dateInfo = parseDateKey(dateKey);
    const week = getWeekOfMonth(dateInfo.year, dateInfo.month, dateInfo.day);
    const payload = await postFoodsafety("/portal/sensuousmenu/selectSchoolWeekMealsDetail.do", {
      menu_no: menuNo,
      schl_cd: schoolCode,
      type_cd: "W",
      year: String(dateInfo.year),
      month: String(dateInfo.month),
      week: String(week),
    });
    const result = parseFoodsafetyWeekResponse(payload, dateInfo.day);

    return {
      ok: result.ok,
      statusText: result.ok ? "오늘 급식" : "급식 없음",
      summary: result.summary,
      items: result.items,
    };
  } catch (error) {
    return {
      ok: false,
      statusText: "조회 실패",
      summary: "식품안전나라 급식 정보를 불러오지 못했습니다. 학교명이나 지역 설정을 다시 확인해 주세요.",
      items: [error.message],
    };
  }
}

async function findSchoolCode({ menuNo, region, schoolName }) {
  const payload = await postFoodsafety("/portal/sensuousmenu/selectSchoolMeals_school.do", {
    menu_no: menuNo,
    region,
    search_keyword: schoolName,
  });

  const list = Array.isArray(payload.list) ? payload.list : [];
  if (!list.length) {
    throw new Error("학교 검색 결과가 없습니다. 학교명이나 지역을 다시 확인해 주세요.");
  }

  const exactMatch = list.find((item) => String(item.schl_nm).trim() === String(schoolName).trim());
  return (exactMatch || list[0]).schl_cd;
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

function parseFoodsafetyWeekResponse(payload, targetDay) {
  const list = Array.isArray(payload.list) ? payload.list : [];
  const matched = list.find((item) => Number(item.dd_date) === Number(targetDay));

  if (!matched || !matched.lunch) {
    return {
      ok: false,
      summary: "오늘 등록된 중식 정보가 없거나 급식이 없는 날일 수 있습니다.",
      items: ["등록된 급식 정보가 없습니다."],
    };
  }

  const dishNames = String(matched.lunch || "")
    .split(/\n+/)
    .map((item) => sanitizeDishName(item))
    .filter(Boolean);

  return {
    ok: true,
    summary: `${matched.week_day}요일 중식`,
    items: dishNames,
  };
}

function sanitizeDishName(value) {
  return String(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/[①-⑬]/g, "")
    .replace(/[0-9]+\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateKey(dateKey) {
  const normalized = String(dateKey);
  return {
    year: Number(normalized.slice(0, 4)),
    month: Number(normalized.slice(4, 6)),
    day: Number(normalized.slice(6, 8)),
  };
}

function getWeekOfMonth(year, month, day) {
  const monthStartDay = new Date(year, month - 1, 1).getDay();
  return Math.floor((day + monthStartDay - 1) / 7) + 1;
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}
