export interface PartitionedCommands {
  readonly preShadow: string[];
  readonly post: string[];
}

export function partitionImageCommands(commands: string[], shadowAliases: Set<string>): PartitionedCommands {
  const preShadowImageCmds: string[] = [];
  const postImageCmds: string[] = [];

  for (let i = 0; i < commands.length; ) {
    if (commands[i] === "q" && i + 3 < commands.length && commands[i + 3] === "Q") {
      const doLine = commands[i + 2] ?? "";
      const match = doLine.match(/^\/(\w+)\s+Do$/);
      const block = [commands[i], commands[i + 1] ?? "", commands[i + 2] ?? "", commands[i + 3] ?? ""];
      i += 4;
      if (match && shadowAliases.has(match[1])) {
        preShadowImageCmds.push(...block);
      } else {
        postImageCmds.push(...block);
      }
    } else {
      postImageCmds.push(commands[i]);
      i += 1;
    }
  }

  return { preShadow: preShadowImageCmds, post: postImageCmds };
}
