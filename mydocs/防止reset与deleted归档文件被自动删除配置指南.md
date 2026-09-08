# 防止 .reset 与 .deleted 归档文件被自动删除——配置指南

> 基准源码：本机 `openclaw-0528` checkout（**v2026.5.28**，文件存储，`sessions.json`）。
> 当前 main（PR #98236 之后）的差异在文末单独说明。
> 2026-09-08 编写，所有结论均逐条核对源码并附 `文件:行号`。

---

## 1. 目标与结论

目标：让 `<sessionId>.jsonl.reset.<时间戳>` 和 `<sessionId>.jsonl.deleted.<时间戳>` 两类归档转录文件**永不被 OpenClaw 自动物理删除**（`fs.rm`）。

结论先行——v2026.5.28 需要以下四项配置同时满足，缺一不可：

```json5
{
  "session": {
    "maintenance": {
      // ① 关闭 .reset 归档清理（它唯一的开关）
      "resetArchiveRetention": false,

      // ② .deleted 清理窗口 = pruneAfter，没有独立开关，只能调大到永不命中
      "pruneAfter": "36500d",

      // ③ 确保不配置 maxDiskBytes / highWaterBytes（保持缺省关闭）
      //    （两者一旦配置且超水位，会无视①②按最旧优先 rm 所有归档）
    }
  },
  "cron": {
    // ④ 关闭 cron reaper——它绕过 maintenance 独立清理 .deleted
    "sessionRetention": false
  }
}
```

改完后**必须重启 gateway**（配置是启动快照，热加载不可靠）。

---

## 2. OpenClaw 删除这两类文件的完整逻辑

全仓库真正执行 `fs.rm` 删除归档文件的函数只有一个：
`cleanupArchivedSessionTranscripts`（`src/gateway/session-transcript-files.fs.ts:250-287`）。
它对指定目录做 `readdir` 全量扫描，按 `reason` 匹配文件名后缀（`.reset.` / `.deleted.`），
解析文件名内嵌的 ISO 时间戳，`now − 时间戳 > olderThanMs` 的文件逐个 rm。

**关键特征：年龄锚点是文件名里嵌入的归档时间戳，不是文件 mtime**——
`touch` 文件或复制文件都影响不了清理判定，只有文件名里的时间戳算数。

该函数全仓库只有**两个调用方**（grep 核实），加上一个能绕过它的机制，共**三个删除出口**：

### 出口 A：store 保存维护（最主要的路径）

位置：`src/config/sessions/store.ts:570-586`，`saveSessionStoreUnlocked` 的 enforce 分支内（步骤④）。

```ts
if (archivedDirs.size > 0 || maintenance.resetArchiveRetentionMs != null) {   // 外层门槛
  await cleanupArchivedSessionTranscripts({
    olderThanMs: maintenance.pruneAfterMs,          // ← .deleted 的窗口硬编码为 pruneAfter
    reason: "deleted",
  });
  if (maintenance.resetArchiveRetentionMs != null) { // ← .reset 的独立开关（false → null → 永不执行）
    await cleanupArchivedSessionTranscripts({
      olderThanMs: maintenance.resetArchiveRetentionMs,
      reason: "reset",
    });
  }
}
```

- **触发时机**：任何跑 maintenance 的 store 保存（会话消息、`/new`、元数据写入、`openclaw sessions cleanup` 等）。惰性执行，无定时器。
- **前置条件（三个都满足才跑）**：保存未跳过维护（非 `skipMaintenance`）；`session.maintenance.mode === "enforce"`（`warn` 分支整段没有这段代码）；外层门槛成立（默认配置下恒成立）。
- **删除条件**：文件名时间戳早于 `now − pruneAfter`（默认 30 天）。
- **范围**：本 store 的 sessions 目录全量扫描，不分归档来源。

### 出口 B：cron reaper（作用域泄漏点）

位置：`src/cron/session-reaper.ts:123-130`。reaper 清理过期 cron run 条目（`agent:<agentId>:cron:<jobId>:run:<uuid>`，默认 24h）并归档转录后，若本轮**确实产生了新归档**（`archivedDirs.size > 0`），会对刚归档的目录再做一次全目录扫描：

