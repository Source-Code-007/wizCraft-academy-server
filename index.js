const express = require('express')
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config();
const port = process.env.port || 3000

app.use(cors())
app.use(express.json())


app.get('/', (req, res)=>{
    res.send('wizcraft server perfectly responses!')
})


const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@cluster0.iw4kl2c.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const wizcraft_DB = client.db('wizcraft_db')
    const usersCollecion = wizcraft_DB.collection('usersCollection')

    // users management
    app.post('/users', async(req, res)=>{
        const {user} = req.body
        console.log(user);
        const result = await usersCollecion.insertOne(user)
        res.send(result)
    })
    app.get('/users', async(req, res)=>{
        const result = await usersCollecion.find({}).toArray()
        res.send(result)
    })

    // admin management


    // utilites
    app.get('/users-role', async(req, res)=>{
      if(!req.query){
        return res.send({error: 'You must provide email query!'})
      }

      const {email} = req.query

      const result = await usersCollecion.findOne({email})
      res.send({role:result.role})
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, ()=>{
    console.log('wizcraft server is running!');
})