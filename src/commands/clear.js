import { sessionStore } from '../store/sessions.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'clear',
  description: '대화 컨텍스트 초기화',
  options: [],
};

/** !clear */
export async function handleMessage(message) {
  const channelId = message.channel.id;
  const session = sessionStore.get(channelId);

  if (!session || session.history.length === 0) {
    return message.reply('🤷 이미 깨끗한 채널이야. 할 얘기가 없었나 보네.');
  }

  const count = session.history.length;
  sessionStore.clear(channelId);
  logger.info(`${message.channel.name} 채널 컨텍스트 초기화됨 (${count}개 메시지)`);
  await message.reply(`🧹 대화 기록 초기화 완료! (${count}개 메시지 삭제)\n시스템 프롬프트와 모델 설정은 유지됐어.`);
}

/** /clear */
export async function handleInteraction(interaction) {
  const channelId = interaction.channel.id;
  const session = sessionStore.get(channelId);

  if (!session || session.history.length === 0) {
    return interaction.reply('🤷 이미 깨끗한 채널이야. 할 얘기가 없었나 보네.');
  }

  const count = session.history.length;
  sessionStore.clear(channelId);
  logger.info(`${interaction.channel.name} 채널 컨텍스트 초기화됨 (${count}개 메시지)`);
  await interaction.reply(`🧹 대화 기록 초기화 완료! (${count}개 메시지 삭제)\n시스템 프롬프트와 모델 설정은 유지됐어.`);
}
