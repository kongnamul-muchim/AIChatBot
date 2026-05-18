import {
  getProfile,
  setProfileField,
  removeProfileField,
  clearProfile,
  profileToPrompt,
} from '../store/database.js';
import { logger } from '../utils/logger.js';

export const data = {
  name: 'profile',
  description: 'AI 캐릭터 프로필 설정',
  options: [
    { type: 3, name: '항목', description: '항목명 (name/age/personality/tone/likes/hates/setting)', required: false },
    { type: 3, name: '값', description: '설정할 값 (비우면 해당 항목 삭제)', required: false },
  ],
};

const FIELD_NAMES = {
  name: '이름',
  age: '나이',
  personality: '성격',
  tone: '말투',
  likes: '좋아하는 것',
  hates: '싫어하는 것',
  setting: '설정',
};

const FIELDS = Object.keys(FIELD_NAMES);

// ────── 메시지 명령어 ──────

/** !profile / !profile name 시즈 / !profile remove name / !profile clear */
export async function handleMessage(message, args) {
  const channelId = message.channel.id;
  const db = await import('../store/database.js');

  if (args.length === 0) {
    // 현재 프로필 보기
    const profile = await db.getProfile(channelId);
    return message.reply(formatProfile(profile));
  }

  const cmd = args[0].toLowerCase();

  // !profile clear — 전체 초기화
  if (cmd === 'clear') {
    await db.clearProfile(channelId);
    logger.info(`${message.channel.name} 프로필 초기화됨`);
    return message.reply('🗑️ **프로필이 완전히 초기화됐어!**');
  }

  // !profile remove [항목] — 특정 항목 삭제
  if (cmd === 'remove' || cmd === 'rm') {
    const field = args[1]?.toLowerCase();
    if (!field || !FIELDS.includes(field)) {
      return message.reply(`❓ 항목을 선택해줘.\n사용 가능: \`${FIELDS.join(', ')}\`\n예: \`!profile remove name\``);
    }
    await db.removeProfileField(channelId, field);
    logger.info(`${message.channel.name} 프로필 ${field} 삭제됨`);
    return message.reply(`🗑️ **\`${FIELD_NAMES[field]}\` 항목이 삭제됐어!**`);
  }

  // !profile [항목] [값] — 설정
  const field = cmd;
  if (!FIELDS.includes(field)) {
    return message.reply(
      `❓ 지원하는 항목:\n  ${FIELDS.map((f) => `\`${f}\` = ${FIELD_NAMES[f]}`).join('\n  ')}\n\n` +
      `예시:\n  \`!profile name 시즈\`\n  \`!profile personality 츤데레\`\n  \`!profile clear\``
    );
  }

  const value = args.slice(1).join(' ').trim();
  if (!value) {
    // 값 없으면 해당 항목 삭제
    await db.removeProfileField(channelId, field);
    return message.reply(`🗑️ **\`${FIELD_NAMES[field]}\` 항목이 삭제됐어!**`);
  }

  await db.setProfileField(channelId, field, value);
  logger.info(`${message.channel.name} 프로필 ${field} = ${value}`);
  await message.reply(`✅ **${FIELD_NAMES[field]}** 설정 완료! \`${value}\``);
}

// ────── 슬래시 명령어 ──────

/** /profile 항목:name 값:시즈 */
export async function handleInteraction(interaction) {
  const channelId = interaction.channel.id;
  const db = await import('../store/database.js');
  const field = interaction.options.getString('항목');
  const value = interaction.options.getString('값');

  // 그냥 /profile — 현재 프로필
  if (!field) {
    const profile = await db.getProfile(channelId);
    return interaction.reply(formatProfile(profile));
  }

  const lowerField = field.toLowerCase();

  // /profile 항목:clear
  if (lowerField === 'clear') {
    await db.clearProfile(channelId);
    return interaction.reply('🗑️ **프로필이 완전히 초기화됐어!**');
  }

  // /profile 항목:remove 또는 rm
  if (lowerField === 'remove' || lowerField === 'rm') {
    const target = value?.toLowerCase();
    if (!target || !FIELDS.includes(target)) {
      return interaction.reply(`❓ 삭제할 항목을 \`값\`에 입력해줘.\n예: \`/profile 항목:remove 값:name\``);
    }
    await db.removeProfileField(channelId, target);
    return interaction.reply(`🗑️ **\`${FIELD_NAMES[target]}\` 항목이 삭제됐어!**`);
  }

  // /profile 항목:[field] 값:[value]
  if (!FIELDS.includes(lowerField)) {
    return interaction.reply(
      `❓ 지원: ${FIELDS.join(', ')}\n예: \`/profile 항목:name 값:시즈\``
    );
  }

  if (!value) {
    await db.removeProfileField(channelId, lowerField);
    return interaction.reply(`🗑️ **\`${FIELD_NAMES[lowerField]}\` 항목이 삭제됐어!**`);
  }

  await db.setProfileField(channelId, lowerField, value);
  await interaction.reply(`✅ **${FIELD_NAMES[lowerField]}** 설정 완료! \`${value}\``);
}

// ────── 포맷 ──────

function formatProfile(profile) {
  if (!profile) {
    return (
      '📋 **현재 프로필:** 설정되지 않음\n\n' +
      '**사용법:**\n' +
      `  \`!profile name 시즈\` — 이름\n` +
      `  \`!profile personality 츤데레\` — 성격\n` +
      `  \`!profile tone 반말\` — 말투\n` +
      `  \`!profile clear\` — 전체 초기화\n\n` +
      `> 프로필을 설정하면 AI가 이 정보를 기반으로 응답해!`
    );
  }

  const labels = {
    name: '이름', age: '나이', personality: '성격',
    tone: '말투', likes: '좋아하는 것', hates: '싫어하는 것', setting: '설정',
  };

  const lines = ['📋 **내 AI 프로필**\n'];
  let hasContent = false;
  for (const field of FIELDS) {
    if (profile[field]) {
      lines.push(`  **${labels[field]}:** ${profile[field]}`);
      hasContent = true;
    }
  }

  if (!hasContent) {
    lines.push('  (설정된 항목이 없어요)');
  }

  lines.push(
    '',
    '**변경:** `!profile [항목] [값]`',
    '**삭제:** `!profile remove [항목]`',
    '**초기화:** `!profile clear`'
  );

  return lines.join('\n');
}

/**
 * 컨텍스트용 프로필 프롬프트 생성 (sessions.js에서 사용)
 */
export async function buildProfileContext(channelId) {
  const db = await import('../store/database.js');
  const profile = await db.getProfile(channelId);
  return profileToPrompt(profile);
}
