import {
  Client, GatewayIntentBits, ActivityType,
  REST, Routes, Events, SlashCommandBuilder,
} from 'discord.js';
import { logger } from './utils/logger.js';
import { findClosestCommand } from './utils/fuzzy.js';
import { sessionStore } from './store/sessions.js';
import { createProvider } from './ai/provider.js';

import * as cmdAsk from './commands/ask.js';
import * as cmdClear from './commands/clear.js';
import * as cmdSystem from './commands/system.js';
import * as cmdModel from './commands/model.js';
import * as cmdContext from './commands/context.js';
import * as cmdAutochat from './commands/autochat.js';

const PREFIX = process.env.PREFIX || '!';

/**
 * 명령어 레지스트리
 */
const commands = {
  ask:     cmdAsk,
  clear:   cmdClear,
  system:  cmdSystem,
  model:   cmdModel,
  context: cmdContext,
  autochat: cmdAutochat,
  help: { data: { name: 'help', description: '명령어 도움말', options: [] }, handleMessage: handleHelpMsg, handleInteraction: handleHelpSlash },
};

const commandNames = Object.keys(commands);

/**
 * Discord 봇 생성 및 실행
 */
export function createBot(token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  // ───────────── 슬래시 명령어 등록 ─────────────
  async function registerSlashCommands() {
    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const slashData = Object.values(commands).map((cmd) => {
        const builder = new SlashCommandBuilder()
          .setName(cmd.data.name)
          .setDescription(cmd.data.description);
        for (const opt of cmd.data.options || []) {
          const optionFn = builder[opt.type === 3 ? 'addStringOption' : 'addBooleanOption'];
          optionFn.call(builder, (o) =>
            o.setName(opt.name).setDescription(opt.description).setRequired(opt.required ?? false)
          );
        }
        return builder.toJSON();
      });
      await rest.put(Routes.applicationCommands(client.user.id), { body: slashData });
      logger.success(`슬래시 명령어 ${slashData.length}개 전역 등록 완료!`);
    } catch (err) {
      logger.warn(`슬래시 명령어 등록 실패: ${err.message}`);
    }
  }

  // ───────────── AI 자동 응답 (컨텍스트+기억 시스템) ─────────────
  async function handleAutoReply(message, text) {
    if (!text || text.trim().length === 0) return;

    const channelId = message.channel.id;
    const session = sessionStore.getOrCreate(channelId);
    if (!session.autochat) return;

    await message.channel.sendTyping();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === '여기에_제미나이_API_키를_넣으세요') {
      return message.reply('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    try {
      const provider = createProvider(session.model, { apiKey, model: session.model });
      logger.chat(message.author.username, message.channel.name, text);

      // 컨텍스트 조립: 최근 대화 + 키워드 검색 + 기억
      const enrichedHistory = await sessionStore.buildContext(channelId, text);
      const reply = await provider.generateChat(session.systemPrompt, enrichedHistory, text);

      // 메시지 저장 + MongoDB에도 저장
      await sessionStore.addMessage(channelId, 'user', text);
      await sessionStore.addMessage(channelId, 'model', reply);

      // 중요한 정보 기억하기 (자동 학습)
      await sessionStore.learnFromMessage(channelId, text, reply);

      logger.ai(session.model, reply.substring(0, 80) + (reply.length > 80 ? '...' : ''));

      if (reply.length <= 2000) {
        await message.reply(reply);
      } else {
        const chunks = splitMessage(reply, 1990);
        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await message.channel.send(chunks[i]);
        }
      }
    } catch (err) {
      logger.error(`Auto-reply error: ${err.message}`);
    }
  }

  // ───────────── ready ─────────────
  client.once('clientReady', async () => {
    logger.success(`봇 로그인 완료! (${client.user.tag})`);
    logger.info(`관리 중인 서버: ${client.guilds.cache.size}개`);

    await registerSlashCommands();

    client.user.setPresence({
      activities: [{ name: '채팅하면 AI가 자동응답 💬', type: ActivityType.Listening }],
      status: 'online',
    });

    for (const guild of client.guilds.cache.values()) {
      logger.info(`  → 서버: ${guild.name} (${guild.id})`);
    }
  });

  // ───────────── 메시지 처리 ─────────────
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // ─── !명령어 처리 ───
    if (message.content.startsWith(PREFIX)) {
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const rawName = args.shift()?.toLowerCase();
      if (!rawName) return;

      let cmd = commands[rawName];

      // 오타 자동보정
      if (!cmd) {
        const fuzzy = findClosestCommand(rawName, commandNames, 2);
        if (fuzzy) {
          cmd = commands[fuzzy.match];
          if (fuzzy.distance > 0) {
            await message.reply(
              `🤔 혹시 \`${PREFIX}${fuzzy.match}\`를 찾은 거야?\n` +
              `(오타: \`${rawName}\` → \`${fuzzy.match}\`)`
            );
          }
        }
      }

      if (!cmd) {
        return message.reply(
          `🤔 \`${PREFIX}${rawName}\` — 이런 명령어는 없어.\n` +
          `\`${PREFIX}help\` 로 확인해봐.`
        );
      }

      try {
        await cmd.handleMessage(message, args);
      } catch (err) {
        logger.error(`명령어 오류 (${rawName}): ${err.message}`);
        if (!message.replied) await message.reply(`❌ 오류 발생:\n\`${err.message}\``);
      }
      return;
    }

    // ─── 일반 채팅 → AI 자동 응답 ───
    await handleAutoReply(message, message.content);
  });

  // ───────────── /슬래시 명령어 ─────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const cmd = commands[interaction.commandName];
    if (!cmd) return;

    try {
      await cmd.handleInteraction(interaction);
    } catch (err) {
      logger.error(`슬래시 오류 (${interaction.commandName}): ${err.message}`);
      const msg = `❌ 오류 발생:\n\`${err.message}\``;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });

  client.on('error', (err) => {
    logger.error(`Discord client error: ${err.message}`);
  });

  client.login(token).catch((err) => {
    logger.error(`로그인 실패: ${err.message}`);
    console.error('');
    console.error('  🔑 Discord Developer Portal에서 봇 토큰을 발급받으세요:');
    console.error('     https://discord.com/developers/applications');
    process.exit(1);
  });

  return client;
}

// ───────────── Help ─────────────

async function handleHelpMsg(message) {
  const list = commandNames
    .filter((n) => n !== 'ask') // ask는 이제 일반 채팅으로 대체
    .map((n) => {
      const cmd = commands[n];
      return `  \`${PREFIX}${n}\` / \`/${n}\` — ${cmd.data.description}`;
    })
    .join('\n');

  await message.reply(
    `🤖 **AI Chat Bot**\n\n` +
    `이제 **그냥 채팅**만 해도 AI가 자동으로 응답해!\n\n` +
    `**설정 명령어:**\n${list}\n\n` +
    `**예시:**\n` +
    `  • \`안녕?\` → AI가 알아서 대답\n` +
    `  • \`!system 넌 고양이야\` → 성격 부여\n` +
    `  • \`!autochat off\` → 자동응답 끄기\n\n` +
    `> 💡 \`!autochat off\` 하면 수동으로만 쓸 수 있어!`
  );
}

async function handleHelpSlash(interaction) {
  const list = commandNames
    .filter((n) => n !== 'ask')
    .map((n) => {
      const cmd = commands[n];
      return `  \`/${n}\` — ${cmd.data.description}`;
    })
    .join('\n');

  await interaction.reply(
    `🤖 **AI Chat Bot**\n\n채팅만 해도 AI가 자동응답!\n\n${list}`
  );
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
