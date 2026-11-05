import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'freelancer' | 'company'; displayName: string };
      sessionHash?: string;
    }
  }
}
