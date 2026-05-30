import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
