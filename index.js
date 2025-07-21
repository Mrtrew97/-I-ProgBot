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
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Example slash commands registration (uncomment to use)
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

  // Defer reply immediately to avoid timeout
  try {
    await interaction.deferReply();
    console.log(`Deferred reply for command /${interaction.commandName}`);
  } catch (error) {
    console.error('Failed to defer reply:', error);
    return;
  }

  if (isProcessing) {
    // Already deferred, so editReply instead of reply
    try {
      await interaction.editReply({
        content: '⏳ Bot is busy processing another request. Please wait a moment.',
      });
    } catch (err) {
      console.error('Error sending busy message:', err);
    }
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

    // Build the API URL depending on command
    // Replace with your actual API base URL and parameters
    const baseUrl = process.env.API_BASE_URL || 'https://script.google.com/macros/s/AKfycbwTXyJk_kvqjbyD4mQr6xHOKof0SQqOJq-cvOsbetDlNDA69sRXC4HmXAI3igtP7kuD/exec';

    // For example:
    const url = new URL(baseUrl);
    url.searchParams.append('type', commandName);
    url.searchParams.append('id', id);

    console.log('Fetching data from URL:', url.toString());

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Fetch error:', response.status, response.statusText);
      await interaction.editReply(`❌ Failed to fetch data: ${response.status} ${response.statusText}`);
      isProcessing = false;
      return;
    }

    const data = await response.json();

    if (!data || !data.success) {
      await interaction.editReply('❌ No data found or API returned failure.');
      isProcessing = false;
      return;
    }

    // Build embed message from data (adjust fields according to your data structure)
    const embed = new EmbedBuilder()
      .setTitle(`${commandName.toUpperCase()} stats for ${data.name || 'Unknown'} ID: ${data.id || id}`)
      .setColor('#0099ff')
      .setTimestamp()
      .setFooter({ text: 'Progress Report Bot' });

    // Example: add fields if available
    if (data.power) embed.addFields({ name: 'Power', value: data.power.toString(), inline: true });
    if (data.kills) embed.addFields({ name: 'Kills', value: data.kills.toString(), inline: true });
    if (data.dataPeriod) embed.addFields({ name: 'Data Period', value: data.dataPeriod, inline: false });

    // Edit the deferred reply with embed
    await interaction.editReply({ embeds: [embed] });
    console.log('Reply sent successfully.');
  } catch (error) {
    console.error('Error processing command:', error);
    try {
      await interaction.editReply('❌ An error occurred while processing your request.');
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
