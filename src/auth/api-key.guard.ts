import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

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

  private extractApiKey(request: any): string | undefined {
    return request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');
  }
}