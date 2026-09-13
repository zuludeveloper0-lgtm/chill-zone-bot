require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// ENV
// ==============================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;

const REDIRECT_URI =
    "https://chill-zone-bot-eckb.onrender.com/callback";

// ==============================
// DISCORD CLIENT
// ==============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ==============================
// WEBSITE
// ==============================

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Chill Zone Verification</title>

    <style>
        body {
            margin: 0;
            background: #111827;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .box {
            background: #1f2937;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            width: 90%;
            max-width: 450px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        }

        h1 {
            margin-bottom: 10px;
        }

        p {
            color: #d1d5db;
            line-height: 1.5;
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

        .info {
            margin-top: 25px;
            font-size: 13px;
            color: #9ca3af;
        }
    </style>
</head>

<body>

<div class="box">

    <h1>🌴 Chill Zone</h1>

    <p>
        Willkommen bei der Chill Zone!
    </p>

    <p>
        Um Zugang zum Server zu bekommen,
        musst du dich mit deinem Discord-Konto verifizieren.
    </p>

    <a class="button" href="/login">
        🔐 Mit Discord verifizieren
    </a>

    <div class="info">
        Bei der Verifizierung werden dein Discord-Name,
        deine Discord-ID und deine von Discord bereitgestellte
        E-Mail-Adresse verarbeitet.
    </div>

</div>

</body>
</html>
    `);
});

// ==============================
// LOGIN
// ==============================

app.get("/login", (req, res) => {

    const state = crypto.randomBytes(16).toString("hex");

    const authUrl =
        "https://discord.com/oauth2/authorize" +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=identify%20email`;

    res.redirect(authUrl + `&state=${state}`);
});

// ==============================
// CALLBACK
// ==============================

app.get("/callback", async (req, res) => {

    try {

        const code = req.query.code;

        if (!code) {
            return res.send("❌ Kein OAuth2-Code vorhanden.");
        }

        // ==========================
        // CODE GEGEN ACCESS TOKEN
        // ==========================

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: REDIRECT_URI
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {

            console.log(
                "❌ OAuth2 Token Fehler:",
                tokenData
            );

            return res.send(
                "❌ Die Discord-Verifizierung ist fehlgeschlagen."
            );
        }

        // ==========================
        // DISCORD USER
        // ==========================

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization:
                        `Bearer ${tokenData.access_token}`
                }
            }
        );

        const user = await userResponse.json();

        if (!user.id) {
            return res.send(
                "❌ Discord-Benutzer konnte nicht abgerufen werden."
            );
        }

        // ==========================
        // EMAIL
        // ==========================

        const email =
            user.email || "Nicht verfügbar";

        // ==========================
        // IP
        // ==========================

        const ip =
            req.headers["x-forwarded-for"]
                ?.split(",")[0]
                ?.trim() ||
            req.socket.remoteAddress ||
            "Unbekannt";

        // ==========================
        // SERVER
        // ==========================

        const guild =
            await client.guilds.fetch(GUILD_ID);

        let member;

        try {

            member =
                await guild.members.fetch(user.id);

        } catch {

            return res.send(`
                <h2>❌ Du bist nicht auf dem Discord-Server.</h2>
                <p>Bitte tritt zuerst der Chill Zone bei.</p>
            `);
        }

        // ==========================
        // ROLLEN
        // ==========================

        const verifiedRole =
            guild.roles.cache.find(
                role => role.name === "Verified"
            );

        const unverifiedRole =
            guild.roles.cache.find(
                role => role.name === "Unverified"
            );

        if (!verifiedRole) {
            return res.send(
                "❌ Die Rolle 'Verified' wurde nicht gefunden."
            );
        }

        // ==========================
        // VERIFIED HINZUFÜGEN
        // ==========================

        await member.roles.add(verifiedRole);

        // ==========================
        // UNVERIFIED ENTFERNEN
        // ==========================

        if (unverifiedRole) {
            await member.roles.remove(unverifiedRole);
        }

        // ==========================
        // LOG
        // ==========================

        console.log(
            "======================================"
        );

        console.log(
            `✅ VERIFY | Name: ${user.username}`
        );

        console.log(
            `🆔 Discord ID: ${user.id}`
        );

        console.log(
            `📧 E-Mail: ${email}`
        );

        console.log(
            `🌐 IP: ${ip}`
        );

        console.log(
            "======================================"
        );

        // ==========================
        // ERFOLG
        // ==========================

        res.send(`
<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">

    <title>Verifiziert</title>

    <style>

        body {
            background: #111827;
            color: white;
            font-family: Arial;
            text-align: center;
            padding-top: 100px;
        }

        .box {
            background: #1f2937;
            padding: 40px;
            margin: auto;
            border-radius: 20px;
            max-width: 450px;
        }

        h1 {
            color: #57F287;
        }

    </style>

</head>

<body>

<div class="box">

    <h1>✅ Erfolgreich verifiziert!</h1>

    <p>
        Hallo <b>${escapeHtml(user.username)}</b>!
    </p>

    <p>
        Du hast jetzt Zugriff auf die Chill Zone.
    </p>

    <p>
        Du kannst dieses Fenster schließen.
    </p>

</div>

</body>

</html>
        `);

    } catch (error) {

        console.error(
            "❌ VERIFICATION ERROR:",
            error
        );

        res.status(500).send(`
            <h2>❌ Ein Fehler ist aufgetreten.</h2>
            <p>Bitte versuche es später erneut.</p>
        `);
    }
});

