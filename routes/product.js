var express = require('express');
var router = express.Router();
var CategoryModel = require('../models/CategoryModel');
var ProductModel = require('../models/ProductModel');
var CartModel = require('../models/CartModel');
var Feedback = require('../models/FeedbackModel');
var PurchaseLog = require('../models/PurchaseLog');
var Warehouse = require('../models/WarehouseModel');
var Inventory = require('../models/InventoryModel');

//utils format time
var { formatDate, numberFormat, formatTimeFeedback } = require('../utils/Utility');

//middleware admin (Phân quyền)
const { admin } = require('../middleware/authorize');

//dung chung
var User = require('../models/UserModel');
require('dotenv').config();
const jwt = require('jsonwebtoken');

// Helper: normalize materials from form body (handles arrays)
function parseMaterials(materialsBody) {
  const materials = [];
  if (!materialsBody) return materials;
  Object.keys(materialsBody).forEach((key) => {
    const entry = materialsBody[key] || {};
    const names = Array.isArray(entry.material) ? entry.material : [entry.material];
    const percentages = Array.isArray(entry.percentage) ? entry.percentage : [entry.percentage];
    names.forEach((name, idx) => {
      if (name && typeof name === 'string') {
        const pctRaw = percentages[idx] !== undefined ? percentages[idx] : percentages[0];
        let pct = parseInt(pctRaw, 10);
        if (Number.isNaN(pct)) pct = 100;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        materials.push({ material: name, percentage: pct });
      }
    });
  });
  return materials;
}

// Helper: migrate legacy top-level size/color/quantity into variants if variants are missing
async function ensureVariantsFromLegacy(product) {
  try {
    if (product && (!Array.isArray(product.variants) || product.variants.length === 0)) {
      const legacySize = typeof product.size === 'string' ? product.size : '';
      const legacyColor = typeof product.color === 'string' ? product.color : '';
      const legacyQty = Number.isFinite(product.quantity) ? product.quantity : 0;
      if (legacySize || legacyColor || legacyQty > 0) {
        const variant = { quantity: legacyQty || 0 };
        if (legacySize && legacySize.trim() !== '') variant.size = legacySize;
        if (legacyColor && legacyColor.trim() !== '') variant.color = legacyColor;
        const variants = [variant];
        await ProductModel.findByIdAndUpdate(product._id, {
          variants,
          size: '',
          color: '',
          quantity: variants.reduce((s, v) => s + (parseInt(v.quantity, 10) || 0), 0),
        }, { runValidators: true });
        // reflect changes in passed object for immediate render
        product.variants = variants;
        product.size = '';
        product.color = '';
        product.quantity = variants[0].quantity;
      }
    }
  } catch (e) {
    // Non-fatal: do not block page if migration fails
  }
}

// Helper: normalize variants from form body: variants[uid][size], [color], [quantity]
function parseVariants(variantsBody) {
  const variants = [];
  if (!variantsBody) return variants;
  Object.keys(variantsBody).forEach((key) => {
    const entry = variantsBody[key] || {};
    const size = typeof entry.size === 'string' && entry.size.trim() !== '' ? entry.size.trim() : undefined;
    const color = typeof entry.color === 'string' && entry.color.trim() !== '' ? entry.color.trim() : undefined;
    let quantity = parseInt(entry.quantity, 10);
    if (Number.isNaN(quantity) || quantity < 0) quantity = 0;
    if (size || color || quantity > 0) {
      const variant = { quantity };
      if (size) variant.size = size;
      if (color) variant.color = color;
      variants.push(variant);
    }
  });
  return variants;
}

var feedback = async () => {
  var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
  return messages;
}

