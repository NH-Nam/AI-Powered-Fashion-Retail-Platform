var mongoose = require('mongoose');

var InventorySchema = mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'products',
    required: true
  },
  warehouse_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'warehouses',
    required: true
  },
  // Optional variant keying to align with ProductModel variants
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  quantity: { type: Number, default: 0, min: 0 },
  // Soft delete
  deleted: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

InventorySchema.index({ product_id: 1, warehouse_id: 1, size: 1, color: 1 }, { unique: true });

InventorySchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

var InventoryModel = mongoose.model('inventories', InventorySchema);

module.exports = InventoryModel;


