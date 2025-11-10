import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Skip authentication in development
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      throw new Error('API_KEY environment variable is not configured');
    }

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private extractApiKey(request: FastifyRequest): string | undefined {
    const apiKeyHeader = request.headers['x-api-key'];
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
      return apiKey.trim();
    }

    const authHeader = request.headers['authorization'];
    const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (typeof authValue === 'string' && authValue.startsWith('Bearer ')) {
      return authValue.slice(7).trim();
    }

    return undefined;
  }
}
