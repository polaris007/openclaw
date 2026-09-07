# Bootstrap Task: Fill Project Development Guidelines

**You (the AI) are running this task. The developer does not read this file.**

The developer just ran `trellis init` on this project for the first time.
`.trellis/` now exists with empty spec scaffolding, and this bootstrap task
exists under `.trellis/tasks/`. When they want to work on it, they should start
this task from a session that provides Trellis session identity.

**Your job**: help them populate `.trellis/spec/` with the team's real
coding conventions. Every future AI session — this project's
`trellis-implement` and `trellis-check` sub-agents — auto-loads spec files
listed in per-task jsonl manifests. Empty spec = sub-agents write generic
code. Real spec = sub-agents match the team's actual patterns.

Don't dump instructions. Open with a short greeting, figure out if the repo
has any existing convention docs (CLAUDE.md, .cursorrules, etc.), and drive
the rest conversationally.

---

## Status (update the checkboxes as you complete each item)

- [ ] Fill guidelines for openclaw-control-ui
- [ ] Fill guidelines for @openclaw/acp-core
- [ ] Fill guidelines for @openclaw/agent-core
- [ ] Fill guidelines for @openclaw/ai
- [ ] Fill guidelines for @openclaw/gateway-client
- [ ] Fill guidelines for @openclaw/gateway-protocol
- [ ] Fill guidelines for @openclaw/llm-core
- [ ] Fill guidelines for @openclaw/markdown-core
- [ ] Fill guidelines for @openclaw/media-core
- [ ] Fill guidelines for @openclaw/media-generation-core
- [ ] Fill guidelines for @openclaw/media-understanding-common
- [ ] Fill guidelines for @openclaw/memory-host-sdk
- [ ] Fill guidelines for @openclaw/model-catalog-core
- [ ] Fill guidelines for @openclaw/net-policy
- [ ] Fill guidelines for @openclaw/normalization-core
- [ ] Fill guidelines for @openclaw/plugin-package-contract
- [ ] Fill guidelines for @openclaw/plugin-sdk
- [ ] Fill guidelines for @openclaw/retry
- [ ] Fill guidelines for @openclaw/sdk
- [ ] Fill guidelines for @openclaw/session-url-contract
- [ ] Fill guidelines for @openclaw/terminal-core
- [ ] Fill guidelines for @openclaw/tool-call-repair
- [ ] Fill guidelines for @openclaw/workboard-contract
- [ ] Fill guidelines for @openclaw/acpx
- [ ] Fill guidelines for active-memory
- [ ] Fill guidelines for @openclaw/admin-http-rpc
- [ ] Fill guidelines for @openclaw/alibaba-provider
- [ ] Fill guidelines for @openclaw/amazon-bedrock-provider
- [ ] Fill guidelines for @openclaw/amazon-bedrock-mantle-provider
- [ ] Fill guidelines for @openclaw/anthropic-provider
- [ ] Fill guidelines for @openclaw/anthropic-vertex-provider
- [ ] Fill guidelines for @openclaw/arcee-provider
- [ ] Fill guidelines for @openclaw/azure-speech
- [ ] Fill guidelines for @openclaw/baseten-provider
- [ ] Fill guidelines for @openclaw/beam
- [ ] Fill guidelines for @openclaw/bonjour
- [ ] Fill guidelines for @openclaw/brave-plugin
- [ ] Fill guidelines for @openclaw/browser-plugin
- [ ] Fill guidelines for @openclaw/buzz
- [ ] Fill guidelines for @openclaw/byteplus-provider
- [ ] Fill guidelines for @openclaw/canvas-plugin
- [ ] Fill guidelines for @openclaw/cerebras-provider
- [ ] Fill guidelines for @openclaw/chutes-provider
- [ ] Fill guidelines for @openclaw/clawrouter
- [ ] Fill guidelines for @openclaw/clickclack
- [ ] Fill guidelines for @openclaw/cloudflare-ai-gateway-provider
- [ ] Fill guidelines for @openclaw/codex
- [ ] Fill guidelines for @openclaw/cohere-provider
- [ ] Fill guidelines for @openclaw/comfy-provider
- [ ] Fill guidelines for @openclaw/copilot
- [ ] Fill guidelines for @openclaw/copilot-proxy
- [ ] Fill guidelines for @openclaw/crabbox-provider
- [ ] Fill guidelines for @openclaw/cua-computer
- [ ] Fill guidelines for @openclaw/deepgram-provider
- [ ] Fill guidelines for @openclaw/deepinfra-provider
- [ ] Fill guidelines for @openclaw/deepseek-provider
- [ ] Fill guidelines for device-pair
- [ ] Fill guidelines for @openclaw/diagnostics-otel
- [ ] Fill guidelines for @openclaw/diagnostics-prometheus
- [ ] Fill guidelines for @openclaw/diffs
- [ ] Fill guidelines for @openclaw/diffs-language-pack
- [ ] Fill guidelines for @openclaw/discord
- [ ] Fill guidelines for @openclaw/document-extract-plugin
- [ ] Fill guidelines for @openclaw/duckduckgo-plugin
- [ ] Fill guidelines for @openclaw/elevenlabs-speech
- [ ] Fill guidelines for @openclaw/exa-plugin
- [ ] Fill guidelines for @openclaw/fal-provider
- [ ] Fill guidelines for @openclaw/featherless-provider
- [ ] Fill guidelines for @openclaw/feishu
- [ ] Fill guidelines for @openclaw/file-transfer
- [ ] Fill guidelines for @openclaw/firecrawl-plugin
- [ ] Fill guidelines for @openclaw/fireworks-provider
- [ ] Fill guidelines for @openclaw/fish-audio-speech
- [ ] Fill guidelines for @openclaw/github-copilot-provider
- [ ] Fill guidelines for @openclaw/gmi-provider
- [ ] Fill guidelines for @openclaw/google-plugin
- [ ] Fill guidelines for @openclaw/google-meet
- [ ] Fill guidelines for @openclaw/googlechat
- [ ] Fill guidelines for @openclaw/gradium-speech
- [ ] Fill guidelines for @openclaw/groq-provider
- [ ] Fill guidelines for @openclaw/huggingface-provider
- [ ] Fill guidelines for @openclaw/image-generation-core
- [ ] Fill guidelines for @openclaw/imessage
- [ ] Fill guidelines for @openclaw/inworld-speech
- [ ] Fill guidelines for @openclaw/irc
- [ ] Fill guidelines for @openclaw/kilocode-provider
- [ ] Fill guidelines for @openclaw/kimi-provider
- [ ] Fill guidelines for @openclaw/line
- [ ] Fill guidelines for @openclaw/linux-canvas
- [ ] Fill guidelines for @openclaw/linux-node
- [ ] Fill guidelines for @openclaw/litellm-provider
- [ ] Fill guidelines for @openclaw/llama-cpp-provider
- [ ] Fill guidelines for @openclaw/llm-task
- [ ] Fill guidelines for @openclaw/lmstudio-provider
- [ ] Fill guidelines for @openclaw/lobster
- [ ] Fill guidelines for @openclaw/logbook
- [ ] Fill guidelines for @openclaw/longcat-provider
- [ ] Fill guidelines for @openclaw/matrix
- [ ] Fill guidelines for @openclaw/mattermost
- [ ] Fill guidelines for @openclaw/media-understanding-core
- [ ] Fill guidelines for @openclaw/memory-core
- [ ] Fill guidelines for @openclaw/memory-lancedb
- [ ] Fill guidelines for @openclaw/memory-wiki
- [ ] Fill guidelines for @openclaw/meta-provider
- [ ] Fill guidelines for @openclaw/microsoft-speech
- [ ] Fill guidelines for @openclaw/microsoft-foundry
- [ ] Fill guidelines for @openclaw/migrate-claude
- [ ] Fill guidelines for @openclaw/migrate-hermes
- [ ] Fill guidelines for @openclaw/minimax-provider
- [ ] Fill guidelines for @openclaw/mistral-provider
- [ ] Fill guidelines for @openclaw/moonshot-provider
- [ ] Fill guidelines for @openclaw/msteams
- [ ] Fill guidelines for @openclaw/mxc-sandbox
- [ ] Fill guidelines for @openclaw/nextcloud-talk
- [ ] Fill guidelines for @openclaw/nostr
- [ ] Fill guidelines for @openclaw/novita-provider
- [ ] Fill guidelines for @openclaw/nvidia-provider
- [ ] Fill guidelines for @openclaw/oc-path
- [ ] Fill guidelines for @openclaw/ollama-provider
- [ ] Fill guidelines for @openclaw/onepassword
- [ ] Fill guidelines for @openclaw/open-prose
- [ ] Fill guidelines for @openclaw/openai-provider
- [ ] Fill guidelines for @openclaw/opencode-provider
- [ ] Fill guidelines for @openclaw/opencode-go-provider
- [ ] Fill guidelines for @openclaw/openrouter-provider
- [ ] Fill guidelines for @openclaw/openshell-sandbox
- [ ] Fill guidelines for @openclaw/parallel-plugin
- [ ] Fill guidelines for @openclaw/perplexity-plugin
- [ ] Fill guidelines for @openclaw/pixverse-provider
- [ ] Fill guidelines for @openclaw/policy
- [ ] Fill guidelines for @openclaw/qa-channel
- [ ] Fill guidelines for @openclaw/qa-lab
- [ ] Fill guidelines for @openclaw/qianfan-provider
- [ ] Fill guidelines for @openclaw/qwen-provider
- [ ] Fill guidelines for @openclaw/raft
- [ ] Fill guidelines for @openclaw/reef
- [ ] Fill guidelines for @openclaw/runway-provider
- [ ] Fill guidelines for @openclaw/searxng-plugin
- [ ] Fill guidelines for @openclaw/senseaudio-provider
- [ ] Fill guidelines for @openclaw/sglang-provider
- [ ] Fill guidelines for @openclaw/signal
- [ ] Fill guidelines for @openclaw/slack
- [ ] Fill guidelines for @openclaw/sms
- [ ] Fill guidelines for @openclaw/stepfun-provider
- [ ] Fill guidelines for @openclaw/synology-chat
- [ ] Fill guidelines for @openclaw/synthetic-provider
- [ ] Fill guidelines for talk-voice
- [ ] Fill guidelines for @openclaw/tavily-plugin
- [ ] Fill guidelines for @openclaw/teams-meetings
- [ ] Fill guidelines for @openclaw/telegram
- [ ] Fill guidelines for @openclaw/tencent-provider
- [ ] Fill guidelines for test-support
- [ ] Fill guidelines for @openclaw/tlon
- [ ] Fill guidelines for @openclaw/together-provider
- [ ] Fill guidelines for @openclaw/tokenjuice
- [ ] Fill guidelines for @openclaw/tts-local-cli
- [ ] Fill guidelines for @openclaw/twitch
- [ ] Fill guidelines for @openclaw/vault
- [ ] Fill guidelines for @openclaw/venice-provider
- [ ] Fill guidelines for @openclaw/vercel-ai-gateway-provider
- [ ] Fill guidelines for @openclaw/video-generation-core
- [ ] Fill guidelines for @openclaw/vllm-provider
- [ ] Fill guidelines for @openclaw/voice-call
- [ ] Fill guidelines for @openclaw/volcengine-provider
- [ ] Fill guidelines for @openclaw/voyage-provider
- [ ] Fill guidelines for @openclaw/vydra-provider
- [ ] Fill guidelines for @openclaw/web-readability-plugin
- [ ] Fill guidelines for @openclaw/webhooks
- [ ] Fill guidelines for @openclaw/whatsapp
- [ ] Fill guidelines for @openclaw/workboard
- [ ] Fill guidelines for @openclaw/xai-plugin
- [ ] Fill guidelines for @openclaw/xiaomi-provider
- [ ] Fill guidelines for @openclaw/zai-provider
- [ ] Fill guidelines for @openclaw/zalo
- [ ] Fill guidelines for @openclaw/zalouser
- [ ] Fill guidelines for @openclaw/zoom-meetings
- [ ] Fill guidelines for @openclaw/example-ai-chat
- [ ] Add code examples

