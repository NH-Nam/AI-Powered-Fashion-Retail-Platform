var express = require('express');
var router = express.Router();
var CategoryModel = require('../models/CategoryModel');
var ProductModel = require('../models/ProductModel');
var User = require('../models/UserModel');
var Cart = require('../models/CartModel');
var Order = require('../models/OrderModel');
var Feedback = require('../models/FeedbackModel');
var OrderDetail = require('../models/OrderDetailModel');
var Reply = require('../models/ReplyModel');
var Comment = require('../models/CommentModel');
var Favorite = require('../models/FavoriteModel');
const validator = require("validator");
require('dotenv').config();
//token
const jwt = require('jsonwebtoken');
const { user } = require('../middleware/authorize');
var { numberFormat, formatTimeFeedback } = require('../utils/Utility');
var { sendInformationEmail } = require('../utils/Email');

//thu viện gửi mail
const nodemailer = require('nodemailer');

/* GET home page. */
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Số trang hiện tại, mặc định là 1
  const limit = 6; // Số lượng sản phẩm trên mỗi trang
  const skip = (page - 1) * limit; // Số lượng sản phẩm cần bỏ qua
  var token = req.cookies.token;
  try {
    const products = await ProductModel.find({ deleted: 0 }).sort({ updated_at: 'desc' }).skip(skip).limit(limit);
    const totalProducts = await ProductModel.countDocuments({ deleted: 0 });
    const totalPages = Math.ceil(totalProducts / limit);


    var CartNum = 0;
    var userType = 'User';
    if (token != null) {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      userType = decoded.usertype;
      var cart = await Cart.find({ user_id: decoded.userId });
      for (let item of cart) {
        CartNum += item.quantity;
      }
    }

    res.render('frontend/userpage', { title: 'Home', products, page, totalPages, token, CartNum, numberFormat, userType });
  } catch (err) {
    // Xử lý lỗi tại đây
    res.status(500).send(err.message);
  }
});

router.get('/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Số trang hiện tại, mặc định là 1
  const limit = 6; // Số lượng sản phẩm trên mỗi trang
  const skip = (page - 1) * limit; // Số lượng sản phẩm cần bỏ qua
  var token = req.cookies.token;
  try {
    const products = await ProductModel.find({ deleted: 0 }).sort({ updated_at: 'desc' }).skip(skip).limit(limit);
    const totalProducts = await ProductModel.countDocuments({ deleted: 0 });
    const totalPages = Math.ceil(totalProducts / limit);


    var CartNum = 0;
    var userType = 'User';
    if (token != null) {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      userType = decoded.usertype;
      var cart = await Cart.find({ user_id: decoded.userId });
      for (let item of cart) {
        CartNum += item.quantity;
      }
    }

    res.render('frontend/all_product', { title: 'All Products', products, page, totalPages, token, CartNum, numberFormat, userType });
  } catch (err) {
    // Xử lý lỗi tại đây
    res.status(500).send(err.message);
  }
})

router.post('/search', async (req, res) => {
  var search = req.body.keyword;
  const page = parseInt(req.query.page) || 1; // Số trang hiện tại, mặc định là 1
  const limit = 6; // Số lượng sản phẩm trên mỗi trang
  const skip = (page - 1) * limit; // Số lượng sản phẩm cần bỏ qua
  var token = req.cookies.token;
  try {
    const totalProducts = await ProductModel.countDocuments({ deleted: 0 });
    const totalPages = Math.ceil(totalProducts / limit);


    var CartNum = 0;
    var userType = 'User';
    if (token != null) {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      userType = decoded.usertype;
      var cart = await Cart.find({ user_id: decoded.userId });
      for (let item of cart) {
        CartNum += item.quantity;
      }
    }
    var products = await ProductModel.find({ title: new RegExp(search, "i") })
    res.render('frontend/userpage', { title: 'Home', products, page, totalPages, token, CartNum, numberFormat, userType });
  } catch (error) {

  }
})

