import { Server } from "hyper-express";
import { prisma } from "./database";
import randomstring from "randomstring";
import { client } from "./bot";
import { GuildInvitableChannelResolvable } from "discord.js";

const server: import("hyper-express/types/index").Server = new Server();

server.get("/", (req, res) => {
    res.status(307).redirect("https://discord.apricot.wtf/disvites");
})

server.get("/*", async (req, res) => {
    const guildInvite = await prisma.guildInvite.findFirst({
        where: {
            path: req.path,
            subdomainName: req.hostname,
        },
        select: {
            maxUses: true,
            uses: true,
            invites: true,
            guild: true,
            id: true,
        }
    });

    if (!guildInvite || (guildInvite.maxUses !== 0 && guildInvite.maxUses == guildInvite.uses)) return res.status(307).redirect("https://discord.com/invite/" + randomstring.generate(16))

    if (guildInvite.invites.length >= 1) {
        for (const invite of guildInvite.invites) {
            if (Date.now() - invite.issued.getTime() >= 3.6e+6) {
                // discard invite
                await prisma.guildInvite.delete({
                    where: { id: invite.id }
                });
            } else {
                return res.status(307).redirect("https://discord.com/invite/" + invite.discordInviteId)
            }
        }
    }

    // lets create an invite
    const guild = client.guilds.cache.get(guildInvite.guild!.discordId) || await client.guilds.fetch(guildInvite.guild!.discordId);

    const firstChannel = (await guild.channels.fetch()).first();

    if (!firstChannel) return res.status(307).redirect("https://discord.com/invite/" + randomstring.generate(16))

    const inv = await guild.invites.create(
        <GuildInvitableChannelResolvable> firstChannel,
        {
            maxAge: 3e+6,
            reason: "Disvites Temporary Invite Link"
        }
    );

    const invite = await prisma.discordInvite.create({
        data: {
            discordInviteId: inv.code,
            guildInviteId: guildInvite.id,
            guildId: guild.id,
        }
    });

    return res.status(307).redirect("https://discord.com/invite/" + invite.discordInviteId);
})

server.listen(Number(process.env.PORT || "3000"))
    .then(() => console.log("Listening on localhost:" + Number(process.env.PORT || "3000")))