const dashboard = window.__DASHBOARD_DATA__;
const page = document.body.dataset.page;
let timetableRefreshHandle = null;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

resetScrollPosition();
document.addEventListener('DOMContentLoaded', queueScrollReset);
window.addEventListener('load', queueScrollReset);
window.addEventListener('pageshow', queueScrollReset);

const CLEANING_SLOT = {
  id: "cleaning",
  afterPeriod: 6,
  label: "청소시간",
  time: "15:20-15:40",
  values: ["청소시간", "청소시간", "청소시간", "청소시간", "청소시간"]
};

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

document.addEventListener("DOMContentLoaded", initializeDetailPage);
window.addEventListener("pageshow", initializeDetailPage);
initializeDetailPage();
window.setTimeout(initializeDetailPage, 0);

function initializeDetailPage() {
  if (!dashboard || !page) {
    return;
  }

  if (page === "roster") {
    text("rosterSectionTitle", dashboard.roster.title || "학생 사진 명렬표");
    text("rosterSectionDescription", dashboard.roster.description || "");
    renderRosterGrid("sharedRosterGrid", dashboard.roster.students || []);
  }

  if (page === "roles") {
    text("rolesSectionTitle", "2학년 5반 1인 1역 역할표");
    text("rolesSectionDescription", "올려주신 역할표를 기준으로 정리해 두었습니다.");
    renderRoleGrid("sharedRoleGrid", dashboard.roles || []);
  }

  if (page === "cleanup") {
    renderCleanupGrid("cleanupGrid", dashboard.cleanup || []);
  }

  if (page === "notices") {
    text("noticesSectionTitle", "전달사항");
    text("noticesSectionDescription", "메인 화면에 있는 전달사항을 한 페이지에서 편하게 확인할 수 있습니다.");
    renderNoticesPage("noticesPageList", dashboard.notices || []);
  }

  if (page === "timetable") {
    text("timetableSectionTitle", "시간표");
    text("timetableSectionDescription", "현재 시각에 해당하는 교시가 자동으로 강조되며, 6교시 뒤 청소시간도 함께 표시됩니다.");
    renderTimetablePage();
    if (!timetableRefreshHandle) {
      timetableRefreshHandle = window.setInterval(renderTimetablePage, 30000);
    }
  }

  if (page === "lunch") {
    const lunch = dashboard.lunchFallback || {
      ok: false,
      statusText: "급식 확인 필요",
      summary: "급식 정보가 없습니다.",
      items: []
    };
    text("lunchSectionTitle", "오늘 급식");
    text("lunchSectionDescription", lunch.summary || "");
    renderList("lunchPageList", lunch.items || []);
  }
}

function renderRosterGrid(targetId, students) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  element.innerHTML = students
    .map((student) => {
      const photoContent = student.photo
        ? `<img src="${escapeHtml(student.photo)}" alt="${escapeHtml(student.name)} 사진">`
        : `<div class="roster-placeholder">${escapeHtml(makeRosterInitial(student.name))}</div>`;
      const note = student.note ? `<div class="roster-note">${escapeHtml(student.note)}</div>` : "";

      return `
        <article class="roster-card">
          <div class="roster-photo">${photoContent}</div>
          <div class="roster-meta">
            <span class="roster-number">${student.number}번</span>
            <strong class="roster-name">${escapeHtml(student.name)}</strong>
            ${note}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRoleGrid(targetId, roles) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  element.innerHTML = roles
    .map((role) => {
      const members = role.students && role.students.length
        ? renderRoleMembers(role.students)
        : '<span class="role-member-empty">이름 확인 필요</span>';
      const countLabel = typeof role.count === "number" && role.count > 0 ? `${role.count}명` : "인원 확인";
      return `
        <article class="role-card">
          <div class="role-topline">
            <strong class="role-title">${escapeHtml(role.role)}</strong>
            <span class="role-count">${escapeHtml(countLabel)}</span>
          </div>
          <div class="role-members">${members}</div>
          <p class="role-duty">${escapeHtml(role.duty || "")}</p>
        </article>
      `;
    })
    .join("");
}

function renderRoleMembers(students) {
  return students
    .map((name) => {
      const student = findRosterStudentByName(name);
      const avatar = student?.photo
        ? `<img src="${escapeHtml(student.photo)}" alt="${escapeHtml(name)} 사진">`
        : `<span class="role-member-placeholder">${escapeHtml(makeRosterInitial(name))}</span>`;

      return `
        <span class="role-member-chip">
          <span class="role-member-avatar">${avatar}</span>
          <span class="role-member-name">${escapeHtml(name)}</span>
        </span>
      `;
    })
    .join("");
}

function findRosterStudentByName(name) {
  return (dashboard?.roster?.students || []).find((student) => student.name === name) || null;
}

function renderCleanupGrid(targetId, cleanup) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  element.innerHTML = cleanup
    .map(
      (item) => `
        <article class="cleanup-card">
          <p class="cleanup-zone">${escapeHtml(item.zone)}</p>
          <p class="cleanup-team">${escapeHtml(item.team)}</p>
        </article>
      `
    )
    .join("");
}

function renderNoticesPage(targetId, notices) {
  const element = document.getElementById(targetId);
  if (!element) {
    return;
  }

  if (!notices.length) {
    element.innerHTML = '<div class="notice-card"><p class="notice-body">표시할 전달사항이 없습니다.</p></div>';
    return;
  }

  element.innerHTML = notices
    .map((notice) => {
      const normalizedNotice = typeof notice === "string" ? { title: "전달사항", body: notice } : notice;
      const files = (normalizedNotice.files || [])
        .map((file) => `<a class="notice-file" href="${escapeHtml(file.href)}">${escapeHtml(file.label)}</a>`)
        .join("");
      return `
        <article class="notice-card">
          <div class="notice-topline">
            <p class="notice-title">${escapeHtml(normalizedNotice.title || "전달사항")}</p>
          </div>
          <p class="notice-body">${escapeHtml(normalizedNotice.body || "")}</p>
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

function text(targetId, value) {
  const element = document.getElementById(targetId);
  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeRosterInitial(name) {
  const safeName = String(name || "").trim();
  if (!safeName) {
    return "?";
  }

  return safeName === "결번" ? "결" : safeName.slice(-2);
}

function scheduleTextToHtml(value) {
  return String(value || "-")
    .split("\n")
    .map((line) => `<span class="schedule-line">${escapeHtml(line)}</span>`)
    .join("");
}

function dayName(index) {
  return ["일", "월", "화", "수", "목", "금", "토"][index];
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

function renderTimetablePage() {
  const now = new Date();
  const todayDayName = dayName(now.getDay());
  const currentSlot = getCurrentSlot(dashboard.periodTimes || [], now);
  renderScheduleGrid("subpagePersonalGrid", dashboard.personalTimetable, todayDayName, currentSlot, dashboard.periodTimes || []);
  renderScheduleGrid("subpageClassGrid", dashboard.classTimetable, todayDayName, currentSlot, dashboard.periodTimes || []);
}

function parseClock(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}




