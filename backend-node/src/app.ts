import express, { type Express } from 'express';

// Tách việc tạo app khỏi việc listen port để test (Supertest) dùng app trực tiếp, không cần mở port thật.
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  return app;
}
