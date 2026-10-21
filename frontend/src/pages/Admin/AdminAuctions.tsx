import React, { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Category = { id: number; name: string };
type Auction = {
  id: number;
  title: string;
  description?: string;
  startPrice: number;
  currentPrice: number;
  reservePrice?: number | null;
  startTime: string;
  endTime: string;
  status?: number | string;
  isClosed?: boolean;
  bidCount: number;
  imageUrl?: string | null;
  categoryId?: number | null;
  category?: Category | null;
};

const emptyForm = {
  title: "", description: "", startPrice: "", reservePrice: "", startTime: "", endTime: "", reopen: false,
  imageFile: null as File | string | null, categoryId: ""
};

function auctionStatus(auction: Auction, now: number) {
  const status = String(auction.status ?? "").toLowerCase();
  if (auction.isClosed || status === "3" || status === "closed" || Date.parse(auction.endTime) <= now) return "Closed";
  if (status === "0" || status === "draft") return "Draft";
  return Date.parse(auction.startTime) <= now ? "Live" : "Scheduled";
}

function localTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

function errorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string; errors?: Record<string, string[]>; title?: string }>(error)) {
    const data = error.response?.data;
    return data?.message || (data?.errors && Object.values(data.errors).flat().join(" ")) || data?.title || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function AdminAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [now, setNow] = useState(Date.now);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catRes, aucRes] = await Promise.all([
        api.get<Category[]>("/categories"), api.get<Auction[]>("/admin/auctions")
      ]);
      setCategories(catRes.data);
      setAuctions(aucRes.data);
      setNow(Date.now());
    } catch (error) {
      setLoadError(errorMessage(error, "Unable to load auctions. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const startEdit = (auction: Auction) => {
    setEditingAuction(auction);
    setForm({
      title: auction.title, description: auction.description ?? "", startPrice: String(auction.startPrice),
      reservePrice: auction.reservePrice == null ? "" : String(auction.reservePrice), reopen: false,
      startTime: localTime(auction.startTime), endTime: localTime(auction.endTime),
      imageFile: auction.imageUrl ?? null, categoryId: auction.categoryId ? String(auction.categoryId) : ""
    });
    setFormError(null);
    setOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (actionInFlight.current) return;
    setFormError(null);
    const startTime = Date.parse(form.startTime);
    const endTime = Date.parse(form.endTime);
    if (!form.title.trim() || !Number.isFinite(Number(form.startPrice)) || Number(form.startPrice) <= 0) {
      setFormError("Enter a title and a positive start price."); return;
    }
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime || (!editingAuction && endTime <= Date.now())) {
      setFormError(editingAuction ? "The end time must be after the start time." : "The end time must be after the start time and in the future."); return;
    }
    if (form.reopen && endTime <= Date.now()) {
      setFormError("Choose a future end time to reopen the auction."); return;
    }
    actionInFlight.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      let imageUrl = typeof form.imageFile === "string" ? form.imageFile : null;
      if (form.imageFile instanceof File) {
        const upload = new FormData();
        upload.append("file", form.imageFile);
        const response = await api.post<{ imageUrl: string }>("/uploads", upload);
        imageUrl = response.data.imageUrl;
        if (!imageUrl) throw new Error("Image upload failed. Please try again.");
        // Retain a successful upload if saving the auction needs to be retried.
        setForm(previous => ({ ...previous, imageFile: imageUrl }));
      }
      const payload = {
        title: form.title.trim(), description: form.description, startPrice: Number(form.startPrice),
        reservePrice: form.reservePrice === "" ? null : Number(form.reservePrice), reopen: form.reopen,
        startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(),
        imageUrl, categoryId: form.categoryId ? Number(form.categoryId) : null
      };
      if (editingAuction) await api.put(`/admin/auctions/${editingAuction.id}`, payload);
      else await api.post("/admin/auctions", payload);
      setOpen(false);
      setNotice(editingAuction ? "Auction updated." : "Auction created.");
      setEditingAuction(null);
      await fetchAll();
    } catch (error) {
      setFormError(errorMessage(error, "Unable to save the auction. Please try again."));
      if (isAxiosError(error) && error.response?.status === 409) await fetchAll();
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const handleAction = async (auction: Auction, action: "delete" | "close") => {
    if (actionInFlight.current) return;
    const prompt = action === "delete" ? `Delete "${auction.title}" and all its bid history? This cannot be undone.`
      : `Close "${auction.title}" now? Bidding will end and the result will be final.`;
    if (!window.confirm(prompt)) return;
    actionInFlight.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      if (action === "delete") await api.delete(`/admin/auctions/${auction.id}`);
      else await api.patch(`/admin/auctions/${auction.id}/close`);
      setNotice(action === "delete" ? "Auction deleted." : "Auction closed. Its history has been retained.");
      await fetchAll();
    } catch (error) {
      setActionError(errorMessage(error, `Unable to ${action} the auction. Please try again.`));
      if (isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) await fetchAll();
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const startCreate = () => {
    setEditingAuction(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  };

  const categoryName = (auction: Auction) => auction.category?.name
    ?? categories.find(category => category.id === auction.categoryId)?.name ?? "Uncategorized";

  const actions = (auction: Auction) => {
    const closed = auctionStatus(auction, now) === "Closed";
    return <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={`/auctions/${auction.id}`}>{closed ? "View history" : "View"}</Link></Button>
        <Button size="sm" className="min-h-11" disabled={busy || loading || !!loadError} onClick={() => startEdit(auction)}>Edit</Button>
        <Button size="sm" className="min-h-11" variant="destructive" disabled={busy || loading || !!loadError} onClick={() => void handleAction(auction, "delete")}>Delete</Button>
        {!closed && <Button size="sm" className="min-h-11" variant="outline" disabled={busy || loading} onClick={() => void handleAction(auction, "close")}>Close</Button>}
      </div>
    </div>;
  };

  return (
    <Card className="m-3 min-w-0 sm:m-6">
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Auction Management</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={loading || busy} onClick={() => void fetchAll()}>Refresh</Button>
            <Button disabled={loading || busy || !!loadError} onClick={startCreate}>+ New Auction</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">As an administrator, you can edit or delete any auction, extend or shorten its duration, and reopen closed auctions. Editing keeps existing bids; deleting removes the auction and its bid history.</p>
        {notice && <p role="status" className="text-sm">{notice}</p>}
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>{loadError}</span><Button variant="outline" disabled={loading} onClick={() => void fetchAll()}>Retry</Button>
        </div>}
        {loading && <p role="status">Loading auctions...</p>}
        {!loading && !loadError && auctions.length === 0 && <p className="text-muted-foreground">No auctions yet. Create an auction to get started.</p>}
        {auctions.length > 0 && <>
          <div className="space-y-4 md:hidden">
            {auctions.map(auction => <article key={auction.id} aria-label={auction.title} className="min-w-0 space-y-3 rounded-lg border p-3 [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 font-semibold">{auction.title}</h2><Badge>{auctionStatus(auction, now)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{categoryName(auction)}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Start price</dt><dd>{auction.startPrice.toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Current price</dt><dd>{auction.currentPrice.toLocaleString()}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">Ends: {new Date(auction.endTime).toLocaleString()}</p>
              {actions(auction)}
            </article>)}
          </div>
          <div className="hidden min-w-0 md:block">
            <Table className="min-w-[740px]">
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Start Price</TableHead><TableHead>Current Price</TableHead>
                <TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>{auctions.map(auction => <TableRow key={auction.id}>
                <TableCell className="max-w-64 [overflow-wrap:anywhere]">{auction.title}</TableCell>
                <TableCell>{auction.startPrice.toLocaleString()}</TableCell><TableCell>{auction.currentPrice.toLocaleString()}</TableCell>
                <TableCell className="max-w-48 [overflow-wrap:anywhere]">{categoryName(auction)}</TableCell>
                <TableCell><Badge>{auctionStatus(auction, now)}</Badge></TableCell><TableCell>{actions(auction)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
        </>}
        <Dialog open={open} onOpenChange={value => { if (!actionInFlight.current) setOpen(value); }}>
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
            <DialogHeader>
              <DialogTitle>{editingAuction ? "Edit Auction" : "New Auction"}</DialogTitle>
              <DialogDescription>{editingAuction ? "Edit auction details and start/end times. Existing bids are kept. Closed auctions stay closed unless you select Reopen auction." : "Enter the details and schedule for the new auction."}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="min-w-0 space-y-3">
              <fieldset disabled={busy} className="min-w-0 space-y-3">
                <div><label htmlFor="auction-title" className="text-sm font-medium">Title</label>
                  <Input id="auction-title" name="title" value={form.title} onChange={handleChange} required maxLength={200} /></div>
                <div><label htmlFor="auction-description" className="text-sm font-medium">Description</label>
                  <Textarea id="auction-description" name="description" value={form.description} onChange={handleChange} maxLength={10000} /></div>
                <div><label htmlFor="auction-price" className="text-sm font-medium">Start price</label>
                  <Input id="auction-price" name="startPrice" type="number" min="0.01" step="0.01" value={form.startPrice} onChange={handleChange} required /></div>
                <div><label htmlFor="auction-reserve" className="text-sm font-medium">Reserve price (optional)</label>
                  <Input id="auction-reserve" name="reservePrice" type="number" min="0" step="0.01" value={form.reservePrice} onChange={handleChange} /></div>
                <div><label htmlFor="auction-start" className="text-sm font-medium">Start time (your local time)</label>
                  <Input id="auction-start" name="startTime" type="datetime-local" step="1" value={form.startTime} onChange={handleChange} required /></div>
                <div><label htmlFor="auction-end" className="text-sm font-medium">End time (your local time)</label>
                  <Input id="auction-end" name="endTime" type="datetime-local" step="1" value={form.endTime} onChange={handleChange} required /></div>
                {editingAuction && <div className="flex flex-wrap gap-2" aria-label="Adjust auction duration">
                  {[-60, -15, 15, 60].map(minutes => <Button key={minutes} type="button" variant="outline" size="sm" onClick={() => {
                    const end = Date.parse(form.endTime);
                    if (Number.isFinite(end)) setForm(previous => ({ ...previous, endTime: localTime(new Date(end + minutes * 60000).toISOString()) }));
                  }}>{minutes > 0 ? "+" : "-"}{Math.abs(minutes)} min</Button>)}
                </div>}
                {editingAuction && auctionStatus(editingAuction, now) === "Closed" && <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={form.reopen} onChange={event => setForm(previous => ({ ...previous, reopen: event.target.checked }))} />
                  <span>Reopen auction<span className="block text-xs text-muted-foreground">Choose a future end time to resume bidding. The previous result is cleared and existing bids are kept.</span></span>
                </label>}
                <div><label htmlFor="auction-image" className="text-sm font-medium">Image (optional)</label>
                  <Input id="auction-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setForm(previous => ({ ...previous, imageFile: event.target.files?.[0] ?? previous.imageFile }))} />
                  {typeof form.imageFile === "string" && <p className="mt-1 text-xs text-muted-foreground">The existing image will be kept unless you choose a replacement.</p>}</div>
                <div><label htmlFor="auction-category" className="text-sm font-medium">Category</label>
                  <select id="auction-category" name="categoryId" value={form.categoryId} onChange={handleChange} className="min-h-11 w-full rounded border bg-background p-2 text-sm">
                    <option value="">Uncategorized</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select></div>
              </fieldset>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
