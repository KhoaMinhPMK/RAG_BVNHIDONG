import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Create logs directory path (relative to project root)
const logsDir = path.join(__dirname, '..', '..', '..', 'logs');

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console output (with colors)
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    // File output - ALL logs (always enabled, even in development)
    new winston.transports.File({
      filename: path.join(logsDir, 'server.log'),
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileLogFormat
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // File output - ERROR logs only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileLogFormat
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});
