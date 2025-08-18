var mongoose = require('mongoose');

var WarehouseSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  address: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  is_default: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Number,
    default: 0
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

WarehouseSchema.index({ code: 1 }, { unique: true });

WarehouseSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

var WarehouseModel = mongoose.model('warehouses', WarehouseSchema);

module.exports = WarehouseModel;


