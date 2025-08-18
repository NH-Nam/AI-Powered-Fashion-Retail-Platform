const jwt = require('jsonwebtoken');
require('dotenv').config(); // file env lưu mkhau bí mật thui

//check ng dùng đăng nhập hay chưa
function checklogin(req, res, next) {
  // Lấy token từ cookie
  const token = req.cookies.token;

  // Kiểm tra xem token có tồn tại hay không
  if (!token) {
    return res.redirect('/');
  }

  try {
    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Lưu thông tin người dùng vào đối tượng request để có thể sử dụng ở các route khác
    req.user = decoded;
    
    // Tiếp tục với middleware tiếp theo trong stack nếu token hợp lệ
    next();
  } catch (error) {
    // Nếu có lỗi xác thực token, trả về thông báo lỗi
    res.status(400).send('Invalid token.');
  }
}

function checkNotAuthenticated(req, res, next) {
    try {
        const token = req.cookies.token;
        if (!token) {
            return next(); // Nếu không có token, tiếp tục với route hiện tại
        }

        // Xác minh token
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                // Token không hợp lệ, tiếp tục với route hiện tại
                return next();
            }
            // Token hợp lệ, chuyển hướng người dùng
            res.redirect('/'); // Chuyển hướng đến trang chủ hoặc trang hồ sơ
        });
    } catch (error) {
        next(error);
    }
}


//check quyền admin (chỉ tài khoản admin vào được)
function admin(req, res, next) {
//   // Gọi hàm checklogin trước để đảm bảo người dùng đã được xác thực
  checklogin(req, res, function() {
    // Sau khi xác thực, kiểm tra xem người dùng có phải là admin không
    if (req.user.usertype === 'Admin') {
      next();
    } else {
      return res.redirect('/');
    }
  });
}

//check quyền user (quyền user thấp hơn thì cả tài khoản admin và user đều có quyền truy cập)
function user(req, res, next) {
  checklogin(req, res, function() {
    // Sau khi xác thực, kiểm tra xem người dùng có phải là user thông thường không
    if (req.user.usertype === 'User' || req.user.usertype === 'Admin') {
      next();
    } else {
      res.status(403).send('Access denied. You must be a registered user to access this route.');
    }
  });
}

module.exports = {
  admin,
  user,
  checkNotAuthenticated
};
