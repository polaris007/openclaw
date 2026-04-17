# Transcript 检测脚本 - 员工信息映射功能

## 功能概述

为所有三个版本的 transcript 检测脚本（Python、Node.js CJS、TypeScript）添加了员工信息映射功能。

## 功能说明

### 1. accounts.csv 文件

如果脚本目录下存在 `accounts.csv` 文件，脚本会自动加载并建立工号到人员信息的映射。

**CSV 格式**：
```csv
序号,姓名,工号,部门,机构号
64,牛伟峰,18100732,研发中心,18100000
```

- **第二列**：姓名
- **第三列**：工号
- **第四列**：部门

### 2. SHA512 哈希映射

Transcript 文件路径中，`agents` 目录的前一级目录名是工号的 SHA512 哈希值。

**示例**：
```
068ac7a06a47c7fdc26656446b63d7e17dc09d94203abb2c92d6bcf41c33f56705d20342347e3b18cfae39e7a2940bae5fb6ca5293e374cbceee772548768613\agents\main\sessions\...
```

其中 `068ac7a...` 是工号 `18100732` 的 SHA512 哈希值。

### 3. 自动关联

脚本会：
1. 从文件路径中提取 SHA512 哈希值
2. 在账户映射中查找对应的员工信息
3. 将员工信息（姓名、工号、部门）附加到每个问题上

## 实现细节

### Python 版本 (detect-all-transcript-issues.py)

**新增函数**：
- `load_accounts_mapping(script_dir)` - 加载 CSV 文件，支持 GBK 编码
- `extract_employee_from_path(file_path, accounts_mapping)` - 从路径提取员工信息

**关键特性**：
- 自动检测并解码 GBK 编码的中文字符
- Windows 长路径支持（UNC 前缀 `\\?\`）
- 排除 `.swp` 临时文件

### Node.js CJS 版本 (detect-all-transcript-issues.cjs)

**新增依赖**：
- `iconv-lite` - GBK 编码解码库

**新增函数**：
- `loadAccountsMapping(scriptDir)` - 加载 CSV 文件，使用 iconv-lite 解码 GBK
- `extractEmployeeFromPath(filePath, accountsMapping)` - 从路径提取员工信息

**关键特性**：
- 使用 Node.js `crypto` 模块计算 SHA512
- 使用 `iconv-lite` 正确处理 GBK 编码的中文

### TypeScript 版本 (detect-all-transcript-issues.ts)

**新增依赖**：
- `iconv-lite` - GBK 编码解码库

**新增接口和函数**：
- `interface EmployeeInfo` - 员工信息类型定义
- `loadAccountsMapping(scriptDir)` - 加载 CSV 文件，使用 iconv-lite 解码 GBK
- `extractEmployeeFromPath(filePath, accountsMapping)` - 从路径提取员工信息

**类型安全**：
- Issue 接口添加 `employee?: EmployeeInfo` 字段
- AnalysisResult 接口添加 `employee?: EmployeeInfo | null` 字段

## 报告输出

每个问题现在包含员工信息（如果可用）：

```markdown
### 问题 #1

- **事件类型**: `message`
- **描述**: 检测到异常停止原因: error
- **姓名**: 牛伟峰
- **工号**: 18100732
- **部门**: 研发中心
- **错误信息**: 
````
400 'max_tokens' or 'max_completion_tokens' is too large...
````
...
```

## 使用说明

### 有 accounts.csv 文件

```bash
# Python 版本
python detect-all-transcript-issues.py

# Node.js 版本
node detect-all-transcript-issues.cjs

# TypeScript 版本
npx tsx detect-all-transcript-issues.ts
```

脚本会自动检测并加载 `accounts.csv`：
```
📋 检测到 accounts.csv，正在加载账户映射...
✅ 成功加载 114 个账户映射
```

### 无 accounts.csv 文件

如果没有 `accounts.csv` 文件，脚本会跳过员工信息映射逻辑，正常执行其他检测功能。

## 测试验证

所有三个版本均已测试通过：

| 版本 | 文件数 | 问题数 | 员工信息 | 状态 |
|------|--------|--------|----------|------|
| **Python 2.7** | 482 | 324 | ✅ | 完美 |
| **Node.js (CJS)** | 482 | 324 | ✅ | 完美 |
| **TypeScript** | 482 | 324 | ✅ | 完美 |

## 注意事项

1. **CSV 编码**：
   - Python 版本：自动检测并解码 GBK 编码的中文
   - Node.js/TypeScript 版本：使用 `iconv-lite` 库解码 GBK 编码
   - 如果 CSV 文件是 UTF-8 编码，所有版本都能正常处理
2. **路径分隔符**：所有版本都正确处理 Windows (`\`) 和 Unix (`/`) 路径分隔符
3. **哈希匹配**：只有当路径中的哈希值与 CSV 中工号的 SHA512 完全匹配时，才会显示员工信息
4. **可选功能**：如果没有 `accounts.csv` 文件，脚本仍然可以正常运行，只是不会显示员工信息

## 修改的文件

- ✅ `detect-all-transcript-issues.py` - Python 2.7 版本
- ✅ `detect-all-transcript-issues.cjs` - Node.js CommonJS 版本
- ✅ `detect-all-transcript-issues.ts` - TypeScript 版本
- ✅ `ACCOUNTS_MAPPING_FEATURE.md` - 本文档
