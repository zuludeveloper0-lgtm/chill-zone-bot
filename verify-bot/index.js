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

require("dotenv").config();

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

// Neue Mitglieder bekommen automatisch Unverified
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