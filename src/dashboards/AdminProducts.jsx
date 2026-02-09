import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Plus, Edit, Trash2, X, Tag, Loader, DollarSign, 
  Package, TrendingUp, Filter, ChevronLeft, ChevronRight, Eye, EyeOff
} from 'lucide-react';
import { db } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, BarElement, ArcElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, ArcElement);

// --- PREDEFINED CATEGORIES ---
const CATEGORY_OPTIONS = [
  "Electronics", "Fashion", "Home & Kitchen", "Beauty", 
  "Sports", "Toys", "Books", "Automotive", "Accessories", "Other"
];

// --- COMPONENT: REDESIGNED PRODUCT CARD ---
const ProductCard = React.memo(({ product, onEdit, onDelete }) => {
  const price = Number(product.selling_unit_price) || 0;
  const cost = Number(product.cost_unit_price) || 0;
  const margin = price - cost;
  const marginPercent = price > 0 ? ((margin / price) * 100).toFixed(1) : 0;

  return (
    <div className="group relative flex flex-col bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300">
      
      {/* Top: Image & Status */}
      <div className="relative h-48 overflow-hidden bg-slate-900">
        <img 
          src={product.image_url || "https://via.placeholder.com/400x300?text=No+Image"} 
          alt={product.product_name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
          onError={(e) => { e.target.src = "https://via.placeholder.com/400x300?text=No+Image"; }}
        />
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-lg ${
            product.is_product_active 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
          }`}>
            {product.is_product_active ? <Eye size={12}/> : <EyeOff size={12}/>}
            {product.is_product_active ? 'Active' : 'Hidden'}
          </span>
        </div>

        {/* Brand Badge */}
        <div className="absolute bottom-3 left-3">
           <span className="bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 uppercase tracking-widest">
             {product.product_brand || 'Generic'}
           </span>
        </div>
      </div>

      {/* Middle: Content */}
      <div className="p-4 flex-grow flex flex-col">
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/50 flex items-center gap-1">
                    <Tag size={10} /> {product.product_category}
                </span>
            </div>
            <h3 className="text-white font-bold text-base leading-snug line-clamp-2 min-h-[2.5rem]" title={product.product_name}>
                {product.product_name}
            </h3>
        </div>

        {/* Financials - Compact Grid */}
        <div className="mt-auto bg-slate-900/50 rounded-xl p-3 border border-slate-700/50 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                <span className="text-xs text-slate-400">Price</span>
                <span className="text-lg font-bold text-white">₹{price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Cost: <span className="text-slate-400">₹{cost}</span></span>
                <span className={`font-mono font-bold flex items-center gap-1 ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {margin >= 0 ? '+' : ''}₹{margin.toFixed(0)} ({marginPercent}%)
                </span>
            </div>
        </div>
      </div>

      {/* Bottom: Actions */}
      <div className="px-4 pb-4 pt-0 grid grid-cols-2 gap-3">
        <button 
            onClick={() => onEdit(product)} 
            className="flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold uppercase tracking-wide"
        >
            <Edit size={14} /> Edit
        </button>
        <button 
            onClick={() => onDelete(product.product_id)} 
            className="flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-600/10 text-rose-400 border border-rose-600/20 hover:bg-rose-600 hover:text-white transition-all text-xs font-bold uppercase tracking-wide"
        >
            <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
});

// --- MAIN COMPONENT: ADMIN PRODUCTS ---
const AdminProducts = ({ initialProducts = [], orders = [], orderItems = [], payments = [], onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- ANALYTICS FILTER STATE ---
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterWeek, setFilterWeek] = useState('');

  const [formData, setFormData] = useState({
    product_name: '', product_brand: '', product_category: 'Electronics', product_department: 'Unisex', 
    selling_unit_price: '', cost_unit_price: '', product_margin: 0, product_margin_percent: 0,
    product_short_description: '', image_url: '', is_product_active: true
  });

  // Analytics Engine (Same as before)
  const analytics = useMemo(() => {
    if(!initialProducts.length) return { kpis: {}, charts: { topProfit: {labels:[], data:[]}, topRevenue: {labels:[], data:[]}, brands: {labels:[], data:[]}, categories: {labels:[], data:[]} } };

    const productMap = new Map();
    initialProducts.forEach(p => {
        productMap.set(String(p.product_id), { name: p.product_name, brand: p.product_brand || 'Unknown', category: p.product_category || 'Other', cost_price: Number(p.cost_unit_price) || 0, selling_price: Number(p.selling_unit_price) || 0 });
    });

    const orderMap = new Map();
    orders.forEach(o => { orderMap.set(String(o.order_id), { status: o.order_status, date: new Date(o.order_date) }); });

    const paymentMap = new Map();
    payments.forEach(p => { paymentMap.set(String(p.order_id), p.payment_status); });

    const validProductIds = new Set();
    const validOrderIds = new Set();
    let totalQtySold = 0;
    let productRevenue = 0; 
    let totalProfit = 0;
    const productPerf = {};  
    const brandPerf = {};    
    const categoryPerf = {}; 

    orderItems.forEach(item => {
        const orderId = String(item.order_id);
        const prodId = String(item.product_id);
        const order = orderMap.get(orderId);
        const product = productMap.get(prodId);
        const paymentStatus = paymentMap.get(orderId) || 'PAID'; 

        if (!order || !product) return;
        if (filterYear && order.date.getFullYear().toString() !== filterYear) return;
        if (filterMonth && (order.date.getMonth() + 1).toString() !== filterMonth) return;
        if (filterWeek && Math.ceil(order.date.getDate() / 7).toString() !== filterWeek) return;

        if (order.status === 'Cancelled') return;
        if (item.is_returned === true) return; 
        if (paymentStatus === 'REFUNDED') return;

        const qty = Number(item.ordered_quantity || item.quantity) || 0;
        const revenue = Number(item.net_amount || item.total_amount) || 0; 
        const totalCost = product.cost_price * qty;
        const profit = revenue - totalCost;

        totalQtySold += qty;
        productRevenue += revenue; 
        totalProfit += profit;
        
        validProductIds.add(prodId);
        validOrderIds.add(orderId);

        if (!productPerf[prodId]) { productPerf[prodId] = { name: product.name, revenue: 0, profit: 0 }; }
        productPerf[prodId].revenue += revenue;
        productPerf[prodId].profit += profit;

        brandPerf[product.brand] = (brandPerf[product.brand] || 0) + revenue;
        categoryPerf[product.category] = (categoryPerf[product.category] || 0) + revenue;
    });

    const topProfitProducts = Object.values(productPerf).sort((a, b) => b.profit - a.profit).slice(0, 10);
    const topRevenueProducts = Object.values(productPerf).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const sortedBrands = Object.entries(brandPerf).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const sortedCategories = Object.entries(categoryPerf).sort((a, b) => b[1] - a[1]).slice(0, 6);

    return {
        kpis: { totalProductsSold: validProductIds.size, totalQtySold, totalOrders: validOrderIds.size, productRevenue, totalProfit },
        charts: {
            topProfit: { labels: topProfitProducts.map(p => p.name.substring(0, 15) + '...'), data: topProfitProducts.map(p => p.profit) },
            topRevenue: { labels: topRevenueProducts.map(p => p.name.substring(0, 15) + '...'), data: topRevenueProducts.map(p => p.revenue) },
            brands: { labels: sortedBrands.map(b => b[0]), data: sortedBrands.map(b => b[1]) },
            categories: { labels: sortedCategories.map(c => c[0]), data: sortedCategories.map(c => c[1]) }
        }
    };
  }, [initialProducts, orders, orderItems, payments, filterYear, filterMonth, filterWeek]);

  // --- CRUD HELPERS ---
  const filtered = useMemo(() => {
    return initialProducts.filter(p => (p.product_name?.toLowerCase().includes(searchTerm.toLowerCase())) && (!categoryFilter || p.product_category === categoryFilter));
  }, [initialProducts, searchTerm, categoryFilter]);
  
  // --- PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    return [...new Set([...initialProducts.map(p => p.product_category).filter(Boolean), ...CATEGORY_OPTIONS])];
  }, [initialProducts]);

  const handleSave = async (e) => {
    e.preventDefault(); 
    setSaving(true);
    const prodId = currentProduct ? currentProduct.product_id : Math.floor(Math.random() * 900000) + 100000;
    
    try {
      await setDoc(doc(db, "products", String(prodId)), { 
        ...formData, 
        product_id: Number(prodId), 
        selling_unit_price: Number(formData.selling_unit_price), 
        cost_unit_price: Number(formData.cost_unit_price) 
      }, { merge: true });
      
      if(onUpdate) onUpdate(); 
      setIsModalOpen(false);
    } catch(err){ 
      alert("Error: " + err.message); 
    } finally{ 
      setSaving(false); 
    }
  };
  
  const handleDelete = useCallback(async (id) => { 
    if(window.confirm("Delete?")) { 
      try { 
        await deleteDoc(doc(db, "products", String(id))); 
        if(onUpdate) onUpdate(); 
      } catch(e){ 
        console.error(e); 
      } 
    } 
  }, [onUpdate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target; 
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
        let u = { ...prev, [name]: val };
        if (name === 'selling_unit_price' || name === 'cost_unit_price') {
            const sell = parseFloat(name === 'selling_unit_price' ? val : prev.selling_unit_price) || 0;
            const cost = parseFloat(name === 'cost_unit_price' ? val : prev.cost_unit_price) || 0;
            if (sell !== 0) { 
                u.product_margin = parseFloat((sell - cost).toFixed(2)); 
                u.product_margin_percent = parseFloat(((sell - cost) / sell).toFixed(3)); 
            } else {
                u.product_margin = 0;
                u.product_margin_percent = 0;
            }
        }
        return u;
    });
  };

  const openNewProductModal = () => {
    setCurrentProduct(null); 
    setFormData({ 
        product_name: '', product_brand: '', product_category: 'Electronics', product_department: 'Unisex', 
        selling_unit_price: '', cost_unit_price: '', product_margin: 0, product_margin_percent: 0, 
        product_short_description: '', image_url: '', is_product_active: true 
    }); 
    setIsModalOpen(true);
  };

  const openEditProductModal = (product) => {
    setCurrentProduct(product);
    setFormData({
        product_name: product.product_name || '', 
        product_brand: product.product_brand || '', 
        product_category: product.product_category || 'Electronics', 
        product_department: product.product_department || 'Unisex', 
        selling_unit_price: product.selling_unit_price || '', 
        cost_unit_price: product.cost_unit_price || '', 
        product_margin: product.product_margin || 0, 
        product_margin_percent: product.product_margin_percent || 0, 
        product_short_description: product.product_short_description || '', 
        image_url: product.image_url || '', 
        is_product_active: product.is_product_active !== undefined ? product.is_product_active : true
    });
    setIsModalOpen(true);
  };

  const years = ['2019', '2020', '2021', '2022', '2023','2024','2025','2026'];
  const months = Array.from({length: 12}, (_, i) => (i + 1).toString());
  const weeks = ['1', '2', '3', '4'];

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <h1 className="text-2xl font-bold text-white tracking-tight">Products In GSH STORE</h1>
      
      {/* --- FILTERS --- */}
      <div className="flex flex-col sm:flex-row justify-end items-center gap-3 bg-[#0c2543] p-3 rounded-2xl border border-[#163a66] shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><Filter size={14} className="text-cyan-400"/> Sales Filters:</div>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="bg-[#041528] text-white text-xs px-3 py-2 rounded-lg border border-[#163a66] outline-none"><option value="">Year: All</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-[#041528] text-white text-xs px-3 py-2 rounded-lg border border-[#163a66] outline-none"><option value="">Month: All</option>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
          <select value={filterWeek} onChange={e=>setFilterWeek(e.target.value)} className="bg-[#041528] text-white text-xs px-3 py-2 rounded-lg border border-[#163a66] outline-none"><option value="">Week: All</option>{weeks.map(w=><option key={w} value={w}>Week {w}</option>)}</select>
          {(filterYear || filterMonth || filterWeek) && <button onClick={()=>{setFilterYear(''); setFilterMonth(''); setFilterWeek('');}} className="text-xs text-rose-400 hover:text-white font-bold px-2">Clear</button>}
      </div>

      {/* --- KPI CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg flex flex-col justify-center relative overflow-hidden">
              <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Products Sold</h4>
              <p className="text-2xl font-bold text-white">{analytics.kpis.totalProductsSold || 0}</p>
              <div className="absolute right-0 top-0 p-4 opacity-10"><Package size={40}/></div>
          </div>
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg flex flex-col justify-center">
              <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Quantity Sold</h4>
              <p className="text-2xl font-bold text-white">{((analytics.kpis.totalQtySold || 0) / 1000).toFixed(1)}k</p>
          </div>
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg flex flex-col justify-center">
              <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Orders</h4>
              <p className="text-2xl font-bold text-white">{analytics.kpis.totalOrders || 0}</p>
          </div>
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg flex flex-col justify-center">
              <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Product Revenue</h4>
              <p className="text-2xl font-bold text-emerald-400">₹{(analytics.kpis.productRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg flex flex-col justify-center">
              <h4 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Profit</h4>
              <p className="text-2xl font-bold text-cyan-400">₹{(analytics.kpis.totalProfit || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
      </div>

      {/* --- CHARTS SECTION --- */}
      <div className="bg-[#0c2543] p-6 rounded-3xl border border-[#163a66] shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 uppercase text-center">Top 10 Products by Profit</h4>
          <div className="h-64 w-full"><Line data={{ labels: analytics.charts.topProfit.labels, datasets: [{ label: 'Total Profit (₹)', data: analytics.charts.topProfit.data, borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: {size: 10} } } } }} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg"><h4 className="text-xs font-bold text-white mb-4 uppercase text-center">Top 5 Products by Revenue</h4><div className="h-48"><Bar data={{ labels: analytics.charts.topRevenue.labels, datasets: [{ data: analytics.charts.topRevenue.data, backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 15 }] }} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false }, ticks: { color: '#fff', font: {size: 10} } } } }} /></div></div>
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg"><h4 className="text-xs font-bold text-white mb-4 uppercase text-center">Brand Performance</h4><div className="h-48 flex justify-center relative"><Doughnut data={{ labels: analytics.charts.brands.labels, datasets: [{ data: analytics.charts.brands.data, backgroundColor: ['#3b82f6', '#06b6d4', '#8b5cf6', '#d946ef', '#f43f5e'], borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: {size: 10}, boxWidth: 10, padding: 10 } } }, cutout: '60%' }} /></div></div>
          <div className="bg-[#0c2543] p-5 rounded-3xl border border-[#163a66] shadow-lg"><h4 className="text-xs font-bold text-white mb-4 uppercase text-center">Revenue by Product Category</h4><div className="h-48 w-full"><Bar data={{ labels: analytics.charts.categories.labels, datasets: [{ label: 'Revenue', data: analytics.charts.categories.data, backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 15 }] }} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: (val) => val/1000 + 'k' } }, y: { grid: { display: false }, ticks: { color: '#fff', font: {size: 10} } } } }} /></div></div>
      </div>

      {/* --- INVENTORY LIST: SEARCH & ACTIONS --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/5 p-4 md:p-6 rounded-3xl border border-white/5 backdrop-blur-md mt-6">
        <div>
            <h2 className="text-2xl font-bold text-white px-2">Inventory List</h2>
            <p className="text-xs text-slate-400 px-2 mt-1">
                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filtered.length)} of {filtered.length} products
            </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3 w-full lg:w-auto">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search products..." className="w-full lg:w-64 bg-black/20 border border-white/10 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:border-violet-500 outline-none transition-all"/></div>
          <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="bg-black/20 border border-white/10 text-slate-200 px-4 py-2.5 rounded-xl outline-none cursor-pointer focus:border-violet-500"><option value="" className="bg-slate-900">All Categories</option>{uniqueCategories.map(c=><option key={c} value={c} className="bg-slate-900">{c}</option>)}</select>
          <button onClick={openNewProductModal} className="sm:col-span-2 lg:col-auto bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2 transition-transform active:scale-95"><Plus size={20}/> Add Product</button>
        </div>
      </div>

      {/* --- PRODUCT GRID (PAGINATED) --- */}
      {currentItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentItems.map(product => (
            <ProductCard 
              key={product.product_id} 
              product={product} 
              onEdit={openEditProductModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white/5 rounded-3xl border border-white/5">
            <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-white text-lg font-bold">No Products Found</h3>
            <p className="text-slate-400 text-sm">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* --- PAGINATION CONTROLS --- */}
      {filtered.length > itemsPerPage && (
        <div className="flex justify-center items-center gap-4 mt-8 bg-slate-900/50 p-3 rounded-2xl w-fit mx-auto border border-slate-700">
            <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-slate-800 text-white hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-slate-800 transition-colors"
            >
                <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-slate-300">
                Page {currentPage} of {totalPages}
            </span>
            <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-slate-800 text-white hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-slate-800 transition-colors"
            >
                <ChevronRight size={20} />
            </button>
        </div>
      )}

      {/* --- MODAL FORM --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">{currentProduct ? 'Edit Product' : 'New Product'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 scrollbar-hide">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 ml-1">Product Name</label>
                            <input name="product_name" placeholder="Enter name..." value={formData.product_name} onChange={handleInputChange} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none" required/>
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded-xl border border-white/10 w-full">
                                <input type="checkbox" name="is_product_active" checked={formData.is_product_active} onChange={handleInputChange} className="w-5 h-5 accent-violet-600"/>
                                <span className="text-slate-300 text-sm font-medium">Product Active</span>
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 ml-1">Brand</label>
                            <input name="product_brand" placeholder="Brand" value={formData.product_brand} onChange={handleInputChange} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none" required/>
                        </div>
                        
                        {/* --- CATEGORY DROPDOWN --- */}
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 ml-1">Category</label>
                            <select name="product_category" value={formData.product_category} onChange={handleInputChange} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none appearance-none">
                                {CATEGORY_OPTIONS.map(cat => (
                                    <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 ml-1">Department</label>
                            <select name="product_department" value={formData.product_department} onChange={handleInputChange} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none">
                                <option value="Unisex" className="bg-slate-900">Unisex</option>
                                <option value="Men" className="bg-slate-900">Men</option>
                                <option value="Women" className="bg-slate-900">Women</option>
                                <option value="Kids" className="bg-slate-900">Kids</option>
                            </select>
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-2 text-violet-400 font-bold text-sm uppercase tracking-widest"><DollarSign size={16}/> Pricing & Financials</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Sale Price (₹)</label>
                                <input name="selling_unit_price" type="number" step="0.01" value={formData.selling_unit_price} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-emerald-400 font-bold focus:border-emerald-500 outline-none" required/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Cost Price (₹)</label>
                                <input name="cost_unit_price" type="number" step="0.01" value={formData.cost_unit_price} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-rose-400 font-bold focus:border-rose-500 outline-none" required/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Net Margin</label>
                                <div className={`p-2.5 rounded-xl bg-black/20 font-mono text-center border border-white/5 ${formData.product_margin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formData.product_margin}</div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Margin %</label>
                                <div className={`p-2.5 rounded-xl bg-black/20 font-mono text-center border border-white/5 ${formData.product_margin_percent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{(formData.product_margin_percent * 100).toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 ml-1">Product Media URL</label>
                        <input name="image_url" placeholder="Paste image link here..." value={formData.image_url} onChange={handleInputChange} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 ml-1">Product Description</label>
                        <textarea name="product_short_description" placeholder="Technical specifications or details..." value={formData.product_short_description} onChange={handleInputChange} rows="3" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none resize-none"/>
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98]">
                            {saving ? <Loader className="animate-spin m-auto" size={24}/> : 'Complete Update'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;