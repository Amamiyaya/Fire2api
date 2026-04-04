require('dotenv').config()
const express = require('express')
const https = require('https')
const { exec } = require('child_process')
const fs = require('fs')

const app = express()
app.use(express.json({ limit: '50mb' }))

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY
const MODEL = 'accounts/fireworks/models/glm-5'
const PORT = process.env.PORT || 3001

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a bash command in the terminal',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
          description: { type: 'string', description: 'What this command does' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
          workdir: { type: 'string', description: 'Working directory for the command' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read',
      description: 'Read a file from the local filesystem',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to read' },
          limit: { type: 'number', description: 'Maximum number of lines to read' },
          offset: { type: 'number', description: 'Line number to start reading from (1-indexed)' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files by name pattern using glob',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.js)' },
          path: { type: 'string', description: 'Directory to search in (optional)' }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for content in files using regular expressions',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory to search in' },
          include: { type: 'string', description: 'File pattern to include (e.g. *.js)' },
          output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: 'Output format' }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit',
      description: 'Edit a file by replacing specific text',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to edit' },
          oldString: { type: 'string', description: 'Text to find and replace' },
          newString: { type: 'string', description: 'Text to replace with' }
        },
        required: ['filePath', 'oldString', 'newString']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write',
      description: 'Write content to a file (creates new file or overwrites existing)',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lsp_goto_definition',
      description: 'Jump to symbol definition in code',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Character position (0-based)' }
        },
        required: ['filePath', 'line', 'character']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lsp_find_references',
      description: 'Find all references/usages of a symbol',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Character position (0-based)' }
        },
        required: ['filePath', 'line', 'character']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lsp_symbols',
      description: 'Search for symbols (functions, classes, variables) in the workspace',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path for document scope, or workspace root' },
          query: { type: 'string', description: 'Symbol name to search for' },
          scope: { type: 'string', enum: ['document', 'workspace'], description: 'Search scope' }
        },
        required: ['filePath', 'scope']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lsp_diagnostics',
      description: 'Get errors, warnings, and hints from the language server',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File or directory path' },
          extension: { type: 'string', description: 'File extension (e.g. .ts, .py)' },
          severity: { type: 'string', enum: ['error', 'warning', 'information', 'hint', 'all'], description: 'Filter by severity' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lsp_rename',
      description: 'Rename a symbol across the entire workspace',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Character position (0-based)' },
          newName: { type: 'string', description: 'New symbol name' }
        },
        required: ['filePath', 'line', 'character', 'newName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'websearch',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          numResults: { type: 'number', description: 'Number of results (default 8)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'codesearch',
      description: 'Search for code examples and documentation using Exa Code API',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for code' },
          tokensNum: { type: 'number', description: 'Max tokens to return (default 5000)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_search_code',
      description: 'Search for code across GitHub repositories using GitHub code search API. Example: search for "PINN" or "neural network" in code.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query (required). Examples: "PINN neural network", "function readFile", "class Transformer" ' },
          per_page: { type: 'number', description: 'Number of results (max 100, default 30)' }
        },
        required: ['q']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_search_repositories',
      description: 'Search GitHub repositories by name, description, or topics. Example: search for "single pixel imaging" or "machine learning".',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (required). Examples: "single pixel imaging", "deep learning", "physics informed neural networks" ' },
          perPage: { type: 'number', description: 'Number of results (max 100, default 30)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_search_users',
      description: 'Search for users on GitHub',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' }
        },
        required: ['q']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_list_issues',
      description: 'List issues in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state' }
        },
        required: ['owner', 'repo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'question',
      description: 'Ask the user a question with multiple choice options. Example: {"question": "Which language?", "header": "Language", "options": [{"label": "Python", "description": "Popular for AI"}, {"label": "JavaScript", "description": "Web development"}]}',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to ask (required)' },
          header: { type: 'string', description: 'Short label for the question (max 30 chars)' },
          options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, description: { type: 'string' } }, required: ['label', 'description'] }, description: 'Available choices (required)' }
        },
        required: ['question', 'header', 'options']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list',
      description: 'List files and directories in a path. Example: {"path": "C:\\project", "pattern": "*.js"}',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (required)' },
          pattern: { type: 'string', description: 'Glob pattern to filter results' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'patch',
      description: 'Apply a patch to a file. Example: {"filePath": "C:\\test.js", "patch": "--- a/test.js\\n+++ b/test.js\\n@@ -1,3 +1,4 @@\\n old content\\n+new line"}',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path to apply patch to (required)' },
          patch: { type: 'string', description: 'Patch content in unified diff format (required)' }
        },
        required: ['filePath', 'patch']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'todowrite',
      description: 'Create and update task list to track progress during multi-step operations. Example: {"todos": [{"content": "Fix bug", "status": "in_progress", "priority": "high"}]}',
      parameters: {
        type: 'object',
        properties: {
          todos: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] } }, required: ['content', 'status', 'priority'] }, description: 'List of tasks (required)' }
        },
        required: ['todos']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'todoread',
      description: 'Read the current todo list status. Example: {}',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'webfetch',
      description: 'Fetch and read web page content. Example: {"url": "https://github.com", "format": "markdown"}',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch (required)' },
          format: { type: 'string', enum: ['text', 'markdown', 'html'], description: 'Output format (default markdown)' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'skill',
      description: 'Load a skill (SKILL.md file) and return its content for use in the conversation. Example: {"name": "skill-name"}',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name to load (required)' },
          user_message: { type: 'string', description: 'Optional arguments or context for the skill' }
        },
        required: ['name']
      }
    }
  }
]

