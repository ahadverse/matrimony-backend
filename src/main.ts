import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: [
      config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
      config.get<string>('ADMIN_URL', 'http://localhost:5173'),
    ],
    credentials: true,
  });

  app.useStaticAssets(
    join(process.cwd(), config.get<string>('UPLOAD_DIR', './uploads')),
    {
      prefix: '/uploads',
    },
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BiyeKoraLagbe API')
    .setDescription('Backend REST API for the BiyeKoraLagbe matrimony platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<string>('PORT', '4000');
  await app.listen(port);

  console.log(
    `BiyeKoraLagbe API running on http://localhost:${port} (docs at /api/docs)`,
  );
}
bootstrap();
