import { config } from '../config';
import { HealthResponse } from '../types';

export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: config.serviceName,
      version: config.version
    };
  }
}

export const healthService = new HealthService();
