import "dotenv/config";

import { ActivityType, Client, EmbedBuilder, GatewayIntentBits, REST, Routes } from "discord.js";
import { prisma } from "./database";
import { cmd, commands } from "./command";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
    ]
});

client.on("ready", async (client) => {
    console.log("Logged in as", client.user.tag);
    
    client.user.setStatus("online");
    client.user.setActivity({
        type: ActivityType.Watching,
        name: `${await prisma.guild.count()} servers`,
    });

    await client.rest.put(Routes.applicationCommands(client.application.id), {
        body: commands.map(c => c.data.toJSON())
    });
});

client.on("guildCreate", async (guild) => {
    console.log("Joined guild", guild.name);
    
    let $guild = await prisma.guild.findFirst({
        where: {
            discordId: guild.id
        }
    });


    if ($guild?.blacklisted) {
        const owner = await guild.fetchOwner();

        const dm = await owner.createDM();

        try {
            await dm.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Failed to join guild")
                        .setDescription("**" + guild.name + "** is blacklisted by Disvites. Please join [the official support server](https://discord.gg/Q4WYpa4FZd) for more information about the ban, and to appeal.")
                ]
            });
            await dm.send("https://discord.gg/Q4WYpa4FZd");
        } catch (ex) {}

        await guild.leave();
        return;
    }

    if (!$guild) {
        $guild = await prisma.guild.create({
            data: {
                discordId: guild.id,
                blacklisted: false,
            }
        });
    }
    client.user!.setActivity({
        type: ActivityType.Watching,
        name: `${await prisma.guild.count()} servers`,
    });
});
client.on("inviteCreate", async (invite) => {
    if (invite.inviter?.id === client.user!.id || typeof invite.guild?.id !== "string") return;

    await prisma.discordInvite.create({
        data: {
            discordInviteId: invite.code,
            guildId: invite.guild?.id!,
        }
    });
});
client.on("inviteDelete", async (invite) => {
    await prisma.discordInvite.delete({
        where: {
            discordInviteId: invite.code,
        }
    });
});
client.on("guildMemberAdd", async (member) => {
    // check for invite increases/decreases
    const guild = member.guild;

    const invites = await guild.invites.fetch();

    for (const invite of invites) {
        const { uses } = invite?.[1];
        const data = await prisma.discordInvite.findFirst({
            where: {
                discordInviteId: invite?.[1].code,
            },
            select: {
                uses: true,
                guildId: true,
                guildInvite: true,
            }
        });

        if (data?.uses! < uses!) {
            let otherTrans: any[] = [
                prisma.discordInvite.update({
                    where: {
                        discordInviteId: invite?.[1].code,
                    },
                    data: {
                        uses: {
                            increment: 1
                        }
                    }
                }),
            ];
            if (data?.guildInvite) {
                otherTrans.push(
                    prisma.guildInvite.update({
                        where: {
                            id: data.guildInvite.id,
                        },
                        data: {
                            uses: {
                                increment: 1
                            }
                        }
                    })
                )
            }

            await prisma.$transaction(otherTrans)
            // update
        }
    }
});
client.on("guildDelete", async (guild) => {
    // remove all data
    const guildDb = await prisma.guild.findFirst({
        where: {
            discordId: guild.id,
        },
        select: {
            id: true,
            invites: {
                select: {
                    id: true,
                    invites: {
                        select: {
                            id: true,
                        }
                    }
                },
            },
        }
    })
    await prisma.$transaction([
        prisma.guild.delete({ where: {discordId: guild.id} }),
    ].concat(
        //@ts-ignore
        guildDb?.invites.map(
            invite => prisma.guildInvite.delete({ where: { id: invite.id } })
        )
    ).concat(
        //@ts-ignore
        guildDb?.invites.flatMap((v) => v.invites).map(v => prisma.discordInvite.delete({ where: { id: v.id } }))
    ));
    client.user!.setActivity({
        type: ActivityType.Watching,
        name: `${await prisma.guild.count()} servers`,
    });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;
    if (cmd.find((v, k) => k == interaction.commandName)) {
        const command = cmd.get(interaction.commandName);
        try {
            //@ts-ignores
            await command(interaction);
        } catch(ex) {
            console.error(ex);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Failed to execute command")
                        .setColor("#2b2d31")
                ]
            });
        }
    }
})

client.login(process.env.DISCORD_TOKEN);

export {
    client,
}