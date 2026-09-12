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


// ======================================================
// EINSTELLUNGEN
// ======================================================

const PORT = process.env.PORT || 3000;

const REDIRECT_URI =
    "https://chill-zone-bot-eckb.onrender.com/callback";


// ======================================================
// WEBSEITE
// ======================================================

const app = express();

app.get("/", (req, res) => {

    res.send(`
<!DOCTYPE html>
<html lang="de">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>Chill Zone Verifizierung</title>

<style>

* {
    box-sizing: border-box;
}

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
    width: 90%;
    max-width: 450px;

    background: #1f2937;

    padding: 40px;

    border-radius: 20px;

    text-align: center;

    box-shadow:
        0 10px 40px rgba(0,0,0,.4);
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

</style>

</head>

<body>

<div class="box">

<h1>🔐 Chill Zone</h1>

<p>
Willkommen bei der Chill Zone Verifizierung.
</p>

<p>
Melde dich mit deinem Discord-Konto an,
um dich zu verifizieren.
</p>

<a class="button" href="/login">
Mit Discord verifizieren
</a>

</div>

</body>

</html>
    `);
});


// ======================================================
// OAUTH2 STATE
// ======================================================

const states = new Map();


// ======================================================
// DISCORD LOGIN
// ======================================================

app.get("/login", (req, res) => {

    const state =
        crypto.randomBytes(32).toString("hex");

    states.set(state, Date.now());

    // State nach 10 Minuten löschen

    setTimeout(() => {

        states.delete(state);

    }, 10 * 60 * 1000);


    const params = new URLSearchParams({

        client_id:
            process.env.CLIENT_ID,

        response_type:
            "code",

        redirect_uri:
            REDIRECT_URI,

        scope:
            "identify",

        state:
            state

    });


    const discordLoginUrl =
        `https://discord.com/oauth2/authorize?${params.toString()}`;


    res.redirect(discordLoginUrl);

});


// ======================================================
// OAUTH2 CALLBACK
// ======================================================

app.get("/callback", async (req, res) => {

    try {

        const code =
            req.query.code;

        const state =
            req.query.state;


        // Prüfen

        if (!code || !state) {

            return res.send(`
                <h1>❌ Fehler</h1>
                <p>Ungültige Anfrage.</p>
            `);

        }


        // State prüfen

        if (!states.has(state)) {

            return res.send(`
                <h1>❌ Fehler</h1>
                <p>Die Anmeldung ist abgelaufen.</p>
            `);

        }


        states.delete(state);


        // ==================================================
        // IP-ADRESSE ERMITTELN
        // ==================================================

        const ip =
            req.headers["x-forwarded-for"]
                ?.split(",")[0]
                ?.trim()
            ||
            req.socket.remoteAddress
            ||
            "Unbekannt";


        // ==================================================
        // CODE GEGEN ACCESS TOKEN
        // ==================================================

        const tokenResponse =
            await fetch(
                "https://discord.com/api/v10/oauth2/token",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/x-www-form-urlencoded"

                    },

                    body:
                        new URLSearchParams({

                            client_id:
                                process.env.CLIENT_ID,

                            client_secret:
                                process.env.CLIENT_SECRET,

                            grant_type:
                                "authorization_code",

                            code:
                                code,

                            redirect_uri:
                                REDIRECT_URI

                        })

                }
            );


        const tokenData =
            await tokenResponse.json();


        if (!tokenResponse.ok) {

            console.error(
                "❌ Token Fehler:",
                tokenData
            );

            return res.send(`
                <h1>❌ Discord-Fehler</h1>
                <p>Die Discord-Anmeldung konnte nicht abgeschlossen werden.</p>
            `);

        }


        // ==================================================
        // DISCORD USER HOLEN
        // ==================================================

        const userResponse =
            await fetch(
                "https://discord.com/api/v10/users/@me",
                {

                    headers: {

                        Authorization:
                            `Bearer ${tokenData.access_token}`

                    }

                }
            );


        const user =
            await userResponse.json();


        if (!userResponse.ok) {

            return res.send(`
                <h1>❌ Fehler</h1>
                <p>Discord-Benutzer konnte nicht geladen werden.</p>
            `);

        }


        // ==================================================
        // SERVER HOLEN
        // ==================================================

        const guild =
            await client.guilds.fetch(
                process.env.GUILD_ID
            );


        if (!guild) {

            return res.send(`
                <h1>❌ Fehler</h1>
                <p>Der Chill Zone Server wurde nicht gefunden.</p>
            `);

        }


        // ==================================================
        // PRÜFEN, OB USER AUF SERVER IST
        // ==================================================

        let member;


        try {

            member =
                await guild.members.fetch(
                    user.id
                );

        } catch (error) {

            console.log(
                `❌ NICHT AUF SERVER | Name: ${user.username} | ID: ${user.id} | IP: ${ip}`
            );


            return res.send(`
<!DOCTYPE html>

<html lang="de">

<head>

<meta charset="UTF-8">

<title>Chill Zone</title>

<style>

body {
    background: #111827;
    color: white;
    font-family: Arial;
    text-align: center;
    padding: 50px;
}

.box {
    max-width: 500px;
    margin: auto;
    background: #1f2937;
    padding: 40px;
    border-radius: 20px;
}

</style>

</head>

<body>

<div class="box">

<h1>❌ Nicht auf dem Server</h1>

<p>
Du bist noch kein Mitglied der Chill Zone.
</p>

<p>
Bitte tritt zuerst dem Discord-Server bei.
</p>

</div>

</body>

</html>
            `);

        }


        // ==================================================
        // ROLLEN SUCHEN
        // ==================================================

        const verifiedRole =
            guild.roles.cache.find(
                role =>
                    role.name === "Verified"
            );


        const unverifiedRole =
            guild.roles.cache.find(
                role =>
                    role.name === "Unverified"
            );


        if (!verifiedRole) {

            return res.send(`
                <h1>❌ Fehler</h1>
                <p>Die Rolle "Verified" wurde nicht gefunden.</p>
            `);

        }


        // ==================================================
        // VERIFIED GEBEN
        // ==================================================

        await member.roles.add(
            verifiedRole
        );


        // ==================================================
        // UNVERIFIED ENTFERNEN
        // ==================================================

        if (unverifiedRole) {

            await member.roles.remove(
                unverifiedRole
            );

        }


        // ==================================================
        // ERFOLGREICHES VERIFY LOG
        // ==================================================

        console.log(
            `✅ VERIFY | Name: ${user.username} | ID: ${user.id} | IP: ${ip}`
        );


        // ==================================================
        // ZUM DISCORD PROFIL
        // ==================================================

        res.redirect(
            `https://discord.com/users/${user.id}`
        );


    } catch (error) {

        console.error(
            "❌ OAuth Fehler:",
            error
        );


        res.send(`
            <h1>❌ Fehler</h1>
            <p>Bei der Verifizierung ist ein Fehler aufgetreten.</p>
        `);

    }

});


