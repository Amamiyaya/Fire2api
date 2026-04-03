# Fireworks转 OpenAI API 代理

一个将 Fireworks API 转换为 OpenAI 兼容格式的代理服务，使 CLI 工具（如 OpenCode、Cline 和 Roo-Code）能够调用工具。

## 灵感来源

本项目借鉴了 [Chat2API](https://github.com/xiaoY233/Chat2API)，它通过提示词工程让 web 版 AI 模型支持工具调用。核心思想是让工具调用适用于任何模型，即使是那些原生不支持 OpenAI 函数调用协议的模型。

## 实现方式

### 方式一：原生函数调用（最初版）

直接将 `tools` 参数传递给上游 API，依赖模型原生支持函数调用。

```javascript
// 透传 tools 参数给上游
if (tools) {
  askcodiPayload.tools = tools
}
```

**优点：**
- 标准协议，稳定可靠
- 响应结构更好
- 无需解析

**缺点：**
- 需要上游 API 支持函数调用
- 无法用于大多数网页版逆向 API
- 模型兼容性有限

### 方式二：提示词工程（当前版本）

将工具定义注入到 system prompt 中，引导模型以 JSON 文本形式返回工具调用。

```javascript
const systemPrompt = `你是一个 AI 编程助手。
当用户请求操作时，请使用以下格式调用工具：
{"name": "工具名称", "arguments": {...}}
`;

const toolDescription = buildToolDescription(tools);
const enhancedMessages = [
  { role: 'system', content: systemPrompt + '\n\n' + toolDescription },
  ...messages
];
```

**优点：**
- 适用于任何支持对话的模型
- 支持网页版逆向 API
- 兼容性更广

**缺点：**
- 客户端需要解析响应
- 不如原生函数调用结构化
- 偶尔可能将普通文本误解析为工具调用

## 可用工具

代理包含 24 个内置工具，与 OpenCode 工具集匹配：

| 类别 | 工具 |
|------|------|
| 文件操作 | read, write, edit, glob, grep, list, patch |
| 命令执行 | bash |
| LSP 功能 | lsp_goto_definition, lsp_find_references, lsp_symbols, lsp_diagnostics, lsp_rename |
| 网络搜索 | websearch, webfetch, codesearch |
| GitHub | github_search_code, github_search_repositories, github_search_users, github_list_issues |
| 任务管理 | todowrite, todoread, skill |
| 用户交互 | question |

## 使用方法

```bash
# 安装依赖
npm install

# 配置环境
# 编辑 .env 文件，填入 ASKCODI_TOKEN 和 ASKCODI_API_KEY

# 启动服务
node server.js
```

然后配置你的 CLI 工具使用：
- URL: `http://localhost:3002/v1`
- 模型: `glm-5`（或你配置的模型）

## 与 Chat2API 的对比

| 特性 | Chat2API | 本项目 |
|------|----------|--------|
| 目标 | 网页版（DeepSeek、GLM、Kimi 等） | Firework API |
| 实现方式 | Electron 桌面应用 | 简单的 Node.js 代理 |
| 工具集成 | 通过 MCP 服务器 | 通过提示词工程 |
| 模型支持 | 多提供商 | AskCodi 支持的模型 |

## 架构

```
用户 (OpenCode/Cline) --> 本代理 --> Firework API --> 模型
                              |
                        注入工具描述
                        到 system prompt
```

## License

这里什么也没有。。。
