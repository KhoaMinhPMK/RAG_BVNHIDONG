import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Log format without colors for file output
const fileLogFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Ghi file log theo cwd; trên Vercel filesystem hàm thường read-only → chỉ console.
const logsDir = path.join(process.cwd(), 'logs');
const onVercel = process.env.VERCEL === '1';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(colorize(), logFormat),
  }),
];

if (!onVercel) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'server.log'),
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fileLogFormat),
      maxsize: 10485760,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fileLogFormat),
      maxsize: 10485760,
      maxFiles: 5,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports,
});