router.post('/seachProduct', async (req, res) => {
  var search = req.body.search;
  const page = parseInt(req.query.page) || 1; // Số trang hiện tại, mặc định là 1
  const limit = 6; // Số lượng sản phẩm trên mỗi trang
  const skip = (page - 1) * limit; // Số lượng sản phẩm cần bỏ qua
  var token = req.cookies.token;
  try {
    const totalProducts = await ProductModel.countDocuments({ deleted: 0 });
    const totalPages = Math.ceil(totalProducts / limit);


    var CartNum = 0;
    var userType = 'User';
    if (token != null) {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      userType = decoded.usertype;
      var cart = await Cart.find({ user_id: decoded.userId });
      for (let item of cart) {
        CartNum += item.quantity;
      }
    }
    var products = await ProductModel.find({ title: new RegExp(search, "i") })
    res.render('frontend/all_product', { title: 'All Products', products, page, totalPages, token, CartNum, numberFormat, userType });
  } catch (err) {
    // Xử lý lỗi tại đây
    res.status(500).send(err.message);
  }
})

router.get('/searchProductAjax', async (req, res) => {
  var search = req.query.search; // Lấy từ khoá tìm kiếm
  try {
    // Tìm sản phẩm và giới hạn số lượng trả về, ví dụ 10 sản phẩm
    var products = await ProductModel.find({
      title: new RegExp(search, "i"),
      deleted: 0
    }).limit(10);

    res.json(products); // Trả về dữ liệu dạng JSON
  } catch (err) {
    res.status(500).send(err.message);
  }
});


router.get('/product_details/:id', async (req, res) => {
  try {
    var id = req.params.id;
    var token = req.cookies.token;
    var product = await ProductModel.findById(id);
    // Lấy danh sách sản phẩm liên quan (cùng danh mục và khác sản phẩm hiện tại)
    var productList = await ProductModel.find({
      category: product.category,
      _id: { $ne: id }  // loại trừ sản phẩm hiện tại
    })
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo, mới nhất đầu tiên
      .limit(3); // Giới hạn lấy 3 sản phẩm

    var orders = await OrderDetail.find({ product_id: id });

    var CartNum = 0;
    var userType = 'User';
    if (token != null) {
      var decoded = jwt.verify(token, process.env.JWT_SECRET);
      userType = decoded.usertype;
      var favorite = await Favorite.findOne({ product_id: id, user_id: decoded.userId });
      var cart = await Cart.find({ user_id: decoded.userId });
      for (let item of cart) {
        CartNum += item.quantity;
      }
    }
    var comments = await Comment.find({ product_id: id })
      .sort({ created_at: 'desc' }) // Sắp xếp theo created_at giảm dần
      .populate('user_id') // Populate thông tin của user, chỉ lấy trường image
      .exec();
    // Lấy danh sách commentIds
    var commentIds = await Comment.find({ product_id: id }).distinct('_id');


    const replies = await Reply.find({
      comment_id: commentIds, // Sử dụng $in để tìm các replies có comment_id trong danh sách commentIds
    }).populate('user_id') // Populate
      .sort({ created_at: 'desc' }) // Sắp xếp theo created_at giảm dần
      // .populate('user_id')
      .exec();
    res.render('frontend/product_details', { title: 'Product Details', product, productList, token, CartNum, numberFormat, comments, orders, userType, replies, formatTimeFeedback, favorite });
  } catch (error) {
    console.error(error)
  }
})

router.get('/profile', user, async (req, res) => {
  var token = req.cookies.token;
  var decoded = jwt.verify(token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);

  var CartNum = 0;
  var userType = 'User';
  if (token != null) {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    userType = decoded.usertype;
    var cart = await Cart.find({ user_id: decoded.userId });
    for (let item of cart) {
      CartNum += item.quantity;
    }
  }

  res.render('frontend/profile', { title: 'Profile', user, CartNum, token, userType });
})

