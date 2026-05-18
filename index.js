import 'dotenv/config';
import { createBot } from './src/bot.js';
import { connectDB } from './src/store/database.js';
import { sessionStore } from './src/store/sessions.js';
import { logger } from './src/utils/logger.js';

// 토큰 체크
const token = process.env.DISCORD_TOKEN;
if (!token || token === '여기에_디스코드_봇_토큰을_넣으세요') {
  console.error('[ERROR] DISCORD_TOKEN이 설정되지 않았습니다.');
  console.error('  → .env 파일을 확인하고 토큰을 입력해주세요.');
  process.exit(1);
}

// MongoDB 연결 (선택)
const dbConnected = await connectDB();
if (dbConnected) {
  logger.success('영구 기억 시스템 활성화됨! 🧠');

  // 저장량 확인
  const { getStorageStats, cleanupOldMessages } = await import('./src/store/database.js');
  const stats = await getStorageStats();
  if (stats) {
    const usedMB = parseFloat(stats.totalSizeMB);
    const pct = ((usedMB / stats.limit) * 100).toFixed(1);
    logger.info(`📦 저장소: ${stats.totalMessages}개 메시지 / ${stats.totalSizeMB}MB 사용 (${pct}%)`);
    if (pct > 80) {
      logger.warn(`⚠️ 저장소가 ${pct}% 찼습니다. 오래된 대화를 정리합니다...`);
      const cleaned = await cleanupOldMessages(60);
      logger.info(`정리 완료: ${cleaned}개 메시지 삭제됨`);
    }
  }

  logger.info('모든 대화가 MongoDB에 저장됩니다.');
} else {
  logger.info('메모리 모드로 동작합니다. (MongoDB 없음)');
}

// 세션 스토어 초기화
await sessionStore.init();

// 봇 실행
createBot(token);
