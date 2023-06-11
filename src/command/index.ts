import { Collection } from "discord.js";
import { command, exec } from "./create_invite";

export const commands = [
    {
        name: command.name,
        exec: exec,
        data: command,
    },
];

export const cmd = new Collection();

for (const command of commands) {
    cmd.set(command.name, command.exec);
}