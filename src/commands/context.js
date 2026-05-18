import { sessionStore } from '../store/sessions.js';
import { GeminiProvider } from '../ai/gemini.js';

export const data = {
  name: 'context',
  description: '현재 채널의 대화 컨텍스트 상태 확인',
  options: [],
};

function buildContextMessage(channelId) {
  const info = sessionStore.getContextInfo(channelId);
  const stats = sessionStore.getStats();

  const recentHistory = sessionStore.getHistory(channelId).slice(-5);
  let recentPreview = '';
  if (recentHistory.length > 0) {
    const lines = recentHistory.map((msg) => {
      const role = msg.role === 'user' ? '🧑' : '🤖';
      const content = msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
      return `${role} ${content}`;
    });
    recentPreview = `\n**최근 대화 (${recentHistory.length}개):**\n${lines.join('\n')}`;
  } else {
    recentPreview = '\n📭 대화 기록이 없습니다. `/ask`로 질문을 시작해보세요.';
  }

  const displayName = GeminiProvider.getDisplayName(info.model);

  return (
    `📊 **컨텍스트 정보**\n\n` +
    `  🤖 **모델:** \`${info.model}\` (${displayName})\n` +
    `  📝 **시스템 프롬프트:**\n  \`\`\`${info.systemPrompt}\`\`\`\n` +
    `  💬 **총 메시지:** ${info.totalMessages}개 (유저 ${info.userMessages} / 봇 ${info.botMessages})\n` +
    `  📏 **총 글자수:** 약 ${info.totalChars.toLocaleString()}자\n` +
    `  🕐 **세션 시작:** ${info.createdAt}\n` +
    `  🌐 **전체 채널:** ${stats.totalChannels}개, 전체 메시지 ${stats.totalMessages}개\n` +
    `${recentPreview}`
  );
}

/** !context */
export async function handleMessage(message) {
  await message.reply(buildContextMessage(message.channel.id));
}

/** /context */
export async function handleInteraction(interaction) {
  await interaction.reply(buildContextMessage(interaction.channel.id));
}
