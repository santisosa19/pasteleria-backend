import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

type LoginRateLimitRequest = {
  body?: {
    username?: unknown;
  };
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const maxAttempts = 5;
const windowMs = 60 * 1000;
const attempts = new Map<string, AttemptWindow>();

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<LoginRateLimitRequest>();
    const key = this.getKey(request);
    const now = Date.now();
    const current = attempts.get(key);

    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      this.cleanup(now);
      return true;
    }

    if (current.count >= maxAttempts) {
      throw new HttpException(
        'Demasiados intentos de inicio de sesion. Intenta nuevamente en un minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    attempts.set(key, current);

    return true;
  }

  private getKey(request: LoginRateLimitRequest) {
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const username =
      typeof request.body?.username === 'string'
        ? request.body.username.trim().toLowerCase()
        : 'unknown';

    return `${ip}:${username}`;
  }

  private cleanup(now: number) {
    for (const [key, attemptWindow] of attempts.entries()) {
      if (attemptWindow.resetAt <= now) {
        attempts.delete(key);
      }
    }
  }
}