---

## Spec files to populate

### Package: openclaw-control-ui (`spec/openclaw-control-ui/`)

- Frontend guidelines: `.trellis/spec/openclaw-control-ui/frontend/`

### Package: @openclaw/acp-core (`spec/acp-core/`)

- Backend guidelines: `.trellis/spec/acp-core/backend/`

- Frontend guidelines: `.trellis/spec/acp-core/frontend/`

### Package: @openclaw/agent-core (`spec/agent-core/`)

- Backend guidelines: `.trellis/spec/agent-core/backend/`

- Frontend guidelines: `.trellis/spec/agent-core/frontend/`

### Package: @openclaw/ai (`spec/ai/`)

- Backend guidelines: `.trellis/spec/ai/backend/`

- Frontend guidelines: `.trellis/spec/ai/frontend/`

### Package: @openclaw/gateway-client (`spec/gateway-client/`)

- Backend guidelines: `.trellis/spec/gateway-client/backend/`

- Frontend guidelines: `.trellis/spec/gateway-client/frontend/`

### Package: @openclaw/gateway-protocol (`spec/gateway-protocol/`)

- Backend guidelines: `.trellis/spec/gateway-protocol/backend/`

- Frontend guidelines: `.trellis/spec/gateway-protocol/frontend/`

### Package: @openclaw/llm-core (`spec/llm-core/`)

