export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
}

type TelegramMessage = {
  text?: string;
  chat: { id: number };
  from?: { is_bot?: boolean };
  business_connection_id?: string;
};

type TelegramUpdate = {
  update_id: number;
  business_message?: TelegramMessage;
  message?: TelegramMessage;
};

const TELEGRAM_API = "https://api.telegram.org";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function helpText(): string {
  return [
    "Команды Business-бота:",
    "",
    ".bold текст — жирный",
    ".italic текст — курсив",
    ".mono текст — моноширинный",
    ".crossed текст — зачёркнутый",
    ".time — время в Киеве",
    ".info — статус подключения",
    ".help — список команд",
    "",
    "Команду и текст отправляй одним сообщением.",
  ].join("\n");
}

function formatCommand(text: string): { html: string; handled: boolean } {
  const trimmed = text.trim();
  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.toLowerCase();
  const argument = rest.join(" ").trim();

  const wrappers: Record<string, (value: string) => string> = {
    ".bold": (value) => `<b>${escapeHtml(value)}</b>`,
    ".italic": (value) => `<i>${escapeHtml(value)}</i>`,
    ".mono": (value) => `<code>${escapeHtml(value)}</code>`,
    ".crossed": (value) => `<s>${escapeHtml(value)}</s>`,
  };

  if (wrappers[command]) {
    if (!argument) {
      return { html: "Добавь текст после команды. Например: <code>.bold Привет</code>", handled: true };
    }
    return { html: wrappers[command](argument), handled: true };
  }

  if (command === ".help" || command === "/help" || command === "/start") {
    return { html: escapeHtml(helpText()), handled: true };
  }

  if (command === ".info") {
    return {
      html: "Business-бот отвечает через подключение Telegram Business. Если ты видишь это сообщение, webhook работает.",
      handled: true,
    };
  }

  if (command === ".time") {
    const now = new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      dateStyle: "full",
      timeStyle: "medium",
    }).format(new Date());
    return { html: `Час у Києві: <b>${escapeHtml(now)}</b>`, handled: true };
  }

  return { html: "", handled: false };
}

async function sendBusinessMessage(
  env: Env,
  chatId: number,
  connectionId: string,
  html: string,
): Promise<void> {
  const response = await fetch(`${TELEGRAM_API}/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      business_connection_id: connectionId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Telegram sendMessage failed:", response.status, details);
    throw new Error("Telegram API request failed");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("EyesSeeBusinessBot is running", { status: 200 });
    }

    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) {
      return new Response("Worker secrets are not configured", { status: 500 });
    }

    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const message = update.business_message;
    if (!message || !message.text || message.from?.is_bot || !message.business_connection_id) {
      return new Response("OK", { status: 200 });
    }

    const result = formatCommand(message.text);
    if (!result.handled) {
      return new Response("OK", { status: 200 });
    }

    try {
      await sendBusinessMessage(
        env,
        message.chat.id,
        message.business_connection_id,
        result.html,
      );
    } catch {
      return new Response("Telegram delivery failed", { status: 502 });
    }

    return new Response("OK", { status: 200 });
  },
};
