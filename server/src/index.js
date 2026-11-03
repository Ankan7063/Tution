import { createApp } from './app.js';
import { config } from './config.js';
import { connectDatabase } from './models/index.js';

await connectDatabase();

const app = createApp();

app.listen(config.port, () => {
  console.log(`Tuition Center API running on http://localhost:${config.port}`);
});