- Backend guidelines: `.trellis/spec/llm-core/backend/`

- Frontend guidelines: `.trellis/spec/llm-core/frontend/`

### Package: @openclaw/markdown-core (`spec/markdown-core/`)

- Backend guidelines: `.trellis/spec/markdown-core/backend/`

- Frontend guidelines: `.trellis/spec/markdown-core/frontend/`

### Package: @openclaw/media-core (`spec/media-core/`)

- Backend guidelines: `.trellis/spec/media-core/backend/`

- Frontend guidelines: `.trellis/spec/media-core/frontend/`

### Package: @openclaw/media-generation-core (`spec/media-generation-core/`)

- Backend guidelines: `.trellis/spec/media-generation-core/backend/`

- Frontend guidelines: `.trellis/spec/media-generation-core/frontend/`

### Package: @openclaw/media-understanding-common (`spec/media-understanding-common/`)

- Frontend guidelines: `.trellis/spec/media-understanding-common/frontend/`

### Package: @openclaw/memory-host-sdk (`spec/memory-host-sdk/`)

- Frontend guidelines: `.trellis/spec/memory-host-sdk/frontend/`

### Package: @openclaw/model-catalog-core (`spec/model-catalog-core/`)

- Backend guidelines: `.trellis/spec/model-catalog-core/backend/`

- Frontend guidelines: `.trellis/spec/model-catalog-core/frontend/`

### Package: @openclaw/net-policy (`spec/net-policy/`)

- Backend guidelines: `.trellis/spec/net-policy/backend/`

- Frontend guidelines: `.trellis/spec/net-policy/frontend/`

### Package: @openclaw/normalization-core (`spec/normalization-core/`)

- Backend guidelines: `.trellis/spec/normalization-core/backend/`

- Frontend guidelines: `.trellis/spec/normalization-core/frontend/`

### Package: @openclaw/plugin-package-contract (`spec/plugin-package-contract/`)

- Backend guidelines: `.trellis/spec/plugin-package-contract/backend/`

- Frontend guidelines: `.trellis/spec/plugin-package-contract/frontend/`

### Package: @openclaw/plugin-sdk (`spec/plugin-sdk/`)

- Frontend guidelines: `.trellis/spec/plugin-sdk/frontend/`

### Package: @openclaw/retry (`spec/retry/`)

- Backend guidelines: `.trellis/spec/retry/backend/`

- Frontend guidelines: `.trellis/spec/retry/frontend/`

### Package: @openclaw/sdk (`spec/sdk/`)

- Backend guidelines: `.trellis/spec/sdk/backend/`

- Frontend guidelines: `.trellis/spec/sdk/frontend/`

### Package: @openclaw/session-url-contract (`spec/session-url-contract/`)

- Backend guidelines: `.trellis/spec/session-url-contract/backend/`

- Frontend guidelines: `.trellis/spec/session-url-contract/frontend/`

### Package: @openclaw/terminal-core (`spec/terminal-core/`)

- Backend guidelines: `.trellis/spec/terminal-core/backend/`

- Frontend guidelines: `.trellis/spec/terminal-core/frontend/`

