require("dotenv").config({ path: "./.env.local" });
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
// 2. Read the URI from the environment variables (process.env)
const uri = process.env.MONGODB_URI;

// Check if URI is loaded (a good practice)
if (!uri) {
  console.error(
    "❌ MONGODB_URI not found in environment variables. Check your .env file!"
  );
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToMongoDB() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB: Ping successful. Connected to the database!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

const db = client.db("freelio");
const usersCollection = db.collection("job");

app.get("/alljobs", (req, res) => {
  
  res.send(usersCollection.find().toArray());

});

connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Express server listening on port ${port}`);
  });
});