/* GET home page. */
router.get('/', admin, async (req, res) => {
  var products = await ProductModel.find({ deleted: 0 })
    .populate('category')
    .sort({ updated_at: 'desc' })
    .lean()
    .exec();

  // Map legacy fields for display consistency
  products = products.map(p => {
    if ((!p.materials || p.materials.length === 0) && typeof p.material === 'string' && p.material.trim() !== '') {
      p.materials = [{ material: p.material, percentage: 100 }];
    }
    if ((!p.seasons || p.seasons.length === 0) && typeof p.season === 'string' && p.season.trim() !== '') {
      p.seasons = [p.season];
    }
    return p;
  });

  // Aggregate inventory by warehouse for each product
  let inventoryByProduct = {};
  try {
    const [warehouses, invAgg] = await Promise.all([
      Warehouse.find({ deleted: 0 }).lean(),
      Inventory.aggregate([
        { $match: { deleted: { $ne: 1 } } },
        { $group: { _id: { product_id: '$product_id', warehouse_id: '$warehouse_id' }, quantity: { $sum: '$quantity' } } }
      ])
    ]);
    const whMap = new Map(warehouses.map(w => [String(w._id), { name: w.name, code: w.code }]));
    invAgg.forEach(row => {
      const pid = String(row._id.product_id);
      const wid = String(row._id.warehouse_id);
      const wh = whMap.get(wid) || { name: 'Warehouse', code: '' };
      if (!inventoryByProduct[pid]) inventoryByProduct[pid] = [];
      inventoryByProduct[pid].push({ warehouse_id: wid, name: wh.name, code: wh.code, quantity: row.quantity });
    });
  } catch (e) {
    inventoryByProduct = {};
  }

  //token user
  var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  var feeds = await feedback();
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  res.render('admin/show_product', { title: 'Show Product', products, message, formatDate, user, numberFormat, feeds,formatTimeFeedback, inventoryByProduct, path: 'product' });
});

router.post('/search', admin, async (req, res) => {
  var search = req.body.search
  var products = await ProductModel.find({
    $or: [
      { title: new RegExp(search, "i") },
      { 'category.name': new RegExp(search, "i") },
    ]
  }).populate('category').lean();

  // Map legacy fields for display consistency
  products = products.map(p => {
    if ((!p.materials || p.materials.length === 0) && typeof p.material === 'string' && p.material.trim() !== '') {
      p.materials = [{ material: p.material, percentage: 100 }];
    }
    if ((!p.seasons || p.seasons.length === 0) && typeof p.season === 'string' && p.season.trim() !== '') {
      p.seasons = [p.season];
    }
    return p;
  });

  // Aggregate inventory for filtered products
  let inventoryByProduct = {};
  try {
    const [warehouses, invAgg] = await Promise.all([
      Warehouse.find({ deleted: 0 }).lean(),
      Inventory.aggregate([
        { $match: { deleted: { $ne: 1 } } },
        { $group: { _id: { product_id: '$product_id', warehouse_id: '$warehouse_id' }, quantity: { $sum: '$quantity' } } }
      ])
    ]);
    const whMap = new Map(warehouses.map(w => [String(w._id), { name: w.name, code: w.code }]));
    invAgg.forEach(row => {
      const pid = String(row._id.product_id);
      const wid = String(row._id.warehouse_id);
      const wh = whMap.get(wid) || { name: 'Warehouse', code: '' };
      if (!inventoryByProduct[pid]) inventoryByProduct[pid] = [];
      inventoryByProduct[pid].push({ warehouse_id: wid, name: wh.name, code: wh.code, quantity: row.quantity });
    });
  } catch (e) {
    inventoryByProduct = {};
  }

  //token user
  var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  var feeds = await feedback();
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  res.render('admin/show_product', { title: 'Show Product', products, message, formatDate, user, numberFormat, feeds, formatTimeFeedback, inventoryByProduct, path: 'product' });
});

// create product
router.get('/add', admin, async (req, res) => {
  //token user
  var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  var feeds = await feedback();
  var categories = await CategoryModel.find({});
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  var product = { 
    _id: '', 
    title: '', 
    category: '', 
    description: '', 
    image: '', 
    quantity: '', 
    price: '', 
    buy_price: '',
    discount_price: '',
    size: '',
    color: '',
    material: '',
    brand: '',
    style: '',
    season: '',
    gender: ''
  };
  res.render('admin/product', { title: "Add Product", categories, product, user, feeds, message, formatTimeFeedback});
})

