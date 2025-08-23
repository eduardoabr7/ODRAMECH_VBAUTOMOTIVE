import { Injectable, LoggerService } from '@nestjs/common';
import chalk from 'chalk';

// passar o contexto com logger.setContextModule(AuthController.name)

export type ConfigLogger = {
    module: string,
    date: string,
    type: 'LOG' | 'ERROR' | 'WARN' | 'DEBUG' | 'VERBOSE'
    message: string
}

@Injectable()
export class CustomLogger implements LoggerService {

  constructor() {}

  private context;

  log(message: string, colorHex?: string) {

    const config : ConfigLogger = {
        module: this.context || 'APP',
        date: this.formatTimestamp(new Date()),
        type: 'LOG',
        message: message
    }

    console.log(chalk.hex( colorHex || '#29e5e7')(`[${config.module}]`, config.date, config.type+':', config.message));
  }

  error(message: string) {

    const config : ConfigLogger = {
        module: this.context || 'APP',
        date: this.formatTimestamp(new Date()),
        type: 'ERROR',
        message: message
    }

    console.log(chalk.bold.hex('#ff0000')(`[${config.module}]`, config.date, config.type, config.message));
  }

  warn(message: string) {

    const config : ConfigLogger = {
        module: this.context || 'APP',
        date: this.formatTimestamp(new Date()),
        type: 'WARN',
        message: message
    }

    console.log(chalk.bold.hex('#fff800')(`[${config.module}]`, config.date, config.type, config.message));
  }

  setContextModule(context: string): void {
    this.context = context;
  }

  formatTimestamp(date: Date): string {
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    
    return `${year}/${month}/${day}, ${seconds}:${minutes}:${hours}`;
  }
}

export interface LoggerConfiguration {
    
}