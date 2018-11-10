const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortId = require('shortid')
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI,{useMongoClient: true})
const Schema = mongoose.Schema;

const Users = new Schema({
  username: {
    type: String, 
    required: true,
    unique: true,
    maxlength: [20, 'username too long']
  },
  _id: {
    type: String,
    index: true,
    default: shortId.generate
  },
  versionKey: false
});

const Exercises = new Schema({
  description: {
    type: String,
    required: true,
    maxlength: [20, 'description too long']
  },
  duration: {
    type: Number,
    required: true,
    min: [1, 'duration too short']
  },
  date: {
    type: Date,
    default: Date.now()
  },
  username: String,
  userId: {
    type: String,
    ref: 'Users',
    index: true
  },
  versionKey: false
})

const User = mongoose.model('User', Users);
const Exercise = mongoose.model('Exercise', Exercises);

app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get('/api/exercise/users', (req, res, next) => {
  User.find({}, (err, users) => {
    if(err) next(err);
    res.json(users);
  })
})

app.post('/api/exercise/new-user', (req, res, next) => {
  const user = new User(req.body)
  user.save((err, saved) => {
    if(err){
      if(err.code = 11000){
        return next({
          status: 400,
          message: 'Username not available'
        })
      } else {
        return next(err);
      }
    } 
    res.json({
      username: saved.username,
      _id: saved._id
    });
  })
})

app.post('/api/exercise/add', (req, res, next) => {
  User.findById(req.body.userId, (err, user) => {
    if(err) return next(err);
    if(!user){
      return next({
        status: 400,
        message: 'UserId not found'
      })
    }
    const exercise = new Exercise(req.body);
    exercise.username = user.username;
    exercise.save((err, savedExercise) => {
      if(err) return next(err)
      savedExercise = savedExercise.toObject()
      delete savedExercise.__v
      savedExercise._id = savedExercise.userId
      delete savedExercise.userId
      savedExercise.date = (new Date(savedExercise.date)).toDateString()
      res.json(savedExercise)
    })
  })
})

app.get('/api/exercise/log?', (req, res, next) => {
  const from = new Date(req.query.from)
  const to = new Date(req.query.to)
  console.log(req.query.userId)
  User.findById(req.query.userId, (err, user) => {
    if(err) return next(err);
    if(!user) {
      return next({status:400, message: 'unknown userId'})
    }
    console.log(user)
    Exercise.find({
      userId: req.query.userId,
        date: {
          $lt: to != 'Invalid Date' ? to.getTime() : Date.now() ,
          $gt: from != 'Invalid Date' ? from.getTime() : 0
        }
      }, {
        __v: 0,
        _id: 0
      })
    .sort('-date')
    .limit(parseInt(req.query.limit))
    .exec((err, exercises) => {
      if(err) return next(err)
      const out = {
          _id: req.query.userId,
          username: user.username,
          from : from != 'Invalid Date' ? from.toDateString() : undefined,
          to : to != 'Invalid Date' ? to.toDateString(): undefined,
          count: exercises.length,
          log: exercises.map(e => ({
            description : e.description,
            duration : e.duration,
            date: e.date.toDateString()
          })
        )
      }
      res.json(out)
    })
  })
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
