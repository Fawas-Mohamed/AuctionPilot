import React, { useEffect, useState } from "react";
import api from "@/lib/api"; // your axios wrapper
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Auction {
  id: number;
  title: string;
  description?: string;
  startPrice: number;
  currentPrice: number;
  startTime?: string;
  endTime?: string;
  status: string;
  imageUrl?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
}

interface Category {
  id: number;
  name: string;
}

export default function AdminAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);

  // form: imageFile may be File or existing string url
  const [form, setForm] = useState({
    title: "",
    description: "",
    startPrice: 0,
    startTime: "",
    endTime: "",
    imageFile: null as File | string | null,
    categoryId: "" // string for select; convert on submit
  });

  // Helper: normalize auctions & merge category names
  const mergeCategoryNames = (rawAucs: any[], cats: Category[]): Auction[] => {
    const map = new Map<number, string>();
    cats.forEach(c => map.set(c.id, c.name));
    return rawAucs.map((r: any) => {
      const categoryId = r.categoryId ?? (r.category ? r.category.id : null);
      const categoryName = r.category?.name ?? (categoryId ? map.get(Number(categoryId)) ?? null : null);
      const startPrice = Number(r.startPrice ?? 0);
      const currentPrice = Number(r.currentPrice ?? r.startPrice ?? 0);
      const status = r.status ?? computeStatus(r.startTime, r.endTime);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        startPrice,
        currentPrice,
        startTime: r.startTime,
        endTime: r.endTime,
        status,
        imageUrl: r.imageUrl ?? null,
        categoryId: categoryId ? Number(categoryId) : null,
        categoryName
      } as Auction;
    });
  };

  const computeStatus = (start?: string, end?: string) => {
    if (!start || !end) return "Draft";
    const now = Date.now();
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (now < s) return "Upcoming";
    if (now >= s && now <= e) return "Ongoing";
    return "Closed";
  };

  // fetch categories & auctions in parallel and normalize
  const fetchAll = async () => {
    try {
      const [catRes, aucRes] = await Promise.all([api.get("/categories"), api.get("/admin/auctions")]);
      const cats: Category[] = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data ?? []);
      const rawAucs = aucRes.data ?? [];
      setCategories(cats);
      setAuctions(mergeCategoryNames(rawAucs, cats));
    } catch (err) {
      console.error("Failed to fetch auctions/categories", err);
      setCategories([]);
      setAuctions([]);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  // realtime-ish: update statuses every 10s
  useEffect(() => {
    const iv = setInterval(() => {
      setAuctions(prev => prev.map(a => ({ ...a, status: computeStatus(a.startTime, a.endTime) })));
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  // form handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "startPrice") {
      setForm(f => ({ ...f, [name]: Number(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setForm(f => ({ ...f, imageFile: e.target.files![0] }));
    }
  };

  // start edit: populate form
  const startEdit = (a: Auction) => {
    setEditingAuction(a);
    setForm({
      title: a.title ?? "",
      description: a.description ?? "",
      startPrice: a.startPrice ?? 0,
      startTime: a.startTime ?? "",
      endTime: a.endTime ?? "",
      imageFile: a.imageUrl ?? null, // keep existing url string if present
      categoryId: a.categoryId ? String(a.categoryId) : ""
    });
    setOpen(true);
  };

  // Save create/update
  const handleSave = async () => {
    try {
      // Use JSON payload unless file provided -> FormData
      let useFormData = form.imageFile instanceof File;
      if (useFormData) {
        const fd = new FormData();
        fd.append("title", form.title);
        fd.append("description", form.description);
        fd.append("startPrice", String(form.startPrice));
        fd.append("startTime", form.startTime);
        fd.append("endTime", form.endTime);
        if (form.categoryId) fd.append("categoryId", String(form.categoryId));
        if (form.imageFile instanceof File) fd.append("image", form.imageFile);
        if (editingAuction) {
          await api.put(`/admin/auctions/${editingAuction.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        } else {
          await api.post("/admin/auctions", fd, { headers: { "Content-Type": "multipart/form-data" } });
        }
      } else {
        // JSON payload; imageFile may be a string url or null
        const payload: any = {
          title: form.title,
          description: form.description,
          startPrice: Number(form.startPrice),
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          imageUrl: typeof form.imageFile === "string" ? form.imageFile : null,
          categoryId: form.categoryId ? Number(form.categoryId) : null
        };
        if (editingAuction) {
          await api.put(`/admin/auctions/${editingAuction.id}`, payload);
        } else {
          await api.post("/admin/auctions", payload);
        }
      }
      setOpen(false);
      setEditingAuction(null);
      await fetchAll();
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save auction — see console for details.");
    }
  };

  // Delete
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this auction?")) return;
    try {
      await api.delete(`/admin/auctions/${id}`);
      await fetchAll();
    } catch (err) {
      console.error("Delete failed", err);
      alert("Delete failed.");
    }
  };

  // Close (use admin endpoint)
  const handleClose = async (id: number) => {
    try {
      await api.put(`/admin/auctions/${id}/close`);
      await fetchAll();
    } catch (err) {
      console.error("Close failed", err);
      alert("Close failed.");
    }
  };

  // prepare new form
  const startCreate = () => {
    setEditingAuction(null);
    setForm({
      title: "",
      description: "",
      startPrice: 0,
      startTime: "",
      endTime: "",
      imageFile: null,
      categoryId: ""
    });
    setOpen(true);
  };

  return (
    <Card className="p-4">
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Auction Management</h2>
          <Button onClick={startCreate}>+ New Auction</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Start Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auctions.map(a => (
              <TableRow key={a.id}>
                <TableCell>{a.title}</TableCell>
                <TableCell>{a.startPrice.toLocaleString()}</TableCell>
                <TableCell>{a.currentPrice.toLocaleString()}</TableCell>
                <TableCell>{a.categoryName ?? "—"}</TableCell>
                <TableCell><Badge>{a.status}</Badge></TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" onClick={() => startEdit(a)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(a.id)}>Delete</Button>
                  {a.status !== "Closed" && <Button size="sm" variant="outline" onClick={() => handleClose(a.id)}>Close</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAuction ? "Edit Auction" : "New Auction"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Input name="title" placeholder="Title" value={form.title} onChange={handleChange} />
              <Input name="description" placeholder="Description" value={form.description} onChange={handleChange} />
              <Input name="startPrice" type="number" placeholder="Start Price" value={String(form.startPrice)} onChange={handleChange} />
              <Input name="startTime" type="datetime-local" value={form.startTime} onChange={handleChange} />
              <Input name="endTime" type="datetime-local" value={form.endTime} onChange={handleChange} />

              <div>
                <label className="block text-sm font-medium mb-1">Image</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full p-2 border rounded" />
                {/* show existing url if any */}
                {typeof form.imageFile === "string" && form.imageFile ? (
                  <div className="text-sm text-muted-foreground mt-1">Using existing image: {form.imageFile}</div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select name="categoryId" value={form.categoryId} onChange={handleChange} className="w-full p-2 border rounded">
                  <option value="">-- Select Category --</option>
                  {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4 space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
