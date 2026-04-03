# Fireworks to OpenAI API Proxy

A proxy service that converts AskCodi API to OpenAI-compatible format, enabling tool calling functionality for CLI tools like OpenCode, Cline, and Roo-Code.

## Inspiration

This project draws inspiration from [Chat2API](https://github.com/xiaoY233/Chat2API), which enables tool calling for web-based AI models via prompt engineering. The core idea is to make tool calling work with any model, even those that don't natively support the OpenAI function calling protocol.

## Implementation Approaches

### Approach 1: Native Function Calling (Original)

Pass the `tools` parameter directly to the upstream API, relying on the model to natively support function calling.

```javascript
// Forward tools parameter to upstream
if (tools) {
  askcodiPayload.tools = tools
}
```

**Pros:**
- Standard protocol, stable and reliable
- Better structured responses
- No parsing required

**Cons:**
- Requires upstream API to support function calling
- Doesn't work with most web-based reverse APIs
- Limited model compatibility

### Approach 2: Prompt Engineering (Current)

Inject tool definitions into the system prompt, guiding the model to return tool calls as JSON text.

```javascript
const systemPrompt = `You are an AI programming assistant.
When users request operations, call tools using:
{"name": "tool_name", "arguments": {...}}
`;

const toolDescription = buildToolDescription(tools);
const enhancedMessages = [
  { role: 'system', content: systemPrompt + '\n\n' + toolDescription },
  ...messages
];
```

**Pros:**
- Works with any model that supports conversation
- Compatible with web-based reverse APIs
- Broader model support
- Works with AskCodi's free models

**Cons:**
- Response parsing required on client side
- Less structured than native function calling
- May occasionally misparse regular text as tool calls

## Available Tools

The proxy includes 24 built-in tools matching OpenCode's toolset:

| Category | Tools |
|----------|-------|
| File Operations | read, write, edit, glob, grep, list, patch |
| Command Execution | bash |
| LSP Features | lsp_goto_definition, lsp_find_references, lsp_symbols, lsp_diagnostics, lsp_rename |
| Web Search | websearch, webfetch, codesearch |
| GitHub | github_search_code, github_search_repositories, github_search_users, github_list_issues |
| Task Management | todowrite, todoread, skill |
| User Interaction | question |

## Usage

```bash
# Install dependencies
npm install

# Configure environment
# Edit .env with your ASKCODI_TOKEN and ASKCODI_API_KEY

# Start the server
node server.js
```

Then configure your CLI tool to use:
- URL: `http://localhost:3002/v1`
- Model: `google/gemini-3-flash:free` (or your configured model)

## Comparison with Chat2API

| Feature | Chat2API | This Project |
|---------|----------|---------------|
| Target | Web UI (DeepSeek, GLM, Kimi, etc.) | AskCodi API |
| Implementation | Desktop app with Electron | Simple Node.js proxy |
| Tool Integration | Via MCP servers | Via prompt engineering |
| Model Support | Multi-provider | AskCodi supported models |

## Architecture

```
User (OpenCode/Cline) --> This Proxy --> AskCodi API --> Model
                                    |
                              Inject tool descriptions
                              into system prompt
```

## License

MIT
