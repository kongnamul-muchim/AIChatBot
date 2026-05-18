import { sessionStore } from '../store/sessions.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'system',
  description: 'AI 성격/말투 설정',
  options: [
    { type: 3, name: '프롬프트', description: 'AI의 성격이나 말투 (비우면 현재 설정 확인)', required: false },
  ],
};

/** !system [프롬프트] / !system + [추가] */
export async function handleMessage(message, args) {
  const channelId = message.channel.id;
  const session = sessionStore.getOrCreate(channelId);

  if (args.length === 0) {
    return message.reply(
      `📋 **현재 시스템 프롬프트:**\n\`\`\`${session.systemPrompt}\`\`\`\n\n` +
      `**사용법:**\n` +
      `  • \`!system [프롬프트]\` — 새로 설정 (덮어쓰기)\n` +
      `  • \`!system + [추가]\` — 기존에 추가\n` +
      `  • \`!system default\` — 기본값 초기화`
    );
  }

  const input = args.join(' ').trim();

  // default
  if (input.toLowerCase() === 'default') {
    const defaultPrompt = '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.';
    sessionStore.setSystemPrompt(channelId, defaultPrompt);
    logger.info(`${message.channel.name} 시스템 프롬프트 초기화됨`);
    return message.reply('✅ 시스템 프롬프트가 기본값으로 초기화됐어.');
  }

  // append: !system + [추가내용]
  if (input.startsWith('+ ')) {
    const appendText = input.slice(2).trim();
    if (!appendText) {
      return message.reply('❌ 추가할 내용을 입력해줘. 예: \`!system + 말투는 반말로 해줘\`');
    }
    const newPrompt = session.systemPrompt + '\n' + appendText;
    sessionStore.setSystemPrompt(channelId, newPrompt);
    logger.info(`${message.channel.name} 시스템 프롬프트에 추가됨`);
    return message.reply(
      `✅ **기존 프롬프트에 추가됐어!**\n\`\`\`+ ${appendText}\`\`\`\n` +
      `> 전체 프롬프트는 \`!system\` 으로 확인해봐.`
    );
  }

  // 덮어쓰기
  sessionStore.setSystemPrompt(channelId, input);
  logger.info(`${message.channel.name} 시스템 프롬프트 변경됨`);
  await message.reply(`✅ **시스템 프롬프트가 변경됐어!**\n\`\`\`${input}\`\`\`\n> 이제부터 AI는 이 설정에 따라 응답할 거야.`);
}

/** /system [프롬프트] 또는 /system 프롬프트:+ [추가] */
export async function handleInteraction(interaction) {
  const channelId = interaction.channel.id;
  const session = sessionStore.getOrCreate(channelId);
  const input = interaction.options.getString('프롬프트');

  if (!input) {
    return interaction.reply(
      `📋 **현재 시스템 프롬프트:**\n\`\`\`${session.systemPrompt}\`\`\`\n\n` +
      `**사용법:**\n` +
      `  • \`/system 프롬프트:내용\` — 새로 설정\n` +
      `  • \`/system 프롬프트:+ 추가내용\` — 기존에 추가\n` +
      `  • \`/system 프롬프트:default\` — 초기화`
    );
  }

  // default
  if (input.toLowerCase() === 'default') {
    const defaultPrompt = '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.';
    sessionStore.setSystemPrompt(channelId, defaultPrompt);
    logger.info(`${interaction.channel.name} 시스템 프롬프트 초기화됨`);
    return interaction.reply('✅ 시스템 프롬프트가 기본값으로 초기화됐어.');
  }

  // append: + [내용]
  if (input.startsWith('+ ')) {
    const appendText = input.slice(2).trim();
    if (!appendText) {
      return interaction.reply('❌ 추가할 내용을 입력해줘.');
    }
    const newPrompt = session.systemPrompt + '\n' + appendText;
    sessionStore.setSystemPrompt(channelId, newPrompt);
    logger.info(`${interaction.channel.name} 시스템 프롬프트에 추가됨`);
    return interaction.reply(
      `✅ **기존 프롬프트에 추가됐어!**\n\`\`\`+ ${appendText}\`\`\`\n` +
      `> 전체 프롬프트는 \`/system\` 으로 확인해봐.`
    );
  }

  // 덮어쓰기
  sessionStore.setSystemPrompt(channelId, input);
  logger.info(`${interaction.channel.name} 시스템 프롬프트 변경됨`);
  await interaction.reply(`✅ **시스템 프롬프트가 변경됐어!**\n\`\`\`${input}\`\`\`\n> 이제부터 AI는 이 설정에 따라 응답할 거야.`);
}