router.post('/add', async (req, res) => {
  var product = req.body;
  try {
    if(req.body.discount_price >= req.body.price) {
      req.session.message = {
        type: 'danger',
        content: 'Discount price cannot be greater than price'
      };
      return res.redirect('/product/add');
    }

    if(!req.body.category || req.body.category === "-- Select Gender --"){
      req.session.message = {
        type: 'danger',
        content: 'Please select a valid gender for product!'
      };
      return res.redirect('/product/add');
    }
    // Robust category validation (empty/invalid ObjectId)
    const isValidCategory = req.body.category && /^[0-9a-fA-F]{24}$/.test(String(req.body.category));
    if (!isValidCategory) {
      req.session.message = {
        type: 'danger',
        content: 'Please select a valid category for product!'
      };
      return res.redirect('/product/add');
    }

    // Process multiple seasons
    const seasonsArr = req.body.seasons ? (Array.isArray(req.body.seasons) ? req.body.seasons : [req.body.seasons]) : [];
    const materialsArr = parseMaterials(req.body.materials);
    const variantsArr = parseVariants(req.body.variants);
    const sumVariantQty = variantsArr.reduce((sum, v) => sum + (parseInt(v.quantity, 10) || 0), 0);

    // Build sanitized document (variants are authoritative for stock when present)
    const doc = {
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
      image: req.body.image,
      quantity: variantsArr.length ? sumVariantQty : req.body.quantity,
      price: req.body.price,
      buy_price: req.body.buy_price || 0,
      discount_price: req.body.discount_price,
      size: '',
      color: '',
      brand: req.body.brand,
      style: req.body.style,
      gender: req.body.gender || 'Unisex',
      seasons: seasonsArr,
      materials: materialsArr,
      variants: variantsArr
    };

    const created = await ProductModel.create(doc);
    // If initial stock > 0 and buy_price provided, log initial purchase cost
    try {
      const initialQty = Number(doc.quantity || 0);
      const buyPrice = Number(doc.buy_price || 0);
      if (initialQty > 0 && buyPrice >= 0) {
        await PurchaseLog.create({ product_id: created._id, quantity: initialQty, buy_price: buyPrice, total_cost: initialQty * buyPrice, note: 'Initial stock' });
      }
    } catch(e) {}
    req.session.message = {
      type: 'success',
      content: 'Product added successfully'
    };
  } catch (err) {
    console.error('Error adding product: ', err);
    req.session.message = {
      type: 'danger',
      content: 'Failed to add product'
    };
  }
  res.redirect('/product');
})

// //update product
router.get('/edit/:id', admin, async (req, res) => {
  //token user
  var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  var user = await User.findById(decoded.userId);
  //session alert
  const message = req.session ? req.session.message : null;
  delete req.session.message; // Xóa thông báo khỏi session
  const id = req.params.id;
  var categories = await CategoryModel.find({});
  // Load as plain object to include any legacy fields not in current schema
  var product = await ProductModel.findById(id).populate('category').lean();

  // Merge legacy standalone size/color/quantity into variants for this product if needed
  await ensureVariantsFromLegacy(product);

  // Backward compatibility: if legacy single fields exist, map them to new arrays for the form
  if (!product.materials || product.materials.length === 0) {
    if (product.material && typeof product.material === 'string' && product.material.trim() !== '') {
      product.materials = [{ material: product.material, percentage: 100 }];
    } else {
      product.materials = [];
    }
  }
  if (!product.seasons || product.seasons.length === 0) {
    if (product.season && typeof product.season === 'string' && product.season.trim() !== '') {
      product.seasons = [product.season];
    } else {
      product.seasons = [];
    }
  }

  var feeds = await feedback();
  res.render('admin/product_edit', { title: 'Update Product', categories, product, user, feeds, message, formatTimeFeedback});
});