router.post('/profile/edit', async (req, res) => {
  var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  var profile = req.body
  try {
    await User.findByIdAndUpdate(user._id, profile);
    res.redirect('/profile?message=update_success');
  } catch (err) {
    res.redirect('/profile?message=update_failed');
  }
})

router.post('/add_cart/:id', async (req, res) => {
  var token = req.cookies.token;
  if (token != null) {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var product = await ProductModel.findOne({ _id: req.params.id });
    try {
      var cart = await Cart.findOne({ product_id: req.params.id, user_id: user._id })
      var purchaseQuantity = parseInt(req.body.quantity, 10)
      if (product.quantity >= parseInt(req.body.quantity, 10)) {
        if (cart) {
          // If the cart exists, update the quantity
          cart.quantity += purchaseQuantity;
          cart.total_price = cart.price * cart.quantity;
          await cart.save();;
        } else {
          // If the cart doesn't exist, create a new one
          const newCart = new Cart({
            user_id: user._id,  // Fix the variable name here
            price: product.discount_price ? product.discount_price : product.price,
            product_id: product._id,
            quantity: req.body.quantity,
            total_price: product.price * req.body.quantity
          });

          await newCart.save();
        }
        //cập nhật số lượng sản phẩm
        product.quantity -= parseInt(req.body.quantity, 10);
        await product.save();
      }

      res.redirect('/product_details/' + req.params.id);

    } catch (error) {
      console.log(error)
      res.redirect('/product_details/' + req.params.id);
    }
  } else {
    res.redirect('/login');
  }
})

router.post('/addcart/:id', async (req, res) => {
  var token = req.cookies.token;
  if (token != null) {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var product = await ProductModel.findOne({ _id: req.params.id });
    try {
      var cart = await Cart.findOne({ product_id: req.params.id, user_id: user._id })
      if (product.quantity >= 1) {
        if (cart) {
          // If the cart exists, update the quantity
          cart.quantity += 1;
          cart.total_price = cart.price * cart.quantity;
          await cart.save();;
        } else {
          // If the cart doesn't exist, create a new one
          const newCart = new Cart({
            user_id: user._id,  // Fix the variable name here
            price: product.discount_price ? product.discount_price : product.price,
            product_id: product._id,
            quantity: req.body.quantity,
            total_price: product.price
          });

          await newCart.save();
        }
        //cập nhật số lượng sản phẩm
        product.quantity -= 1;
        await product.save();
      }

      // res.redirect('/');

    } catch (error) {
      console.log(error)
      res.redirect('/');
    }
  } else {
    res.redirect('/login');
  }
})

router.get('/cart', user, async (req, res) => {
  var token = req.cookies.token;
  var userType = 'User';
  if (token != null) {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    userType = decoded.usertype;
    var user = await User.findById(decoded.userId);
    var carts = await Cart.find({ user_id: decoded.userId }).populate('user_id').populate('product_id');
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    var CartNum = 0;
    for (let item of carts) {
      CartNum += item.quantity;
    }
    res.render('frontend/showcart', { title: 'Cart', user, carts, CartNum, token, numberFormat, message, userType });
  }
})

router.post('/cart/edit/:id', async (req, res) => {
  var id = req.params.id;
  try {

    var cart = await Cart.findOne({ _id: id })

    var quantity = parseInt(req.body.quantity, 10)

    //update quantity product
    var product = await ProductModel.findOne({ _id: cart.product_id })
    if (quantity <= product.quantity) {
      product.quantity = product.quantity + cart.quantity - quantity;
      product.save();

      //update cart
      if (quantity > 0) {
        cart.quantity = quantity;
        cart.total_price = cart.quantity * cart.price;
        cart.save();
        req.session.message = {
          type: 'success',
          content: 'Updated quantity cart successfully'
        };
      } else if (quantity == 0) {
        req.session.message = {
          type: 'success',
          content: 'Deleted cart successfully'
        };
        cart.remove();
      } else {
        req.session.message = {
          type: 'warning',
          content: 'The number of products in the shopping cart cannot be negative!!!'
        };
      }
    } else{
      req.session.message = {
        type: 'danger',
        content: 'The quantity of products in stock is not enough!!!'
      };
    }
    res.redirect('/cart');
  } catch (err) {
    req.session.message = {
      type: 'danger',
      content: 'Error updated!!!'
    };
    res.redirect('/cart');
  }

})

