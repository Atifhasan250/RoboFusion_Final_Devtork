import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().trim().min(1),
  MONGODB_DB: z.string().trim().min(1).default("robofusion"),
  DEVICE_BASE_URL: z.url().default("http://192.168.4.1"),
  DEVICE_ADAPTER: z.enum(["real", "mock"]).default("real"),
  DEVICE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse(process.env);
  }
  return cachedEnv;
}
