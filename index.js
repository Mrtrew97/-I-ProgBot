require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

// Load env variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = process.env.PORT || 10000;

console.log('Loaded environment variables:');
console.log('DISCORD_TOKEN:', TOKEN ? '✅ Yes' : '❌ No');
console.log('CLIENT_ID:', CLIENT_ID);
console.log('GUILD_ID:', GUILD_ID);
console.log('CHANNEL_ID:', CHANNEL_ID);
console.log('PORT:', PORT);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let isProcessing = false;

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== CHANNEL_ID) {
    try {
      await interaction.reply({
        content: '❌ Commands can only be used in the designated channel.',
        ephemeral: true,
      });
    } catch (err) {
      console.error('Error replying to command in wrong channel:', err);
    }
    return;
  }

  if (isProcessing) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: '⏳ Bot is busy processing another request. Please wait a moment.',
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: '⏳ Bot is busy processing another request. Please wait a moment.',
        });
      }
    } catch (err) {
      console.error('Error sending busy message:', err);
    }
    return;
  }

  try {
    await interaction.deferReply();
    console.log(`Deferred reply for command /${interaction.commandName}`);
  } catch (error) {
    console.error('Failed to defer reply:', error);
    return;
  }

  const commandName = interaction.commandName.toLowerCase();
  const id = interaction.options.getString('id');

  if (!['daily', 'weekly', 'season'].includes(commandName)) {
    try {
      await interaction.editReply('❌ Unknown command.');
    } catch (err) {
      console.error('Error sending unknown command reply:', err);
    }
    return;
  }

  isProcessing = true;

  try {
    console.log(`Processing command /${commandName} with ID: ${id}`);

    const baseUrl = process.env.API_BASE_URL;
    const url = new URL(baseUrl);
    url.searchParams.append('type', commandName);
    url.searchParams.append('id', id);

    console.log('Fetching data from URL:', url.toString());

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Fetch error:', response.status, response.statusText);
      await interaction.editReply(`❌ Failed to fetch data: ${response.status} ${response.statusText}`);
      return;
    }

    const api = await response.json();
    console.log('API response data:', api);

    if (!api || !api.rowData || !Array.isArray(api.rowData)) {
      await interaction.editReply('❌ No data found or API returned failure.');
      return;
    }

    const row = api.rowData;
    const name = row[3] || "Unknown";
    const playerId = row[5] || id;

    function formatStat(a, b) {
      if (a === 0 && b === 0) return "No Change For This Period";
      if (a === 0) return `No Change For This Period + ${b}`;
      if (b === 0) return `${a} + No Change For This Period`;
      return `${a} + ${b}`;
    }

    function getSumSafe(row, a, b) {
      const x = Number(row[a]) || 0;
      const y = Number(row[b]) || 0;
      return { sum: x + y, partA: x, partB: y };
    }

    const power = getSumSafe(row, 8, 9);
    const kills = getSumSafe(row, 13, 14);
    const deads = getSumSafe(row, 17, 18);
    const healed = getSumSafe(row, 15, 16);

    const t5 = getSumSafe(row, 42, 36);
    const t4 = getSumSafe(row, 43, 37);
    const t3 = getSumSafe(row, 44, 38);
    const t2 = getSumSafe(row, 45, 39);
    const t1 = getSumSafe(row, 46, 40);

    const dataPeriod = `📅Data Period: ${row[30]} to ${row[29]}`;

    const embed = new EmbedBuilder()
      .setTitle(`${commandName.toUpperCase()} stats for ${name} ID: ${playerId}`)
      .setColor('#0099ff')
      .addFields(
        { name: 'Power', value: formatStat(power.partA, power.partB), inline: true },
        { name: 'Kills', value: formatStat(kills.partA, kills.partB), inline: true },
        { name: 'Deads', value: formatStat(deads.partA, deads.partB), inline: true },
        { name: 'Healed', value: formatStat(healed.partA, healed.partB), inline: true },
        { name: 'T5 Killed', value: formatStat(t5.partA, t5.partB), inline: true },
        { name: 'T4 Killed', value: formatStat(t4.partA, t4.partB), inline: true },
        { name: 'T3 Killed', value: formatStat(t3.partA, t3.partB), inline: true },
        { name: 'T2 Killed', value: formatStat(t2.partA, t2.partB), inline: true },
        { name: 'T1 Killed', value: formatStat(t1.partA, t1.partB), inline: true },
        { name: '\u200B', value: dataPeriod, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Progress Report Bot' });

    await interaction.editReply({ embeds: [embed] });
    console.log('✅ Reply sent successfully.');
  } catch (error) {
    console.error('❌ Error processing command:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ An error occurred while processing your request.');
      } else {
        await interaction.reply('❌ An error occurred while processing your request.');
      }
    } catch (err) {
      console.error('Failed to send error message to Discord:', err);
    }
  } finally {
    isProcessing = false;
  }
});

// Discord login
client.once('ready', () => {
  console.log(`✅ Discord client ready! Logged in as ${client.user.tag}`);
});
client.login(TOKEN).catch((err) => {
  console.error('Failed to login:', err);
});

// Express server for Render health check
const app = express();
app.get('/', (req, res) => {
  res.send('Progress Report Bot is running.');
});
app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});
