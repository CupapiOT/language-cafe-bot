import { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import NewMember from '../models/NewMember.js';

export default {
  name: Events.GuildMemberAdd,
  execute: async (member) => {
    const newMember = await NewMember.findOne({ id: member.id });

    if (newMember) {
      return;
    }

    const startButton = new ButtonBuilder()
      .setCustomId('dm-server-tutorial-start')
      .setLabel('Start Tour')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(startButton);
    await member.send({
      content: `# Welcome to the Language Cafe discord server!

I'd be happy to give you a quick tour of the server's most useful channels and features.

Press the button below to begin.
If you'd rather explore on your own, you can ignore this message.`,
      components: [row],
    });

    await NewMember.create({
      id: member.id,
      tutorialStep: 0,
    });
  },
};
