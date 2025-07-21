require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

// Load env variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;  // make sure this matches your server ID
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

// Setup REST for slash commands registration (optional, you can register commands separately)
// (left commented for you to enable)
/*
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: [
          {
            name: 'daily',
            description: 'Get daily stats by ID',
            options: [
              {
                name: 'id',
                description: 'ID to lookup',
                type: 3, // STRING
                required: true,
              },
            ],
          },
          {
            name: 'weekly',
            description: 'Get weekly stats by ID',
            options: [
              {
                name: 'id',
                description: 'ID to lookup',
                type: 3, // STRING
                required: true,
              },
            ],
          },
          {
            name: 'season',
            description: 'Get season stats by ID',
            options: [
              {
                name: 'id',
                description: 'ID to lookup',
                type: 3, // STRING
                required: true,
              },
            ],
          },
        ],
      },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
*/

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Only allow commands in designated channel
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
      // If interaction not deferred yet, reply instead of editReply
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
    // Defer reply immediately to avoid 3s timeout
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

    const baseUrl = process.env.API_BASE_URL || 'https://script.google.com/macros/s/AKfycbz8GF8moOSvHiyljhyn1cbXeYt2hlPLrdpB018fIcpFgkR_xi_j0vxmsKoOBkD6mCoq/exec';

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

    const data = await response.json();

    if (!data || !data.success) {
      await interaction.editReply('❌ No data found or API returned failure.');
      return;
    }

    // Build embed message from data
    const embed = new EmbedBuilder()
      .setTitle(`${commandName.toUpperCase()} stats for ${data.name || 'Unknown'} ID: ${data.id || id}`)
      .setColor('#0099ff')
      .setTimestamp()
      .setFooter({ text: 'Progress Report Bot' });

    if (data.power) embed.addFields({ name: 'Power', value: data.power.toString(), inline: true });
    if (data.kills) embed.addFields({ name: 'Kills', value: data.kills.toString(), inline: true });
    if (data.dataPeriod) embed.addFields({ name: 'Data Period', value: data.dataPeriod, inline: false });

    await interaction.editReply({ embeds: [embed] });
    console.log('Reply sent successfully.');
  } catch (error) {
    console.error('Error processing command:', error);
    try {
      // If deferred reply exists, edit it; else try reply as fallback
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

// Login and setup
client.once('ready', () => {
  console.log(`✅ Discord client ready! Logged in as ${client.user.tag}`);
});
client.login(TOKEN).catch((err) => {
  console.error('Failed to login:', err);
});

// Basic web server for Render health check
const app = express();

app.get('/', (req, res) => {
  res.send('Progress Report Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});
