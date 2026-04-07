import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "ai_image_generator";

if (!uri) {
  throw new Error("Missing MONGODB_URI in environment variables.");
}
const mongoUri: string = uri;

type CachedMongo = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

declare global {
  var _mongo: CachedMongo | undefined;
}

const cached: CachedMongo = global._mongo || { client: null, promise: null };

if (!global._mongo) {
  global._mongo = cached;
}

export async function getDb(): Promise<Db> {
  if (cached.client) return cached.client.db(dbName);

  if (!cached.promise) {
    cached.promise = new MongoClient(mongoUri).connect();
  }

  cached.client = await cached.promise;
  return cached.client.db(dbName);
}
