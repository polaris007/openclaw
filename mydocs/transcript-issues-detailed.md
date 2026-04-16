# OpenClaw Session Transcript 问题详细清单

**生成时间**: 2026-04-16T07:51:48.009Z
**分析文件数**: 见统计
**问题总数**: 130

---

## 📊 统计概览

| 错误类型 | 数量 | 占比 |
|---------|------|------|
| warning | 78 | 60.0% |
| modelErrors | 30 | 23.1% |
| timeoutErrors | 22 | 16.9% |

**涉及会话数**: 41
**涉及文件数**: 41

---

## 🔴 问题详细列表

### 问题 #1

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
This operation was aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/0f8907022d9c7513b586d400ab3c57fb25659eee8f8b5017dd1e9cc094f4ce3a7cc87cb548522993c391f86e956c13838fbfec56464aa0879ce3c468c4aedbdc/agents/main/sessions/2b9f7ba4-e50c-4f33-bf96-85367fa6cebf.jsonl`
- **Session ID**: `2b9f7ba4-e50c-4f33-bf96-85367fa6cebf`
- **行号**: 67
- **时间戳**: 2026-04-13T08:22:43.124Z
- **Run ID**: `bc2b3f7b-2fae-4774-92b5-a36dc673385d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #2

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/0ee5ff89-79d5-41f8-a93f-49146d0f3722.jsonl`
- **Session ID**: `0ee5ff89-79d5-41f8-a93f-49146d0f3722`
- **行号**: 114
- **时间戳**: 2026-04-13T10:51:00.469Z
- **Run ID**: `b8a86d98-7887-4263-90d8-d5e5c0153909`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #3

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/c2dadcbe-f4b0-472d-aafe-122d0e670ede.jsonl`
- **Session ID**: `c2dadcbe-f4b0-472d-aafe-122d0e670ede`
- **行号**: 130
- **时间戳**: 2026-04-13T10:24:08.008Z
- **Run ID**: `aba0cdf6-68d5-4842-a735-b4adad95ff4c`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #4

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/f1aced44-6c24-42f6-aa51-3909db1ff629.jsonl`
- **Session ID**: `f1aced44-6c24-42f6-aa51-3909db1ff629`
- **行号**: 22
- **时间戳**: 2026-04-15T07:33:33.231Z
- **Run ID**: `bb3c513f-d87e-448f-8014-614e40c21906`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #5

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/fe368a91-4216-43d0-9bf1-dfa1cceed4bc.jsonl`
- **Session ID**: `fe368a91-4216-43d0-9bf1-dfa1cceed4bc`
- **行号**: 18
- **时间戳**: 2026-04-15T05:12:10.967Z
- **Run ID**: `0da67fde-8212-48e1-aaec-2bf06e64800d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #6

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/37d31ad6132bab00315c7b7adabe5b839b918500995ce145a03763c66ecc2f612ca90d021c7098f060f5f0547433161ce6af7f6899f2fc1e6f39bab40e12e65a/agents/main/sessions/0af83cd4-10a3-4966-8f3c-2b581a53bf99.jsonl`
- **Session ID**: `0af83cd4-10a3-4966-8f3c-2b581a53bf99`
- **行号**: 130
- **时间戳**: 2026-03-30T11:04:56.556Z
- **Run ID**: `req_1774868684378_4e84zalrb`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #7

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
This operation was aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/619aa316b92e3dfc3ebb94deaebb6af6052bc3f8c9557530ddd4b1f4525e8cdcb3775f71c6fb0ac96b744c11e1c8b5accbc8b356f3d2f75bdd5b75efed4ce0c0/agents/main/sessions/4f250dc6-3ebe-4fff-90ba-3497bbb9fe07.jsonl`
- **Session ID**: `4f250dc6-3ebe-4fff-90ba-3497bbb9fe07`
- **行号**: 23
- **时间戳**: 2026-04-16T01:17:52.673Z
- **Run ID**: `req_1776302087795_5cms510hh`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #8

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/6fca9aa611cf469e15161f2b342062f7c621c962e44d14a57ee1d61d972f9135cd6f8797feb2302283695088f655118edd65a6768f2159207fd01f575a80e207/agents/main/sessions/39028978-7dfa-4c83-ac08-4a49ed087310.jsonl`
- **Session ID**: `39028978-7dfa-4c83-ac08-4a49ed087310`
- **行号**: 10
- **时间戳**: 2026-04-13T08:14:46.326Z
- **Run ID**: `237cc3e6-bd84-4004-8086-704bedb2fe42`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #9

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/9a0af35c-6303-4ae7-a932-54396b74e799.jsonl`
- **Session ID**: `9a0af35c-6303-4ae7-a932-54396b74e799`
- **行号**: 126
- **时间戳**: 2026-04-14T07:18:07.475Z
- **Run ID**: `010bceeb-4f2b-4b81-acf0-7a01daee7b26`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #10

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/c124a8ac-1e3d-4b27-a6e6-e558938ce159.jsonl`
- **Session ID**: `c124a8ac-1e3d-4b27-a6e6-e558938ce159`
- **行号**: 93
- **时间戳**: 2026-04-03T06:23:38.192Z
- **Run ID**: `req_1775197362262_n7z2xlxi6`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #11

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0b6f9e7d-6192-44d8-b925-2c94cc74d371.jsonl`
- **Session ID**: `0b6f9e7d-6192-44d8-b925-2c94cc74d371`
- **行号**: 33
- **时间戳**: 2026-04-14T09:06:02.548Z
- **Run ID**: `bd352a63-b3a1-40de-ad85-384f60bb7a9a`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #12

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 72
- **时间戳**: 2026-04-14T06:25:22.297Z
- **Run ID**: `req_1776147850337_tyub0lfc0`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #13

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/3bf2a8e5-33de-4ef6-b677-a0ea9a3fbee3.jsonl`
- **Session ID**: `3bf2a8e5-33de-4ef6-b677-a0ea9a3fbee3`
- **行号**: 47
- **时间戳**: 2026-04-14T09:06:15.144Z
- **Run ID**: `574deee7-91d2-4251-8ab6-348eb9cadac3`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #14

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/495e09f3-443a-40ad-b26f-edc30ebcf118.jsonl`
- **Session ID**: `495e09f3-443a-40ad-b26f-edc30ebcf118`
- **行号**: 21
- **时间戳**: 2026-04-14T09:31:41.107Z
- **Run ID**: `25f6a0f7-6100-45bf-a238-3c1bde61470d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #15

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/66a18763-dcc3-4f3f-8838-88ce893158a4.jsonl`
- **Session ID**: `66a18763-dcc3-4f3f-8838-88ce893158a4`
- **行号**: 25
- **时间戳**: 2026-04-14T09:05:50.615Z
- **Run ID**: `a68d9714-a191-40b6-9d65-30d26303535a`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #16

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/8011363c-3210-4c83-a4d6-13c03b465220.jsonl`
- **Session ID**: `8011363c-3210-4c83-a4d6-13c03b465220`
- **行号**: 22
- **时间戳**: 2026-04-14T09:07:39.822Z
- **Run ID**: `421add1e-43ff-4965-894d-176cf2f736d0`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #17

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/a5d510bb-1b47-4314-9446-1732cc207874.jsonl`
- **Session ID**: `a5d510bb-1b47-4314-9446-1732cc207874`
- **行号**: 29
- **时间戳**: 2026-04-14T09:27:15.603Z
- **Run ID**: `27ca7b27-88b7-4ee2-8d53-d0c795bfe759`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #18

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/acee90b3-b877-42fd-abeb-3700b4b5fd57.jsonl`
- **Session ID**: `acee90b3-b877-42fd-abeb-3700b4b5fd57`
- **行号**: 15
- **时间戳**: 2026-04-14T09:07:50.999Z
- **Run ID**: `c4c8ea24-93a8-431a-aa6f-3f891ee544d9`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #19

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/b622c006-2698-4967-9e4c-0a44c6c9457c.jsonl`
- **Session ID**: `b622c006-2698-4967-9e4c-0a44c6c9457c`
- **行号**: 30
- **时间戳**: 2026-04-14T09:05:53.878Z
- **Run ID**: `f05dfe06-c8f8-4a25-b16e-01468e47c033`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #20

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/b7865994-0c4a-4761-ace1-c637f4fe4ab5.jsonl`
- **Session ID**: `b7865994-0c4a-4761-ace1-c637f4fe4ab5`
- **行号**: 8
- **时间戳**: 2026-04-15T09:20:51.687Z
- **Run ID**: `bbae6408-de89-479f-90f0-235dd832faed`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #21

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/d66da86c-8415-45d4-b226-3f67b20e6c72.jsonl`
- **Session ID**: `d66da86c-8415-45d4-b226-3f67b20e6c72`
- **行号**: 23
- **时间戳**: 2026-04-14T09:05:45.740Z
- **Run ID**: `4020997d-ba23-4765-be3d-419acf130ddc`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #22

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/efe3c556-5c92-4323-b1dc-9d80cadd71fb.jsonl`
- **Session ID**: `efe3c556-5c92-4323-b1dc-9d80cadd71fb`
- **行号**: 32
- **时间戳**: 2026-04-14T09:33:04.696Z
- **Run ID**: `68d03430-23ec-4958-b0fa-9b1f2fe9325e`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #23

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/f21ffaa1-f08e-4c01-bf00-fc674c1ad6c6.jsonl`
- **Session ID**: `f21ffaa1-f08e-4c01-bf00-fc674c1ad6c6`
- **行号**: 42
- **时间戳**: 2026-04-14T09:30:17.499Z
- **Run ID**: `a169213c-b705-4a42-8164-7f40fc703801`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #24

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/f2d7f49d-9571-4cc1-a3de-fb002d6fb441.jsonl`
- **Session ID**: `f2d7f49d-9571-4cc1-a3de-fb002d6fb441`
- **行号**: 8
- **时间戳**: 2026-04-15T09:22:18.505Z
- **Run ID**: `766d9b83-aada-4e2e-9b95-75c228b3b61d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #25

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/fe866c45-f880-4daa-b46e-4db9ee164372.jsonl`
- **Session ID**: `fe866c45-f880-4daa-b46e-4db9ee164372`
- **行号**: 40
- **时间戳**: 2026-04-14T09:06:10.791Z
- **Run ID**: `62ca17d5-cbc7-45a4-a5ea-7d5faeeb11d0`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #26

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/e82a63b4e5707d2608b9934c9266f851b29f2330a215009260a56daa48c47e575bedabfcc33ef2700b5c722e5e32f5f4d0060d4b0a8f13a677754aae776ce452/agents/main/sessions/54355af5-ac92-4baf-a0df-42f72ff7c497.jsonl`
- **Session ID**: `d4678ca9-d333-45fc-b9d5-9197b9cf2cea`
- **行号**: 5
- **时间戳**: 2026-04-03T06:35:02.235Z
- **Run ID**: `req_1775197972491_55uwzwguf`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #27

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/e82a63b4e5707d2608b9934c9266f851b29f2330a215009260a56daa48c47e575bedabfcc33ef2700b5c722e5e32f5f4d0060d4b0a8f13a677754aae776ce452/agents/main/sessions/c5c862a7-da7a-4e74-ad62-5c3afec2c9e2.jsonl`
- **Session ID**: `b5018140-32f9-4102-879a-7853821a47d1`
- **行号**: 5
- **时间戳**: 2026-04-02T09:27:20.261Z
- **Run ID**: `req_1775122020273_g1x9hzjom`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #28

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
This operation was aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 37
- **时间戳**: 2026-04-15T01:44:18.902Z
- **Run ID**: `f73d774c-9773-48ae-a324-5d1e18eddad4`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #29

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
This operation was aborted
```
- **原因分析**: 请求被中止，可能原因：1) 用户主动取消操作；2) 系统资源限制触发中止；3) 会话超时被清理；4) 新请求到来时旧请求被取消
- **文件位置**: `logs/session-transcript/openclaw-logs/0f8907022d9c7513b586d400ab3c57fb25659eee8f8b5017dd1e9cc094f4ce3a7cc87cb548522993c391f86e956c13838fbfec56464aa0879ce3c468c4aedbdc/agents/main/sessions/2b9f7ba4-e50c-4f33-bf96-85367fa6cebf.jsonl`
- **Session ID**: `2b9f7ba4-e50c-4f33-bf96-85367fa6cebf`
- **行号**: 71
- **时间戳**: 2026-04-13T08:24:02.172Z
- **Run ID**: `2e6ad39f-3981-4dfa-9e0e-8454d3961af2`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #30

- **错误类型**: modelErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到模型API错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 模型服务响应超时，可能原因：1) 网络延迟或不稳定；2) 模型服务端负载过高；3) Prompt过长导致处理时间增加；4) 前置工具执行失败导致模型等待用户输入
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 74
- **时间戳**: 2026-04-14T06:42:55.899Z
- **Run ID**: `req_1776148910958_kbpe7zfuk`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #31

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/0ee5ff89-79d5-41f8-a93f-49146d0f3722.jsonl`
- **Session ID**: `0ee5ff89-79d5-41f8-a93f-49146d0f3722`
- **行号**: 114
- **时间戳**: 2026-04-13T10:51:00.469Z
- **Run ID**: `b8a86d98-7887-4263-90d8-d5e5c0153909`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #32

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/c2dadcbe-f4b0-472d-aafe-122d0e670ede.jsonl`
- **Session ID**: `c2dadcbe-f4b0-472d-aafe-122d0e670ede`
- **行号**: 130
- **时间戳**: 2026-04-13T10:24:08.008Z
- **Run ID**: `aba0cdf6-68d5-4842-a735-b4adad95ff4c`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #33

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/f1aced44-6c24-42f6-aa51-3909db1ff629.jsonl`
- **Session ID**: `f1aced44-6c24-42f6-aa51-3909db1ff629`
- **行号**: 22
- **时间戳**: 2026-04-15T07:33:33.231Z
- **Run ID**: `bb3c513f-d87e-448f-8014-614e40c21906`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #34

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/fe368a91-4216-43d0-9bf1-dfa1cceed4bc.jsonl`
- **Session ID**: `fe368a91-4216-43d0-9bf1-dfa1cceed4bc`
- **行号**: 18
- **时间戳**: 2026-04-15T05:12:10.967Z
- **Run ID**: `0da67fde-8212-48e1-aaec-2bf06e64800d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #35

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/6fca9aa611cf469e15161f2b342062f7c621c962e44d14a57ee1d61d972f9135cd6f8797feb2302283695088f655118edd65a6768f2159207fd01f575a80e207/agents/main/sessions/39028978-7dfa-4c83-ac08-4a49ed087310.jsonl`
- **Session ID**: `39028978-7dfa-4c83-ac08-4a49ed087310`
- **行号**: 10
- **时间戳**: 2026-04-13T08:14:46.326Z
- **Run ID**: `237cc3e6-bd84-4004-8086-704bedb2fe42`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #36

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/9a0af35c-6303-4ae7-a932-54396b74e799.jsonl`
- **Session ID**: `9a0af35c-6303-4ae7-a932-54396b74e799`
- **行号**: 126
- **时间戳**: 2026-04-14T07:18:07.475Z
- **Run ID**: `010bceeb-4f2b-4b81-acf0-7a01daee7b26`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #37

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0b6f9e7d-6192-44d8-b925-2c94cc74d371.jsonl`
- **Session ID**: `0b6f9e7d-6192-44d8-b925-2c94cc74d371`
- **行号**: 33
- **时间戳**: 2026-04-14T09:06:02.548Z
- **Run ID**: `bd352a63-b3a1-40de-ad85-384f60bb7a9a`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #38

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 72
- **时间戳**: 2026-04-14T06:25:22.297Z
- **Run ID**: `req_1776147850337_tyub0lfc0`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #39

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/3bf2a8e5-33de-4ef6-b677-a0ea9a3fbee3.jsonl`
- **Session ID**: `3bf2a8e5-33de-4ef6-b677-a0ea9a3fbee3`
- **行号**: 47
- **时间戳**: 2026-04-14T09:06:15.144Z
- **Run ID**: `574deee7-91d2-4251-8ab6-348eb9cadac3`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #40

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/495e09f3-443a-40ad-b26f-edc30ebcf118.jsonl`
- **Session ID**: `495e09f3-443a-40ad-b26f-edc30ebcf118`
- **行号**: 21
- **时间戳**: 2026-04-14T09:31:41.107Z
- **Run ID**: `25f6a0f7-6100-45bf-a238-3c1bde61470d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #41

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/66a18763-dcc3-4f3f-8838-88ce893158a4.jsonl`
- **Session ID**: `66a18763-dcc3-4f3f-8838-88ce893158a4`
- **行号**: 25
- **时间戳**: 2026-04-14T09:05:50.615Z
- **Run ID**: `a68d9714-a191-40b6-9d65-30d26303535a`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #42

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/8011363c-3210-4c83-a4d6-13c03b465220.jsonl`
- **Session ID**: `8011363c-3210-4c83-a4d6-13c03b465220`
- **行号**: 22
- **时间戳**: 2026-04-14T09:07:39.822Z
- **Run ID**: `421add1e-43ff-4965-894d-176cf2f736d0`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #43

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/a5d510bb-1b47-4314-9446-1732cc207874.jsonl`
- **Session ID**: `a5d510bb-1b47-4314-9446-1732cc207874`
- **行号**: 29
- **时间戳**: 2026-04-14T09:27:15.603Z
- **Run ID**: `27ca7b27-88b7-4ee2-8d53-d0c795bfe759`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #44

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/acee90b3-b877-42fd-abeb-3700b4b5fd57.jsonl`
- **Session ID**: `acee90b3-b877-42fd-abeb-3700b4b5fd57`
- **行号**: 15
- **时间戳**: 2026-04-14T09:07:50.999Z
- **Run ID**: `c4c8ea24-93a8-431a-aa6f-3f891ee544d9`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #45

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/b622c006-2698-4967-9e4c-0a44c6c9457c.jsonl`
- **Session ID**: `b622c006-2698-4967-9e4c-0a44c6c9457c`
- **行号**: 30
- **时间戳**: 2026-04-14T09:05:53.878Z
- **Run ID**: `f05dfe06-c8f8-4a25-b16e-01468e47c033`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #46

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/b7865994-0c4a-4761-ace1-c637f4fe4ab5.jsonl`
- **Session ID**: `b7865994-0c4a-4761-ace1-c637f4fe4ab5`
- **行号**: 8
- **时间戳**: 2026-04-15T09:20:51.687Z
- **Run ID**: `bbae6408-de89-479f-90f0-235dd832faed`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #47

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/d66da86c-8415-45d4-b226-3f67b20e6c72.jsonl`
- **Session ID**: `d66da86c-8415-45d4-b226-3f67b20e6c72`
- **行号**: 23
- **时间戳**: 2026-04-14T09:05:45.740Z
- **Run ID**: `4020997d-ba23-4765-be3d-419acf130ddc`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #48

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/efe3c556-5c92-4323-b1dc-9d80cadd71fb.jsonl`
- **Session ID**: `efe3c556-5c92-4323-b1dc-9d80cadd71fb`
- **行号**: 32
- **时间戳**: 2026-04-14T09:33:04.696Z
- **Run ID**: `68d03430-23ec-4958-b0fa-9b1f2fe9325e`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #49

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/f21ffaa1-f08e-4c01-bf00-fc674c1ad6c6.jsonl`
- **Session ID**: `f21ffaa1-f08e-4c01-bf00-fc674c1ad6c6`
- **行号**: 42
- **时间戳**: 2026-04-14T09:30:17.499Z
- **Run ID**: `a169213c-b705-4a42-8164-7f40fc703801`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #50

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/f2d7f49d-9571-4cc1-a3de-fb002d6fb441.jsonl`
- **Session ID**: `f2d7f49d-9571-4cc1-a3de-fb002d6fb441`
- **行号**: 8
- **时间戳**: 2026-04-15T09:22:18.505Z
- **Run ID**: `766d9b83-aada-4e2e-9b95-75c228b3b61d`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #51

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/fe866c45-f880-4daa-b46e-4db9ee164372.jsonl`
- **Session ID**: `fe866c45-f880-4daa-b46e-4db9ee164372`
- **行号**: 40
- **时间戳**: 2026-04-14T09:06:10.791Z
- **Run ID**: `62ca17d5-cbc7-45a4-a5ea-7d5faeeb11d0`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #52

- **错误类型**: timeoutErrors
- **事件类型**: `openclaw:prompt-error`
- **描述**: 检测到超时错误事件
- **错误信息**: 
```
LLM idle timeout (60s): no response from model
```
- **原因分析**: 空闲超时，模型在指定时间内未返回响应。可能原因：1) 模型处理复杂任务耗时过长；2) 模型陷入循环或等待；3) 网络中断导致响应无法到达
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 74
- **时间戳**: 2026-04-14T06:42:55.899Z
- **Run ID**: `req_1776148910958_kbpe7zfuk`
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`

