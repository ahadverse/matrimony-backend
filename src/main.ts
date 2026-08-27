import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  const port = config.get<string>('PORT', '4000');
  await app.listen(port);

  console.log(`BiyeKoraLagbe Live API running on http://localhost:${port}`);
}
bootstrap();
