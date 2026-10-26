import { NestFactory } from '@nestjs/core';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ClinicalStudyPB API')
    .setDescription(
      'API REST para autenticação, administração de usuários e gerenciamento de estudos clínicos. ' +
      'As rotas protegidas exigem um token Bearer obtido em POST /auth/login.',
    )
    .setVersion('0.0.1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token emitido por POST /auth/login.' },
      'bearer',
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, openApiDocument);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
