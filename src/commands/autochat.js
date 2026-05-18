import { sessionStore } from '../store/sessions.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'autochat',
  description: '자동 응답 모드 켜기/끄기',
  options: [
    { type: 3, name: '상태', description: 'on 또는 off (비우면 현재 상태 확인)', required: false },
  ],
};

/** !autochat [on/off] */
export async function handleMessage(message, args) {
  const channelId = message.channel.id;
  const session = await sessionStore.getOrCreate(channelId);

  if (args.length === 0) {
    const status = session.autochat ? '🟢 켜짐' : '🔴 꺼짐';
    return message.reply(
      `🤖 **자동 응답:** ${status}\n` +
      `  • 켜기: \`!autochat on\`\n` +
      `  • 끄기: \`!autochat off\`\n\n` +
      `> 켜져 있으면 일반 채팅만으로 AI가 응답해.\n` +
      `> 꺼도 \`!ask\`로 수동 질문은 계속 가능해.`
    );
  }

  const input = args[0].toLowerCase();

  if (input === 'on' || input === '켜기' || input === 'true') {
    sessionStore.setAutochat(channelId, true);
    logger.info(`${message.channel.name} 자동응답 켜짐`);
    return message.reply('🟢 **자동 응답 켜짐!**\n이제 일반 채팅만 해도 AI가 응답할게.');
  }

  if (input === 'off' || input === '끄기' || input === 'false') {
    sessionStore.setAutochat(channelId, false);
    logger.info(`${message.channel.name} 자동응답 꺼짐`);
    return message.reply('🔴 **자동 응답 꺼짐!**\n`!ask`로 수동 질문은 계속 가능해.');
  }

  return message.reply('❓ `!autochat on` 또는 `!autochat off` 로 설정해줘.');
}

/** /autochat [상태] */
export async function handleInteraction(interaction) {
  const channelId = interaction.channel.id;
  const session = await sessionStore.getOrCreate(channelId);
  const input = interaction.options.getString('상태');

  if (!input) {
    const status = session.autochat ? '🟢 켜짐' : '🔴 꺼짐';
    return interaction.reply(`🤖 **자동 응답:** ${status}\n  • 켜기: \`/autochat 상태:on\`\n  • 끄기: \`/autochat 상태:off\``);
  }

  const lower = input.toLowerCase();

  if (lower === 'on' || lower === '켜기') {
    sessionStore.setAutochat(channelId, true);
    logger.info(`${interaction.channel.name} 자동응답 켜짐`);
    return interaction.reply('🟢 **자동 응답 켜짐!**\n이제 일반 채팅만 해도 AI가 응답할게.');
  }

  if (lower === 'off' || lower === '끄기') {
    sessionStore.setAutochat(channelId, false);
    logger.info(`${interaction.channel.name} 자동응답 꺼짐`);
    return interaction.reply('🔴 **자동 응답 꺼짐!**\n`!ask`로 수동 질문은 계속 가능해.');
  }

  return interaction.reply('❓ `/autochat 상태:on` 또는 `/autochat 상태:off` 로 설정해줘.');
}
