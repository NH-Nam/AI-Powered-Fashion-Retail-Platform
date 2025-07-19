require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI;
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// 1A. config location of routers
//router frontend (user)
var homeRouter = require('./routes/home');
//router backend (admin)
var adminRouter = require('./routes/admin');
var categoryRouter = require('./routes/category');
var productRouter = require('./routes/product');
var uploadRouter = require('./routes/apiUpload');
var userRouter = require('./routes/user');
var orderRouter = require('./routes/order');
var feedRouter = require('./routes/feedback');
var chatRouter = require('./routes/chatbot');


//router auth
var authRouter = require('./routes/auth');

//cấu hình session alert
const session = require('express-session');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. config 'mongoose' module
var mongoose = require('mongoose');
var uri = process.env.MONGODB_URI || "mongodb+srv://long3907:mwTxAR6YzyyxYaIT@demodb.kndwxsk.mongodb.net/ShopToys";
mongoose.set('strictQuery', true); //ignore mongoose warning
mongoose.connect(uri)
    .then(() => console.log('Connect success'))
    .catch(err => console.log('failed connect'));

//3. config 'body-parser' module
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }))

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//su dụng session alert
app.use(session({
    secret: 'long3907', // Thay thế bằng một key bí mật của riêng bạn
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Đặt là 'true' chỉ khi bạn đang sử dụng HTTPS
}));

//1B config route
app.use('/', homeRouter);
app.use('/category', categoryRouter);
app.use('/product', productRouter);
app.use('/user', userRouter);
app.use('/', uploadRouter);
app.use('/', authRouter);
app.use('/', adminRouter);
app.use('/order', orderRouter);
app.use('/feedback', feedRouter);
app.use('/chatbot', chatRouter);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

//4. config port (for cloud deployment)
app.listen(process.env.PORT || 3001);

module.exports = app;