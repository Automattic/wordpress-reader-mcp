import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'mcp-server.log');

export function log(message: string, level: 'info' | 'error' | 'debug' = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}\n`;
  
  try {
    // Write to file instead of console to avoid interfering with MCP protocol
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    // Silently fail if we can't write to log file
  }
}

export function logError(message: string, error?: any) {
  let errorDetails = '';
  if (error) {
    errorDetails = error instanceof Error ? error.message : String(error);
  }
  log(`${message}${errorDetails ? ': ' + errorDetails : ''}`, 'error');
}

export function logDebug(message: string) {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    log(message, 'debug');
  }
}