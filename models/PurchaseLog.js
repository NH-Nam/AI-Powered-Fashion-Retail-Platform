var mongoose = require('mongoose');

var PurchaseLogSchema = mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'products', required: true },
  quantity: { type: Number, required: true, min: 0 },
  buy_price: { type: Number, required: true, min: 0 },
  total_cost: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('purchase_logs', PurchaseLogSchema);


