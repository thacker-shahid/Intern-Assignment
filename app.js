require('dotenv').config();
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const Speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');
const methodOverride = require('method-override')


const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname, + '/public'))
app.use(methodOverride('_method'))


// Using and setting express-session npm package
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  maxAge: 3600000
  // cookie: { secure: true }
}));

// Initializing passport npm package.
app.use(passport.initialize());

// Adding session using passport.
app.use(passport.session());


// Connecting with mongoDB.
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});


// Creating New User Registration Schema.
let registerSchema = new mongoose.Schema({

  username: {
    type: String,
    unique: true,
    trim: true,
    required: true
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    required: true
  },

  password: {
    type: String
    // required: true
  },
  type: {
    type: String,
    required: true
  }

});


// Adding New Product Schema.
let newProduct = new mongoose.Schema({

  productName: {
    type: String,
    trim: true,
    unique: true,
    required: true
  },
  productPrice: {
    type: Number,
    trim: true,
    unique: true,
    required: true
  },

  productDescription: {
    type: String,
    required: true
  }

});





// Using passport-local-mongoose package as a plugin for our schema
registerSchema.plugin(passportLocalMongoose);

// Creating new user register model or Table.
let register_table = new mongoose.model('signuptables', registerSchema);

// Creating Products details Table.
let product_detail_table = new mongoose.model('productdetailtables', newProduct);

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(register_table.createStrategy());

// Use static serialize and deserialize of model for passport session support
passport.serializeUser(register_table.serializeUser());
passport.deserializeUser(register_table.deserializeUser());



//////////////////////// Delete Route ////////////////////////////


// Delete Products Route
app.delete('/delete/:id', async (req, res) => {

  if (req.isAuthenticated()) {
    await product_detail_table.deleteOne({ _id: req.params.id })
    res.redirect('/')
  } else {
    res.redirect('/login');
  }

});



///////////////////////// Get Routes ////////////////////////

// GET Route for Home to render all the posts
app.get('/', (req, res) => {

  product_detail_table.find({}).exec(function (err, response) {
    if (err) throw err;
  res.render('index', {
    list_of_products: response,
    "user": req.user
  });
  });

});


app.get('/add-products', (req, res) => {
  res.render('add-products', {
    "user": req.user
  });
});



app.get('/update-product/:id', (req, res) => {

  let id = req.params.id;

  if (req.isAuthenticated() && req.user.type == "admin") {
    res.render('update-product', {
      "user": req.user,
      "id": id 
    });
  } else {
    res.redirect('/login');
  }
  
});



// GET Route for Login User
app.get('/login', (req, res) => {
  res.render('login', {
    "user": req.user
  });
});



// GET Route for Registering new user
app.get('/register', (req, res) => {
  res.render('register', {
    "user": req.user
    // "otpAuthenticated": false
  });
});



// GET Route for Logout
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});



// GET Route for verify OTP
app.get('/verifyOTP', (req, res) => {
  res.render('otpAuthentication', {
    "user": req.user
  });
});



// GET Route for final otp authentication page
app.get('/otpAuthentication', (req, res) => {
  res.render('otpAuthentication', {
    "user": req.user
  });
});


// GET Route for forgot Password page
app.get('/forgotPassword', (req, res) => {
  res.render('forgotPassword', {
    "user": req.user
  });
});



// GET Route for forgot Password OTP Verification page
app.get('/frogotPasswordOTPVerification', (req, res) => {
  res.render('frogotPasswordOTPVerification', {
    "user": req.user
  });
});



// GET Route for Enter New Password page
app.get('/enterNewPasswordPage', (req, res) => {
  res.render('enterNewPasswordPage', {
    "user": req.user
  });
});




////////////////// POST Routes ///////////////////

// POST Route for Compose
app.post('/add-products', (req, res) => {

  let product = {
    productName: req.body.productName,
    productPrice: req.body.productPrice,
    productDescription: req.body.productDescription
  }

  product_detail_table.create(product, (err) => {
    if (err)
      console.log(err)
    else
      console.log("Product inserted successfully !!")
  });
  res.redirect('/');

});





// POST Route for Login
app.post('/login', (req, res) => {

  if (req.body.username == "" || req.body.usernameEmail == "" || req.body.usernameEmail == "" || req.body.password == "") {
    res.redirect('/login');
  } else {

    let user = new register_table({
      username: req.body.username,
      email: req.body.usernameEmail,
      type: req.body.userType,
      password: req.body.password
    });

console.log(user);

    req.login(user, (err) => {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate('local')(req, res, function () {
          console.log("User Logged in successfull");
          // res.redirect(req.get('referer'));
          res.redirect("/");
        });
      }
    });
  }

});