router.get('/cart/delete/:id', user, async (req, res) => {
  var id = req.params.id;
  try {
    var cart = await Cart.findOne({ _id: id })

    //update lại số lượng sản phẩm xong mới xóa
    var product = await ProductModel.findOne({ _id: cart.product_id })
    product.quantity = product.quantity + cart.quantity;
    product.save();

    //xóa giỏ hàng
    cart.remove();
    req.session.message = {
      type: 'success',
      content: 'Deleted cart successfully'
    };
    res.redirect('/cart')

  } catch (error) {
    req.session.message = {
      type: 'danger',
      content: 'Error Deleted!!!'
    };
    res.redirect('/cart');
  }
})

//thanh toán tiền mặt
router.post('/cash_order', async (req, res) => {
  try {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);

    // Lấy danh sách sản phẩm trong giỏ hàng của người dùng
    const cartItems = await Cart.find({ user_id: user.id });

    // Tính tổng tiền
    let totalMoney = 0;
    var productNum = 0;
    cartItems.forEach((cartItem) => {
      totalMoney += cartItem.total_price;
      productNum += cartItem.quantity;
    });

    if (totalMoney > 0) {
      if ((!/^[a-zA-Z ]*$/.test(req.body.name))) {
        req.session.message = {
          type: 'info',
          content: 'The name contains only letters and does not contain numbers!'
        };
        return res.redirect('/cart');
      }
      // Tạo một đơn hàng mới
      const order = new Order({
        name: req.body.name,
        email: user.email,
        phone: req.body.phone,
        address: req.body.address,
        user_id: user.id,
        total_money: totalMoney,
        payment_status: 'Cash',
        delivery_status: 'processing',
      });

      await order.save(); // Lưu đơn hàng vào cơ sở dữ liệu

      // Tạo các chi tiết đơn hàng
      for (const cartItem of cartItems) {
        const orderDetail = new OrderDetail({
          order_id: order._id,
          product_id: cartItem.product_id,
          price: cartItem.price,
          num: cartItem.quantity,
          total_money: cartItem.total_price,
        });

        await orderDetail.save();
      }

      const detail = {
        greeting: order.name,
        firstline: 'Products: ' + productNum,
        body: 'Total Money: ' + numberFormat(totalMoney),
        lastline: 'Payment status: ' + order.payment_status,
        url: 'https://toystores.onrender.com/',
      };
      content = 'Payment successful'
      // gửi mail sau khi thanh toán
      sendInformationEmail(order.email, detail, content);
      // Xóa giỏ hàng của người dùng sau khi đã đặt hàng
      await Cart.deleteMany({ user_id: user.id });
      req.session.message = {
        type: 'success',
        content: 'You have successfully paid, your order will be delivered as soon as possible!'
      };

      res.redirect('/cart');
    } else {
      req.session.message = {
        type: 'warning',
        content: 'The shopping cart is empty. Please add products to cart!'
      };
      res.redirect('/cart');
    }
  } catch (error) {
    console.error(error);
    req.session.message = {
      type: 'danger',
      content: 'Internal Server Error!'
    }
    res.redirect('/cart');
    // return res.status(500).json({ message: 'Internal Server Error' });
  }
})

