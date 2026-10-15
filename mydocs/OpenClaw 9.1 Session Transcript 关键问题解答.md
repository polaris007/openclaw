# OpenClaw 9.1 Session Transcript 关键问题解答

> 6 个关于 `2026.9.1` 的疑点澄清，全部经源码查证。总览见 `OpenClaw 9.1 Session Transcript 存储与生命周期.md`，详细版（含逐行引用与 5.28 对比）见 `OpenClaw 9.1 Session Transcript 存储逻辑与5.28对比.md`。

---

## Q1：`transcript_rewrite_watermarks.generation` 和其他数据怎么关联？

**它不关联别的表——它自己就是"这一个 session_id 的内容版本号"。** 主键是 `session_id`，与 `transcript_events`/`session_windows` 用同一个 id。

作用是**判断"我手里的那份内容还是不是现在这份"**：

| 使用方 | 用法 |
|---|---|
| 增量读游标 | 客户端游标里带 `{sessionId, generation, lastSeq}`；服务端发现 generation 对不上就判定内容被大改，游标作废，要求重新拉全量（`src/config/sessions/session-accessor.sqlite-delta.ts:176-186`） |
| 归档 | 归档行里的 `generation` 是被删那一刻的版本号；导出文件名也带它（`<id>.jsonl.deleted.<时间戳>.<generation>.zst`，`src/config/sessions/session-accessor.sqlite-archive.ts:108-115`），避免同名归档互相覆盖 |
| 内存缓存 | 分支列表缓存、reset 窗口缓存按 (generation, seq) 判断是否失效（`src/config/sessions/session-accessor.sqlite-message-cut.ts:88,127`） |

**何时变化**：只有内容被整段替换/改写时才换新值（截断式压缩、精确改写、doctor 修复）。普通追加消息、写 reset 分隔线都**不换**。

> 实用推论：判断一次压缩是"追加式"还是"截断式"，看 generation 变没变最准——没变是追加式，变了是截断式。

---

## Q2：隐身会话（incognito）是什么？

**一种"退出即消失、不落盘"的临时会话。**

| 维度 | 说明 |
|---|---|
| 识别 | session_key 匹配固定模式：`dashboard`/`subagent`/`internal-session-effects` 之一 + `incognito-` 前缀（`src/shared/incognito-session-key.ts:1-13`） |
| 存储 | **内存中的 SQLite 数据库**（真 `:memory:`，`src/state/openclaw-agent-db.ts:261-263`），磁盘上连库文件都不创建 |
| 标记 | 会话记录带 `incognito: true` |
| 删除 | **不留归档**，直接删（`src/gateway/server-methods/sessions-delete.ts:269-276`） |
| 创建方 | 控制面板新建会话时勾选隐身、子 agent 以隐身方式派生、内部副作用会话 |

与普通会话共用同一套表和逻辑，只是换了个"内存数据库"存放。

---

## Q3：`session_transcript_archives` 只在删除时写入吗？

**是。9.1 实际只有删除会写这张表。**

- 表结构上 `reason` 列允许 `deleted` 和 `reset` 两种取值
- 但查遍所有写归档的路径，DB 归档的四个调用点**全部传 `"deleted"`**：
  - `src/config/sessions/session-accessor.sqlite-lifecycle-state.ts:441`
  - `src/config/sessions/session-accessor.sqlite-lifecycle.ts:375`
  - `src/config/sessions/session-accessor.sqlite-projection.ts:587`
  - 磁盘驱逐流程 `src/config/sessions/session-history-eviction.ts:621`
- reset 路径虽然也传了 `reason: "reset"`，但它走的是**文件改名**那套函数（`src/config/sessions/session-accessor.reset.ts:322-346` → `src/gateway/session-transcript-files.ts:309-332`），只处理磁盘上**已存在**的文件；而 9.1 的对话在数据库里没有对应文件 → 空操作，写不进归档表
- doctor 的 `writeTranscriptArchive()` 是改写前的快照备份，同样只写文件、不写这张表