// POST Route for OTP Generater Form
app.post("/register", (request, response, next) => {

  if (request.body.username == "" || request.body.usernameEmail == "" || request.body.password == "") {
    response.redirect('/register');
  } else {

    // secret key of length 20 generator
    let secret = Speakeasy.generateSecret({ length: 20 });
    totp_secret = secret.base32;


    // 6 digit OTP generator with time limit 5 min
    let totp_generator = {

      "token": Speakeasy.totp({
        secret: totp_secret,
        encoding: "base32"
      }),

      "remaining": (300 - Math.floor((new Date()).getTime() / 1000.0 % 300))
    };

    // Transporter mail setup
    let transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.USER_MAIL,
        pass: process.env.USER_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });


    // Recievers mail setup
    let receivers = ["tauheedshahid@gmail.com", request.body.usernameEmail];
    receivers.forEach((receiver) => {

      let mailOptions = {
        from: request.body.usernameEmail,
        to: receiver,
        subject: 'OTP for signUp at Antino Labs',
        text: "Hello, " + request.body.username + " Your OTP for email verification is: \n\n" + totp_generator.token
      };


      // Sending mail to all the recievers
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      });

    });

    const user_Details = {
      username: request.body.username,
      email: request.body.usernameEmail,
      password: request.body.password,
      six_digit_otp: totp_generator.token
    }

    response.render('otpAuthentication', {
      "user": request.user,
      "userDetails": user_Details
    });
  }

});





// POST Route for Verify OTP
app.post('/verifyOTP', (req, res) => {

  let six_digit_otp = req.query.six_digit_otp;

  if (six_digit_otp === req.body.sixDigitOTP) {

    register_table.register({

      username: req.query.username,
      email: req.query.email,
      type: "user"

    }, req.query.password, (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect("/");
        });
      }
    });

  } else {
    res.redirect('/register');
  }
});



app.post('/update-product', (req, res) => {

  let update_product = {
    prodctName: req.body.prodctName,
    productPrice: req.body.productPrice,
    productDescription: req.body.productDescription
  }

  product_detail_table.updateOne({ _id: req.query.id }, update_product, (err) => {
    if (err)
      console.log(err)
    else
      console.log(" Updated successfully !!")
  });
  res.redirect('/');

});



app.post('/search', (req, res)=>{

  let id = req.body.productID;

  product_detail_table.find({_id: id}, (err, data)=>{
    if(err)
      console.log(err)
    else

    // console.log(data);
      res.render('index', {
        list_of_products: data,
        user: req.user
      })
  })

});



// POST Route for forgot password OTP Generater Form
app.post("/forgotPassword", (request, response) => {

  // secret key of length 20 generator
  let secret = Speakeasy.generateSecret({ length: 20 });
  totp_secret = secret.base32;


  // 6 digit OTP generator with time limit 30 sec
  let totp_generator = {

    "token": Speakeasy.totp({
      secret: totp_secret,
      encoding: "base32"
    }),

    "remaining": (300 - Math.floor((new Date()).getTime() / 1000.0 % 300))
  };

  // Transporter mail setup
  let transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.USER_MAIL,
      pass: process.env.USER_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });


  // Recievers mail setup
  let receivers = ["tauheedshahid@gmail.com", request.body.forgotPasswordEmail];
  receivers.forEach((receiver) => {

    let mailOptions = {
      from: request.body.forgotPasswordEmail,
      to: receiver,
      subject: 'OTP for Re-set Password',
      text: "Hello, OTP for resetting your forgot password is: \n\n" + totp_generator.token
    };


    // Sending mail to all the recievers
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log('Message sent: %s', info.messageId);
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    });

  });

  console.log(totp_generator.token);
  console.log("forgotPassword page: " + request.body.forgotPasswordEmail);
  response.render('frogotPasswordOTPVerification', {
    "email": request.body.forgotPasswordEmail,
    "user": request.user,
    "six_digit_otp": totp_generator.token
  });

});





// POST Route for Verify OTP for Forgot Password
app.post('/frogotPasswordOTPVerification', (req, res) => {

  let six_digit_otp = req.query.six_digit_otp;
  let forgotpasswordUserEmail = req.query.email;
  console.log("frogotPasswordOTPVerification page: " + forgotpasswordUserEmail);
  if (six_digit_otp === req.body.sixDigitforgotPasswordOTP) {

    res.render('enterNewPasswordPage', {
      forgotpasswordUserEmail: forgotpasswordUserEmail
    });

  } else {
    res.redirect('/frogotPasswordOTPVerification');
  }
});




// POST Route for entering new Password and Re-entering new Password
app.post('/enterNewPasswordPage', (req, res) => {

  let newPassword = req.body.newPassword;
  let Re_enterNewPassword = req.body.Re_enterNewPassword;
  console.log("enterNewPasswordPage page: " + req.query.email);


  if (newPassword != Re_enterNewPassword) {
    res.redirect('/enterNewPasswordPage');
  } else {

    register_table.findOne({ email: req.query.email }, (err, user) => {
      if (err)
        throw err;
      else {
        user.setPassword(newPassword, (err, u) => {
          if (err)
            console.log(err)
          else
            u.save();
          // console.log("Forgotten Password Reset successfully !!")
        });
      }
    })
    res.redirect('/');
  }
});



// Server Listening
let PORT = process.env.PORT || 6787;

app.listen(PORT, () => {
  console.log('server started at port 6787');
});