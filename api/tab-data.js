const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable not set');
}
const dbName = 'qcReview';
let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  cachedClient = client;
  return client;
}

module.exports = async function (req, res) {
  const client = await connectToDatabase();
  const db = client.db(dbName);
  const collection = db.collection('tabData');

  if (req.method === 'GET') {
    const { tab } = req.query;
    if (!tab) {
      res.status(400).json({ error: 'Missing tab parameter' });
      return;
    }
    const doc = await collection.findOne({ tab });
    res.status(200).json(doc || { tab, qcers: [], qcTargets: [], assignments: {}, lastAssigned: null });
  } else if (req.method === 'POST') {
    const { tab, qcers, qcTargets, assignments } = req.body;
    if (!tab) {
      res.status(400).json({ error: 'Missing tab in body' });
      return;
    }
    // Only update assignments if provided
    const update = { qcers: qcers || [], qcTargets: qcTargets || [] };
    if (assignments !== undefined) {
      update.assignments = assignments;
      update.lastAssigned = new Date();
    }
    await collection.updateOne(
      { tab },
      { $set: update },
      { upsert: true }
    );
    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 