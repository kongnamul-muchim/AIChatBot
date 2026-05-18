import 'dotenv/config';
import { createBot } from './src/bot.js';

// 토큰 체크
const token = process.env.DISCORD_TOKEN;
if (!token || token === '여기에_디스코드_봇_토큰을_넣으세요') {
  console.error('[ERROR] DISCORD_TOKEN이 설정되지 않았습니다.');
  console.error('  → .env 파일을 확인하고 토큰을 입력해주세요.');
  console.error('  → .env.template을 복사해서 .env로 만드세요.');
  process.exit(1);
}

// 봇 실행
createBot(token);
