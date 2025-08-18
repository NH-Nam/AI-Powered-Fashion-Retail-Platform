var express = require('express');
var router = express.Router();
var Warehouse = require('../models/WarehouseModel');
var Inventory = require('../models/InventoryModel');
var Product = require('../models/ProductModel');
var PurchaseLog = require('../models/PurchaseLog');
var User = require('../models/UserModel');
var Feedback = require('../models/FeedbackModel');
const { formatTimeFeedback } = require('../utils/Utility');
const { admin } = require('../middleware/authorize');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ''));
}

async function recalcProductQuantity(productId) {
  try {
    if (!isValidObjectId(productId)) return;
    const total = await Inventory.aggregate([
      { $match: { product_id: new mongoose.Types.ObjectId(productId), deleted: { $ne: 1 } } },
      { $group: { _id: '$product_id', qty: { $sum: '$quantity' } } }
    ]);
    const qty = (total && total[0] && total[0].qty) ? total[0].qty : 0;
    await Product.findByIdAndUpdate(productId, { quantity: qty, updated_at: Date.now() });
  } catch {}
}

// Warehouses CRUD
router.get('/', admin, async (req, res) => {
  try {
    const items = await Warehouse.find({ deleted: 0 }).sort({ updated_at: -1 }).lean();
    res.json({ total: items.length, warehouses: items });
  } catch (e) {
    res.status(500).json({ total: 0, warehouses: [], error: 'Failed to load warehouses' });
  }
});

router.post('/add', admin, async (req, res) => {
  try {
    const doc = {
      name: req.body.name,
      code: String(req.body.code || '').toUpperCase(),
      address: req.body.address || '',
      phone: req.body.phone || '',
      is_default: !!req.body.is_default
    };
    if (!doc.name || !doc.code) return res.status(400).json({ ok: false, message: 'name and code are required' });
    // Ensure only one default
    if (doc.is_default) await Warehouse.updateMany({}, { $set: { is_default: false } });
    const created = await Warehouse.create(doc);
    res.json({ ok: true, warehouse: created });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to create warehouse' });
  }
});

router.post('/edit/:id', admin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: 'invalid id' });
    const update = {
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone,
      updated_at: Date.now()
    };
    if (typeof req.body.is_default !== 'undefined') {
      update.is_default = !!req.body.is_default;
      if (update.is_default) await Warehouse.updateMany({ _id: { $ne: id } }, { $set: { is_default: false } });
    }
    const result = await Warehouse.findByIdAndUpdate(id, update, { new: true });
    res.json({ ok: true, warehouse: result });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to update warehouse' });
  }
});

router.get('/delete/:id', admin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ ok: false, message: 'invalid id' });
    await Warehouse.findByIdAndUpdate(id, { deleted: 1, updated_at: Date.now() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to delete warehouse' });
  }
});

// Inventory endpoints
router.get('/:id/inventory', admin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ total: 0, items: [], message: 'invalid id' });
    const items = await Inventory.find({ warehouse_id: id, deleted: 0 })
      .populate('product_id')
      .lean();
    res.json({ total: items.length, items });
  } catch (e) {
    res.status(500).json({ total: 0, items: [], message: 'Failed to load inventory' });
  }
});

// Adjust or set quantity of a product (optionally variant) in a warehouse
router.post('/:id/inventory/adjust', admin, async (req, res) => {
  try {
    const warehouseId = req.params.id;
    if (!isValidObjectId(warehouseId)) return res.status(400).json({ ok: false, message: 'invalid warehouse id' });
    const { product_id, size = '', color = '', delta, set } = req.body;
    if (!isValidObjectId(product_id)) return res.status(400).json({ ok: false, message: 'invalid product id' });

    const filter = { product_id, warehouse_id: warehouseId, size, color };
    const existing = await Inventory.findOne(filter);
    let newQty;
    if (typeof set !== 'undefined') {
      newQty = Math.max(0, parseInt(set, 10) || 0);
    } else if (typeof delta !== 'undefined') {
      const base = existing ? (parseInt(existing.quantity, 10) || 0) : 0;
      newQty = Math.max(0, base + (parseInt(delta, 10) || 0));
    } else {
      return res.status(400).json({ ok: false, message: 'provide delta or set' });
    }

    const updated = await Inventory.findOneAndUpdate(filter, { $set: { quantity: newQty, deleted: 0, updated_at: Date.now() } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await recalcProductQuantity(product_id);
    res.json({ ok: true, item: updated });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to adjust inventory' });
  }
});

// Sum inventory across warehouses for a product
router.get('/inventory/by-product/:productId', admin, async (req, res) => {
  try {
    const productId = req.params.productId;
    if (!isValidObjectId(productId)) return res.status(400).json({ total: 0, items: [], message: 'invalid product id' });
    const items = await Inventory.aggregate([
      { $match: { product_id: new mongoose.Types.ObjectId(productId), deleted: { $ne: 1 } } },
      { $group: { _id: { size: '$size', color: '$color' }, quantity: { $sum: '$quantity' } } },
      { $project: { _id: 0, size: '$_id.size', color: '$_id.color', quantity: 1 } }
    ]);
    res.json({ total: items.length, items });
  } catch (e) {
    res.status(500).json({ total: 0, items: [], message: 'Failed to load product inventory' });
  }
});

module.exports = router;
// --- Admin pages (EJS) ---

// List warehouses admin page
router.get('/admin', admin, async (req, res) => {
  try {
    // common header/sidebar context
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    const feeds = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    const warehouses = await Warehouse.find({ deleted: 0 }).sort({ updated_at: -1 }).lean();
    // Inventory totals per warehouse
    const sums = await Inventory.aggregate([
      { $match: { deleted: { $ne: 1 } } },
      { $group: { _id: '$warehouse_id', total: { $sum: '$quantity' } } }
    ]);
    const sumMap = new Map(sums.map(s => [String(s._id), s.total]));
    const warehousesWithTotals = warehouses.map(w => ({ ...w, totalQuantity: sumMap.get(String(w._id)) || 0 }));
    const message = req.session ? req.session.message : null; if (req.session) delete req.session.message;
    res.render('admin/warehouses', { title: 'Warehouses', warehouses: warehousesWithTotals, message, user, feeds, formatTimeFeedback, path: 'warehouses' });
  } catch (e) {
    res.status(500).send('Failed to load warehouses page');
  }
});

router.post('/admin/add', admin, async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      code: String(req.body.code || '').toUpperCase(),
      address: req.body.address || '',
      phone: req.body.phone || '',
      is_default: !!req.body.is_default
    };
    if (!payload.name || !payload.code) {
      req.session.message = { type: 'danger', content: 'Name and Code are required' };
      return res.redirect('/warehouses/admin');
    }
    if (payload.is_default) await Warehouse.updateMany({}, { $set: { is_default: false } });
    await Warehouse.create(payload);
    req.session.message = { type: 'success', content: 'Warehouse created' };
  } catch (e) {
    req.session.message = { type: 'danger', content: 'Failed to create warehouse' };
  }
  res.redirect('/warehouses/admin');
});

