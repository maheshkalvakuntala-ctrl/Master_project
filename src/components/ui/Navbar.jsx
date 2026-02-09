import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  doc, getDoc, collection, query, where, onSnapshot, deleteDoc 
} from "firebase/firestore";
import { auth, db } from '../../firebase'; 
import { clearCart, setCart } from "../../slices/cartSlice"; 
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { 
  FaUser, FaSearch, FaShoppingCart, FaHome, FaThLarge, FaUserCircle, FaSignOutAlt, FaBell, FaPhone
} from 'react-icons/fa';
import { 
  X, CheckCircle, Truck, Trash2, Mic, Menu, AlertTriangle 
} from 'lucide-react';

// Import Voice Assistant
import VoiceAssistant from '../../components/VoiceAssistant';

// --- Navbar Notifications Component ---
const NavbarNotifications = ({ user, isAdmin, isSuperAdmin }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    let q;
    if (isAdmin || isSuperAdmin) {
      q = query(collection(db, "notifications"), where("type", "==", "admin"));
    } else {
      q = query(collection(db, "notifications"), where("recipientId", "in", [user.uid, "all"]));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredNotes = (isAdmin || isSuperAdmin) ? notes : notes.filter(n => n.type !== 'admin');
      filteredNotes.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(filteredNotes);
    });
    return () => unsubscribe();
  }, [user, isAdmin, isSuperAdmin]);

  const markAsRead = async (id) => { 
      try { await deleteDoc(doc(db, "notifications", id)); } 
      catch (e) { console.error("Error deleting notification:", e); } 
  };

  const clearAllNotifications = async () => {
      if (notifications.length === 0) return;
      try {
          const deletePromises = notifications.map(note => deleteDoc(doc(db, "notifications", note.id)));
          await Promise.all(deletePromises);
          toast.success("All notifications cleared", { 
              style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } 
          });
      } catch (e) {
          console.error("Error clearing notifications:", e);
      }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-slate-800">
        <FaBell size={20} />
        {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
      </button>
      <AnimatePresence>
        {isOpen && (
           <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:10}} className="absolute top-12 right-[-60px] sm:right-0 w-[85vw] sm:w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden origin-top-right">
              <div className="p-3 border-b border-slate-700 bg-slate-950/50 flex justify-between items-center">
                 <h4 className="font-bold text-white text-sm">Notifications</h4>
                 <div className="flex items-center gap-2">
                     {notifications.length > 0 && (
                         <button 
                            onClick={clearAllNotifications} 
                            className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors mr-2 flex items-center gap-1"
                            title="Clear All"
                         >
                             <Trash2 size={12}/> Clear All
                         </button>
                     )}
                     <button onClick={() => setIsOpen(false)}><X size={16} className="text-slate-400 hover:text-white"/></button>
                 </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                 {notifications.length === 0 ? (
                    <div className="text-center py-8">
                        <FaBell className="mx-auto text-slate-700 mb-2 opacity-50" size={24} />
                        <p className="text-slate-500 text-sm">No new notifications</p>
                    </div>
                 ) : notifications.map(n => (
                    <div key={n.id} className="bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-700 text-sm relative group transition-colors pr-8">
                        <p className="text-slate-200 leading-snug">{n.message}</p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                        </span>
                        <button 
                            onClick={(e)=>{e.stopPropagation(); markAsRead(n.id)}} 
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition-opacity p-1"
                            title="Clear"
                        >
                            <X size={14}/>
                        </button>
                    </div>
                 ))}
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main Navbar Component ---
const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [isAuth, setIsAuth] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
   
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const dropdownRef = useRef(null);
  const userIconRef = useRef(null);
   
  const cart = useSelector(state => state.cart); 
  const totalQuantity = useSelector(state => state.cart.totalQuantity);

  const isActive = (path) => location.pathname === path;

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuth(true);
        const savedCart = localStorage.getItem(`cart_${user.uid}`);
        if (savedCart) dispatch(setCart(JSON.parse(savedCart)));
        
        try {
          const adminRef = doc(db, "adminDetails", user.uid);
          const adminSnap = await getDoc(adminRef);
          if (adminSnap.exists()) {
             const data = adminSnap.data();
             setCurrentUser({ ...user, ...data });
             setProfileImage(data.profileImage);
             setIsAdmin(true);
             if(user.email === "gudipatisrihari6@gmail.com") setIsSuperAdmin(true);
          } else {
             const userRef = doc(db, "users", user.uid);
             const userSnap = await getDoc(userRef);
             if (userSnap.exists()) {
               const data = userSnap.data();
               setCurrentUser({ ...user, ...data });
               setProfileImage(data.profileImage);
             } else { setCurrentUser(user); }
          }
        } catch(e) { console.error(e); }
      } else {
        setIsAuth(false);
        setCurrentUser(null);
        setProfileImage(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        dispatch(clearCart());
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  // Dropdown closer
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target) && !userIconRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const handleLogout = async () => {
    await signOut(auth);
    dispatch(clearCart());
    toast.success("Logged out successfully", { style: { background: '#1e293b', color: '#fff' }});
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setShowMobileSearch(false);
      setSearchQuery("");
    }
  };

  const getDashboardLink = () => isSuperAdmin ? "/superadmindashboard" : isAdmin ? "/admindashboard" : "/userdashboard";
  const displayName = currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : currentUser?.email;

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* Voice Assistant Modal */}
      <VoiceAssistant isOpen={showVoiceModal} onClose={() => setShowVoiceModal(false)} />

      {/* --- MAIN NAVBAR --- */}
      <nav className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 shadow-lg transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">

           {/* LOGO */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-bold tracking-tighter text-white group-hover:text-blue-400 transition-colors whitespace-nowrap">
                GSH<span className="text-blue-500">.</span>STORE
              </span>
              <span className="text-[8px] md:text-[10px] tracking-widest text-slate-400 uppercase -mt-1 hidden sm:block">Premium Collection</span>
            </div>
          </Link>

            {/* 2. SEARCH BAR (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
                <form onSubmit={handleSearch} className="w-full">
                    <input 
                        type="text" 
                        placeholder="Search products, brands..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 text-slate-200 text-sm rounded-full pl-5 pr-12 py-2.5 border border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all placeholder-slate-500"
                    />
                    <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full transition-colors">
                        <FaSearch size={12} />
                    </button>
                </form>
            </div>

            {/* 3. DESKTOP NAV LINKS */}
            <div className="hidden lg:flex items-center gap-8 text-sm font-medium">
                <Link to="/" className={`transition-colors ${isActive('/') ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-white'}`}>Home</Link>
                <Link to="/about" className={`transition-colors ${isActive('/about') ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-white'}`}>About</Link>
                <Link to="/contact" className={`transition-colors ${isActive('/contact') ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-white'}`}>Contact</Link>
            </div>

            {/* 4. ACTIONS (Mobile & Desktop) */}
            <div className="flex items-center gap-1 sm:gap-3">
                
                {/* Mobile Search Toggle */}
                <button onClick={() => setShowMobileSearch(!showMobileSearch)} className="md:hidden p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                    {showMobileSearch ? <X size={20}/> : <FaSearch size={18}/>}
                </button>

                {/* Voice Assistant Trigger */}
                <button 
                    onClick={() => setShowVoiceModal(true)} 
                    className={`p-2 transition-colors rounded-full hover:bg-slate-800 group relative ${showVoiceModal ? 'text-blue-400 bg-slate-800' : 'text-slate-300 hover:text-blue-400'}`}
                    title="Voice Assistant"
                >
                    <Mic size={20} className={`transition-transform ${showVoiceModal ? 'scale-110' : 'group-hover:scale-110'}`} />
                    
                    {/* ✅ Active Signal (Blue Pulse) - Only shows when active */}
                    {showVoiceModal && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    )}
                </button>

                {/* Notifications */}
                {isAuth && currentUser && <NavbarNotifications user={currentUser} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />}

                {/* Cart Icon (Desktop Only) */}
                <Link to="/cart" className="hidden md:flex relative p-2 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-slate-800 group">
                    <FaShoppingCart size={20} />
                    {totalQuantity > 0 && (
                        <span className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900 group-hover:scale-110 transition-transform">{totalQuantity}</span>
                    )}
                </Link>

                {/* Profile Dropdown */}
                {isAuth ? (
                    <div className="relative">
                        <button ref={userIconRef} onClick={() => setShowDropdown(!showDropdown)} className="ml-1 focus:outline-none">
                            <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden border-2 ${showDropdown ? 'border-blue-500' : 'border-slate-600'} hover:border-blue-500 transition-all`}>
                                {profileImage ? <img src={profileImage} alt="User" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-slate-800 flex items-center justify-center text-slate-400"><FaUser size={14} /></div>}
                            </div>
                        </button>
                        <AnimatePresence>
                            {showDropdown && (
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} ref={dropdownRef} className="absolute right-0 mt-3 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50">
                                        <p className="text-slate-400 text-xs">Signed in as</p>
                                        <p className="text-white font-bold truncate text-sm">{displayName}</p>
                                    </div>
                                    <div className="p-1.5">
                                        <Link to={getDashboardLink()} onClick={() => setShowDropdown(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                                            <FaThLarge className="text-blue-500"/> Dashboard
                                        </Link>
                                        <div className="h-px bg-slate-800 my-1 mx-2"></div>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-400 hover:bg-slate-800 hover:text-rose-300 rounded-lg transition-colors text-left">
                                            <FaSignOutAlt/> Sign out
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ) : (
                    <Link to="/login" className="ml-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition-all shadow-lg hover:shadow-blue-900/50">Login</Link>
                )}
            </div>
          </div>

          {/* MOBILE SEARCH */}
          <AnimatePresence>
            {showMobileSearch && (
                <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="md:hidden border-t border-slate-800 overflow-hidden">
                    <form onSubmit={handleSearch} className="py-3 pb-4">
                        <div className="relative">
                            <input type="text" autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="What are you looking for?" className="w-full bg-slate-950 text-white rounded-lg pl-10 pr-4 py-3 border border-slate-700 focus:border-blue-500 outline-none text-sm"/>
                            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                        </div>
                    </form>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* --- MOBILE BOTTOM NAV --- */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-800 flex justify-around items-center z-[60] pb-safe h-16 px-2 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <Link to="/" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/') ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
           <FaHome size={20} className={isActive('/') ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}/>
           <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link to="/search" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive('/search') ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
           <FaSearch size={20} /><span className="text-[10px] font-medium">Search</span>
        </Link>
        <Link to="/cart" className={`flex flex-col items-center justify-center w-full h-full gap-1 relative ${isActive('/cart') ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
           <div className="relative">
               <FaShoppingCart size={20} className={isActive('/cart') ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}/>
               {totalQuantity > 0 && <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900">{totalQuantity}</span>}
           </div>
           <span className="text-[10px] font-medium">Cart</span>
        </Link>
        <Link to={isAuth ? getDashboardLink() : "/login"} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isActive(getDashboardLink()) || isActive('/login') ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
           {isAuth ? (profileImage ? <img src={profileImage} alt="Profile" className={`w-6 h-6 rounded-full border ${isActive(getDashboardLink()) ? 'border-blue-500' : 'border-slate-500'}`}/> : <FaUserCircle size={22} className={isActive(getDashboardLink()) ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}/>) : <FaUserCircle size={22} />}
           <span className="text-[10px] font-medium">{isAuth ? 'Account' : 'Login'}</span>
        </Link>
      </div>
    </>
  );
};

export default Navbar;