```ts
cleanupArchivedSessionTranscripts({
  directories: [...archivedDirs],   // = agent 的 sessions 目录，与普通会话共享
  olderThanMs: retentionMs,         // ← 24h（cron.sessionRetention），不是 pruneAfter！
  reason: "deleted",
});
```

- **触发时机**：cron timer tick（节流 ≥5 分钟）——但**只有本轮恰好删了条目并归档了转录**才会走到清理这一步。低频 cron 部署很少满足，表现为偶发性批量清除。
- **作用域泄漏**：共享目录里由 prune / 手动删除产生的、文件名时间戳超 24h 的 `.deleted` 归档会被顺带 rm——cron 的保留策略越权压低了普通会话归档的保留期。
- **与 `session.maintenance.mode` 完全无关**：reaper 的删除和清理不经过 maintenance 分支，`mode: "warn"` 拦不住它。
- `.reset` 文件从不归 reaper 管（reason 不匹配）。

### 出口 C：磁盘预算

位置：`src/config/sessions/disk-budget.ts`（`enforceSessionDiskBudget`，store.ts:588-596 在每次 enforcing 保存时调用；`warn` 模式只评估不删）。

- **前置条件**：配置了 `session.maintenance.maxDiskBytes`（**缺省 `null` = 整个机制关闭**）且 sessions 目录用量 ≥ high-water（缺省 80% × maxDiskBytes）。
- **删除条件**：无年龄窗口——超水位后**最旧优先**逐出，可删文件判定 `isDiskBudgetRemovableSessionFile`（disk-budget.ts:338-354）明确包含 `isSessionArchiveArtifactName`（即 `.reset`/`.deleted`/`.bak` 全部在列）。
- 这是唯一能无视①②的保留设置、按"容量"强制删归档的机制。

### 明确不会删这两类文件的路径（避免误判）

- `pruneUnreferencedSessionArtifacts`（`openclaw sessions cleanup` 里的孤儿文件清扫）：只认 checkpoint / trajectory / 孤儿主转录（`isUnreferencedSessionArtifactFile`，disk-budget.ts:287-299），**不含归档后缀**。
- prune / cap / `sessions.delete` / heartbeat / subagent 清理：只把活跃转录**改名**成 `.deleted`（改名保留文件），不是删除。

---

## 3. 为什么需要每一项配置（漏一项的反例）

| 漏掉 | 后果 |
|---|---|
| ① `resetArchiveRetention: false` | `.reset` 归档在 store 保存维护中按窗口被 rm（未配置时窗口继承 pruneAfter=30 天） |
| ② `pruneAfter` 调大 | `.deleted` 归档在 store 保存维护中被 rm——**`.deleted` 的清理窗口没有独立配置项，硬编码用 pruneAfter**（store.ts:576）。只设①拦不住它 |
| ③ 不配 `maxDiskBytes` | 一旦目录超水位，磁盘预算按最旧优先 rm 归档，**无视①②**（disk-budget.ts:351-352 明确把归档列为可删对象） |
| ④ `cron.sessionRetention: false` | reaper 绕过 maintenance，用它自己的 24h 窗口清同目录 `.deleted`，**`mode: "warn"` 也拦不住** |

两个容易踩的坑：

- **`mode: "warn"` 不是完整方案**：它能跳过出口 A（warn 分支没有 prune/cap/归档清理代码），但不拦出口 B（reaper）和出口 C（warnOnly 只是不删，预算评估照跑）。作为替代方案需要叠加④③。
- **`resetArchiveRetention: false` 在 v2026.5.28 只保 `.reset`**：它对 `.deleted` 清理的影响只是让外层门槛收紧到"本次保存恰好产生新归档才跑"，跑起来时窗口仍是 pruneAfter（30 天），老 `.deleted` 照删。

---

## 4. 版本差异（重要）

