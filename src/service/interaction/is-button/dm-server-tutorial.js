import { ButtonStyle, ButtonBuilder, ActionRowBuilder } from 'discord.js';
import NewMember from '../../../models/NewMember.js';
import config from '../../../config/index.js';
import {
  GENERAL_CHANNELS,
  LANGUAGE_CHANNELS,
  RECREATIONAL_CHANNELS,
  COMMUNITY_CHANNELS,
} from '../../../constants/index.js';

const { SERVER_ID: serverId } = config;

function buildRoleChannelList(roleNames, channelMap) {
  const lines = [];

  for (const roleName in channelMap) {
    if (!roleNames.has(roleName)) continue;
    lines.push(`**${roleName}**: ${channelLink(channelMap[roleName])}`);
  }

  return lines;
}

function channelLink(channelId) {
  return `https://discord.com/channels/${serverId}/${channelId}`;
}

export default async (interaction) => {
  await interaction.deferUpdate().catch((error) => {
    const UNKNOWN_INTERACTION = 10062;
    const UNKNOWN_MESSAGE = 10008;
    if (error?.code !== UNKNOWN_INTERACTION && error?.code !== UNKNOWN_MESSAGE) throw error;
  });

  if (interaction.customId === 'dm-server-tutorial-complete') {
    await NewMember.updateOne({ id: interaction.user.id }, { tutorialDmId: null, tutorialStep: 0 });
    await interaction.message.delete();
    return;
  }

  const user = await NewMember.findOne({ id: interaction.user.id });
  if (!user) return;

  const { tutorialDmId } = user;
  let { tutorialStep } = user;

  if (interaction.customId === 'dm-server-tutorial-start' && tutorialDmId != null) {
    const temp = await interaction.user.send(
      'You already have a tour in progress. Please finish it before starting a new one.',
    );
    setTimeout(() => {
      temp.delete().catch(() => {});
    }, 2000);
    return;
  }

  const nextStepButton = new ButtonBuilder()
    .setCustomId('dm-server-tutorial-next-step')
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary);
  const prevStepButton = new ButtonBuilder()
    .setCustomId('dm-server-tutorial-prev-step')
    .setLabel('Previous')
    .setStyle(ButtonStyle.Secondary);
  const completeButton = new ButtonBuilder()
    .setCustomId('dm-server-tutorial-complete')
    .setLabel('Complete Tour')
    .setStyle(ButtonStyle.Primary);
  const buttonsRow = new ActionRowBuilder();

  const stepContent = {
    roles: `## Roles

First, if you haven't already, please choose the languages you're fluent in and studying, along with your interests in [Channels & Roles](${channelLink(GENERAL_CHANNELS.customize)}).`,
    languageLearning: `## Language Learning

Looking for study partners or learning resources? Start here:
1. ${channelLink(GENERAL_CHANNELS.findExchangePartner)} — find a 1-on-1 language partner.
2. ${channelLink(GENERAL_CHANNELS.resourceDrawer)} — learning resources recommended by the community.
3. ${channelLink(GENERAL_CHANNELS.journal)} — practice writing in your target language(s).

And here are your language channels:
`,
    interests: `## Explore Your Interests

`,
    community: `## Community & Language Activities

`,
    events: `## Events

Want to join language and community events? Check the calendar in ${channelLink(GENERAL_CHANNELS.eventCalendar)}.

Picking event roles lets you choose which activities you'd like to be notified about. Examples include **@VC Talking**, **@Event Reminders**, **@Study Table**, **@Read Together**, and **@Study Together**.
`,
    help: `## Need Help?

Make sure to check ${channelLink(GENERAL_CHANNELS.faq)}.

For non-urgent help, please ask in ${channelLink(GENERAL_CHANNELS.publicServerHelp)}, or open a ticket in ${channelLink(GENERAL_CHANNELS.privateServerHelp)}.

For more immediate assistance, don't hesitate to ping the **@Staff**.`,
    complete: `## Tour Complete

You're all set!

If you haven't already, feel free to introduce yourself in ${channelLink(GENERAL_CHANNELS.introductions)}, and check out ${channelLink(GENERAL_CHANNELS.newMembers)} to meet other newcomers.

Enjoy your stay, and happy language learning!

-# You can restart this tour at any time by pressing the start button again.
`,
  };

  const stepOrder = [
    'roles',
    'languageLearning',
    'interests',
    'community',
    'events',
    'help',
    'complete',
  ];

  const numOfSteps = Object.keys(stepContent).length;

  if (stepOrder.length !== numOfSteps) {
    throw new Error('stepOrder and stepContent are out of sync.');
  }
  for (const step of stepOrder) {
    if (!(step in stepContent)) {
      throw new Error(`Unknown tutorial step: ${step}`);
    }
  }

  const guild = await interaction.client.guilds.fetch(serverId);
  const member = await guild.members.fetch(interaction.user.id);
  const roleNames = new Set(member.roles.cache.map((role) => role.name));

  const languageChannels = buildRoleChannelList(roleNames, LANGUAGE_CHANNELS);
  const recreationalChannels = buildRoleChannelList(roleNames, RECREATIONAL_CHANNELS);
  const communityChannels = buildRoleChannelList(roleNames, COMMUNITY_CHANNELS);

  stepContent.languageLearning += languageChannels.map((line, i) => `${i + 1}. ${line}`).join('\n');
  stepContent.interests += recreationalChannels.length
    ? `If you'd like to chat about your interests beyond language learning, check out:\n${recreationalChannels
        .map((line, i) => `${i + 1}. ${line}`)
        .join('\n')}`
    : `If you add interest roles in "Other Roles" inside [Channels & Roles](${channelLink(GENERAL_CHANNELS.customize)}), relevant channels will appear here.`;
  stepContent.community += communityChannels.length
    ? `You also selected roles for the following community channels:\n${communityChannels
        .map((line, i) => `${i + 1}. ${line}`)
        .join('\n')}`
    : `You have not selected any community roles yet. Select them in "Other Roles" inside [Channels & Roles](${channelLink(GENERAL_CHANNELS.customize)}) if you'd like.`;

  if (interaction.customId === 'dm-server-tutorial-next-step') {
    const maxStep = numOfSteps - 1;
    tutorialStep = Math.min(tutorialStep + 1, maxStep);
  } else if (interaction.customId === 'dm-server-tutorial-prev-step') {
    tutorialStep = Math.max(tutorialStep - 1, 0);
  }
  await NewMember.updateOne({ id: interaction.user.id }, { tutorialStep });

  const content =
    `Step ${tutorialStep + 1} of ${numOfSteps}\n` + stepContent[stepOrder[tutorialStep]];

  if (tutorialStep === 0) {
    buttonsRow.addComponents(nextStepButton);
    if (tutorialDmId == null) {
      const startDm = await interaction.user.send({
        content,
        components: [buttonsRow],
      });
      await NewMember.updateOne({ id: interaction.user.id }, { tutorialDmId: startDm.id });
      return;
    }
  } else if (tutorialStep === numOfSteps - 1) {
    buttonsRow.addComponents(prevStepButton, completeButton);
  } else {
    buttonsRow.addComponents(prevStepButton, nextStepButton);
  }
  await interaction.message.edit({
    content,
    components: [buttonsRow],
  });
};
