var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');

// Cấu hình multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads/'); // Thư mục lưu file, đảm bảo thư mục này tồn tại
    },
    filename: function (req, file, cb) {
        // Đặt tên file trong thư mục uploads để không trùng lặp
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Cấu hình lọc các loại file được phép tải lên
const fileFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50000000 } // Giới hạn file là 50MB
});


// Xử lý route upload file
router.post('/api/upload', upload.single('file'), (req, res) => {
    // Kiểm tra xem có file được tải lên không
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded.' });
    } else {
        // Trả về URL của file trong phản hồi
        const url = req.protocol + '://' + req.get('host') + '/uploads/' + req.file.filename;
        return res.status(200).json({ status: 'success', url: url });
    }
});

module.exports = router;