const systemPrompt = `你是一个强大的 AI 编程助手。
当用户请求你执行操作（如读写文件、执行命令、搜索代码等）时，你应该调用相应的工具来完成任务。
你必须严格按照指定的 JSON 格式返回工具调用，不要添加任何解释或额外文本。`

function buildToolDescription(tools) {
  let desc = '你可以使用以下工具：\n\n'
  for (const tool of tools) {
    const func = tool.function
    desc += `## ${func.name}\n`
    desc += `${func.description}\n`
    desc += '参数：\n'
    const props = func.parameters.properties
    for (const [key, prop] of Object.entries(props)) {
      desc += `  - ${key}: ${prop.description || prop.type}`
      if (func.parameters.required?.includes(key)) {
        desc += ' (必填)'
      }
      desc += '\n'
    }
    desc += '\n'
  }
  desc += `\n当你需要调用工具时，请按照以下 JSON 格式返回：
{"name": "工具名称", "arguments": {"参数1": "值1", "参数2": "值2"}}

不要返回任何其他内容，只返回 JSON 格式的工具调用。`
  return desc
}

app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [{
      id: 'glm-5',
      object: 'model',
      created: Date.now(),
      owned_by: 'fireworks'
    }]
  })
})

function parseSSE(data) {
  const lines = data.split('\n')
  let result = ''
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      result += line.slice(6) + '\n'
    }
  }
  return result
}

app.post('/v1/chat/completions', (req, res) => {
  let { messages, stream = true, temperature, max_tokens, top_p, tools, tool_choice } = req.body

  const fireworksPayload = {
    temperature: temperature ?? 0.6,
    top_p: top_p ?? 1,
    n: 1,
    logprobs: true,
    stream: true,
    echo: false,
    model: MODEL,
    max_tokens: max_tokens ?? 4096,
    top_k: 40,
    presence_penalty: 0,
    frequency_penalty: 0,
    messages
  }

  if (tools) {
    fireworksPayload.tools = tools
  } else {
    fireworksPayload.tools = toolDefinitions
  }

  if (tool_choice) {
    fireworksPayload.tool_choice = tool_choice
  }

  const options = {
    hostname: 'api.fireworks.ai',
    path: '/inference/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${FIREWORKS_API_KEY}`,
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'no-cache',
      'Fireworks-Playground': 'true',
      'Origin': 'https://app.fireworks.ai',
      'Pragma': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site'
    }
  }

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    proxyRes.on('data', (chunk) => {
      res.write(chunk)
    })
    proxyRes.on('end', () => res.end())
    proxyRes.on('error', (err) => {
      console.error('代理响应错误:', err.message)
      res.end()
    })
  })

  proxyReq.on('error', (err) => {
    console.error('代理请求错误:', err.message)
    res.status(502).json({ error: { message: '上游服务不可用', type: 'bad_gateway' } })
  })

  proxyReq.write(JSON.stringify(fireworksPayload))
  proxyReq.end()
})

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`OpenAI 兼容代理已启动: http://localhost:${PORT}`)
  console.log(`模型: ${MODEL}`)
  console.log(`API 地址: http://localhost:${PORT}/v1`)
  console.log(`已注入 ${toolDefinitions.length} 个工具定义`)
})