### Package: @openclaw/tool-call-repair (`spec/tool-call-repair/`)

- Backend guidelines: `.trellis/spec/tool-call-repair/backend/`

- Frontend guidelines: `.trellis/spec/tool-call-repair/frontend/`

### Package: @openclaw/workboard-contract (`spec/workboard-contract/`)

- Backend guidelines: `.trellis/spec/workboard-contract/backend/`

- Frontend guidelines: `.trellis/spec/workboard-contract/frontend/`

### Package: @openclaw/acpx (`spec/acpx/`)

- Frontend guidelines: `.trellis/spec/acpx/frontend/`

### Package: active-memory (`spec/active-memory/`)

- Backend guidelines: `.trellis/spec/active-memory/backend/`

- Frontend guidelines: `.trellis/spec/active-memory/frontend/`

### Package: @openclaw/admin-http-rpc (`spec/admin-http-rpc/`)

- Frontend guidelines: `.trellis/spec/admin-http-rpc/frontend/`

### Package: @openclaw/alibaba-provider (`spec/alibaba-provider/`)

- Frontend guidelines: `.trellis/spec/alibaba-provider/frontend/`

### Package: @openclaw/amazon-bedrock-provider (`spec/amazon-bedrock-provider/`)

- Frontend guidelines: `.trellis/spec/amazon-bedrock-provider/frontend/`

### Package: @openclaw/amazon-bedrock-mantle-provider (`spec/amazon-bedrock-mantle-provider/`)

- Frontend guidelines: `.trellis/spec/amazon-bedrock-mantle-provider/frontend/`

### Package: @openclaw/anthropic-provider (`spec/anthropic-provider/`)

- Frontend guidelines: `.trellis/spec/anthropic-provider/frontend/`

### Package: @openclaw/anthropic-vertex-provider (`spec/anthropic-vertex-provider/`)

- Frontend guidelines: `.trellis/spec/anthropic-vertex-provider/frontend/`

### Package: @openclaw/arcee-provider (`spec/arcee-provider/`)

- Frontend guidelines: `.trellis/spec/arcee-provider/frontend/`

### Package: @openclaw/azure-speech (`spec/azure-speech/`)

- Frontend guidelines: `.trellis/spec/azure-speech/frontend/`

### Package: @openclaw/baseten-provider (`spec/baseten-provider/`)

- Frontend guidelines: `.trellis/spec/baseten-provider/frontend/`

### Package: @openclaw/beam (`spec/beam/`)

- Frontend guidelines: `.trellis/spec/beam/frontend/`

### Package: @openclaw/bonjour (`spec/bonjour/`)

- Frontend guidelines: `.trellis/spec/bonjour/frontend/`

### Package: @openclaw/brave-plugin (`spec/brave-plugin/`)

- Frontend guidelines: `.trellis/spec/brave-plugin/frontend/`

### Package: @openclaw/browser-plugin (`spec/browser-plugin/`)

- Backend guidelines: `.trellis/spec/browser-plugin/backend/`

- Frontend guidelines: `.trellis/spec/browser-plugin/frontend/`

### Package: @openclaw/buzz (`spec/buzz/`)

- Frontend guidelines: `.trellis/spec/buzz/frontend/`

### Package: @openclaw/byteplus-provider (`spec/byteplus-provider/`)

- Frontend guidelines: `.trellis/spec/byteplus-provider/frontend/`

### Package: @openclaw/canvas-plugin (`spec/canvas-plugin/`)

- Frontend guidelines: `.trellis/spec/canvas-plugin/frontend/`

### Package: @openclaw/cerebras-provider (`spec/cerebras-provider/`)

- Frontend guidelines: `.trellis/spec/cerebras-provider/frontend/`

### Package: @openclaw/chutes-provider (`spec/chutes-provider/`)

- Frontend guidelines: `.trellis/spec/chutes-provider/frontend/`

### Package: @openclaw/clawrouter (`spec/clawrouter/`)

- Frontend guidelines: `.trellis/spec/clawrouter/frontend/`

### Package: @openclaw/clickclack (`spec/clickclack/`)

- Frontend guidelines: `.trellis/spec/clickclack/frontend/`

### Package: @openclaw/cloudflare-ai-gateway-provider (`spec/cloudflare-ai-gateway-provider/`)

- Frontend guidelines: `.trellis/spec/cloudflare-ai-gateway-provider/frontend/`

### Package: @openclaw/codex (`spec/codex/`)

- Frontend guidelines: `.trellis/spec/codex/frontend/`

### Package: @openclaw/cohere-provider (`spec/cohere-provider/`)

- Frontend guidelines: `.trellis/spec/cohere-provider/frontend/`

### Package: @openclaw/comfy-provider (`spec/comfy-provider/`)

- Frontend guidelines: `.trellis/spec/comfy-provider/frontend/`

### Package: @openclaw/copilot (`spec/copilot/`)

- Frontend guidelines: `.trellis/spec/copilot/frontend/`

### Package: @openclaw/copilot-proxy (`spec/copilot-proxy/`)

- Frontend guidelines: `.trellis/spec/copilot-proxy/frontend/`

### Package: @openclaw/crabbox-provider (`spec/crabbox-provider/`)

- Frontend guidelines: `.trellis/spec/crabbox-provider/frontend/`

### Package: @openclaw/cua-computer (`spec/cua-computer/`)

- Frontend guidelines: `.trellis/spec/cua-computer/frontend/`

### Package: @openclaw/deepgram-provider (`spec/deepgram-provider/`)

- Frontend guidelines: `.trellis/spec/deepgram-provider/frontend/`

