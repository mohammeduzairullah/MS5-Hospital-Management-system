import "dotenv/config";
import { MongoClient, BSON } from "mongodb";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const mode = process.argv[2];
if (!["backup", "restore"].includes(mode))
  throw new Error("Use backup or restore");
const uri =
  mode === "backup"
    ? process.env.SOURCE_MONGODB_URI ||
      (await readFile(".local/database-uri", "utf8")).trim()
    : process.env.ATLAS_MONGODB_URI;
if (!uri)
  throw new Error("Set ATLAS_MONGODB_URI in private .env before restoring");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
const names = ["users", "doctors", "patients", "appointments", "prescriptions"];
const file = ".local/careflow-backup.ejson";
try {
  await client.connect();
  const db = client.db();
  if (mode === "backup") {
    const collections = {};
    for (const name of names)
      collections[name] = {
        documents: await db.collection(name).find({}).toArray(),
        indexes: await db.collection(name).listIndexes().toArray(),
      };
    await mkdir(".local", { recursive: true });
    await writeFile(
      file,
      BSON.EJSON.stringify(
        { createdAt: new Date(), collections },
        { relaxed: false },
      ),
      { flag: "wx" },
    );
    for (const [name, data] of Object.entries(collections))
      console.log(`${name}: ${data.documents.length} backed up`);
  } else {
    const backup = BSON.EJSON.parse(await readFile(file, "utf8"), {
      relaxed: false,
    });
    if (!backup.collections.users?.documents.length)
      throw new Error("No accounts in backup");
    if ((await db.listCollections({}, { nameOnly: true }).toArray()).length)
      throw new Error(
        "Target database must be entirely empty; refusing overwrite",
      );
    for (const name of names) {
      const { documents, indexes } = backup.collections[name];
      await db.createCollection(name);
      if (documents.length) await db.collection(name).insertMany(documents);
      for (const index of indexes.filter((i) => i.name !== "_id_")) {
        const { key, v, ns, ...options } = index;
        await db.collection(name).createIndex(key, options);
      }
      const count = await db.collection(name).countDocuments();
      if (count !== documents.length)
        throw new Error(`Count mismatch: ${name}`);
      console.log(`${name}: ${count} restored and verified`);
    }
  }
} finally {
  await client.close();
}