//thanh toán online - stripe
router.get('/stripe', user, async (req, res) => {
  var token = req.cookies.token;
  var userType = 'User';
  var decoded = jwt.verify(token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  userType = decoded.usertype;
  var cartItems = await Cart.find({ user_id: decoded.userId });
  var CartNum = 0;
  for (let item of cartItems) {
    CartNum += item.quantity;
  }
  var totalMoney = 0;
  cartItems.forEach((cartItem) => {
    totalMoney += cartItem.total_price;
  });

  var key = process.env.STRIPE_KEY
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  res.render('frontend/stripe', { title: 'Payment Online', token, CartNum, user, totalMoney, message, numberFormat, key, userType });
})

const stripe = require('stripe')(process.env.STRIPE_SECRET);

router.post('/stripe', user, async (req, res) => {
  try {
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    const cartItems = await Cart.find({ user_id: user.id });

    let totalMoney = 0;
    var productNum = 0;
    cartItems.forEach((cartItem) => {
      totalMoney += cartItem.total_price;
      productNum += cartItem.quantity;
    });

    if (totalMoney > 0) {
      const { stripeToken } = req.body;
      // Xử lý thanh toán Stripe
      const amount = Math.floor(totalMoney * 100 / 24000); // Số tiền cần thanh toán
      await stripe.charges.create({
        amount: amount, // Số tiền thanh toán
        currency: 'usd',
        description: 'Demo charge',
        source: stripeToken,
      });
      // Tạo đơn hàng mới
      const order = new Order({
        name: req.body.name,
        email: user.email,
        phone: user.phone,
        address: req.body.address,
        user_id: user.id,
        total_money: totalMoney,
        payment_status: 'Paid',
        delivery_status: 'processing',
      });

      await order.save();

      // Tạo chi tiết đơn hàng
      for (const cartItem of cartItems) {
        const orderDetail = new OrderDetail({
          order_id: order._id,
          product_id: cartItem.product_id,
          price: cartItem.price,
          num: cartItem.quantity,
          total_money: cartItem.total_price,
        });

        await orderDetail.save();
      }

      const detail = {
        greeting: order.name,
        firstline: 'Products: ' + productNum,
        body: 'Total Money: ' + numberFormat(totalMoney),
        lastline: 'Payment status: ' + order.payment_status,
        url: 'https://toystores.onrender.com/',
        content: 'Thank you for Payment!'
      };
      sendInformationEmail(order.email, detail);

      // Xóa giỏ hàng của người dùng
      await Cart.deleteMany({ user_id: user.id });
      totalMoney = 0;

      req.session.message = {
        type: 'success',
        content: 'You have successfully paid, your order will be delivered as soon as possible!'
      };
      res.redirect('/stripe');
    } else {
      req.session.message = {
        type: 'warning',
        content: 'The shopping cart is empty. Please add products to cart!'
      };
      res.redirect('/stripe');
    }
  } catch (error) {
    console.error(error);
    req.session.message = {
      type: 'danger',
      content: 'Internal Server Error!'
    };
    res.redirect('/stripe');
  }
});


//show order
router.get('/orders', user, async (req, res) => {
  var token = req.cookies.token;
  var userType = 'User';
  var decoded = jwt.verify(token, process.env.JWT_SECRET);
  userType = decoded.usertype;

  var orderIds = await Order.find({ user_id: decoded.userId }).distinct('_id');
  const orders = await OrderDetail.find({ order_id: orderIds, deleted: 0 })
    .populate('product_id')
    .populate('order_id')
    .sort({ created_at: 'desc' }).exec();
  var carts = await Cart.find({ user_id: decoded.userId });
  var CartNum = 0;
  for (let item of carts) {
    CartNum += item.quantity;
  }
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  res.render('frontend/order', { title: 'My Order', token, orders, CartNum, numberFormat, message, userType })
})

//cancel order
router.get('/cancel_order/:id', user, async (req, res) => {
  try {
    const id = req.params.id;
    console.log('ID:', id);
    await Order.findByIdAndUpdate(id, { delivery_status: 'Cancelled' })
    req.session.message = {
      type: 'success',
      content: 'Order cancelled successfully!'
    }
    res.redirect('/orders')
  } catch (error) {
    // console.log(error)
    req.session.message = {
      type: 'danger',
      content: 'Cancel order failed!'
    }
    res.redirect('/orders')
  }
})

router.get('/delete_orders/:id', user, async (req, res) => {
  try {
    var id = req.params.id;
    await OrderDetail.findByIdAndUpdate(id, { deleted: 1 })
    req.session.message = {
      type: 'success',
      content: 'Order deleted successfully!'
    }
    console.log(id)
    res.redirect('/orders')
  } catch (error) {
    console.log(error)
    req.session.message = {
      type: 'danger',
      content: 'Deleted order failed!'
    }
    res.redirect('/orders')
  }
})

//contact
router.get('/contact', user, async (req, res) => {
  var token = req.cookies.token;
  var CartNum = 0;
  var userType = 'User';
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  if (token != null) {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    userType = decoded.usertype;
    var user = await User.findById(decoded.userId);
    var cartItems = await Cart.find({ user_id: decoded.userId });
    for (let item of cartItems) {
      CartNum += item.quantity;
    }
  }
  res.render('frontend/contact', { title: 'Contact', user, token, CartNum, message, userType });

})

router.post('/contact', async (req, res) => {
  try {
    //validate data
    if (!validator.isEmail(req.body.email)) {
      req.session.message = {
        type: 'info',
        content: 'email must be invalid'
      };
      return res.redirect('/contact');
    }

    if ((!/^[a-zA-Z ]*$/.test(req.body.name))) {
      req.session.message = {
        type: 'info',
        content: 'The name contains only letters and does not contain numbers!'
      };
      return res.redirect('/contact');
    }

    var token = req.cookies.token;
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    var feedbacks = new Feedback({
      fullname: req.body.fullname,
      email: req.body.email,
      phone: req.body.phone,
      subject_name: req.body.subject_name,
      note: req.body.note,
      user_id: decoded.userId
    });
    await feedbacks.save();
    req.session.message = {
      type: 'success',
      content: 'Send contact successfully!'
    }
    res.redirect('/contact');
  } catch (error) {
    console.log(error);
    req.session.message = {
      type: 'danger',
      content: 'Send contact failed!'
    }
    res.redirect('/contact');
  }
})

//add comment san pham
router.post('/add_comment/:id', async (req, res) => {
  try {
    var id = req.params.id;
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var comment = new Comment({
      name: user.name,
      user_id: user._id,
      comment: req.body.comment,
      product_id: id,
    })

    await comment.save();
    res.redirect('/product_details/' + id)
  } catch (error) {

  }
})

//add replies comment
router.post('/add_reply', async (req, res) => {
  var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  var comment = await Comment.findById(req.body.commentId);
  var reply = new Reply({
    name: user.name,
    user_id: user._id,
    comment_id: req.body.commentId,
    reply: req.body.reply,
  })

  await reply.save();
  res.redirect('product_details/' + comment.product_id)
})


//favorite products
router.get('/favorite', user, async (req, res) => {
  var token = req.cookies.token;
  var CartNum = 0;
  const page = parseInt(req.query.page) || 1; // Số trang hiện tại, mặc định là 1
  var limit = 3;
  const skip = (page - 1) * limit; // Số lượng sản phẩm cần bỏ qua
  var userType = 'User';
  if (token) {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    userType = decoded.usertype;
    var user = await User.findById(decoded.userId);
    var cartItems = await Cart.find({ user_id: decoded.userId });
    for (let item of cartItems) {
      CartNum += item.quantity;
    }
    var favorite = await Favorite.find({ user_id: user._id }).populate('product_id').sort({ created_at: 'desc' }).skip(skip).limit(limit);
    const totalFavorites = await Favorite.countDocuments();
    const totalPages = Math.ceil(totalFavorites / limit);
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session

    res.render('frontend/favorite', { title: 'My Favorite', token, CartNum, user, favorite, numberFormat, totalPages, page, userType });
  }
})

router.post('/favorite/:id', async (req, res) => {
  var id = req.params.id;
  var token = req.cookies.token;
  var decoded = jwt.verify(token, process.env.JWT_SECRET);
  var favorite = await Favorite.findOne({ user_id: decoded.userId, product_id: id });
  if (!favorite) {
    var favorites = new Favorite({
      product_id: id,
      user_id: decoded.userId,
    })
    await favorites.save();
  }
  res.redirect('/product_details/' + id)
})

router.get('/favorite/delete/:id', user, async (req, res) => {
  var id = req.params.id;
  await Favorite.findByIdAndDelete(id);
  req.session.message = {
    type: 'success',
    content: 'Delete user succeed'
  };
  res.redirect('/favorite')
})

const crypto = require('crypto');
const moment = require('moment');

function buildQueryRFC1738(obj) {
  return Object.keys(obj)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k]).replace(/%20/g, '+')}`)
    .join('&');
}

router.post('/create_payment_url', async function (req, res) {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const ipAddrRaw = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection.remoteAddress || '127.0.0.1';
    const ipAddr = ipAddrRaw === '::1' ? '127.0.0.1' : ipAddrRaw.replace('::ffff:', '');

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const orderId = Date.now().toString();

    const amount = parseInt(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).send('Số tiền không hợp lệ');
    }
    const amountVnp = amount * 100;

    let vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: amountVnp.toString(),
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: ipAddr,
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang ${orderId}|userId:${userId}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: orderId
    };

    const signData = buildQueryRFC1738(vnp_Params);
    const secureHash = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnp_Params.vnp_SecureHashType = 'SHA512';
    vnp_Params.vnp_SecureHash = secureHash;

    const finalUrl = vnpUrl + '?' + buildQueryRFC1738(vnp_Params);

    res.redirect(finalUrl);
  } catch (err) {
    console.error('❌ Lỗi tạo VNPay URL:', err);
    res.status(500).send('Lỗi xử lý VNPay');
  }
});

router.get('/vnpay-return', async function (req, res) {
  try {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = Object.keys(vnp_Params).sort().reduce((acc, key) => {
      acc[key] = vnp_Params[key];
      return acc;
    }, {});

    const signData = buildQueryRFC1738(sortedParams);
    const secretKey = process.env.VNP_HASH_SECRET;
    const signed = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      if (vnp_Params['vnp_ResponseCode'] === '00') {
        const info = vnp_Params['vnp_OrderInfo'];
        const match = info.match(/userId:([a-f0-9]{24})/);
        const userId = match ? match[1] : null;

        if (!userId) throw new Error('User ID not found in vnp_OrderInfo');

        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const cartItems = await Cart.find({ user_id: user.id });

        let totalMoney = 0;
        let productNum = 0;
        cartItems.forEach(item => {
          totalMoney += item.total_price;
          productNum += item.quantity;
        });

        const order = new Order({
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          user_id: user.id,
          total_money: totalMoney,
          payment_status: 'Cash',
          delivery_status: 'processing'
        });
        await order.save();

        for (const item of cartItems) {
          const orderDetail = new OrderDetail({
            order_id: order._id,
            product_id: item.product_id,
            price: item.price,
            num: item.quantity,
            total_money: item.total_price
          });
          await orderDetail.save();
        }

        await Cart.deleteMany({ user_id: user.id });

        const detail = {
          greeting: user.name,
          firstline: 'Products: ' + productNum,
          body: 'Total Money: ' + totalMoney,
          lastline: 'Payment status: ' + order.payment_status,
          url: 'https://toystores.onrender.com/',
          content: 'Thank you for Payment!'
        };
        sendInformationEmail(order.email, detail);

        //Tạo lại token và gán cookie
        const newToken = jwt.sign({ userId: user.id, usertype: user.usertype }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', newToken, { httpOnly: true });

        req.session.message = {
          type: 'success',
          content: 'Thanh toán VNPay thành công!'
        };
      } else {
        req.session.message = {
          type: 'danger',
          content: 'Thanh toán không thành công!'
        };
      }
      return res.redirect('/orders');
    } else {
      return res.status(400).send('Checksum không hợp lệ!');
    }
  } catch (err) {
    console.error('❌ Lỗi xử lý callback VNPay:', err);
    return res.status(500).send('Lỗi xử lý VNPay callback');
  }
});


module.exports = router;