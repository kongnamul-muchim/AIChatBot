import { sessionStore } from '../store/sessions.js';
import { GeminiProvider } from '../ai/gemini.js';
import { getStorageStats } from '../store/database.js';

export const data = {
  name: 'context',
  description: '현재 채널의 대화 컨텍스트 상태 확인',
  options: [],
};

async function buildContextMessage(channelId) {
  const info = await sessionStore.getContextInfo(channelId);
  const stats = sessionStore.getStats();

  const history = await sessionStore.getHistory(channelId);
  const recentHistory = history.slice(-5);
  let recentPreview = '';
  if (recentHistory.length > 0) {
    const lines = recentHistory.map((msg) => {
      const role = msg.role === 'user' ? '🧑' : '🤖';
      const content = msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
      return `${role} ${content}`;
    });
    recentPreview = `\n**최근 대화 (${recentHistory.length}개):**\n${lines.join('\n')}`;
  } else {
    recentPreview = '\n📭 대화 기록이 없습니다.';
  }

  const displayName = GeminiProvider.getDisplayName(info.model);

  // DB 저장량
  const storage = await getStorageStats();
  let storageLine = '';
  if (storage && storage.totalMessages > 0) {
    const pct = ((parseFloat(storage.totalSizeMB) / storage.limit) * 100).toFixed(1);
    storageLine = `  🗄️ **DB 저장:** ${storage.totalMessages}개 / ${storage.totalSizeMB}MB (${pct}%)\n`;
  }

  return (
    `📊 **컨텍스트 정보**\n\n` +
    `  🤖 **모델:** \`${info.model}\` (${displayName})\n` +
    `  📝 **시스템 프롬프트:**\n  \`\`\`${info.systemPrompt}\`\`\`\n` +
    `  💬 **세션 메시지:** ${info.totalMessages}개 (유저 ${info.userMessages} / 봇 ${info.botMessages})\n` +
    `  📏 **총 글자수:** 약 ${info.totalChars.toLocaleString()}자\n` +
    `  🕐 **세션 시작:** ${info.createdAt}\n` +
    `  🌐 **전체 채널:** ${stats.totalChannels}개\n` +
    `${storageLine}` +
    `${recentPreview}`
  );
}

/** !context */
export async function handleMessage(message) {
  const msg = await buildContextMessage(message.channel.id);
  await message.reply(msg);
}

/** /context */
export async function handleInteraction(interaction) {
  const msg = await buildContextMessage(interaction.channel.id);
  await interaction.reply(msg);
}