### Package: @openclaw/deepinfra-provider (`spec/deepinfra-provider/`)

- Frontend guidelines: `.trellis/spec/deepinfra-provider/frontend/`

### Package: @openclaw/deepseek-provider (`spec/deepseek-provider/`)

- Frontend guidelines: `.trellis/spec/deepseek-provider/frontend/`

### Package: device-pair (`spec/device-pair/`)

- Backend guidelines: `.trellis/spec/device-pair/backend/`

- Frontend guidelines: `.trellis/spec/device-pair/frontend/`

### Package: @openclaw/diagnostics-otel (`spec/diagnostics-otel/`)

- Frontend guidelines: `.trellis/spec/diagnostics-otel/frontend/`

### Package: @openclaw/diagnostics-prometheus (`spec/diagnostics-prometheus/`)

- Frontend guidelines: `.trellis/spec/diagnostics-prometheus/frontend/`

### Package: @openclaw/diffs (`spec/diffs/`)

- Frontend guidelines: `.trellis/spec/diffs/frontend/`

### Package: @openclaw/diffs-language-pack (`spec/diffs-language-pack/`)

- Frontend guidelines: `.trellis/spec/diffs-language-pack/frontend/`

### Package: @openclaw/discord (`spec/discord/`)

- Frontend guidelines: `.trellis/spec/discord/frontend/`

### Package: @openclaw/document-extract-plugin (`spec/document-extract-plugin/`)

- Frontend guidelines: `.trellis/spec/document-extract-plugin/frontend/`

### Package: @openclaw/duckduckgo-plugin (`spec/duckduckgo-plugin/`)

- Frontend guidelines: `.trellis/spec/duckduckgo-plugin/frontend/`

### Package: @openclaw/elevenlabs-speech (`spec/elevenlabs-speech/`)

- Frontend guidelines: `.trellis/spec/elevenlabs-speech/frontend/`

### Package: @openclaw/exa-plugin (`spec/exa-plugin/`)

- Frontend guidelines: `.trellis/spec/exa-plugin/frontend/`

### Package: @openclaw/fal-provider (`spec/fal-provider/`)

- Frontend guidelines: `.trellis/spec/fal-provider/frontend/`

### Package: @openclaw/featherless-provider (`spec/featherless-provider/`)

- Frontend guidelines: `.trellis/spec/featherless-provider/frontend/`

### Package: @openclaw/feishu (`spec/feishu/`)

- Frontend guidelines: `.trellis/spec/feishu/frontend/`

### Package: @openclaw/file-transfer (`spec/file-transfer/`)

- Frontend guidelines: `.trellis/spec/file-transfer/frontend/`

### Package: @openclaw/firecrawl-plugin (`spec/firecrawl-plugin/`)

- Frontend guidelines: `.trellis/spec/firecrawl-plugin/frontend/`

### Package: @openclaw/fireworks-provider (`spec/fireworks-provider/`)

- Frontend guidelines: `.trellis/spec/fireworks-provider/frontend/`

### Package: @openclaw/fish-audio-speech (`spec/fish-audio-speech/`)

- Frontend guidelines: `.trellis/spec/fish-audio-speech/frontend/`

### Package: @openclaw/github-copilot-provider (`spec/github-copilot-provider/`)

- Frontend guidelines: `.trellis/spec/github-copilot-provider/frontend/`

### Package: @openclaw/gmi-provider (`spec/gmi-provider/`)

- Frontend guidelines: `.trellis/spec/gmi-provider/frontend/`

### Package: @openclaw/google-plugin (`spec/google-plugin/`)

- Frontend guidelines: `.trellis/spec/google-plugin/frontend/`

### Package: @openclaw/google-meet (`spec/google-meet/`)

- Frontend guidelines: `.trellis/spec/google-meet/frontend/`

### Package: @openclaw/googlechat (`spec/googlechat/`)

- Frontend guidelines: `.trellis/spec/googlechat/frontend/`

### Package: @openclaw/gradium-speech (`spec/gradium-speech/`)

- Frontend guidelines: `.trellis/spec/gradium-speech/frontend/`

### Package: @openclaw/groq-provider (`spec/groq-provider/`)

- Frontend guidelines: `.trellis/spec/groq-provider/frontend/`

### Package: @openclaw/huggingface-provider (`spec/huggingface-provider/`)

- Frontend guidelines: `.trellis/spec/huggingface-provider/frontend/`

### Package: @openclaw/image-generation-core (`spec/image-generation-core/`)

- Frontend guidelines: `.trellis/spec/image-generation-core/frontend/`

### Package: @openclaw/imessage (`spec/imessage/`)

- Frontend guidelines: `.trellis/spec/imessage/frontend/`

### Package: @openclaw/inworld-speech (`spec/inworld-speech/`)

- Frontend guidelines: `.trellis/spec/inworld-speech/frontend/`

### Package: @openclaw/irc (`spec/irc/`)

- Frontend guidelines: `.trellis/spec/irc/frontend/`

### Package: @openclaw/kilocode-provider (`spec/kilocode-provider/`)

- Frontend guidelines: `.trellis/spec/kilocode-provider/frontend/`

### Package: @openclaw/kimi-provider (`spec/kimi-provider/`)

- Frontend guidelines: `.trellis/spec/kimi-provider/frontend/`

### Package: @openclaw/line (`spec/line/`)

- Frontend guidelines: `.trellis/spec/line/frontend/`

### Package: @openclaw/linux-canvas (`spec/linux-canvas/`)

- Frontend guidelines: `.trellis/spec/linux-canvas/frontend/`

