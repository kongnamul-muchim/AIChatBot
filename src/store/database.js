import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// ───────────── 연결 ─────────────

let connected = false;

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.warn('MONGO_URI가 없습니다. 메모리 모드로 동작합니다.');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    connected = true;
    logger.success('MongoDB Atlas 연결 완료!');
    return true;
  } catch (err) {
    logger.error(`MongoDB 연결 실패: ${err.message}`);
    logger.warn('메모리 모드로 동작합니다.');
    return false;
  }
}

export function isConnected() {
  return connected;
}

// ───────────── 스키마 ─────────────

const messageSchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  role:      { type: String, enum: ['user', 'model'], required: true },
  content:   { type: String, required: true },
  keywords:  [String],
  timestamp: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema({
  channelId:    { type: String, required: true, unique: true },
  systemPrompt: { type: String, default: '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.' },
  model:        { type: String, default: 'gemini-2.5-flash' },
  autochat:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
});

// 영구 기억 (중요 정보 저장용)
const memorySchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  key:       { type: String, required: true },   // 기억 키 (예: "user_name", "pet_name")
  value:     { type: String, required: true },    // 기억 값 (예: "홍길동")
  keywords:  [String],                            // 검색용 키워드
  updatedAt: { type: Date, default: Date.now },
});

// ───────────── 캐릭터 프로필 스키마 ─────────────
const profileSchema = new mongoose.Schema({
  channelId:   { type: String, required: true, unique: true },
  name:        { type: String, default: '' },
  age:         { type: String, default: '' },
  personality: { type: String, default: '' },
  tone:        { type: String, default: '' },
  likes:       { type: String, default: '' },
  hates:       { type: String, default: '' },
  setting:     { type: String, default: '' },
  updatedAt:   { type: Date, default: Date.now },
});

// 복합 인덱스: 채널 + 키워드 검색 최적화
messageSchema.index({ channelId: 1, keywords: 1 });
memorySchema.index({ channelId: 1, keywords: 1 });

const Message = mongoose.model('Message', messageSchema);
const Session = mongoose.model('Session', sessionSchema);
const Memory  = mongoose.model('Memory', memorySchema);
const Profile = mongoose.model('Profile', profileSchema);

// ───────────── 키워드 추출 ─────────────

const STOP_WORDS = new Set([
  '이', '그', '저', '것', '수', '등', '더', 'less', '많이', '너무', '정말',
  '안', '않', '뭐', '누구', '무슨', '어떤', '왜', '어디', '언제',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
  'this', 'that', 'these', 'those', 'and', 'or', 'but', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'do', 'does', 'did', 'have',
  'has', 'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might',
  'hello', 'hi', 'yes', 'no', 'ok', 'okay', 'thanks', 'thank', 'please',
]);

/**
 * 텍스트에서 키워드 추출 (2글자 이상, 불용어 제외)
 */
export function extractKeywords(text) {
  if (!text) return [];

  // 한글/영문 분리해서 처리
  const koreanWords = text.match(/[가-힣]{2,}/g) || [];
  const englishWords = text.toLowerCase().match(/[a-z]{3,}/g) || [];

  const words = [...koreanWords, ...englishWords];

  // 불용어 제거 + 중복 제거
  const unique = [...new Set(words.filter((w) => !STOP_WORDS.has(w)))];

  return unique.slice(0, 20); // 최대 20개
}

// ───────────── 메시지 저장/조회 ─────────────

/**
 * 메시지 저장 (키워드 자동 추출)
 */
export async function saveMessage(channelId, role, content) {
  if (!connected) return;

  const keywords = extractKeywords(content);

  try {
    await Message.create({ channelId, role, content, keywords });

    // 너무 많으면 오래된 거 정리 (채널당 최근 1000개만)
    const count = await Message.countDocuments({ channelId });
    if (count > 1000) {
      const oldest = await Message.find({ channelId }).sort({ timestamp: 1 }).limit(count - 1000);
      if (oldest.length > 0) {
        await Message.deleteMany({ _id: { $in: oldest.map((m) => m._id) } });
      }
    }
  } catch (err) {
    logger.error(`메시지 저장 실패: ${err.message}`);
  }
}

/**
 * 채널의 최근 N개 메시지 조회
 */
