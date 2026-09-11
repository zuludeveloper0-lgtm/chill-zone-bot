const {
    Client,
    GatewayIntentBits,
    Events,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const express = require("express");
require("dotenv").config();

// ====================
// WEBSEITE
// ====================

const app = express();

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Chill Zone - Verify</title>

    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #0f1014;
            color: white;
            font-family: Arial, sans-serif;
        }

        .box {
            width: 380px;
            padding: 40px;
            text-align: center;
            background: #1b1d24;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,.5);
        }

        h1 {
            margin-bottom: 10px;
        }

        p {
            color: #b5bac1;
            line-height: 1.5;
        }

        .button {
            display: inline-block;
            margin-top: 20px;
            padding: 14px 25px;
            background: #5865f2;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
        }
    </style>
</head>

<body>

<div class="box">

    <h1>🔐 Chill Zone</h1>

    <p>
        Willkommen auf der Chill Zone!
        <br><br>
        Verifiziere deinen Discord-Account,
        um Zugriff auf den Server zu erhalten.
    </p>

    <a class="button" href="/login">
        Mit Discord verifizieren
    </a>

</div>

</body>
</html>
    `);
});

app.get("/login", (req, res) => {
    res.send("Discord-Verifizierung kommt als nächster Schritt.");
});

// Render braucht PORT und 0.0.0.0
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Webseite läuft auf Port ${PORT}`);
});

// ====================
// DISCORD BOT
// ====================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Sendet die Verify-Nachricht")
].map(command => command.toJSON());

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot ist online als ${client.user.tag}`);

    const rest = new REST({ version: "10" })
        .setToken(process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log("✅ /verify wurde registriert");

    } catch (error) {
        console.error(error);
    }
});

client.on(Events.GuildMemberAdd, async (member) => {

    const unverifiedRole = member.guild.roles.cache.find(
        role => role.name === "Unverified"
    );

    if (unverifiedRole) {

        try {
            await member.roles.add(unverifiedRole);

            console.log(
                `🔒 ${member.user.tag} ist jetzt Unverified`
            );

        } catch (error) {
            console.error(error);
        }
    }
});

client.on(Events.InteractionCreate, async (interaction) => {

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "verify") {

            const embed = new EmbedBuilder()
                .setTitle("🔐 Verifizierung")
                .setDescription(
                    "Klicke auf den Button unten, um dich zu verifizieren.\n\n" +
                    "Nach erfolgreicher Verifizierung erhältst du Zugriff auf den Server."
                );

            const button = new ButtonBuilder()
                .setCustomId("verify")
                .setLabel("✅ Verify")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(button);

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }

        return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === "verify") {

        const verifiedRole = interaction.guild.roles.cache.find(
            role => role.name === "Verified"
        );

        const unverifiedRole = interaction.guild.roles.cache.find(
            role => role.name === "Unverified"
        );

        if (!verifiedRole) {

            return interaction.reply({
                content: "❌ Die Rolle `Verified` wurde nicht gefunden.",
                ephemeral: true
            });
        }

        try {

            await interaction.member.roles.add(verifiedRole);

            if (unverifiedRole) {
                await interaction.member.roles.remove(unverifiedRole);
            }

            await interaction.reply({
                content: "✅ Du bist jetzt verifiziert!",
                ephemeral: true
            });

        } catch (error) {

            console.error(error);

            await interaction.reply({
                content: "❌ Ich konnte deine Rollen nicht ändern.",
                ephemeral: true
            });
        }
    }
});

client.login(process.env.TOKEN);
