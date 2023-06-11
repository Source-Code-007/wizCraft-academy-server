require("dotenv").config();
const express = require('express')
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
const jwtVerifyF = require('./middleware/jwtVerify')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SK)
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
    const usersCollection = wizcraft_DB.collection('usersCollection')
    const classCollection = wizcraft_DB.collection('classCollection')
    const selectedClassesCollection = wizcraft_DB.collection('selectedClassesCollection')
    const paymentCollection = wizcraft_DB.collection('paymentCollection')
    const enrolledClassesCollection = wizcraft_DB.collection('enrolledClassesCollection')


    // common route
    app.get('/approved-classes', async (req, res) => {
      const find = { status: 'approved' }
      const result = await classCollection.find(find).toArray()
      res.send(result)
    })

    // users management ***
    app.post('/users', async (req, res) => {
      const { user } = req.body
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })
    app.get('/all-users', async (req, res) => {
      const result = await usersCollection.find({}).toArray()
      res.send(result)
    })

    app.post('/selected-classes', async (req, res) => {
      const { email } = req.query
      let selectedClass = req.body
      const classId = selectedClass._id
      delete selectedClass._id
      selectedClass = { ...selectedClass, classId }

      const find = { classId: selectedClass?.classId }
      const existingClass = await selectedClassesCollection.findOne(find)

      if (existingClass) {
        const updatedDoc = {
          $set: {
            ...existingClass, selectBy: [...existingClass.selectBy, email]
          }
        }
        const result = await selectedClassesCollection.updateOne(find, updatedDoc)
        return res.send(result)
      }

      selectedClass.selectBy = [email]
      console.log(selectedClass);
      const result = await selectedClassesCollection.insertOne(selectedClass)
      res.send(result)
    })

    app.get('/all-selected-classes', async (req, res) => {
      const result = await selectedClassesCollection.find().toArray()
      res.send(result)
    })

    // Get specific user selected classes via email
    app.get('/my-selected-classes', async (req, res) => {
      const { email } = req.query
      if (!email) {
        return res.send({ message: 'You must provide email query' })
      }

      const find = { selectBy: email }
      const result = await selectedClassesCollection.find(find).toArray()
      res.send(result)
    })

    // Remove specific selected classes via email and id
     app.delete('/delete-my-selected-classes', async (req, res) => {
      const { email } = req.query
      const { id } = req.query

      if (!email || !id) {
        return res.send({ message: 'You must provide email and class id' })
      }

      const result = await selectedClassesCollection.updateOne(
        { classId: id },
        { $pull: { selectBy: email } }

      )

      res.send(result)
    })

    // add enrolled classes
    app.post('/enrolled-classes', async(req, res)=>{
      const {enrolledClass} = req.body
      // const selectedClassId = enrolledClass._id //TODO: If need selected id
      delete enrolledClass._id
      delete enrolledClass.selectBy
      delete enrolledClass.availableSeats

      const result = await enrolledClassesCollection.insertOne(enrolledClass)
      res.send(result)

    })

    // get my enrolled classes
    app.get('/my-enrolled-classes', async(req, res)=>{
      const {email} = req.query
      const find = {enrolledBy: email}
      const result = await enrolledClassesCollection.find(find).toArray()
      res.send(result)
    })


    // after enrolled student reduce availableSeats from class
    app.patch('/reduce-available-seat-from-class', async(req, res)=>{
      const {classId} = req.body
      const find = {_id: new ObjectId(classId)}
      const classP = await classCollection.findOne(find)

      if(!(classP?.availableSeats>0)){
        return res.send({foo: 'bar'})
      }

        classP.availableSeats-=1
        const updatedClass = {
          $set:{
            availableSeats: classP.availableSeats
          }
        }
        const result = await classCollection.updateOne(find, updatedClass)
        res.send(result)

    })



    // instructor management management ***
    app.post('/instructor/add-class', async (req, res) => {
      const { myClass } = req.body
      const result = await classCollection.insertOne(myClass)
      res.send(result)
    })

    app.get('/instructor/my-classes', jwtVerifyF, async (req, res) => {
      const { email } = req.query
      const find = { instructorEmail: email }
      const result = await classCollection.find(find).toArray()
      res.send(result)
    })

    app.get('/all-instructors', async (req, res) => {
      const find = { role: 'instructor' }
      const result = await usersCollection.find(find).toArray()
      res.send(result)
    })


    // admin management ***
    app.patch(`/admin/class-status-manage/:id`, async (req, res) => {
      const { status } = req.body
      const id = req.params.id
      const find = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status
        }
      }
      const result = await classCollection.updateOne(find, updatedDoc)
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
      const result = await classCollection.updateOne(find, updatedDoc, options)
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

      const result = await usersCollection.updateOne(find, updatedDoc)
      res.send(result)

    })

    // for manage classes by admin
    app.get('/all-classes', jwtVerifyF, async (req, res) => {
      const result = await classCollection.find({}).toArray()
      res.send(result)
    })


    // utilites ***
    app.get('/get-role', async (req, res) => {
      const { email } = req.query
      if (!email) {
        return res.send({ error: 'You must provide email query!' })
      }

      const result = await usersCollection.findOne({ email })
      res.send({ role: result?.role })
    })

    // security mechanism ***
    app.post('/create-jwt', async (req, res) => {
      const { email } = req.body
      const result = jwt.sign({ email }, process.env.JWT_TOKEN)
      res.send(result)
    })



    // payment related (stripe) ***
    // for create intent  
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseFloat(price) * 100,
        currency: 'usd',
        payment_method_types: ['card'],
      })
      res.send({ clientSecret: paymentIntent.client_secret });
    })

    // store payment info
    app.post('/store-payment-info', async(req, res)=>{
      const paymentInfo = req.body 
      const result = await paymentCollection.insertOne(paymentInfo) 
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