router.post('/admin/edit/:id', admin, async (req, res) => {
  try {
    const id = req.params.id;
    const update = {
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone,
      updated_at: Date.now()
    };
    if (typeof req.body.is_default !== 'undefined') {
      update.is_default = !!req.body.is_default;
      if (update.is_default) await Warehouse.updateMany({ _id: { $ne: id } }, { $set: { is_default: false } });
    }
    await Warehouse.findByIdAndUpdate(id, update);
    req.session.message = { type: 'success', content: 'Warehouse updated' };
  } catch (e) {
    req.session.message = { type: 'danger', content: 'Failed to update warehouse' };
  }
  res.redirect('/warehouses/admin');
});

router.get('/admin/delete/:id', admin, async (req, res) => {
  try {
    await Warehouse.findByIdAndUpdate(req.params.id, { deleted: 1, updated_at: Date.now() });
    req.session.message = { type: 'success', content: 'Warehouse deleted' };
  } catch (e) {
    req.session.message = { type: 'danger', content: 'Failed to delete warehouse' };
  }
  res.redirect('/warehouses/admin');
});

// Inventory admin page
router.get('/admin/:id', admin, async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    const feeds = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    const warehouse = await Warehouse.findById(warehouseId).lean();
    const items = await Inventory.find({ warehouse_id: warehouseId, deleted: 0 }).populate('product_id').lean();
    const products = await Product.find({ deleted: 0 })
      .select('_id title image brand price discount_price quantity variants materials seasons')
      .sort({ updated_at: -1 })
      .lean();
    const message = req.session ? req.session.message : null; if (req.session) delete req.session.message;
    res.render('admin/warehouse_inventory', { title: 'Warehouse Inventory', warehouse, items, products, message, user, feeds, formatTimeFeedback, path: 'warehouses' });
  } catch (e) {
    res.status(500).send('Failed to load inventory page');
  }
});

router.post('/admin/:id/adjust', admin, async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const { product_id, size = '', color = '' } = req.body;
    const set = req.body.set !== undefined ? req.body.set : undefined;
    const delta = req.body.delta !== undefined ? req.body.delta : undefined;
    if (!product_id) {
      req.session.message = { type: 'danger', content: 'Product is required' };
      return res.redirect(`/warehouses/admin/${warehouseId}`);
    }
    const filter = { product_id, warehouse_id: warehouseId, size, color };
    const existing = await Inventory.findOne(filter);
    let newQty;
    if (set !== undefined && set !== '') {
      newQty = Math.max(0, parseInt(set, 10) || 0);
    } else if (delta !== undefined && delta !== '') {
      const base = existing ? (parseInt(existing.quantity, 10) || 0) : 0;
      newQty = Math.max(0, base + (parseInt(delta, 10) || 0));
    } else {
      req.session.message = { type: 'danger', content: 'Provide delta or set' };
      return res.redirect(`/warehouses/admin/${warehouseId}`);
    }
    const prevQty = existing ? Number(existing.quantity || 0) : 0;
    await Inventory.findOneAndUpdate(filter, { $set: { quantity: newQty, deleted: 0, updated_at: Date.now() } }, { upsert: true, setDefaultsOnInsert: true });
    await recalcProductQuantity(product_id);
    // If stock increased at this warehouse, log purchase cost using product's buy_price
    try {
      const delta = newQty - prevQty;
      if (delta > 0) {
        const prod = await Product.findById(product_id).lean();
        const buyPrice = Number(prod && prod.buy_price ? prod.buy_price : 0);
        await PurchaseLog.create({ product_id, quantity: delta, buy_price: buyPrice, total_cost: delta * buyPrice, note: `Warehouse ${warehouseId} adjust` });
      }
    } catch(e) {}
    req.session.message = { type: 'success', content: 'Inventory updated' };
  } catch (e) {
    req.session.message = { type: 'danger', content: 'Failed to update inventory' };
  }
  res.redirect(`/warehouses/admin/${req.params.id}`);
});


