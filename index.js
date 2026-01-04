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
const TIMEZONE = "Europe/Lisbon";

// devolve minutos desde 00:00 em Lisboa
function getLisbonMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-PT", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hh = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find(p => p.type === "minute")?.value ?? 0);

  return hh * 60 + mm;
}

function shouldKeepMessage(message) {
  // nunca apagar mensagens fixadas
  if (message.pinned) return true;

  const minutes = getLisbonMinutes(message.createdAt);

  // intervalos permitidos (em minutos)
  const morningStart = 8 * 60;        // 08:00
  const morningEnd   = 8 * 60 + 10;   // 08:10

  const eveningStart = 19 * 60;       // 19:00
  const eveningEnd   = 19 * 60 + 10;  // 19:10

  return (
    (minutes >= morningStart && minutes <= morningEnd) ||
    (minutes >= eveningStart && minutes <= eveningEnd)
  );
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

  for (const msg of messages.values())

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
