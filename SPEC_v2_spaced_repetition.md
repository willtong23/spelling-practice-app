# Spelling Coach v2 — Spaced Repetition + 持續更新 + Grouping

> Plan of record. 由 Will 2026-05-30 確認方向，Claude 撰寫。
> Branch: `v2-spaced-repetition`（保護 live `main`）。
> Firebase: `spelling-v001`（production，已備份至 `~/Desktop/English & Writing/spelling_upload/backups/firebase_2026-05-30/`）。

## 0. 目標（Will 嘅四個訴求）
1. 時常更新加入新 spelling list，**唔打亂現有 data**。
2. Spaced repetition（學生反覆鞏固自己錯過嘅字）。
3. 新舊 list 一齊睇。
4. 把 1-2 字嘅碎 set 重新 group 成 **8-10 字**單位。

## 1. 已拍板嘅決定
- **保留 account + additive 遷移**（唔開新 account）。理由：現有 145 次練習歷史 = SR 嘅燃料，開新 account 等於燒咗佢。
- **只加不改**：新 collection / 新 doc / 新 field，舊 doc 一隻字唔郁。可隨時 rollback。
- 已做 production 全量備份（6 collections）。

## 2. 方法決定：擴充，唔係重建（讀完 code 後更新嘅建議）
口頭傾時我傾向重建，但**讀完現有 5000 行 `script.js` + 6000 行 `teacher.js` 之後改為建議「擴充」**：
- 現有學生端有大量 working features：英式 TTS、字母提示、字母鍵盤、慶祝動畫、word-set panel、results 儲存、idle 登出、function-key 保護。重建要全部重做先唔會退步——風險高、慢。
- **SR 本質係 data-driven**：只要(a) 整好 grouped sets、(b) 一個 per-word 進度表、(c) 一個「今日該練」嘅動態 set，現有 app 嘅 word-set 機制基本上照用得。
- 合乎 CLAUDE.md「精簡優先、不要過度工程化」。
- 全新設計/重建可日後再做，唔係 v2 嘅前置條件。

## 3. Data model 改動（全部 additive）

### 3a. `wordProgress`（新 collection）— SR 心臟
逐個 (學生, 字) 一行：
```
{ user: "20-02", word: "dropped", box: 1..5, lastSeen: ISO, nextDue: ISO,
  timesCorrect: int, timesWrong: int, updatedAt: ts }
```
- **由現有 145 次 `results` 回填**：每隻字按歷史 firstTryCorrect 推算初始 box。
- 每次 quiz 完，`saveQuizResults()` 之後 upsert 對應字嘅 box（答啱升、答錯跌返 box 1）。

### 3b. 每學生「活躍 list」指針 — 「更新唔影響舊資料」嘅機制
學生 doc 加 `activeWordSetIds: [..]`（或一個 `listVersion` int）。
- 上傳新 list = 整**新** wordSet doc + 更新指針；舊 set doc 留底做歷史。
- 想復原 = 改返指針。永不刪、永不覆寫。

### 3c. 重組嘅 8-10 字 sets
碎 set（1-2 字）合併成 8-10 字單位，當**新** set 整出嚟，舊 set 唔 active。

## 4. Spaced Repetition 設計（Leitner，適合細路）
- 5 個盒：間隔大約 box1=即日、box2=1日、box3=3日、box4=7日、box5=14日（待調）。
- 答啱（first try）升一格；答錯跌返 box1。
- **「📅 Practise my words」**：一個動態生成嘅 word set，集合所有 `nextDue <= today` 嘅字（跨晒佢所有 active sets）。
  - 「新舊一齊睇」由此自然跌出：box1 新字 + 到期舊字混埋。
- 實作為現有 app 多一粒掣 / 一個特殊 set，重用所有練習/語音/提示/儲存機制。

## 5. Sentences bug
學生寫句嘅 write path 漏咗 `user` / `word`（16 筆全 undefined）。重建/擴充時補返：寫 sentence 時帶 `user`(code)、`word`、`wordSetId`、`createdAt`。

## 6. Grouping 規則
- 每組 8-10 字。
- 合併同類碎 set（例如多個 fortnight 嘅單字）。
- ⚠️ **校對**：自動偵測嗰批有錯 pair（echoes→eaches / feet→felt / could've→could's 等），合併前要人手/Claude 校對，唔可以照入。
- 紙本 PDF pipeline（`generate_spelling_correction_pdfs.py`）同樣問題，獨立處理。

## 7. Sequencing（慢慢做、每步可停）
- **P0 安全網** ✅ 備份 production + 開 branch（已完成）。
- **P1 離線 data prep**（低風險，唔掂 live）：
  - 讀全部 287 sets，分類（per-student own-error / curriculum / fragment）。
  - 校對 + 重組成 8-10 字 sets → 新 plan 檔。
  - 寫 `wordProgress` 回填 script（先 dry-run 出 JSON，唔寫 prod）。
- **P2 SR 邏輯 + 「今日該練」**（先喺 test account 19-00 / 20-00 試）。
- **P3 遷移 + 上線**（Will 批准、揀靜日）：跑 additive migration → 部署。

## 8. 安全規則
- 任何寫 prod 之前：先喺 test account（19-00 Noah-mirror / 20-00 Max-mirror）試。
- 全部 additive；migration script 唔准 delete / overwrite。
- 每次 migration 前重新 dump 一次備份。
- Firestore silent-failure：每個寫操作要 verify 寫到（讀返）。

## 9. Open items
- Leitner 間隔具體日數（P2 同 Will 敲定）。
- 「今日該練」嘅 UI 擺位（panel 頂 / 獨立掣）。
- 老師 dashboard 要唔要顯示 SR 狀態（暫時唔郁，P3 後再講）。
