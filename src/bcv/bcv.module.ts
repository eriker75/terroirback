import { Module } from '@nestjs/common';
import { BcvService } from './bcv.service';
import { BcvController } from './bcv.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [BcvController],
  providers: [BcvService],
  exports: [BcvService],
})
export class BcvModule {}