### Package: @openclaw/linux-node (`spec/linux-node/`)

- Frontend guidelines: `.trellis/spec/linux-node/frontend/`

### Package: @openclaw/litellm-provider (`spec/litellm-provider/`)

- Frontend guidelines: `.trellis/spec/litellm-provider/frontend/`

### Package: @openclaw/llama-cpp-provider (`spec/llama-cpp-provider/`)

- Frontend guidelines: `.trellis/spec/llama-cpp-provider/frontend/`

### Package: @openclaw/llm-task (`spec/llm-task/`)

- Frontend guidelines: `.trellis/spec/llm-task/frontend/`

### Package: @openclaw/lmstudio-provider (`spec/lmstudio-provider/`)

- Frontend guidelines: `.trellis/spec/lmstudio-provider/frontend/`

### Package: @openclaw/lobster (`spec/lobster/`)

- Frontend guidelines: `.trellis/spec/lobster/frontend/`

### Package: @openclaw/logbook (`spec/logbook/`)

- Frontend guidelines: `.trellis/spec/logbook/frontend/`

### Package: @openclaw/longcat-provider (`spec/longcat-provider/`)

- Frontend guidelines: `.trellis/spec/longcat-provider/frontend/`

### Package: @openclaw/matrix (`spec/matrix/`)

- Frontend guidelines: `.trellis/spec/matrix/frontend/`

### Package: @openclaw/mattermost (`spec/mattermost/`)

- Frontend guidelines: `.trellis/spec/mattermost/frontend/`

### Package: @openclaw/media-understanding-core (`spec/media-understanding-core/`)

- Frontend guidelines: `.trellis/spec/media-understanding-core/frontend/`

### Package: @openclaw/memory-core (`spec/memory-core/`)

- Frontend guidelines: `.trellis/spec/memory-core/frontend/`

### Package: @openclaw/memory-lancedb (`spec/memory-lancedb/`)

- Frontend guidelines: `.trellis/spec/memory-lancedb/frontend/`

### Package: @openclaw/memory-wiki (`spec/memory-wiki/`)

- Frontend guidelines: `.trellis/spec/memory-wiki/frontend/`

### Package: @openclaw/meta-provider (`spec/meta-provider/`)

- Frontend guidelines: `.trellis/spec/meta-provider/frontend/`

### Package: @openclaw/microsoft-speech (`spec/microsoft-speech/`)

- Frontend guidelines: `.trellis/spec/microsoft-speech/frontend/`

### Package: @openclaw/microsoft-foundry (`spec/microsoft-foundry/`)

- Frontend guidelines: `.trellis/spec/microsoft-foundry/frontend/`

### Package: @openclaw/migrate-claude (`spec/migrate-claude/`)

- Frontend guidelines: `.trellis/spec/migrate-claude/frontend/`

### Package: @openclaw/migrate-hermes (`spec/migrate-hermes/`)

- Frontend guidelines: `.trellis/spec/migrate-hermes/frontend/`

### Package: @openclaw/minimax-provider (`spec/minimax-provider/`)

- Frontend guidelines: `.trellis/spec/minimax-provider/frontend/`

### Package: @openclaw/mistral-provider (`spec/mistral-provider/`)

- Frontend guidelines: `.trellis/spec/mistral-provider/frontend/`

### Package: @openclaw/moonshot-provider (`spec/moonshot-provider/`)

- Frontend guidelines: `.trellis/spec/moonshot-provider/frontend/`

### Package: @openclaw/msteams (`spec/msteams/`)

- Backend guidelines: `.trellis/spec/msteams/backend/`

- Frontend guidelines: `.trellis/spec/msteams/frontend/`

### Package: @openclaw/mxc-sandbox (`spec/mxc-sandbox/`)

- Frontend guidelines: `.trellis/spec/mxc-sandbox/frontend/`

### Package: @openclaw/nextcloud-talk (`spec/nextcloud-talk/`)

- Frontend guidelines: `.trellis/spec/nextcloud-talk/frontend/`

### Package: @openclaw/nostr (`spec/nostr/`)

- Frontend guidelines: `.trellis/spec/nostr/frontend/`

### Package: @openclaw/novita-provider (`spec/novita-provider/`)

- Frontend guidelines: `.trellis/spec/novita-provider/frontend/`

### Package: @openclaw/nvidia-provider (`spec/nvidia-provider/`)

- Frontend guidelines: `.trellis/spec/nvidia-provider/frontend/`

### Package: @openclaw/oc-path (`spec/oc-path/`)

- Frontend guidelines: `.trellis/spec/oc-path/frontend/`

### Package: @openclaw/ollama-provider (`spec/ollama-provider/`)

- Frontend guidelines: `.trellis/spec/ollama-provider/frontend/`

### Package: @openclaw/onepassword (`spec/onepassword/`)

- Frontend guidelines: `.trellis/spec/onepassword/frontend/`

### Package: @openclaw/open-prose (`spec/open-prose/`)

- Frontend guidelines: `.trellis/spec/open-prose/frontend/`

### Package: @openclaw/openai-provider (`spec/openai-provider/`)

- Frontend guidelines: `.trellis/spec/openai-provider/frontend/`

### Package: @openclaw/opencode-provider (`spec/opencode-provider/`)

- Frontend guidelines: `.trellis/spec/opencode-provider/frontend/`

### Package: @openclaw/opencode-go-provider (`spec/opencode-go-provider/`)

- Frontend guidelines: `.trellis/spec/opencode-go-provider/frontend/`

### Package: @openclaw/openrouter-provider (`spec/openrouter-provider/`)

