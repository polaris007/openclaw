# Linux 环境运行指南

## 问题描述

在 Linux 服务器上运行 Python 2.7 版本的脚本时，可能会遇到以下错误：

```
UnicodeEncodeError: 'ascii' codec can't encode character u'\U0001f4c2' in position 0: ordinal not in range(128)
```

这是因为 Python 2.7 在处理 Unicode emoji 字符（如 📂、✅ 等）时，默认使用 ASCII 编码输出，导致编码失败。

## 解决方案

### 方案 1：自动处理（推荐）

脚本已经内置了自动处理逻辑，会在运行时设置 `PYTHONIOENCODING=utf-8` 环境变量。

**直接运行即可**：
```bash
python detect-all-transcript-issues.py
```

### 方案 2：手动设置环境变量

如果方案 1 仍然报错，可以手动设置环境变量：

```bash
# 方法 A：临时设置（仅当前命令有效）
PYTHONIOENCODING=utf-8 python detect-all-transcript-issues.py

# 方法 B：导出到当前会话（所有后续命令都有效）
export PYTHONIOENCODING=utf-8
python detect-all-transcript-issues.py
```

### 方案 3：检查终端编码

确保你的终端支持 UTF-8：

```bash
# 检查当前 locale 设置
locale

# 如果没有设置为 UTF-8，可以临时设置
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 然后运行脚本
python detect-all-transcript-issues.py
```

## 技术原理

### 问题根源

Python 2.7 的 `print` 语句在输出 Unicode 字符串时：
1. 检查 `sys.stdout.encoding`
2. 如果是 `None` 或 `ASCII`，尝试用 ASCII 编码
3. Emoji 字符超出 ASCII 范围（0-127），导致 `UnicodeEncodeError`

### 修复方法

脚本在启动时执行以下操作：

```python
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Windows 特殊处理
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout)
else:
    # Linux/Mac：检查并设置 stdout 编码
    if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding is None:
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout)
```

## 验证是否修复成功

运行脚本后，应该能看到正常的 emoji 输出：

```
📂 使用默认路径: /path/to/logs
🔍 开始扫描transcript文件...
找到 482 个JSONL文件

📋 检测到 accounts.csv，正在加载账户映射...
✅ 成功加载 114 个账户映射

已处理 50/482 个文件，发现问题 26 个...
...

✅ 分析完成！共发现 324 个问题
```

如果看到的是乱码或问号（?），说明编码仍有问题，请尝试方案 2 或方案 3。

## 常见问题

### Q1: 为什么 Windows 没问题，Linux 有问题？

**A**: Windows 控制台和 Linux 终端的默认编码不同：
- Windows：通常使用 GBK 或 UTF-8（取决于区域设置）
- Linux：通常使用 UTF-8，但 Python 2.7 可能检测不到

### Q2: 能否完全禁用 emoji？

**A**: 可以，修改脚本中的所有 emoji 为普通文本，例如：
- `📂` → `[DIR]`
- `✅` → `[OK]`
- `❌` → `[ERROR]`

### Q3: Python 3 有这个问题吗？

**A**: Python 3 默认使用 UTF-8，通常不会有这个问题。但为了兼容性，建议仍然设置 `PYTHONIOENCODING=utf-8`。

## 最佳实践

### 1. 后台运行（nohup）

**重要**：使用 `nohup` 运行时，必须添加 `-u` 参数或设置 `PYTHONUNBUFFERED`，否则输出会被缓冲，`nohup.out` 文件中看不到实时内容。

```bash
# 方法 A：使用 -u 参数（推荐）
nohup python2.7 -u detect-all-transcript-issues.py /datafs/openclaw > nohup.out 2>&1 &

# 方法 B：设置环境变量
nohup env PYTHONUNBUFFERED=1 python2.7 detect-all-transcript-issues.py /datafs/openclaw > nohup.out 2>&1 &

# 方法 C：使用 stdbuf
nohup stdbuf -oL -eL python2.7 detect-all-transcript-issues.py /datafs/openclaw > nohup.out 2>&1 &
```

**查看实时输出**：
```bash
tail -f nohup.out
```

**检查进程状态**：
```bash
ps aux | grep detect-all-transcript-issues
```

### 2. 优先使用 Python 3

如果可能，升级到 Python 3.x，它默认使用 UTF-8 编码，不会有这些问题。

### 3. 设置 Locale

确保服务器 locale 设置为 UTF-8：

```bash
# 检查当前 locale
locale

# 如果没有设置为 UTF-8
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

### 4. 使用虚拟环境

避免系统 Python 配置干扰：

```bash
python2.7 -m virtualenv venv
source venv/bin/activate
python detect-all-transcript-issues.py
```

### 5. 日志重定向

如果输出到文件，确保文件编码为 UTF-8：

```bash
# 输出到文件时指定编码
PYTHONIOENCODING=utf-8 python2.7 -u detect-all-transcript-issues.py > output.log 2>&1
```
