import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BronzeController } from './bronze.controller.js';
import { BronzeService } from './bronze.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([])],  // allows InjectDataSource in this module
  controllers: [BronzeController],
  providers: [BronzeService],
  exports: [BronzeService],
})
export class BronzeModule {}
