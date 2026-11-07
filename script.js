const STORAGE_KEY = "tabungyuk-goals-v1";

const goalForm = document.querySelector("#goal-form");
const goalList = document.querySelector("#goal-list");
const emptyState = document.querySelector("#empty-state");
const depositDialog = document.querySelector("#deposit-dialog");
const depositForm = document.querySelector("#deposit-form");
const depositInput = document.querySelector("#deposit-amount");
const formFeedback = document.querySelector("#form-feedback");
const toast = document.querySelector("#toast");

let goals = loadGoals();
let activeGoalId = null;
let toastTimeout;

function loadGoals() {
  try {
    const savedGoals = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(savedGoals)) return [];
    return savedGoals.filter((goal) =>
      goal &&
      typeof goal.id === "string" &&
      typeof goal.name === "string" &&
      Number.isFinite(goal.target) &&
      Number.isFinite(goal.saved) &&
      goal.target > 0 &&
      goal.saved >= 0
    );
  } catch (error) {
    console.error("Data tabungan tidak dapat dibaca dari penyimpanan browser.", error);
    return [];
  }
}

function saveGoals() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    return true;
  } catch (error) {
    console.error("Data tabungan tidak dapat disimpan di browser.", error);
    showToast("Tabungan gagal disimpan. Coba periksa ruang penyimpanan browser.");
    return false;
  }
}

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function renderGoals() {
  goalList.innerHTML = goals.map((goal) => {
    const percentage = Math.min(100, Math.floor((goal.saved / goal.target) * 100));
    const isComplete = goal.saved >= goal.target;
    const remaining = Math.max(0, goal.target - goal.saved);

    return `
      <article class="goal-card${isComplete ? " is-complete" : ""}">
        <div class="goal-top">
          <div class="goal-ident">
            <span class="goal-emoji" aria-hidden="true">${escapeHTML(goal.icon || "🎁")}</span>
            <div>
              <h3 class="goal-name">${escapeHTML(goal.name)}</h3>
              <p class="goal-remaining">${isComplete ? "Yeay, targetmu sudah tercapai!" : `Kurang ${formatRupiah(remaining)} lagi`}</p>
            </div>
          </div>
          <button class="goal-menu" type="button" data-action="delete" data-id="${escapeHTML(goal.id)}" aria-label="Hapus target ${escapeHTML(goal.name)}">×</button>
        </div>
        <div class="goal-progress-info"><span>${formatRupiah(goal.saved)} terkumpul</span><strong>${isComplete ? "100%" : `${percentage}%`}</strong></div>
        <div class="progress-track" role="progressbar" aria-label="Progres ${escapeHTML(goal.name)}" aria-valuenow="${isComplete ? 100 : percentage}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width: ${isComplete ? 100 : percentage}%"></div>
        </div>
        <div class="goal-bottom">
          <span class="goal-amounts">Target <strong>${formatRupiah(goal.target)}</strong></span>
          <div class="goal-actions">
            ${isComplete
              ? '<span class="completed-label">✓ Tercapai!</span>'
              : `<button class="add-saving-button" type="button" data-action="deposit" data-id="${escapeHTML(goal.id)}">＋ Nabung</button>`}
            <button class="delete-button" type="button" data-action="delete" data-id="${escapeHTML(goal.id)}">Hapus</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  emptyState.hidden = goals.length > 0;
  goalList.hidden = goals.length === 0;
  document.querySelector("#total-savings").textContent = formatRupiah(
    goals.reduce((total, goal) => total + goal.saved, 0)
  );
  document.querySelector("#goal-count").innerHTML = `${goals.length} <small>target</small>`;
  document.querySelector("#completed-count").innerHTML =
    `${goals.filter((goal) => goal.saved >= goal.target).length} <small>impian</small>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formFeedback.textContent = "";

  const formData = new FormData(goalForm);
  const name = String(formData.get("name") || "").trim();
  const target = Number(formData.get("target"));
  const icon = String(formData.get("icon") || "🎁");

  if (!name || !Number.isSafeInteger(target) || target <= 0) {
    formFeedback.textContent = "Isi nama dan harga target dengan benar, ya.";
    return;
  }

  const newGoal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    target,
    saved: 0,
    icon
  };
  goals = [newGoal, ...goals];
  if (!saveGoals()) {
    goals = goals.filter((goal) => goal.id !== newGoal.id);
    return;
  }

  goalForm.reset();
  renderGoals();
  showToast(`Target "${name}" berhasil ditambahkan!`);
  document.querySelector("#daftar-target").scrollIntoView({ behavior: "smooth", block: "start" });
});

goalList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const goal = goals.find((item) => item.id === button.dataset.id);
  if (!goal) return;

  if (button.dataset.action === "deposit") {
    activeGoalId = goal.id;
    document.querySelector("#deposit-icon").textContent = goal.icon || "🎁";
    document.querySelector("#deposit-description").textContent =
      `Untuk target ${goal.name}. Masih perlu ${formatRupiah(Math.max(0, goal.target - goal.saved))} lagi.`;
    depositForm.reset();
    depositDialog.showModal();
    depositInput.focus();
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(`Hapus target "${goal.name}"? Data tabungan untuk target ini juga akan dihapus.`);
    if (!confirmed) return;

    const previousGoals = goals;
    goals = goals.filter((item) => item.id !== goal.id);
    if (!saveGoals()) {
      goals = previousGoals;
      return;
    }

    renderGoals();
    showToast("Target berhasil dihapus.");
  }
});

depositForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(depositInput.value);
  const goal = goals.find((item) => item.id === activeGoalId);

  if (!goal || !Number.isSafeInteger(amount) || amount <= 0) {
    showToast("Masukkan jumlah tabungan yang valid, ya.");
    return;
  }

  const previousSaved = goal.saved;
  goal.saved = Math.min(goal.target, goal.saved + amount);
  if (!saveGoals()) {
    goal.saved = previousSaved;
    return;
  }

  const reachedTarget = previousSaved < goal.target && goal.saved >= goal.target;
  depositDialog.close();
  renderGoals();
  showToast(reachedTarget ? "Yeay, target impianmu tercapai! 🎉" : "Tabungan berhasil ditambahkan. Semangat! ✨");
  activeGoalId = null;
});

depositDialog.querySelector(".dialog-close").addEventListener("click", () => depositDialog.close());
depositDialog.addEventListener("close", () => {
  activeGoalId = null;
});

renderGoals();
