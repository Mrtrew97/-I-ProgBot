require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch'); // ✅ Needed for fetch()

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.SERVER_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

let isProcessing = false;

const commands = [
  {
    name: 'daily',
    description: 'Get daily stats by ID',
    options: [{ name: 'id', type: 3, description: 'Player ID', required: true }],
  },
  {
    name: 'weekly',
    description: 'Get weekly stats by ID',
    options: [{ name: 'id', type: 3, description: 'Player ID', required: true }],
  },
  {
    name: 'season',
    description: 'Get season stats by ID',
    options: [{ name: 'id', type: 3, description: 'Player ID', required: true }],
  },
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  registerCommands();
});

function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? 'N/A' : n.toLocaleString();
}

function formatStat(val1, val2) {
  const num1 = Number(val1) || 0;
  const num2 = Number(val2) || 0;

  const part1 = formatNumber(num1);
  const part2 = num2 === 0
    ? '🔹 No Change'
    : num2 > 0
      ? `🟢 +${formatNumber(num2)}`
      : `🔴 ${formatNumber(num2)}`;

  return `${part1} (${part2})`;
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== CHANNEL_ID) {
    await interaction.reply({
      content: '❌ Commands can only be used in the designated channel.',
      ephemeral: true,
    });
    return;
  }

  if (isProcessing) {
    await interaction.reply({
      content: '⏳ Bot is busy processing another request. Please wait a moment.',
      ephemeral: true,
    });
    return;
  }

  const commandName = interaction.commandName;
  const id = interaction.options.getString('id');

  if (!['daily', 'weekly', 'season'].includes(commandName)) return;

  isProcessing = true;
  await interaction.deferReply(); // ⏳ defers reply so it doesn't timeout

  const baseUrl = process.env.API_BASE_URL;

  try {
    const response = await fetch(`${baseUrl}?type=${commandName}&id=${id}`);
    const result = await response.json();

    if (result.error || !result.rowData) {
      await interaction.editReply(`❌ Error: ${result.error || 'No data found.'}`);
      return;
    }

    const row = result.rowData;
    const name = row[3]; // Column D (name)

    const displayNames = {
      power: '⚡ **Power**',
      kills: '⚔️ **Kills**',
      t5_killed: 'T5 Killed',
      t4_killed: 'T4 Killed',
      t3_killed: 'T3 Killed',
      t2_killed: 'T2 Killed',
      t1_killed: 'T1 Killed',
      deads: '💀 **Deads**',
      healed: '💖 **Healed**',
      rss_spent: '📉 **RSS Spent**',
      gold_spent: 'Gold Spent',
      wood_spent: 'Wood Spent',
      ore_spent: 'Ore Spent',
      mana_spent: 'Mana Spent',
      rss_gathered: '📈 **RSS Gathered**',
      gold_gathered: 'Gold Gathered',
      wood_gathered: 'Wood Gathered',
      ore_gathered: 'Ore Gathered',
      mana_gathered: 'Mana Gathered'
    };

    let description = '';

    description += `${displayNames.power}: ${formatNumber(row[9])} [${formatNumber(row[10])}]\n\n`;
    description += `${displayNames.kills}: ${formatStat(row[13], row[14])}\n`;
    description += `    ○ ${displayNames.t5_killed}: ${formatStat(row[42], row[36])}\n`;
    description += `    ○ ${displayNames.t4_killed}: ${formatStat(row[43], row[37])}\n`;
    description += `    ○ ${displayNames.t3_killed}: ${formatStat(row[44], row[38])}\n`;
    description += `    ○ ${displayNames.t2_killed}: ${formatStat(row[45], row[39])}\n`;
    description += `    ○ ${displayNames.t1_killed}: ${formatStat(row[46], row[40])}\n\n`;
    description += `${displayNames.deads}: ${formatStat(row[17], row[18])}\n\n`;
    description += `${displayNames.healed}: ${formatStat(row[15], row[16])}\n\n`;
    description += `${displayNames.rss_spent}: ${formatNumber(row[41])}\n`;
    description += `    ○ ${displayNames.gold_spent}: ${formatNumber(row[25])}\n`;
    description += `    ○ ${displayNames.wood_spent}: ${formatNumber(row[26])}\n`;
    description += `    ○ ${displayNames.ore_spent}: ${formatNumber(row[27])}\n`;
    description += `    ○ ${displayNames.mana_spent}: ${formatNumber(row[28])}\n\n`;
    description += `${displayNames.rss_gathered}: ${formatNumber(row[20])}\n`;
    description += `    ○ ${displayNames.gold_gathered}: ${formatNumber(row[21])}\n`;
    description += `    ○ ${displayNames.wood_gathered}: ${formatNumber(row[22])}\n`;
    description += `    ○ ${displayNames.ore_gathered}: ${formatNumber(row[23])}\n`;
    description += `    ○ ${displayNames.mana_gathered}: ${formatNumber(row[24])}\n\n`;
    description += `📅 Data Period from ${row[30]} to ${row[29]}`;

    const embed = new EmbedBuilder()
      .setTitle(`${commandName.toUpperCase()} stats for ${name} ID: ${id}`)
      .setColor(0x00AE86)
      .setDescription(description);

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('❌ Error fetching data:', error);
    await interaction.editReply('❌ Failed to fetch data. Please try again later.');
  }

  isProcessing = false;
});

client.login(TOKEN);

// 🟢 Keep-alive server for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});
