# Transcript 检测脚本 - 时间过滤功能使用说明

## 功能概述

`detect-all-transcript-issues.py` 脚本现在支持按时间范围过滤要扫描的文件。这对于以下场景非常有用：

- 只分析最近一段时间的问题
- 对比不同时间段的问题趋势
- 快速定位特定日期范围内的问题
- 减少扫描时间，提高分析效率

## 命令行参数

### 时间参数

- `--start-time` 或 `--start`: 起始时间（包含），只扫描此时间之后创建的文件
- `--end-time` 或 `--end`: 结束时间（不包含），只扫描此时间之前创建的文件

### 支持的时间格式

```
YYYY-MM-DD                    # 例如: 2026-04-01
YYYY-MM-DDTHH:MM:SS          # 例如: 2026-04-01T10:30:00
YYYY-MM-DD HH:MM:SS          # 例如: 2026-04-01 10:30:00
```

### 目录参数

第一个非选项参数被视为目录路径（可选）：
- 如果不提供，默认使用 `logs/session-transcript/openclaw-logs`
- 可以结合时间参数使用

## 使用示例

### 1. 扫描所有文件（不使用时间过滤）

```bash
python detect-all-transcript-issues.py
```

### 2. 扫描指定目录的所有文件

```bash
python detect-all-transcript-issues.py logs/session-transcript/openclaw-logs
```

### 3. 只扫描某个日期之后的文件

```bash
# 只扫描 2026-04-15 及之后创建的文件
python detect-all-transcript-issues.py --start 2026-04-15
```

### 4. 只扫描某个日期之前的文件

```bash
# 只扫描 2026-04-15 之前创建的文件
python detect-all-transcript-issues.py --end 2026-04-15
```

### 5. 扫描指定时间范围内的文件

```bash
# 扫描 2026-04-10 到 2026-04-15 之间的文件
python detect-all-transcript-issues.py --start 2026-04-10 --end 2026-04-15
```

### 6. 结合目录和时间范围

```bash
# 扫描指定目录中 2026-04-10 到 2026-04-15 之间的文件
python detect-all-transcript-issues.py logs/session-transcript/openclaw-logs --start 2026-04-10 --end 2026-04-15
```

### 7. 使用完整时间格式

```bash
# 精确到秒的时间范围
python detect-all-transcript-issues.py --start "2026-04-10 08:00:00" --end "2026-04-15 18:00:00"
```

## 工作原理

### 文件时间获取策略

脚本会按以下优先级获取文件时间：

1. **文件系统时间**（文件存在时）
   - Windows: 使用文件创建时间 (`os.path.getctime`)
   - Linux/Mac: 使用文件最后修改时间 (`os.path.getmtime`)

2. **文件名中的时间戳**（文件不存在时）
   - 从归档文件名中提取时间，支持格式：
     - `.reset.YYYY-MM-DDTHH-MM-SS.mmmZ`
     - `.deleted.YYYY-MM-DDTHH-MM-SS.mmmZ`
     - `.compacted.YYYY-MM-DDTHH-MM-SS.mmmZ`

3. **无法获取时间**
   - 如果以上两种方式都失败，保留该文件（不过滤）

### 过滤逻辑

- `start_time`: 文件时间 >= start_time 才会被保留
- `end_time`: 文件时间 < end_time 才会被保留
- 两个参数可以同时使用，也可以单独使用

## 输出示例

```
📅 起始时间: 2026-04-15 00:00:00
📅 结束时间: 2026-04-16 00:00:00

📂 使用自定义路径: D:\workplace\github\openclaw\logs\session-transcript\openclaw-logs

🔍 开始扫描transcript文件...
🔍 正在扫描目录树...
   已扫描 727 个目录，1108 个文件，找到 482 个 JSONL 文件 (0.2秒)

⏰ 正在根据时间范围过滤文件...
   ℹ️  根据时间范围过滤：跳过 184 个文件，保留 298 个文件

✅ 过滤后剩余 298 个文件

📑 检测到 accounts.csv，正在加载账户映射...
✅ 成功加载 114 个账户映射

🔬 开始分析文件...
...
```

## 注意事项

1. **时间比较是基于文件创建/修改时间**，不是文件内容中的时间戳
2. **归档文件**（.jsonl.reset、.jsonl.deleted 等）即使已被删除，也能从文件名中提取时间
3. **边界条件**：
   - `--start 2026-04-15` 包含 2026-04-15 00:00:00 及之后的文件
   - `--end 2026-04-15` 不包含 2026-04-15 00:00:00 及之后的文件
4. **性能提升**：对于大量日志文件，使用时间过滤可以显著减少扫描和分析时间

## 常见用例

### 用例1：分析今天的问题

```bash
# 假设今天是 2026-04-17
python detect-all-transcript-issues.py --start 2026-04-17
```

### 用例2：分析上周的问题

```bash
# 分析 2026-04-10 到 2026-04-17 之间的问题
python detect-all-transcript-issues.py --start 2026-04-10 --end 2026-04-17
```

### 用例3：对比不同时间段

```bash
# 第一周
python detect-all-transcript-issues.py --start 2026-04-01 --end 2026-04-08 > report_week1.md

# 第二周
python detect-all-transcript-issues.py --start 2026-04-08 --end 2026-04-15 > report_week2.md
```

### 用例4：排查特定日期的问题

```bash
# 用户报告 2026-04-13 有问题，只分析这一天
python detect-all-transcript-issues.py --start 2026-04-13 --end 2026-04-14
```

## 技术实现

相关函数：
- `parse_time_argument()`: 解析时间参数字符串
- `extract_time_from_filename()`: 从文件名提取时间戳
- `filter_files_by_time()`: 根据时间范围过滤文件列表

代码位置：`scripts/detect-all-transcript-issues.py` 第 1016-1158 行
