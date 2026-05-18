import { sessionStore } from '../store/sessions.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'system',
  description: 'AI 성격/말투 설정',
  options: [
    { type: 3, name: '프롬프트', description: 'AI의 성격이나 말투 (비우면 현재 설정 확인)', required: false },
  ],
};

/** !system [프롬프트] */
export async function handleMessage(message, args) {
  const channelId = message.channel.id;
  const session = sessionStore.getOrCreate(channelId);

  if (args.length === 0) {
    return message.reply(
      `📋 **현재 시스템 프롬프트:**\n\`\`\`${session.systemPrompt}\`\`\`\n` +
      `변경하려면: \`!system [새 프롬프트]\`\n` +
      `초기화: \`!system default\``
    );
  }

  const input = args.join(' ');
  if (input.toLowerCase() === 'default') {
    const defaultPrompt = '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.';
    sessionStore.setSystemPrompt(channelId, defaultPrompt);
    logger.info(`${message.channel.name} 시스템 프롬프트 초기화됨`);
    return message.reply('✅ 시스템 프롬프트가 기본값으로 초기화됐어.');
  }

  sessionStore.setSystemPrompt(channelId, input);
  logger.info(`${message.channel.name} 시스템 프롬프트 변경됨`);
  await message.reply(`✅ **시스템 프롬프트가 변경됐어!**\n\`\`\`${input}\`\`\`\n> 이제부터 AI는 이 설정에 따라 응답할 거야.`);
}

/** /system [프롬프트] */
export async function handleInteraction(interaction) {
  const channelId = interaction.channel.id;
  const session = sessionStore.getOrCreate(channelId);
  const input = interaction.options.getString('프롬프트');

  if (!input) {
    return interaction.reply(
      `📋 **현재 시스템 프롬프트:**\n\`\`\`${session.systemPrompt}\`\`\`\n` +
      `변경: \`/system 프롬프트:...\`\n초기화: \`/system 프롬프트:default\``
    );
  }

  if (input.toLowerCase() === 'default') {
    const defaultPrompt = '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.';
    sessionStore.setSystemPrompt(channelId, defaultPrompt);
    logger.info(`${interaction.channel.name} 시스템 프롬프트 초기화됨`);
    return interaction.reply('✅ 시스템 프롬프트가 기본값으로 초기화됐어.');
  }

  sessionStore.setSystemPrompt(channelId, input);
  logger.info(`${interaction.channel.name} 시스템 프롬프트 변경됨`);
  await interaction.reply(`✅ **시스템 프롬프트가 변경됐어!**\n\`\`\`${input}\`\`\`\n> 이제부터 AI는 이 설정에 따라 응답할 거야.`);
}
