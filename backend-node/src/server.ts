import { createApp } from './app.js';

// Tạm thời: bước 1.9 sẽ thay bằng config đọc từ biến môi trường và validate bằng Zod.
const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

const app = createApp();

app.listen(port, () => {
  console.log(`backend-node listening on http://localhost:${port}`);
});
