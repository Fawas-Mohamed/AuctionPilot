import api from "./api";
export async function submitBid(auctionId: number | string, amount: number) {
    const key = "auctionpilot:pending-bid:" + (localStorage.getItem("userId") || "me") + ":" + auctionId;
    let pending: { amount: number; requestId: string } | null = null;
    try { pending = JSON.parse(sessionStorage.getItem(key) || "null"); } catch { }
    if (!pending || pending.amount !== amount) pending = { amount, requestId: crypto.randomUUID() };
    sessionStorage.setItem(key, JSON.stringify(pending));
    try {
        const response = await api.post("/auctions/" + auctionId + "/placebid", pending);
        sessionStorage.removeItem(key);
        return response;
    } catch (error: unknown) {
        const status = (error as { response?: { status: number } }).response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) sessionStorage.removeItem(key);
        throw error;
    }
}
