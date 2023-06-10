require("dotenv").config();
const express = require('express')
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
const jwtVerifyF = require('./middleware/jwtVerify')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.port || 3000

app.use(cors())
app.use(express.json())


app.get('/', (req, res) => {
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
    const classCollecion = wizcraft_DB.collection('classCollection')
    const selectedClassesCollecion = wizcraft_DB.collection('selectedClassesCollecion')


    // common route
    app.get('/approved-classes', async (req, res) => {
      const find = { status: 'approved' }
      const result = await classCollecion.find(find).toArray()
      res.send(result)
    })

    // users management
    app.post('/users', async (req, res) => {
      const { user } = req.body
      const result = await usersCollecion.insertOne(user)
      res.send(result)
    })
    app.get('/all-users', async (req, res) => {
      const result = await usersCollecion.find({}).toArray()
      res.send(result)
    })

    app.post('/selected-classes', async (req, res) => {
      const { email } = req.query
      let selectedClass = req.body
      const classId = selectedClass._id
      delete selectedClass._id
      selectedClass = { ...selectedClass, classId }

      const find = { classId: selectedClass.classId }
      const existingClass = await selectedClassesCollecion.findOne(find)

      if (existingClass) {
        // const selectBy = [...existingClass.selectBy, email]
        // console.log(73, selectBy);
        console.log(existingClass.selectBy);
        const updatedDoc = {
          $set: {
            ...existingClass, selectBy: [...existingClass.selectBy, email]
          }
        }
        const result = await selectedClassesCollecion.updateOne(find, updatedDoc)
        return res.send(result)
      }

      selectedClass.selectBy = [email]
      console.log(selectedClass);
      const result = await selectedClassesCollecion.insertOne(selectedClass)
      res.send(result)
    })


    // instructor management management
    app.post('/instructor/add-class', async (req, res) => {
      const { myClass } = req.body
      const result = await classCollecion.insertOne(myClass)
      res.send(result)
    })

    app.get('/instructor/my-classes', jwtVerifyF, async (req, res) => {
      const { email } = req.query
      const find = { instructorEmail: email }
      const result = await classCollecion.find(find).toArray()
      res.send(result)
    })

    app.get('/all-instructors', async (req, res) => {
      const find = { role: 'instructor' }
      const result = await usersCollecion.find(find).toArray()
      res.send(result)
    })


    // admin management
    app.patch(`/admin/class-status-manage/:id`, async (req, res) => {
      const { status } = req.body
      const id = req.params.id
      const find = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status
        }
      }
      const result = await classCollecion.updateOne(find, updatedDoc)
      res.send(result)
    })

    app.put('/admin/add-feedback/:id', async (req, res) => {
      const { feedback } = req.body
      const id = req.params.id
      const find = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedDoc = {
        $set: {
          feedback
        }
      }
      const result = await classCollecion.updateOne(find, updatedDoc, options)
      res.send(result)
    })

    app.patch(`/admin/make-role/:id`, async (req, res) => {
      const id = req.params.id
      const { updatedRole } = req.body
      const find = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: updatedRole
        }
      }

      const result = await usersCollecion.updateOne(find, updatedDoc)
      res.send(result)

    })

    // for manage classes by admin
    app.get('/all-classes', jwtVerifyF, async (req, res) => {
      const result = await classCollecion.find({}).toArray()
      res.send(result)
    })


    // utilites
    app.get('/get-role', async (req, res) => {
      const { email } = req.query
      if (!email) {
        return res.send({ error: 'You must provide email query!' })
      }

      const result = await usersCollecion.findOne({ email })
      res.send({ role: result?.role })
    })

    // security mechanism
    app.post('/create-jwt', async (req, res) => {
      const { email } = req.body
      const result = jwt.sign({ email }, process.env.JWT_TOKEN)
      res.send(result)
    })

    app.get('/test-jwt', jwtVerifyF, (req, res) => {
      res.send({ test: 'done' })
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log('wizcraft server is running!');
})