import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { prisma } from "../database";
import Randomstring from "randomstring";

export const command = new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Create an invite")
    .setDefaultMemberPermissions("1")
    .setDMPermission(false)

export const exec = async (interaction: CommandInteraction) => {
    if (!interaction.guildId) return interaction.reply({ embeds: [
        new EmbedBuilder()
            .setTitle("Error")
            .setDescription("You must run this command in a guild.")
            .setColor("#2b2d31")
    ]})

    await interaction.deferReply({ ephemeral: true });
    // get guild
    const guild = await prisma.guild.findFirst({
        where: {
            discordId: interaction.guildId!,
        },
        include: {
            invites: true,
        }
    });

    if ((guild?.invites?.length || 0) > 9) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription("You've already reached the limit for permanent invites.\nRequest more invites over @ https://discord.apricot.wtf/")
                    .setColor("#2b2d31")
            ],
        })
    }

    const fr = await prisma.guildInvite.create({
        data: {
            guildId: guild?.id!,
            expires: new Date(864000000000),
            path: "/" + Randomstring.generate(8),
            subdomainName: "inv.apricot.wtf",

        }
    });

    await interaction.editReply({
        embeds: [
            new EmbedBuilder()
                .setTitle("Successfully created invite")
                .setDescription("Your invite link has been generated!")
                .addFields([
                    {
                        name: "Invite Link",
                        value: `https://${fr.subdomainName}${fr.path}`
                    }
                ])
                .setTimestamp(new Date())
                .setColor("#2b2d31")
        ]
    })
}