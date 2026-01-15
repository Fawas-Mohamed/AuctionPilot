// src/components/PayButton.tsx
import React from "react";
import axios from "axios";

interface PayButtonProps {
  orderId: number;
}

const PayButton: React.FC<PayButtonProps> = ({ orderId }) => {
  const handlePayment = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/payments/create-checkout-session/${orderId}`
      );

      if (res.data?.url) {
        window.location.href = res.data.url; // redirect to Stripe Checkout
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("Failed to start payment");
    }
  };

  return (
    <button
      onClick={handlePayment}
      style={{
        padding: "10px 16px",
        backgroundColor: "#1976d2",
        color: "#fff",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      Pay Now
    </button>
  );
};

export default PayButton;
