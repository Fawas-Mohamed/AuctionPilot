import { useParams } from "react-router-dom";
import PayButton from "@/components/PayButton";

const AuctionResultPage = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) return <p>Invalid order</p>;

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h2>🎉 Congratulations! You won the auction!</h2>
      <p>Your Order ID: {orderId}</p>
      <PayButton orderId={Number(orderId)} />
    </div>
  );
};

export default AuctionResultPage;
