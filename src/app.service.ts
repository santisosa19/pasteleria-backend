import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      name: 'pasteleria-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
