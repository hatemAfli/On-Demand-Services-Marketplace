import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, _res: Response, next: NextFunction) {
    this.logger.log(`${req.method} ${req.url}`);
    next();
  }
}
