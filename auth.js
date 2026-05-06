(() => {
  const PIN = "2525";
  const STORAGE_KEY = "teacher-residency-board-unlocked";

  const isUnlocked = () => sessionStorage.getItem(STORAGE_KEY) === "true";

  const unlock = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    document.documentElement.classList.remove("board-locked");
    const layer = document.getElementById("authGate");
    if (layer) {
      layer.remove();
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("board:unlocked"));
      window.dispatchEvent(new Event("resize"));
    });
  };

  const showError = (element, message) => {
    element.textContent = message;
    element.hidden = false;
  };

  const buildGate = () => {
    document.documentElement.classList.add("board-locked");

    const layer = document.createElement("div");
    layer.id = "authGate";
    layer.className = "auth-gate";
    layer.innerHTML = `
      <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <p class="auth-eyebrow">교생 안내 보드</p>
        <h1 id="authTitle">4자리 비밀번호 입력</h1>
        <p class="auth-description">교생선생님께 공유받은 비밀번호를 입력하면 페이지를 볼 수 있습니다.</p>
        <form class="auth-form">
          <input id="authPinInput" class="auth-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" placeholder="비밀번호 4자리" aria-label="비밀번호 4자리">
          <button class="auth-submit" type="submit">입장하기</button>
        </form>
        <p id="authError" class="auth-error" hidden>비밀번호가 맞지 않습니다.</p>
      </div>
    `;

    document.body.appendChild(layer);

    const form = layer.querySelector(".auth-form");
    const input = layer.querySelector("#authPinInput");
    const error = layer.querySelector("#authError");

    input.focus();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (value === PIN) {
        unlock();
        return;
      }
      input.value = "";
      showError(error, "비밀번호가 맞지 않습니다.");
      input.focus();
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (isUnlocked()) {
      unlock();
      return;
    }
    buildGate();
  });
})();
