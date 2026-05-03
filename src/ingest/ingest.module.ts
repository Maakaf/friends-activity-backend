import { Module } from '@nestjs/common';
import { GraphqlIngestService } from './graphql-ingest.service.js';

@Module({
  providers: [GraphqlIngestService],
  exports: [GraphqlIngestService],
})
export class IngestModule {}