router.post('/edit/:id', async (req, res) => {
  const id = req.params.id;
  var product = req.body;
  // Build arrays
  const seasonsArrEdit = req.body.seasons ? (Array.isArray(req.body.seasons) ? req.body.seasons : [req.body.seasons]) : [];
  const materialsArrEdit = parseMaterials(req.body.materials);
  const variantsArrEdit = parseVariants(req.body.variants);
  const sumVariantQtyEdit = variantsArrEdit.reduce((sum, v) => sum + (parseInt(v.quantity, 10) || 0), 0);
  // Whitelist update document (variants are authoritative for stock when present)
  const updateDoc = {
    title: req.body.title,
    category: req.body.category,
    description: req.body.description,
    image: req.body.image,
    quantity: variantsArrEdit.length ? sumVariantQtyEdit : req.body.quantity,
    price: req.body.price,
    buy_price: req.body.buy_price || 0,
    discount_price: req.body.discount_price,
    size: '',
    color: '',
    brand: req.body.brand,
    style: req.body.style,
    gender: req.body.gender || 'Unisex',
    seasons: seasonsArrEdit,
    materials: materialsArrEdit,
    variants: variantsArrEdit,
    updated_at: Date.now()
  };
  try {
    if(req.body.discount_price >= req.body.price) {
      req.session.message = {
        type: 'danger',
        content: 'Discount price cannot be greater than price'
      };
      return res.redirect('/product/edit/'+id);
    }

    if(!req.body.category || req.body.category === "-- Select Gender --"){
      req.session.message = {
        type: 'danger',
        content: 'Please select a valid gender for product!'
      };
      return res.redirect('/product/edit/'+id);
    }
    // Robust category validation (empty/invalid ObjectId)
    const isValidCategoryEdit = req.body.category && /^[0-9a-fA-F]{24}$/.test(String(req.body.category));
    if (!isValidCategoryEdit) {
      req.session.message = {
        type: 'danger',
        content: 'Please select a valid category for product!'
      };
      return res.redirect('/product/edit/'+id);
    }

    const before = await ProductModel.findById(id).lean();
    await ProductModel.findByIdAndUpdate(id, updateDoc, { runValidators: true });
    // Log purchase if quantity increased
    try {
      const after = await ProductModel.findById(id).lean();
      const beforeQty = Number(before ? before.quantity : 0);
      const afterQty = Number(after ? after.quantity : 0);
      const delta = afterQty - beforeQty;
      const buyPrice = Number(updateDoc.buy_price || before.buy_price || 0);
      if (delta > 0 && buyPrice >= 0) {
        await PurchaseLog.create({ product_id: id, quantity: delta, buy_price: buyPrice, total_cost: delta * buyPrice, note: 'Quantity increase via edit' });
      }
    } catch(e) {}
    // Đặt thông báo thành công
    req.session.message = {
      type: 'success',
      content: 'Update product succeed'
    };

    //update product xong phải update lại sản phẩm trong giỏ hàng
    var cart = await CartModel.findOne({ product_id: id });
    if (cart) {
      cart.price = (req.body.discount_price > 0) ? req.body.discount_price : req.body.price;
      cart.total_price = cart.price * cart.quantity;
      await cart.save();
    }

  } catch (err) {
    console.error(err)
    // Đặt thông báo lỗi
    req.session.message = {
      type: 'danger',
      content: 'Update failed'
    };
  }
  res.redirect('/product');
})

//delete category
router.get('/delete/:id', admin, async (req, res) => {
  var id = req.params.id;
  try {
    await ProductModel.findByIdAndUpdate(id, { deleted: 1 });
    req.session.message = {
      type: 'success',
      content: 'Product deleted successfully'
    };

    //xoá sản phẩm thì giỏ hàng cũng mất
    var cart = await CartModel.findOne({ product_id: id });
    if (cart) {
      await cart.remove();
    }

  } catch (err) {
    console.error('Delete product failed. Error: ', err);
    req.session.message = {
      type: 'danger',
      content: 'Failed to delete product'
    };
  }
  res.redirect('/product');
})


