import { sessionStore } from '../store/sessions.js';
import { getAvailableModels } from '../ai/provider.js';
import { GeminiProvider } from '../ai/gemini.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'model',
  description: 'AI 모델 변경 또는 확인',
  options: [
    { type: 3, name: '모델명', description: '변경할 모델명 (비우면 현재 모델 확인, list=목록)', required: false },
  ],
};

function getModelList(currentModel) {
  const models = getAvailableModels();
  return models
    .map((m) => {
      const display = GeminiProvider.getDisplayName(m);
      const isCurrent = m === currentModel ? ' 👈' : '';
      return `  • \`${m}\` — ${display}${isCurrent}`;
    })
    .join('\n');
}

/** !model [모델명] */
export async function handleMessage(message, args) {
  const channelId = message.channel.id;
  const session = sessionStore.getOrCreate(channelId);

  if (args.length === 0) {
    const displayName = GeminiProvider.getDisplayName(session.model);
    return message.reply(`🤖 **현재 모델:** \`${session.model}\` (${displayName})`);
  }

  const input = args[0].toLowerCase();

  if (input === 'list') {
    return message.reply(
      `📋 **사용 가능한 AI 모델:**\n${getModelList(session.model)}\n\n` +
      `변경: \`!model [모델명]\`\n` +
      `> 💡 현재 잘 되는 모델: \`gemini-2.5-flash\``
    );
  }

  const availableModels = getAvailableModels();
  const matchedModel = availableModels.find((m) => m.toLowerCase() === input);

  if (!matchedModel) {
    return message.reply(
      `❌ \`${input}\`은(는) 지원하지 않는 모델이야.\n` +
      `\`!model list\`로 사용 가능한 모델을 확인해줘.`
    );
  }

  sessionStore.setModel(channelId, matchedModel);
  const displayName = GeminiProvider.getDisplayName(matchedModel);
  logger.info(`${message.channel.name} 모델 변경됨: ${matchedModel}`);
  await message.reply(`🔄 **AI 모델이 변경됐어!**\n  → \`${matchedModel}\` (${displayName})\n\n> 💡 \`/model 모델명:list\` 로 전체 목록 확인`);
}

/** /model [모델명] */
export async function handleInteraction(interaction) {
  const channelId = interaction.channel.id;
  const session = sessionStore.getOrCreate(channelId);
  const input = interaction.options.getString('모델명');

  if (!input) {
    const displayName = GeminiProvider.getDisplayName(session.model);
    return interaction.reply(`🤖 **현재 모델:** \`${session.model}\` (${displayName})`);
  }

  const lower = input.toLowerCase();

  if (lower === 'list') {
    return interaction.reply(
      `📋 **사용 가능한 AI 모델:**\n${getModelList(session.model)}\n\n` +
      `> 💡 현재 잘 되는 모델: \`gemini-2.5-flash\``
    );
  }

  const availableModels = getAvailableModels();
  const matchedModel = availableModels.find((m) => m.toLowerCase() === lower);

  if (!matchedModel) {
    return interaction.reply(
      `❌ \`${input}\`은(는) 지원하지 않는 모델이야.\n` +
      `\`/model 모델명:list\`로 사용 가능한 모델을 확인해줘.`
    );
  }

  sessionStore.setModel(channelId, matchedModel);
  const displayName = GeminiProvider.getDisplayName(matchedModel);
  logger.info(`${interaction.channel.name} 모델 변경됨: ${matchedModel}`);
  await interaction.reply(`🔄 **AI 모델이 변경됐어!**\n  → \`${matchedModel}\` (${displayName})`);
}
