// ============================================
//  Простой AI-агент на Ollama + Qwen 3.5
// ============================================
//  Запуск:  node agent.mjs "твой вопрос"
//  Нужно:   ollama с моделью qwen3:latest
// ============================================

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "qwen3.6"; // поменяй если у тебя другое имя модели

// ─── 1. ОПИСАНИЕ ИНСТРУМЕНТОВ ────────────────────────────
// Каждый инструмент — это просто функция + описание для модели

const tools = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Возвращает текущую дату и время",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Вычисляет математическое выражение. Пример: '2 + 2 * 10'",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Математическое выражение для вычисления",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Показывает файлы в указанной директории",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Путь к директории, например '.' или '/home'",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Читает содержимое текстового файла",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Путь к файлу" },
        },
        required: ["path"],
      },
    },
  },
];

// ─── 2. РЕАЛИЗАЦИЯ ИНСТРУМЕНТОВ ──────────────────────────
// Тут — настоящий код, который модель «вызывает»

import { readdirSync, readFileSync } from "fs";

function executeTool(name, args) {
  switch (name) {
    case "get_current_time":
      return new Date().toLocaleString("ru-RU", {
        dateStyle: "full",
        timeStyle: "medium",
      });

    case "calculate":
      try {
        // Безопасное вычисление (только цифры и операторы)
        const safe = args.expression.replace(/[^0-9+\-*/.() ]/g, "");
        return String(eval(safe));
      } catch (e) {
        return `Ошибка: ${e.message}`;
      }

    case "list_files":
      try {
        const entries = readdirSync(args.path, { withFileTypes: true });
        return entries
          .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`))
          .join("\n");
      } catch (e) {
        return `Ошибка: ${e.message}`;
      }

    case "read_file":
      try {
        return readFileSync(args.path, "utf-8").slice(0, 2000);
      } catch (e) {
        return `Ошибка: ${e.message}`;
      }

    default:
      return `Неизвестный инструмент: ${name}`;
  }
}

// ─── 3. ВЫЗОВ OLLAMA ─────────────────────────────────────

async function callOllama(messages) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      stream: false, // для простоты — без стриминга
      think: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama ответил ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

// ─── 4. ГЛАВНЫЙ ЦИКЛ АГЕНТА ─────────────────────────────
// Вот тут и происходит вся «магия»:
// модель думает → вызывает инструмент → получает результат → думает снова

async function runAgent(userQuery) {
  console.log(`\n🧑 Пользователь: ${userQuery}\n`);

  const messages = [
    {
      role: "system",
      content: `Ты — полезный AI-ассистент. У тебя есть инструменты.
Используй их когда нужно. Отвечай на русском языке.
Когда задача выполнена — дай финальный ответ пользователю.`,
    },
    { role: "user", content: userQuery },
  ];

  const MAX_STEPS = 10; // защита от бесконечного цикла

  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(`⚙️  Шаг ${step}: отправляю запрос модели...`);

    const response = await callOllama(messages);
    const msg = response.message;

    // Если модель вызвала инструмент(ы)
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Добавляем ответ модели в историю
      messages.push(msg);

      for (const toolCall of msg.tool_calls) {
        const name = toolCall.function.name;
        const args = toolCall.function.arguments;

        console.log(`🔧 Вызов инструмента: ${name}(${JSON.stringify(args)})`);

        const result = executeTool(name, args);
        console.log(`📋 Результат: ${result.slice(0, 200)}...\n`);

        // Добавляем результат инструмента в историю
        messages.push({
          role: "tool",
          content: result,
        });
      }

      // Продолжаем цикл — модель увидит результат и решит что дальше
      continue;
    }

    // Если модель просто ответила текстом — это финальный ответ
    console.log(`\n🤖 Агент: ${msg.content}\n`);
    return msg.content;
  }

  console.log("⚠️  Достигнут лимит шагов!");
}

// ─── 5. ЗАПУСК ───────────────────────────────────────────

const query = process.argv.slice(2).join(" ") || "Сколько сейчас времени?";
runAgent(query).catch(console.error);