---

### 问题 #53

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/b57d8f72-a5ec-4f01-b83b-4c1f823cc564.jsonl`
- **Session ID**: `b57d8f72-a5ec-4f01-b83b-4c1f823cc564`
- **行号**: 102
- **时间戳**: 2026-04-15T09:11:33.012Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #54

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/55b3dbad-7082-44c9-8556-9346043c798d.jsonl`
- **Session ID**: `55b3dbad-7082-44c9-8556-9346043c798d`
- **行号**: 38
- **时间戳**: 2026-04-03T06:22:54.912Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #55

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/6fca9aa611cf469e15161f2b342062f7c621c962e44d14a57ee1d61d972f9135cd6f8797feb2302283695088f655118edd65a6768f2159207fd01f575a80e207/agents/main/sessions/ecf6d23a-a5ba-4838-a8bc-de4291d68a48.jsonl`
- **Session ID**: `ecf6d23a-a5ba-4838-a8bc-de4291d68a48`
- **行号**: 40
- **时间戳**: 2026-04-13T06:13:30.457Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #56

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 6
- **时间戳**: 2026-03-25T05:25:08.052Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #57

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/21c20430-e74b-4ea9-8370-5b818e07807f.jsonl`
- **Session ID**: `21c20430-e74b-4ea9-8370-5b818e07807f`
- **行号**: 116
- **时间戳**: 2026-04-03T09:15:16.986Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #58

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/57655182-1fa9-4dca-aafc-f16e69319ef6.jsonl`
- **Session ID**: `57655182-1fa9-4dca-aafc-f16e69319ef6`
- **行号**: 8
- **时间戳**: 2026-04-14T07:18:49.508Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #59

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/9ccfae6c-1ba2-4215-b07c-f16eebaee938.jsonl`
- **Session ID**: `9ccfae6c-1ba2-4215-b07c-f16eebaee938`
- **行号**: 8
- **时间戳**: 2026-04-14T07:05:53.732Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #60

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/f15427eb-5cbe-4649-b5e5-ff97dbf69934.jsonl`
- **Session ID**: `f15427eb-5cbe-4649-b5e5-ff97dbf69934`
- **行号**: 8
- **时间戳**: 2026-04-14T07:06:12.385Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #61

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/8e991737-22bf-448e-8bbe-c62186c39811.jsonl`
- **Session ID**: `8e991737-22bf-448e-8bbe-c62186c39811`
- **行号**: 40
- **时间戳**: 2026-04-15T06:24:52.873Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #62

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e.jsonl`
- **Session ID**: `c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e`
- **行号**: 10
- **时间戳**: 2026-04-15T05:15:50.271Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #63

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/d29befe28f6d1a440997a29a90d297a20ea5c6b0effffb94967c082745c678e4b4efc8f29e2c81246b38e206e09c98183755650d5db5fc6f525f9d8928b67e24/agents/main/sessions/452b6522-ab61-4cb5-9e12-993c22302827.jsonl`
- **Session ID**: `452b6522-ab61-4cb5-9e12-993c22302827`
- **行号**: 38
- **时间戳**: 2026-04-07T02:07:42.220Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #64

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/e82a63b4e5707d2608b9934c9266f851b29f2330a215009260a56daa48c47e575bedabfcc33ef2700b5c722e5e32f5f4d0060d4b0a8f13a677754aae776ce452/agents/main/sessions/5a7e6f9d-4c43-4a9a-820e-5ba304317da6.jsonl`
- **Session ID**: `5a7e6f9d-4c43-4a9a-820e-5ba304317da6`
- **行号**: 121
- **时间戳**: 2026-03-31T09:25:55.791Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #65

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/fa65c292bbe559bed0e01c9bf4ab7206fea633ad01ff275cb3653e15b8eeb8392f5c407ef79ffee6a7cc913e6e645c52665f51d413888ea1d0a0d252182dc6a8/agents/main/sessions/8a7a7bbf-e23c-4c9c-bee2-e3b0d0f793dd.jsonl`
- **Session ID**: `8a7a7bbf-e23c-4c9c-bee2-e3b0d0f793dd`
- **行号**: 38
- **时间戳**: 2026-04-13T02:18:17.058Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #66

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: aborted)
- **错误信息**: 
```
好的！我来将您提供的数据转换成 JSON 格式：

```json
[
  {
    "name": "李卫",
    "workNo": "11000469",
    "orgCode": "10000004"
  },
  {
    "name": "康春芳",

```
- **原因分析**: 请求被主动中止。可能原因：1) 用户取消操作；2) 系统资源压力触发清理；3) 超时保护机制启动；4) 并发控制取消旧请求
- **文件位置**: `logs/session-transcript/openclaw-logs/0f8907022d9c7513b586d400ab3c57fb25659eee8f8b5017dd1e9cc094f4ce3a7cc87cb548522993c391f86e956c13838fbfec56464aa0879ce3c468c4aedbdc/agents/main/sessions/2b9f7ba4-e50c-4f33-bf96-85367fa6cebf.jsonl`
- **Session ID**: `2b9f7ba4-e50c-4f33-bf96-85367fa6cebf`
- **行号**: 68
- **时间戳**: 2026-04-13T08:22:43.126Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `aborted`

---

### 问题 #67

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/b57d8f72-a5ec-4f01-b83b-4c1f823cc564.jsonl`
- **Session ID**: `b57d8f72-a5ec-4f01-b83b-4c1f823cc564`
- **行号**: 105
- **时间戳**: 2026-04-15T09:31:33.448Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #68

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/55b3dbad-7082-44c9-8556-9346043c798d.jsonl`
- **Session ID**: `55b3dbad-7082-44c9-8556-9346043c798d`
- **行号**: 40
- **时间戳**: 2026-04-03T06:50:47.415Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #69

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/37d31ad6132bab00315c7b7adabe5b839b918500995ce145a03763c66ecc2f612ca90d021c7098f060f5f0547433161ce6af7f6899f2fc1e6f39bab40e12e65a/agents/main/sessions/0af83cd4-10a3-4966-8f3c-2b581a53bf99.jsonl`
- **Session ID**: `0af83cd4-10a3-4966-8f3c-2b581a53bf99`
- **行号**: 249
- **时间戳**: 2026-03-30T11:59:24.310Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #70

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/6fca9aa611cf469e15161f2b342062f7c621c962e44d14a57ee1d61d972f9135cd6f8797feb2302283695088f655118edd65a6768f2159207fd01f575a80e207/agents/main/sessions/ecf6d23a-a5ba-4838-a8bc-de4291d68a48.jsonl`
- **Session ID**: `ecf6d23a-a5ba-4838-a8bc-de4291d68a48`
- **行号**: 42
- **时间戳**: 2026-04-13T06:14:13.557Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #71

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 7
- **时间戳**: 2026-03-25T05:25:11.504Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #72

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/21c20430-e74b-4ea9-8370-5b818e07807f.jsonl`
- **Session ID**: `21c20430-e74b-4ea9-8370-5b818e07807f`
- **行号**: 118
- **时间戳**: 2026-04-03T09:17:19.445Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #73

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: aborted)
- **错误信息**: 
```
仍然返回 500 错误。让我尝试使用一个已经成功上传的 `.docx` 文件
```
- **原因分析**: 请求被主动中止。可能原因：1) 用户取消操作；2) 系统资源压力触发清理；3) 超时保护机制启动；4) 并发控制取消旧请求
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/c124a8ac-1e3d-4b27-a6e6-e558938ce159.jsonl`
- **Session ID**: `c124a8ac-1e3d-4b27-a6e6-e558938ce159`
- **行号**: 94
- **时间戳**: 2026-04-03T06:23:38.196Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `aborted`

---

### 问题 #74

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e.jsonl`
- **Session ID**: `c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e`
- **行号**: 13
- **时间戳**: 2026-04-15T05:17:31.594Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #75

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/e82a63b4e5707d2608b9934c9266f851b29f2330a215009260a56daa48c47e575bedabfcc33ef2700b5c722e5e32f5f4d0060d4b0a8f13a677754aae776ce452/agents/main/sessions/5a7e6f9d-4c43-4a9a-820e-5ba304317da6.jsonl`
- **Session ID**: `5a7e6f9d-4c43-4a9a-820e-5ba304317da6`
- **行号**: 123
- **时间戳**: 2026-03-31T09:26:11.341Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #76

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: aborted)
- **错误信息**: 
```
## 🚨 K8s 集群运行状况检查报告