- Frontend guidelines: `.trellis/spec/openrouter-provider/frontend/`

### Package: @openclaw/openshell-sandbox (`spec/openshell-sandbox/`)

- Frontend guidelines: `.trellis/spec/openshell-sandbox/frontend/`

### Package: @openclaw/parallel-plugin (`spec/parallel-plugin/`)

- Frontend guidelines: `.trellis/spec/parallel-plugin/frontend/`

### Package: @openclaw/perplexity-plugin (`spec/perplexity-plugin/`)

- Frontend guidelines: `.trellis/spec/perplexity-plugin/frontend/`

### Package: @openclaw/pixverse-provider (`spec/pixverse-provider/`)

- Frontend guidelines: `.trellis/spec/pixverse-provider/frontend/`

### Package: @openclaw/policy (`spec/policy/`)

- Frontend guidelines: `.trellis/spec/policy/frontend/`

### Package: @openclaw/qa-channel (`spec/qa-channel/`)

- Frontend guidelines: `.trellis/spec/qa-channel/frontend/`

### Package: @openclaw/qa-lab (`spec/qa-lab/`)

- Frontend guidelines: `.trellis/spec/qa-lab/frontend/`

### Package: @openclaw/qianfan-provider (`spec/qianfan-provider/`)

- Frontend guidelines: `.trellis/spec/qianfan-provider/frontend/`

### Package: @openclaw/qwen-provider (`spec/qwen-provider/`)

- Frontend guidelines: `.trellis/spec/qwen-provider/frontend/`

### Package: @openclaw/raft (`spec/raft/`)

- Frontend guidelines: `.trellis/spec/raft/frontend/`

### Package: @openclaw/reef (`spec/reef/`)

- Frontend guidelines: `.trellis/spec/reef/frontend/`

### Package: @openclaw/runway-provider (`spec/runway-provider/`)

- Frontend guidelines: `.trellis/spec/runway-provider/frontend/`

### Package: @openclaw/searxng-plugin (`spec/searxng-plugin/`)

- Frontend guidelines: `.trellis/spec/searxng-plugin/frontend/`

### Package: @openclaw/senseaudio-provider (`spec/senseaudio-provider/`)

- Frontend guidelines: `.trellis/spec/senseaudio-provider/frontend/`

### Package: @openclaw/sglang-provider (`spec/sglang-provider/`)

- Frontend guidelines: `.trellis/spec/sglang-provider/frontend/`

### Package: @openclaw/signal (`spec/signal/`)

- Frontend guidelines: `.trellis/spec/signal/frontend/`

### Package: @openclaw/slack (`spec/slack/`)

- Backend guidelines: `.trellis/spec/slack/backend/`

- Frontend guidelines: `.trellis/spec/slack/frontend/`

### Package: @openclaw/sms (`spec/sms/`)

- Frontend guidelines: `.trellis/spec/sms/frontend/`

### Package: @openclaw/stepfun-provider (`spec/stepfun-provider/`)

- Frontend guidelines: `.trellis/spec/stepfun-provider/frontend/`

### Package: @openclaw/synology-chat (`spec/synology-chat/`)

- Frontend guidelines: `.trellis/spec/synology-chat/frontend/`

### Package: @openclaw/synthetic-provider (`spec/synthetic-provider/`)

- Frontend guidelines: `.trellis/spec/synthetic-provider/frontend/`

### Package: talk-voice (`spec/talk-voice/`)

- Backend guidelines: `.trellis/spec/talk-voice/backend/`

- Frontend guidelines: `.trellis/spec/talk-voice/frontend/`

### Package: @openclaw/tavily-plugin (`spec/tavily-plugin/`)

- Frontend guidelines: `.trellis/spec/tavily-plugin/frontend/`

### Package: @openclaw/teams-meetings (`spec/teams-meetings/`)

- Frontend guidelines: `.trellis/spec/teams-meetings/frontend/`

### Package: @openclaw/telegram (`spec/telegram/`)

- Frontend guidelines: `.trellis/spec/telegram/frontend/`

### Package: @openclaw/tencent-provider (`spec/tencent-provider/`)

- Frontend guidelines: `.trellis/spec/tencent-provider/frontend/`

### Package: test-support (`spec/test-support/`)

- Backend guidelines: `.trellis/spec/test-support/backend/`

- Frontend guidelines: `.trellis/spec/test-support/frontend/`

### Package: @openclaw/tlon (`spec/tlon/`)

- Frontend guidelines: `.trellis/spec/tlon/frontend/`

### Package: @openclaw/together-provider (`spec/together-provider/`)

- Frontend guidelines: `.trellis/spec/together-provider/frontend/`

### Package: @openclaw/tokenjuice (`spec/tokenjuice/`)

- Frontend guidelines: `.trellis/spec/tokenjuice/frontend/`

### Package: @openclaw/tts-local-cli (`spec/tts-local-cli/`)

- Frontend guidelines: `.trellis/spec/tts-local-cli/frontend/`

### Package: @openclaw/twitch (`spec/twitch/`)

- Frontend guidelines: `.trellis/spec/twitch/frontend/`

### Package: @openclaw/vault (`spec/vault/`)

- Frontend guidelines: `.trellis/spec/vault/frontend/`

### Package: @openclaw/venice-provider (`spec/venice-provider/`)

- Frontend guidelines: `.trellis/spec/venice-provider/frontend/`

### Package: @openclaw/vercel-ai-gateway-provider (`spec/vercel-ai-gateway-provider/`)

- Frontend guidelines: `.trellis/spec/vercel-ai-gateway-provider/frontend/`

