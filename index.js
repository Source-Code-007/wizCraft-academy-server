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
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const wizcraft_DB = client.db('wizcraft_db')
    const usersCollection = wizcraft_DB.collection('usersCollection')
    const classCollection = wizcraft_DB.collection('classCollection')
    const selectedClassesCollection = wizcraft_DB.collection('selectedClassesCollection')
    const paymentCollection = wizcraft_DB.collection('paymentCollection')
    const enrolledClassesCollection = wizcraft_DB.collection('enrolledClassesCollection')
    const testimonialCollection = wizcraft_DB.collection('testimonialCollection')
    const newsCollection = wizcraft_DB.collection('newsCollection')


    // common route ***
    app.get('/approved-classes', async (req, res) => {
      const find = { status: 'approved' }
      const result = await classCollection.find(find).toArray()
      res.send(result)
    })

    // popular six class
    app.get('/popular-classes', async (req, res) => {
      const result = await classCollection.find().sort({ enrolledStudent: -1 }).limit(6).toArray()
      res.send(result);
    })

    // popular six instructor
    app.get('/popular-instructors', async (req, res) => {
      const result = await usersCollection.find({ role: 'instructor' }).sort({ enrolledStudent: -1 }).limit(6).toArray()
      res.send(result)
    })

    // get testimonials
    app.get('/get-testimonials', async (req, res) => {
      const result = await testimonialCollection.find().toArray()
      res.send(result)
    })

    // get all news 
    app.get('/get-news', async (req, res) => {
      const result = await newsCollection.find().toArray()
      res.send(result)
    })

    // get single news 
    app.get('/get-single-news/:id', async (req, res) => {
      const id = req.params.id
      const result = await newsCollection.findOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    // get recent three news 
    app.get('/get-recent-news', async (req, res) => {
      const result = await newsCollection.find().sort({ newsPublishedDate: -1 }).limit(3).toArray()
      res.send(result)
    })


    // get all classes for a single instructor
    app.get('/get-classes-specific-instructor/:name', async (req, res) => {
      const instructorName = req.params.name
      const find = { instructorName }
      const result = await classCollection.find(find).toArray()
      res.send(result)
    })



    // Dashboard stats
    app.get('/dashboard-stats', async (req, res) => {
      const { role } = req.query
      const { email } = req.query

      if (role === 'student') {
        const totalPayments = await paymentCollection.countDocuments({ email });
        const totalEnrollments = await enrolledClassesCollection.countDocuments({ enrolledBy: email });

        const totalExpenditurePipeline = [
          { $match: { enrolledBy: email } },
          { $group: { _id: null, totalExpenditure: { $sum: "$price" } } }
        ];

        const totalExpenditureResult = await enrolledClassesCollection.aggregate(totalExpenditurePipeline).toArray();
        const totalExpend = totalExpenditureResult.length > 0 ? totalExpenditureResult[0].totalExpenditure : 0;

        // Send the stats as JSON response
        return res.json({
          totalPayments,
          totalEnrollments,
          totalExpend
        });
      }

      else if (role === 'instructor') {

        const query = {
          instructorEmail: email
        };
        const classes = await classCollection.find(query).toArray();
        const totalEnrolledStudents = classes.reduce((acc, classP) => acc + classP?.enrolledStudent, 0)
        const totalEarning = classes.reduce((acc, classP) => (acc + classP?.enrolledStudent * classP?.price), 0)

        const instructors = await usersCollection.find({ role: 'instructor' }).sort({ enrolledStudent: -1 }).toArray()
        const index = instructors.findIndex(instructor => instructor.email === email);

        return res.send({ totalEnrolledStudents, totalEarning, rank: index + 1 });

      }

      else if (role === 'admin') {
        const totalSum = await paymentCollection.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).toArray();
        const totalEarning = totalSum.length ? totalSum[0].total / 100 : 0;

        const totalSt = await classCollection.aggregate([{ $group: { _id: null, totalEnrolledStudents: { $sum: "$enrolledStudent" } } }]).toArray();
        const totalEnrolled = totalSt.length ? totalSt[0].totalEnrolledStudents : 0;

        const totalStudents = await usersCollection.countDocuments({ role: 'student' });

        res.send({ totalEarning, totalStudents, totalEnrolled });
      }

    })


    // users management ***
    app.post('/users', async (req, res) => {
      const { user } = req.body
      const existUser = await usersCollection.findOne({ email: user.email })
      if (existUser) {
        return res.send({ message: 'user already exist' })
      }
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
      const result = await selectedClassesCollection.insertOne(selectedClass)
      res.send(result)
    })

    // add selected classes
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
    app.post('/enrolled-classes', async (req, res) => {
      const { enrolledClass } = req.body
      // const selectedClassId = enrolledClass._id //TODO: If need selected id
      delete enrolledClass._id
      delete enrolledClass.selectBy
      delete enrolledClass.availableSeats

      const result = await enrolledClassesCollection.insertOne(enrolledClass)
      res.send(result)

    })

    // get my enrolled classes
    app.get('/my-enrolled-classes', async (req, res) => {
      const { email } = req.query
      const find = { enrolledBy: email }
      const result = await enrolledClassesCollection.find(find).toArray()
      res.send(result)
    })

    // after enrolled student, reduce availableSeats from class and add enrolledStudent in class and instructor
    app.patch('/reduce-available-seat-and-increase-enrolled-student', async (req, res) => {
      const { classId } = req.body
      const { instructorEmail } = req.body
      const find = { _id: new ObjectId(classId) }
      const classP = await classCollection.findOne(find)

      if (!(classP?.availableSeats > 0)) {
        return res.send({ foo: 'bar' })
      }

      classP.availableSeats -= 1
      classP.enrolledStudent += 1
      const updatedClass = {
        $set: {
          availableSeats: classP.availableSeats, enrolledStudent: classP.enrolledStudent
        }
      }

      // update enrolledStudent in instructor document in usersCollection
      const findInstructor = { email: instructorEmail }
      const instructor = await usersCollection.findOne(findInstructor)
      const options = { upsert: true }
      const updatedInstructor = {
        $set: {
          enrolledStudent: instructor.enrolledStudent ? instructor.enrolledStudent + 1 : 1
        }
      }
      await usersCollection.updateOne(findInstructor, updatedInstructor, options)

      const result = await classCollection.updateOne(find, updatedClass)
      res.send(result)

    })





    // instructor management  ***
    app.post('/instructor/add-class', jwtVerifyF, async (req, res) => {
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

    app.patch('/instructor/update-class/:id', jwtVerifyF, async (req, res) => {
      const id = req.params.id
      const { updatedClass } = req.body
      const find = { _id: new ObjectId(id) }
      const updatedClassP = {
        $set: {
          className: updatedClass.className, price: updatedClass.price, classImg: updatedClass.classImg
        }
      }
      const result = await classCollection.updateOne(find, updatedClassP)
      res.send(result)
    })

    app.get('/get-all-instructors', async (req, res) => {
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

    // make role, if make instructor then a field added named enrolledStudent, initially it's value is 0
    app.patch(`/admin/make-role/:id`, async (req, res) => {
      const id = req.params.id
      const { updatedRole } = req.body
      const find = { _id: new ObjectId(id) }

      if (updatedRole === 'instructor') {
        const updatedDoc = {
          $set: {
            role: updatedRole, enrolledStudent: 0
          }
        }
        const result = await usersCollection.updateOne(find, updatedDoc)
        return res.send(result)
      }

      const updatedDoc = {
        $set: {
          role: updatedRole
        }
      }

      const result = await usersCollection.updateOne(find, updatedDoc)
      res.send(result)

    })

       // Get all classes for manage for admin 
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
    app.post('/store-payment-info', async (req, res) => {
      const paymentInfo = req.body
      const result = await paymentCollection.insertOne(paymentInfo)
      res.send(result)
    })
    // get payment info by email
    app.get('/get-payment-info', async (req, res) => {
      const { email } = req.query
      const result = await paymentCollection.find({ email }).sort({ date: -1 }).toArray()
      res.send(result)
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