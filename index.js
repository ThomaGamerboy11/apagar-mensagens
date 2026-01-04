const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("Falta a variável de ambiente DISCORD_TOKEN");
  process.exit(1);
}

// 11 salas permitidas
const ALLOWED_CHANNELS = new Set([
  "1305201557217738772",
  "1304854805981954129",
  "1304854841050398730",
  "1304854867004755998",
  "1304854885292048564",
  "1304854902677176372",
  "1304855439699083264",
  "1304854920201109667",
  "1304854938379354193",
  "1304854954103537759",
  "1305201771685085224",
]);

// Só é permitido enviar mensagens nestas horas (Lisboa)
const ALLOWED_TIMES = new Set(["08:06", "19:03"]);
const TIMEZONE = "Europe/Lisbon";

// Usa a API de timezone para obter hora/minuto em Lisboa
function getLisbonHHMM(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-PT", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hh = parts.find(p => p.type === "hour")?.value ?? "00";
  const mm = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

function shouldKeepMessage(message) {
  // Não apagar mensagens fixadas (segurança)
  if (message.pinned) return true;

  const hhmm = getLisbonHHMM(message.createdAt);
  return ALLOWED_TIMES.has(hhmm);
}

async function safeDelete(message) {
  try {
    await message.delete();
  } catch (e) {
    // Falta permissão / já apagado / etc
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.on("messageCreate", async (message) => {
  if (message.author?.bot) return;
  if (!ALLOWED_CHANNELS.has(message.channelId)) return;

  // Se não for uma hora permitida, apagar logo
  if (!shouldKeepMessage(message)) {
    await safeDelete(message);
  }
});

// Limpeza periódica (para o caso de o bot ter estado offline)
// Corre a cada 10 minutos e limpa as últimas 100 mensagens de cada sala.
async function sweepChannel(channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return;

  for (const msg of messages.values()) {
    // opcional: não mexer em mensagens de bots
    // se quiseres apagar também bots, remove este if

    if (!shouldKeepMessage(msg)) {
      await safeDelete(msg);
    }
  }
}

async function sweepAll() {
  for (const channelId of ALLOWED_CHANNELS) {
    await sweepChannel(channelId);
  }
}

client.once("ready", async () => {
  console.log(`🟢 Online como ${client.user.tag}`);
  console.log("🧹 Limpeza ativa: só ficam mensagens às 08:06 e 19:03 (Lisboa).");

  // Sweep inicial ao arrancar
  await sweepAll();

  // Sweep a cada 10 minutos
  cron.schedule("*/10 * * * *", sweepAll, { timezone: TIMEZONE });
});

client.login(TOKEN);