### Package: @openclaw/video-generation-core (`spec/video-generation-core/`)

- Frontend guidelines: `.trellis/spec/video-generation-core/frontend/`

### Package: @openclaw/vllm-provider (`spec/vllm-provider/`)

- Frontend guidelines: `.trellis/spec/vllm-provider/frontend/`

### Package: @openclaw/voice-call (`spec/voice-call/`)

- Frontend guidelines: `.trellis/spec/voice-call/frontend/`

### Package: @openclaw/volcengine-provider (`spec/volcengine-provider/`)

- Frontend guidelines: `.trellis/spec/volcengine-provider/frontend/`

### Package: @openclaw/voyage-provider (`spec/voyage-provider/`)

- Frontend guidelines: `.trellis/spec/voyage-provider/frontend/`

### Package: @openclaw/vydra-provider (`spec/vydra-provider/`)

- Frontend guidelines: `.trellis/spec/vydra-provider/frontend/`

### Package: @openclaw/web-readability-plugin (`spec/web-readability-plugin/`)

- Frontend guidelines: `.trellis/spec/web-readability-plugin/frontend/`

### Package: @openclaw/webhooks (`spec/webhooks/`)

- Frontend guidelines: `.trellis/spec/webhooks/frontend/`

### Package: @openclaw/whatsapp (`spec/whatsapp/`)

- Frontend guidelines: `.trellis/spec/whatsapp/frontend/`

### Package: @openclaw/workboard (`spec/workboard/`)

- Frontend guidelines: `.trellis/spec/workboard/frontend/`

### Package: @openclaw/xai-plugin (`spec/xai-plugin/`)

- Frontend guidelines: `.trellis/spec/xai-plugin/frontend/`

### Package: @openclaw/xiaomi-provider (`spec/xiaomi-provider/`)

- Frontend guidelines: `.trellis/spec/xiaomi-provider/frontend/`

### Package: @openclaw/zai-provider (`spec/zai-provider/`)

- Frontend guidelines: `.trellis/spec/zai-provider/frontend/`

### Package: @openclaw/zalo (`spec/zalo/`)

- Frontend guidelines: `.trellis/spec/zalo/frontend/`

### Package: @openclaw/zalouser (`spec/zalouser/`)

- Frontend guidelines: `.trellis/spec/zalouser/frontend/`

### Package: @openclaw/zoom-meetings (`spec/zoom-meetings/`)

- Frontend guidelines: `.trellis/spec/zoom-meetings/frontend/`

### Package: @openclaw/example-ai-chat (`spec/example-ai-chat/`)

- Frontend guidelines: `.trellis/spec/example-ai-chat/frontend/`


### Thinking guides (already populated)

`.trellis/spec/guides/` contains general thinking guides pre-filled with
best practices. Customize only if something clearly doesn't fit this project.

---

## How to fill the spec

### Step 1: Import from existing convention files first (preferred)

Search the repo for existing convention docs. If any exist, read them and
extract the relevant rules into the matching `.trellis/spec/` files —
usually much faster than documenting from scratch.

| File / Directory | Tool |
|------|------|
| `CLAUDE.md` / `CLAUDE.local.md` | Claude Code |
| `AGENTS.md` | Codex / Claude Code / agent-compatible tools |
| `.cursorrules` | Cursor |
| `.cursor/rules/*.mdc` | Cursor (rules directory) |
| `.windsurfrules` | Windsurf |
| `.clinerules` | Cline |
| `.roomodes` | Roo Code |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.vscode/settings.json` → `github.copilot.chat.codeGeneration.instructions` | VS Code Copilot |
| `CONVENTIONS.md` / `.aider.conf.yml` | aider |
| `CONTRIBUTING.md` | General project conventions |
| `.editorconfig` | Editor formatting rules |

### Step 2: Analyze the codebase for anything not covered by existing docs

Scan real code to discover patterns. Before writing each spec file:
- Find 2-3 real examples of each pattern in the codebase.
- Reference real file paths (not hypothetical ones).
- Document anti-patterns the team clearly avoids.

### Step 3: Document reality, not ideals

**Critical**: write what the code *actually does*, not what it should do.
Sub-agents match the spec, so aspirational patterns that don't exist in the
codebase will cause sub-agents to write code that looks out of place.

If the team has known tech debt, document the current state — improvement
is a separate conversation, not a bootstrap concern.

---

## Quick explainer of the runtime (share when they ask "why do we need spec at all")

- Every AI coding task spawns two sub-agents: `trellis-implement` (writes
  code) and `trellis-check` (verifies quality).
- Each task has `implement.jsonl` / `check.jsonl` manifests listing which
  spec files to load.
- The platform hook auto-injects those spec files + the task's `prd.md`
  into every sub-agent prompt, so the sub-agent codes/reviews per team
  conventions without anyone pasting them manually.
- Source of truth: `.trellis/spec/`. That's why filling it well now pays
  off forever.

---

## Completion

When the developer confirms the checklist items above are done with real
examples (not placeholders), guide them to run:

```bash
python3 ./.trellis/scripts/task.py finish
python3 ./.trellis/scripts/task.py archive 00-bootstrap-guidelines
```

After archive, every new developer who joins this project will get a
`00-join-<slug>` onboarding task instead of this bootstrap task.

---

## Suggested opening line

"Welcome to Trellis! Your init just set me up to help you fill the project
spec — a one-time setup so every future AI session follows the team's
conventions instead of writing generic code. Before we start, do you have
any existing convention docs (CLAUDE.md, .cursorrules, CONTRIBUTING.md,
etc.) I can pull from, or should I scan the codebase from scratch?"
