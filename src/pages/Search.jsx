import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast'; 
import { FaShoppingCart, FaBolt, FaStar, FaUndo, FaSearch } from "react-icons/fa";
import { db } from "../firebase"; 
import { collection, getDocs } from "firebase/firestore";

import { addItem } from "../slices/cartSlice";

const Search = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const query = searchParams.get("q") || "";
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Fetch Data from Firebase ---
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const firebaseProducts = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          product_id: doc.id,
          // Ensure numbers are numbers
          selling_unit_price: Number(doc.data().selling_unit_price) || 0,
          product_rating: Number(doc.data().product_rating) || 0,
          // Handle active status (default to true if undefined)
          is_product_active: doc.data().is_product_active !== false 
        }));
        setProducts(firebaseProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // --- Helper: Render Stars ---
  const renderStars = (rating = 4.5) => (
    [...Array(5)].map((_, i) => (
      <FaStar 
        key={i} 
        size={10} 
        className={`${i < Math.round(rating) ? "text-yellow-400" : "text-slate-600"}`} 
      />
    ))
  );

  // --- Filter Logic ---
  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([]);
      return;
    }
    
    if (products.length > 0) {
      const lowerQuery = query.toLowerCase();
      const result = products.filter((product) =>
        // 1. Must be Active
        product.is_product_active && 
        // 2. Must match search
        [product.product_name, product.product_brand, product.product_category].some((field) =>
          field?.toLowerCase().includes(lowerQuery)
        )
      );
      setFilteredProducts(result.slice(0, 20));
    }
  }, [query, products]);

  // --- Handlers ---
  const handleAddToCart = (product) => {
    dispatch(addItem({
        product_id: product.product_id,
        product_name: product.product_name,
        selling_unit_price: product.selling_unit_price,
        image_url: product.image_url,
        quantity: 1,
    }));
    toast.success("Added to cart", {
       style: { background: '#1e293b', color: '#fff' }
    });
  };

  const handleBuyNow = (product) => {
    handleAddToCart(product);
    navigate("/cart");
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 font-sans pb-12 selection:bg-blue-500 selection:text-white">
      <Toaster position="top-center" />

      <section className="py-12 px-4 sm:px-8 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
            <h2 className="text-3xl font-bold flex items-center justify-center gap-3">
               <span className="bg-slate-800 p-3 rounded-full border border-slate-700"><FaSearch className="text-blue-500 text-xl"/></span>
               <span>Search Results</span>
            </h2>
            <p className="text-slate-400 mt-2">
                Found {filteredProducts.length} items for <span className="text-white font-bold">"{query}"</span>
            </p>
        </div>

        {loading ? (
           <div className="flex justify-center items-center py-20">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
           </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
            {filteredProducts.map((p) => (
              <div 
                key={p.product_id} 
                className="group bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/10 flex flex-col h-full relative"
              >
                {/* Image Section */}
                <div className="relative h-48 sm:h-64 overflow-hidden bg-slate-700">
                  <img 
                    src={p.image_url || "https://via.placeholder.com/300"} 
                    alt={p.product_name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    onError={(e) => { e.target.src = "https://via.placeholder.com/300?text=No+Image"; }} 
                  />
                  <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-slate-200 text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 uppercase tracking-wider shadow-lg">
                    {p.product_department || 'General'}
                  </span>
                </div>

                {/* Content Section */}
                <div className="p-3 sm:p-4 flex flex-col flex-grow">
                  <div className="mb-2">
                      <p className="text-[10px] sm:text-xs text-slate-400 mb-1 capitalize">{p.product_category}</p>
                      <h3 className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-blue-400 transition-colors">
                          {p.product_name}
                      </h3>
                  </div>

                  {/* Price & Rating */}
                  <div className="flex items-center justify-between mb-4 mt-auto">
                      <div className="flex flex-col">
                          <span className="text-lg sm:text-xl font-bold text-white">₹{Number(p.selling_unit_price).toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                          <div className="flex gap-0.5 mb-1">{renderStars(p.product_rating || 4.5)}</div>
                          <span className="text-[10px] text-slate-400">({p.product_rating || "4.5"})</span>
                      </div>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-700/50">
                      <button onClick={() => handleAddToCart(p)} className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] sm:text-sm font-semibold py-2 sm:py-2.5 rounded-lg transition-all active:scale-95 border border-slate-600">
                          <FaShoppingCart size={12} className="text-blue-400 sm:text-sm"/> <span className="hidden sm:inline">Add</span>
                      </button>
                      <button onClick={() => handleBuyNow(p)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-sm font-bold py-2 sm:py-2.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95">
                          <FaBolt size={12} className="sm:text-sm" /> Buy
                      </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
            <FaUndo className="text-4xl text-slate-500 mb-4 opacity-50" />
            <p className="text-xl text-slate-400 font-medium">No matches found for "{query}"</p>
            <p className="text-sm text-slate-500 mt-2">Try checking your spelling or use different keywords.</p>
            <button onClick={() => navigate('/')} className="mt-6 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-bold transition-all shadow-lg hover:shadow-blue-500/20">
                Browse All Products
            </button>
          </div>
        )}
      </section>
    </main>
  );
};

export default Search;