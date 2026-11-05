import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { buildLoggerParams } from './logging/logger.options.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => buildLoggerParams(env),
    }),
    HealthModule,
  ],
})
export class AppModule {}
