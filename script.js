const appState = {
  dashboard: null,
  lunch: null,
  selectedDate: null
};
let layoutRefreshHandle = null;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

resetScrollPosition();
document.addEventListener('DOMContentLoaded', queueScrollReset);
window.addEventListener('load', queueScrollReset);
window.addEventListener('pageshow', queueScrollReset);
window.addEventListener("board:unlocked", stabilizeDashboardLayout);
window.addEventListener("resize", queueLayoutRefresh);

const CLEANING_SLOT = {
  id: "cleaning",
  afterPeriod: 6,
  label: "청소시간",
  time: "15:20-15:40",
  values: ["청소시간", "청소시간", "청소시간", "청소시간", "청소시간"]
};

initialize();

function resetScrollPosition() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function queueScrollReset() {
  resetScrollPosition();
  window.setTimeout(resetScrollPosition, 0);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(resetScrollPosition);
  });
}

async function initialize() {
  const fallbackDashboard = window.__DASHBOARD_DATA__ || null;
  let dashboard = fallbackDashboard;

  try {
    dashboard = await fetchJson("/api/dashboard");
  } catch (error) {
    if (!fallbackDashboard) {
      console.error(error);
      renderErrorState();
      return;
    }
  }

  appState.dashboard = dashboard;
  renderDashboard(dashboard);
  bindCalendarSelection();
  window.setInterval(refreshCurrentTimeState, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      stabilizeDashboardLayout();
    }
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(stabilizeDashboardLayout).catch(() => {});
  } else {
    window.setTimeout(stabilizeDashboardLayout, 0);
  }

  try {
    const lunch = await fetchJson(`/api/lunch?date=${formatDateKey(new Date())}`);
    appState.lunch = lunch;
    renderLunch(lunch);
  } catch (error) {
    const fallbackLunch = dashboard?.lunchFallback || {
      ok: false,
      statusText: "급식 확인 필요",
      summary: "직접 파일로 열면 급식 자동 조회가 동작하지 않을 수 있습니다.",
      items: ["브라우저에서 직접 파일을 열어 확인 중인 경우 수동 안내 문구가 표시됩니다."]
    };
    appState.lunch = fallbackLunch;
    renderLunch(fallbackLunch);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function renderDashboard(data) {
  const now = new Date();
  const todayIso = formatIsoDate(now);
  appState.currentDateKey = todayIso;

  appState.selectedDate = appState.selectedDate || todayIso;

  text("boardEyebrow", data.board?.eyebrow || "Teacher Residency Board");
  text("boardTitle", data.board?.title || "2학년 5반 교생 안내 보드");
  text("todayLabel", formatKoreanDate(now));
  text("mobileHeroTitle", data.board?.mobileHeroTitle || "필요한 메뉴만 바로 보기");
  text("mobileHeroDescription", data.board?.mobileHeroDescription || "모바일에서는 자주 보는 메뉴만 크게 두고, 상세 내용은 각 페이지에서 확인할 수 있도록 구성했습니다.");
  text("mobileHighlightLabel", data.board?.highlight?.label || "오늘 안내");
  text("mobileHighlightValue", data.board?.highlight?.value || "전달사항과 급식을 먼저 확인해 주세요.");

  text("tabletCalendarTitle", `${now.getMonth() + 1}월 학급 일정`);
  text("tabletMonthBadge", `${now.getMonth() + 1}월`);
  text("desktopMonthBadge", `${now.getFullYear()}년 ${now.getMonth() + 1}월`);
  text("desktopCalendarTitle", `${data.board?.roomLabel || "2학년 5반"} 월간 운영 보드`);
  text("tabletPersonalTitle", "담임 시간표");
  text("tabletClassTitle", `${data.board?.roomLabel || "2학년 5반"} 시간표`);
  text("tabletNoticeTitle", formatNoticeHeading(now));
  text("desktopNoticeTitle", formatNoticeHeading(now));

  renderQuickLinks("tabletQuickLinks", data.quickLinks || []);
  renderQuickLinks("desktopQuickLinks", data.quickLinks || []);

  renderMiniCalendar("tabletCalendarMini", data.events || [], todayIso, appState.selectedDate);
  renderEventNotes("tabletEventList", data.events || []);
  renderDesktopCalendar("desktopCalendarBoard", data.events || [], now, appState.selectedDate);
  renderSelectedDateContext(appState.selectedDate);

  renderCurrentSchedules(data, now);

  setBadgeState("tabletClassBadge", "sky", "주간 보기");
  setBadgeState("desktopClassBadge", "sky", "주간 보기");
}

function bindCalendarSelection() {
  ["tabletCalendarMini", "desktopCalendarBoard"].forEach((targetId) => {
    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    element.addEventListener("click", (event) => {
      const dateCell = event.target.closest("[data-date]");
      if (!dateCell) {
        return;
      }

      appState.selectedDate = dateCell.dataset.date;
      renderSelectedDateContext(appState.selectedDate);
      renderMiniCalendar("tabletCalendarMini", appState.dashboard?.events || [], formatIsoDate(new Date()), appState.selectedDate);
      renderDesktopCalendar("desktopCalendarBoard", appState.dashboard?.events || [], new Date(), appState.selectedDate);
    });
  });
}

function renderSelectedDateContext(selectedDate) {
  renderSelectedDatePanels(selectedDate);
  renderNoticePanels(selectedDate);
}

function renderSelectedDatePanels(selectedDate) {
  const events = (appState.dashboard?.events || []).filter((item) => item.date === selectedDate);
  const content = buildSelectedDateContent(selectedDate, events);
  html("tabletSelectedDateContent", content);
  html("desktopSelectedDateContent", content);
}

function buildSelectedDateContent(selectedDate, events) {
  const title = `<strong>${escapeHtml(formatDateDisplay(selectedDate))}</strong>`;
  if (!events.length) {
    return `${title}<div class="selected-date-empty">등록된 일정이 없습니다.</div>`;
  }

  const items = events.map((event) => `<li>${escapeHtml(event.title)}</li>`).join("");
  return `${title}<ul class="selected-date-list">${items}</ul>`;
}

function renderNoticePanels(selectedDate) {
  const noticeHeadingDate = selectedDate ? new Date(selectedDate) : new Date();
  const title = formatNoticeHeading(noticeHeadingDate);
  text("tabletNoticeTitle", title);
  text("desktopNoticeTitle", title);

  const datedNotices = buildDateNoticeEntries(
    selectedDate,
    appState.dashboard?.events || [],
    appState.dashboard?.notices || [],
    appState.dashboard?.datedNotices || []
  );
  renderNotices("tabletNoticeList", datedNotices);
  renderNotices("desktopNoticeList", datedNotices);
}

function buildDateNoticeEntries(selectedDate, events, defaultNotices, datedNotices) {
  const matchedNoticeGroup = (datedNotices || []).find((item) => item.date === selectedDate);
  if (matchedNoticeGroup?.items?.length) {
    return matchedNoticeGroup.items;
  }

  const matchedEvents = (events || []).filter((item) => item.date === selectedDate);
  if (matchedEvents.length) {
    return matchedEvents.map((event) => ({
      title: event.title,
      body: "해당 날짜 일정입니다."
    }));
  }

  return defaultNotices || [];
}

function renderLunch(lunch) {
  const items = lunch.items && lunch.items.length ? lunch.items : ["급식 정보가 없습니다."];
  renderList("tabletLunchList", items);
  renderList("desktopLunchList", items);

  text("tabletLunchDescription", lunch.summary || "급식 정보가 없습니다.");
  text("desktopLunchDescription", lunch.summary || "급식 정보가 없습니다.");
  setBadgeState("tabletLunchBadge", lunch.ok ? "mint" : "amber", lunch.statusText || "오늘 급식");
  setBadgeState("desktopLunchBadge", lunch.ok ? "mint" : "amber", lunch.statusText || "오늘 급식");
}

function renderErrorState() {
  renderList("tabletLunchList", ["데이터를 불러오지 못했습니다."]);
  renderList("desktopLunchList", ["데이터를 불러오지 못했습니다."]);
  renderNotices("tabletNoticeList", [{ title: "안내", body: "데이터 파일 또는 서버 상태를 확인해 주세요." }]);
  renderNotices("desktopNoticeList", [{ title: "안내", body: "데이터 파일 또는 서버 상태를 확인해 주세요." }]);
}

function renderList(targetId, items) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  if (!items || !items.length) {
    element.innerHTML = '<li class="empty-state">표시할 내용이 없습니다.</li>';
    return;
  }

  element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderQuickLinks(targetId, items) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  element.innerHTML = items
    .map((item) => {
      if (item.href) {
        return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>`;
      }
      return `<div>${escapeHtml(item.title)}</div>`;
    })
    .join("");
}

function renderNotices(targetId, notices) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  if (!notices || !notices.length) {
    element.innerHTML = '<div class="notice-card"><p class="notice-body">표시할 전달사항이 없습니다.</p></div>';
    return;
  }

  element.innerHTML = notices
    .map((notice) => {
      const normalized = typeof notice === "string" ? { title: "전달사항", body: notice } : notice;
      const files = (normalized.files || [])
        .map((file) => `<a class="notice-file" href="${escapeHtml(file.href)}">${escapeHtml(file.label)}</a>`)
        .join("");

      return `
        <article class="notice-card">
          <div class="notice-topline">
            <p class="notice-title">${escapeHtml(normalized.title || "전달사항")}</p>
          </div>
          <p class="notice-body">${escapeHtml(normalized.body || "")}</p>
          ${files ? `<div class="notice-files">${files}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderScheduleGrid(targetId, timetable, todayDayName, currentSlot, periodTimes) {
  const element = document.getElementById(targetId);
  if (!element || !timetable) {
    return;
  }

  element.style.gridTemplateColumns = `84px repeat(${timetable.days.length}, minmax(0, 1fr))`;
  const cells = ['<div class="corner" aria-hidden="true"></div>'];

  timetable.days.forEach((day) => {
    const dayClasses = ["day-header", day === todayDayName ? "current-day" : ""].filter(Boolean).join(" ");
    cells.push(`<div class="${dayClasses}">${escapeHtml(day)}</div>`);
  });

  buildScheduleRows(timetable.rows || [], periodTimes || [], timetable.days || []).forEach((row) => {
    const isCleaningRow = row.id === CLEANING_SLOT.id;
    cells.push(`
      <div class="label ${isCleaningRow ? "cleaning-label" : ""}">
        <span class="label-period">${escapeHtml(row.label)}</span>
        <span class="label-time">${escapeHtml(row.time)}</span>
      </div>
    `);

    row.values.forEach((value, index) => {
      const isHiddenSlot = shouldHideSlot(timetable.days[index], row.id);
      const subjectTone = getScheduleTone(value, Boolean(row.isClassTimetable));
      const isLive = timetable.days[index] === todayDayName && row.id === currentSlot;
      const isEmpty = !value || value === "-";
      const classes = [
        "cell",
        isHiddenSlot ? "no-slot" : "",
        isLive ? "live" : "",
        isCleaningRow ? "cleaning" : "",
        isEmpty ? "is-empty" : "",
        subjectTone
      ].filter(Boolean).join(" ");

      cells.push(`
        <div class="${classes}">
          ${isHiddenSlot ? "" : `<span class="schedule-text">${scheduleTextToHtml(value || "-")}</span>`}
        </div>
      `);
    });
  });

  element.innerHTML = cells.join("");
}

function buildScheduleRows(rows, periodTimes, days) {
  const normalized = [];
  const dayCount = days.length;

  rows.forEach((row) => {
    const period = Number(row.period);
    normalized.push({
      id: String(period),
      label: `${period}교시`,
      time: findPeriodTime(periodTimes, period),
      values: row.values || Array(dayCount).fill("-"),
      isClassTimetable: containsClassTeacherInfo(row.values || [])
    });

    if (period === CLEANING_SLOT.afterPeriod) {
      normalized.push({
        id: CLEANING_SLOT.id,
        label: CLEANING_SLOT.label,
        time: CLEANING_SLOT.time,
        values: buildCleaningValues(days),
        isClassTimetable: false
      });
    }
  });

  return normalized;
}

function containsClassTeacherInfo(values) {
  return values.some((value) => String(value || "").includes("\n"));
}

function findPeriodTime(periodTimes, period) {
  const match = (periodTimes || []).find((slot) => Number(slot.period) === Number(period));
  if (!match) {
    return "시간 미정";
  }
  return `${match.start}-${match.end}`;
}

function buildCleaningValues(days) {
  return days.map((day) => (day === "수" ? "-" : "청소시간"));
}

function shouldHideSlot(day, rowId) {
  return day === "수" && (rowId === CLEANING_SLOT.id || rowId === "7");
}

function getScheduleTone(value, isClassTimetable) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();

  if (!normalized || normalized === "-" || normalized === "청소시간") {
    return "";
  }

  if (normalized.includes("대수(2-4)")) {
    return "tone-daesu-24";
  }
  if (normalized.includes("대수(2-5)") || (isClassTimetable && normalized.includes("대수"))) {
    return "tone-daesu-25";
  }
  if (normalized.includes("대수(2-6)")) {
    return "tone-daesu-26";
  }
  if (normalized.includes("인수")) {
    return "tone-insu";
  }
  if (normalized.includes("영어1")) {
    return "tone-english";
  }
  if (normalized.includes("운동")) {
    return "tone-sports";
  }
  if (normalized.includes("진로")) {
    return "tone-career";
  }
  if (normalized.includes("창체")) {
    return "tone-creative";
  }
  if (normalized.includes("화언")) {
    return "tone-language";
  }
  if (normalized.includes("음연")) {
    return "tone-music";
  }
  if (["A", "B", "C", "D", "E", "F"].includes(normalized)) {
    return `tone-block-${normalized.toLowerCase()}`;
  }

  return "tone-default";
}

function renderMiniCalendar(targetId, events, todayIso, selectedDate) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  element.innerHTML = sorted
    .map((event) => {
      const date = new Date(event.date);
      const classes = [
        event.date === todayIso ? "today" : "",
        event.date === selectedDate ? "selected" : "",
        "has-event"
      ].filter(Boolean).join(" ");
      return `<div class="${classes}" data-date="${event.date}">${date.getDate()}</div>`;
    })
    .join("");
}

function renderEventNotes(targetId, events) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  element.innerHTML = events
    .slice(0, 4)
    .map((event) => {
      const date = new Date(event.date);
      return `<p><strong>${date.getDate()}일</strong> ${escapeHtml(event.title)}</p>`;
    })
    .join("");
}

function renderDesktopCalendar(targetId, events, today, selectedDate) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells = ["일", "월", "화", "수", "목", "금", "토"].map((day) => `<div class="dow">${day}</div>`);

  for (let index = 0; index < startOffset; index += 1) {
    cells.push('<div class="date muted-date"></div>');
  }

  for (let dateNumber = 1; dateNumber <= lastDate; dateNumber += 1) {
    const date = new Date(year, month, dateNumber);
    const iso = formatIsoDate(date);
    const isToday = iso === formatIsoDate(today);
    const isSelected = iso === selectedDate;
    const titles = events.filter((event) => event.date === iso).map((event) => event.title);
    const hasEvent = titles.length > 0;
    const classes = ["date", isToday ? "today" : "", isSelected ? "selected" : "", hasEvent ? "has-event" : ""].filter(Boolean).join(" ");
    const notes = hasEvent ? renderCalendarNotesForCell(titles) : "";
    cells.push(`<div class="${classes}" data-date="${iso}"><span>${dateNumber}</span>${notes}</div>`);
  }

  element.innerHTML = cells.join("");
}

function renderCalendarNotesForCell(titles) {
  const visibleTitles = titles.slice(0, 2);
  const hiddenCount = Math.max(0, titles.length - visibleTitles.length);
  const noteItems = visibleTitles.map((title) => `<small class="date-note">${escapeHtml(summarizeEventTitle(title))}</small>`);

  if (hiddenCount > 0) {
    noteItems.push(`<small class="date-note more">+${hiddenCount}</small>`);
  }

  return `<div class="date-notes">${noteItems.join("")}</div>`;
}

function summarizeEventTitle(title) {
  const normalized = String(title)
    .replace(/\s+/g, " ")
    .replace("시간 ", "")
    .replace(" 방문", "방문")
    .trim();

  if (normalized.length <= 10) {
    return normalized;
  }

  return `${normalized.slice(0, 10)}…`;
}

function setBadgeState(targetId, stateName, textValue) {
  const badge = document.getElementById(targetId);
  if (!badge) {
    return;
  }

  badge.className = `panel-chip ${stateName}`;
  badge.textContent = textValue;
}

function text(targetId, value) {
  const element = document.getElementById(targetId);
  if (element) {
    element.textContent = value;
  }
}

function html(targetId, value) {
  const element = document.getElementById(targetId);
  if (element) {
    element.innerHTML = value;
  }
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

function formatKoreanDate(date) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });
}

function formatNoticeHeading(date) {
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }) + " 전달사항";
}

function dayName(index) {
  return ["일", "월", "화", "수", "목", "금", "토"][index];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scheduleTextToHtml(value) {
  return String(value || "-")
    .split("\n")
    .map((line) => `<span class="schedule-line">${escapeHtml(line)}</span>`)
    .join("");
}

function getCurrentSlot(periodTimes, now) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cleaningStart = parseClock("15:20");
  const cleaningEnd = parseClock("15:40");
  const today = dayName(now.getDay());

  if (today !== "수" && currentMinutes >= cleaningStart && currentMinutes < cleaningEnd) {
    return CLEANING_SLOT.id;
  }

  for (const slot of periodTimes || []) {
    const startMinutes = parseClock(slot.start);
    const endMinutes = parseClock(slot.end);
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return String(slot.period);
    }
  }

  return null;
}

function refreshCurrentTimeState() {
  if (!appState.dashboard) {
    return;
  }

  const now = new Date();
  const currentDateKey = formatIsoDate(now);

  if (appState.currentDateKey !== currentDateKey) {
    renderDashboard(appState.dashboard);
    if (appState.lunch) {
      renderLunch(appState.lunch);
    }
    return;
  }

  text("todayLabel", formatKoreanDate(now));
  text("tabletNoticeTitle", formatNoticeHeading(now));
  text("desktopNoticeTitle", formatNoticeHeading(now));
  renderCurrentSchedules(appState.dashboard, now);
}

function stabilizeDashboardLayout() {
  if (!appState.dashboard) {
    return;
  }

  refreshCurrentTimeState();
  queueScrollReset();
  window.requestAnimationFrame(() => {
    refreshCurrentTimeState();
    queueScrollReset();
  });
}

function queueLayoutRefresh() {
  if (layoutRefreshHandle) {
    window.clearTimeout(layoutRefreshHandle);
  }

  layoutRefreshHandle = window.setTimeout(() => {
    layoutRefreshHandle = null;
    if (!document.hidden) {
      stabilizeDashboardLayout();
    }
  }, 120);
}

function renderCurrentSchedules(data, now = new Date()) {
  const todayDayName = dayName(now.getDay());
  const currentSlot = getCurrentSlot(data.periodTimes || [], now);

  renderScheduleGrid("tabletPersonalGrid", data.personalTimetable, todayDayName, currentSlot, data.periodTimes || []);
  renderScheduleGrid("desktopPersonalList", data.personalTimetable, todayDayName, currentSlot, data.periodTimes || []);
  renderScheduleGrid("tabletClassList", data.classTimetable, todayDayName, currentSlot, data.periodTimes || []);
  renderScheduleGrid("desktopClassList", data.classTimetable, todayDayName, currentSlot, data.periodTimes || []);
}

function parseClock(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}


