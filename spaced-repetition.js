// ============================================================
// Spaced Repetition (Leitner) — Spelling Coach v2
// 獨立模組，喺 script.js / index.html 只加最少 hook。
// 集合 = wordProgress collection（逐個 學生×字 一個 doc）。
// doc id 用 `${user}__${word}` → upsert 冪等，唔會生重複。
// ============================================================
(function () {
  "use strict";

  const SR = {
    // ---- 可調參數（教學選擇，Will 2026-05-30 拍板 default）----
    SESSION_CAP: 10,      // 每節最多練幾多字
    NEW_PER_DAY: 5,       // 每節最多引入幾多「未練過」新字
    // Leitner 盒子 → 下次到期間隔（日）。box1=即（下節再出），逐格拉長。
    INTERVAL: { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 },

    _today() { return new Date(); },
    _id(user, word) { return `${user}__${String(word || "").toLowerCase()}`; },

    // 一隻字練完後 upsert 佢嘅 box。
    // firstTryCorrect=true → 升一格（封頂 5）；false → 跌返 box1。
    async upsertWord(user, word, firstTryCorrect) {
      const w = String(word || "").toLowerCase();
      if (!user || !w) return;
      const ref = window.db.collection("wordProgress").doc(this._id(user, w));
      const snap = await ref.get();
      const prev = snap.exists ? snap.data() : { box: 1, timesCorrect: 0, timesWrong: 0 };
      const box = firstTryCorrect ? Math.min(5, (prev.box || 1) + 1) : 1;
      const now = this._today();
      const nextDue = new Date(now);
      nextDue.setDate(nextDue.getDate() + (this.INTERVAL[box] ?? 0));
      await ref.set(
        {
          user,
          word: w,
          box,
          timesCorrect: (prev.timesCorrect || 0) + (firstTryCorrect ? 1 : 0),
          timesWrong: (prev.timesWrong || 0) + (firstTryCorrect ? 0 : 1),
          lastSeen: now.toISOString(),
          nextDue: nextDue.toISOString(),
          updatedAt: now,
        },
        { merge: true }
      );
      return box;
    },

    // 一份 quiz 完成後，逐字更新（非阻塞——單字失敗唔影響其餘）。
    async upsertQuiz(user, wordObjs) {
      if (!Array.isArray(wordObjs)) return;
      for (const w of wordObjs) {
        try {
          await this.upsertWord(user, w.word, w.firstTryCorrect === true);
        } catch (e) {
          console.error("SR upsert fail:", w && w.word, e);
        }
      }
    },

    // 砌「今日該練」：先逾期 review 字（最逾期/最低 box 先），
    // 再用新字填餘下名額（每日新字封頂）。整體封頂 SESSION_CAP。
    async buildSession(user, poolWords) {
      const pool = (poolWords || []).map((w) => String(w || "").toLowerCase());
      const snap = await window.db.collection("wordProgress").where("user", "==", user).get();
      const prog = {};
      snap.forEach((d) => {
        const x = d.data();
        if (x && x.word) prog[x.word] = x;
      });
      const today = this._today();

      // 1) 逾期 review 字（仍喺字池內）
      const due = [];
      for (const word of pool) {
        const p = prog[word];
        if (!p) continue; // 未練過 → 第 2 步先處理
        const nd = new Date(p.nextDue || today);
        if (nd <= today) due.push({ word, box: p.box || 1, nextDue: nd });
      }
      due.sort((a, b) => a.nextDue - b.nextDue || a.box - b.box);

      // 2) 新字（從未練過）
      const fresh = pool.filter((w) => !prog[w]);

      const session = [];
      const seen = new Set();
      for (const d of due) {
        if (session.length >= this.SESSION_CAP) break;
        if (seen.has(d.word)) continue;
        session.push(d.word);
        seen.add(d.word);
      }
      let newCount = 0;
      for (const w of fresh) {
        if (session.length >= this.SESSION_CAP || newCount >= this.NEW_PER_DAY) break;
        if (seen.has(w)) continue;
        session.push(w);
        seen.add(w);
        newCount++;
      }
      return session;
    },
  };

  window.SR = SR;

  // ---- 掣 wiring：「📅 My Words」開一節 review ----
  async function startMyWordsSession() {
    const notify = (m, t) =>
      typeof showNotification === "function" ? showNotification(m, t) : console.log(m);
    if (typeof userName === "undefined" || !userName) {
      notify("Please sign in first.", "error");
      return;
    }
    // 確保字池已載入
    if (
      (typeof availableWordSets === "undefined" || !availableWordSets || !availableWordSets.length) &&
      typeof loadAvailableWordSets === "function"
    ) {
      await loadAvailableWordSets();
    }
    const pool = [
      ...new Set(
        (typeof availableWordSets !== "undefined" ? availableWordSets : [])
          .flatMap((ws) => (ws.words || []).map((w) => String(w || "").toLowerCase()))
      ),
    ].filter((w) => w && !/\s/.test(w));
    if (!pool.length) {
      notify("No words assigned yet.", "info");
      return;
    }
    let session;
    try {
      session = await SR.buildSession(userName, pool);
    } catch (e) {
      console.error("buildSession failed:", e);
      notify("Couldn't build your review. Please try again.", "error");
      return;
    }
    if (!session.length) {
      notify("🎉 All caught up — nothing due today!", "success");
      return;
    }
    if (typeof switchToWordSet === "function") {
      switchToWordSet("__review__", "📅 My Words", session);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("myWordsButton");
    if (btn) btn.addEventListener("click", startMyWordsSession);
  });
})();
