import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { FaEye, FaEyeSlash, FaGoogle, FaUserCircle, FaLock, FaEnvelope } from "react-icons/fa";
import toast, { Toaster } from 'react-hot-toast';

const provider = new GoogleAuthProvider();

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const checkUserRoleAndRedirect = async (user) => {
    const userEmail = user.email;
    const toastId = toast.loading("Verifying Account...");

    try {
      const adminQuery = query(collection(db, "adminDetails"), where("email", "==", userEmail));
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const paymentQuery = query(collection(db, "subscribed_payments"), where("email", "==", userEmail));
        const paymentSnapshot = await getDocs(paymentQuery);

        if (!paymentSnapshot.empty) {
          toast.success("Welcome Admin!", { id: toastId });
          navigate("/admindashboard");
        } else {
          toast.error("Access Denied: Purchase a plan.", { id: toastId });
          await signOut(auth);
          setTimeout(() => navigate("/"), 2000);
        }
        return;
      }

      const userQuery = query(collection(db, "users"), where("email", "==", userEmail));
      const userSnapshot = await getDocs(userQuery);

      if (!userSnapshot.empty) {
        toast.success("Welcome User!", { id: toastId });
        navigate("/userdashboard");
        return;
      }

      toast.error("Email not found. Sign up.", { id: toastId });
      await signOut(auth);

    } catch (err) {
      toast.error("Verification failed.", { id: toastId });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      rememberMe
        ? localStorage.setItem("rememberedEmail", email)
        : localStorage.removeItem("rememberedEmail");

      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkUserRoleAndRedirect(userCredential.user);

    } catch {
      setError("Invalid email or password");
      toast.error("Invalid credentials");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const result = await signInWithPopup(auth, provider);
      await checkUserRoleAndRedirect(result.user);
    } catch {
      toast.error("Google login failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 relative overflow-hidden">

      {/* 🔥 Animated Glow */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600/30 blur-[150px] top-[-100px] left-[-100px] animate-pulse" />
      <div className="absolute w-[500px] h-[500px] bg-blue-600/30 blur-[150px] bottom-[-100px] right-[-100px] animate-pulse" />

      <Toaster position="top-center" />

      {/* 🔥 Card */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in-up">

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-r from-violet-600 to-cyan-500 p-4 rounded-full shadow-lg">
            <FaUserCircle className="text-white text-4xl" />
          </div>
        </div>

        <h2 className="text-center text-2xl font-bold text-white mb-6">
          Welcome Back 👋
        </h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div className="relative">
            <FaEnvelope className="absolute top-3 left-3 text-slate-400" />
            <input
              type="email"
              placeholder="Email address"
              className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-800/70 border border-slate-700 text-white focus:ring-2 focus:ring-violet-500 outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <FaLock className="absolute top-3 left-3 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-800/70 border border-slate-700 text-white focus:ring-2 focus:ring-violet-500 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span
              className="absolute top-3 right-3 text-slate-400 cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Remember */}
          <div className="flex justify-between items-center text-sm text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <span
              className="hover:text-white cursor-pointer"
              onClick={() => navigate("/reset")}
            >
              Forgot?
            </span>
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 py-3 rounded-xl font-semibold text-white shadow-lg hover:scale-105 transition-all"
          >
            Login
          </button>
        </form>

        {/* Divider */}
        <div className="text-center my-5 text-slate-400 text-sm">or continue with</div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-slate-700 py-3 rounded-xl hover:bg-slate-800 transition text-white font-semibold"
        >
          <FaGoogle />
          Sign in with Google
        </button>

        {/* Signup */}
        <p className="text-center text-slate-400 mt-6 text-sm">
          Don't have an account?
          <Link to="/signup" className="text-violet-400 ml-1 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