export async function getRecentMessages(channelId, limit = 30) {
  if (!connected) return [];

  try {
    return await Message.find({ channelId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    logger.error(`메시지 조회 실패: ${err.message}`);
    return [];
  }
}

/**
 * 키워드 기반 관련 메시지 검색
 * 질문과 관련된 과거 대화만 골라서 가져옴
 */
export async function searchMessagesByKeywords(channelId, query, maxResults = 5) {
  if (!connected) return [];

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  try {
    // 같은 키워드를 가진 메시지 검색
    const messages = await Message.find({
      channelId,
      keywords: { $in: keywords },
    })
      .sort({ timestamp: -1 })
      .limit(maxResults)
      .lean();

    return messages;
  } catch (err) {
    logger.error(`키워드 검색 실패: ${err.message}`);
    return [];
  }
}

// ───────────── 세션 저장/조회 ─────────────

/**
 * 세션 저장 (upsert)
 */
export async function saveSession(channelId, data) {
  if (!connected) return;

  try {
    await Session.findOneAndUpdate(
      { channelId },
      { ...data, updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    logger.error(`세션 저장 실패: ${err.message}`);
  }
}

/**
 * 세션 조회
 */
export async function loadSession(channelId) {
  if (!connected) return null;

  try {
    return await Session.findOne({ channelId }).lean();
  } catch (err) {
    logger.error(`세션 조회 실패: ${err.message}`);
    return null;
  }
}

// ───────────── 영구 기억 관리 ─────────────

/**
 * 중요한 정보 기억시키기
 * ex) saveMemory(channelId, 'pet_name', '멍멍이', ['강아지', '멍멍이', '반려동물'])
 */
export async function saveMemory(channelId, key, value, keywords = []) {
  if (!connected) return;

  try {
    await Memory.findOneAndUpdate(
      { channelId, key },
      { value, keywords, updatedAt: new Date() },
      { upsert: true }
    );
    logger.info(`기억 저장됨: ${key} = ${value}`);
  } catch (err) {
    logger.error(`기억 저장 실패: ${err.message}`);
  }
}

/**
 * 키워드로 관련 기억 검색
 */
export async function searchMemories(channelId, query) {
  if (!connected) return [];

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  try {
    return await Memory.find({
      channelId,
      keywords: { $in: keywords },
    }).lean();
  } catch (err) {
    logger.error(`기억 검색 실패: ${err.message}`);
    return [];
  }
}

/**
 * 채널의 모든 기억 조회 (컨텍스트용)
 */
export async function getAllMemories(channelId) {
  if (!connected) return [];

  try {
    return await Memory.find({ channelId }).lean();
  } catch (err) {
    logger.error(`기억 조회 실패: ${err.message}`);
    return [];
  }
}

/**
 * 채널의 메시지 개수 조회
 */
export async function getMessageCount(channelId) {
  if (!connected) return 0;

  try {
    return await Message.countDocuments({ channelId });
  } catch (err) {
    return 0;
  }
}

/**
 * 저장소 사용량 통계
 */
export async function getStorageStats() {
  if (!connected) return null;

  try {
    const stats = await Message.aggregate([
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          totalSize: { $sum: { $strLenCP: '$content' } },
          channels: { $addToSet: '$channelId' },
        },
      },
    ]);

    if (stats.length === 0) {
      return { totalMessages: 0, totalSizeBytes: 0, totalChannels: 0 };
    }

    const s = stats[0];
    return {
      totalMessages: s.totalMessages,
      totalSizeBytes: s.totalSize,
      totalSizeMB: (s.totalSize / (1024 * 1024)).toFixed(2),
      totalChannels: s.channels.length,
      limit: 512, // MongoDB Free tier limit
    };
  } catch (err) {
    return null;
  }
}

/**
 * 30일 지난 메시지 정리
 */
export async function cleanupOldMessages(days = 30) {
  if (!connected) return 0;

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Message.deleteMany({ timestamp: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      logger.info(`🗑️ ${days}일 지난 메시지 ${result.deletedCount}개 정리됨`);
    }
    return result.deletedCount || 0;
  } catch (err) {
    logger.error(`정리 실패: ${err.message}`);
    return 0;
  }
}

// ───────────── 캐릭터 프로필 ─────────────

/**
 * 프로필 조회
 */
export async function getProfile(channelId) {
  if (!connected) return null;
  try {
    return await Profile.findOne({ channelId }).lean();
  } catch {
    return null;
  }
}

/**
 * 프로필 항목 저장
 */
const VALID_FIELDS = ['name', 'age', 'personality', 'tone', 'likes', 'hates', 'setting'];

export async function setProfileField(channelId, field, value) {
  if (!connected) return null;
  if (!VALID_FIELDS.includes(field)) return null;

  try {
    const update = { [field]: value, updatedAt: new Date() };
    const profile = await Profile.findOneAndUpdate(
      { channelId },
      { $set: update },
      { upsert: true, new: true }
    ).lean();
    return profile;
  } catch {
    return null;
  }
}

/**
 * 프로필 항목 삭제
 */
export async function removeProfileField(channelId, field) {
  if (!connected) return null;
  if (!VALID_FIELDS.includes(field)) return null;

  try {
    const profile = await Profile.findOneAndUpdate(
      { channelId },
      { $unset: { [field]: '' }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean();
    return profile;
  } catch {
    return null;
  }
}

/**
 * 프로필 전체 삭제
 */
export async function clearProfile(channelId) {
  if (!connected) return;
  try {
    await Profile.deleteOne({ channelId });
  } catch {}
}

/**
 * 프로필을 시스템 프롬프트 형식으로 변환
 */
export function profileToPrompt(profile) {
  if (!profile) return null;

  const labels = {
    name: '이름',
    age: '나이',
    personality: '성격',
    tone: '말투',
    likes: '좋아하는 것',
    hates: '싫어하는 것',
    setting: '설정',
  };

  const lines = ['[캐릭터 프로필]'];
  for (const field of VALID_FIELDS) {
    if (profile[field]) {
      lines.push(`${labels[field]}: ${profile[field]}`);
    }
  }

  return lines.length > 1 ? lines.join('\n') : null;
}
