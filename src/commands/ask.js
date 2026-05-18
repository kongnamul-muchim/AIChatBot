import { createProvider } from '../ai/provider.js';
import { sessionStore } from '../store/sessions.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'ask',
  description: 'AI에게 질문하기',
  options: [
    { type: 3, name: '질문', description: 'AI에게 할 질문', required: true },
  ],
};

/**
 * 코어 실행 로직 (message / interaction 공통)
 */
async function executeReply(channel, user, question, session) {
  await channel.sendTyping();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === '여기에_제미나이_API_키를_넣으세요') {
    return { type: 'reply', content: '❌ GEMINI_API_KEY가 설정되지 않았습니다.\n`.env` 파일을 확인해주세요.' };
  }

  try {
    const provider = createProvider(session.model, { apiKey, model: session.model });
    logger.chat(user, channel.name, question);

    const reply = await provider.generateChat(session.systemPrompt, session.history, question);

    sessionStore.addMessage(channel.id, 'user', question);
    sessionStore.addMessage(channel.id, 'model', reply);

    logger.ai(session.model, reply.substring(0, 80) + (reply.length > 80 ? '...' : ''));

    return { type: 'reply', content: reply };
  } catch (err) {
    logger.error(`Ask error: ${err.message}`);
    return { type: 'reply', content: `❌ 오류가 발생했어...\n\`${err.message}\`` };
  }
}

/** !ask [질문] */
export async function handleMessage(message, args) {
  if (args.length === 0) {
    return message.reply('❓ 질문을 입력해주세요.\n  예: `!ask 안녕?`  또는  `/ask 질문:안녕?`');
  }

  const question = args.join(' ');
  const session = sessionStore.getOrCreate(message.channel.id);
  const result = await executeReply(message.channel, message.author.username, question, session);
  await sendReply(message, result);
}

/** /ask 질문:... */
export async function handleInteraction(interaction) {
  const question = interaction.options.getString('질문');
  const session = sessionStore.getOrCreate(interaction.channel.id);
  const result = await executeReply(interaction.channel, interaction.user.username, question, session);

  if (result.content.length <= 2000) {
    await interaction.reply(result.content);
  } else {
    await interaction.reply(result.content.substring(0, 1990) + '…*(계속)*');
  }
}

/** 긴 메시지 분할 전송 */
async function sendReply(message, result) {
  const content = result.content;
  if (content.length <= 2000) {
    await message.reply(content);
  } else {
    const chunks = splitMessage(content, 1990);
    await message.reply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      await message.channel.send(chunks[i]);
    }
  }
}

function splitMessage(text, maxLen) {
  const chunks = [];
  while (text.length > 0) {
    let chunk = text.substring(0, maxLen);
    const cutAt = Math.max(
      chunk.lastIndexOf('\n'),
      chunk.lastIndexOf('. '),
      chunk.lastIndexOf(' ')
    );
    if (cutAt > maxLen * 0.3) chunk = chunk.substring(0, cutAt + 1);
    chunks.push(chunk.trim());
    text = text.substring(chunk.length).trim();
  }
  return chunks;
}
