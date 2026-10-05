import React from "react";
const PayButton: React.FC<{ orderId: number }> = () => (
    <button disabled style={{ padding: "10px 16px", backgroundColor: "#1976d2", color: "#fff",
        border: "none", borderRadius: "6px", cursor: "not-allowed", opacity: 0.65 }}>
        Payments unavailable in this demo
    </button>
);
export default PayButton;
