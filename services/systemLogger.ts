
import { LogEntry } from '../types';

type LogListener = (entry: LogEntry) => void;

class SystemLogger {
  private listeners: LogListener[] = [];

  public log(message: string, type: LogEntry['type'] = 'info', source: string = 'System') {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      message,
      type,
      source
    };
    this.listeners.forEach(listener => listener(entry));
  }

  public subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const logger = new SystemLogger();
