import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import PayButton from "@/components/PayButton";
type Result = { id: number; title: string; isClosed: boolean; isWinner: boolean; hasWinner: boolean };
const AuctionResultPage = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        let mounted = true;
        if (!orderId || !/^\d+$/.test(orderId)) { setError("Invalid auction."); return; }
        api.get("/auctions/" + orderId + "/result").then(response => { if (mounted) setResult(response.data); })
            .catch(() => { if (mounted) setError("Sign in to view a verified demo result."); });
        return () => { mounted = false; };
    }, [orderId]);
    return (
        <div style={{ padding: "40px", textAlign: "center" }}>
            <h2>{error || (!result ? "Loading result..." : result.isWinner ? "You won this demo auction."
                : result.isClosed ? "Demo auction closed." : "This auction is still open.")}</h2>
            <p>Portfolio demo: no payment, shipping or settlement.</p>
            {result?.isWinner && <PayButton orderId={result.id} />}
        </div>
    );
};
export default AuctionResultPage;