### ✅ 集群基础状态
- **API Server 状态**: **正常** (healthz 返回 "ok")
- **Kubernetes 版本**: v1.18.14 (2020-12-18)
- **API Server 地址**: 10.43.0.1:443
- **当前节点**: openclaw-18182001-64c546d697-
```
- **原因分析**: 请求被主动中止。可能原因：1) 用户取消操作；2) 系统资源压力触发清理；3) 超时保护机制启动；4) 并发控制取消旧请求
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 38
- **时间戳**: 2026-04-15T01:44:18.906Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `aborted`

---

### 问题 #77

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/b57d8f72-a5ec-4f01-b83b-4c1f823cc564.jsonl`
- **Session ID**: `b57d8f72-a5ec-4f01-b83b-4c1f823cc564`
- **行号**: 108
- **时间戳**: 2026-04-16T01:12:45.945Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #78

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/2839c2f17383d426e0f87c82614743eed21a2aa5a58d39da3b11de6dc56388a31ba9219c47d42da0009bc58633ad7c2f6003d505d1ffb40a96eac87034abf2bf/agents/main/sessions/55b3dbad-7082-44c9-8556-9346043c798d.jsonl`
- **Session ID**: `55b3dbad-7082-44c9-8556-9346043c798d`
- **行号**: 42
- **时间戳**: 2026-04-03T07:18:27.370Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #79

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/37d31ad6132bab00315c7b7adabe5b839b918500995ce145a03763c66ecc2f612ca90d021c7098f060f5f0547433161ce6af7f6899f2fc1e6f39bab40e12e65a/agents/main/sessions/0af83cd4-10a3-4966-8f3c-2b581a53bf99.jsonl`
- **Session ID**: `0af83cd4-10a3-4966-8f3c-2b581a53bf99`
- **行号**: 251
- **时间戳**: 2026-03-30T12:00:40.495Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #80

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 8
- **时间戳**: 2026-03-25T05:25:16.991Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #81

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/21c20430-e74b-4ea9-8370-5b818e07807f.jsonl`
- **Session ID**: `21c20430-e74b-4ea9-8370-5b818e07807f`
- **行号**: 120
- **时间戳**: 2026-04-03T09:32:46.406Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #82

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/c124a8ac-1e3d-4b27-a6e6-e558938ce159.jsonl`
- **Session ID**: `c124a8ac-1e3d-4b27-a6e6-e558938ce159`
- **行号**: 144
- **时间戳**: 2026-04-03T06:45:38.126Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #83

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e.jsonl`
- **Session ID**: `c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e`
- **行号**: 16
- **时间戳**: 2026-04-15T05:17:56.401Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #84

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/e82a63b4e5707d2608b9934c9266f851b29f2330a215009260a56daa48c47e575bedabfcc33ef2700b5c722e5e32f5f4d0060d4b0a8f13a677754aae776ce452/agents/main/sessions/5a7e6f9d-4c43-4a9a-820e-5ba304317da6.jsonl`
- **Session ID**: `5a7e6f9d-4c43-4a9a-820e-5ba304317da6`
- **行号**: 125
- **时间戳**: 2026-03-31T09:26:11.662Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #85

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 118
- **时间戳**: 2026-04-15T01:56:58.502Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #86

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: aborted)
- **错误信息**: 
```
好的！我来帮您将数据转换成指定的 JSON 格式：

```json
[
  {"uid": "11000469", "userName": "李卫", "orgCode": "10000004"},
  {"uid": "11000492", "userName": "康春芳", "org
```
- **原因分析**: 请求被主动中止。可能原因：1) 用户取消操作；2) 系统资源压力触发清理；3) 超时保护机制启动；4) 并发控制取消旧请求
- **文件位置**: `logs/session-transcript/openclaw-logs/0f8907022d9c7513b586d400ab3c57fb25659eee8f8b5017dd1e9cc094f4ce3a7cc87cb548522993c391f86e956c13838fbfec56464aa0879ce3c468c4aedbdc/agents/main/sessions/2b9f7ba4-e50c-4f33-bf96-85367fa6cebf.jsonl`
- **Session ID**: `2b9f7ba4-e50c-4f33-bf96-85367fa6cebf`
- **行号**: 72
- **时间戳**: 2026-04-13T08:24:02.174Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `aborted`

---

### 问题 #87

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/b57d8f72-a5ec-4f01-b83b-4c1f823cc564.jsonl`
- **Session ID**: `b57d8f72-a5ec-4f01-b83b-4c1f823cc564`
- **行号**: 111
- **时间戳**: 2026-04-16T01:12:48.085Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #88

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/37d31ad6132bab00315c7b7adabe5b839b918500995ce145a03763c66ecc2f612ca90d021c7098f060f5f0547433161ce6af7f6899f2fc1e6f39bab40e12e65a/agents/main/sessions/0af83cd4-10a3-4966-8f3c-2b581a53bf99.jsonl`
- **Session ID**: `0af83cd4-10a3-4966-8f3c-2b581a53bf99`
- **行号**: 269
- **时间戳**: 2026-03-30T12:02:07.765Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #89

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 9
- **时间戳**: 2026-03-25T05:25:26.271Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #90

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/c124a8ac-1e3d-4b27-a6e6-e558938ce159.jsonl`
- **Session ID**: `c124a8ac-1e3d-4b27-a6e6-e558938ce159`
- **行号**: 146
- **时间戳**: 2026-04-03T07:01:02.066Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #91

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e.jsonl`
- **Session ID**: `c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e`
- **行号**: 19
- **时间戳**: 2026-04-15T05:17:58.646Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #92

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 121
- **时间戳**: 2026-04-15T01:58:42.863Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #93

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/b57d8f72-a5ec-4f01-b83b-4c1f823cc564.jsonl`
- **Session ID**: `b57d8f72-a5ec-4f01-b83b-4c1f823cc564`
- **行号**: 114
- **时间戳**: 2026-04-16T01:12:49.844Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #94

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/37d31ad6132bab00315c7b7adabe5b839b918500995ce145a03763c66ecc2f612ca90d021c7098f060f5f0547433161ce6af7f6899f2fc1e6f39bab40e12e65a/agents/main/sessions/0af83cd4-10a3-4966-8f3c-2b581a53bf99.jsonl`
- **Session ID**: `0af83cd4-10a3-4966-8f3c-2b581a53bf99`
- **行号**: 271
- **时间戳**: 2026-03-30T12:36:21.160Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #95

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 11
- **时间戳**: 2026-03-25T05:25:49.595Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #96

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a793d94b6ad1c388bc785ea54e450926b729a9ed21fd7f5685e549542317b191889efa017a1d6c1cea1b952519ba7f227fe5499937e9452e032463addb26e3de/agents/main/sessions/c124a8ac-1e3d-4b27-a6e6-e558938ce159.jsonl`
- **Session ID**: `c124a8ac-1e3d-4b27-a6e6-e558938ce159`
- **行号**: 148
- **时间戳**: 2026-04-03T07:13:44.537Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #97

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e.jsonl`
- **Session ID**: `c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e`
- **行号**: 22
- **时间戳**: 2026-04-15T05:18:00.910Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #98

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 113
- **时间戳**: 2026-04-14T09:04:07.147Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #99

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 124
- **时间戳**: 2026-04-15T01:59:10.369Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #100

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/13c13153a543ecba2ba0adb5b621795367f9130736913b4d3bbb5b8244184d6163cd24120cba49ff7f7a07a9b5bb27cc263a5db4d6fc3a9b80b2cf24df09952d/agents/main/sessions/b57d8f72-a5ec-4f01-b83b-4c1f823cc564.jsonl`
- **Session ID**: `b57d8f72-a5ec-4f01-b83b-4c1f823cc564`
- **行号**: 117
- **时间戳**: 2026-04-16T01:12:51.724Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #101

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/37d31ad6132bab00315c7b7adabe5b839b918500995ce145a03763c66ecc2f612ca90d021c7098f060f5f0547433161ce6af7f6899f2fc1e6f39bab40e12e65a/agents/main/sessions/0af83cd4-10a3-4966-8f3c-2b581a53bf99.jsonl`
- **Session ID**: `0af83cd4-10a3-4966-8f3c-2b581a53bf99`
- **行号**: 273
- **时间戳**: 2026-03-30T12:36:21.617Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #102

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 12
- **时间戳**: 2026-03-25T05:25:53.195Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #103

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/a995c7a073fd97cd533a17b62717f0d48e1c6a2d3597fb0668c16564788bde06a2ca13b88f6f674596a9d3f0ae0194307a36103251a8b8cc2ac7cbcc8717ee82/agents/main/sessions/c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e.jsonl`
- **Session ID**: `c4600d75-8dd6-4f40-814c-a0ce5cbfbc5e`
- **行号**: 25
- **时间戳**: 2026-04-15T05:18:02.611Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #104

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 149
- **时间戳**: 2026-04-14T09:11:40.120Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #105

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 127
- **时间戳**: 2026-04-15T01:59:14.608Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #106

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 13
- **时间戳**: 2026-03-25T05:25:58.663Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #107

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 152
- **时间戳**: 2026-04-14T09:11:41.959Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #108

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 130
- **时间戳**: 2026-04-15T01:59:17.769Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #109

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 14
- **时间戳**: 2026-03-25T05:26:08.147Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #110

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 155
- **时间戳**: 2026-04-14T09:11:43.993Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #111

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/f222336474c3c33b45b015cca3fdcf24fbfc8a597f351d79bc150829f53504e5d7819658cde4a8f7af659e260af6be27b33dcadf21b2b5928bbdc265681b3e6d/agents/main/sessions/8ef546cf-18a4-43a7-baec-ed0207c28996.jsonl`
- **Session ID**: `8ef546cf-18a4-43a7-baec-ed0207c28996`
- **行号**: 133
- **时间戳**: 2026-04-15T01:59:19.899Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #112

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 244
- **时间戳**: 2026-03-26T01:53:01.595Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #113

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 158
- **时间戳**: 2026-04-14T09:11:46.324Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #114

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 246
- **时间戳**: 2026-03-26T02:00:40.558Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #115

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 161
- **时间戳**: 2026-04-14T09:11:48.360Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #116

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 248
- **时间戳**: 2026-03-26T02:01:46.469Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #117

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 164
- **时间戳**: 2026-04-14T09:11:51.942Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #118

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/902b55f3e6f72c412522719af72c4a67a6809d8f908c19bdf409d68941942599c5f008b7a7a2170f407ad283504b75e2efdffcdd4e98826974fcaa621e929062/agents/main/sessions/38cb43c3-64cc-47c2-8ad0-9752d31a0c95.jsonl`
- **Session ID**: `38cb43c3-64cc-47c2-8ad0-9752d31a0c95`
- **行号**: 250
- **时间戳**: 2026-03-26T02:01:46.893Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #119

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 167
- **时间戳**: 2026-04-14T09:11:53.787Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #120

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 170
- **时间戳**: 2026-04-14T09:11:56.038Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #121

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 173
- **时间戳**: 2026-04-14T09:11:58.063Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #122

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 176
- **时间戳**: 2026-04-14T09:12:00.091Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #123

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 179
- **时间戳**: 2026-04-14T09:12:02.226Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #124

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 182
- **时间戳**: 2026-04-14T09:12:04.694Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #125

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 185
- **时间戳**: 2026-04-14T09:12:06.970Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #126

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 188
- **时间戳**: 2026-04-14T09:12:09.210Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #127

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 191
- **时间戳**: 2026-04-14T09:20:57.903Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #128

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 194
- **时间戳**: 2026-04-14T09:21:00.619Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #129

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 197
- **时间戳**: 2026-04-14T09:21:02.413Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

### 问题 #130

- **错误类型**: warning
- **事件类型**: `abnormal_stop`
- **描述**: 对话异常终止 (stopReason: error)
- **错误信息**: 
```
消息以 error 原因停止
```
- **原因分析**: 执行过程中发生错误导致终止。需要查看前面的错误事件确定具体原因
- **文件位置**: `logs/session-transcript/openclaw-logs/b487297d6f8f74a2f1bced0cfbb32195bbbe3294ebeb0cdfbff67144cf38d843240dd65c30cbd9cab73ae5800a5a6c75aaea3f1e23a6cfee9dbc6cc71c352753/agents/main/sessions/0f678300-9756-4ea9-b283-9cf231eaba5f.jsonl`
- **Session ID**: `0f678300-9756-4ea9-b283-9cf231eaba5f`
- **行号**: 200
- **时间戳**: 2026-04-14T09:21:04.194Z
- **Provider**: `my-qwen-provider`
- **Model**: `AIAPLLM-vision-nothink`
- **Stop Reason**: `error`

---