| 版本 | `.deleted` 清理窗口 | 保住 `.deleted` 的办法 |
|---|---|---|
| v2026.5.28（含 PR #98236 之前的版本） | `pruneAfter`（默认 30 天），无独立开关 | 必须调大 `pruneAfter`（如 `"36500d"`） |
| 当前 main（PR #98236，2026-07-11 之后） | `resetArchiveRetention` 统一管理两种归档，缺省 keep（no age cutoff），duration 才启用删除 | `resetArchiveRetention: false` 一项即可，`pruneAfter` 已与归档清理无关 |

依据：main 上 `resolveResetArchiveRetentionMs` 签名从 `(maintenance, pruneAfterMs)` 改为 `(maintenance)`；官方文档 `docs/reference/session-management-compaction.md`："age cutoff for `*.reset.*`/`*.deleted.*` transcript archives; a duration opts into deletion"。

两个版本通用的部分：④ `cron.sessionRetention: false`（reaper 独立路径）与 ③ 不配 `maxDiskBytes`（磁盘预算）。

---

## 5. 副作用与取舍

设 `pruneAfter: "36500d"`（②）的连带影响：

1. **`pruneStaleEntries` 永不触发**（`updatedAt < now − 100年` 恒假）——普通会话条目不再被自动 prune，`.deleted` 归档以后几乎不再新增（只有手动删除、cap、cleanup 会产生）。
2. 条目数仍受 `maxEntries`（high-water 550）兜底：超限时淘汰最旧条目，转录**改名**为 `.deleted`（文件保留）。连改名都不想要就把 `maxEntries` 调大。
3. 高频 cron 场景叠加④后，run 条目和转录会持续累积（reaper 关了、prune 也不跑）——磁盘占用需要自己管理。
4. 磁盘预算（③）保持关闭意味着**没有任何容量兜底**：磁盘写满时 OpenClaw 不会自动腾空间，需要自己监控。

`cron.sessionRetention: false`（④）的连带影响：

- reaper 整体空转：不删 run 条目、不产生 `.deleted`、无 24h 目录清扫。
- cron run 条目不会被无限堆积——它们属于不受保护的合成键（`isSyntheticSessionMaintenanceKey`，store-maintenance.ts:265-278），② 调大前本来也会被 30 天 prune 兜底；② 调大后则与普通条目一样长期保留。
- cron 任务执行本身完全不受影响（该配置只管清理）。

---

## 6. 生效与验证

1. 修改 `openclaw.json` → **重启 gateway**。
2. 确认配置生效：`openclaw doctor`（会做 config 检查）。
3. 行为验证：
   - 找文件名时间戳已超过 30 天的 `.reset`/`.deleted` 文件，正常使用一段时间（触发多次 store 保存）后确认它们仍在；
   - `sessions.json` 的 mtime 在更新（说明保存与 maintenance 在跑，而文件没被清）；
   - 若配置了 cron，观察 reaper 日志（`cron-reaper:` 前缀）确认 sweep 被 `sessionRetention: false` 短路（`swept: false`）。
4. 若要手动清理时保留归档：`openclaw sessions cleanup --enforce` 在本配置下也只会做条目淘汰（改名），不会 rm 这两类归档（窗口同为巨大的 pruneAfter）。

---

## 7. 常见误区

- **"设了 `resetArchiveRetention: false` 就全保住了"** —— 仅当前 main 成立；v2026.5.28 上它只管 `.reset`，`.deleted` 走 `pruneAfter` 窗口。
- **"`mode: "warn"` 就什么都不会删"** —— 它只停出口 A；reaper（出口 B）和显式 `--enforce` 命令不受影响；磁盘预算评估照跑（warnOnly 不删，但别配 `maxDiskBytes` 才是彻底关闭）。
- **"文件没被删是因为没到期"** —— 清理是惰性的：到期的文件要等下一次"符合条件的 store 保存"才被扫到；反过来，文件还活着也不代表永远不会被删。
- **"mtime 新就不会被删"** —— 出口 A/B 的年龄锚点是**文件名内嵌时间戳**；只有磁盘预算不看年龄（按容量+最旧优先）。
