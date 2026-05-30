import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [FilesController],
})
export class FilesModule {}