// ======================================================
// WEB SERVER STARTEN
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🌐 Webseite läuft auf Port ${PORT}`
        );

    }
);


// ======================================================
// DISCORD BOT
// ======================================================

const client =
    new Client({

        intents: [

            GatewayIntentBits.Guilds,

            GatewayIntentBits.GuildMembers

        ]

    });


// ======================================================
// SLASH COMMAND
// ======================================================

const commands = [

    new SlashCommandBuilder()

        .setName("verify")

        .setDescription(
            "Sendet die Verify-Nachricht"
        )

].map(
    command =>
        command.toJSON()
);


// ======================================================
// BOT READY
// ======================================================

client.once(
    Events.ClientReady,
    async () => {

        console.log(
            `✅ Bot ist online als ${client.user.tag}`
        );


        const rest =
            new REST({
                version: "10"
            }).setToken(
                process.env.TOKEN
            );


        try {

            await rest.put(

                Routes.applicationCommands(
                    client.user.id
                ),

                {
                    body: commands
                }

            );


            console.log(
                "✅ /verify wurde registriert"
            );


        } catch (error) {

            console.error(error);

        }

    }
);


// ======================================================
// NEUES MITGLIED → UNVERIFIED
// ======================================================

client.on(
    Events.GuildMemberAdd,
    async member => {

        const unverifiedRole =
            member.guild.roles.cache.find(
                role =>
                    role.name === "Unverified"
            );


        if (!unverifiedRole) {

            console.log(
                "❌ Rolle Unverified wurde nicht gefunden"
            );

            return;

        }


        try {

            await member.roles.add(
                unverifiedRole
            );


            console.log(
                `🔒 ${member.user.tag} ist jetzt Unverified`
            );


        } catch (error) {

            console.error(error);

        }

    }
);


// ======================================================
// /VERIFY
// ======================================================

client.on(
    Events.InteractionCreate,
    async interaction => {

        if (!interaction.isChatInputCommand()) {
            return;
        }


        if (
            interaction.commandName !== "verify"
        ) {
            return;
        }


        const embed =
            new EmbedBuilder()

                .setTitle(
                    "🔐 Chill Zone Verifizierung"
                )

                .setDescription(
                    "Klicke auf den Button unten, " +
                    "um dich über unsere Webseite " +
                    "mit Discord zu verifizieren."
                );


        const button =
            new ButtonBuilder()

                .setLabel(
                    "✅ Auf Webseite verifizieren"
                )

                .setStyle(
                    ButtonStyle.Link
                )

                .setURL(
                    "https://chill-zone-bot-eckb.onrender.com/"
                );


        const row =
            new ActionRowBuilder()
                .addComponents(
                    button
                );


        await interaction.reply({

            embeds: [
                embed
            ],

            components: [
                row
            ]

        });

    }
);


// ======================================================
// BOT LOGIN
// ======================================================

client.login(
    process.env.TOKEN
);