module.exports = router;

// One-off migration: backfill missing buy_price field for existing products
router.get('/migrate-buy-price', admin, async (req, res) => {
  try {
    const result = await ProductModel.updateMany(
      { $or: [ { buy_price: { $exists: false } }, { buy_price: null } ] },
      { $set: { buy_price: 0 } }
    );
    req.session.message = { type: 'success', content: `Backfilled buy_price for ${result.modifiedCount || 0} products.` };
  } catch (e) {
    req.session.message = { type: 'danger', content: 'Failed to backfill buy_price.' };
  }
  res.redirect('/product');
});

// Report legacy stocks vs purchase logs, and optionally backfill purchase logs for deltas
router.get('/legacy-stock-report', admin, async (req, res) => {
  try {
    const products = await ProductModel.find({ deleted: 0 }).lean();
    const report = [];
    for (const p of products) {
      const logs = await PurchaseLog.aggregate([
        { $match: { product_id: p._id } },
        { $group: { _id: '$product_id', qty: { $sum: '$quantity' }, cost: { $sum: '$total_cost' } } }
      ]);
      const loggedQty = logs && logs[0] ? Number(logs[0].qty || 0) : 0;
      const delta = Number(p.quantity || 0) - loggedQty;
      report.push({ id: String(p._id), title: p.title, quantity: Number(p.quantity || 0), loggedQty, delta, buy_price: Number(p.buy_price || 0) });
    }

    // Optional backfill: /product/legacy-stock-report?backfill=1&default_buy=0
    if (String(req.query.backfill || '') === '1') {
      const defaultBuy = Number(req.query.default_buy || 0);
      let created = 0;
      for (const r of report) {
        if (r.delta > 0) {
          const useBuy = isFinite(r.buy_price) && r.buy_price > 0 ? r.buy_price : defaultBuy;
          await PurchaseLog.create({ product_id: r.id, quantity: r.delta, buy_price: useBuy, total_cost: useBuy * r.delta, note: 'Legacy stock backfill' });
          created++;
        }
      }
      req.session.message = { type: 'success', content: `Backfilled purchase logs for ${created} products (default buy price = ${defaultBuy}).` };
      return res.redirect('/product');
    }

    // Render a quick JSON report if not backfilling
    res.json({ totalProducts: report.length, report });
  } catch (e) {
    console.error('legacy-stock-report error', e);
    res.status(500).json({ error: 'Failed to compute legacy stock report' });
  }
});

// Backfill ONLY products that already have a positive buy_price; skip others
router.get('/backfill-legacy-buy-only', admin, async (req, res) => {
  try {
    const products = await ProductModel.find({ deleted: 0, buy_price: { $gt: 0 } }).lean();
    let created = 0;
    for (const p of products) {
      const logs = await PurchaseLog.aggregate([
        { $match: { product_id: p._id } },
        { $group: { _id: '$product_id', qty: { $sum: '$quantity' } } }
      ]);
      const loggedQty = logs && logs[0] ? Number(logs[0].qty || 0) : 0;
      const delta = Number(p.quantity || 0) - loggedQty;
      if (delta > 0) {
        await PurchaseLog.create({ product_id: p._id, quantity: delta, buy_price: Number(p.buy_price || 0), total_cost: delta * Number(p.buy_price || 0), note: 'Legacy stock backfill (buy price only)' });
        created++;
      }
    }
    req.session.message = { type: 'success', content: `Backfilled purchase logs for ${created} products with buy_price > 0.` };
  } catch (e) {
    console.error('backfill-legacy-buy-only error', e);
    req.session.message = { type: 'danger', content: 'Failed to backfill legacy stocks using buy price.' };
  }
  res.redirect('/product');
});