// ==============================
// HTML ESCAPE
// ==============================

function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==============================
// WEB SERVER
// ==============================

app.listen(PORT, () => {

    console.log(
        `🌐 Webseite läuft auf Port ${PORT}`
    );

});

// ==============================
// BOT READY
// ==============================

client.once("ready", async () => {

    console.log(
        `✅ Bot ist online als ${client.user.tag}`
    );

    // ==========================
    // SLASH COMMAND
    // ==========================

    const commands = [

        new SlashCommandBuilder()
            .setName("verify")
            .setDescription(
                "Sendet das Verifizierungs-Panel"
            )
            .toJSON()

    ];

    const rest = new REST({
        version: "10"
    }).setToken(TOKEN);

    try {

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            "✅ /verify wurde registriert"
        );

    } catch (error) {

        console.error(
            "❌ Fehler beim Registrieren:",
            error
        );
    }

});

// ==============================
// NEUES MITGLIED
// ==============================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            const role =
                member.guild.roles.cache.find(
                    r => r.name === "Unverified"
                );

            if (!role) {

                console.log(
                    "❌ Rolle 'Unverified' nicht gefunden."
                );

                return;
            }

            await member.roles.add(role);

            console.log(
                `👤 ${member.user.tag} bekam Unverified`
            );

        } catch (error) {

            console.error(
                "❌ Fehler bei Unverified:",
                error
            );
        }

    }
);

// ==============================
// SLASH COMMAND
// ==============================

client.on(
    "interactionCreate",
    async interaction => {

        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (interaction.commandName !== "verify") {
            return;
        }

        const button =
            new ButtonBuilder()
                .setLabel(
                    "Auf Webseite verifizieren"
                )
                .setEmoji("✅")
                .setStyle(ButtonStyle.Link)
                .setURL(
                    "https://chill-zone-bot-eckb.onrender.com/"
                );

        const row =
            new ActionRowBuilder()
                .addComponents(button);

        await interaction.reply({

            content:
                "🔐 **Chill Zone Verifizierung**\n\n" +
                "Klicke auf den Button, um dich " +
                "über Discord zu verifizieren.",

            components: [row]

        });

    }
);

// ==============================
// BOT LOGIN
// ==============================

client.login(TOKEN);
