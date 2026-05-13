import { PrismaClient } from "@prisma/client"
import { ENV } from "../utils/env"

const global_for_prisma = globalThis as unknown as { __prisma?: PrismaClient }

export const prisma = global_for_prisma.__prisma ?? new PrismaClient()

if (ENV.NODE_ENV !== "production") {
  global_for_prisma.__prisma = prisma
}

export default prisma
