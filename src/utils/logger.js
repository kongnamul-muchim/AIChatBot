const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

export const logger = {
  info: (msg) => console.log(`[${timestamp()}] ${colors.blue}INFO${colors.reset}  ${msg}`),
  warn: (msg) => console.log(`[${timestamp()}] ${colors.yellow}WARN${colors.reset}  ${msg}`),
  error: (msg) => console.log(`[${timestamp()}] ${colors.red}ERROR${colors.reset} ${msg}`),
  success: (msg) => console.log(`[${timestamp()}] ${colors.green}OK${colors.reset}     ${msg}`),
  chat: (user, channel, msg) =>
    console.log(`[${timestamp()}] ${colors.magenta}CHAT${colors.reset} [${channel}] ${user}: ${msg}`),
  ai: (model, msg) =>
    console.log(`[${timestamp()}] ${colors.cyan}AI${colors.reset}    [${model}] ${msg}`),
};
