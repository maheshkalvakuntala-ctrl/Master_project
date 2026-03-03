import React, { useState, useEffect, useRef } from "react";
import {
  customers,
  orders,
  orderItems,
  payments
} from "../data/dataUtils.js";

const CancelPredictor = () => {

  const [formData, setFormData] = useState({
    order_id: 0,
    customer_id: "",
    order_total_amount: 0,
    num_of_item: 0,
    shipping_charge: 0,
    order_year: 2024,
    order_month: 1,
    order_weekday: "Monday",
    is_weekend: 0,
    ordered_quantity: 0,
    selling_unit_price: 0,
    is_returned: 0,
    payment_method: "COD",
    customer_age: 0,
    customer_gender: "Male",
    customer_is_active: 1,
    customer_age_group: "18-25",
    customer_cancel_rate: 0,
    customer_total_orders: 0,
    customer_avg_order_value: 0
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef(null);

  // ============================
  // AUTO FILL DATA
  // ============================
  useEffect(() => {
    if (!formData.customer_id) return;

    const cid = parseInt(formData.customer_id);

    const user = customers.find(c => c.customer_id === cid);
    if (!user) return;

    const userOrders = orders
      .filter(o => o.customer_id === cid)
      .sort((a, b) => new Date(b.order_created_date) - new Date(a.order_created_date));

    const latestOrder = userOrders[0] || {};

    const latestItem = orderItems.find(i => i.order_id === latestOrder.order_id) || {};
    const latestPayment = payments.find(p => p.order_id === latestOrder.order_id) || {};

    const totalOrders = userOrders.length;

    const avgValue =
      totalOrders > 0
        ? userOrders.reduce((sum, o) => sum + (o.order_total_amount || 0), 0) / totalOrders
        : 0;

    setFormData(prev => ({
      ...prev,

      order_id: latestOrder.order_id || 0,
      customer_id: cid,

      order_total_amount: latestOrder.order_total_amount || 0,
      num_of_item: latestOrder.num_of_item || 1,
      shipping_charge: latestOrder.shipping_charge || 0,

      order_year: latestOrder.order_year || 2024,
      order_month: latestOrder.order_month || 1,
      order_weekday: latestOrder.order_weekday || "Monday",
      is_weekend: latestOrder.is_weekend ? 1 : 0,

      ordered_quantity: latestItem.ordered_quantity || 1,
      selling_unit_price: latestItem.selling_unit_price || 0,
      is_returned: latestItem.is_returned ? 1 : 0,

      payment_method: latestPayment.payment_method || "COD",

      customer_age: user.customer_age || 25,
      customer_gender: user.customer_gender === "M" ? "Male" : "Female",
      customer_is_active: user.customer_is_active ? 1 : 0,
      customer_age_group: user.customer_age_group || "18-25",

      customer_cancel_rate: user.customer_cancel_rate || 0.5,
      customer_total_orders: totalOrders,
      customer_avg_order_value: parseFloat(avgValue.toFixed(2))
    }));

  }, [formData.customer_id]);

  // ============================
  // API CALL
  // ============================
  const fetchPrediction = async (data) => {
    setLoading(true);

    try {
      const response = await fetch("https://backend-vpnc.onrender.com/predict-cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const res = await response.json();
      console.log("API RESULT:", res);
      setResult(res);

    } catch (err) {
      console.error("Prediction error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // REAL TIME PREDICTION
  // ============================
  useEffect(() => {
    if (!formData.customer_id) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchPrediction(formData);
    }, 800);

  }, [formData]);

  // ============================
  // INPUT HANDLER
  // ============================
  const handleChange = (e) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === "number"
        ? (value === "" ? "" : parseFloat(value))
        : value
    }));
  };

  // ============================
  // UI
  // ============================
  return (
  <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 p-6">

    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

      {/* LEFT: FORM */}
      <div className="lg:col-span-8 bg-white shadow-xl rounded-2xl p-8">

        <h2 className="text-3xl font-bold text-red-600 mb-6">
          Cancellation Prediction 🔴
        </h2>

        {/* Customer ID */}
        <input
          type="number"
          name="customer_id"
          placeholder="Enter Customer ID"
          value={formData.customer_id}
          onChange={handleChange}
          className="w-full mb-6 p-3 border rounded-lg"
        />

        <p className="text-xs text-gray-400 mb-4">
          ⚡ Real-time AI prediction enabled
        </p>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(formData).map((key) => (
            key !== "customer_id" && (
              <input
                key={key}
                type={
                  ["order_weekday", "payment_method", "customer_gender", "customer_age_group"].includes(key)
                    ? "text"
                    : "number"
                }
                name={key}
                value={formData[key]}
                onChange={handleChange}
                className="border p-2 rounded"
              />
            )
          ))}
        </div>

      </div>

      {/* RIGHT: RESULT CARD */}
      <div className="lg:col-span-4 flex items-center justify-center">

        {loading ? (
          <div className="bg-white p-8 rounded-2xl shadow-lg text-center w-full">
            <p className="text-gray-500">🤖 Predicting...</p>
          </div>
        ) : result ? (
          <div className={`w-full p-8 rounded-2xl shadow-xl text-center transition-all ${
            result.prediction === 1 ? "bg-red-100" : "bg-green-100"
          }`}>

            <h3 className={`text-2xl font-bold mb-4 ${
              result.prediction === 1 ? "text-red-600" : "text-green-600"
            }`}>
              {result.status}
            </h3>

            <p className="text-lg font-semibold text-gray-700">
              Probability
            </p>

            <p className="text-4xl font-black mt-2">
              {result.probability}%
            </p>

          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl shadow-lg text-center w-full">
            <p className="text-gray-400">
              Enter Customer ID to see prediction
            </p>
          </div>
        )}

      </div>

    </div>
  </div>
);
};

export default CancelPredictor;