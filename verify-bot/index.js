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
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// WEBSEITE
// =========================

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chill Zone - Verifizierung</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #111827;
            color: white;
            font-family: Arial, sans-serif;
        }

        .box {
            background: #1f2937;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            width: 90%;
            max-width: 450px;
            box-shadow: 0 10px 40px rgba(0,0,0,.4);
        }

        h1 {
            margin-bottom: 10px;
        }

        p {
            color: #d1d5db;
        }

        .button {
            display: inline-block;
            margin-top: 20px;
            padding: 14px 25px;
            background: #5865F2;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
        }

        .button:hover {
            background: #4752c4;
        }
    </style>
</head>

<body>
    <div class="box">
        <h1>🔐 Chill Zone</h1>
        <p>Verifiziere dich mit deinem Discord-Konto.</p>

        <a class="button" href="/login">
            Mit Discord verifizieren
        </a>
    </div>
</body>
</html>
    `);
});

// =========================
// OAUTH2 LOGIN
// =========================

const states = new Map();

app.get("/login", (req, res) => {
    const state = crypto.randomBytes(32).toString("hex");

    states.set(state, Date.now());

    // Alte States nach 10 Minuten löschen
    setTimeout(() => {
        states.delete(state);
    }, 10 * 60 * 1000);

    const params = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        response_type: "code",
        redirect_uri: "https://chill-zone-bot-eckb.onrender.com/callback",
        scope: "identify",
        state: state
    });

    res.redirect(
        `https://discord.com/oauth2/authorize?${params.toString()}`
    );
});

// =========================
// OAUTH2 CALLBACK
// =========================

app.get("/callback", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.send("❌ Ungültige Anfrage.");
        }

        if (!states.has(state)) {
            return res.send("❌ Ungültige oder abgelaufene Anmeldung.");
        }

        states.delete(state);

        // Code gegen Access Token tauschen
        const tokenResponse = await fetch(
            "https://discord.com/api/v10/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri:
                        "https://chill-zone-bot-eckb.onrender.com/callback"
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(tokenData);
            return res.send("❌ Discord-Anmeldung fehlgeschlagen.");
        }

        // Discord Benutzer holen
        const userResponse = await fetch(
            "https://discord.com/api/v10/users/@me",
            {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                }
            }
        );

        const user = await userResponse.json();

        if (!userResponse.ok) {
            return res.send("❌ Discord-Benutzer konnte nicht geladen werden.");
        }

        // Server holen
        const guild = await client.guilds.fetch(process.env.GUILD_ID);

        if (!guild) {
            return res.send("❌ Server wurde nicht gefunden.");
        }

        // Prüfen, ob der Benutzer bereits auf dem Server ist
        let member;

        try {
            member = await guild.members.fetch(user.id);
        } catch {
            return res.send(`
                <html>
                <body style="background:#111827;color:white;font-family:Arial;text-align:center;padding:50px;">
                    <h1>❌ Nicht auf dem Server</h1>
                    <p>Du musst bereits Mitglied der Chill Zone sein.</p>
                    <p>Die Webseite fügt niemanden automatisch zum Server hinzu.</p>
                </body>
                </html>
            `);
        }

        // Rollen suchen
        const verifiedRole = guild.roles.cache.find(
            role => role.name === "Verified"
        );

        const unverifiedRole = guild.roles.cache.find(
            role => role.name === "Unverified"
        );

        if (!verifiedRole) {
            return res.send("❌ Die Rolle 'Verified' wurde nicht gefunden.");
        }

        // Verified geben
        await member.roles.add(verifiedRole);

        // Unverified entfernen
        if (unverifiedRole) {
            await member.roles.remove(unverifiedRole);
        }

        console.log(`✅ ${user.username} wurde über die Webseite verifiziert.`);

        // Zum Discord-Profil weiterleiten
        res.redirect(`https://discord.com/users/${user.id}`);

    } catch (error) {
        console.error("OAuth Fehler:", error);

        res.send(`
            <html>
            <body style="background:#111827;color:white;font-family:Arial;text-align:center;padding:50px;">
                <h1>❌ Fehler</h1>
                <p>Bei der Verifizierung ist ein Fehler aufgetreten.</p>
            </body>
            </html>
        `);
    }
});

// =========================
// WEB SERVER
// =========================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Webseite läuft auf Port ${PORT}`);
});

// =========================
// DISCORD BOT
// =========================

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

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

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

// Neue Mitglieder bekommen Unverified
client.on(Events.GuildMemberAdd, async (member) => {
    const unverifiedRole = member.guild.roles.cache.find(
        role => role.name === "Unverified"
    );

    if (unverifiedRole) {
        try {
            await member.roles.add(unverifiedRole);
            console.log(`🔒 ${member.user.tag} ist jetzt Unverified`);
        } catch (error) {
            console.error(error);
        }
    }
});

// /verify
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
    .setLabel("✅ Auf Webseite verifizieren")
    .setStyle(ButtonStyle.Link)
    .setURL("https://chill-zone-bot-eckb.onrender.com/");

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
