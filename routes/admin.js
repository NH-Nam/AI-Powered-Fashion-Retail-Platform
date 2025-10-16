var express = require('express');
var router = express.Router();
var User = require('../models/UserModel');
var Feedback = require('../models/FeedbackModel');
var Product = require('../models/ProductModel');
var Order = require('../models/OrderModel');
var OrderDetail = require('../models/OrderDetailModel');
var Warehouse = require('../models/WarehouseModel');
var Inventory = require('../models/InventoryModel');
var PurchaseLog = require('../models/PurchaseLog');
//token
const jwt = require('jsonwebtoken');
require('dotenv').config();
//utils format time
var { formatDate, formatTimeFeedback } = require('../utils/Utility');

//middleware admin (Phân quyền)
const { admin } = require('../middleware/authorize');

var feedback = async () => {
    var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    return messages;
}

//trang chủ admin - chỉ amin mới vào được
router.get('/', admin, async (req, res) => {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var users = await User.find({ usertype: 'User' });

    var feeds = await feedback();

    var products = await Product.find({ deleted: 0 });
    // KPIs for dashboard cards
    // Revenue: total VND of all orders (all time)
    // Sales: VND of orders placed in the last 30 days (paid or cash)
    // Selling Price: average selling price (order_details.price) over the last 30 days
    // Cost (from buy price): we’ll roll it into revenue growth context with purchase logs if needed for margin later
    let totalRevenueVnd = 0;
    const now = new Date();
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const since60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const since90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const since180d = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    function pctChange(curr, prev) {
        const c = Number(curr || 0);
        const p = Number(prev || 0);
        
        // Handle edge cases
        if (p === 0) {
            return c > 0 ? 100 : (c < 0 ? -100 : 0);
        }
        
        // Calculate percentage change
        const change = ((c - p) / Math.abs(p)) * 100;
        
        // Limit extreme values to reasonable ranges
        if (change > 100) return 100;
        if (change < -100) return -100;
        
        return Math.round(change * 10) / 10; // Round to 1 decimal place
    }
    var feedbacks = await Feedback.find({});
    // Only count delivered orders for revenue
    var orders = await Order.find({ delivery_status: 'Delivered' });
    orders.forEach((order) => {
        totalRevenueVnd += Number(order.total_money || 0);
    });
    const total_revenue = Math.max(0, totalRevenueVnd); // VND (gross sales) - ensure non-negative

    // Costs (buy price)
    const costAllAgg = await PurchaseLog.aggregate([
      { $group: { _id: null, total: { $sum: '$total_cost' } } }
    ]);
    const costAll = costAllAgg && costAllAgg[0] ? Number(costAllAgg[0].total || 0) : 0;
    const cost30Agg = await PurchaseLog.aggregate([
      { $match: { created_at: { $gte: since30d } } },
      { $group: { _id: null, total: { $sum: '$total_cost' } } }
    ]);
    const cost30 = cost30Agg && cost30Agg[0] ? Number(cost30Agg[0].total || 0) : 0;
    const marginAll = total_revenue - costAll; // Show actual margin (can be negative)

    // Sales: ONLY count DELIVERED orders for KPI calculations
    let recentOrders = await Order.find({ 
        delivery_status: 'Delivered',
        created_at: { $gte: since30d } 
    });
    let prevOrders = await Order.find({ 
        delivery_status: 'Delivered',
        created_at: { $gte: since60d, $lt: since30d } 
    });
    
    // If no recent delivered data, try 90 days
    if (recentOrders.length === 0) {
        recentOrders = await Order.find({ 
            delivery_status: 'Delivered',
            created_at: { $gte: since90d } 
        });
        prevOrders = await Order.find({ 
            delivery_status: 'Delivered',
            created_at: { $gte: since180d, $lt: since90d } 
        });
    }
    
    // Fallback: if still no data, get the most recent delivered orders regardless of timestamp
    if (recentOrders.length === 0) {
        recentOrders = await Order.find({ delivery_status: 'Delivered' }).sort({ created_at: -1 }).limit(10);
    }
    
    // Get all delivered orders for total counts
    const deliveredOrders = await Order.find({ delivery_status: 'Delivered' });
    
    const discount = Math.max(0, recentOrders.reduce((sum, o) => sum + Number(o.total_money || 0), 0));
    const prevSales = Math.max(0, prevOrders.reduce((sum, o) => sum + Number(o.total_money || 0), 0));
    const margin30 = discount > 0 ? (discount - cost30) : null; // Show actual margin (can be negative)

    // Average selling price: ONLY use delivered orders
    let recentDetails = await OrderDetail.find({ 
        order_id: { $in: deliveredOrders.map(o => o._id) },
        created_at: { $gte: since30d } 
    });
    let prevDetails = await OrderDetail.find({ 
        order_id: { $in: deliveredOrders.map(o => o._id) },
        created_at: { $gte: since60d, $lt: since30d } 
    });
    
    // If no recent data, try 90 days
    if (recentDetails.length === 0) {
        recentDetails = await OrderDetail.find({ 
            order_id: { $in: deliveredOrders.map(o => o._id) },
            created_at: { $gte: since90d } 
        });
        prevDetails = await OrderDetail.find({ 
            order_id: { $in: deliveredOrders.map(o => o._id) },
            created_at: { $gte: since180d, $lt: since90d } 
        });
    }
    
    // Fallback: if still no data, get the most recent delivered order details
    if (recentDetails.length === 0) {
        recentDetails = await OrderDetail.find({ 
            order_id: { $in: deliveredOrders.map(o => o._id) }
        }).sort({ created_at: -1 }).limit(10);
    }
    
    const price = recentDetails.length > 0
      ? Math.max(0, recentDetails.reduce((s, d) => s + Number(d.price || 0), 0) / recentDetails.length)
      : null; // null means no recent data
    const prevAvgPrice = prevDetails.length > 0
      ? Math.max(0, prevDetails.reduce((s, d) => s + Number(d.price || 0), 0) / prevDetails.length)
      : 0;

    // Average buy price (last 30 days)
    const buyAgg30 = await PurchaseLog.aggregate([
      { $match: { created_at: { $gte: since30d } } },
      { $group: { _id: null, totalCost: { $sum: '$total_cost' }, totalQty: { $sum: '$quantity' } } }
    ]);
    const avgBuy30 = buyAgg30 && buyAgg30[0] && Number(buyAgg30[0].totalQty || 0) > 0
      ? Math.max(0, Number(buyAgg30[0].totalCost || 0) / Number(buyAgg30[0].totalQty || 1))
      : 0;
    const spread30 = price !== null ? (price - avgBuy30) : null; // Show actual spread (can be negative)

    // Enhanced KPI metrics with better database integration
    // Products KPI
    let productsLast30 = await Product.countDocuments({ deleted: 0, created_at: { $gte: since30d } });
    let productsPrev30 = await Product.countDocuments({ deleted: 0, created_at: { $gte: since60d, $lt: since30d } });
    
    // If no recent data, try 90 days
    if (productsLast30 === 0) {
        productsLast30 = await Product.countDocuments({ deleted: 0, created_at: { $gte: since90d } });
        productsPrev30 = await Product.countDocuments({ deleted: 0, created_at: { $gte: since180d, $lt: since90d } });
    }
    let productsGrowthPct = pctChange(productsLast30, productsPrev30);

    // Orders KPI - ONLY count delivered orders
    const ordersLast30 = recentOrders.length;
    const ordersPrev30 = prevOrders.length;
    let ordersGrowthPct = pctChange(ordersLast30, ordersPrev30);
    
    // Calculate average order value (only delivered orders)
    const avgOrderValue = deliveredOrders.length > 0 ? total_revenue / deliveredOrders.length : 0;
    const avgOrderValue30 = recentOrders.length > 0 ? discount / recentOrders.length : 0;

    // Users KPI - Enhanced with active user metrics
    let usersLast30 = await User.countDocuments({ usertype: 'User', created_at: { $gte: since30d } });
    let usersPrev30 = await User.countDocuments({ usertype: 'User', created_at: { $gte: since60d, $lt: since30d } });
    
    // If no recent data, try 90 days
    if (usersLast30 === 0) {
        usersLast30 = await User.countDocuments({ usertype: 'User', created_at: { $gte: since90d } });
        usersPrev30 = await User.countDocuments({ usertype: 'User', created_at: { $gte: since180d, $lt: since90d } });
    }
    let usersGrowthPct = pctChange(usersLast30, usersPrev30);
    
    // Get active users (users who have placed orders)
    const activeUsers = await User.aggregate([
        { $match: { usertype: 'User' } },
        { $lookup: { from: 'orders', localField: '_id', foreignField: 'user_id', as: 'userOrders' } },
        { $match: { 'userOrders.0': { $exists: true } } },
        { $count: 'activeUsers' }
    ]);
    const activeUsersCount = activeUsers.length > 0 ? activeUsers[0].activeUsers : 0;

    // Feedback KPI - Enhanced with sentiment analysis
    let feedbackLast30 = await Feedback.countDocuments({ created_at: { $gte: since30d } });
    let feedbackPrev30 = await Feedback.countDocuments({ created_at: { $gte: since60d, $lt: since30d } });
    
    // If no recent data, try 90 days
    if (feedbackLast30 === 0) {
        feedbackLast30 = await Feedback.countDocuments({ created_at: { $gte: since90d } });
        feedbackPrev30 = await Feedback.countDocuments({ created_at: { $gte: since180d, $lt: since90d } });
    }
    let feedbackGrowthPct = pctChange(feedbackLast30, feedbackPrev30);
    
    // Get recent feedback for sentiment analysis
    const recentFeedback = await Feedback.find({ created_at: { $gte: since30d } }).populate('user_id').limit(5);
    
    // Inventory KPI - New metric for better business insights
    const lowStockProducts = await Product.countDocuments({ 
        deleted: 0, 
        quantity: { $lte: 10 } // Products with 10 or fewer items
    });
    
    const outOfStockProducts = await Product.countDocuments({ 
        deleted: 0, 
        quantity: { $lte: 0 } // Products with 0 items
    });

    // Handle edge case where there's no previous data
    if (productsPrev30 === 0 && productsLast30 > 0) productsGrowthPct = 100;
    if (ordersPrev30 === 0 && ordersLast30 > 0) ordersGrowthPct = 100;
    if (usersPrev30 === 0 && usersLast30 > 0) usersGrowthPct = 100;
    if (feedbackPrev30 === 0 && feedbackLast30 > 0) feedbackGrowthPct = 100;

    // Revenue growth calculation - handle edge cases better
    let revenueGrowthPct = 0;
    if (prevSales > 0) {
        revenueGrowthPct = pctChange(discount, prevSales);
    } else if (discount > 0) {
        revenueGrowthPct = 100; // New revenue when there was none before
    }
    
    const salesGrowthPct = revenueGrowthPct;
    const priceGrowthPct = pctChange(price, prevAvgPrice);

    const order_items = await Order.find({ delivery_status: 'Delivered' })
        .populate('user_id')
        .sort({ created_at: 'desc' }).exec();

    // Simple KPIs for warehouses
    const warehouses = await Warehouse.find({ deleted: 0 }).lean();
    const inventoryCount = await Inventory.countDocuments({ deleted: 0 });

    // Determine which time period we're using for display
    const timePeriodUsed = recentOrders.length > 0 ? '30d' : (productsLast30 > 0 ? '90d' : 'all-time');
    
    // Ensure all values are properly formatted and validated
    const validatedData = {
        // Growth percentages
        productsGrowthPct: Number(productsGrowthPct) || 0,
        ordersGrowthPct: Number(ordersGrowthPct) || 0,
        usersGrowthPct: Number(usersGrowthPct) || 0,
        feedbackGrowthPct: Number(feedbackGrowthPct) || 0,
        revenueGrowthPct: Number(revenueGrowthPct) || 0,
        salesGrowthPct: Number(salesGrowthPct) || 0,
        priceGrowthPct: Number(priceGrowthPct) || 0,
        
        // Financial metrics
        costAll: Number(costAll) || 0,
        cost30: Number(cost30) || 0,
        marginAll: Number(marginAll) || 0,
        margin30: margin30 !== null ? Number(margin30) : null,
        avgBuy30: Number(avgBuy30) || 0,
        spread30: spread30 !== null ? Number(spread30) : null,
        total_revenue: Number(total_revenue) || 0,
        discount: Number(discount) || 0,
        price: price !== null ? Number(price) : null,
        
        // Enhanced KPI metrics
        avgOrderValue: Number(avgOrderValue) || 0,
        avgOrderValue30: Number(avgOrderValue30) || 0,
        activeUsersCount: Number(activeUsersCount) || 0,
        lowStockProducts: Number(lowStockProducts) || 0,
        outOfStockProducts: Number(outOfStockProducts) || 0,
        
        // Time period indicator
        timePeriodUsed: timePeriodUsed,
        
        // Recent data for detailed analysis
        recentFeedback: recentFeedback || []
    };
    


    res.render('admin/home', { 
        title: 'Admin Home', 
        user, 
        feeds, 
        products, 
        order_items, 
        formatDate, 
        feedbacks, 
        orders, 
        users, 
        formatTimeFeedback, 
        warehouses, 
        inventoryCount, 
        path: 'redirect',
        ...validatedData
    });
});

router.post('/search', (req, res) => {
    res.redirect('/admin')
})

module.exports = router;
