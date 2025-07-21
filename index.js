require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = process.env.PORT || 10000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let isProcessing = false;

function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? 'N/A' : n.toLocaleString();
}

function formatStat(val1, val2) {
  const num1 = Number(val1) || 0;
  const num2 = Number(val2) || 0;
  const base = formatNumber(num1);

  let delta;
  if (num2 === 0) {
    delta = '🔹 No Change';
  } else if (num2 > 0) {
    delta = `🟢 +${formatNumber(num2)}`;
  } else {
    delta = `🔴 ${formatNumber(num2)}`;
  }

  return `${base} (${delta})`;
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

  try {
    await interaction.deferReply();
    console.log(`Deferred reply for command /${interaction.commandName}`);
  } catch (error) {
    console.error('❌ Failed to defer reply:', error);
    return;
  }

  if (isProcessing) {
    await interaction.editReply({
      content: '⏳ Bot is busy processing another request. Please wait a moment.',
    });
    return;
  }

  const commandName = interaction.commandName.toLowerCase();
  const id = interaction.options.getString('id');

  if (!['daily', 'weekly', 'season'].includes(commandName)) {
    await interaction.editReply('❌ Unknown command.');
    return;
  }

  isProcessing = true;

  try {
    const baseUrl = process.env.API_BASE_URL;
    const url = new URL(baseUrl);
    url.searchParams.append('type', commandName);
    url.searchParams.append('id', id);

    console.log('Fetching data from:', url.toString());
    const response = await fetch(url);

    if (!response.ok) {
      await interaction.editReply(`❌ Failed to fetch data: ${response.status}`);
      return;
    }

    const api = await response.json();
    const row = api.rowData;

    if (!row || !Array.isArray(row)) {
      await interaction.editReply('❌ No data found or invalid response.');
      return;
    }

    const name = row[3] || 'Unknown';
    const playerId = row[5] || id;

    // Build formatted description
    let description = '';

    // Power
    description += `⚡ **Power**: ${formatNumber(row[9])} [${formatNumber(row[10])}]\n\n`;

    // Kills and Breakdown
    description += `⚔️ **Kills**: ${formatStat(row[13], row[14])}\n`;
    description += `○ T5 Killed: ${formatStat(row[42], row[36])}\n`;
    description += `○ T4 Killed: ${formatStat(row[43], row[37])}\n`;
    description += `○ T3 Killed: ${formatStat(row[44], row[38])}\n`;
    description += `○ T2 Killed: ${formatStat(row[45], row[39])}\n`;
    description += `○ T1 Killed: ${formatStat(row[46], row[40])}\n\n`;

    // Deads and Healed
    description += `💀 **Deads**: ${formatStat(row[17], row[18])}\n\n`;
    description += `💖 **Healed**: ${formatStat(row[15], row[16])}\n\n`;

    // RSS Spent
    description += `📉 **RSS Spent**: ${formatNumber(row[41])}\n`;
    description += `○ Gold Spent: ${formatNumber(row[25])}\n`;
    description += `○ Wood Spent: ${formatNumber(row[26])}\n`;
    description += `○ Ore Spent: ${formatNumber(row[27])}\n`;
    description += `○ Mana Spent: ${formatNumber(row[28])}\n\n`;

    // RSS Gathered
    description += `📈 **RSS Gathered**: ${formatNumber(row[20])}\n`;
    description += `○ Gold Gathered: ${formatNumber(row[21])}\n`;
    description += `○ Wood Gathered: ${formatNumber(row[22])}\n`;
    description += `○ Ore Gathered: ${formatNumber(row[23])}\n`;
    description += `○ Mana Gathered: ${formatNumber(row[24])}\n\n`;

    // Data Period
    description += `📅 Data Period from ${row[30]} to ${row[29]}`;

    const embed = new EmbedBuilder()
      .setTitle(`${commandName.toUpperCase()} stats for ${name} ID: ${playerId}`)
      .setColor('#00AE86')
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: 'Progress Report Bot' });

    await interaction.editReply({ embeds: [embed] });
    console.log('✅ Reply sent successfully.');
  } catch (err) {
    console.error('❌ Error processing command:', err);
    try {
      await interaction.editReply('❌ An error occurred while processing your request.');
    } catch (fallbackErr) {
      console.error('❌ Failed to send error message:', fallbackErr);
    }
  } finally {
    isProcessing = false;
  }
});

client.once('ready', () => {
  console.log(`✅ Discord client ready! Logged in as ${client.user.tag}`);
});

client.login(TOKEN).catch((err) => {
  console.error('Failed to login:', err);
});

// Render health check server
const app = express();
app.get('/', (req, res) => {
  res.send('Progress Report Bot is running.');
});
app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});