**结论：reset 不产生归档数据；这张表目前只装"被删会话的备份"。**

---

## Q4：追加式 vs 截断式压缩的区别和触发方式

| | 追加式（常规） | 截断式（手动带条数） |
|---|---|---|
| 做什么 | 加一条 `compaction` 事件 + 摘要，**旧消息全留** | **整段删除后重插**，只留最近 N 条，被总结的消息**物理消失且无备份** |
| 触发 | ① 上下文快到模型上限**自动触发**<br>② 用户 `/compact` 不带参数<br>③ 网关 `sessions.compact` 不带 `maxLines` | `openclaw sessions compact <key> --max-lines N`（`src/cli/program/register.status-health-sessions.ts:470,528`）或带条数的 `/compact` |
| 对数据的影响 | `seq` 继续递增；行数只增不减；`generation` **不换** | `seq` **从 0 重新编号**；`generation` **换新**；行被物理删除 |
| 对上下文 | 模型从那一条之后算起（保留一小段尾巴） | 模型只看到留下的 N 条 |

**自动触发的阈值**（`packages/agent-core/src/harness/compaction/compaction.ts:298-306`）：

```
上下文用量 > 模型窗口 − 预留量        →  触发压缩
默认预留量 reserveTokens  = 16384
默认保留量 keepRecentTokens = 20000（压缩后仍保留的近期上下文 token 数）
```

截断式压缩的实现见 `src/config/sessions/session-accessor.sqlite-transcript-write.ts:170-231`。

---

## Q5：分支 / 回滚 / 切换是怎么触发的？

三者都是**对某条具体消息操作**，走网关三个方法（`src/gateway/server-methods/sessions-rewind.ts:130-155`）：

| 动作 | 方法 | 用户侧触发 | 底层行为 |
|---|---|---|---|
| **回滚** | `sessions.rewind` | 在界面上回到某条消息、编辑后重新发送 | `rewindSessionToMessage`：把对话树当前末端**接到你选的那条消息的父节点**，"这条路后面的都作废" |
| **分叉** | `sessions.fork` | "从这条消息开个新会话" | `forkSessionAtMessage`：**新建 session_id**（新户口本行，`previous_session_id` 指回老的），把选中消息之前的路径复制过去 |
| **切换分支** | `sessions.branches.switch` | 在界面的分支列表里点另一个分支 | `switchSessionBranch`：只把当前末端**接到另一条已有叶子**上 |

**共同点**：都只往 `transcript_events` 加一条 `type:"leaf"` 的控制事件，**不删任何已有消息**；被放弃的分支内容仍留在表里，只是不可见。

`sessions.branches.list` 只读，用于列出有哪些分支。上游联动的会话（Beam/云端）除外——那种情况分叉转到上游 harness 处理，本地不建分支图（`sessions-rewind.ts:474-492`）。

---

## Q6："会话被删除（先备份，再删行）"就是归档吗？

**是，但要区分"归档"在 9.1 指的三种不同东西：**

| 叫法 | 是什么 | 数据还在吗 |
|---|---|---|
| **删除归档**（Q 里说的就是这个） | 会话被删时，把对话压成 blob 存进 `session_transcript_archives`，并导出 `.deleted.<时间戳>[.zst]` 文件 | **在**（这正是它的意义） |
| 会话归档状态 | 会话记录上的 `archivedAt` 字段，仅从列表隐藏，会话完整无损 | 完整在 |
| 迁移归档 | 升级时 doctor 把旧 JSONL 挪到 `session-sqlite-import-archive/` | 在，但不参与运行时 |

**只有第一种会写 `session_transcript_archives` 表。**

删除会话的三个子情况：

| 情况 | 是否归档 |
|---|---|
| 显式删除、条目过期（30 天）、条目超上限（500）、cron 会话 24h、`sessions cleanup --fix-missing`、删 agent | **归档**（有备份） |
| 磁盘超预算淘汰历史会话（驱逐） | **归档**（也是先备份再删行） |
| 隐身会话被删 | **不归档**，直接删 |
