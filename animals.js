// 🐾 Spelling 動物（Will 2026-10-09／10-10）：Y4 一節全對得一隻動物
// - 全對＝每個字第一次就串啱，而且冇用提示（Will 2026-10-13 改：用咗提示唔應該得動物）；一節要夠 MIN_WORDS 個字
// - 每日（香港日期）最多一隻；7 隻收齊為止；次序固定（下一隻喺「My animals」出剪影）
// - 獨立於 Typing Coach：唔使積分、唔使房、唔使餵（Will：「spelling should be separate, easier」）
// - 圖＝Typing Coach 同一套 Pet Sanctuary 素材（animals/*.webp）
// - 記錄：Firestore animals/{學號} = { user, owned: [{ id, day, wordSetName, at }], updatedAt }；transaction 防兩個分頁同日攞兩隻
(function () {
  const COHORTS = ["22-"]; // 2026-27 嘅 Y4（學號前綴＝入學年；明年呢班升 Y5，要轉班就改呢度）
  const MIN_WORDS = 8; // Y4 每個 set 10 個字；防一兩個字嘅練習（單字練習、短 My Words）都攞到
  const ANIMALS = [
    { id: "snail", name: "Shelly", species: "snail" },
    { id: "jellyfish", name: "Glimmer", species: "jellyfish" },
    { id: "cat", name: "Mochi", species: "cat" },
    { id: "lizard", name: "Snappy", species: "gecko" },
    { id: "dinosaur", name: "Rexy", species: "dinosaur" },
    { id: "red-panda", name: "Aurelio", species: "red panda" },
    { id: "wolf", name: "Shadow", species: "wolf pup" },
  ];

  const img = (a) => `animals/${a.id}.webp`;
  const eligible = (user) => COHORTS.some((p) => String(user || "").startsWith(p));
  const ref = (user) => window.db.collection("animals").doc(user);

  function hktDay(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }

  const same = (a, b) => (typeof sameWord === "function" ? sameWord(a, b) : String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase());

  // hintUsed[i] 係揭咗邊幾個字母嘅 array（舊路徑可能係 true/false）
  const usedHint = (h) => (Array.isArray(h) ? h.length > 0 : Boolean(h));

  /** 全對：夠字數，每個字第一次就啱，而且冇揭過任何字母 */
  function isPerfect(words, answers, hints) {
    if (!Array.isArray(words) || words.length < MIN_WORDS) return false;
    return words.every((w, i) => {
      const attempts = (answers && answers[i] && answers[i].attempts) || [];
      return attempts.length > 0 && same(attempts[0], w) && !usedHint(hints && hints[i]);
    });
  }

  function ownedList(data) {
    const known = new Set(ANIMALS.map((a) => a.id));
    return (Array.isArray(data && data.owned) ? data.owned : []).filter((o) => o && known.has(o.id));
  }

  async function load(user) {
    const doc = await ref(user).get();
    return ownedList(doc.exists ? doc.data() : null);
  }

  /** 攞一隻：new（攞到）／today（今日已經攞咗）／complete（收齊） */
  async function award(user, wordSetName) {
    const today = hktDay();
    return window.db.runTransaction(async (t) => {
      const doc = await t.get(ref(user));
      const owned = ownedList(doc.exists ? doc.data() : null);
      const have = new Set(owned.map((o) => o.id));
      const next = ANIMALS.find((a) => !have.has(a.id));
      if (!next) return { status: "complete", count: owned.length };
      if (owned.some((o) => o.day === today)) return { status: "today", count: owned.length };
      const entry = { id: next.id, day: today, wordSetName: String(wordSetName || ""), at: new Date().toISOString() };
      t.set(ref(user), { user, owned: [...owned, entry], updatedAt: entry.at });
      return { status: "new", animal: next, count: owned.length + 1 };
    });
  }

  function resultHtml(out) {
    if (out.status === "new") {
      const a = out.animal;
      return `<img src="${img(a)}" alt="" class="animal-new-img">
        <div><p class="animal-title">🎉 Every word right first time!</p>
        <p><strong>${a.name} the ${a.species}</strong> has come to join your animals.</p>
        <p class="animal-meta">You have ${out.count} of ${ANIMALS.length} animals. Find them all in 🐾 My animals.</p></div>`;
    }
    if (out.status === "today") {
      return `<div><p class="animal-title">⭐ Every word right first time!</p>
        <p>A new animal has already joined you today. Another one can come tomorrow.</p></div>`;
    }
    return `<div><p class="animal-title">⭐ Every word right first time!</p>
      <p>You have all ${ANIMALS.length} animals. Amazing spelling!</p></div>`;
  }

  /** 結果頁：全對就試攞一隻，結果放喺結果彈窗最頂 */
  function afterQuiz({ user, words, answers, hints, wordSetName, individual }) {
    if (!eligible(user) || individual) return;
    const perfect = isPerfect(words, answers, hints);
    // 全對但用咗提示：唔得動物，但話佢知下次唔用提示就得（Will 2026-10-13）
    const perfectWithHints = !perfect && isPerfect(words, answers);
    if (!perfect && !perfectWithHints) return;
    const box = document.createElement("div");
    box.className = "animal-result";
    box.setAttribute("role", "status");
    box.hidden = true;
    const body = document.getElementById("modalBody");
    if (body) body.prepend(box);
    if (perfectWithHints) {
      const nudge = () => {
        box.innerHTML = `<div><p class="animal-title">⭐ Every word right!</p><p>Try it without hints next time to welcome a new animal.</p></div>`;
        box.hidden = false;
      };
      // 收齊 7 隻就唔使講「下次會有新動物」
      load(user).then((owned) => (owned.length >= ANIMALS.length ? box.remove() : nudge()), nudge);
      return;
    }
    award(user, wordSetName).then(
      (out) => {
        box.innerHTML = resultHtml(out);
        box.hidden = false;
        if (out.status === "new") syncButton();
      },
      (err) => {
        console.error("animal award failed:", err);
        box.innerHTML = `<div><p class="animal-title">⭐ Every word right first time!</p><p>Your new animal could not be saved just now. Please tell your teacher.</p></div>`;
        box.hidden = false;
      }
    );
  }

  /** 「My animals」彈窗：擁有嘅＋未到嘅剪影 */
  async function show() {
    const user = typeof userName !== "undefined" ? userName : "";
    if (!eligible(user)) return;
    let owned;
    try {
      owned = await load(user);
    } catch (err) {
      console.error("animals load failed:", err);
      showModal(`<p>Your animals could not be loaded. Please try again.</p>`);
      return;
    }
    const have = new Set(owned.map((o) => o.id));
    const cards = ANIMALS.map((a) =>
      have.has(a.id)
        ? `<li class="animal-card"><img src="${img(a)}" alt=""><strong>${a.name}</strong><span>${a.species}</span></li>`
        : `<li class="animal-card is-waiting"><img src="${img(a)}" alt=""><strong>?</strong><span>waiting</span></li>`
    ).join("");
    const done = owned.length >= ANIMALS.length;
    const title = document.getElementById("modalTitle");
    if (title) title.textContent = "🐾 My animals"; // closeModal() 會還原做 All Words
    showModal(`<p class="animals-lede">${done ? `You have all ${ANIMALS.length} animals. Amazing spelling!` : "Spell every word in a set right first time, without hints, to welcome a new animal. One new animal can join you each day."}</p>
      <p class="animal-meta">You have ${owned.length} of ${ANIMALS.length}.</p>
      <ul class="animal-grid" aria-label="My animals">${cards}</ul>`);
  }

  /** Y4 先見到「My animals」掣（登入後 initializeApp 叫；登出會 reload） */
  function syncButton() {
    const btn = document.getElementById("myAnimalsButton");
    if (btn) btn.style.display = eligible(typeof userName !== "undefined" ? userName : "") ? "" : "none";
  }

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("myAnimalsButton");
    if (btn) btn.addEventListener("click", show);
    syncButton();
  });

  window.Animals = { afterQuiz, show, syncButton, isPerfect, hktDay, ANIMALS, MIN_WORDS };
})();
